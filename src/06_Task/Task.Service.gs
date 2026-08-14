// Quản lý công việc (khối hành chính) — Trưởng phòng giao việc -> nhân viên nhận/thực hiện/cập nhật
// tiến độ/nộp kết quả -> người giao đánh giá. CHỈ dùng cho khối hành chính (Ban Giám đốc + 3 Phòng
// chức năng) — khối lâm sàng/cận lâm sàng dùng ClinicalAssignment.Service.gs (mô hình khác hẳn).
// Status: ASSIGNED -> IN_PROGRESS -> SUBMITTED -> EVALUATED.

function assignTask(actingUser, input) {
  requirePermission(actingUser, input.departmentId, 'CanCreate');
  if (isBlank(input.title) || isBlank(input.assigneeEmployeeId)) {
    throw new Error('Thiếu tiêu đề công việc hoặc người thực hiện.');
  }
  const assignerEmployee = getEmployeeByUserId_(actingUser.UserID);
  const assigneeEmployee = getEmployeeById(input.assigneeEmployeeId);
  if (!assigneeEmployee || assigneeEmployee.Status !== 'Active') {
    throw new Error('Không thể giao việc cho nhân viên đã nghỉ việc/ngừng hoạt động.');
  }

  const task = getSheetRepository(SHEETS.TASKS).append({
    TaskID: generateId('TASK'),
    Title: input.title,
    Description: input.description || '',
    DepartmentID: input.departmentId,
    AssignerEmployeeID: assignerEmployee ? assignerEmployee.EmployeeID : '',
    AssigneeEmployeeID: input.assigneeEmployeeId,
    AssignedDate: nowIso(),
    DueDate: input.dueDate || '',
    Priority: input.priority || 'NORMAL',
    Progress: 0,
    Status: 'ASSIGNED',
    Result: '',
    AttachmentFolderDriveID: '',
    EvaluatorEmployeeID: '',
    EvaluationScore: '',
    EvaluationComment: '',
    EvaluatedAt: '',
    CreatedAt: nowIso(),
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'TASK_ASSIGNED', 'Task', task.TaskID, input.title);
  notifyUser(assigneeEmployee.UserID, 'Bạn được giao việc mới: ' + input.title,
    'Hạn hoàn thành: ' + (input.dueDate || 'chưa đặt') + '\nMô tả: ' + (input.description || ''));
  return task;
}

function requireTaskParty_(task, actingUser, employeeIdField) {
  const employee = getEmployeeByUserId_(actingUser.UserID);
  if (!employee || task[employeeIdField] !== employee.EmployeeID) {
    throw new Error('Bạn không phải người liên quan đến công việc này.');
  }
  return employee;
}

function updateTaskProgress(actingUser, taskId, progress) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  requireTaskParty_(task, actingUser, 'AssigneeEmployeeID');

  const patch = { Progress: progress, UpdatedAt: nowIso() };
  if (task.Status === 'ASSIGNED') patch.Status = 'IN_PROGRESS';
  const updated = getSheetRepository(SHEETS.TASKS).updateById('TaskID', taskId, patch);
  logAudit(actingUser.UserID, 'TASK_PROGRESS_UPDATED', 'Task', taskId, String(progress) + '%');
  return updated;
}

function submitTaskResult(actingUser, taskId, resultText) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  requireTaskParty_(task, actingUser, 'AssigneeEmployeeID');

  const updated = getSheetRepository(SHEETS.TASKS).updateById('TaskID', taskId, {
    Result: resultText, Status: 'SUBMITTED', Progress: 100, UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'TASK_RESULT_SUBMITTED', 'Task', taskId, resultText);
  if (task.AssignerEmployeeID) {
    const assigner = getEmployeeById(task.AssignerEmployeeID);
    if (assigner) notifyUser(assigner.UserID, 'Kết quả công việc đã nộp: ' + task.Title, resultText);
  }
  return updated;
}

function evaluateTask(actingUser, taskId, input) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isAssigner = employee && task.AssignerEmployeeID === employee.EmployeeID;
  if (!isAssigner) requirePermission(actingUser, task.DepartmentID, 'CanApprove');

  const updated = getSheetRepository(SHEETS.TASKS).updateById('TaskID', taskId, {
    Status: 'EVALUATED',
    EvaluatorEmployeeID: employee ? employee.EmployeeID : '',
    EvaluationScore: input.score,
    EvaluationComment: input.comment || '',
    EvaluatedAt: nowIso(),
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'TASK_EVALUATED', 'Task', taskId, 'Điểm: ' + input.score);
  return updated;
}

// Không requirePermission — quyền sở hữu (mình là người giao HOẶC người nhận) chính là kiểm soát
// truy cập, đúng cách listDocumentsByOwner làm trước đây.
function listMyTasks(user) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  return getSheetRepository(SHEETS.TASKS).findAll().filter(function (t) {
    return t.AssigneeEmployeeID === employee.EmployeeID || t.AssignerEmployeeID === employee.EmployeeID;
  });
}

function listTasksByDepartment(user, departmentId) {
  requirePermission(user, departmentId, 'CanView');
  return getSheetRepository(SHEETS.TASKS).findAll().filter(function (t) { return t.DepartmentID === departmentId; });
}

function uploadTaskAttachment(actingUser, taskId, fileName, mimeType, base64Data) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isParty = employee && (task.AssigneeEmployeeID === employee.EmployeeID || task.AssignerEmployeeID === employee.EmployeeID);
  if (!isParty) requirePermission(actingUser, task.DepartmentID, 'CanEdit');

  const folder = getTaskAttachmentsFolder(taskId);
  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const file = folder.createFile(blob);
  if (isBlank(task.AttachmentFolderDriveID)) {
    getSheetRepository(SHEETS.TASKS).updateById('TaskID', taskId, { AttachmentFolderDriveID: folder.getId(), UpdatedAt: nowIso() });
  }
  logAudit(actingUser.UserID, 'TASK_ATTACHMENT_UPLOADED', 'Task', taskId, fileName);
  return { fileId: file.getId(), fileName: fileName, url: file.getUrl() };
}

function listTaskAttachments(taskId) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task || isBlank(task.AttachmentFolderDriveID)) return [];
  const folder = DriveApp.getFolderById(task.AttachmentFolderDriveID);
  const files = folder.getFiles();
  const out = [];
  while (files.hasNext()) {
    const f = files.next();
    out.push({ fileId: f.getId(), fileName: f.getName(), url: f.getUrl() });
  }
  return out;
}
