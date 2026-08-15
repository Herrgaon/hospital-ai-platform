// Điểm vào duy nhất cho client (google.script.run) — MỌI hàm ở đây (trừ api_login, api_initializeSystem
// gọi thẳng qua bootstrapJs.html) nhận `token` làm tham số ĐẦU TIÊN, tự xác thực qua
// getCurrentUserFromToken_ trước khi làm bất cứ điều gì khác. Web App deploy ở chế độ
// executeAs=USER_DEPLOYING/access=ANYONE_ANONYMOUS (xem appsscript.json + Auth.Session.gs) nên KHÔNG
// còn phiên Google nào để dựa vào — token là nguồn danh tính duy nhất, dùng chung giữa trình duyệt và
// Desktop App. Service layer phía dưới vẫn tự kiểm tra quyền lại (requirePermission/hasPermission).

function api_login(username, password) {
  return authenticateWithPassword(username, password);
}

function api_logout(token) {
  return logoutWithToken(token);
}

function api_getCurrentUser(token) {
  const user = getCurrentUserFromToken_(token);
  return {
    UserID: user.UserID, Email: user.Email, FullName: user.FullName, Role: user.Role,
    Department: user.Department, AvatarUrl: user.AvatarUrl
  };
}

function api_getMyPermissionMap(token) {
  const user = getCurrentUserFromToken_(token);
  return getMyPermissionMap(user);
}

function api_updateMyProfile(token, fullName) {
  const user = getCurrentUserFromToken_(token);
  return updateMyProfile(user, fullName);
}

function api_updateMyAvatar(token, base64Data, mimeType) {
  const user = getCurrentUserFromToken_(token);
  return updateMyAvatar(user, base64Data, mimeType);
}

function api_changeMyPassword(token, oldPassword, newPassword) {
  const user = getCurrentUserFromToken_(token);
  return changeMyPassword(user, oldPassword, newPassword);
}

function api_createUser(token, email, username, fullName, role, department) {
  const user = getCurrentUserFromToken_(token);
  return createUser(user, email, username, fullName, role, department);
}

function api_updateUserProfile(token, targetUserId, fullName, department) {
  const user = getCurrentUserFromToken_(token);
  return updateUserProfile(user, targetUserId, fullName, department);
}

function api_syncSchemaWithSpreadsheet(token) {
  const user = getCurrentUserFromToken_(token);
  return syncSchemaWithSpreadsheet(user);
}

function api_getDashboardSummary(token) {
  const user = getCurrentUserFromToken_(token);
  const weekStart = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  const currentPeriod = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM');
  return {
    myTasks: listMyTasks(user),
    myShiftsThisWeek: listMyDutyShifts(user, weekStart, null),
    pendingSwapConfirmations: listPendingSwapConfirmations(user),
    pendingAttendanceAdjustments: listPendingAttendanceAdjustmentConfirmations(user),
    myKpiResultsThisPeriod: listMyKpiResults(user, currentPeriod)
  };
}

function api_listAllUsers(token) {
  const user = getCurrentUserFromToken_(token);
  return listAllUsers(user);
}

function api_getAllRoles() {
  return getAllRoles();
}

function api_assignRole(token, targetUserId, newRole) {
  const user = getCurrentUserFromToken_(token);
  return assignRole(user, targetUserId, newRole);
}

function api_setEmployeePermissionOverride(token, targetUserId, departmentId, permissionPatch) {
  const user = getCurrentUserFromToken_(token);
  return setEmployeePermissionOverride(user, targetUserId, departmentId, permissionPatch);
}

function api_listPermissionsForDepartment(token, departmentId) {
  const user = getCurrentUserFromToken_(token);
  return listPermissionsForDepartment(user, departmentId);
}

function api_listUserDirectory(token) {
  getCurrentUserFromToken_(token);
  return listUserDirectory();
}

// --- Employee ---

function api_listEmployees(token) {
  getCurrentUserFromToken_(token);
  return listEmployees();
}

