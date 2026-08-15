// Token đăng nhập cho Gateway (RPC-over-POST) — dùng bởi Desktop App và bất kỳ client nào không có
// phiên Google (Session.getActiveUser()) sẵn có. KHÔNG dùng cho GAS Web App hiện tại — trình duyệt
// vẫn dùng google.script.run + Session-based getCurrentUser() như cũ (đường nội bộ, nhanh hơn, không
// cần đổi gì) — xem báo cáo thẩm định kiến trúc mục "Kiến trúc sau review". Cả 2 đường đều chốt lại
// cùng 1 bản ghi Users/Employees, không phải 2 hệ thống tài khoản độc lập.
//
// Token = base64url(payload JSON) + "." + base64url(HMAC-SHA256 chữ ký) — tự dựng theo tinh thần JWT,
// không tuyên bố tuân thủ chuẩn JWT đầy đủ (không cần header/alg thương lượng vì chỉ có đúng 1 thuật
// toán). Stateless: xác thực chỉ cần tính lại chữ ký, KHÔNG cần đọc Sheet mỗi request — quan trọng để
// tránh nhân quota đọc Sheets theo từng lệnh gọi (xem báo cáo, mục quota).
//
// Hạn dùng cố định 6 giờ = đúng bằng TTL tối đa của CacheService (21600s) — để danh sách thu hồi
// (revoke) có thể phủ trọn vòng đời token bằng CacheService, không cần 1 sheet riêng để lưu token đã
// thu hồi (tránh thêm 1 đường ghi/đọc Sheet nữa).
const ACCESS_TOKEN_TTL_MS_ = 6 * 60 * 60 * 1000;

function base64UrlEncode_(str) {
  const bytes = Utilities.newBlob(str).getBytes();
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function base64UrlDecode_(b64url) {
  let padded = b64url;
  while (padded.length % 4 !== 0) padded += '=';
  const bytes = Utilities.base64DecodeWebSafe(padded);
  return Utilities.newBlob(bytes).getDataAsString();
}

// Sinh 1 lần khi Initialize System (Bootstrap.InitializeSystem.gs); tự sinh bù nếu vì lý do nào đó
// thiếu (hệ thống cũ nâng cấp lên) — KHÔNG tự sinh lại nếu đã tồn tại, vì sinh lại sẽ âm thầm vô hiệu
// hoá mọi token đang phát hành.
function getTokenSigningSecret_() {
  let secret = getConfig(CONFIG_KEYS.TOKEN_SIGNING_SECRET);
  if (isBlank(secret)) {
    secret = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
    setConfig(CONFIG_KEYS.TOKEN_SIGNING_SECRET, secret);
  }
  return secret;
}

function signHmac_(value) {
  const sigBytes = Utilities.computeHmacSha256Signature(value, getTokenSigningSecret_());
  return Utilities.base64EncodeWebSafe(sigBytes).replace(/=+$/, '');
}

function issueAccessToken_(user) {
  const payload = { uid: user.UserID, exp: Date.now() + ACCESS_TOKEN_TTL_MS_ };
  const payloadB64 = base64UrlEncode_(JSON.stringify(payload));
  const signature = signHmac_(payloadB64);
  return payloadB64 + '.' + signature;
}

// Bản ghi Users theo UserID, cache TTL ngắn — findById() (Storage.SheetRepository.gs) đọc TOÀN BỘ
// sheet Users mỗi lần gọi, và verifyAccessToken_ chạy lại trên MỌI api_* request. Phát hiện qua đo
// thực tế: ngay sau đăng nhập, client bắn ~9 lệnh google.script.run gần như đồng thời (loadAppData_ +
// loadSwapPageData), mỗi lệnh tự verify token riêng — tức 9 lần đọc toàn bộ sheet Users chỉ để lấy
// đúng 1 người dùng, cộng dồn thành độ trễ rõ rệt lúc chuyển từ màn đăng nhập sang giao diện làm việc.
// TTL 20s là đánh đổi có chủ đích: đủ ngắn để thay đổi Role/Status của Admin có hiệu lực gần như ngay
// (chậm nhất 20s), đủ dài để dọn sạch "bão" request đồng thời lúc tải trang. Cùng tinh thần chấp nhận
// độ trễ nhỏ như cơ chế thu hồi token qua CacheService đã dùng.
const USER_LOOKUP_CACHE_TTL_SECONDS_ = 20;

// Gọi ngay sau khi đổi Role/Status của 1 User (Auth.Roles.gs#assignRole, deactivateEmployee,
// Admin.UserManagement.gs#updateUserRole) — để thay đổi có hiệu lực NGAY thay vì chờ hết TTL cache.
function invalidateUserLookupCache_(userId) {
  CacheService.getScriptCache().remove('user_lookup_' + userId);
}

function getUserByIdCached_(userId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'user_lookup_' + userId;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const user = getSheetRepository(SHEETS.USERS).findById('UserID', userId);
  if (user) cache.put(cacheKey, JSON.stringify(user), USER_LOOKUP_CACHE_TTL_SECONDS_);
  return user;
}

// Trả về bản ghi Users tương ứng nếu token hợp lệ, còn hạn, chưa bị thu hồi — throw Error (thông điệp
// tiếng Việt) nếu không, đúng quy ước lỗi chung của toàn hệ thống.
function verifyAccessToken_(token) {
  if (isBlank(token)) throw new Error('Thiếu token xác thực.');
  const parts = String(token).split('.');
  if (parts.length !== 2) throw new Error('Token không hợp lệ.');

  const payloadB64 = parts[0];
  const signature = parts[1];
  const expectedSignature = signHmac_(payloadB64);
  if (!timingSafeEqual_(signature, expectedSignature)) throw new Error('Token không hợp lệ.');

  if (isTokenRevoked_(token)) throw new Error('Token đã bị thu hồi, vui lòng đăng nhập lại.');

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode_(payloadB64));
  } catch (e) {
    throw new Error('Token không hợp lệ.');
  }
  if (!payload.exp || Date.now() > payload.exp) throw new Error('Token đã hết hạn, vui lòng đăng nhập lại.');

  const user = getUserByIdCached_(payload.uid);
  if (!user || user.Status !== 'Active') throw new Error('Tài khoản không còn hoạt động.');
  return user;
}

// Khoá cache = chữ ký token (đủ ngắn, đủ duy nhất) — không lưu cả token gốc vào cache key để tránh
// vượt giới hạn độ dài key của CacheService một cách không cần thiết.
function tokenCacheKey_(token) {
  return 'revoked_token_' + token.split('.')[1];
}

function isTokenRevoked_(token) {
  return CacheService.getScriptCache().get(tokenCacheKey_(token)) === '1';
}

// Thu hồi = đưa vào CacheService với TTL đúng bằng thời gian còn lại của token — token hết hạn tự
// nhiên thì entry cache cũng tự hết theo, không cần dọn dẹp thủ công.
function revokeToken_(token) {
  const parts = String(token).split('.');
  if (parts.length !== 2) return;
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode_(parts[0]));
  } catch (e) {
    return;
  }
  const remainingSeconds = Math.max(1, Math.ceil((payload.exp - Date.now()) / 1000));
  const cappedSeconds = Math.min(remainingSeconds, 21600); // trần TTL của CacheService
  CacheService.getScriptCache().put(tokenCacheKey_(token), '1', cappedSeconds);
}
