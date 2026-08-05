// Điểm vào duy nhất cho client (google.script.run) — xem docs/13-security.md mục 7:
// "Giả mạo request google.script.run" — mọi hàm ở đây tự lấy user qua getCurrentUser(),
// KHÔNG BAO GIỜ nhận UserID/Role từ tham số client. Service layer phía dưới vẫn tự kiểm tra
// quyền lại (requirePermission/hasPermission) nên hàm ở đây không lặp lại việc đó.

function api_getCurrentUser() {
  const user = getCurrentUser();
  return {
    UserID: user.UserID, Email: user.Email, FullName: user.FullName, Role: user.Role,
    Department: user.Department, AvatarUrl: user.AvatarUrl
  };
}

function api_updateMyProfile(fullName) {
  const user = getCurrentUser();
  return updateMyProfile(user, fullName);
}

function api_updateMyAvatar(base64Data, mimeType) {
  const user = getCurrentUser();
  return updateMyAvatar(user, base64Data, mimeType);
}

function api_createUser(email, fullName, role, department) {
  const user = getCurrentUser();
  return createUser(user, email, fullName, role, department);
}

function api_updateUserProfile(targetUserId, fullName, department) {
  const user = getCurrentUser();
  return updateUserProfile(user, targetUserId, fullName, department);
}

function api_listMyDocuments() {
  const user = getCurrentUser();
  return listDocumentsByOwner(user.UserID);
}

function api_syncSchemaWithSpreadsheet() {
  const user = getCurrentUser();
  return syncSchemaWithSpreadsheet(user);
}

function api_getDashboardSummary() {
  const user = getCurrentUser();
  return {
    pendingApprovals: listPendingApprovalsForUser(user),
    myRecentDocuments: listDocumentsByOwner(user.UserID)
  };
}

function api_listLibraries() {
  const user = getCurrentUser();
  return listLibrariesForUser(user);
}

function api_listTemplates(libraryId) {
  return listActiveTemplates(libraryId || '*');
}

function api_createDocumentFromTemplate(templateId, fieldValues) {
  const user = getCurrentUser();
  return createDocumentFromTemplate(user, templateId, fieldValues);
}

function api_checkDocumentRules(documentId) {
  const user = getCurrentUser();
  return checkDocument(user, documentId);
}

function api_listDocuments(libraryId) {
  const user = getCurrentUser();
  const documents = libraryId ? listDocumentsByLibrary(libraryId) : getSheetRepository(SHEETS.DOCUMENTS).findAll();
  return documents.filter(function (d) { return d.Status !== 'ARCHIVED' && hasPermission(user, d.LibraryID, 'CanView'); });
}

function api_getDocument(documentId) {
  const user = getCurrentUser();
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanView');
  return document;
}

function api_deleteDocument(documentId) {
  const user = getCurrentUser();
  return deleteDocument(user, documentId);
}

function api_restoreDocument(documentId) {
  const user = getCurrentUser();
  return restoreDocument(user, documentId);
}

function api_listArchivedDocuments() {
  const user = getCurrentUser();
  return listArchivedDocuments(user);
}

function api_listCategories(libraryId) {
  return listCategoriesByLibrary(libraryId);
}

function api_createCategory(libraryId, categoryName, parentCategoryId) {
  const user = getCurrentUser();
  return createCategory(user, libraryId, categoryName, parentCategoryId);
}

function api_createLibrary(libraryName, description, managerUserId, requiresReview) {
  const user = getCurrentUser();
  return createLibrary(user, libraryName, description, managerUserId || user.UserID, requiresReview);
}

function api_stageUploadForClassification(fileName, mimeType, base64Data) {
  const user = getCurrentUser();
  return stageUploadForClassification(user, fileName, mimeType, base64Data);
}

function api_stageBulkUpload(files) {
  const user = getCurrentUser();
  return stageBulkUpload(user, files);
}

function api_getMaxBulkUploadCount() {
  return getMaxBulkUploadCount();
}

function api_setMaxBulkUploadCount(value) {
  const user = getCurrentUser();
  return setMaxBulkUploadCount(user, value);
}

function api_confirmClassificationAndSave(fileId, fileName, parserCategory, metadata, ocrStatus, finalFields, originalFields) {
  const user = getCurrentUser();
  return confirmClassificationAndSave(user, fileId, fileName, parserCategory, metadata, ocrStatus, finalFields, originalFields);
}

function api_discardStagedUpload(fileId) {
  const user = getCurrentUser();
  discardStagedUpload(user, fileId);
}

function api_listPendingKnowledgeReviews() {
  const user = getCurrentUser();
  return listPendingKnowledgeReviews(user);
}

function api_approveKnowledgeDocument(documentId, comment) {
  const user = getCurrentUser();
  return approveKnowledgeDocument(user, documentId, comment);
}

function api_rejectKnowledgeDocument(documentId, comment) {
  const user = getCurrentUser();
  return rejectKnowledgeDocument(user, documentId, comment);
}

