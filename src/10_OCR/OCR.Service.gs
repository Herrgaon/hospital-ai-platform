// OCR — tính năng bổ sung, không cốt lõi. Xem docs/10-knowledge-design.md mục 6.
// Ưu tiên 1: Google OCR qua Advanced Drive Service (phải bật "Drive API" trong Services của Apps Script).

function extractTextFromImage(driveFileId) {
  const blob = DriveApp.getFileById(driveFileId).getBlob();
  const resource = { title: blob.getName(), mimeType: MimeType.GOOGLE_DOCS };
  const ocrFile = Drive.Files.insert(resource, blob, { ocr: true, ocrLanguage: 'vi' });
  const text = DocumentApp.openById(ocrFile.id).getBody().getText();
  DriveApp.getFileById(ocrFile.id).setTrashed(true);
  return text;
}
