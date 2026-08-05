// Quản lý mẫu văn bản — xem docs/02-srs.md mục Văn bản.

function listActiveTemplates(libraryId) {
  return getSheetRepository(SHEETS.TEMPLATES).findAll().filter(function (t) {
    return t.Status === 'Active' && (libraryId === '*' || t.LibraryID === libraryId);
  });
}

function getTemplateById(templateId) {
  return getSheetRepository(SHEETS.TEMPLATES).findById('TemplateID', templateId);
}

// Admin tải lên 1 file Google Doc/Word chứa sẵn placeholder dạng [tenField] và khai báo danh sách
// field (phân tách bằng dấu phẩy) — đơn giản hoá so với một trình soạn Template đồ hoạ đầy đủ,
// đủ dùng ở quy mô hiện tại (YAGNI, xem docs/21-... triết lý "ít cấu hình").
function createTemplateFromUpload(user, templateName, libraryId, categoryId, fileName, mimeType, base64Data, fieldNamesCsv) {
  if (user.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được tạo mẫu văn bản.');
  }

  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const templatesRoot = getOrCreateSubfolder(getRootFolder_(), DRIVE_FOLDERS.TEMPLATES);
  const file = templatesRoot.createFile(blob);

  const fields = fieldNamesCsv
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; })
    .map(function (name) { return { name: name, label: name, multiline: false }; });

  const template = getSheetRepository(SHEETS.TEMPLATES).append({
    TemplateID: generateId('TPL'),
    TemplateName: templateName,
    LibraryID: libraryId,
    CategoryID: categoryId || '',
    DriveFileID: file.getId(),
    Fields: JSON.stringify(fields),
    Status: 'Active',
    CreatedAt: nowIso()
  });

  logAudit(user.UserID, 'TEMPLATE_CREATED', 'Template', template.TemplateID, templateName);
  return template;
}

function setTemplateStatus(user, templateId, status) {
  if (user.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được thay đổi trạng thái mẫu văn bản.');
  }
  const updated = getSheetRepository(SHEETS.TEMPLATES).updateById('TemplateID', templateId, { Status: status });
  logAudit(user.UserID, 'TEMPLATE_STATUS_CHANGED', 'Template', templateId, status);
  return updated;
}
