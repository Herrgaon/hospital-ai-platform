// Điểm vào duy nhất cho client (google.script.run) — mọi hàm ở đây tự lấy user qua getCurrentUser(),
// KHÔNG BAO GIỜ nhận UserID/Role từ tham số client. Service layer phía dưới vẫn tự kiểm tra
// quyền lại (requirePermission/hasPermission) nên hàm ở đây không lặp lại việc đó.

function api_getCurrentUser() {
  const user = getCurrentUser();
  return {
    UserID: user.UserID, Email: user.Email, FullName: user.FullName, Role: user.Role,
    Department: user.Department, AvatarUrl: user.AvatarUrl
  };
}

function api_getMyPermissionMap() {
  const user = getCurrentUser();
  return getMyPermissionMap(user);
}

function api_updateMyProfile(fullName) {
  const user = getCurrentUser();
  return updateMyProfile(user, fullName);
}

function api_updateMyAvatar(base64Data, mimeType) {
  const user = getCurrentUser();
  return updateMyAvatar(user, base64Data, mimeType);
}

function api_createUser(email, fullName, role, department) {
  const user = getCurrentUser();
  return createUser(user, email, fullName, role, department);
}

function api_updateUserProfile(targetUserId, fullName, department) {
  const user = getCurrentUser();
  return updateUserProfile(user, targetUserId, fullName, department);
}

function api_syncSchemaWithSpreadsheet() {
  const user = getCurrentUser();
  return syncSchemaWithSpreadsheet(user);
}

function api_getDashboardSummary() {
  const user = getCurrentUser();
  const weekStart = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  return {
    myTasks: listMyTasks(user),
    myShiftsThisWeek: listMyDutyShifts(user, weekStart, null),
    pendingSwapConfirmations: listPendingSwapConfirmations(user)
  };
}

function api_listAllUsers() {
  const user = getCurrentUser();
  return listAllUsers(user);
}

function api_getAllRoles() {
  return getAllRoles();
}

function api_assignRole(targetUserId, newRole) {
  const user = getCurrentUser();
  return assignRole(user, targetUserId, newRole);
}

function api_setEmployeePermissionOverride(targetUserId, departmentId, permissionPatch) {
  const user = getCurrentUser();
  return setEmployeePermissionOverride(user, targetUserId, departmentId, permissionPatch);
}

function api_listPermissionsForDepartment(departmentId) {
  const user = getCurrentUser();
  return listPermissionsForDepartment(user, departmentId);
}

function api_listUserDirectory() {
  return listUserDirectory();
}

// --- Employee ---

function api_listEmployees() {
  return listEmployees();
}

function api_getMyEmployee() {
  const user = getCurrentUser();
  return getMyEmployee(user);
}

function api_getEmployeeById(employeeId) {
  return getEmployeeById(employeeId);
}

function api_createEmployee(input) {
  const user = getCurrentUser();
  return createEmployee(user, input);
}

function api_updateEmployee(employeeId, patch) {
  const user = getCurrentUser();
  return updateEmployee(user, employeeId, patch);
}

function api_deactivateEmployee(employeeId) {
  const user = getCurrentUser();
  return deactivateEmployee(user, employeeId);
}

function api_resetEmployeePassword(employeeId, newPassword) {
  const user = getCurrentUser();
  return resetEmployeePassword(user, employeeId, newPassword);
}

function api_changeMyPassword(oldPassword, newPassword) {
  const user = getCurrentUser();
  return changeMyPassword(user, oldPassword, newPassword);
}

// --- Department ---

function api_listActiveDepartments() {
  return listActiveDepartments();
}

function api_createDepartment(input) {
  const user = getCurrentUser();
  return createDepartment(user, input);
}

function api_updateDepartment(departmentId, patch) {
  const user = getCurrentUser();
  return updateDepartment(user, departmentId, patch);
}

function api_deactivateDepartment(departmentId) {
  const user = getCurrentUser();
  return deactivateDepartment(user, departmentId);
}

// --- Task ---

function api_listMyTasks() {
  const user = getCurrentUser();
  return listMyTasks(user);
}

function api_listTasksByDepartment(departmentId) {
  const user = getCurrentUser();
  return listTasksByDepartment(user, departmentId);
}

function api_assignTask(input) {
  const user = getCurrentUser();
  return assignTask(user, input);
}

function api_updateTaskProgress(taskId, progress) {
  const user = getCurrentUser();
  return updateTaskProgress(user, taskId, progress);
}

function api_submitTaskResult(taskId, resultText) {
  const user = getCurrentUser();
  return submitTaskResult(user, taskId, resultText);
}

function api_evaluateTask(taskId, input) {
  const user = getCurrentUser();
  return evaluateTask(user, taskId, input);
}

function api_uploadTaskAttachment(taskId, fileName, mimeType, base64Data) {
  const user = getCurrentUser();
  return uploadTaskAttachment(user, taskId, fileName, mimeType, base64Data);
}

function api_listTaskAttachments(taskId) {
  return listTaskAttachments(taskId);
}

// --- Clinical Assignment (Phân công khối lâm sàng) ---

