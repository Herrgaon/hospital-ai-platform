// Đăng nhập bằng tên đăng nhập + mật khẩu — lối vào danh tính cho Gateway (Core.HttpApi.gs), dùng bởi
// trình duyệt lẫn Desktop App/client bên ngoài (từ 2026-08-15, GAS Web App cũng dùng đường này thay
// Session Google — xem Auth.Session.gs). Username tách riêng khỏi Employees.EmployeeCode (mã nhân
// viên chỉ phục vụ nghiệp vụ/HR, đổi được mà không ảnh hưởng đăng nhập) — quyết định Product Owner
// 2026-08-15. Không phải hệ thống tài khoản thứ 2: tra cứu/xác thực trực tiếp trên Users sheet.

const LOGIN_MAX_ATTEMPTS_ = 5;
const LOGIN_LOCKOUT_SECONDS_ = 15 * 60;

function loginRateLimitKey_(username) {
  return 'login_fail_' + username;
}

// Không có địa chỉ IP thật của người gọi trong doPost/doGet (giới hạn nền tảng Apps Script) — chỉ
// chống brute-force được theo username, không theo IP. Xem báo cáo thẩm định kiến trúc.
function checkLoginRateLimit_(username) {
  const cache = CacheService.getScriptCache();
  const attempts = Number(cache.get(loginRateLimitKey_(username)) || 0);
  if (attempts >= LOGIN_MAX_ATTEMPTS_) {
    throw new Error('Tài khoản tạm khoá do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.');
  }
}

function recordFailedLogin_(username) {
  const cache = CacheService.getScriptCache();
  const key = loginRateLimitKey_(username);
  const attempts = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(attempts), LOGIN_LOCKOUT_SECONDS_);
}

function clearFailedLogin_(username) {
  CacheService.getScriptCache().remove(loginRateLimitKey_(username));
}

function authenticateWithPassword(username, password) {
  if (isBlank(username) || isBlank(password)) {
    throw new Error('Vui lòng nhập tên đăng nhập và mật khẩu.');
  }
  checkLoginRateLimit_(username);

  const user = getSheetRepository(SHEETS.USERS).findAll().find(function (u) { return u.Username === username; });

  // Cùng 1 thông báo lỗi dù sai tên đăng nhập hay sai mật khẩu — không tiết lộ tên đăng nhập nào tồn tại.
  const genericError = 'Tên đăng nhập hoặc mật khẩu không đúng.';
  if (!user || user.Status !== 'Active' || isBlank(user.PasswordHash)) {
    recordFailedLogin_(username);
    throw new Error(genericError);
  }

  const valid = verifyPassword_(password, user.PasswordHash, user.PasswordSalt);
  if (!valid) {
    recordFailedLogin_(username);
    throw new Error(genericError);
  }

  clearFailedLogin_(username);
  const token = issueAccessToken_(user);
  logAudit(user.UserID, 'USER_LOGIN', 'User', user.UserID, 'Đăng nhập qua Gateway (tên đăng nhập: ' + username + ')');
  return {
    token: token,
    user: { UserID: user.UserID, Email: user.Email, FullName: user.FullName, Role: user.Role, AvatarUrl: user.AvatarUrl }
  };
}

function logoutWithToken(token) {
  const user = verifyAccessToken_(token);
  revokeToken_(token);
  logAudit(user.UserID, 'USER_LOGOUT', 'User', user.UserID, 'Đăng xuất qua Gateway');
  return { success: true };
}
