// Dữ liệu mặc định được nạp bởi InitializeSystem.

function getDefaultRoles_() {
  return [
    { RoleID: ROLE_NAMES.SUPER_ADMIN, RoleName: 'Quản trị hệ thống', Description: 'Toàn quyền quản trị hệ thống' },
    { RoleID: ROLE_NAMES.BAN_GIAM_DOC, RoleName: 'Ban Giám đốc', Description: 'Xem tổng quan toàn viện, xuất báo cáo' },
    { RoleID: ROLE_NAMES.PHONG_KH_NV, RoleName: 'Phòng Kế hoạch – Nghiệp vụ', Description: 'Duyệt/công bố lịch trực, quản lý công việc chuyên môn toàn viện' },
    { RoleID: ROLE_NAMES.PHONG_TC_KT, RoleName: 'Phòng Tài chính – Kế toán', Description: 'Xem dữ liệu tổng hợp phục vụ kế toán' },
    { RoleID: ROLE_NAMES.PHONG_TC_HC, RoleName: 'Phòng Tổ chức – Hành chính', Description: 'Quản lý hồ sơ nhân viên, danh mục khoa/phòng' },
    { RoleID: ROLE_NAMES.TRUONG_KHOA, RoleName: 'Trưởng khoa/phòng', Description: 'Quản lý công việc, phân công, lịch trực trong khoa/phòng phụ trách' },
    { RoleID: ROLE_NAMES.PHO_KHOA, RoleName: 'Phó khoa/phòng', Description: 'Hỗ trợ Trưởng khoa/phòng' },
    { RoleID: ROLE_NAMES.NHAN_VIEN, RoleName: 'Nhân viên', Description: 'Xem công việc/lịch trực của bản thân' },
    { RoleID: ROLE_NAMES.KE_TOAN, RoleName: 'Kế toán', Description: 'Xem dữ liệu tổng hợp thu nhập (đầy đủ ở Giai đoạn 2)' },
    { RoleID: ROLE_NAMES.NGUOI_LAP_LICH_TRUC, RoleName: 'Người lập lịch trực', Description: 'Được uỷ quyền lập lịch trực trong khoa/phòng' },
    { RoleID: ROLE_NAMES.NGUOI_NHAP_SO_LIEU, RoleName: 'Người nhập số liệu', Description: 'Nhập số liệu hoạt động chuyên môn (đầy đủ ở Giai đoạn 3)' },
    { RoleID: ROLE_NAMES.GUEST, RoleName: 'Chưa phân quyền', Description: 'Tài khoản mới đăng nhập lần đầu, chưa được gán vai trò/hồ sơ nhân viên' }
  ];
}

