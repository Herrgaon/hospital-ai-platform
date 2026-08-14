// Tra cứu Audit Log — xem docs/13-security.md mục 5.
// Xem Audit Log toàn hệ thống: chỉ SUPER_ADMIN. Log theo phạm vi riêng cho từng khoa/phòng là cải
// tiến tương lai, chưa xây ở Giai đoạn 1 (YAGNI).

function searchAuditLog(actingUser, filters) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được xem Audit Log.');
  }
  let logs = getSheetRepository(SHEETS.AUDIT_LOG).findAll();

  if (filters && filters.userId) {
    logs = logs.filter(function (l) { return l.UserID === filters.userId; });
  }
  if (filters && filters.action) {
    logs = logs.filter(function (l) { return l.Action === filters.action; });
  }
  if (filters && filters.fromDate) {
    logs = logs.filter(function (l) { return l.Timestamp >= filters.fromDate; });
  }
  if (filters && filters.toDate) {
    logs = logs.filter(function (l) { return l.Timestamp <= filters.toDate; });
  }
  return logs;
}

// Xuất Audit Log ra Excel — đúng mục 25 PROJECT_CONSTITUTION ("Log phải ... Xuất Excel được").
function exportAuditLogToExcel(actingUser, filters) {
  const logs = searchAuditLog(actingUser, filters);

  const tempSpreadsheet = SpreadsheetApp.create('AuditLog_Export_' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmmss'));
  const sheet = tempSpreadsheet.getSheets()[0];
  const headers = SCHEMA[SHEETS.AUDIT_LOG];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (logs.length > 0) {
    const rows = logs.map(function (log) { return headers.map(function (h) { return log[h]; }); });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  const tempFile = DriveApp.getFileById(tempSpreadsheet.getId());
  const excelBlob = tempFile.getAs(MimeType.MICROSOFT_EXCEL);

  const systemFolder = getOrCreateSubfolder(getRootFolder_(), DRIVE_FOLDERS.SYSTEM);
  const logsFolder = getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_LOGS);
  const excelFile = logsFolder.createFile(excelBlob);
  tempFile.setTrashed(true);

  logAudit(actingUser.UserID, 'AUDIT_LOG_EXPORTED', 'AuditLog', excelFile.getId(), logs.length + ' dòng');
  return { fileId: excelFile.getId(), url: excelFile.getUrl() };
}
