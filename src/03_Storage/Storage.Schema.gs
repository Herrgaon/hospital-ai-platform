// Nguồn sự thật duy nhất cho tên Sheet/cột — không nơi nào khác được hard-code tên Sheet hay tên cột
// ngoài file này. Repurposed 2026-08-15: hệ thống chuyển từ "Quản lý tài liệu/tri thức" sang
// "Quản lý công việc – Phân công – Lịch trực – Đánh giá – Hỗ trợ tổng hợp thu nhập" (Giai đoạn 1).

const SHEETS = {
  USERS: 'Users',
  ROLES: 'Roles',
  PERMISSIONS: 'Permissions',
  DEPARTMENTS: 'Departments',
  EMPLOYEES: 'Employees',
  TASKS: 'Tasks',
  CLINICAL_ASSIGNMENTS: 'ClinicalAssignments',
  DUTY_SCHEDULES: 'DutySchedules',
  DUTY_SHIFTS: 'DutyShifts',
  DUTY_SWAP_REQUESTS: 'DutySwapRequests',
  ATTENDANCE: 'Attendance',
  ATTENDANCE_ADJUSTMENTS: 'AttendanceAdjustments',
  OVERTIME: 'Overtime',
  MONTHLY_CLINICAL_STATS: 'MonthlyClinicalStats',
  INSURANCE_AUDITS: 'InsuranceAudits',
  KPI_RULES: 'KpiRules',
  KPI_RESULTS: 'KpiResults',
  AI_PROVIDERS: 'AIProviders',
  AI_PROVIDER_CONFIG: 'AIProviderConfig',
  AI_PROVIDER_KEY_HISTORY: 'AIProviderKeyHistory',
  AUDIT_LOG: 'AuditLog',
  SYSTEM_CONFIG: 'SystemConfig'
};

