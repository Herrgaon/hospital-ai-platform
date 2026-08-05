// Xuất Word/PDF — xem docs/02-srs.md FR-DOC-06.

function exportDocumentAsWord(driveFileId) {
  const doc = DriveApp.getFileById(driveFileId);
  return doc.getAs(MimeType.MICROSOFT_WORD);
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
