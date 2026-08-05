// Bước phê duyệt — xem docs/04-use-cases.md UC-03.

function approveWorkflowInstance(user, instanceId, comment) {
  const instance = getSheetRepository(SHEETS.WORKFLOW_INSTANCES).findById('InstanceID', instanceId);
  const document = getDocumentById(instance.DocumentID);
  requirePermission(user, document.LibraryID, 'CanApprove');

  getSheetRepository(SHEETS.WORKFLOW_INSTANCES).updateById('InstanceID', instanceId, {
    Status: 'APPROVED',
    CurrentStep: 'EXPORT',
    CompletedAt: nowIso()
  });
  logWorkflowStep_(user, instanceId, 'APPROVAL', 'APPROVED', comment || '');

  // Bước EXPORT tự động sau khi duyệt — đúng docs/07-workflow.md mục 2.
  const exportResult = publishDocumentAsWord(user, instance.DocumentID);
  updateDocumentStatus(user, instance.DocumentID, 'PUBLISHED');
  logWorkflowStep_(user, instanceId, 'EXPORT', 'PUBLISHED', exportResult.fileId);

  notifyUser(document.OwnerUserID, 'Văn bản đã được duyệt: ' + document.Title,
    user.FullName + ' (' + user.Email + ') đã duyệt văn bản "' + document.Title + '".' +
    (comment ? ('\nÝ kiến: ' + comment) : '') + '\nVăn bản đã được xuất Word tự động.');

  return { instanceId: instanceId, status: 'APPROVED', export: exportResult };
}

function rejectWorkflowInstance(user, instanceId, comment) {
  const instance = getSheetRepository(SHEETS.WORKFLOW_INSTANCES).findById('InstanceID', instanceId);
  const document = getDocumentById(instance.DocumentID);
  requirePermission(user, document.LibraryID, 'CanApprove');

  getSheetRepository(SHEETS.WORKFLOW_INSTANCES).updateById('InstanceID', instanceId, {
    Status: 'REJECTED',
    CurrentStep: 'EDIT',
    CompletedAt: nowIso()
  });
  updateDocumentStatus(user, instance.DocumentID, 'NEEDS_EDIT');
  logWorkflowStep_(user, instanceId, 'APPROVAL', 'REJECTED', comment || '');

  notifyUser(document.OwnerUserID, 'Văn bản bị từ chối: ' + document.Title,
    user.FullName + ' (' + user.Email + ') đã từ chối văn bản "' + document.Title + '".\nLý do: ' + comment);

  return { instanceId: instanceId, status: 'REJECTED' };
}
