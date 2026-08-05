// Hàm chẩn đoán chỉ dùng nội bộ khi phát triển (gọi qua `clasp run`, không expose qua Core.Api.gs
// cho client) — đọc dữ liệu thô để kiểm tra nhanh, không có tác dụng phụ.
function diagListRules() {
  return getSheetRepository(SHEETS.RULES).findAll();
}

function diagListLibraries() {
  return getSheetRepository(SHEETS.LIBRARIES).findAll();
}

function diagListDocuments() {
  return getSheetRepository(SHEETS.DOCUMENTS).findAll();
}

function diagListTemplates() {
  return getSheetRepository(SHEETS.TEMPLATES).findAll();
}

function diagListUsers() {
  return getSheetRepository(SHEETS.USERS).findAll();
}

function diagFileInfo(fileId) {
  const file = DriveApp.getFileById(fileId);
  return { name: file.getName(), size: file.getSize(), mimeType: file.getMimeType() };
}

function diagMailQuota() {
  return MailApp.getRemainingDailyQuota();
}