// Ma trận mặc định — chỉ seed các dòng phạm vi TOÀN VIỆN (DepartmentID='*'). Quyền của Trưởng
// khoa/Phó khoa/Người lập lịch trực được seed RIÊNG theo từng khoa/phòng khi gán HeadUserID
// (xem Department.Service.gs#seedHeadPermission_), không hard-code ở đây. Nhân viên không có dòng
// Permissions nào — truy cập dữ liệu của chính mình qua các hàm listMy* (ownership-filtered),
// không qua Permissions sheet.
function getDefaultPermissions_() {
  return [
    { RoleID: ROLE_NAMES.SUPER_ADMIN, DepartmentID: '*', CanView: true, CanCreate: true, CanEdit: true, CanDelete: true, CanSubmit: true, CanApprove: true, CanReject: true, CanPublish: true, CanLock: true, CanExport: true },
    // CanReject: true — Ban Giám Đốc có thể trả lịch trực về Khoa khi từ chối phê duyệt chính thức
    // (approveDutyScheduleByDirector/requestDutyScheduleRevision, DutySchedule.Workflow.gs, 2026-08-15).
    { RoleID: ROLE_NAMES.BAN_GIAM_DOC, DepartmentID: '*', CanView: true, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: false, CanReject: true, CanPublish: false, CanLock: false, CanExport: true },
    { RoleID: ROLE_NAMES.PHONG_KH_NV, DepartmentID: '*', CanView: true, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: true, CanReject: true, CanPublish: true, CanLock: false, CanExport: true },
    // CanApprove/CanReject (phạm vi '*'): bước duyệt cuối cùng cho Điều chỉnh công. CanLock: chốt
    // chấm công hàng tháng — tập trung ở Phòng TC-HC, không giao cho từng Trưởng khoa/phòng (đúng vai
    // trò quản lý hồ sơ nhân sự/chấm công trung tâm) — xem Attendance.Service.gs.
    { RoleID: ROLE_NAMES.PHONG_TC_HC, DepartmentID: '*', CanView: true, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: true, CanReject: true, CanPublish: false, CanLock: true, CanExport: true },
    { RoleID: ROLE_NAMES.PHONG_TC_KT, DepartmentID: '*', CanView: true, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: false, CanReject: false, CanPublish: false, CanLock: false, CanExport: true },
    { RoleID: ROLE_NAMES.TRUONG_KHOA, DepartmentID: '*', CanView: false, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: false, CanReject: false, CanPublish: false, CanLock: false, CanExport: false },
    { RoleID: ROLE_NAMES.PHO_KHOA, DepartmentID: '*', CanView: false, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: false, CanReject: false, CanPublish: false, CanLock: false, CanExport: false },
    { RoleID: ROLE_NAMES.NHAN_VIEN, DepartmentID: '*', CanView: false, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: false, CanReject: false, CanPublish: false, CanLock: false, CanExport: false },
    { RoleID: ROLE_NAMES.KE_TOAN, DepartmentID: '*', CanView: true, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: false, CanReject: false, CanPublish: false, CanLock: false, CanExport: false },
    { RoleID: ROLE_NAMES.NGUOI_LAP_LICH_TRUC, DepartmentID: '*', CanView: false, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: false, CanReject: false, CanPublish: false, CanLock: false, CanExport: false },
    { RoleID: ROLE_NAMES.NGUOI_NHAP_SO_LIEU, DepartmentID: '*', CanView: true, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: false, CanReject: false, CanPublish: false, CanLock: false, CanExport: false },
    { RoleID: ROLE_NAMES.GUEST, DepartmentID: '*', CanView: false, CanCreate: false, CanEdit: false, CanDelete: false, CanSubmit: false, CanApprove: false, CanReject: false, CanPublish: false, CanLock: false, CanExport: false }
  ].map(function (p) {
    p.PermissionID = generateId('PERM');
    p.UserID = '';
    return p;
  });
}

function getDefaultAIProviders_() {
  // Claude là Provider duy nhất kích hoạt sẵn; các Provider còn lại giữ trong danh mục nhưng
  // IsActive=false cho tới khi có nhu cầu bổ sung — không cần sửa code khi bật, chỉ cần đổi dữ liệu Sheet.
  return [
    { ProviderID: 'claude', ProviderName: 'Claude', BaseURL: 'https://api.anthropic.com', IsActive: true },
    { ProviderID: 'openai', ProviderName: 'OpenAI', BaseURL: 'https://api.openai.com', IsActive: false },
    { ProviderID: 'gemini', ProviderName: 'Gemini', BaseURL: 'https://generativelanguage.googleapis.com', IsActive: false },
    { ProviderID: 'openrouter', ProviderName: 'OpenRouter', BaseURL: 'https://openrouter.ai', IsActive: false },
    { ProviderID: 'local', ProviderName: 'Local (Ollama/LM Studio)', BaseURL: '', IsActive: false }
  ];
}

// 14 khoa/phòng thật của Bệnh viện Đa khoa Đông Sơn — danh mục cấu hình được (Admin/Phòng TC-HC có
// thể thêm/sửa/ngừng hoạt động sau), đây chỉ là dữ liệu khởi tạo ban đầu để hệ thống dùng được ngay.
function getDefaultDepartments_() {
  return [
    { DepartmentName: 'Ban Giám đốc', DepartmentType: DEPARTMENT_TYPES.BAN_GIAM_DOC },
    { DepartmentName: 'Phòng Kế hoạch – Nghiệp vụ', DepartmentType: DEPARTMENT_TYPES.PHONG_CHUC_NANG },
    { DepartmentName: 'Phòng Tổ chức – Hành chính', DepartmentType: DEPARTMENT_TYPES.PHONG_CHUC_NANG },
    { DepartmentName: 'Phòng Tài chính – Kế toán', DepartmentType: DEPARTMENT_TYPES.PHONG_CHUC_NANG },
    { DepartmentName: 'Khoa Dược – Vật tư thiết bị y tế', DepartmentType: DEPARTMENT_TYPES.KHOA_CAN_LAM_SANG },
    { DepartmentName: 'Khoa Xét nghiệm – Chẩn đoán hình ảnh', DepartmentType: DEPARTMENT_TYPES.KHOA_CAN_LAM_SANG },
    { DepartmentName: 'Khoa Kiểm soát nhiễm khuẩn', DepartmentType: DEPARTMENT_TYPES.KHOA_CAN_LAM_SANG },
    { DepartmentName: 'Khoa Khám bệnh', DepartmentType: DEPARTMENT_TYPES.KHOA_LAM_SANG },
    { DepartmentName: 'Khoa Ngoại – RHM – Mắt – TMH', DepartmentType: DEPARTMENT_TYPES.KHOA_LAM_SANG },
    { DepartmentName: 'Khoa Phụ sản', DepartmentType: DEPARTMENT_TYPES.KHOA_LAM_SANG },
    { DepartmentName: 'Khoa Nhi – Truyền nhiễm', DepartmentType: DEPARTMENT_TYPES.KHOA_LAM_SANG },
    { DepartmentName: 'Khoa Cấp cứu – HSTC – Chống độc', DepartmentType: DEPARTMENT_TYPES.KHOA_LAM_SANG },
    { DepartmentName: 'Khoa YHCT – PHCN', DepartmentType: DEPARTMENT_TYPES.KHOA_LAM_SANG },
    { DepartmentName: 'Khoa Nội', DepartmentType: DEPARTMENT_TYPES.KHOA_LAM_SANG }
  ].map(function (d) {
    d.DepartmentID = generateId('DEPT');
    d.ParentDepartmentID = '';
    d.HeadUserID = '';
    d.Status = 'Active';
    d.CreatedAt = nowIso();
    d.UpdatedAt = nowIso();
    return d;
  });
}