const SCHEMA = {
  // Username: định danh đăng nhập, CỐ Ý tách khỏi Employees.EmployeeCode (mã nhân viên chỉ phục vụ
  // nghiệp vụ/HR, có thể đổi mà không ảnh hưởng đăng nhập, và không phải ai cũng nhớ đúng mã nhân
  // viên) — theo yêu cầu Product Owner 2026-08-15. PasswordHash/PasswordSalt hash bằng PBKDF2 tự dựng
  // qua HMAC-SHA256 (Apps Script không có bcrypt/argon2 sẵn). Rỗng nếu tài khoản chưa từng được đặt
  // mật khẩu.
  [SHEETS.USERS]: ['UserID', 'Email', 'Username', 'FullName', 'Role', 'Department', 'Status', 'CreatedAt', 'UpdatedAt', 'AvatarUrl', 'PasswordHash', 'PasswordSalt'],
  [SHEETS.ROLES]: ['RoleID', 'RoleName', 'Description'],

  // DepartmentID='*' = phạm vi toàn viện (role-global). 10 cờ hành động đúng theo đặc tả:
  // Xem/Tạo/Sửa/Xóa/GửiDuyệt/Duyệt/TừChối/CôngBố/Chốt/XuấtDữLiệu. Không còn CanManage (phân quyền
  // uỷ quyền phi tập trung bị bỏ ở Giai đoạn 1 — xem quyết định trong kế hoạch triển khai).
  [SHEETS.PERMISSIONS]: [
    'PermissionID', 'RoleID', 'UserID', 'DepartmentID',
    'CanView', 'CanCreate', 'CanEdit', 'CanDelete',
    'CanSubmit', 'CanApprove', 'CanReject', 'CanPublish', 'CanLock', 'CanExport'
  ],

  // Repurposed từ Libraries — vừa là đơn vị tổ chức (khoa/phòng) vừa là phạm vi phân quyền.
  // DepartmentType: BAN_GIAM_DOC | PHONG_CHUC_NANG | KHOA_LAM_SANG | KHOA_CAN_LAM_SANG.
  [SHEETS.DEPARTMENTS]: [
    'DepartmentID', 'DepartmentName', 'DepartmentType', 'ParentDepartmentID',
    'HeadUserID', 'Status', 'CreatedAt', 'UpdatedAt'
  ],

  // Hồ sơ nhân viên trung tâm — MỌI module khác đều tham chiếu qua EmployeeID, không lặp lại thông
  // tin định danh (đăng nhập/identity vẫn thuộc Users, qua UserID). EmployeeType dùng cho việc chọn
  // bộ chỉ tiêu KPI theo vai trò ở Giai đoạn 3 (Bác sĩ/Điều dưỡng/Kỹ thuật viên/Hành chính/Kế toán/Quản lý).
  // EmployeeCode: mã nhân viên do HR/Admin gán (VD "BS001") — định danh đăng nhập cho Gateway/Desktop,
  // KHÁC EmployeeID (khoá hệ thống tự sinh, không đổi được). Rỗng cho tới khi được gán.
  [SHEETS.EMPLOYEES]: [
    'EmployeeID', 'EmployeeCode', 'UserID', 'FullName', 'DepartmentID', 'Position', 'EmployeeType',
    'PhoneNumber', 'Email', 'StartDate', 'Status', 'CreatedAt', 'UpdatedAt'
  ],

  // Quản lý công việc (khối hành chính) — TaskAssignment/TaskResult gộp vào 1 dòng, không tách sheet
  // riêng (không có yêu cầu nhiều người nhận 1 việc ở Giai đoạn 1 — YAGNI).
  // Status: ASSIGNED | IN_PROGRESS | SUBMITTED | EVALUATED.
  [SHEETS.TASKS]: [
    'TaskID', 'Title', 'Description', 'DepartmentID',
    'AssignerEmployeeID', 'AssigneeEmployeeID', 'AssignedDate', 'DueDate',
    'Priority', 'Progress', 'Status', 'Result', 'AttachmentFolderDriveID',
    'EvaluatorEmployeeID', 'EvaluationScore', 'EvaluationComment', 'EvaluatedAt',
    'CreatedAt', 'UpdatedAt'
  ],

  // Phân công khối lâm sàng (khám/điều trị/hội chẩn/phẫu thuật/thủ thuật) — cố tình tối giản, KHÁC
  // Lịch trực (không có quy trình duyệt/công bố riêng, chỉ là lịch phân công công việc thường ngày).
  [SHEETS.CLINICAL_ASSIGNMENTS]: [
    'AssignmentID', 'EmployeeID', 'DepartmentID', 'AssignmentDate', 'WorkType',
    'ShiftStart', 'ShiftEnd', 'AssignedByUserID', 'Status', 'Notes', 'CreatedAt', 'UpdatedAt'
  ],

  // Lịch trực tuần — module trọng tâm Giai đoạn 1. Status có nhánh yêu cầu chỉnh sửa riêng:
  // DRAFT -> SUBMITTED -> UNDER_REVIEW -> (NEED_REVISION -> DRAFT lại) -> APPROVED -> PUBLISHED.
  // Không dùng lại 08_Workflow (đã xoá — chỉ dùng cho Document, state machine không khớp).
  [SHEETS.DUTY_SCHEDULES]: [
    'DutyScheduleID', 'DepartmentID', 'WeekStartDate', 'WeekEndDate', 'Status',
    'CreatedByUserID', 'SubmittedAt', 'ReviewedByUserID', 'ReviewComment', 'ReviewedAt',
    'ApprovedByUserID', 'ApprovedAt', 'PublishedByUserID', 'PublishedAt',
    'CreatedAt', 'UpdatedAt'
  ],

  // Status: PLANNED (khi lịch còn DRAFT/SUBMITTED/UNDER_REVIEW/NEED_REVISION) | OFFICIAL (lịch đã
  // PUBLISHED) | SWAPPED_OUT (đã đổi trực, giữ lại để xem lịch sử) | CANCELLED.
  [SHEETS.DUTY_SHIFTS]: [
    'DutyShiftID', 'DutyScheduleID', 'DepartmentID', 'ShiftDate', 'DutyType',
    'EmployeeID', 'RoleInShift', 'ShiftStart', 'ShiftEnd', 'AssignedByUserID',
    'Status', 'OriginatingSwapRequestID', 'Notes', 'CreatedAt', 'UpdatedAt'
  ],

  // Đổi trực — lịch sử đầy đủ suy ra được từ OriginalShiftID (lịch ban đầu) + NewShiftID (lịch sau
  // thay đổi), không cần lưu snapshot JSON. Status: REQUESTED -> REPLACEMENT_CONFIRMED ->
  // DEPT_HEAD_CONFIRMED -> KHNV_APPROVED (hoặc REJECTED ở bất kỳ bước chờ nào).
  [SHEETS.DUTY_SWAP_REQUESTS]: [
    'SwapRequestID', 'OriginalShiftID', 'RequestingEmployeeID', 'ReplacementEmployeeID', 'Reason',
    'Status', 'RequestedAt', 'ReplacementConfirmedAt',
    'DeptHeadConfirmedByUserID', 'DeptHeadConfirmedAt',
    'KhNvApprovedByUserID', 'KhNvApprovedAt', 'NewShiftID',
    'RejectedByUserID', 'RejectedAt', 'RejectionReason',
    'CreatedAt', 'UpdatedAt'
  ],

  // Chấm công — Giai đoạn 2. Status: OPEN (còn sửa được trực tiếp) | LOCKED (đã chốt, mọi thay đổi
  // phải qua AttendanceAdjustments, không sửa thẳng — đúng yêu cầu "không sửa âm thầm dữ liệu đã chốt").
  [SHEETS.ATTENDANCE]: [
    'AttendanceID', 'EmployeeID', 'DepartmentID', 'WorkDate', 'ShiftType',
    'CheckIn', 'CheckOut', 'LeaveType', 'WorkUnits', 'Status', 'Notes',
    'RecordedByUserID', 'CreatedAt', 'UpdatedAt'
  ],

  // Điều chỉnh công — sub-workflow độc lập, giữ nguyên giá trị cũ/mới để có lịch sử đầy đủ.
  // Status: REQUESTED -> DEPT_HEAD_CONFIRMED -> APPROVED (hoặc REJECTED ở bước chờ nào).
  [SHEETS.ATTENDANCE_ADJUSTMENTS]: [
    'AdjustmentID', 'AttendanceID', 'RequestedByUserID', 'Reason',
    'OriginalCheckIn', 'OriginalCheckOut', 'OriginalLeaveType', 'OriginalWorkUnits',
    'RequestedCheckIn', 'RequestedCheckOut', 'RequestedLeaveType', 'RequestedWorkUnits',
    'Status', 'RequestedAt', 'DeptHeadConfirmedByUserID', 'DeptHeadConfirmedAt',
    'ApprovedByUserID', 'ApprovedAt', 'RejectedByUserID', 'RejectedAt', 'RejectionReason',
    'CreatedAt', 'UpdatedAt'
  ],

  // Làm thêm giờ/Làm ngoài giờ dùng chung 1 sheet, phân biệt bằng OvertimeType — cùng hình dạng dữ
  // liệu (người làm/ngày/thời gian/lý do/công việc/trạng thái duyệt), khác nhau ở BẢN CHẤT phân loại,
  // không cần 2 bảng riêng (YAGNI). OvertimeType: LAM_THEM_GIO | LAM_NGOAI_GIO.
  [SHEETS.OVERTIME]: [
    'OvertimeID', 'EmployeeID', 'DepartmentID', 'WorkDate', 'StartTime', 'EndTime', 'Hours',
    'OvertimeType', 'Reason', 'WorkDescription', 'Status',
    'ApprovedByUserID', 'ApprovedAt', 'RejectedByUserID', 'RejectedAt', 'RejectionReason',
    'CreatedAt', 'UpdatedAt'
  ],

  // Số liệu hoạt động chuyên môn theo tháng — Giai đoạn 3. CHỈ số liệu tổng hợp (không có tên/mã bệnh
  // nhân, không chẩn đoán) — đúng nguyên tắc "không kết nối HIS, không lấy dữ liệu bệnh nhân" xuyên
  // suốt toàn bộ hệ thống. Nguồn: Excel/CSV, form nội bộ, hoặc người được phân quyền
  // (NGUOI_NHAP_SO_LIEU) nhập trực tiếp.
  [SHEETS.MONTHLY_CLINICAL_STATS]: [
    'StatID', 'EmployeeID', 'DepartmentID', 'YearMonth', 'StatType', 'Value',
    'Source', 'EnteredByUserID', 'Notes', 'CreatedAt', 'UpdatedAt'
  ],

  // BHYT/Xuất toán theo tháng, theo khoa/phòng — KHÔNG có cột "điểm KPI bị trừ" (đúng nguyên tắc
  // "không tự động quy đổi 1 ca xuất toán thành điểm trừ KPI" — muốn dùng làm căn cứ đánh giá phải qua
  // KpiResults thủ công, có phân loại nguyên nhân/trách nhiệm trước).
  [SHEETS.INSURANCE_AUDITS]: [
    'AuditID', 'DepartmentID', 'YearMonth', 'TotalRecords', 'WriteOffCount', 'WriteOffAmount',
    'Reason', 'RelatedDepartmentID', 'RelatedEmployeeID', 'ExplanationStatus', 'ExplanationResult',
    'AcceptedAmountAfterExplanation', 'EnteredByUserID', 'CreatedAt', 'UpdatedAt'
  ],

  // KPI là lớp đánh giá, không phải nơi nhân viên tự nhập số liệu — chỉ tiêu/trọng số/cách quy đổi
  // điểm đều cấu hình được qua đây, KHÔNG hard-code công thức trong code. ScoringMethod lưu JSON mô tả
  // cách quy đổi (VD {"type":"LINEAR","target":100,"maxScore":10} hoặc {"type":"THRESHOLD",
  // "thresholds":[...]})  — xem Kpi.Engine.gs.
  [SHEETS.KPI_RULES]: [
    'RuleID', 'ObjectGroup', 'Criterion', 'Weight', 'ScoringMethodJson',
    'EffectiveFrom', 'EffectiveTo', 'Version', 'Status', 'CreatedAt', 'UpdatedAt'
  ],

  [SHEETS.KPI_RESULTS]: [
    'ResultID', 'EmployeeID', 'DepartmentID', 'Period', 'RuleID', 'Criterion',
    'ActualValue', 'Score', 'ManagerComment', 'Status',
    'EvaluatedByUserID', 'EvaluatedAt', 'CreatedAt', 'UpdatedAt'
  ],

  [SHEETS.AI_PROVIDERS]: ['ProviderID', 'ProviderName', 'BaseURL', 'IsActive'],
  [SHEETS.AI_PROVIDER_CONFIG]: ['ConfigID', 'ProviderID', 'ModelName', 'ApiKeySecretRef', 'Temperature', 'MaxTokens', 'Timeout', 'IsDefault', 'UpdatedByUserID', 'UpdatedAt'],
  [SHEETS.AI_PROVIDER_KEY_HISTORY]: ['HistoryID', 'ConfigID', 'ChangedByUserID', 'ChangedAt', 'Action'],
  [SHEETS.AUDIT_LOG]: ['LogID', 'Timestamp', 'UserID', 'Action', 'TargetType', 'TargetID', 'Detail'],
  [SHEETS.SYSTEM_CONFIG]: ['Key', 'Value', 'Description', 'UpdatedAt']
};