function api_listMyClinicalAssignments(dateFrom, dateTo) {
  const user = getCurrentUser();
  return listMyClinicalAssignments(user, dateFrom, dateTo);
}

function api_listClinicalAssignmentsByDepartment(departmentId, dateFrom, dateTo) {
  const user = getCurrentUser();
  return listClinicalAssignmentsByDepartment(user, departmentId, dateFrom, dateTo);
}

function api_createClinicalAssignment(input) {
  const user = getCurrentUser();
  return createClinicalAssignment(user, input);
}

function api_updateClinicalAssignment(assignmentId, patch) {
  const user = getCurrentUser();
  return updateClinicalAssignment(user, assignmentId, patch);
}

function api_deleteClinicalAssignment(assignmentId) {
  const user = getCurrentUser();
  return deleteClinicalAssignment(user, assignmentId);
}

// --- Duty Schedule (Lịch trực tuần) ---

function api_createDutySchedule(departmentId, weekStartDate, weekEndDate) {
  const user = getCurrentUser();
  return createDutySchedule(user, departmentId, weekStartDate, weekEndDate);
}

function api_addDutyShift(dutyScheduleId, input) {
  const user = getCurrentUser();
  return addDutyShift(user, dutyScheduleId, input);
}

function api_updateDutyShift(dutyShiftId, patch) {
  const user = getCurrentUser();
  return updateDutyShift(user, dutyShiftId, patch);
}

function api_removeDutyShift(dutyShiftId) {
  const user = getCurrentUser();
  return removeDutyShift(user, dutyShiftId);
}

function api_listDutySchedulesByDepartment(departmentId) {
  const user = getCurrentUser();
  return listDutySchedulesByDepartment(user, departmentId);
}

function api_getDutyScheduleDetail(dutyScheduleId) {
  const user = getCurrentUser();
  return getDutyScheduleDetail(user, dutyScheduleId);
}

function api_listMyDutyShifts(dateFrom, dateTo) {
  const user = getCurrentUser();
  return listMyDutyShifts(user, dateFrom, dateTo);
}

function api_listHospitalWideDutySchedules(weekStartDate) {
  const user = getCurrentUser();
  return listHospitalWideDutySchedules(user, weekStartDate);
}

function api_submitDutySchedule(dutyScheduleId) {
  const user = getCurrentUser();
  return submitDutySchedule(user, dutyScheduleId);
}

function api_markDutyScheduleUnderReview(dutyScheduleId) {
  const user = getCurrentUser();
  return markDutyScheduleUnderReview(user, dutyScheduleId);
}

function api_requestDutyScheduleRevision(dutyScheduleId, comment) {
  const user = getCurrentUser();
  return requestDutyScheduleRevision(user, dutyScheduleId, comment);
}

function api_approveDutySchedule(dutyScheduleId, comment) {
  const user = getCurrentUser();
  return approveDutySchedule(user, dutyScheduleId, comment);
}

function api_publishDutySchedule(dutyScheduleId) {
  const user = getCurrentUser();
  return publishDutySchedule(user, dutyScheduleId);
}

// --- Duty Swap (Đổi trực) ---

function api_requestDutySwap(input) {
  const user = getCurrentUser();
  return requestSwap(user, input);
}

function api_confirmDutySwapByReplacement(swapRequestId) {
  const user = getCurrentUser();
  return confirmSwapByReplacement(user, swapRequestId);
}

function api_confirmDutySwapByDeptHead(swapRequestId) {
  const user = getCurrentUser();
  return confirmSwapByDeptHead(user, swapRequestId);
}

function api_approveDutySwapByKhNv(swapRequestId) {
  const user = getCurrentUser();
  return approveSwapByKhNv(user, swapRequestId);
}

function api_rejectDutySwap(swapRequestId, reason) {
  const user = getCurrentUser();
  return rejectSwap(user, swapRequestId, reason);
}

function api_listMySwapRequests() {
  const user = getCurrentUser();
  return listMySwapRequests(user);
}

function api_listPendingSwapConfirmations() {
  const user = getCurrentUser();
  return listPendingSwapConfirmations(user);
}

function api_listSwapHistoryForShift(originalShiftId) {
  return listSwapHistoryForShift(originalShiftId);
}

// --- Admin / AI / Audit Log ---

function api_listAIProviders() {
  return listAIProviders();
}

function api_getActiveAIProviderConfig() {
  const user = getCurrentUser();
  if (user.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được xem cấu hình AI.');
  }
  return getActiveAIProviderConfigMasked();
}

function api_isAiEnabled() {
  return isAiEnabled();
}

function api_updateAIProviderConfig(providerId, modelName, plainApiKey, temperature, maxTokens, timeout) {
  const user = getCurrentUser();
  return updateAIProviderConfig(user, providerId, modelName, plainApiKey, temperature, maxTokens, timeout);
}

function api_setAiEnabled(enabled) {
  const user = getCurrentUser();
  setAiEnabled(user, enabled);
  return { aiEnabled: enabled };
}

function api_searchAuditLog(filters) {
  const user = getCurrentUser();
  return searchAuditLog(user, filters || {});
}

function api_exportAuditLogToExcel(filters) {
  const user = getCurrentUser();
  return exportAuditLogToExcel(user, filters || {});
}
