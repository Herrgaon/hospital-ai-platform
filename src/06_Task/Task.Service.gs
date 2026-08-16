// Quản lý công việc (khối hành chính) — Trưởng phòng giao việc -> nhân viên nhận/thực hiện/cập nhật
// tiến độ/nộp kết quả -> người giao đánh giá. CHỈ dùng cho khối hành chính (Ban Giám đốc + 3 Phòng
// chức năng) — khối lâm sàng/cận lâm sàng dùng ClinicalAssignment.Service.gs (mô hình khác hẳn).
// Status lưu trong Sheet: ASSIGNED -> IN_PROGRESS -> SUBMITTED -> EVALUATED, hoặc CANCELLED. "QUÁ HẠN"
// KHÔNG phải 1 Status lưu trữ — luôn tính lại từ DueDate + Status hiện tại (xem isTaskOverdue_), đúng
// §11 đặc tả "Công việc định kỳ theo chu kỳ V1": "QUÁ HẠN có thể được hệ thống xác định tự động từ
// deadline và trạng thái."
//
// Bổ sung theo đặc tả trên (2026-08-15) — 4 nguồn công việc (SourceType, xem Storage.Schema.gs):
// ASSIGNED (giao việc, hàm assignTask ở trên) | PERSONAL (tự lập, createPersonalTask) | SYSTEM (dự
// phòng, chưa dùng) | RECURRING (sinh từ RecurringTaskTemplates, xem cuối file). KHÔNG nguồn nào mặc
// nhiên là KPI — chỉ IsKpiTask=true (đánh dấu thủ công) mới tính.

