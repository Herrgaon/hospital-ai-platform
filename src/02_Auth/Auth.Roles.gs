function getAllRoles() {
  return getSheetRepository(SHEETS.ROLES).findAll();
}

// Đúng ma trận tại docs/11-permission-design.md mục 3 ("Phân quyền người dùng": chỉ Admin).
function assignRole(actingUser, targetUserId, newRole) {
  if (actingUser.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được đổi vai trò người dùng.');
  }
  const updated = getSheetRepository(SHEETS.USERS).updateById('UserID', targetUserId, {
    Role: newRole,
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ROLE_CHANGED', 'User', targetUserId, 'Role mới: ' + newRole);
  return updated;
}
