// Trang "Chỉnh sửa định dạng" — luồng ĐỘC LẬP với việc tạo văn bản theo mẫu (DocumentEditor.html):
// người dùng tải lên 1 file CÓ SẴN (chưa chuẩn định dạng) — hoặc dán thẳng văn bản — hệ thống lưu tạm
// thành 1 Google Doc để chỉnh, rồi trả lại file đã xử lý — KHÔNG tạo dòng Documents/gán vào Library
// nào, không đi qua vòng đời duyệt/kiểm tra thể thức. File tạm nằm trong Uploads/_Inbox (dùng lại
// đúng thư mục Knowledge Ingest đã dùng, không tạo thư mục mới) và do người dùng tự quyết định giữ
// hay xoá (nút "Huỷ").
//
// Không cần kiểm tra quyền theo Library (không có Library nào ở đây) — Web App chạy
// executeAs: USER_ACCESSING nên mọi thao tác Drive tự chạy dưới danh nghĩa người dùng thật, Drive ACL
// đã tự chặn người khác đụng vào driveFileId không phải của họ, giống cách AI Chat đính kèm file
// (Knowledge.Search.gs#askAboutAttachedFile) đang làm.

function createInboxDocFromText_(title, text) {
  const doc = DocumentApp.create(title);
  doc.getBody().setText(text);
  doc.saveAndClose();
  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(getUploadsInboxFolder());
  return file;
}

// ocrUsed: true khi phải nhận dạng ký tự (PDF/ảnh scan) — CHỈ trích được văn bản, không giữ được bố
// cục/ảnh minh hoạ gốc, và có thể sai sót vài ký tự tuỳ chất lượng bản scan. Chấp nhận được vì mục
// đích của trang này là ĐỊNH DẠNG LẠI TOÀN BỘ theo chuẩn, không phải giữ nguyên bố cục cũ — nhưng
// phải báo rõ cho người dùng để họ tự kiểm tra lại nội dung trước khi dùng (client hiển thị cảnh báo).
function stageDocumentForFormatting(user, fileName, mimeType, base64Data) {
  const parserCategory = detectParserCategory_(mimeType);
  if (parserCategory === 'OTHER') {
    throw new Error('Định dạng file này chưa hỗ trợ — chỉ hỗ trợ Google Docs, Word (.docx/.doc), PDF, ảnh scan và văn bản thuần (.txt).');
  }

  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const inbox = getUploadsInboxFolder();

  let stagedFile;
  let ocrUsed = false;
  if (parserCategory === 'WORD') {
    const resource = { title: fileName, mimeType: MimeType.GOOGLE_DOCS, parents: [{ id: inbox.getId() }] };
    const converted = Drive.Files.insert(resource, blob, { convert: true });
    stagedFile = DriveApp.getFileById(converted.id);
  } else if (parserCategory === 'PDF' || parserCategory === 'IMAGE') {
    const resource = { title: fileName, mimeType: MimeType.GOOGLE_DOCS, parents: [{ id: inbox.getId() }] };
    const ocrFile = Drive.Files.insert(resource, blob, { ocr: true, ocrLanguage: 'vi' });
    stagedFile = DriveApp.getFileById(ocrFile.id);
    ocrUsed = true;
  } else if (parserCategory === 'TEXT') {
    stagedFile = createInboxDocFromText_(fileName.replace(/\.[^.]+$/, ''), blob.getDataAsString());
  } else {
    stagedFile = inbox.createFile(blob);
  }

  logAudit(user.UserID, 'FORMATTING_FILE_STAGED', 'File', stagedFile.getId(), fileName);
  return { driveFileId: stagedFile.getId(), fileName: stagedFile.getName(), ocrUsed: ocrUsed };
}

// Dán văn bản trực tiếp (không qua file) — cùng đích đến (Uploads/_Inbox) như luồng tải file lên.
function stagePastedTextForFormatting(user, text, title) {
  if (isBlank(text)) {
    throw new Error('Chưa có nội dung văn bản để dán.');
  }
  const docTitle = isBlank(title) ? 'Văn bản dán trực tiếp' : title;
  const stagedFile = createInboxDocFromText_(docTitle, text);
  logAudit(user.UserID, 'FORMATTING_FILE_STAGED', 'File', stagedFile.getId(), docTitle);
  return { driveFileId: stagedFile.getId(), fileName: stagedFile.getName(), ocrUsed: false };
}

function discardStagedFormattingFile(user, driveFileId) {
  DriveApp.getFileById(driveFileId).setTrashed(true);
  logAudit(user.UserID, 'FORMATTING_FILE_DISCARDED', 'File', driveFileId, '');
  return { success: true };
}

// Trả trực tiếp nội dung file .docx/.pdf dạng base64 cho client tự tạo link tải xuống — KHÔNG lưu bản
// xuất vào Drive lâu dài (khác publishDocumentAsWord ở Document.Export.gs, vốn lưu vào thư mục
// Library vì đó là bước "xuất bản chính thức"). Dùng lại đúng exportDocumentAsWord/exportDocumentAsPdf
// đã có ở Document.Export.gs, không viết lại.
//
// LƯU Ý: Google Docs KHÔNG hỗ trợ xuất sang định dạng .doc nhị phân cũ (chỉ .docx/OOXML) — không có
// API nào của Google làm được việc này, kể cả Advanced Drive Service. "docx" và "PDF" là 2 lựa chọn
// đầu ra thực tế có thể cung cấp.
function exportFormattingResultAsWord(driveFileId, fileName) {
  const blob = exportDocumentAsWord(driveFileId);
  return {
    fileName: (fileName || 'van-ban') + '.docx',
    mimeType: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes())
  };
}

function exportFormattingResultAsPdf(driveFileId, fileName) {
  const blob = exportDocumentAsPdf(driveFileId);
  return {
    fileName: (fileName || 'van-ban') + '.pdf',
    mimeType: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes())
  };
}
