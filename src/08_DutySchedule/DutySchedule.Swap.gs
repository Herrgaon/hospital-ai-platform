// Đổi trực — sub-workflow riêng cho ca trực ĐÃ CÔNG BỐ (OFFICIAL). Không sửa trực tiếp DutyShifts,
// đi qua chuỗi xác nhận: nhân viên đề nghị -> người thay thế xác nhận -> trưởng khoa xác nhận ->
// Phòng KH-NV duyệt -> tạo ca trực mới + đánh dấu ca cũ SWAPPED_OUT. Lịch sử đầy đủ suy ra được từ
// OriginalShiftID (lịch ban đầu) + NewShiftID (lịch sau thay đổi), không cần snapshot JSON.

function requestSwap(actingUser, input) {
  const shift = getSheetRepository(SHEETS.DUTY_SHIFTS).findById('DutyShiftID', input.originalShiftId);
  if (!shift) throw new Error('Không tìm thấy ca trực.');
  if (shift.Status !== 'OFFICIAL') throw new Error('Chỉ có thể đổi trực đối với ca trực đã công bố chính thức.');

  const requestingEmployee = getEmployeeByUserId_(actingUser.UserID);
  if (!requestingEmployee || shift.EmployeeID !== requestingEmployee.EmployeeID) {
    throw new Error('Bạn không phải người trực ca này.');
  }
  const replacementEmployee = getEmployeeById(input.replacementEmployeeId);
  if (!replacementEmployee || replacementEmployee.Status !== 'Active') {
    throw new Error('Người thay thế không hợp lệ hoặc đã ngừng hoạt động.');
  }
  if (hasOverlappingShift_(input.replacementEmployeeId, shift.ShiftDate, shift.ShiftStart, shift.ShiftEnd, shift.DutyShiftID)) {
    throw new Error('Người thay thế đã có ca trực trùng thời gian trong ngày này.');
  }

  const swapRequest = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).append({
    SwapRequestID: generateId('SWAP'),
    OriginalShiftID: input.originalShiftId,
    RequestingEmployeeID: requestingEmployee.EmployeeID,
    ReplacementEmployeeID: input.replacementEmployeeId,
    Reason: input.reason || '',
    Status: 'REQUESTED',
    RequestedAt: nowIso(), ReplacementConfirmedAt: '',
    DeptHeadConfirmedByUserID: '', DeptHeadConfirmedAt: '',
    KhNvApprovedByUserID: '', KhNvApprovedAt: '', NewShiftID: '',
    RejectedByUserID: '', RejectedAt: '', RejectionReason: '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SWAP_REQUESTED', 'DutySwapRequest', swapRequest.SwapRequestID, shift.ShiftDate);
  notifyUser(replacementEmployee.UserID, 'Đề nghị đổi trực ngày ' + shift.ShiftDate, 'Lý do: ' + (input.reason || ''));
  return swapRequest;
}

