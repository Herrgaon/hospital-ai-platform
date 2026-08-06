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
  return { name: file.getName(), size: file.getSize(), mimeType: file.getMimeType(), isTrashed: file.isTrashed() };
}

function diagMailQuota() {
  return MailApp.getRemainingDailyQuota();
}

function diagListInboxFiles() {
  const files = getUploadsInboxFolder().getFiles();
  const out = [];
  while (files.hasNext()) {
    const f = files.next();
    out.push({ name: f.getName(), isTrashed: f.isTrashed() });
  }
  return out;
}

// Apps Script Execution API từ chối gọi trực tiếp hàm có tên kết thúc bằng "_" (coi là hàm nội bộ,
// giống cách IDE ẩn chúng khỏi menu Run) — báo lỗi "Unable to run script function..." dù hàm tồn tại
// và không liên quan gì đến quyền thật. Bọc qua hàm không có "_" để clasp run kiểm thử được.
function diagTransformCase(text, mode) {
  return transformVietnameseCase_(text, mode);
}

function diagGetFileContent(driveFileId) {
  return DriveApp.getFileById(driveFileId).getBlob().getDataAsString();
}

function diagSetFileContent(driveFileId, content) {
  DriveApp.getFileById(driveFileId).setContent(content);
  return { done: true };
}

// Test createDefaultTemplateDoc_ độc lập, KHÔNG chạy lại initializeSystem() (không an toàn để chạy
// lại trên hệ thống thật đã khởi tạo). Tạo 1 thư mục tạm trong Uploads/_Inbox, gọi hàm, trả về
// driveFileId để soi bằng diagListAllParagraphTexts, rồi tự dọn (xoá thư mục tạm, giữ lại file để soi).
function diagTestCreateDefaultTemplateDoc() {
  const tempFolder = getUploadsInboxFolder();
  const file = createDefaultTemplateDoc_(tempFolder);
  return { driveFileId: file.getId(), name: file.getName() };
}

function diagListAllParagraphTexts(driveFileId) {
  const body = DocumentApp.openById(driveFileId).getBody();
  return body.getParagraphs().map(function (p) {
    const t = p.editAsText();
    return { text: p.getText(), bold: t.getText().length > 0 ? t.isBold(0) : null, alignment: String(p.getAlignment()) };
  });
}

function diagRunStructureCheck(driveFileId) {
  const doc = DocumentApp.openById(driveFileId);
  const body = doc.getBody();
  const paragraphs = body.getParagraphs();
  return {
    docNumber: extractDocNumber_(paragraphs),
    structureBlocks: extractStructureBlocks_(paragraphs),
    fonts: extractFonts_(paragraphs),
    bodyFontSize: extractBodyFontSize_(paragraphs)
  };
}

function diagInspectFormattingDetails(driveFileId) {
  const doc = DocumentApp.openById(driveFileId);
  const body = doc.getBody();
  const paragraph = body.getParagraphs().find(function (p) { return p.getText().length > 0; });
  const text = paragraph ? paragraph.editAsText() : null;
  return {
    fontFamily: text ? text.getFontFamily(0) : null,
    fontSize: text ? text.getFontSize(0) : null,
    bold: text ? text.isBold(0) : null,
    alignment: paragraph ? String(paragraph.getAlignment()) : null,
    lineSpacing: paragraph ? paragraph.getLineSpacing() : null,
    margins: {
      top: pointsToMm(body.getMarginTop()),
      bottom: pointsToMm(body.getMarginBottom()),
      left: pointsToMm(body.getMarginLeft()),
      right: pointsToMm(body.getMarginRight())
    }
  };
}