function api_getMyEmployee(token) {
  const user = getCurrentUserFromToken_(token);
  return getMyEmployee(user);
}

function api_getEmployeeById(token, employeeId) {
  getCurrentUserFromToken_(token);
  return getEmployeeById(employeeId);
}

function api_createEmployee(token, input) {
  const user = getCurrentUserFromToken_(token);
  return createEmployee(user, input);
}

function api_updateEmployee(token, employeeId, patch) {
  const user = getCurrentUserFromToken_(token);
  return updateEmployee(user, employeeId, patch);
}

function api_deactivateEmployee(token, employeeId) {
  const user = getCurrentUserFromToken_(token);
  return deactivateEmployee(user, employeeId);
}

function api_resetEmployeePassword(token, employeeId, newPassword) {
  const user = getCurrentUserFromToken_(token);
  return resetEmployeePassword(user, employeeId, newPassword);
}

// --- Department ---

function api_listActiveDepartments(token) {
  getCurrentUserFromToken_(token);
  return listActiveDepartments();
}

function api_createDepartment(token, input) {
  const user = getCurrentUserFromToken_(token);
  return createDepartment(user, input);
}

function api_updateDepartment(token, departmentId, patch) {
  const user = getCurrentUserFromToken_(token);
  return updateDepartment(user, departmentId, patch);
}

function api_deactivateDepartment(token, departmentId) {
  const user = getCurrentUserFromToken_(token);
  return deactivateDepartment(user, departmentId);
}

// --- Task ---

function api_listMyTasks(token) {
  const user = getCurrentUserFromToken_(token);
  return listMyTasks(user);
}

function api_listTasksByDepartment(token, departmentId) {
  const user = getCurrentUserFromToken_(token);
  return listTasksByDepartment(user, departmentId);
}

function api_assignTask(token, input) {
  const user = getCurrentUserFromToken_(token);
  return assignTask(user, input);
}

function api_updateTaskProgress(token, taskId, progress) {
  const user = getCurrentUserFromToken_(token);
  return updateTaskProgress(user, taskId, progress);
}

function api_submitTaskResult(token, taskId, resultText) {
  const user = getCurrentUserFromToken_(token);
  return submitTaskResult(user, taskId, resultText);
}

function api_evaluateTask(token, taskId, input) {
  const user = getCurrentUserFromToken_(token);
  return evaluateTask(user, taskId, input);
}

function api_uploadTaskAttachment(token, taskId, fileName, mimeType, base64Data) {
  const user = getCurrentUserFromToken_(token);
  return uploadTaskAttachment(user, taskId, fileName, mimeType, base64Data);
}

function api_listTaskAttachments(token, taskId) {
  getCurrentUserFromToken_(token);
  return listTaskAttachments(taskId);
}

// --- Clinical Assignment (Phân công khối lâm sàng) ---

function api_listMyClinicalAssignments(token, dateFrom, dateTo) {
  const user = getCurrentUserFromToken_(token);
  return listMyClinicalAssignments(user, dateFrom, dateTo);
}

function api_listClinicalAssignmentsByDepartment(token, departmentId, dateFrom, dateTo) {
  const user = getCurrentUserFromToken_(token);
  return listClinicalAssignmentsByDepartment(user, departmentId, dateFrom, dateTo);
}

function api_createClinicalAssignment(token, input) {
  const user = getCurrentUserFromToken_(token);
  return createClinicalAssignment(user, input);
}

function api_updateClinicalAssignment(token, assignmentId, patch) {
  const user = getCurrentUserFromToken_(token);
  return updateClinicalAssignment(user, assignmentId, patch);
}

function api_deleteClinicalAssignment(token, assignmentId) {
  const user = getCurrentUserFromToken_(token);
  return deleteClinicalAssignment(user, assignmentId);
}

// --- Duty Schedule (Lịch trực tuần) ---

