// Xác định danh tính người dùng hiện tại — xem docs/13-security.md mục 1.

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
      AvatarUrl: ''
    });
    logAudit(user.UserID, 'USER_AUTO_CREATED', 'User', user.UserID, 'Đăng nhập lần đầu, gán mặc định Role=Guest');
  }
  return user;
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
