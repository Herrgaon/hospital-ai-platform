// Làm ngoài giờ theo ca trực — đúng §30-36 đặc tả KPI + Quản lý Trực & Làm ngoài giờ V1. Tách khỏi
// lịch trực VÀ khỏi Overtime (Làm thêm giờ tự đề nghị, xem Overtime.Service.gs) — đúng §17 "3 loại dữ
// liệu phải tách riêng, không gộp thành 1 bảng".
//
// Quyền lập/sửa danh sách KHÔNG qua Permissions sheet — Trưởng trực được cấp TẠM THỜI theo đúng ca
// đang trực (requireTruongTrucForShift_, DutySchedule.RoleGrant.gs), tự hết hiệu lực khi hết ca, đúng
// §31/§39 "Không cấp quyền Trưởng trực thủ công nếu quyền có thể sinh từ lịch."
//
// Trạng thái: DRAFT -> SUBMITTED -> KHNV_RECEIVED -> UNDER_REVIEW -> (NEED_REVISION -> DRAFT lại) ->
// FINALIZED. Sau FINALIZED không sửa trực tiếp (§35) — muốn sửa phải qua yêu cầu/duyệt mở khoá (§36).

const OVERTIME_LIST_EDITABLE_STATUSES_ = ['DRAFT', 'NEED_REVISION'];

function requireOvertimeListEditable_(list) {
  if (OVERTIME_LIST_EDITABLE_STATUSES_.indexOf(list.Status) === -1) {
    throw new Error('Chỉ có thể sửa danh sách làm ngoài giờ đang ở trạng thái Nháp hoặc Yêu cầu bổ sung.');
  }
}

function requireOwnsOvertimeList_(actingUser, list) {
  if (list.SubmittedByUserID !== actingUser.UserID) {
    throw new Error('Bạn không phải người lập danh sách làm ngoài giờ này.');
  }
}

// §34: cảnh báo KHÔNG chặn thao tác, không tự kết luận có được thanh toán hay không — chỉ để KH-NV/
// Trưởng trực tự cân nhắc. Phủ 2 loại khả thi với dữ liệu hiện có: nhân viên đã có lịch trực trùng giờ
// (dùng lại hasOverlappingShift_ — DutySchedule.Service.gs), và trùng giờ NGAY TRONG danh sách này.
function getOvertimeListItemWarnings_(item, siblingItems) {
  const warnings = [];
  if (hasOverlappingShift_(item.EmployeeID, item.WorkDate, item.StartTime, item.EndTime, null)) {
    warnings.push({ type: 'EMPLOYEE_ALREADY_ON_DUTY', message: 'Nhân viên đã có lịch trực trùng thời gian này.' });
  }
  const overlapsSibling = siblingItems.some(function (other) {
    if (other.OvertimeListItemID === item.OvertimeListItemID) return false;
    if (other.EmployeeID !== item.EmployeeID || other.WorkDate !== item.WorkDate) return false;
    return item.StartTime < other.EndTime && other.StartTime < item.EndTime;
  });
  if (overlapsSibling) {
    warnings.push({ type: 'TIME_OVERLAP_IN_LIST', message: 'Nhân viên có 2 dòng làm ngoài giờ trùng thời gian trong cùng danh sách.' });
  }
  return warnings;
}

// dutyShiftId phải là ca CHÍNH THỨC mà actingUser đang giữ vai trò Trưởng trực NGAY TẠI THỜI ĐIỂM gọi
// (requireTruongTrucForShift_ tự kiểm tra cả sở hữu, vai trò, trạng thái ca, và cửa sổ thời gian).
function createOvertimeList(actingUser, dutyShiftId) {
  const shift = requireTruongTrucForShift_(actingUser, dutyShiftId);

  const duplicate = getSheetRepository(SHEETS.OVERTIME_LISTS).findAll().find(function (l) { return l.DutyShiftID === dutyShiftId; });
  if (duplicate) return duplicate;

  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).append({
    OvertimeListID: generateId('OTL'),
    DutyShiftID: dutyShiftId,
    DepartmentID: shift.DepartmentID,
    SubmittedByUserID: actingUser.UserID,
    Status: 'DRAFT',
    SubmittedAt: '', ReceivedByUserID: '', ReceivedAt: '', ReviewComment: '',
    FinalizedByUserID: '', FinalizedAt: '',
    UnlockRequestedByUserID: '', UnlockRequestedAt: '', UnlockReason: '', UnlockedByUserID: '', UnlockedAt: '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_LIST_CREATED', 'OvertimeList', list.OvertimeListID, dutyShiftId);
  return list;
}

