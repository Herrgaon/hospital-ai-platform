// Gateway RPC-over-POST — lối vào thứ 2 của CÙNG project này, dành cho client không có phiên Google
// sẵn (Desktop App). GAS Web App (trình duyệt) tiếp tục dùng google.script.run + Core.Api.gs như cũ,
// KHÔNG đổi gì — xem báo cáo thẩm định kiến trúc mục "Kiến trúc sau review": không dựng 2 Apps Script
// project gọi nhau, chỉ thêm 1 lối vào HTTP/JSON cho cùng 1 tầng nghiệp vụ.
//
// Dùng RPC-over-POST ({action, params, token}) thay vì REST path thuần — Apps Script Web App chỉ có
// doGet/doPost, không có PUT/DELETE thật, và pathInfo dễ vỡ khi client tự ý thêm/bớt dấu "/". 1 bảng
// dispatch theo tên action, ánh xạ thẳng tới đúng hàm Service đã có (không đi qua các hàm api_* của
// Core.Api.gs, vì các hàm đó hard-code getCurrentUser() theo phiên Google — không dùng được ở đây).

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const params = body.params || {};

    if (action === 'auth.login') {
      return gatewayJsonResponse_({ success: true, data: authenticateWithPassword(params.username, params.password) });
    }
    if (action === 'auth.logout') {
      return gatewayJsonResponse_({ success: true, data: logoutWithToken(body.token) });
    }

    const user = verifyAccessToken_(body.token);
    const handler = GATEWAY_ACTIONS_[action];
    if (!handler) {
      return gatewayJsonResponse_({ success: false, error: 'UNKNOWN_ACTION', message: 'Hành động không hợp lệ: ' + action });
    }

    return gatewayJsonResponse_({ success: true, data: handler(user, params) });
  } catch (err) {
    // Luôn trả JSON có cấu trúc dù lỗi gì xảy ra — mặc định Apps Script có thể trả trang lỗi HTML cho
    // exception không bắt, Desktop sẽ không parse được nếu bỏ qua bước này.
    return gatewayJsonResponse_({ success: false, error: 'ERROR', message: err.message });
  }
}

function gatewayJsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Bảng dispatch — mỗi entry là 1 adapter mỏng gọi thẳng hàm Service tương ứng (không có logic nghiệp
// vụ ở đây). Chỉ phủ các hành động Giai đoạn 1 (Employee/Department/Task/ClinicalAssignment/
// DutySchedule/DutySwap) — hành động quản trị hệ thống (AI config, sync schema, audit log) chưa cần
// cho Desktop App ở giai đoạn này, thêm sau theo đúng cách này khi cần, không đổi cấu trúc.
const GATEWAY_ACTIONS_ = {
  'auth.me': function (user) {
    return { UserID: user.UserID, Email: user.Email, FullName: user.FullName, Role: user.Role, AvatarUrl: user.AvatarUrl };
  },
  'auth.changePassword': function (user, params) { return changeMyPassword(user, params.oldPassword, params.newPassword); },

  'employee.list': function () { return listEmployees(); },
  'employee.listByDepartment': function (user, params) { return listEmployeesByDepartment(params.departmentId); },
  'employee.get': function (user, params) { return getEmployeeById(params.employeeId); },
  'employee.me': function (user) { return getMyEmployee(user); },
  'employee.create': function (user, params) { return createEmployee(user, params); },
  'employee.update': function (user, params) { return updateEmployee(user, params.employeeId, params.patch); },
  'employee.deactivate': function (user, params) { return deactivateEmployee(user, params.employeeId); },
  'employee.resetPassword': function (user, params) { return resetEmployeePassword(user, params.employeeId, params.newPassword); },

  'department.list': function () { return listActiveDepartments(); },
  'department.get': function (user, params) { return getDepartmentById(params.departmentId); },
  'department.create': function (user, params) { return createDepartment(user, params); },
  'department.update': function (user, params) { return updateDepartment(user, params.departmentId, params.patch); },
  'department.deactivate': function (user, params) { return deactivateDepartment(user, params.departmentId); },

  'task.listMine': function (user) { return listMyTasks(user); },
  'task.listByDepartment': function (user, params) { return listTasksByDepartment(user, params.departmentId); },
  'task.assign': function (user, params) { return assignTask(user, params); },
  'task.updateProgress': function (user, params) { return updateTaskProgress(user, params.taskId, params.progress); },
  'task.submitResult': function (user, params) { return submitTaskResult(user, params.taskId, params.resultText); },
  'task.evaluate': function (user, params) { return evaluateTask(user, params.taskId, params); },
  'task.uploadAttachment': function (user, params) { return uploadTaskAttachment(user, params.taskId, params.fileName, params.mimeType, params.base64Data); },
  'task.listAttachments': function (user, params) { return listTaskAttachments(params.taskId); },

  'clinical.listMine': function (user, params) { return listMyClinicalAssignments(user, params.dateFrom, params.dateTo); },
  'clinical.listByDepartment': function (user, params) { return listClinicalAssignmentsByDepartment(user, params.departmentId, params.dateFrom, params.dateTo); },
  'clinical.create': function (user, params) { return createClinicalAssignment(user, params); },
  'clinical.update': function (user, params) { return updateClinicalAssignment(user, params.assignmentId, params.patch); },
  'clinical.delete': function (user, params) { return deleteClinicalAssignment(user, params.assignmentId); },

  'duty.create': function (user, params) { return createDutySchedule(user, params.departmentId, params.weekStartDate, params.weekEndDate); },
  'duty.addShift': function (user, params) { return addDutyShift(user, params.dutyScheduleId, params); },
  'duty.updateShift': function (user, params) { return updateDutyShift(user, params.dutyShiftId, params.patch); },
  'duty.removeShift': function (user, params) { return removeDutyShift(user, params.dutyShiftId); },
  'duty.listByDepartment': function (user, params) { return listDutySchedulesByDepartment(user, params.departmentId); },
  'duty.getDetail': function (user, params) { return getDutyScheduleDetail(user, params.dutyScheduleId); },
  'duty.listMyShifts': function (user, params) { return listMyDutyShifts(user, params.dateFrom, params.dateTo); },
  'duty.listHospitalWide': function (user, params) { return listHospitalWideDutySchedules(user, params.weekStartDate); },
  'duty.submit': function (user, params) { return submitDutySchedule(user, params.dutyScheduleId); },
  'duty.markUnderReview': function (user, params) { return markDutyScheduleUnderReview(user, params.dutyScheduleId); },
  'duty.requestRevision': function (user, params) { return requestDutyScheduleRevision(user, params.dutyScheduleId, params.comment); },
  'duty.forwardForDirectorApproval': function (user, params) { return forwardDutyScheduleForDirectorApproval(user, params.dutyScheduleId, params.comment); },
  'duty.approveByDirector': function (user, params) { return approveDutyScheduleByDirector(user, params.dutyScheduleId, params.comment); },
  'duty.publish': function (user, params) { return publishDutySchedule(user, params.dutyScheduleId); },

  'dutyCatalog.createType': function (user, params) { return createDutyType(user, params); },
  'dutyCatalog.deactivateType': function (user, params) { return deactivateDutyType(user, params.dutyTypeId); },
  'dutyCatalog.listTypes': function () { return listActiveDutyTypes(); },
  'dutyCatalog.createPosition': function (user, params) { return createDutyPosition(user, params); },
  'dutyCatalog.deactivatePosition': function (user, params) { return deactivateDutyPosition(user, params.dutyPositionId); },
  'dutyCatalog.listPositions': function (user, params) { return listActiveDutyPositions(params.employeeType); },
  'duty.myActiveLeaderShift': function (user) { return getMyActiveDutyLeaderShift(user); },

  'swap.request': function (user, params) { return requestSwap(user, params); },
  'swap.confirmReplacement': function (user, params) { return confirmSwapByReplacement(user, params.swapRequestId); },
  'swap.confirmDeptHead': function (user, params) { return confirmSwapByDeptHead(user, params.swapRequestId); },
  'swap.approveKhNv': function (user, params) { return approveSwapByKhNv(user, params.swapRequestId); },
  'swap.reject': function (user, params) { return rejectSwap(user, params.swapRequestId, params.reason); },
  'swap.listMine': function (user) { return listMySwapRequests(user); },
  'swap.listPendingConfirmations': function (user) { return listPendingSwapConfirmations(user); },
  'swap.listHistory': function (user, params) { return listSwapHistoryForShift(params.originalShiftId); },

  'attendance.record': function (user, params) { return recordAttendance(user, params); },
  'attendance.update': function (user, params) { return updateAttendance(user, params.attendanceId, params.patch); },
  'attendance.lockRange': function (user, params) { return lockAttendanceRange(user, params.departmentId, params.dateFrom, params.dateTo); },
  'attendance.listMine': function (user, params) { return listMyAttendance(user, params.dateFrom, params.dateTo); },
  'attendance.listByDepartment': function (user, params) { return listAttendanceByDepartment(user, params.departmentId, params.dateFrom, params.dateTo); },
  'attendance.requestAdjustment': function (user, params) { return requestAttendanceAdjustment(user, params); },
  'attendance.confirmAdjustmentByDeptHead': function (user, params) { return confirmAttendanceAdjustmentByDeptHead(user, params.adjustmentId); },
  'attendance.approveAdjustment': function (user, params) { return approveAttendanceAdjustment(user, params.adjustmentId); },
  'attendance.rejectAdjustment': function (user, params) { return rejectAttendanceAdjustment(user, params.adjustmentId, params.reason); },
  'attendance.listMyAdjustments': function (user) { return listMyAttendanceAdjustments(user); },
  'attendance.listPendingAdjustmentConfirmations': function (user) { return listPendingAttendanceAdjustmentConfirmations(user); },

  'overtime.request': function (user, params) { return requestOvertime(user, params); },
  'overtime.approve': function (user, params) { return approveOvertime(user, params.overtimeId); },
  'overtime.reject': function (user, params) { return rejectOvertime(user, params.overtimeId, params.reason); },
  'overtime.listMine': function (user, params) { return listMyOvertime(user, params.dateFrom, params.dateTo); },
  'overtime.listByDepartment': function (user, params) { return listOvertimeByDepartment(user, params.departmentId, params.dateFrom, params.dateTo); },

  'overtimeList.create': function (user, params) { return createOvertimeList(user, params.dutyShiftId); },
  'overtimeList.addItem': function (user, params) { return addOvertimeListItem(user, params.overtimeListId, params); },
  'overtimeList.updateItem': function (user, params) { return updateOvertimeListItem(user, params.overtimeListItemId, params.patch); },
  'overtimeList.removeItem': function (user, params) { return removeOvertimeListItem(user, params.overtimeListItemId); },
  'overtimeList.getDetail': function (user, params) { return getOvertimeListDetail(user, params.overtimeListId); },
  'overtimeList.listMine': function (user) { return listMyOvertimeLists(user); },
  'overtimeList.listPendingForKhNv': function (user) { return listPendingOvertimeListsForKhNv(user); },
  'overtimeList.submit': function (user, params) { return submitOvertimeList(user, params.overtimeListId); },
  'overtimeList.receive': function (user, params) { return receiveOvertimeList(user, params.overtimeListId); },
  'overtimeList.markUnderReview': function (user, params) { return markOvertimeListUnderReview(user, params.overtimeListId); },
  'overtimeList.requestRevision': function (user, params) { return requestOvertimeListRevision(user, params.overtimeListId, params.reason); },
  'overtimeList.finalize': function (user, params) { return finalizeOvertimeList(user, params.overtimeListId); },
  'overtimeList.requestUnlock': function (user, params) { return requestOvertimeListUnlock(user, params.overtimeListId, params.reason); },
  'overtimeList.approveUnlock': function (user, params) { return approveOvertimeListUnlock(user, params.overtimeListId); },

  'payroll.dutySummary': function (user, params) { return getDutySummaryForMonth(user, params.departmentId, params.yearMonth); },
  'payroll.aggregation': function (user, params) { return getPayrollAggregationForMonth(user, params.departmentId, params.yearMonth); },

  'clinicalStats.record': function (user, params) { return recordMonthlyClinicalStat(user, params); },
  'clinicalStats.import': function (user, params) { return importMonthlyClinicalStats(user, params.departmentId, params.yearMonth, params.rows); },
  'clinicalStats.delete': function (user, params) { return deleteMonthlyClinicalStat(user, params.statId); },
  'clinicalStats.listByDepartment': function (user, params) { return listMonthlyClinicalStatsByDepartment(user, params.departmentId, params.yearMonth); },
  'clinicalStats.listMine': function (user, params) { return listMyMonthlyClinicalStats(user, params.yearMonth); },

  'insuranceAudit.record': function (user, params) { return recordInsuranceAudit(user, params); },
  'insuranceAudit.updateExplanation': function (user, params) { return updateInsuranceAuditExplanation(user, params.auditId, params); },
  'insuranceAudit.listByDepartment': function (user, params) { return listInsuranceAuditsByDepartment(user, params.departmentId, params.yearMonth); },
  'insuranceAudit.listHospitalWide': function (user, params) { return listInsuranceAuditsHospitalWide(user, params.yearMonth); },

  'kpi.createRule': function (user, params) { return createKpiRule(user, params); },
  'kpi.deactivateRule': function (user, params) { return deactivateKpiRule(user, params.ruleId); },
  'kpi.listActiveRules': function (user, params) { return listActiveKpiRules(params.objectGroup); },
  'kpi.submitResult': function (user, params) { return submitKpiResult(user, params); },
  'kpi.approveResult': function (user, params) { return approveKpiResult(user, params.resultId, params.managerComment); },
  'kpi.listMyResults': function (user, params) { return listMyKpiResults(user, params.period); },
  'kpi.listResultsByDepartment': function (user, params) { return listKpiResultsByDepartment(user, params.departmentId, params.period); }
};
