// Đăng nhập bằng mã nhân viên + mật khẩu — lối vào danh tính cho Gateway (Core.HttpApi.gs), dùng bởi
// Desktop App/client bên ngoài. Không phải hệ thống tài khoản thứ 2: tra cứu và xác thực trên đúng
// Users/Employees sheet mà GAS Web App (qua Session.getActiveUser()) đang dùng.

const LOGIN_MAX_ATTEMPTS_ = 5;
const LOGIN_LOCKOUT_SECONDS_ = 15 * 60;

function loginRateLimitKey_(employeeCode) {
  return 'login_fail_' + employeeCode;
}

// Không có địa chỉ IP thật của người gọi trong doPost/doGet (giới hạn nền tảng Apps Script) — chỉ
// chống brute-force được theo mã nhân viên, không theo IP. Xem báo cáo thẩm định kiến trúc.
function checkLoginRateLimit_(employeeCode) {
  const cache = CacheService.getScriptCache();
  const attempts = Number(cache.get(loginRateLimitKey_(employeeCode)) || 0);
  if (attempts >= LOGIN_MAX_ATTEMPTS_) {
    throw new Error('Tài khoản tạm khoá do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.');
  }
}

function recordFailedLogin_(employeeCode) {
  const cache = CacheService.getScriptCache();
  const key = loginRateLimitKey_(employeeCode);
  const attempts = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(attempts), LOGIN_LOCKOUT_SECONDS_);
}

function clearFailedLogin_(employeeCode) {
  CacheService.getScriptCache().remove(loginRateLimitKey_(employeeCode));
}

function authenticateWithPassword(employeeCode, password) {
  if (isBlank(employeeCode) || isBlank(password)) {
    throw new Error('Vui lòng nhập mã nhân viên và mật khẩu.');
  }
  checkLoginRateLimit_(employeeCode);

  const employee = getSheetRepository(SHEETS.EMPLOYEES).findAll().find(function (e) { return e.EmployeeCode === employeeCode; });
  const user = employee ? getSheetRepository(SHEETS.USERS).findById('UserID', employee.UserID) : null;

  // Cùng 1 thông báo lỗi dù sai mã NV hay sai mật khẩu — không tiết lộ mã nhân viên nào tồn tại.
  const genericError = 'Mã nhân viên hoặc mật khẩu không đúng.';
  if (!user || user.Status !== 'Active' || isBlank(user.PasswordHash)) {
    recordFailedLogin_(employeeCode);
    throw new Error(genericError);
  }

  const valid = verifyPassword_(password, user.PasswordHash, user.PasswordSalt);
  if (!valid) {
    recordFailedLogin_(employeeCode);
    throw new Error(genericError);
  }

  clearFailedLogin_(employeeCode);
  const token = issueAccessToken_(user);
  logAudit(user.UserID, 'USER_LOGIN', 'User', user.UserID, 'Đăng nhập qua Gateway (mã NV: ' + employeeCode + ')');
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