function api_createDutySchedule(token, departmentId, weekStartDate, weekEndDate) {
  const user = getCurrentUserFromToken_(token);
  return createDutySchedule(user, departmentId, weekStartDate, weekEndDate);
}

function api_addDutyShift(token, dutyScheduleId, input) {
  const user = getCurrentUserFromToken_(token);
  return addDutyShift(user, dutyScheduleId, input);
}

function api_updateDutyShift(token, dutyShiftId, patch) {
  const user = getCurrentUserFromToken_(token);
  return updateDutyShift(user, dutyShiftId, patch);
}

function api_removeDutyShift(token, dutyShiftId) {
  const user = getCurrentUserFromToken_(token);
  return removeDutyShift(user, dutyShiftId);
}

function api_listDutySchedulesByDepartment(token, departmentId) {
  const user = getCurrentUserFromToken_(token);
  return listDutySchedulesByDepartment(user, departmentId);
}

function api_getDutyScheduleDetail(token, dutyScheduleId) {
  const user = getCurrentUserFromToken_(token);
  return getDutyScheduleDetail(user, dutyScheduleId);
}

function api_listMyDutyShifts(token, dateFrom, dateTo) {
  const user = getCurrentUserFromToken_(token);
  return listMyDutyShifts(user, dateFrom, dateTo);
}

function api_listHospitalWideDutySchedules(token, weekStartDate) {
  const user = getCurrentUserFromToken_(token);
  return listHospitalWideDutySchedules(user, weekStartDate);
}

function api_submitDutySchedule(token, dutyScheduleId) {
  const user = getCurrentUserFromToken_(token);
  return submitDutySchedule(user, dutyScheduleId);
}

function api_markDutyScheduleUnderReview(token, dutyScheduleId) {
  const user = getCurrentUserFromToken_(token);
  return markDutyScheduleUnderReview(user, dutyScheduleId);
}

function api_requestDutyScheduleRevision(token, dutyScheduleId, comment) {
  const user = getCurrentUserFromToken_(token);
  return requestDutyScheduleRevision(user, dutyScheduleId, comment);
}

function api_approveDutySchedule(token, dutyScheduleId, comment) {
  const user = getCurrentUserFromToken_(token);
  return approveDutySchedule(user, dutyScheduleId, comment);
}

function api_publishDutySchedule(token, dutyScheduleId) {
  const user = getCurrentUserFromToken_(token);
  return publishDutySchedule(user, dutyScheduleId);
}

// --- Duty Swap (Đổi trực) ---

function api_requestDutySwap(token, input) {
  const user = getCurrentUserFromToken_(token);
  return requestSwap(user, input);
}

function api_confirmDutySwapByReplacement(token, swapRequestId) {
  const user = getCurrentUserFromToken_(token);
  return confirmSwapByReplacement(user, swapRequestId);
}

function api_confirmDutySwapByDeptHead(token, swapRequestId) {
  const user = getCurrentUserFromToken_(token);
  return confirmSwapByDeptHead(user, swapRequestId);
}

function api_approveDutySwapByKhNv(token, swapRequestId) {
  const user = getCurrentUserFromToken_(token);
  return approveSwapByKhNv(user, swapRequestId);
}

function api_rejectDutySwap(token, swapRequestId, reason) {
  const user = getCurrentUserFromToken_(token);
  return rejectSwap(user, swapRequestId, reason);
}

function api_listMySwapRequests(token) {
  const user = getCurrentUserFromToken_(token);
  return listMySwapRequests(user);
}

function api_listPendingSwapConfirmations(token) {
  const user = getCurrentUserFromToken_(token);
  return listPendingSwapConfirmations(user);
}

function api_listSwapHistoryForShift(token, originalShiftId) {
  getCurrentUserFromToken_(token);
  return listSwapHistoryForShift(originalShiftId);
}

// --- Chấm công (Attendance) ---

function api_recordAttendance(token, input) {
  const user = getCurrentUserFromToken_(token);
  return recordAttendance(user, input);
}

