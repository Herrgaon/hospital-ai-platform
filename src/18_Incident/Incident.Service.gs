// Sự cố/An toàn — đúng §6 đặc tả KPI + Quản lý Trực V1: "KHÔNG được tự động trừ KPI khi phát sinh sự
// cố" — phải qua quy trình Tiếp nhận -> Xác minh -> Kết luận -> Xác định nguyên nhân -> Xác định trách
// nhiệm -> Xác định mức độ -> Xem xét tác động KPI, MỖI bước đều do con người quyết định, không có
// đường tắt tự động nào đi thẳng từ "có sự cố" tới "trừ điểm KPI".

// Đúng nguyên văn ví dụ phân loại nguyên nhân trong đặc tả §6 — KHÔNG tự thêm/bớt loại.
const INCIDENT_ROOT_CAUSE_CATEGORIES = {
  KHONG_DO_CA_NHAN: 'Không do cá nhân',
  DO_HE_THONG: 'Do hệ thống',
  DO_QUY_TRINH: 'Do quy trình',
  DO_NHIEU_NGUYEN_NHAN: 'Do nhiều nguyên nhân',
  DO_CA_NHAN: 'Do cá nhân',
  CHUA_XAC_DINH: 'Chưa xác định'
};

// Báo cáo sự cố mở cho MỌI nhân viên đang hoạt động — không giới hạn ở người có quyền CanCreate (một
// sự cố an toàn cần được báo cáo bởi bất kỳ ai chứng kiến/liên quan, không riêng quản lý).
function reportIncident(actingUser, input) {
  const reporter = getEmployeeByUserId_(actingUser.UserID);
  if (!reporter) throw new Error('Chỉ nhân viên có hồ sơ mới báo cáo được sự cố.');
  if (isBlank(input.departmentId) || isBlank(input.description)) {
    throw new Error('Thiếu khoa/phòng hoặc mô tả sự cố.');
  }

  const incident = getSheetRepository(SHEETS.INCIDENTS).append({
    IncidentID: generateId('INC'),
    DepartmentID: input.departmentId,
    RelatedEmployeeID: input.relatedEmployeeId || '',
    IncidentType: input.incidentType || '',
    Description: input.description,
    ReportedByUserID: actingUser.UserID,
    ReportedAt: nowIso(),
    Status: 'REPORTED',
    RootCauseCategory: '', ConclusionNote: '', ConcludedByUserID: '', ConcludedAt: '',
    AffectsKpi: false, LinkedKpiResultID: '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'INCIDENT_REPORTED', 'Incident', incident.IncidentID, input.description);
  return incident;
}

function startIncidentVerification(actingUser, incidentId) {
  const incident = getSheetRepository(SHEETS.INCIDENTS).findById('IncidentID', incidentId);
  if (!incident) throw new Error('Không tìm thấy sự cố.');
  requirePermission(actingUser, incident.DepartmentID, 'CanApprove');
  if (incident.Status !== 'REPORTED') throw new Error('Chỉ có thể bắt đầu xác minh sự cố mới báo cáo.');

  const updated = getSheetRepository(SHEETS.INCIDENTS).updateById('IncidentID', incidentId, {
    Status: 'VERIFYING', UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'INCIDENT_VERIFICATION_STARTED', 'Incident', incidentId, '');
  return updated;
}

// affectsKpi mặc định false — CHỈ true khi người kết luận CHỦ ĐỘNG đánh dấu, không tự động suy ra từ
// rootCauseCategory (kể cả DO_CA_NHAN cũng không tự động = true, đúng tinh thần "phần mềm không tự
// kết luận trách nhiệm pháp lý/chuyên môn" của §6/§26).
function concludeIncident(actingUser, incidentId, input) {
  const incident = getSheetRepository(SHEETS.INCIDENTS).findById('IncidentID', incidentId);
  if (!incident) throw new Error('Không tìm thấy sự cố.');
  requirePermission(actingUser, incident.DepartmentID, 'CanApprove');
  if (incident.Status !== 'VERIFYING') throw new Error('Chỉ có thể kết luận sự cố đang xác minh.');
  if (!INCIDENT_ROOT_CAUSE_CATEGORIES[input.rootCauseCategory]) throw new Error('Phân loại nguyên nhân không hợp lệ.');

  const updated = getSheetRepository(SHEETS.INCIDENTS).updateById('IncidentID', incidentId, {
    Status: 'CONCLUDED',
    RootCauseCategory: input.rootCauseCategory,
    ConclusionNote: input.conclusionNote || '',
    ConcludedByUserID: actingUser.UserID,
    ConcludedAt: nowIso(),
    AffectsKpi: !!input.affectsKpi,
    UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'INCIDENT_CONCLUDED', 'Incident', incidentId, input.rootCauseCategory + (input.affectsKpi ? ' (có ảnh hưởng KPI)' : ''));
  return updated;
}

// Liên kết 1 sự cố ĐÃ KẾT LUẬN + AffectsKpi=true với 1 KpiResult cụ thể — bước cuối cùng, vẫn do con
// người thực hiện thủ công (không có API nào tự tạo KpiResult từ Incident).
function linkIncidentToKpiResult(actingUser, incidentId, kpiResultId) {
  const incident = getSheetRepository(SHEETS.INCIDENTS).findById('IncidentID', incidentId);
  if (!incident) throw new Error('Không tìm thấy sự cố.');
  requirePermission(actingUser, incident.DepartmentID, 'CanApprove');
  if (incident.Status !== 'CONCLUDED' || !incident.AffectsKpi) {
    throw new Error('Chỉ liên kết được sự cố đã kết luận và được đánh dấu có ảnh hưởng KPI.');
  }
  const kpiResult = getSheetRepository(SHEETS.KPI_RESULTS).findById('ResultID', kpiResultId);
  if (!kpiResult) throw new Error('Không tìm thấy kết quả KPI.');

  const updated = getSheetRepository(SHEETS.INCIDENTS).updateById('IncidentID', incidentId, {
    LinkedKpiResultID: kpiResultId, UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'INCIDENT_LINKED_TO_KPI', 'Incident', incidentId, kpiResultId);
  return updated;
}

function listIncidentsByDepartment(user, departmentId) {
  requirePermission(user, departmentId, 'CanView');
  return getSheetRepository(SHEETS.INCIDENTS).findAll().filter(function (i) { return i.DepartmentID === departmentId; });
}

function listMyReportedIncidents(user) {
  return getSheetRepository(SHEETS.INCIDENTS).findAll().filter(function (i) { return i.ReportedByUserID === user.UserID; });
}