// 11 vai trò theo đặc tả + GUEST (vai trò "chưa phân quyền" mặc định, dùng bởi
// Auth.Session.gs#getCurrentUser khi tự tạo user lần đầu — fail-closed, không có quyền gì cho tới
// khi Admin/Phòng TC-HC gán vai trò thật + tạo hồ sơ Nhân viên).
const ROLE_NAMES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  BAN_GIAM_DOC: 'BAN_GIAM_DOC',
  PHONG_KH_NV: 'PHONG_KH_NV',
  PHONG_TC_KT: 'PHONG_TC_KT',
  PHONG_TC_HC: 'PHONG_TC_HC',
  TRUONG_KHOA: 'TRUONG_KHOA',
  PHO_KHOA: 'PHO_KHOA',
  NHAN_VIEN: 'NHAN_VIEN',
  KE_TOAN: 'KE_TOAN',
  NGUOI_LAP_LICH_TRUC: 'NGUOI_LAP_LICH_TRUC',
  NGUOI_NHAP_SO_LIEU: 'NGUOI_NHAP_SO_LIEU',
  GUEST: 'GUEST'
};

// Google Sheets tự phát hiện chuỗi trông giống ngày tháng (VD "2026-08-17") và âm thầm chuyển thành
// kiểu Date nội bộ, dù ghi vào bằng setValues() với 1 chuỗi JS thuần — phát hiện qua clasp run thực tế
// (DutySchedules/DutyShifts trả lỗi "returned value is not a supported return type" qua Execution API,
// và toàn bộ logic so sánh chuỗi ngày kiểu a.WorkDate >= dateFrom sẽ sai âm thầm nếu không sửa). Đã
// thực nghiệm xác nhận: định dạng Plain Text ('@') giữ đúng các cột này là CHUỖI, nhưng lại biến
// boolean thành chuỗi "true"/"false" — do đó CHỈ áp dụng '@' cho đúng các cột liệt kê dưới đây, không
// áp cho cả sheet (sẽ phá vỡ toàn bộ Permissions.CanView/CanCreate/...). Xem
// Storage.SheetFormat.gs#applyPlainTextColumnFormats_.
// Cùng cơ chế tự phát hiện cũng áp dụng cho chuỗi giờ "HH:MM" (Sheets coi là giá trị Time-of-day, nội
// bộ vẫn là Date với phần ngày mặc định) — phát hiện qua clasp run thực tế trên DutyShifts.ShiftStart/
// ShiftEnd (lỗi serialization giống hệt lỗi ngày tháng, dù ShiftDate đã sửa đúng). Liệt kê đủ mọi cột
// giờ dạng "HH:MM" trong toàn schema, không chỉ cột ngày tháng.
const PLAIN_TEXT_COLUMNS = {
  [SHEETS.EMPLOYEES]: ['StartDate'],
  [SHEETS.TASKS]: ['DueDate'],
  [SHEETS.CLINICAL_ASSIGNMENTS]: ['AssignmentDate', 'ShiftStart', 'ShiftEnd'],
  [SHEETS.DUTY_SCHEDULES]: ['WeekStartDate', 'WeekEndDate'],
  [SHEETS.DUTY_SHIFTS]: ['ShiftDate', 'ShiftStart', 'ShiftEnd'],
  [SHEETS.ATTENDANCE]: ['WorkDate', 'CheckIn', 'CheckOut'],
  [SHEETS.OVERTIME]: ['WorkDate', 'StartTime', 'EndTime'],
  [SHEETS.MONTHLY_CLINICAL_STATS]: ['YearMonth'],
  [SHEETS.INSURANCE_AUDITS]: ['YearMonth'],
  [SHEETS.KPI_RULES]: ['EffectiveFrom', 'EffectiveTo'],
  [SHEETS.KPI_RESULTS]: ['Period']
};

const DEPARTMENT_TYPES = {
  BAN_GIAM_DOC: 'BAN_GIAM_DOC',
  PHONG_CHUC_NANG: 'PHONG_CHUC_NANG',
  KHOA_LAM_SANG: 'KHOA_LAM_SANG',
  KHOA_CAN_LAM_SANG: 'KHOA_CAN_LAM_SANG'
};

const DRIVE_FOLDERS = {
  ROOT: 'BVDS_ROOT',
  SYSTEM: 'System',
  SYSTEM_LOGS: 'Logs',
  SYSTEM_BACKUPS: 'Backups',
  SYSTEM_AVATARS: 'Avatars',
  SYSTEM_EXPORTS: 'Exports',
  UPLOADS: 'Uploads',
  UPLOADS_TASKS: 'TaskAttachments'
};
