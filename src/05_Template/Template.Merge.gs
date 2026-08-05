// Sinh văn bản theo mẫu (mail-merge) — xem docs/04-use-cases.md UC-01.

function createDocumentFromTemplate(user, templateId, fieldValues) {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error('Không tìm thấy mẫu văn bản: ' + templateId);
  }
  requirePermission(user, template.LibraryID, 'CanCreate');

  const library = getSheetRepository(SHEETS.LIBRARIES).findById('LibraryID', template.LibraryID);
  const destinationFolder = DriveApp.getFolderById(library.DriveFolderID);

  return mergeTemplateToDraft(user, template, fieldValues, destinationFolder);
}

function mergeTemplateToDraft(user, template, fieldValues, destinationFolder) {
  const templateFile = DriveApp.getFileById(template.DriveFileID);
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmmss');
  const draftFile = templateFile.makeCopy(template.TemplateName + ' - ' + timestamp, destinationFolder);
  const draftDoc = DocumentApp.openById(draftFile.getId());
  const body = draftDoc.getBody();

  Object.keys(fieldValues).forEach(function (fieldName) {
    body.replaceText('\\[' + fieldName + '\\]', fieldValues[fieldName]);
  });
  draftDoc.saveAndClose();

  return createDocumentRecord(user, template.LibraryID, template.CategoryID, draftFile.getName(), draftFile.getId(), 'GOOGLE_DOC');
}