// Dữ liệu khởi tạo tối thiểu cho danh mục Loại trực — Phòng KH-NV tự thêm/sửa loại khác qua
// DutySchedule.Catalog.gs khi triển khai thực tế — KHÔNG tự suy đoán thêm danh mục chưa được duyệt.
function getDefaultDutyTypes_() {
  return [
    { DutyTypeName: 'Trực lãnh đạo', Description: 'Trực điều hành chung toàn viện' },
    { DutyTypeName: 'Trực chuyên môn', Description: 'Trực khám/điều trị tại khoa, phòng' }
  ].map(function (t) {
    t.DutyTypeID = generateId('DTYPE');
    t.Status = 'Active';
    t.CreatedAt = nowIso();
    t.UpdatedAt = nowIso();
    return t;
  });
}

// Đúng nguyên văn ví dụ "từ cơ chế hiện tại" ở §21 đặc tả KPI + Quản lý Trực V1 — Bác sĩ: LĐ/TT/PK/
// CC/Nhi; Điều dưỡng-Hộ sinh: CC/PK/Nội/Ngoại/Lây/Sản. "TT" = Trưởng trực, đánh dấu IsTruongTruc: true
// để DutySchedule.RoleGrant.gs tự động cấp quyền SUBMIT_OVERTIME theo ca (§31) — KH-NV có thể đổi tên
// hoặc đánh dấu thêm vị trí khác là Trưởng trực qua màn Danh mục trực, không hard-code chữ "TT".
function getDefaultDutyPositions_() {
  return [
    { PositionName: 'LĐ', EmployeeType: 'Bác sĩ', IsTruongTruc: false, Description: 'Trực lãnh đạo' },
    { PositionName: 'TT', EmployeeType: 'Bác sĩ', IsTruongTruc: true, Description: 'Trưởng trực' },
    { PositionName: 'PK', EmployeeType: 'Bác sĩ', IsTruongTruc: false, Description: 'Trực phòng khám' },
    { PositionName: 'CC', EmployeeType: 'Bác sĩ', IsTruongTruc: false, Description: 'Trực cấp cứu' },
    { PositionName: 'Nhi', EmployeeType: 'Bác sĩ', IsTruongTruc: false, Description: 'Trực nhi' },
    { PositionName: 'CC', EmployeeType: 'Điều dưỡng', IsTruongTruc: false, Description: 'Trực cấp cứu' },
    { PositionName: 'PK', EmployeeType: 'Điều dưỡng', IsTruongTruc: false, Description: 'Trực phòng khám' },
    { PositionName: 'Nội', EmployeeType: 'Điều dưỡng', IsTruongTruc: false, Description: '' },
    { PositionName: 'Ngoại', EmployeeType: 'Điều dưỡng', IsTruongTruc: false, Description: '' },
    { PositionName: 'Lây', EmployeeType: 'Điều dưỡng', IsTruongTruc: false, Description: '' },
    { PositionName: 'Sản', EmployeeType: 'Điều dưỡng', IsTruongTruc: false, Description: '' }
  ].map(function (p) {
    p.DutyPositionID = generateId('DPOS');
    p.Status = 'Active';
    p.CreatedAt = nowIso();
    p.UpdatedAt = nowIso();
    return p;
  });
}
