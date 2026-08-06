// Trang "Chỉnh sửa định dạng" — luồng ĐỘC LẬP với việc tạo văn bản theo mẫu (DocumentEditor.html):
// người dùng tải lên 1 file CÓ SẴN (chưa chuẩn định dạng), hệ thống lưu tạm thành 1 Google Doc để
// chỉnh, rồi trả lại file đã xử lý — KHÔNG tạo dòng Documents/gán vào Library nào, không đi qua vòng
// đời duyệt/kiểm tra thể thức. File tạm nằm trong Uploads/_Inbox (dùng lại đúng thư mục Knowledge
// Ingest đã dùng, không tạo thư mục mới) và do người dùng tự quyết định giữ hay xoá (nút "Huỷ").
//
// Không cần kiểm tra quyền theo Library (không có Library nào ở đây) — Web App chạy
// executeAs: USER_ACCESSING nên mọi thao tác Drive tự chạy dưới danh nghĩa người dùng thật, Drive ACL
// đã tự chặn người khác đụng vào driveFileId không phải của họ, giống cách AI Chat đính kèm file
// (Knowledge.Search.gs#askAboutAttachedFile) đang làm.

function stageDocumentForFormatting(user, fileName, mimeType, base64Data) {
  const parserCategory = detectParserCategory_(mimeType);
  if (parserCategory === 'PDF' || parserCategory === 'IMAGE' || parserCategory === 'OTHER') {
    throw new Error('Định dạng file này chưa hỗ trợ chỉnh định dạng trực tiếp — chỉ hỗ trợ Google Docs, Word (.docx/.doc) và văn bản thuần (.txt).');
  }

  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const inbox = getUploadsInboxFolder();

  let stagedFile;
  if (parserCategory === 'WORD') {
    const resource = { title: fileName, mimeType: MimeType.GOOGLE_DOCS, parents: [{ id: inbox.getId() }] };
    const converted = Drive.Files.insert(resource, blob, { convert: true });
    stagedFile = DriveApp.getFileById(converted.id);
  } else if (parserCategory === 'TEXT') {
    const doc = DocumentApp.create(fileName.replace(/\.[^.]+$/, ''));
    doc.getBody().setText(blob.getDataAsString());
    doc.saveAndClose();
    stagedFile = DriveApp.getFileById(doc.getId());
    stagedFile.moveTo(inbox);
  } else {
    stagedFile = inbox.createFile(blob);
  }

  logAudit(user.UserID, 'FORMATTING_FILE_STAGED', 'File', stagedFile.getId(), fileName);
  return { driveFileId: stagedFile.getId(), fileName: stagedFile.getName() };
}

function discardStagedFormattingFile(user, driveFileId) {
  DriveApp.getFileById(driveFileId).setTrashed(true);
  logAudit(user.UserID, 'FORMATTING_FILE_DISCARDED', 'File', driveFileId, '');
  return { success: true };
}

// Trả trực tiếp nội dung file .docx dạng base64 cho client tự tạo link tải xuống — KHÔNG lưu bản xuất
// vào Drive lâu dài (khác publishDocumentAsWord ở Document.Export.gs, vốn lưu vào thư mục Library vì
// đó là bước "xuất bản chính thức"). Dùng lại đúng exportDocumentAsWord() đã có, không viết lại.
function exportFormattingResultAsWord(driveFileId, fileName) {
  const blob = exportDocumentAsWord(driveFileId);
  return {
    fileName: (fileName || 'van-ban') + '.docx',
    mimeType: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes())
  };
}