const TASK_SOURCE_TYPES_ = { ASSIGNED: 'ASSIGNED', PERSONAL: 'PERSONAL', SYSTEM: 'SYSTEM', RECURRING: 'RECURRING' };
const TASK_FREQUENCIES_ = { DAILY: 'DAILY', WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', YEARLY: 'YEARLY' };
const TASK_DEADLINE_TYPES_ = { NONE: 'NONE', FIXED: 'FIXED', RELATIVE: 'RELATIVE' };

function isTaskOverdue_(task) {
  if (isBlank(task.DueDate) || task.Status === 'EVALUATED' || task.Status === 'CANCELLED') return false;
  const todayStr = Utilities.formatDate(new Date(), HANOI_TZ_, 'yyyy-MM-dd');
  return task.DueDate < todayStr;
}

function decorateTaskWithComputedFields_(task) {
  task.IsOverdue = isTaskOverdue_(task);
  return task;
}

// parentTaskId có giá trị = đây là Subtask (§10 đặc tả KPI + Quản lý Trực V1: "không được tính trùng
// task" — Subtask KHÔNG BAO GIỜ tự tạo giá trị KPI, dù isKpiTask truyền vào có true hay không, xem
// Kpi.Engine.gs#computeTaskCompletionPercentForPeriod_ lọc cứng ParentTaskID rỗng).
// isKpiTask: đánh dấu THỦ CÔNG bởi người giao — mặc định false, không tự suy luận.
// baseValue: "Giá trị cơ sở" (§8) — chỉ có ý nghĩa khi isKpiTask=true, mặc định 0 nếu bỏ trống.
function assignTask(actingUser, input) {
  requirePermission(actingUser, input.departmentId, 'CanCreate', 'TASK');
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
    SourceType: TASK_SOURCE_TYPES_.ASSIGNED, TemplateID: '', Period: input.period || '',
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
  if (!isAssigner) requirePermission(actingUser, task.DepartmentID, 'CanApprove', 'TASK');

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

// §15 đặc tả bổ sung "Công việc định kỳ theo chu kỳ V1": người dùng được TỰ tạo công việc cá nhân để
// quản lý — KHÔNG cần quyền CanCreate (khác assignTask, vốn là giao việc CHO NGƯỜI KHÁC, cần quyền
// quản lý). Assigner=Assignee=chính mình → completeMyTask cho phép hoàn thành thẳng, không cần người
// khác xác nhận. KHÔNG mặc nhiên là KPI (§14 "Personal Task không mặc nhiên là KPI").
function createPersonalTask(actingUser, input) {
  const employee = getEmployeeByUserId_(actingUser.UserID);
  if (!employee) throw new Error('Chỉ nhân viên có hồ sơ mới tạo được công việc cá nhân.');
  if (isBlank(input.title)) throw new Error('Thiếu tiêu đề công việc.');

  const task = getSheetRepository(SHEETS.TASKS).append({
    TaskID: generateId('TASK'), Title: input.title, Description: input.description || '',
    DepartmentID: employee.DepartmentID,
    AssignerEmployeeID: employee.EmployeeID, AssigneeEmployeeID: employee.EmployeeID,
    AssignedDate: nowIso(), DueDate: input.dueDate || '',
    Priority: input.priority || 'NORMAL', Progress: 0, Status: 'ASSIGNED',
    Result: '', AttachmentFolderDriveID: '',
    EvaluatorEmployeeID: '', EvaluationScore: '', EvaluationComment: '', EvaluatedAt: '',
    ParentTaskID: '', IsKpiTask: false, BaseValue: 0,
    ComplexityScoresJson: '', ComplexityP: '', ComplexityLevel: '', QualityCoefficient: '',
    SourceType: TASK_SOURCE_TYPES_.PERSONAL, TemplateID: '', Period: '', TransferredFromTaskID: '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'PERSONAL_TASK_CREATED', 'Task', task.TaskID, input.title);
  return task;
}

// Việc TỰ giao cho CHÍNH MÌNH (cá nhân, hoặc định kỳ tự lập) không cần người khác xác nhận — hoàn
// thành thẳng, không qua submitTaskResult -> evaluateTask 2 bước (đúng đặc tả §18 "công việc cá nhân
// đơn thuần có thể không cần workflow"). Việc được NGƯỜI KHÁC giao (kể cả định kỳ do quản lý lập) vẫn
// phải nộp kết quả chờ xác nhận như cũ.
function completeMyTask(actingUser, taskId) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  const employee = requireTaskParty_(task, actingUser, 'AssigneeEmployeeID');
  if (task.AssignerEmployeeID !== task.AssigneeEmployeeID) {
    throw new Error('Công việc do người khác giao phải nộp kết quả để chờ xác nhận, không thể tự đánh dấu hoàn thành.');
  }
  const updated = getSheetRepository(SHEETS.TASKS).updateById('TaskID', taskId, {
    Status: 'EVALUATED', Progress: 100, EvaluatorEmployeeID: employee.EmployeeID, EvaluatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'TASK_EVALUATED', 'Task', taskId, 'Tự hoàn thành (công việc cá nhân)');
  return updated;
}

function cancelTask(actingUser, taskId, reason) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isParty = employee && (task.AssignerEmployeeID === employee.EmployeeID || task.AssigneeEmployeeID === employee.EmployeeID);
  if (!isParty) requirePermission(actingUser, task.DepartmentID, 'CanEdit', 'TASK');
  if (task.Status === 'EVALUATED') throw new Error('Không thể huỷ công việc đã hoàn thành.');

  const updated = getSheetRepository(SHEETS.TASKS).updateById('TaskID', taskId, { Status: 'CANCELLED', UpdatedAt: nowIso() });
  logAudit(actingUser.UserID, 'TASK_CANCELLED', 'Task', taskId, reason || '');
  return updated;
}

// §13 đặc tả bổ sung: "Task Instance quá hạn KHÔNG được tự động gộp vào kỳ sau." Chuyển kỳ là hành
// động THỦ CÔNG, tạo 1 Task MỚI liên kết ngược về Task gốc (TransferredFromTaskID) — Task gốc chuyển
// CANCELLED (không xoá, giữ nguyên lịch sử). Lý do + thời điểm chuyển nằm trong Audit Log.
function transferTaskToNextPeriod(actingUser, taskId, newDueDate, reason) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isParty = employee && (task.AssignerEmployeeID === employee.EmployeeID || task.AssigneeEmployeeID === employee.EmployeeID);
  if (!isParty) requirePermission(actingUser, task.DepartmentID, 'CanEdit', 'TASK');
  if (task.Status === 'EVALUATED' || task.Status === 'CANCELLED') {
    throw new Error('Chỉ chuyển kỳ được công việc chưa hoàn thành.');
  }
  if (isBlank(reason)) throw new Error('Phải nêu lý do chuyển kỳ.');

  const newTask = getSheetRepository(SHEETS.TASKS).append({
    TaskID: generateId('TASK'), Title: task.Title, Description: task.Description, DepartmentID: task.DepartmentID,
    AssignerEmployeeID: task.AssignerEmployeeID, AssigneeEmployeeID: task.AssigneeEmployeeID,
    AssignedDate: nowIso(), DueDate: newDueDate || '',
    Priority: task.Priority, Progress: 0, Status: 'ASSIGNED',
    Result: '', AttachmentFolderDriveID: '',
    EvaluatorEmployeeID: '', EvaluationScore: '', EvaluationComment: '', EvaluatedAt: '',
    ParentTaskID: task.ParentTaskID, IsKpiTask: task.IsKpiTask, BaseValue: task.BaseValue,
    ComplexityScoresJson: '', ComplexityP: '', ComplexityLevel: '', QualityCoefficient: '',
    SourceType: task.SourceType, TemplateID: task.TemplateID, Period: '',
    TransferredFromTaskID: task.TaskID,
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  getSheetRepository(SHEETS.TASKS).updateById('TaskID', taskId, { Status: 'CANCELLED', UpdatedAt: nowIso() });
  logAudit(actingUser.UserID, 'TASK_TRANSFERRED_TO_NEXT_PERIOD', 'Task', taskId, 'Task mới: ' + newTask.TaskID + ' — Lý do: ' + reason);
  return newTask;
}

// --- Nhiều người cùng làm (§11) ---

function addTaskParticipant(actingUser, taskId, input) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isAssigner = employee && task.AssignerEmployeeID === employee.EmployeeID;
  if (!isAssigner) requirePermission(actingUser, task.DepartmentID, 'CanEdit', 'TASK');

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
  if (!isAssigner) requirePermission(actingUser, task.DepartmentID, 'CanEdit', 'TASK');

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
// truy cập, đúng cách listDocumentsByOwner làm trước đây. Tự sinh Task Instance của kỳ hiện tại cho
// các mẫu định kỳ ACTIVE của chính mình trước khi trả kết quả (xem ensureRecurringInstancesForEmployee_
// cuối file) — cách "lười" để có instance đúng hạn mà không cần cài Time-driven Trigger riêng.
function listMyTasks(user) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  ensureRecurringInstancesForEmployee_(employee.EmployeeID);
  return getSheetRepository(SHEETS.TASKS).findAll().filter(function (t) {
    return t.AssigneeEmployeeID === employee.EmployeeID || t.AssignerEmployeeID === employee.EmployeeID;
  }).map(decorateTaskWithComputedFields_);
}

function listTasksByDepartment(user, departmentId) {
  requirePermission(user, departmentId, 'CanView', 'TASK');
  return getSheetRepository(SHEETS.TASKS).findAll().filter(function (t) { return t.DepartmentID === departmentId; }).map(decorateTaskWithComputedFields_);
}

function uploadTaskAttachment(actingUser, taskId, fileName, mimeType, base64Data) {
  const task = getSheetRepository(SHEETS.TASKS).findById('TaskID', taskId);
  if (!task) throw new Error('Không tìm thấy công việc.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  const isParty = employee && (task.AssigneeEmployeeID === employee.EmployeeID || task.AssignerEmployeeID === employee.EmployeeID);
  if (!isParty) requirePermission(actingUser, task.DepartmentID, 'CanEdit', 'TASK');

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

// --- Công việc định kỳ theo chu kỳ (§4-14 đặc tả bổ sung) ---
//
// Template -> Instance: RecurringTaskTemplates lưu QUY TẮC (chu kỳ/deadline/người thực hiện), MỖI lần
// phát sinh là 1 dòng Tasks độc lập (TemplateID trỏ về đây, Period phân biệt từng kỳ) — không sửa 1
// dòng Task duy nhất rồi đổi ngày tháng liên tục (đúng §9).

// Cả người tạo mẫu (thường là quản lý) LẪN chính người thực hiện (tự lập mẫu định kỳ cho bản thân, VD
// "Kiểm tra email — hàng ngày") đều được coi là chủ sở hữu mẫu — khác lập mẫu CHO NGƯỜI KHÁC (cần
// CanCreate theo đúng khoa/phòng của người đó, giống logic assignTask).
function requireTaskTemplateManager_(actingUser, template) {
  const actingEmployee = getEmployeeByUserId_(actingUser.UserID);
  const isOwner = actingEmployee && actingEmployee.EmployeeID === template.AssigneeEmployeeID;
  const isCreator = actingUser.UserID === template.CreatedByUserID;
  if (!isOwner && !isCreator) requirePermission(actingUser, template.DepartmentID, 'CanEdit', 'TASK');
}

function createRecurringTaskTemplate(actingUser, input) {
  if (isBlank(input.title) || isBlank(input.assigneeEmployeeId) || isBlank(input.frequency)) {
    throw new Error('Thiếu tiêu đề, người thực hiện hoặc chu kỳ.');
  }
  if (!TASK_FREQUENCIES_[input.frequency]) throw new Error('Chu kỳ không hợp lệ.');
  const assigneeEmployee = getEmployeeById(input.assigneeEmployeeId);
  if (!assigneeEmployee || assigneeEmployee.Status !== 'Active') {
    throw new Error('Không thể lập mẫu định kỳ cho nhân viên đã nghỉ việc/ngừng hoạt động.');
  }

  const actingEmployee = getEmployeeByUserId_(actingUser.UserID);
  const isSelf = actingEmployee && actingEmployee.EmployeeID === input.assigneeEmployeeId;
  if (!isSelf) requirePermission(actingUser, assigneeEmployee.DepartmentID, 'CanCreate', 'TASK');

  const hasDeadline = !!input.hasDeadline;
  const deadlineType = hasDeadline ? (input.deadlineType || TASK_DEADLINE_TYPES_.NONE) : TASK_DEADLINE_TYPES_.NONE;
  if (hasDeadline && !TASK_DEADLINE_TYPES_[deadlineType]) throw new Error('Loại hạn không hợp lệ.');
  if (hasDeadline && deadlineType !== TASK_DEADLINE_TYPES_.NONE && isBlank(input.deadlineRuleJson)) {
    throw new Error('Thiếu quy tắc tính hạn.');
  }

  const template = getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).append({
    TemplateID: generateId('RTPL'), Title: input.title, Description: input.description || '',
    AssigneeEmployeeID: input.assigneeEmployeeId, DepartmentID: assigneeEmployee.DepartmentID,
    Frequency: input.frequency, EffectiveFrom: input.effectiveFrom || nowIso().slice(0, 10), EffectiveTo: input.effectiveTo || '',
    HasDeadline: hasDeadline, DeadlineType: deadlineType, DeadlineRuleJson: input.deadlineRuleJson || '',
    Priority: input.priority || 'NORMAL', IsKpiTask: false, Status: 'ACTIVE',
    CreatedByUserID: actingUser.UserID, CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'RECURRING_TEMPLATE_CREATED', 'RecurringTaskTemplate', template.TemplateID, input.title);
  return template;
}

// §12: tạm dừng KHÔNG sinh instance mới nhưng KHÔNG xoá instance đã sinh trước đó (chỉ đổi Status ở
// đây — listMyTasks/listTasksByDepartment/ensureRecurringInstancesForEmployee_ không đụng gì tới các
// dòng Tasks đã tồn tại của mẫu này).
function pauseRecurringTaskTemplate(actingUser, templateId) {
  const template = getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).findById('TemplateID', templateId);
  if (!template) throw new Error('Không tìm thấy mẫu công việc định kỳ.');
  requireTaskTemplateManager_(actingUser, template);
  const updated = getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).updateById('TemplateID', templateId, { Status: 'PAUSED', UpdatedAt: nowIso() });
  logAudit(actingUser.UserID, 'RECURRING_TEMPLATE_PAUSED', 'RecurringTaskTemplate', templateId, '');
  return updated;
}

function resumeRecurringTaskTemplate(actingUser, templateId) {
  const template = getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).findById('TemplateID', templateId);
  if (!template) throw new Error('Không tìm thấy mẫu công việc định kỳ.');
  requireTaskTemplateManager_(actingUser, template);
  const updated = getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).updateById('TemplateID', templateId, { Status: 'ACTIVE', UpdatedAt: nowIso() });
  logAudit(actingUser.UserID, 'RECURRING_TEMPLATE_RESUMED', 'RecurringTaskTemplate', templateId, '');
  return updated;
}

function endRecurringTaskTemplate(actingUser, templateId) {
  const template = getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).findById('TemplateID', templateId);
  if (!template) throw new Error('Không tìm thấy mẫu công việc định kỳ.');
  requireTaskTemplateManager_(actingUser, template);
  const updated = getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).updateById('TemplateID', templateId, { Status: 'ENDED', UpdatedAt: nowIso() });
  logAudit(actingUser.UserID, 'RECURRING_TEMPLATE_ENDED', 'RecurringTaskTemplate', templateId, '');
  return updated;
}

