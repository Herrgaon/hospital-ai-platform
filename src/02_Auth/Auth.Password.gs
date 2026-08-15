// Băm mật khẩu — Apps Script KHÔNG có bcrypt/argon2/scrypt sẵn (Utilities chỉ có SHA-1/256/384/512 và
// HMAC, đều là hàm băm NHANH, không có "cost factor" chống brute-force). Tự dựng PBKDF2-HMAC-SHA256
// (RFC 2898) bằng cách lặp Utilities.computeHmacSha256Signature — đây là cách làm đúng, không phải
// giải pháp tạm — xem báo cáo thẩm định kiến trúc (mục "Bảo mật").
//
// Số vòng lặp: 20000 — cân bằng giữa an toàn và thời gian 1 lần thực thi Apps Script (mỗi lần đăng
// nhập tốn ~20000 phép HMAC, chấp nhận được trong giới hạn 6 phút/lần thực thi, không đáng kể với
// tần suất đăng nhập thực tế).
const PBKDF2_ITERATIONS_ = 20000;
const PBKDF2_KEY_LENGTH_BYTES_ = 32;

// Utilities.computeHmacSha256Signature không có overload (Byte[] value, String key) — xác nhận qua
// clasp run thực tế (lỗi "The parameters (number[],String) don't match the method signature"), không
// phải giả định. Phải quy cả 2 tham số về Byte[] nhất quán.
function pbkdf2Sha256_(password, saltBytes, iterations, keyLengthBytes) {
  const passwordBytes = Utilities.newBlob(password).getBytes();
  const hashLenBytes = 32;
  const blockCount = Math.ceil(keyLengthBytes / hashLenBytes);
  let derivedBytes = [];

  for (let blockIndex = 1; blockIndex <= blockCount; blockIndex++) {
    const blockIndexBytes = [
      (blockIndex >>> 24) & 0xFF, (blockIndex >>> 16) & 0xFF,
      (blockIndex >>> 8) & 0xFF, blockIndex & 0xFF
    ];
    let u = Utilities.computeHmacSha256Signature(saltBytes.concat(blockIndexBytes), passwordBytes);
    let t = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = Utilities.computeHmacSha256Signature(u, passwordBytes);
      t = t.map(function (b, idx) { return b ^ u[idx]; });
    }
    derivedBytes = derivedBytes.concat(t);
  }
  return derivedBytes.slice(0, keyLengthBytes);
}

// Salt ngẫu nhiên — Apps Script không lộ API random-bytes trực tiếp, dùng Utilities.getUuid() (nội bộ
// dùng nguồn ngẫu nhiên an toàn để sinh UUID v4) làm nguồn entropy, đủ dùng cho salt (không cần bí mật,
// chỉ cần không đoán trước/không trùng).
function generateSalt_() {
  return Utilities.getUuid() + Utilities.getUuid();
}

function hashPassword_(plainPassword) {
  const salt = generateSalt_();
  const saltBytes = Utilities.newBlob(salt).getBytes();
  const derived = pbkdf2Sha256_(plainPassword, saltBytes, PBKDF2_ITERATIONS_, PBKDF2_KEY_LENGTH_BYTES_);
  return { hash: Utilities.base64Encode(derived), salt: salt };
}

function verifyPassword_(plainPassword, storedHashBase64, storedSalt) {
  if (isBlank(storedHashBase64) || isBlank(storedSalt)) return false;
  const saltBytes = Utilities.newBlob(storedSalt).getBytes();
  const derived = pbkdf2Sha256_(plainPassword, saltBytes, PBKDF2_ITERATIONS_, PBKDF2_KEY_LENGTH_BYTES_);
  const computedHashBase64 = Utilities.base64Encode(derived);
  return timingSafeEqual_(computedHashBase64, storedHashBase64);
}

// So sánh không rò rỉ thời gian qua số ký tự khớp đầu tiên (giảm bề mặt tấn công timing, dù rủi ro
// thực tế với độ trễ mạng của Apps Script vốn đã nhỏ — làm đúng ngay từ đầu, không phải sau).
function timingSafeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isValidPassword_(plainPassword) {
  return typeof plainPassword === 'string' && plainPassword.length >= 8;
}
