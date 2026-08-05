// Điều phối workflow — xem docs/07-workflow.md.
// Phase 3 chỉ có 1 Workflow mặc định với 1 bước Phê duyệt thực tế cần vận hành (Upload/Kiểm tra Rule/
// Chỉnh sửa đã chạy trực tiếp qua Document/RuleEngine ở Phase 1, không cần đi qua state machine).
// Việc đọc đầy đủ StepsDefinition JSON để tự suy ra chuỗi bước động (nhiều cấp duyệt tuỳ ý theo
// docs/07-workflow.md mục 5) là cải tiến hoãn lại tới khi có nhu cầu thực tế (YAGNI) — hiện schema
// Workflows/WorkflowInstances đã sẵn sàng cho việc đó mà không cần đổi cấu trúc dữ liệu.

function submitForApproval(user, documentId) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanEdit');

  const instance = getSheetRepository(SHEETS.WORKFLOW_INSTANCES).append({
    InstanceID: generateId('WFI'),
    WorkflowID: 'WF_DEFAULT',
    DocumentID: documentId,
    CurrentStep: 'APPROVAL',
    Status: 'PENDING_APPROVAL',
    StartedAt: nowIso(),
    CompletedAt: ''
  });

  updateDocumentStatus(user, documentId, 'PENDING_APPROVAL');
  logWorkflowStep_(user, instance.InstanceID, 'APPROVAL', 'SUBMITTED', '');
  logAudit(user.UserID, 'WORKFLOW_SUBMITTED', 'WorkflowInstance', instance.InstanceID, documentId);

  notifyApprovers(user, document.LibraryID, 'Văn bản chờ bạn duyệt: ' + document.Title,
    user.FullName + ' (' + user.Email + ') vừa gửi văn bản "' + document.Title + '" chờ bạn phê duyệt.\n' +
    'Vào mục Workflow trong hệ thống để xử lý.');

  return instance;
}

function listPendingApprovalsForUser(user) {
  const pending = getSheetRepository(SHEETS.WORKFLOW_INSTANCES).findAll().filter(function (i) {
    return i.Status === 'PENDING_APPROVAL';
  });
  return pending
    .map(function (instance) {
      const document = getDocumentById(instance.DocumentID);
      return { instance: instance, document: document };
    })
    .filter(function (row) { return row.document && hasPermission(user, row.document.LibraryID, 'CanApprove'); });
}

function logWorkflowStep_(user, instanceId, stepName, action, comment) {
  getSheetRepository(SHEETS.WORKFLOW_STEP_LOG).append({
    LogID: generateId('WFLOG'),
    InstanceID: instanceId,
    StepName: stepName,
    ActorUserID: user.UserID,
    Action: action,
    Comment: comment || '',
    Timestamp: nowIso()
  });
}

function listWorkflowStepLog(instanceId) {
  return getSheetRepository(SHEETS.WORKFLOW_STEP_LOG).findAll().filter(function (l) { return l.InstanceID === instanceId; });
}