function listMyRecurringTaskTemplates(user) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  return getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).findAll().filter(function (t) { return t.AssigneeEmployeeID === employee.EmployeeID; });
}

function listRecurringTaskTemplatesByDepartment(user, departmentId) {
  requirePermission(user, departmentId, 'CanView', 'TASK');
  return getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).findAll().filter(function (t) { return t.DepartmentID === departmentId; });
}

// "Kỳ hiện tại" quy về 1 chuỗi DUY NHẤT mỗi chu kỳ (không cần khớp chuẩn số tuần ISO quốc tế, chỉ cần
// ổn định + duy nhất): DAILY = ngày hôm nay; WEEKLY = ngày Thứ 2 của tuần chứa hôm nay; MONTHLY =
// "YYYY-MM"; QUARTERLY = "YYYY-Qn"; YEARLY = "YYYY".
function computeCurrentPeriodKey_(frequency, todayStr) {
  const parts = todayStr.split('-').map(Number);
  const y = String(parts[0]), m = String(parts[1]).padStart(2, '0'), d = String(parts[2]).padStart(2, '0');
  if (frequency === 'DAILY') return y + '-' + m + '-' + d;
  if (frequency === 'MONTHLY') return y + '-' + m;
  if (frequency === 'QUARTERLY') return y + '-Q' + Math.ceil(parts[1] / 3);
  if (frequency === 'YEARLY') return y;
  if (frequency === 'WEEKLY') {
    const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const dow = dateObj.getUTCDay(); // 0=CN..6=T7
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + diffToMonday));
    return Utilities.formatDate(monday, 'UTC', 'yyyy-MM-dd');
  }
  throw new Error('Chu kỳ không hợp lệ.');
}

