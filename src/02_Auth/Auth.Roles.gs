function getAllRoles() {
  return getSheetRepository(SHEETS.ROLES).findAll();
}

// Chỉ SUPER_ADMIN được đổi vai trò người dùng.
function assignRole(actingUser, targetUserId, newRole) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được đổi vai trò người dùng.');
  }
  const updated = getSheetRepository(SHEETS.USERS).updateById('UserID', targetUserId, {
    Role: newRole,
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'ROLE_CHANGED', 'User', targetUserId, 'Role mới: ' + newRole);
  return updated;
}