function addOvertimeListItem(actingUser, overtimeListId, input) {
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', overtimeListId);
  if (!list) throw new Error('Không tìm thấy danh sách làm ngoài giờ.');
  requireOwnsOvertimeList_(actingUser, list);
  requireOvertimeListEditable_(list);

  const employee = getEmployeeById(input.employeeId);
  if (!employee || employee.Status !== 'Active') {
    throw new Error('Không thể thêm nhân viên đã nghỉ việc/ngừng hoạt động vào danh sách làm ngoài giờ.');
  }
  if (isBlank(input.workDate) || isBlank(input.startTime) || isBlank(input.endTime)) {
    throw new Error('Thiếu ngày hoặc thời gian làm ngoài giờ.');
  }

  const item = getSheetRepository(SHEETS.OVERTIME_LIST_ITEMS).append({
    OvertimeListItemID: generateId('OTLI'),
    OvertimeListID: overtimeListId,
    EmployeeID: input.employeeId,
    DepartmentID: employee.DepartmentID,
    WorkDate: input.workDate,
    StartTime: input.startTime,
    EndTime: input.endTime,
    WorkDescription: input.workDescription || '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_LIST_ITEM_ADDED', 'OvertimeListItem', item.OvertimeListItemID, overtimeListId);
  return item;
}

function updateOvertimeListItem(actingUser, overtimeListItemId, patch) {
  const item = getSheetRepository(SHEETS.OVERTIME_LIST_ITEMS).findById('OvertimeListItemID', overtimeListItemId);
  if (!item) throw new Error('Không tìm thấy dòng làm ngoài giờ.');
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', item.OvertimeListID);
  requireOwnsOvertimeList_(actingUser, list);
  requireOvertimeListEditable_(list);

  const updated = getSheetRepository(SHEETS.OVERTIME_LIST_ITEMS).updateById('OvertimeListItemID', overtimeListItemId, Object.assign({}, patch, { UpdatedAt: nowIso() }));
  logAudit(actingUser.UserID, 'OVERTIME_LIST_ITEM_UPDATED', 'OvertimeListItem', overtimeListItemId, JSON.stringify(patch));
  return updated;
}

function removeOvertimeListItem(actingUser, overtimeListItemId) {
  const item = getSheetRepository(SHEETS.OVERTIME_LIST_ITEMS).findById('OvertimeListItemID', overtimeListItemId);
  if (!item) throw new Error('Không tìm thấy dòng làm ngoài giờ.');
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', item.OvertimeListID);
  requireOwnsOvertimeList_(actingUser, list);
  requireOvertimeListEditable_(list);

  const repo = getSheetRepository(SHEETS.OVERTIME_LIST_ITEMS);
  const ss = getSystemSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.OVERTIME_LIST_ITEMS);
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf('OvertimeListItemID');
  for (let r = data.length - 1; r >= 1; r--) {
    if (data[r][idIdx] === overtimeListItemId) { sheet.deleteRow(r + 1); break; }
  }
  logAudit(actingUser.UserID, 'OVERTIME_LIST_ITEM_REMOVED', 'OvertimeListItem', overtimeListItemId, '');
  return { success: true };
}

function listOvertimeListItems_(overtimeListId) {
  return getSheetRepository(SHEETS.OVERTIME_LIST_ITEMS).findAll().filter(function (i) { return i.OvertimeListID === overtimeListId; });
}

function getOvertimeListDetail(user, overtimeListId) {
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', overtimeListId);
  if (!list) throw new Error('Không tìm thấy danh sách làm ngoài giờ.');
  if (list.SubmittedByUserID !== user.UserID) requirePermission(user, list.DepartmentID, 'CanView');

  const items = listOvertimeListItems_(overtimeListId);
  const warnings = {};
  items.forEach(function (item) { warnings[item.OvertimeListItemID] = getOvertimeListItemWarnings_(item, items); });
  return { list: list, items: items, warnings: warnings };
}

function listMyOvertimeLists(user) {
  return getSheetRepository(SHEETS.OVERTIME_LISTS).findAll().filter(function (l) { return l.SubmittedByUserID === user.UserID; });
}

// Phòng KH-NV/SUPER_ADMIN xem toàn viện (phạm vi '*') — đúng vai trò "MANAGE_ALL_DUTY/REVIEW_OVERTIME"
// đề xuất ở §32.
function listPendingOvertimeListsForKhNv(user) {
  requirePermission(user, '*', 'CanApprove');
  return getSheetRepository(SHEETS.OVERTIME_LISTS).findAll().filter(function (l) {
    return ['SUBMITTED', 'KHNV_RECEIVED', 'UNDER_REVIEW'].indexOf(l.Status) !== -1;
  });
}

