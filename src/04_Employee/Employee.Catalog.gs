// Danh mục Chức danh (chuyên môn) / Chức vụ (quản lý) — đúng đặc tả Tái cấu trúc Nhân sự V1 §14
// "không để nhập tự do tuỳ ý nếu có thể dùng danh mục thống nhất". Cùng pattern
// DutySchedule.Catalog.gs (DutyTypes/DutyPositions) — quản lý bởi SUPER_ADMIN/Phòng TC-HC (đơn vị chủ
// quản hồ sơ nhân sự, xem Employee.Service.gs#requireEmployeeManager_).

function createPosition(actingUser, input) {
  requireEmployeeManager_(actingUser);
  if (isBlank(input.positionName)) throw new Error('Thiếu tên chức danh.');
  const repo = getSheetRepository(SHEETS.POSITIONS);
  const duplicate = repo.findAll().find(function (p) { return p.PositionName === input.positionName && p.Status === 'Active'; });
  if (duplicate) throw new Error('Chức danh này đã tồn tại.');

  const position = repo.append({
    PositionID: generateId('POS'), PositionName: input.positionName, Description: input.description || '',
    Status: 'Active', CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'POSITION_CREATED', 'Position', position.PositionID, input.positionName);
  return position;
}

function deactivatePosition(actingUser, positionId) {
  requireEmployeeManager_(actingUser);
  const updated = getSheetRepository(SHEETS.POSITIONS).updateById('PositionID', positionId, { Status: 'Inactive', UpdatedAt: nowIso() });
  if (!updated) throw new Error('Không tìm thấy chức danh.');
  logAudit(actingUser.UserID, 'POSITION_DEACTIVATED', 'Position', positionId, '');
  return updated;
}

function listActivePositions() {
  return getSheetRepository(SHEETS.POSITIONS).findAll().filter(function (p) { return p.Status === 'Active'; });
}

function createJobTitle(actingUser, input) {
  requireEmployeeManager_(actingUser);
  if (isBlank(input.jobTitleName)) throw new Error('Thiếu tên chức vụ.');
  const repo = getSheetRepository(SHEETS.JOB_TITLES);
  const duplicate = repo.findAll().find(function (j) { return j.JobTitleName === input.jobTitleName && j.Status === 'Active'; });
  if (duplicate) throw new Error('Chức vụ này đã tồn tại.');

  const jobTitle = repo.append({
    JobTitleID: generateId('JT'), JobTitleName: input.jobTitleName, Description: input.description || '',
    Status: 'Active', CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'JOB_TITLE_CREATED', 'JobTitle', jobTitle.JobTitleID, input.jobTitleName);
  return jobTitle;
}

function deactivateJobTitle(actingUser, jobTitleId) {
  requireEmployeeManager_(actingUser);
  const updated = getSheetRepository(SHEETS.JOB_TITLES).updateById('JobTitleID', jobTitleId, { Status: 'Inactive', UpdatedAt: nowIso() });
  if (!updated) throw new Error('Không tìm thấy chức vụ.');
  logAudit(actingUser.UserID, 'JOB_TITLE_DEACTIVATED', 'JobTitle', jobTitleId, '');
  return updated;
}

function listActiveJobTitles() {
  return getSheetRepository(SHEETS.JOB_TITLES).findAll().filter(function (j) { return j.Status === 'Active'; });
}
