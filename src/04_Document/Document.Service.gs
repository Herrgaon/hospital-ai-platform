// Nghiệp vụ quản lý văn bản — xem docs/02-srs.md FR-DOC-*. Cài đặt đầy đủ thuộc Phase 1.

function createDocumentRecord(user, libraryId, categoryId, title, driveFileId, fileType) {
  requirePermission(user, libraryId, 'CanCreate');
  const doc = getSheetRepository(SHEETS.DOCUMENTS).append({
    DocumentID: generateId('DOC'),
    LibraryID: libraryId,
    CategoryID: categoryId,
    Title: title,
    DriveFileID: driveFileId,
    FileType: fileType,
    CurrentVersion: 1,
    Status: 'DRAFT',
    OwnerUserID: user.UserID,
    CreatedAt: nowIso(),
    UpdatedAt: nowIso(),
    Tags: ''
  });
  logAudit(user.UserID, 'DOCUMENT_CREATED', 'Document', doc.DocumentID, title);
  return doc;
}

// Dùng bởi luồng nạp tài liệu có phân loại tự động — xem docs/10-knowledge-design.md mục 9.
function createDocumentRecordWithMetadata(user, libraryId, categoryId, title, driveFileId, fileType, metadata) {
  requirePermission(user, libraryId, 'CanCreate');
  const doc = getSheetRepository(SHEETS.DOCUMENTS).append(Object.assign({
    DocumentID: generateId('DOC'),
    LibraryID: libraryId,
    CategoryID: categoryId,
    Title: title,
    DriveFileID: driveFileId,
    FileType: fileType,
    CurrentVersion: 1,
    Status: 'DRAFT',
    OwnerUserID: user.UserID,
    CreatedAt: nowIso(),
    UpdatedAt: nowIso()
  }, metadata));
  logAudit(user.UserID, 'DOCUMENT_CREATED', 'Document', doc.DocumentID, title);
  return doc;
}

function getDocumentById(documentId) {
  return getSheetRepository(SHEETS.DOCUMENTS).findById('DocumentID', documentId);
}

function listDocumentsByLibrary(libraryId) {
  return getSheetRepository(SHEETS.DOCUMENTS).findAll().filter(function (d) { return d.LibraryID === libraryId; });
}

function listDocumentsByOwner(ownerUserId) {
  return getSheetRepository(SHEETS.DOCUMENTS).findAll()
    .filter(function (d) { return d.OwnerUserID === ownerUserId && d.Status !== 'ARCHIVED'; })
    .sort(function (a, b) { return new Date(b.UpdatedAt) - new Date(a.UpdatedAt); })
    .slice(0, 10);
}

// Xoá mềm — chuyển file Drive vào Thùng rác (khôi phục được trong 30 ngày, giống
// Knowledge.Ingest.gs#discardStagedUpload) và giữ nguyên dòng Document (Status=ARCHIVED) để không
// mất dấu vết audit. KHÔNG xoá cứng dòng dữ liệu — hồ sơ hành chính bệnh viện cần lưu vết.
function deleteDocument(user, documentId) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanDelete');

  DriveApp.getFileById(document.DriveFileID).setTrashed(true);
  const updated = getSheetRepository(SHEETS.DOCUMENTS).updateById('DocumentID', documentId, {
    Status: 'ARCHIVED',
    UpdatedAt: nowIso()
  });
  logAudit(user.UserID, 'DOCUMENT_DELETED', 'Document', documentId, document.Title);
  return updated;
}

// KHÔNG tự kiểm tra quyền ở đây — nơi gọi (RuleEngine.Core.gs#checkDocument dùng CanEdit,
// Workflow.Approval.gs / Knowledge.Governance.gs dùng CanApprove...) đã tự xác định đúng quyền
// cần thiết cho hành động cụ thể của họ trước khi gọi tới đây. Gộp chung 1 kiểm tra cứng (ví dụ
// luôn đòi CanEdit) sẽ chặn nhầm người có CanApprove nhưng không có CanEdit.
function updateDocumentStatus(user, documentId, newStatus) {
  const updated = getSheetRepository(SHEETS.DOCUMENTS).updateById('DocumentID', documentId, {
    Status: newStatus,
    UpdatedAt: nowIso()
  });
  logAudit(user.UserID, 'DOCUMENT_STATUS_CHANGED', 'Document', documentId, newStatus);
  return updated;
}
