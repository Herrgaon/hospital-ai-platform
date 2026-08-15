// Xác định danh tính người dùng hiện tại.
//
// 2026-08-15: hệ thống chuyển sang đăng nhập mã nhân viên + mật khẩu (Auth.Gateway.gs) cho MỌI client
// (trình duyệt lẫn Desktop App sau này) — Web App deploy ở chế độ executeAs=USER_DEPLOYING,
// access=ANYONE_ANONYMOUS (xem appsscript.json), nghĩa là Session.getActiveUser() trong lúc phục vụ
// google.script.run/doGet/doPost luôn trả về danh tính người TRIỂN KHAI script, KHÔNG PHẢI người
// đang thao tác — không còn dùng được để xác định "ai đang gọi API" nữa. getCurrentUser() (dưới đây)
// vì vậy CHỈ còn dùng trong đúng 1 chỗ: Bootstrap.InitializeSystem.gs, để xác định ai bấm "Initialize
// System" lần đầu (hành động thiết lập 1 lần, hợp lý khi vẫn gắn với danh tính script). Mọi lời gọi
// API nghiệp vụ khác PHẢI qua getCurrentUserFromToken_(token) — xem Core.Api.gs.
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

function getCurrentUser() {
  const email = getCurrentUserEmail();
  const emailLower = email.toLowerCase();
  const users = getSheetRepository(SHEETS.USERS);
  // So khớp không phân biệt hoa/thường — Admin có thể đã tạo trước tài khoản (createUser) với email
  // gõ tay không đúng hệt cách Google trả về, không nên tạo trùng thêm 1 bản ghi Guest mới vì lệch hoa/thường.
  let user = users.findAll().filter(function (u) { return u.Email.toLowerCase() === emailLower; })[0];
  if (!user) {
    user = users.append({
      UserID: generateId('USR'),
      Email: email,
      FullName: email,
      Role: ROLE_NAMES.GUEST,
      Department: '',
      Status: 'Active',
      CreatedAt: nowIso(),
      UpdatedAt: nowIso(),
      AvatarUrl: '',
      PasswordHash: '',
      PasswordSalt: ''
    });
    logAudit(user.UserID, 'USER_AUTO_CREATED', 'User', user.UserID, 'Đăng nhập lần đầu, gán mặc định Role=Guest');
  }
  return user;
}

// Đường xác thực chính cho MỌI lệnh gọi API nghiệp vụ (Core.Api.gs, Core.HttpApi.gs) — thay thế hoàn
// toàn getCurrentUser() cho mục đích này. Dùng chung 1 cơ chế token cho cả trình duyệt lẫn Desktop App
// — đúng "không tạo hai hệ thống tài khoản độc lập" (xem báo cáo thẩm định kiến trúc).
function getCurrentUserFromToken_(token) {
  return verifyAccessToken_(token);
}

// Tự sửa hồ sơ của CHÍNH MÌNH (nickname hiển thị) — khác Admin.UserManagement.gs#updateUserProfile
// (Admin sửa hồ sơ người khác) và Auth.Roles.gs#assignRole (chỉ Admin đổi Role hệ thống).
function updateMyProfile(user, fullName) {
  const updated = getSheetRepository(SHEETS.USERS).updateById('UserID', user.UserID, {
    FullName: fullName,
    UpdatedAt: nowIso()
  });
  logAudit(user.UserID, 'USER_PROFILE_CHANGED', 'User', user.UserID, fullName);
  return updated;
}

// Ảnh đại diện tuỳ chọn — lưu trong /System/Avatars, chia sẻ ở mức "bất kỳ ai trong domain có link"
// (đúng mô hình domain-restricted đã áp cho toàn bộ Web App — không public ra ngoài Internet) để
// đồng nghiệp khác xem được avatar của nhau trong danh sách người dùng.
function updateMyAvatar(user, base64Data, mimeType) {
  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, user.UserID + '_avatar');
  const folder = getAvatarsFolder();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);

  const avatarUrl = 'https://lh3.googleusercontent.com/d/' + file.getId();
  const updated = getSheetRepository(SHEETS.USERS).updateById('UserID', user.UserID, {
    AvatarUrl: avatarUrl,
    UpdatedAt: nowIso()
  });
  logAudit(user.UserID, 'USER_AVATAR_CHANGED', 'User', user.UserID, file.getId());
  return updated;
}
