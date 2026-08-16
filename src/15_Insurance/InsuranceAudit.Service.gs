// BHYT / Xuất toán theo tháng — Giai đoạn 3. Chỉ ghi nhận số liệu tổng hợp + tình trạng giải trình.
// CỐ TÌNH không có bất kỳ phép tính nào quy đổi "số ca xuất toán" thành điểm trừ KPI tự động — muốn
// dùng làm căn cứ đánh giá phải tạo KpiResults thủ công sau khi đã phân loại nguyên nhân/trách nhiệm
// (đúng nguyên tắc trong đặc tả).

function recordInsuranceAudit(actingUser, input) {
  requirePermission(actingUser, input.departmentId, 'CanCreate', 'INSURANCE_AUDIT');
  if (isBlank(input.yearMonth)) throw new Error('Thiếu tháng.');

  const audit = getSheetRepository(SHEETS.INSURANCE_AUDITS).append({
    AuditID: generateId('BHYT'),
    DepartmentID: input.departmentId,
    YearMonth: input.yearMonth,
    TotalRecords: input.totalRecords || 0,
    WriteOffCount: input.writeOffCount || 0,
    WriteOffAmount: input.writeOffAmount || 0,
    Reason: input.reason || '',
    RelatedDepartmentID: input.relatedDepartmentId || '',
    RelatedEmployeeID: input.relatedEmployeeId || '',
    ExplanationStatus: 'PENDING',
    ExplanationResult: '',
    AcceptedAmountAfterExplanation: '',
    AffectsKpi: false, LinkedKpiResultID: '',
    EnteredByUserID: actingUser.UserID,
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'INSURANCE_AUDIT_RECORDED', 'InsuranceAudit', audit.AuditID, input.yearMonth);
  return audit;
}

function updateInsuranceAuditExplanation(actingUser, auditId, input) {
  const audit = getSheetRepository(SHEETS.INSURANCE_AUDITS).findById('AuditID', auditId);
  if (!audit) throw new Error('Không tìm thấy dữ liệu xuất toán.');
  requirePermission(actingUser, audit.DepartmentID, 'CanEdit', 'INSURANCE_AUDIT');

  const updated = getSheetRepository(SHEETS.INSURANCE_AUDITS).updateById('AuditID', auditId, {
    ExplanationStatus: input.explanationStatus || audit.ExplanationStatus,
    ExplanationResult: input.explanationResult != null ? input.explanationResult : audit.ExplanationResult,
    AcceptedAmountAfterExplanation: input.acceptedAmountAfterExplanation != null ? input.acceptedAmountAfterExplanation : audit.AcceptedAmountAfterExplanation,
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'INSURANCE_AUDIT_EXPLANATION_UPDATED', 'InsuranceAudit', auditId, input.explanationStatus || '');
  return updated;
}

// §7: chỉ liên kết được SAU KHI đã có kết luận giải trình (ACCEPTED/REJECTED, không phải PENDING) —
// đúng luồng "Xuất toán -> Phân loại nguyên nhân -> Xác định bộ phận liên quan -> Xác minh -> Xác định
// trách nhiệm -> Xác định mức độ -> Tác động KPI NẾU ĐỦ CĂN CỨ". affectsKpi/kpiResultId đều do người
// có thẩm quyền quyết định thủ công, không có đường tự động nào từ WriteOffAmount tới điểm KPI.
function linkInsuranceAuditToKpi(actingUser, auditId, kpiResultId, affectsKpi) {
  const audit = getSheetRepository(SHEETS.INSURANCE_AUDITS).findById('AuditID', auditId);
  if (!audit) throw new Error('Không tìm thấy dữ liệu xuất toán.');
  requirePermission(actingUser, audit.DepartmentID, 'CanApprove', 'INSURANCE_AUDIT');
  if (audit.ExplanationStatus === 'PENDING') {
    throw new Error('Chỉ liên kết KPI sau khi đã có kết luận giải trình (Đã chấp nhận/Không chấp nhận).');
  }
  if (affectsKpi) {
    const kpiResult = getSheetRepository(SHEETS.KPI_RESULTS).findById('ResultID', kpiResultId);
    if (!kpiResult) throw new Error('Không tìm thấy kết quả KPI.');
  }

  const updated = getSheetRepository(SHEETS.INSURANCE_AUDITS).updateById('AuditID', auditId, {
    AffectsKpi: !!affectsKpi, LinkedKpiResultID: affectsKpi ? kpiResultId : '', UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'INSURANCE_AUDIT_LINKED_TO_KPI', 'InsuranceAudit', auditId, affectsKpi ? kpiResultId : 'Bỏ liên kết');
  return updated;
}

function listInsuranceAuditsByDepartment(user, departmentId, yearMonth) {
  requirePermission(user, departmentId, 'CanView', 'INSURANCE_AUDIT');
  return getSheetRepository(SHEETS.INSURANCE_AUDITS).findAll().filter(function (a) {
    return a.DepartmentID === departmentId && (!yearMonth || a.YearMonth === yearMonth);
  });
}

// Toàn viện — cho Ban Giám đốc/Phòng KH-NV/Phòng TC-KT (quyền CanView phạm vi '*').
function listInsuranceAuditsHospitalWide(user, yearMonth) {
  requirePermission(user, '*', 'CanView', 'INSURANCE_AUDIT');
  return getSheetRepository(SHEETS.INSURANCE_AUDITS).findAll().filter(function (a) {
    return !yearMonth || a.YearMonth === yearMonth;
  });
}
