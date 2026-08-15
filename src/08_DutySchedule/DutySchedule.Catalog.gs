// Danh mục Loại trực / Vị trí trực — cấu hình được, không hard-code trong UI (đúng §20-21 đặc tả KPI
// + Quản lý Trực V1). Quản lý bởi SUPER_ADMIN/Phòng KH-NV (đơn vị chủ quản module Lịch trực).

function requireDutyCatalogManager_(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN && actingUser.Role !== ROLE_NAMES.PHONG_KH_NV) {
    throw new Error('Chỉ Quản trị hệ thống hoặc Phòng Kế hoạch – Nghiệp vụ được quản lý danh mục trực.');
  }
}

function createDutyType(actingUser, input) {
  requireDutyCatalogManager_(actingUser);
  if (isBlank(input.dutyTypeName)) throw new Error('Thiếu tên loại trực.');
  const repo = getSheetRepository(SHEETS.DUTY_TYPES);
  const duplicate = repo.findAll().find(function (t) { return t.DutyTypeName === input.dutyTypeName && t.Status === 'Active'; });
  if (duplicate) throw new Error('Loại trực này đã tồn tại.');

  const dutyType = repo.append({
    DutyTypeID: generateId('DTYPE'), DutyTypeName: input.dutyTypeName, Description: input.description || '',
    Status: 'Active', CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_TYPE_CREATED', 'DutyType', dutyType.DutyTypeID, input.dutyTypeName);
  return dutyType;
}

function deactivateDutyType(actingUser, dutyTypeId) {
  requireDutyCatalogManager_(actingUser);
  const updated = getSheetRepository(SHEETS.DUTY_TYPES).updateById('DutyTypeID', dutyTypeId, { Status: 'Inactive', UpdatedAt: nowIso() });
  if (!updated) throw new Error('Không tìm thấy loại trực.');
  logAudit(actingUser.UserID, 'DUTY_TYPE_DEACTIVATED', 'DutyType', dutyTypeId, '');
  return updated;
}

function listActiveDutyTypes() {
  return getSheetRepository(SHEETS.DUTY_TYPES).findAll().filter(function (t) { return t.Status === 'Active'; });
}

function createDutyPosition(actingUser, input) {
  requireDutyCatalogManager_(actingUser);
  if (isBlank(input.positionName)) throw new Error('Thiếu tên vị trí trực.');
  const position = getSheetRepository(SHEETS.DUTY_POSITIONS).append({
    DutyPositionID: generateId('DPOS'), PositionName: input.positionName, EmployeeType: input.employeeType || '',
    IsTruongTruc: !!input.isTruongTruc, Description: input.description || '', Status: 'Active',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_POSITION_CREATED', 'DutyPosition', position.DutyPositionID, input.positionName);
  return position;
}

function deactivateDutyPosition(actingUser, dutyPositionId) {
  requireDutyCatalogManager_(actingUser);
  const updated = getSheetRepository(SHEETS.DUTY_POSITIONS).updateById('DutyPositionID', dutyPositionId, { Status: 'Inactive', UpdatedAt: nowIso() });
  if (!updated) throw new Error('Không tìm thấy vị trí trực.');
  logAudit(actingUser.UserID, 'DUTY_POSITION_DEACTIVATED', 'DutyPosition', dutyPositionId, '');
  return updated;
}

// employeeType rỗng/không truyền = trả về toàn bộ (dùng ở màn quản trị danh mục); có truyền = chỉ vị
// trí áp dụng chung (EmployeeType rỗng) hoặc đúng loại nhân viên đó (dùng khi xếp trực cho 1 nhân viên
// cụ thể, đúng §21 "vị trí LĐ chỉ dành Bác sĩ").
function listActiveDutyPositions(employeeType) {
  const positions = getSheetRepository(SHEETS.DUTY_POSITIONS).findAll().filter(function (p) { return p.Status === 'Active'; });
  if (!employeeType) return positions;
  return positions.filter(function (p) { return isBlank(p.EmployeeType) || p.EmployeeType === employeeType; });
}