function api_resubmitKnowledgeDocument(documentId) {
  const user = getCurrentUser();
  return resubmitKnowledgeDocument(user, documentId);
}

function api_getClassificationThreshold() {
  return getClassificationThreshold();
}

function api_setClassificationThreshold(value) {
  const user = getCurrentUser();
  if (user.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được đổi ngưỡng tự động chấp nhận phân loại AI.');
  }
  setConfig(CONFIG_KEYS.AI_CLASSIFICATION_THRESHOLD, String(value));
  logAudit(user.UserID, 'AI_CLASSIFICATION_THRESHOLD_CHANGED', 'System', 'AI_CLASSIFICATION_THRESHOLD', String(value));
}

function api_searchDocuments(keyword, libraryId) {
  const user = getCurrentUser();
  return searchDocumentsByKeyword(user, keyword, libraryId || null);
}

function api_extractTextFromDocument(documentId) {
  const user = getCurrentUser();
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanView');
  const text = extractTextFromImage(document.DriveFileID);
  logAudit(user.UserID, 'DOCUMENT_OCR_EXTRACTED', 'Document', documentId, '');
  return text;
}

function api_createTemplate(templateName, libraryId, categoryId, fileName, mimeType, base64Data, fieldNamesCsv) {
  const user = getCurrentUser();
  return createTemplateFromUpload(user, templateName, libraryId, categoryId, fileName, mimeType, base64Data, fieldNamesCsv);
}

function api_exportAuditLogToExcel(filters) {
  const user = getCurrentUser();
  return exportAuditLogToExcel(user, filters || {});
}

function api_reviewDocumentAgainstLibraries(documentId, libraryIds) {
  const user = getCurrentUser();
  return reviewDocumentAgainstLibraries(user, documentId, libraryIds);
}

function api_suggestLibrariesForDocument(documentId) {
  const user = getCurrentUser();
  return suggestLibrariesForDocument(user, documentId);
}

function api_askKnowledgeBase(question, libraryIds) {
  const user = getCurrentUser();
  return askKnowledgeBase(user, question, libraryIds || null);
}

function api_suggestLibrariesForQuestion(questionText) {
  const user = getCurrentUser();
  return suggestLibrariesForQuestion(user, questionText);
}

function api_listDocumentVersions(documentId) {
  const user = getCurrentUser();
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanView');
  return listDocumentVersions(documentId);
}

function api_compareDocumentVersions(documentId, versionIdA, versionIdB) {
  const user = getCurrentUser();
  return compareDocumentVersions(user, documentId, versionIdA, versionIdB);
}

function api_listAllUsers() {
  const user = getCurrentUser();
  return listAllUsers(user);
}

function api_getAllRoles() {
  return getAllRoles();
}

function api_assignRole(targetUserId, newRole) {
  const user = getCurrentUser();
  return assignRole(user, targetUserId, newRole);
}

function api_setUserPermissionOverride(targetUserId, libraryId, permissionPatch) {
  const user = getCurrentUser();
  return setUserPermissionOverride(user, targetUserId, libraryId, permissionPatch);
}

function api_listUserDirectory() {
  return listUserDirectory();
}

function api_canManageLibrary(libraryId) {
  const user = getCurrentUser();
  return hasPermission(user, libraryId, 'CanManage');
}

function api_listPermissionsForLibrary(libraryId) {
  const user = getCurrentUser();
  return listPermissionsForLibrary(user, libraryId);
}

function api_listAIProviders() {
  return listAIProviders();
}

function api_getActiveAIProviderConfig() {
  const user = getCurrentUser();
  if (user.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được xem cấu hình AI.');
  }
  return getActiveAIProviderConfigMasked();
}

function api_isAiEnabled() {
  return isAiEnabled();
}

function api_updateAIProviderConfig(providerId, modelName, plainApiKey, temperature, maxTokens, timeout) {
  const user = getCurrentUser();
  return updateAIProviderConfig(user, providerId, modelName, plainApiKey, temperature, maxTokens, timeout);
}

function api_setAiEnabled(enabled) {
  const user = getCurrentUser();
  setAiEnabled(user, enabled);
  return { aiEnabled: enabled };
}

function api_searchAuditLog(filters) {
  const user = getCurrentUser();
  return searchAuditLog(user, filters || {});
}

function api_getClassificationAccuracyReport() {
  const user = getCurrentUser();
  return getClassificationAccuracyReport(user);
}

function api_exportDocumentAsWord(documentId) {
  const user = getCurrentUser();
  return publishDocumentAsWord(user, documentId);
}

function api_submitForApproval(documentId) {
  const user = getCurrentUser();
  return submitForApproval(user, documentId);
}

function api_listPendingApprovals() {
  const user = getCurrentUser();
  return listPendingApprovalsForUser(user);
}

function api_approveWorkflowInstance(instanceId, comment) {
  const user = getCurrentUser();
  return approveWorkflowInstance(user, instanceId, comment);
}

function api_rejectWorkflowInstance(instanceId, comment) {
  const user = getCurrentUser();
  return rejectWorkflowInstance(user, instanceId, comment);
}
