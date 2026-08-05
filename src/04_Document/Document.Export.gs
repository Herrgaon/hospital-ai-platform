// Xuất Word/PDF — xem docs/02-srs.md FR-DOC-06.

// Phát hiện qua clasp run (2026-08-05): File.getAs(MICROSOFT_WORD) ném lỗi "conversion...
// is not supported" trên hệ thống thật dù getAs(PDF) trên CÙNG tài liệu chạy bình thường —
// đây là giới hạn đã biết của Apps Script với việc convert Google Docs -> DOCX qua getAs() ở một số
// ngữ cảnh thực thi. Dùng Advanced Drive Service (exportLinks) làm phương án dự phòng, đáng tin cậy
// hơn vì gọi thẳng Drive API thay vì lớp getAs() rút gọn.
function exportDocumentAsWord(driveFileId) {
  try {
    const doc = DriveApp.getFileById(driveFileId);
    return doc.getAs(MimeType.MICROSOFT_WORD);
  } catch (e) {
    return exportDocumentAsWordViaDriveApi_(driveFileId);
  }
}

function exportDocumentAsWordViaDriveApi_(driveFileId) {
  const fileResource = Drive.Files.get(driveFileId);
  const wordMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const exportUrl = fileResource.exportLinks && fileResource.exportLinks[wordMimeType];
  if (!exportUrl) {
    throw new Error('Không thể xuất Word cho tài liệu này (Drive không cung cấp exportLinks phù hợp).');
  }

  const response = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Xuất Word thất bại (Drive API trả về HTTP ' + response.getResponseCode() + ').');
  }
  return response.getBlob().setContentType(wordMimeType);
}

function exportDocumentAsPdf(driveFileId) {
  const doc = DriveApp.getFileById(driveFileId);
  return doc.getAs(MimeType.PDF);
}

// Xuất bản chính thức: lưu file Word vào thư mục Library, ghi nhật ký — dùng chung cho
// api_exportDocumentAsWord (người dùng tự bấm xuất) và bước EXPORT tự động sau khi duyệt
// trong Workflow.Approval.gs (docs/07-workflow.md mục 2).
function publishDocumentAsWord(user, documentId) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanView');

  const blob = exportDocumentAsWord(document.DriveFileID);
  const library = getSheetRepository(SHEETS.LIBRARIES).findById('LibraryID', document.LibraryID);
  const folder = DriveApp.getFolderById(library.DriveFolderID);
  const file = folder.createFile(blob).setName(document.Title + '.docx');

  logAudit(user.UserID, 'DOCUMENT_EXPORTED', 'Document', documentId, file.getId());
  return { fileId: file.getId(), url: file.getUrl() };
}