function submitOvertimeList(actingUser, overtimeListId) {
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', overtimeListId);
  if (!list) throw new Error('Không tìm thấy danh sách làm ngoài giờ.');
  requireOwnsOvertimeList_(actingUser, list);
  requireOvertimeListEditable_(list);
  if (listOvertimeListItems_(overtimeListId).length === 0) {
    throw new Error('Danh sách chưa có nhân viên nào, không thể gửi.');
  }

  const updated = getSheetRepository(SHEETS.OVERTIME_LISTS).updateById('OvertimeListID', overtimeListId, {
    Status: 'SUBMITTED', SubmittedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_LIST_SUBMITTED', 'OvertimeList', overtimeListId, '');
  return updated;
}

function receiveOvertimeList(actingUser, overtimeListId) {
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', overtimeListId);
  if (!list) throw new Error('Không tìm thấy danh sách làm ngoài giờ.');
  requirePermission(actingUser, list.DepartmentID, 'CanApprove');
  if (list.Status !== 'SUBMITTED') throw new Error('Chỉ có thể tiếp nhận danh sách đang ở trạng thái Đã gửi.');

  const updated = getSheetRepository(SHEETS.OVERTIME_LISTS).updateById('OvertimeListID', overtimeListId, {
    Status: 'KHNV_RECEIVED', ReceivedByUserID: actingUser.UserID, ReceivedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_LIST_RECEIVED', 'OvertimeList', overtimeListId, '');
  return updated;
}

function markOvertimeListUnderReview(actingUser, overtimeListId) {
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', overtimeListId);
  if (!list) throw new Error('Không tìm thấy danh sách làm ngoài giờ.');
  requirePermission(actingUser, list.DepartmentID, 'CanApprove');
  if (list.Status !== 'KHNV_RECEIVED') throw new Error('Chỉ có thể bắt đầu kiểm tra danh sách đã tiếp nhận.');

  const updated = getSheetRepository(SHEETS.OVERTIME_LISTS).updateById('OvertimeListID', overtimeListId, {
    Status: 'UNDER_REVIEW', UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_LIST_REVIEW_STARTED', 'OvertimeList', overtimeListId, '');
  return updated;
}

function requestOvertimeListRevision(actingUser, overtimeListId, reason) {
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', overtimeListId);
  if (!list) throw new Error('Không tìm thấy danh sách làm ngoài giờ.');
  requirePermission(actingUser, list.DepartmentID, 'CanReject');
  if (['SUBMITTED', 'KHNV_RECEIVED', 'UNDER_REVIEW'].indexOf(list.Status) === -1) {
    throw new Error('Chỉ có thể yêu cầu bổ sung danh sách đang chờ xử lý.');
  }

  const updated = getSheetRepository(SHEETS.OVERTIME_LISTS).updateById('OvertimeListID', overtimeListId, {
    Status: 'NEED_REVISION', ReviewComment: reason || '', UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_LIST_REVISION_REQUESTED', 'OvertimeList', overtimeListId, reason || '');
  notifyUser(list.SubmittedByUserID, 'Danh sách làm ngoài giờ cần bổ sung', reason || '');
  return updated;
}

function finalizeOvertimeList(actingUser, overtimeListId) {
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', overtimeListId);
  if (!list) throw new Error('Không tìm thấy danh sách làm ngoài giờ.');
  requirePermission(actingUser, list.DepartmentID, 'CanApprove');
  if (list.Status !== 'UNDER_REVIEW') throw new Error('Chỉ có thể chốt danh sách đang được kiểm tra.');

  const updated = getSheetRepository(SHEETS.OVERTIME_LISTS).updateById('OvertimeListID', overtimeListId, {
    Status: 'FINALIZED', FinalizedByUserID: actingUser.UserID, FinalizedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_LIST_FINALIZED', 'OvertimeList', overtimeListId, '');
  return updated;
}

// §36: sau khi chốt, muốn sửa phải qua yêu cầu mở khoá + người có thẩm quyền duyệt, có Audit Log đầy
// đủ — không tự động khoá theo thời hạn (chưa có giá trị cấu hình được phê duyệt).
function requestOvertimeListUnlock(actingUser, overtimeListId, reason) {
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', overtimeListId);
  if (!list) throw new Error('Không tìm thấy danh sách làm ngoài giờ.');
  requireOwnsOvertimeList_(actingUser, list);
  if (list.Status !== 'FINALIZED') throw new Error('Chỉ có thể yêu cầu mở khoá danh sách đã chốt.');
  if (isBlank(reason)) throw new Error('Phải nêu lý do yêu cầu mở khoá.');

  const updated = getSheetRepository(SHEETS.OVERTIME_LISTS).updateById('OvertimeListID', overtimeListId, {
    UnlockRequestedByUserID: actingUser.UserID, UnlockRequestedAt: nowIso(), UnlockReason: reason, UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_LIST_UNLOCK_REQUESTED', 'OvertimeList', overtimeListId, reason);
  return updated;
}

function approveOvertimeListUnlock(actingUser, overtimeListId) {
  const list = getSheetRepository(SHEETS.OVERTIME_LISTS).findById('OvertimeListID', overtimeListId);
  if (!list) throw new Error('Không tìm thấy danh sách làm ngoài giờ.');
  requirePermission(actingUser, list.DepartmentID, 'CanApprove');
  if (list.Status !== 'FINALIZED') throw new Error('Danh sách này chưa ở trạng thái đã chốt.');
  if (isBlank(list.UnlockRequestedAt)) throw new Error('Chưa có yêu cầu mở khoá nào đang chờ.');

  const updated = getSheetRepository(SHEETS.OVERTIME_LISTS).updateById('OvertimeListID', overtimeListId, {
    Status: 'NEED_REVISION', UnlockedByUserID: actingUser.UserID, UnlockedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'OVERTIME_LIST_UNLOCKED', 'OvertimeList', overtimeListId, list.UnlockReason || '');
  notifyUser(list.SubmittedByUserID, 'Danh sách làm ngoài giờ đã được mở khoá để chỉnh sửa', list.UnlockReason || '');
  return updated;
}
