// Xác định danh tính người dùng hiện tại — xem docs/13-security.md mục 1.

function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

function getCurrentUser() {
  const email = getCurrentUserEmail();
  const users = getSheetRepository(SHEETS.USERS);
  let user = users.findAll().filter(function (u) { return u.Email === email; })[0];
  if (!user) {
    user = users.append({
      UserID: generateId('USR'),
      Email: email,
      FullName: email,
      Role: ROLE_NAMES.GUEST,
      Department: '',
      Status: 'Active',
      CreatedAt: nowIso(),
      UpdatedAt: nowIso()
    });
    logAudit(user.UserID, 'USER_AUTO_CREATED', 'User', user.UserID, 'Đăng nhập lần đầu, gán mặc định Role=Guest');
  }
  return user;
}
