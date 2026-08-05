// Knowledge Governance — bản rút gọn thực dụng cho quy mô hiện tại (Product Owner, 2026-08-05):
// 1 cấp duyệt (người có CanApprove trên Library đó — thường là Trưởng khoa/phòng phụ trách kho)
// thay vì nhiều Reviewer bỏ phiếu đa số/đồng thuận. Quality Score/Trust Level/multi-reviewer là
// điểm mở rộng tương lai, chưa xây (YAGNI — quy mô ~50 người, phần lớn kho chỉ có 1 người phụ trách
// thực tế nên quorum nhiều người không khả thi để vận hành).
//
// Vòng đời rút gọn: PENDING_REVIEW (sau khi Uploader xác nhận metadata) → PUBLISHED (đã duyệt,
// AI được dùng) hoặc NEEDS_EDIT (bị từ chối, Uploader sửa rồi gửi lại).
// CHỈ tài liệu Status = PUBLISHED mới được dùng làm ngữ cảnh cho AI (xem Knowledge.Search.gs,
// Knowledge.Review.gs) — đúng nguyên tắc "AI không tự quyết định tri thức chính thức".

function approveKnowledgeDocument(user, documentId, comment) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanApprove');

  const updated = updateDocumentStatus(user, documentId, 'PUBLISHED');
  logAudit(user.UserID, 'KNOWLEDGE_APPROVED', 'Document', documentId, comment || '');

  notifyUser(document.OwnerUserID, 'Tài liệu đã được duyệt: ' + document.Title,
    user.FullName + ' (' + user.Email + ') đã duyệt tài liệu "' + document.Title + '".' +
    (comment ? ('\nÝ kiến: ' + comment) : '') + '\nTài liệu đã được công bố vào kho tri thức.');

  return updated;
}

function rejectKnowledgeDocument(user, documentId, comment) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanApprove');
  if (isBlank(comment)) {
    throw new Error('Cần nêu lý do khi từ chối để Uploader biết cần sửa gì.');
  }

  const updated = updateDocumentStatus(user, documentId, 'NEEDS_EDIT');
  logAudit(user.UserID, 'KNOWLEDGE_REJECTED', 'Document', documentId, comment);

  notifyUser(document.OwnerUserID, 'Tài liệu cần chỉnh sửa: ' + document.Title,
    user.FullName + ' (' + user.Email + ') đã từ chối tài liệu "' + document.Title + '".\nLý do: ' + comment);

  return updated;
}

function resubmitKnowledgeDocument(user, documentId) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanEdit');
  const updated = updateDocumentStatus(user, documentId, 'PENDING_REVIEW');
  logAudit(user.UserID, 'KNOWLEDGE_RESUBMITTED', 'Document', documentId, '');

  notifyApprovers(user, document.LibraryID, 'Tài liệu chờ duyệt lại: ' + document.Title,
    user.FullName + ' (' + user.Email + ') vừa gửi lại tài liệu "' + document.Title + '" sau khi chỉnh sửa, chờ bạn duyệt.');

  return updated;
}

function listPendingKnowledgeReviews(user) {
  return getSheetRepository(SHEETS.DOCUMENTS).findAll()
    .filter(function (d) { return d.Status === 'PENDING_REVIEW'; })
    .filter(function (d) { return hasPermission(user, d.LibraryID, 'CanApprove'); });
}