function computePeriodStartDate_(frequency, periodKey) {
  if (frequency === 'DAILY' || frequency === 'WEEKLY') return periodKey;
  if (frequency === 'MONTHLY') return periodKey + '-01';
  if (frequency === 'YEARLY') return periodKey + '-01-01';
  if (frequency === 'QUARTERLY') {
    const parts = periodKey.split('-Q');
    const startMonth = (Number(parts[1]) - 1) * 3 + 1;
    return parts[0] + '-' + String(startMonth).padStart(2, '0') + '-01';
  }
  throw new Error('Chu kỳ không hợp lệ.');
}

// RELATIVE: +N ngày kể từ ngày bắt đầu kỳ (đúng ví dụ đặc tả "Chu kỳ Hàng quý, Deadline +7 ngày kể từ
// ngày bắt đầu kỳ"). FIXED: ngày cố định CỦA THÁNG KẾ TIẾP kỳ hiện tại (đúng ví dụ đặc tả "Chu kỳ Hàng
// tháng, Deadline Ngày 05 tháng kế tiếp") — có ý nghĩa rõ nhất với chu kỳ MONTHLY/QUARTERLY/YEARLY.
function computeDeadlineForTemplate_(template, periodStartStr) {
  if (!template.HasDeadline || template.DeadlineType === TASK_DEADLINE_TYPES_.NONE) return '';
  let rule = {};
  try { rule = JSON.parse(template.DeadlineRuleJson || '{}'); } catch (e) { rule = {}; }

  if (template.DeadlineType === TASK_DEADLINE_TYPES_.RELATIVE) {
    return addDaysToDateString_(periodStartStr, Number(rule.daysAfterStart) || 0);
  }
  if (template.DeadlineType === TASK_DEADLINE_TYPES_.FIXED) {
    const dayOfPeriod = Number(rule.dayOfPeriod) || 1;
    const parts = periodStartStr.split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1], dayOfPeriod)); // parts[1] (chưa -1) = tháng kế tiếp
    return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
  }
  return '';
}

