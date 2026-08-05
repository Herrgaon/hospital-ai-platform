// Ghi AuditLog — xem docs/13-security.md mục 5 cho danh sách hành động bắt buộc ghi log.

function logAudit(userId, action, targetType, targetId, detail) {
  const repo = getSheetRepository(SHEETS.AUDIT_LOG);
  repo.append({
    LogID: generateId('LOG'),
    Timestamp: nowIso(),
    UserID: userId,
    Action: action,
    TargetType: targetType,
    TargetID: targetId,
    Detail: detail || ''
  });
}
