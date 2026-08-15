// KPI — lớp đánh giá được TÍNH TỪ dữ liệu công việc/hoạt động/lịch trực đã có, KHÔNG PHẢI nơi nhân
// viên tự nhập số liệu (đúng nguyên tắc trong đặc tả). Chỉ tiêu/trọng số/cách quy đổi điểm cấu hình
// qua KpiRules (Kpi.Engine.gs diễn giải), quản lý bởi SUPER_ADMIN/Phòng KH-NV — không phân quyền theo
// Khoa/Phòng vì đây là quy chế áp dụng toàn viện, không phải dữ liệu riêng từng khoa.

function requireKpiRuleManager_(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN && actingUser.Role !== ROLE_NAMES.PHONG_KH_NV) {
    throw new Error('Chỉ Quản trị hệ thống hoặc Phòng Kế hoạch – Nghiệp vụ được cấu hình chỉ tiêu KPI.');
  }
}

function createKpiRule(actingUser, input) {
  requireKpiRuleManager_(actingUser);
  const isCommon = !!input.isCommonCriterion;
  if (!isCommon && isBlank(input.objectGroup)) {
    throw new Error('Thiếu nhóm đối tượng — hoặc đánh dấu đây là tiêu chí chung toàn bệnh viện.');
  }
  if (isBlank(input.criterion) || isBlank(input.scoringMethodJson)) {
    throw new Error('Thiếu chỉ tiêu hoặc cách quy đổi điểm.');
  }
  if (!isValidScoringMethodJson_(input.scoringMethodJson)) {
    throw new Error('Cách quy đổi điểm không hợp lệ — kiểm tra lại định dạng JSON.');
  }

  // Tiêu chí chung áp dụng mọi chức danh — ObjectGroup không còn ý nghĩa lọc, ép về '*' để
  // listActiveKpiRules/danh sách chọn không hiển thị nhầm giá trị chức danh cụ thể không liên quan.
  const objectGroup = isCommon ? '*' : input.objectGroup;

  const rule = getSheetRepository(SHEETS.KPI_RULES).append({
    RuleID: generateId('KPIR'),
    ObjectGroup: objectGroup,
    IsCommonCriterion: isCommon,
    Criterion: input.criterion,
    Weight: input.weight || 1,
    ScoringMethodJson: input.scoringMethodJson,
    EffectiveFrom: input.effectiveFrom || nowIso(),
    EffectiveTo: input.effectiveTo || '',
    Version: 1,
    Status: 'Active',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'KPI_RULE_CREATED', 'KpiRule', rule.RuleID, objectGroup + ' / ' + input.criterion);
  return rule;
}

function deactivateKpiRule(actingUser, ruleId) {
  requireKpiRuleManager_(actingUser);
  const updated = getSheetRepository(SHEETS.KPI_RULES).updateById('RuleID', ruleId, { Status: 'Inactive', UpdatedAt: nowIso() });
  if (!updated) throw new Error('Không tìm thấy chỉ tiêu KPI.');
  logAudit(actingUser.UserID, 'KPI_RULE_DEACTIVATED', 'KpiRule', ruleId, '');
  return updated;
}

// Đọc mở — cần cho mọi màn hình chọn chỉ tiêu khi lập KPI, không nhạy cảm hơn danh mục Khoa/Phòng.
// Lọc theo objectGroup LUÔN kèm theo tiêu chí chung (IsCommonCriterion — áp dụng mọi chức danh, đúng
// §4) — không lọc objectGroup = không lọc gì (trả về toàn bộ, dùng cho màn quản trị Danh mục KPI).
function listActiveKpiRules(objectGroup) {
  return getSheetRepository(SHEETS.KPI_RULES).findAll().filter(function (r) {
    if (r.Status !== 'Active') return false;
    if (!objectGroup) return true;
    return r.IsCommonCriterion || r.ObjectGroup === objectGroup;
  });
}

// Chỉ tiêu áp dụng cho 1 nhân viên cụ thể = tiêu chí chung + tiêu chí đặc thù đúng EmployeeType (chức
// danh) của họ — đúng nhánh phải trong sơ đồ §3. Dùng khi lập kết quả KPI để chỉ hiện đúng danh sách
// liên quan, không bắt người dùng tự lọc thủ công giữa hàng chục chỉ tiêu của mọi chức danh.
function listApplicableKpiRulesForEmployee(employeeId) {
  const employee = getEmployeeById(employeeId);
  if (!employee) return [];
  return listActiveKpiRules(employee.EmployeeType);
}

// Lập kết quả KPI ở trạng thái DRAFT — điểm tự tính từ ActualValue qua đúng chỉ tiêu đã cấu hình, quản
// lý có thể xem lại/nhận xét trước khi duyệt chính thức (approveKpiResult).
function submitKpiResult(actingUser, input) {
  requirePermission(actingUser, input.departmentId, 'CanCreate');
  const rule = getSheetRepository(SHEETS.KPI_RULES).findById('RuleID', input.ruleId);
  if (!rule || rule.Status !== 'Active') throw new Error('Chỉ tiêu KPI không tồn tại hoặc đã ngừng áp dụng.');

  const score = computeKpiScore_(input.actualValue, rule.ScoringMethodJson);
  const result = getSheetRepository(SHEETS.KPI_RESULTS).append({
    ResultID: generateId('KPIRES'),
    EmployeeID: input.employeeId,
    DepartmentID: input.departmentId,
    Period: input.period,
    RuleID: input.ruleId,
    Criterion: rule.Criterion,
    ActualValue: input.actualValue,
    Score: score,
    ManagerComment: '',
    Status: 'DRAFT',
    EvaluatedByUserID: '', EvaluatedAt: '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'KPI_RESULT_SUBMITTED', 'KpiResult', result.ResultID, rule.Criterion + ': ' + score);
  return result;
}

function approveKpiResult(actingUser, resultId, managerComment) {
  const result = getSheetRepository(SHEETS.KPI_RESULTS).findById('ResultID', resultId);
  if (!result) throw new Error('Không tìm thấy kết quả KPI.');
  requirePermission(actingUser, result.DepartmentID, 'CanApprove');
  if (result.Status !== 'DRAFT') throw new Error('Kết quả KPI không ở trạng thái chờ duyệt.');

  const updated = getSheetRepository(SHEETS.KPI_RESULTS).updateById('ResultID', resultId, {
    Status: 'APPROVED', ManagerComment: managerComment || '', EvaluatedByUserID: actingUser.UserID, EvaluatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'KPI_RESULT_APPROVED', 'KpiResult', resultId, '');
  return updated;
}

function listMyKpiResults(user, period) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  return getSheetRepository(SHEETS.KPI_RESULTS).findAll().filter(function (r) {
    return r.EmployeeID === employee.EmployeeID && (!period || r.Period === period);
  });
}

function listKpiResultsByDepartment(user, departmentId, period) {
  requirePermission(user, departmentId, 'CanView');
  return getSheetRepository(SHEETS.KPI_RESULTS).findAll().filter(function (r) {
    return r.DepartmentID === departmentId && (!period || r.Period === period);
  });
}