function api_updateAttendance(token, attendanceId, patch) {
  const user = getCurrentUserFromToken_(token);
  return updateAttendance(user, attendanceId, patch);
}

function api_lockAttendanceRange(token, departmentId, dateFrom, dateTo) {
  const user = getCurrentUserFromToken_(token);
  return lockAttendanceRange(user, departmentId, dateFrom, dateTo);
}

function api_listMyAttendance(token, dateFrom, dateTo) {
  const user = getCurrentUserFromToken_(token);
  return listMyAttendance(user, dateFrom, dateTo);
}

function api_listAttendanceByDepartment(token, departmentId, dateFrom, dateTo) {
  const user = getCurrentUserFromToken_(token);
  return listAttendanceByDepartment(user, departmentId, dateFrom, dateTo);
}

function api_requestAttendanceAdjustment(token, input) {
  const user = getCurrentUserFromToken_(token);
  return requestAttendanceAdjustment(user, input);
}

function api_confirmAttendanceAdjustmentByDeptHead(token, adjustmentId) {
  const user = getCurrentUserFromToken_(token);
  return confirmAttendanceAdjustmentByDeptHead(user, adjustmentId);
}

function api_approveAttendanceAdjustment(token, adjustmentId) {
  const user = getCurrentUserFromToken_(token);
  return approveAttendanceAdjustment(user, adjustmentId);
}

function api_rejectAttendanceAdjustment(token, adjustmentId, reason) {
  const user = getCurrentUserFromToken_(token);
  return rejectAttendanceAdjustment(user, adjustmentId, reason);
}

function api_listMyAttendanceAdjustments(token) {
  const user = getCurrentUserFromToken_(token);
  return listMyAttendanceAdjustments(user);
}

function api_listPendingAttendanceAdjustmentConfirmations(token) {
  const user = getCurrentUserFromToken_(token);
  return listPendingAttendanceAdjustmentConfirmations(user);
}

// --- Làm thêm giờ / Làm ngoài giờ (Overtime) ---

function api_requestOvertime(token, input) {
  const user = getCurrentUserFromToken_(token);
  return requestOvertime(user, input);
}

function api_approveOvertime(token, overtimeId) {
  const user = getCurrentUserFromToken_(token);
  return approveOvertime(user, overtimeId);
}

function api_rejectOvertime(token, overtimeId, reason) {
  const user = getCurrentUserFromToken_(token);
  return rejectOvertime(user, overtimeId, reason);
}

function api_listMyOvertime(token, dateFrom, dateTo) {
  const user = getCurrentUserFromToken_(token);
  return listMyOvertime(user, dateFrom, dateTo);
}

function api_listOvertimeByDepartment(token, departmentId, dateFrom, dateTo) {
  const user = getCurrentUserFromToken_(token);
  return listOvertimeByDepartment(user, departmentId, dateFrom, dateTo);
}

// --- Tổng hợp trực / Tổng hợp kế toán (Payroll Aggregation) ---

function api_getDutySummaryForMonth(token, departmentId, yearMonth) {
  const user = getCurrentUserFromToken_(token);
  return getDutySummaryForMonth(user, departmentId, yearMonth);
}

function api_getPayrollAggregationForMonth(token, departmentId, yearMonth) {
  const user = getCurrentUserFromToken_(token);
  return getPayrollAggregationForMonth(user, departmentId, yearMonth);
}

function api_exportPayrollAggregationToExcel(token, departmentId, yearMonth) {
  const user = getCurrentUserFromToken_(token);
  return exportPayrollAggregationToExcel(user, departmentId, yearMonth);
}

// --- Số liệu hoạt động chuyên môn theo tháng ---

function api_recordMonthlyClinicalStat(token, input) {
  const user = getCurrentUserFromToken_(token);
  return recordMonthlyClinicalStat(user, input);
}

