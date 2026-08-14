// Phân công khối lâm sàng/cận lâm sàng — lịch làm việc/khám/điều trị/hội chẩn/phẫu thuật/thủ thuật
// thường ngày. Cố tình tối giản (không có quy trình duyệt/công bố riêng) — KHÁC Lịch trực
// (DutySchedule), vốn là lịch TRỰC có quy trình Khoa đề xuất -> Phòng KH-NV duyệt -> công bố.

function hasOverlappingAssignment_(employeeId, assignmentDate, shiftStart, shiftEnd, excludeAssignmentId) {
  return getSheetRepository(SHEETS.CLINICAL_ASSIGNMENTS).findAll().some(function (a) {
    if (a.Status === 'DELETED' || a.AssignmentID === excludeAssignmentId) return false;
    if (a.EmployeeID !== employeeId || a.AssignmentDate !== assignmentDate) return false;
    return shiftStart < a.ShiftEnd && a.ShiftStart < shiftEnd;
  });
}

function createClinicalAssignment(actingUser, input) {
  requirePermission(actingUser, input.departmentId, 'CanCreate');
  if (isBlank(input.employeeId) || isBlank(input.assignmentDate) || isBlank(input.workType)) {
    throw new Error('Thiếu nhân viên, ngày phân công hoặc loại công việc.');
  }
  const employee = getEmployeeById(input.employeeId);
  if (!employee || employee.Status !== 'Active') {
    throw new Error('Không thể phân công cho nhân viên đã nghỉ việc/ngừng hoạt động.');
  }
  if (hasOverlappingAssignment_(input.employeeId, input.assignmentDate, input.shiftStart || '', input.shiftEnd || '', null)) {
    throw new Error('Nhân viên đã có phân công trùng thời gian trong ngày này.');
  }

  const assignment = getSheetRepository(SHEETS.CLINICAL_ASSIGNMENTS).append({
    AssignmentID: generateId('CASG'),
    EmployeeID: input.employeeId,
    DepartmentID: input.departmentId,
    AssignmentDate: input.assignmentDate,
    WorkType: input.workType,
    ShiftStart: input.shiftStart || '',
    ShiftEnd: input.shiftEnd || '',
    AssignedByUserID: actingUser.UserID,
    Status: 'Active',
    Notes: input.notes || '',
    CreatedAt: nowIso(),
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'CLINICAL_ASSIGNMENT_CREATED', 'ClinicalAssignment', assignment.AssignmentID, input.workType);
  return assignment;
}

function updateClinicalAssignment(actingUser, assignmentId, patch) {
  const assignment = getSheetRepository(SHEETS.CLINICAL_ASSIGNMENTS).findById('AssignmentID', assignmentId);
  if (!assignment) throw new Error('Không tìm thấy phân công.');
  requirePermission(actingUser, assignment.DepartmentID, 'CanEdit');

  const updated = getSheetRepository(SHEETS.CLINICAL_ASSIGNMENTS).updateById('AssignmentID', assignmentId, Object.assign({}, patch, { UpdatedAt: nowIso() }));
  logAudit(actingUser.UserID, 'CLINICAL_ASSIGNMENT_UPDATED', 'ClinicalAssignment', assignmentId, JSON.stringify(patch));
  return updated;
}

function deleteClinicalAssignment(actingUser, assignmentId) {
  const assignment = getSheetRepository(SHEETS.CLINICAL_ASSIGNMENTS).findById('AssignmentID', assignmentId);
  if (!assignment) throw new Error('Không tìm thấy phân công.');
  requirePermission(actingUser, assignment.DepartmentID, 'CanDelete');

  getSheetRepository(SHEETS.CLINICAL_ASSIGNMENTS).updateById('AssignmentID', assignmentId, { Status: 'DELETED', UpdatedAt: nowIso() });
  logAudit(actingUser.UserID, 'CLINICAL_ASSIGNMENT_DELETED', 'ClinicalAssignment', assignmentId, '');
  return { success: true };
}

function listClinicalAssignmentsByDepartment(user, departmentId, dateFrom, dateTo) {
  requirePermission(user, departmentId, 'CanView');
  return getSheetRepository(SHEETS.CLINICAL_ASSIGNMENTS).findAll().filter(function (a) {
    if (a.Status === 'DELETED' || a.DepartmentID !== departmentId) return false;
    if (dateFrom && a.AssignmentDate < dateFrom) return false;
    if (dateTo && a.AssignmentDate > dateTo) return false;
    return true;
  });
}

function listMyClinicalAssignments(user, dateFrom, dateTo) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  return getSheetRepository(SHEETS.CLINICAL_ASSIGNMENTS).findAll().filter(function (a) {
    if (a.Status === 'DELETED' || a.EmployeeID !== employee.EmployeeID) return false;
    if (dateFrom && a.AssignmentDate < dateFrom) return false;
    if (dateTo && a.AssignmentDate > dateTo) return false;
    return true;
  });
}
