// Quản lý công việc (khối hành chính) — Trưởng phòng giao việc -> nhân viên nhận/thực hiện/cập nhật
// tiến độ/nộp kết quả -> người giao đánh giá. CHỈ dùng cho khối hành chính (Ban Giám đốc + 3 Phòng
// chức năng) — khối lâm sàng/cận lâm sàng dùng ClinicalAssignment.Service.gs (mô hình khác hẳn).
// Status: ASSIGNED -> IN_PROGRESS -> SUBMITTED -> EVALUATED.

// parentTaskId có giá trị = đây là Subtask (§10 đặc tả KPI + Quản lý Trực V1: "không được tính trùng
// task" — Subtask KHÔNG BAO GIỜ tự tạo giá trị KPI, dù isKpiTask truyền vào có true hay không, xem
// Kpi.Engine.gs#computeTaskCompletionPercentForPeriod_ lọc cứng ParentTaskID rỗng).
// isKpiTask: đánh dấu THỦ CÔNG bởi người giao — mặc định false, không tự suy luận.
// baseValue: "Giá trị cơ sở" (§8) — chỉ có ý nghĩa khi isKpiTask=true, mặc định 0 nếu bỏ trống.
function assignTask(actingUser, input) {
  requirePermission(actingUser, input.departmentId, 'CanCreate');
  if (isBlank(input.title) || isBlank(input.assigneeEmployeeId)) {
    throw new Error('Thiếu tiêu đề công việc hoặc người thực hiện.');
  }
  if (!isBlank(input.parentTaskId)) {
    const parentTask = getSheetRepository(SHEETS.TASKS).findById('TaskID', input.parentTaskId);
    if (!parentTask) throw new Error('Không tìm thấy công việc cha.');
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
    ParentTaskID: input.parentTaskId || '',
    IsKpiTask: !isBlank(input.parentTaskId) ? false : !!input.isKpiTask,
    BaseValue: input.baseValue || 0,
    ComplexityScoresJson: '', ComplexityP: '', ComplexityLevel: '', QualityCoefficient: '',
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

// §9: điểm độ phức tạp CHỈ do người đánh giá chấm (không cho người thực hiện tự chấm) — vì vậy gộp
// vào đúng bước evaluateTask, không tách hàm riêng cho AssigneeEmployeeID gọi được. complexityScores/
// qualityCoefficient đều tuỳ chọn — bỏ trống thì Kpi.Engine.gs coi hệ số phức tạp/chất lượng = 1 (giữ
// nguyên giá trị cơ sở, không phạt/thưởng gì thêm) khi tính Giá trị hoàn thành.
function evaluateTask(actingUser, taskId, input) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isAssigner = employee && task.AssignerEmployeeID === employee.EmployeeID;
  if (!isAssigner) requirePermission(actingUser, task.DepartmentID, 'CanApprove');

  const patch = {
    Status: 'EVALUATED',
    EvaluatorEmployeeID: employee ? employee.EmployeeID : '',
    EvaluationScore: input.score,
    EvaluationComment: input.comment || '',
    EvaluatedAt: nowIso(),
    UpdatedAt: nowIso()
  };
  if (input.complexityScores) {
    const complexity = computeTaskComplexity_(input.complexityScores);
    patch.ComplexityScoresJson = JSON.stringify(input.complexityScores);
    patch.ComplexityP = complexity.p;
    patch.ComplexityLevel = complexity.level;
  }
  if (input.qualityCoefficient != null && input.qualityCoefficient !== '') {
    patch.QualityCoefficient = Number(input.qualityCoefficient);
  }

  const updated = getSheetRepository(SHEETS.TASKS).updateById('TaskID', taskId, patch);
  logAudit(actingUser.UserID, 'TASK_EVALUATED', 'Task', taskId, 'Điểm: ' + input.score);
  return updated;
}

// --- Nhiều người cùng làm (§11) ---

function addTaskParticipant(actingUser, taskId, input) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isAssigner = employee && task.AssignerEmployeeID === employee.EmployeeID;
  if (!isAssigner) requirePermission(actingUser, task.DepartmentID, 'CanEdit');

  const participant = getEmployeeById(input.employeeId);
  if (!participant || participant.Status !== 'Active') {
    throw new Error('Không thể thêm nhân viên đã nghỉ việc/ngừng hoạt động.');
  }
  const valuePercent = Number(input.valuePercent);
  if (!(valuePercent > 0 && valuePercent <= 100)) throw new Error('% giá trị phải trong khoảng 0-100.');

  // Lần đầu thêm participant cho 1 task trước đây chỉ có AssigneeEmployeeID (ngầm định 100%, xem
  // Kpi.Engine.gs#getTaskParticipantShares_) — phải "khởi tạo" dòng cho chính AssigneeEmployeeID trước
  // với phần % CÒN LẠI sau khi trừ người mới, để tổng vẫn đúng 100% (KHÔNG seed cứng 100% cho Assignee
  // rồi cộng thêm người mới — như vậy sẽ luôn vượt 100% ngay từ người thứ 2, đã phát hiện qua test).
  const repo = getSheetRepository(SHEETS.TASK_PARTICIPANTS);
  const existing = repo.findAll().filter(function (p) { return p.TaskID === taskId; });
  if (existing.length === 0 && task.AssigneeEmployeeID && task.AssigneeEmployeeID !== input.employeeId) {
    const remainder = 100 - valuePercent;
    if (remainder > 0) {
      repo.append({
        TaskParticipantID: generateId('TPART'), TaskID: taskId, EmployeeID: task.AssigneeEmployeeID,
        RoleInTask: 'CHU_TRI', ValuePercent: remainder, CreatedAt: nowIso()
      });
    }
  }

  const totalSoFar = repo.findAll().filter(function (p) { return p.TaskID === taskId; })
    .reduce(function (sum, p) { return sum + (Number(p.ValuePercent) || 0); }, 0);
  if (totalSoFar + valuePercent > 100) {
    throw new Error('Tổng % giá trị đã vượt quá 100% — giảm % của người đã có trước khi thêm người mới (điều chỉnh qua removeTaskParticipant rồi thêm lại).');
  }

  const row = repo.append({
    TaskParticipantID: generateId('TPART'), TaskID: taskId, EmployeeID: input.employeeId,
    RoleInTask: input.roleInTask || 'PHOI_HOP', ValuePercent: valuePercent, CreatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'TASK_PARTICIPANT_ADDED', 'Task', taskId, input.employeeId + ': ' + valuePercent + '%');
  return row;
}

function removeTaskParticipant(actingUser, taskParticipantId) {
  const repo = getSheetRepository(SHEETS.TASK_PARTICIPANTS);
  const participant = repo.findById('TaskParticipantID', taskParticipantId);
  if (!participant) throw new Error('Không tìm thấy người tham gia.');
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', participant.TaskID);
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isAssigner = employee && task && task.AssignerEmployeeID === employee.EmployeeID;
  if (!isAssigner) requirePermission(actingUser, task.DepartmentID, 'CanEdit');

  const ss = getSystemSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.TASK_PARTICIPANTS);
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf('TaskParticipantID');
  for (let r = data.length - 1; r >= 1; r--) {
    if (data[r][idIdx] === taskParticipantId) { sheet.deleteRow(r + 1); break; }
  }
  logAudit(actingUser.UserID, 'TASK_PARTICIPANT_REMOVED', 'Task', participant.TaskID, participant.EmployeeID);
  return { success: true };
}

function listTaskParticipants(taskId) {
  return getSheetRepository(SHEETS.TASK_PARTICIPANTS).findAll().filter(function (p) { return p.TaskID === taskId; });
}

function listSubtasks(taskId) {
  return getSheetRepository(SHEETS.TASKS).findAll().filter(function (t) { return t.ParentTaskID === taskId; });
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