function api_importMonthlyClinicalStats(token, departmentId, yearMonth, rows) {
  const user = getCurrentUserFromToken_(token);
  return importMonthlyClinicalStats(user, departmentId, yearMonth, rows);
}

function api_deleteMonthlyClinicalStat(token, statId) {
  const user = getCurrentUserFromToken_(token);
  return deleteMonthlyClinicalStat(user, statId);
}

function api_listMonthlyClinicalStatsByDepartment(token, departmentId, yearMonth) {
  const user = getCurrentUserFromToken_(token);
  return listMonthlyClinicalStatsByDepartment(user, departmentId, yearMonth);
}

function api_listMyMonthlyClinicalStats(token, yearMonth) {
  const user = getCurrentUserFromToken_(token);
  return listMyMonthlyClinicalStats(user, yearMonth);
}

// --- BHYT / Xuất toán ---

function api_recordInsuranceAudit(token, input) {
  const user = getCurrentUserFromToken_(token);
  return recordInsuranceAudit(user, input);
}

function api_updateInsuranceAuditExplanation(token, auditId, input) {
  const user = getCurrentUserFromToken_(token);
  return updateInsuranceAuditExplanation(user, auditId, input);
}

function api_listInsuranceAuditsByDepartment(token, departmentId, yearMonth) {
  const user = getCurrentUserFromToken_(token);
  return listInsuranceAuditsByDepartment(user, departmentId, yearMonth);
}

function api_listInsuranceAuditsHospitalWide(token, yearMonth) {
  const user = getCurrentUserFromToken_(token);
  return listInsuranceAuditsHospitalWide(user, yearMonth);
}

// --- KPI ---

function api_createKpiRule(token, input) {
  const user = getCurrentUserFromToken_(token);
  return createKpiRule(user, input);
}

function api_deactivateKpiRule(token, ruleId) {
  const user = getCurrentUserFromToken_(token);
  return deactivateKpiRule(user, ruleId);
}

function api_listActiveKpiRules(token, objectGroup) {
  getCurrentUserFromToken_(token);
  return listActiveKpiRules(objectGroup);
}

function api_submitKpiResult(token, input) {
  const user = getCurrentUserFromToken_(token);
  return submitKpiResult(user, input);
}

function api_approveKpiResult(token, resultId, managerComment) {
  const user = getCurrentUserFromToken_(token);
  return approveKpiResult(user, resultId, managerComment);
}

function api_listMyKpiResults(token, period) {
  const user = getCurrentUserFromToken_(token);
  return listMyKpiResults(user, period);
}

function api_listKpiResultsByDepartment(token, departmentId, period) {
  const user = getCurrentUserFromToken_(token);
  return listKpiResultsByDepartment(user, departmentId, period);
}

// --- Admin / AI / Audit Log ---

function api_listAIProviders(token) {
  getCurrentUserFromToken_(token);
  return listAIProviders();
}

function api_getActiveAIProviderConfig(token) {
  const user = getCurrentUserFromToken_(token);
  if (user.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được xem cấu hình AI.');
  }
  return getActiveAIProviderConfigMasked();
}

function api_isAiEnabled() {
  return isAiEnabled();
}

function api_updateAIProviderConfig(token, providerId, modelName, plainApiKey, temperature, maxTokens, timeout) {
  const user = getCurrentUserFromToken_(token);
  return updateAIProviderConfig(user, providerId, modelName, plainApiKey, temperature, maxTokens, timeout);
}

function api_setAiEnabled(token, enabled) {
  const user = getCurrentUserFromToken_(token);
  setAiEnabled(user, enabled);
  return { aiEnabled: enabled };
}

function api_searchAuditLog(token, filters) {
  const user = getCurrentUserFromToken_(token);
  return searchAuditLog(user, filters || {});
}

function api_exportAuditLogToExcel(token, filters) {
  const user = getCurrentUserFromToken_(token);
  return exportAuditLogToExcel(user, filters || {});
}