function confirmSwapByReplacement(actingUser, swapRequestId) {
  const swapRequest = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).findById('SwapRequestID', swapRequestId);
  if (!swapRequest) throw new Error('Không tìm thấy yêu cầu đổi trực.');
  if (swapRequest.Status !== 'REQUESTED') throw new Error('Yêu cầu đổi trực không ở trạng thái chờ người thay thế xác nhận.');
  const employee = getEmployeeByUserId_(actingUser.UserID);
  if (!employee || swapRequest.ReplacementEmployeeID !== employee.EmployeeID) {
    throw new Error('Bạn không phải người được đề nghị thay thế.');
  }

  const updated = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).updateById('SwapRequestID', swapRequestId, {
    Status: 'REPLACEMENT_CONFIRMED', ReplacementConfirmedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SWAP_CONFIRMED', 'DutySwapRequest', swapRequestId, '');
  return updated;
}

function confirmSwapByDeptHead(actingUser, swapRequestId) {
  const swapRequest = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).findById('SwapRequestID', swapRequestId);
  if (!swapRequest) throw new Error('Không tìm thấy yêu cầu đổi trực.');
  const shift = getSheetRepository(SHEETS.DUTY_SHIFTS).findById('DutyShiftID', swapRequest.OriginalShiftID);
  requirePermission(actingUser, shift.DepartmentID, 'CanApprove');
  if (swapRequest.Status !== 'REPLACEMENT_CONFIRMED') throw new Error('Yêu cầu đổi trực chưa được người thay thế xác nhận.');

  const updated = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).updateById('SwapRequestID', swapRequestId, {
    Status: 'DEPT_HEAD_CONFIRMED', DeptHeadConfirmedByUserID: actingUser.UserID, DeptHeadConfirmedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SWAP_DEPTHEAD_CONFIRMED', 'DutySwapRequest', swapRequestId, '');
  return updated;
}

// Phòng KH-NV luôn là bước duyệt cuối cùng (đơn giản hoá "duyệt nếu thuộc thẩm quyền" — xem quyết
// định trong kế hoạch triển khai). requirePermission(actingUser, '*', 'CanApprove') khớp đúng dòng
// Permissions phạm vi toàn viện của PHONG_KH_NV.
function approveSwapByKhNv(actingUser, swapRequestId) {
  const swapRequest = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).findById('SwapRequestID', swapRequestId);
  if (!swapRequest) throw new Error('Không tìm thấy yêu cầu đổi trực.');
  requirePermission(actingUser, '*', 'CanApprove');
  if (swapRequest.Status !== 'DEPT_HEAD_CONFIRMED') throw new Error('Yêu cầu đổi trực chưa được trưởng khoa xác nhận.');

  const originalShift = getSheetRepository(SHEETS.DUTY_SHIFTS).findById('DutyShiftID', swapRequest.OriginalShiftID);
  getSheetRepository(SHEETS.DUTY_SHIFTS).updateById('DutyShiftID', originalShift.DutyShiftID, { Status: 'SWAPPED_OUT', UpdatedAt: nowIso() });

  const newShift = getSheetRepository(SHEETS.DUTY_SHIFTS).append({
    DutyShiftID: generateId('DSHF'),
    DutyScheduleID: originalShift.DutyScheduleID,
    DepartmentID: originalShift.DepartmentID,
    ShiftDate: originalShift.ShiftDate,
    DutyType: originalShift.DutyType,
    EmployeeID: swapRequest.ReplacementEmployeeID,
    RoleInShift: originalShift.RoleInShift,
    ShiftStart: originalShift.ShiftStart,
    ShiftEnd: originalShift.ShiftEnd,
    AssignedByUserID: actingUser.UserID,
    Status: 'OFFICIAL',
    OriginatingSwapRequestID: swapRequestId,
    Notes: originalShift.Notes,
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });

  const updated = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).updateById('SwapRequestID', swapRequestId, {
    Status: 'KHNV_APPROVED', KhNvApprovedByUserID: actingUser.UserID, KhNvApprovedAt: nowIso(), NewShiftID: newShift.DutyShiftID, UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SWAP_APPROVED', 'DutySwapRequest', swapRequestId, 'Ca trực mới: ' + newShift.DutyShiftID);

  const requestingEmployee = getEmployeeById(swapRequest.RequestingEmployeeID);
  const replacementEmployee = getEmployeeById(swapRequest.ReplacementEmployeeID);
  if (requestingEmployee) notifyUser(requestingEmployee.UserID, 'Đổi trực đã được duyệt', 'Ca trực ngày ' + originalShift.ShiftDate + ' đã được chuyển.');
  if (replacementEmployee) notifyUser(replacementEmployee.UserID, 'Đổi trực đã được duyệt', 'Bạn sẽ trực thay ngày ' + originalShift.ShiftDate + '.');
  return updated;
}

function rejectSwap(actingUser, swapRequestId, reason) {
  const swapRequest = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).findById('SwapRequestID', swapRequestId);
  if (!swapRequest) throw new Error('Không tìm thấy yêu cầu đổi trực.');
  if (['REQUESTED', 'REPLACEMENT_CONFIRMED', 'DEPT_HEAD_CONFIRMED'].indexOf(swapRequest.Status) === -1) {
    throw new Error('Yêu cầu đổi trực này không còn ở trạng thái có thể từ chối.');
  }
  const shift = getSheetRepository(SHEETS.DUTY_SHIFTS).findById('DutyShiftID', swapRequest.OriginalShiftID);
  requirePermission(actingUser, shift.DepartmentID, 'CanReject');

  const updated = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).updateById('SwapRequestID', swapRequestId, {
    Status: 'REJECTED', RejectedByUserID: actingUser.UserID, RejectedAt: nowIso(), RejectionReason: reason || '', UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'DUTY_SWAP_REJECTED', 'DutySwapRequest', swapRequestId, reason || '');
  return updated;
}

function listMySwapRequests(user) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  return getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).findAll().filter(function (r) {
    return r.RequestingEmployeeID === employee.EmployeeID || r.ReplacementEmployeeID === employee.EmployeeID;
  });
}

function listPendingSwapConfirmations(user) {
  const employee = getEmployeeByUserId_(user.UserID);
  const pending = getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).findAll().filter(function (r) {
    if (employee && r.Status === 'REQUESTED' && r.ReplacementEmployeeID === employee.EmployeeID) return true;
    if (r.Status === 'REPLACEMENT_CONFIRMED' && hasPermission(user, getShiftDepartment_(r.OriginalShiftID), 'CanApprove')) return true;
    if (r.Status === 'DEPT_HEAD_CONFIRMED' && hasPermission(user, '*', 'CanApprove')) return true;
    return false;
  });
  return pending;
}

function getShiftDepartment_(dutyShiftId) {
  const shift = getSheetRepository(SHEETS.DUTY_SHIFTS).findById('DutyShiftID', dutyShiftId);
  return shift ? shift.DepartmentID : '*';
}

// Duyệt "lịch sử đổi trực" cho 1 ca ban đầu — theo chuỗi OriginatingSwapRequestID để dựng chuỗi
// trước/sau, phục vụ màn xem lịch sử thay đổi của Trưởng khoa/Phòng KH-NV.
function listSwapHistoryForShift(originalShiftId) {
  return getSheetRepository(SHEETS.DUTY_SWAP_REQUESTS).findAll().filter(function (r) {
    return r.OriginalShiftID === originalShiftId;
  });
}