// Người tạo mẫu là Assigner của Instance sinh ra — nếu tự lập mẫu cho chính mình thì Assigner=Assignee
// (completeMyTask cho hoàn thành thẳng, không cần xác nhận từ người khác, đúng §18).
function getAssignerEmployeeIdForTemplate_(template) {
  const creatorEmployee = getEmployeeByUserId_(template.CreatedByUserID);
  return creatorEmployee ? creatorEmployee.EmployeeID : template.AssigneeEmployeeID;
}

// Sinh Task Instance cho ĐÚNG kỳ hiện tại nếu chưa có — idempotent (an toàn gọi lại nhiều lần trong
// cùng 1 kỳ, không sinh trùng). CHỈ sinh cho Template đang ACTIVE và trong khoảng hiệu lực. Gọi TỪ
// listMyTasks (cách "lười" — không cần cài Time-driven Trigger riêng). KHÔNG sinh bù các kỳ trong quá
// khứ đã bỏ lỡ (V1 — nếu cần, bổ sung 1 hàm quét toàn viện chạy theo Trigger riêng sau).
function ensureRecurringInstancesForEmployee_(employeeId) {
  const templates = getSheetRepository(SHEETS.RECURRING_TASK_TEMPLATES).findAll().filter(function (t) {
    return t.AssigneeEmployeeID === employeeId && t.Status === 'ACTIVE';
  });
  if (templates.length === 0) return;

  const todayStr = Utilities.formatDate(new Date(), HANOI_TZ_, 'yyyy-MM-dd');
  const existingInstances = getSheetRepository(SHEETS.TASKS).findAll().filter(function (t) {
    return t.AssigneeEmployeeID === employeeId && !isBlank(t.TemplateID);
  });

  templates.forEach(function (template) {
    if (template.EffectiveFrom && todayStr < template.EffectiveFrom) return;
    if (template.EffectiveTo && todayStr > template.EffectiveTo) return;

    const periodKey = computeCurrentPeriodKey_(template.Frequency, todayStr);
    const alreadyExists = existingInstances.some(function (t) { return t.TemplateID === template.TemplateID && t.Period === periodKey; });
    if (alreadyExists) return;

    const periodStart = computePeriodStartDate_(template.Frequency, periodKey);
    const dueDate = computeDeadlineForTemplate_(template, periodStart);

    getSheetRepository(SHEETS.TASKS).append({
      TaskID: generateId('TASK'), Title: template.Title, Description: template.Description,
      DepartmentID: template.DepartmentID,
      AssignerEmployeeID: getAssignerEmployeeIdForTemplate_(template), AssigneeEmployeeID: employeeId,
      AssignedDate: nowIso(), DueDate: dueDate,
      Priority: template.Priority, Progress: 0, Status: 'ASSIGNED',
      Result: '', AttachmentFolderDriveID: '',
      EvaluatorEmployeeID: '', EvaluationScore: '', EvaluationComment: '', EvaluatedAt: '',
      ParentTaskID: '', IsKpiTask: !!template.IsKpiTask, BaseValue: 0,
      ComplexityScoresJson: '', ComplexityP: '', ComplexityLevel: '', QualityCoefficient: '',
      SourceType: TASK_SOURCE_TYPES_.RECURRING, TemplateID: template.TemplateID, Period: periodKey,
      TransferredFromTaskID: '',
      CreatedAt: nowIso(), UpdatedAt: nowIso()
    });
  });
}
