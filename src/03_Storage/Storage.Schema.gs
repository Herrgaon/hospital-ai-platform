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
  DUTY_TYPES: 'DutyTypes',
  DUTY_POSITIONS: 'DutyPositions',
  ATTENDANCE: 'Attendance',
  ATTENDANCE_ADJUSTMENTS: 'AttendanceAdjustments',
  OVERTIME: 'Overtime',
  OVERTIME_LISTS: 'OvertimeLists',
  OVERTIME_LIST_ITEMS: 'OvertimeListItems',
  MONTHLY_CLINICAL_STATS: 'MonthlyClinicalStats',
  INSURANCE_AUDITS: 'InsuranceAudits',
  TASK_PARTICIPANTS: 'TaskParticipants',
  RECURRING_TASK_TEMPLATES: 'RecurringTaskTemplates',
  EMPLOYEE_FAMILY_MEMBERS: 'EmployeeFamilyMembers',
  POSITIONS: 'Positions',
  JOB_TITLES: 'JobTitles',
  EMPLOYMENT_HISTORY: 'EmploymentHistory',
  QUALIFICATIONS: 'Qualifications',
  EMPLOYEE_ASSIGNMENTS: 'EmployeeAssignments',
  KPI_CRITERION_GROUPS: 'KpiCriterionGroups',
  KPI_RULES: 'KpiRules',
  KPI_RESULTS: 'KpiResults',
  KPI_BONUS_POINTS: 'KpiBonusPoints',
  INCIDENTS: 'Incidents',
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
  // Position = "Chức danh" (chuyên môn, VD "Bác sĩ CKI"); JobTitle = "Chức vụ" (quản lý, VD "Trưởng
  // khoa") — 2 khái niệm khác nhau, cả 2 đều tự do nhập, không phải enum.
  // Status: Active | OnLeave (nghỉ phép/thai sản — vẫn là nhân viên, chỉ tạm không xếp việc/trực mới)
  // | Inactive (nghỉ việc hẳn, khoá đăng nhập — xem deactivateEmployee).
  // RecordOwnerUserID: "Người phụ trách hồ sơ" — người được giao theo dõi/cập nhật hồ sơ nhân sự này
  // (thường 1 chuyên viên TC-HC cụ thể phụ trách 1 nhóm khoa/phòng), THUẦN TÚY để phân công nội bộ +
  // lọc danh sách — KHÔNG thay thế Permissions (không tự cấp quyền sửa), khác với uỷ quyền phê duyệt
  // theo khoa/phòng (Permissions.UserID, xem Auth.Permission.gs) vốn đã có sẵn cho việc "phụ trách
  // duyệt" theo từng chức năng.
  // Bổ sung "Thông tin cá nhân" (trang Hồ sơ nhân viên, 2026-08-15) — tất cả các trường dưới đây đều TỰ
  // DO NHẬP (không phải enum cứng, đúng nguyên tắc "không hard-code danh mục nghiệp vụ khi chưa được
  // duyệt"), cho phép rỗng. PreferredName = "Tên thường gọi" (khác FullName trên giấy tờ).
  [SHEETS.EMPLOYEES]: [
    'EmployeeID', 'EmployeeCode', 'UserID', 'FullName', 'DepartmentID', 'Position', 'JobTitle', 'EmployeeType',
    'PhoneNumber', 'Email', 'StartDate', 'Status', 'RecordOwnerUserID',
    'PreferredName', 'DateOfBirth', 'Gender', 'MaritalStatus', 'Nationality', 'Ethnicity',
    'IdNumber', 'IdIssueDate', 'IdIssuePlace', 'Hometown', 'PermanentAddress', 'ContactAddress',
    'BloodType', 'HeightCm', 'WeightKg',
    'CreatedAt', 'UpdatedAt'
  ],

  // Quản lý công việc (khối hành chính) — TaskAssignment/TaskResult gộp vào 1 dòng, không tách sheet
  // riêng. Status: ASSIGNED | IN_PROGRESS | SUBMITTED | EVALUATED.
  // Bổ sung theo đặc tả KPI + Quản lý Trực V1 §8-11 (2026-08-15):
  // - ParentTaskID: rỗng = task cha (có thể là KPI Task); có giá trị = Subtask — KHÔNG BAO GIỜ tính
  //   KPI riêng (đúng §10 "không được tính trùng task"), dù IsKpiTask có được bật hay không.
  // - IsKpiTask: đánh dấu THỦ CÔNG bởi người giao/đánh giá — chỉ Task được đánh dấu rõ ràng mới tạo
  //   giá trị KPI (đúng §10/§15 "chỉ sản phẩm/task được xác định là KPI Task mới tạo giá trị KPI"),
  //   không tự động suy ra từ việc có Subtask hay không.
  // - BaseValue: "Giá trị cơ sở" (§8) — người giao gán khi giao việc, đơn vị do bệnh viện tự quy ước.
  // - ComplexityScoresJson/ComplexityP/ComplexityLevel: "Độ phức tạp nhiệm vụ" (§9) — người đánh giá
  //   chấm 6 tiêu chí 1-5 điểm khi đánh giá (evaluateTask), hệ thống tự tính P + phân loại, KHÔNG cho
  //   người thực hiện tự chấm (đúng nguyên tắc "không để nhân viên tự ý điều chỉnh điểm").
  // - QualityCoefficient: "Hệ số chất lượng" (§8) — người đánh giá gán, mặc định 1 nếu bỏ trống.
  //
  // Bổ sung theo đặc tả bổ sung "Công việc định kỳ theo chu kỳ V1" (2026-08-15):
  // - SourceType: ASSIGNED (được giao — AssignerEmployeeID khác AssigneeEmployeeID) | PERSONAL (tự lập
  //   — không cần quyền CanCreate, chỉ cần có hồ sơ nhân viên) | SYSTEM (hệ thống tự sinh — dự phòng,
  //   chưa dùng ở V1) | RECURRING (sinh từ RecurringTaskTemplates). KHÔNG mặc nhiên là KPI dù thuộc
  //   nguồn nào — chỉ IsKpiTask=true mới tính (đúng §14 "công việc định kỳ không mặc nhiên là KPI").
  // - TemplateID: rỗng nếu không phải instance định kỳ; có giá trị = tham chiếu
  //   RecurringTaskTemplates.TemplateID sinh ra dòng này.
  // - Period: "kỳ công việc" (§8, VD "2026-08" cho việc hàng tháng) — PHÂN BIỆT với AssignedDate (ngày
  //   sinh instance) và DueDate (hạn) đúng yêu cầu đặc tả, dùng để chống sinh trùng instance cùng kỳ.
  // - TransferredFromTaskID: đúng §13 "chuyển kỳ phải lưu liên kết Task gốc/Task mới" — CHỈ điền trên
  //   task MỚI khi được tạo qua transferTaskToNextPeriod (Task.Service.gs), trỏ về TaskID gốc đã bị
  //   CANCELLED. Lý do + thời điểm chuyển đã có sẵn trong Audit Log (không nhân đôi dữ liệu).
  [SHEETS.TASKS]: [
    'TaskID', 'Title', 'Description', 'DepartmentID',
    'AssignerEmployeeID', 'AssigneeEmployeeID', 'AssignedDate', 'DueDate',
    'Priority', 'Progress', 'Status', 'Result', 'AttachmentFolderDriveID',
    'EvaluatorEmployeeID', 'EvaluationScore', 'EvaluationComment', 'EvaluatedAt',
    'ParentTaskID', 'IsKpiTask', 'BaseValue',
    'ComplexityScoresJson', 'ComplexityP', 'ComplexityLevel', 'QualityCoefficient',
    'SourceType', 'TemplateID', 'Period', 'TransferredFromTaskID',
    'CreatedAt', 'UpdatedAt'
  ],

  // Mẫu công việc định kỳ (§9 đặc tả bổ sung) — TÁCH RIÊNG Template khỏi từng lần phát sinh (Task
  // Instance, dùng lại chính sheet TASKS với TemplateID tham chiếu tới đây), đúng "không tạo 1 công
  // việc duy nhất rồi đổi ngày tháng liên tục". Frequency: DAILY|WEEKLY|MONTHLY|QUARTERLY|YEARLY.
  // DeadlineType: NONE|FIXED|RELATIVE — DeadlineRuleJson diễn giải theo từng loại (VD FIXED:
  // {"dayOfPeriod":5} = ngày 05 của kỳ kế tiếp; RELATIVE: {"daysAfterStart":7} = +7 ngày kể từ ngày bắt
  // đầu kỳ). Status: ACTIVE|PAUSED|ENDED — tạm dừng KHÔNG sinh instance mới nhưng KHÔNG xoá instance đã
  // sinh trước đó (đúng §12 "Task Instance đã sinh không được tự động xoá khi Template bị tạm dừng").
  [SHEETS.RECURRING_TASK_TEMPLATES]: [
    'TemplateID', 'Title', 'Description', 'AssigneeEmployeeID', 'DepartmentID',
    'Frequency', 'EffectiveFrom', 'EffectiveTo',
    'HasDeadline', 'DeadlineType', 'DeadlineRuleJson',
    'Priority', 'IsKpiTask', 'Status',
    'CreatedByUserID', 'CreatedAt', 'UpdatedAt'
  ],

  // §11 "Nhiều người cùng làm" — CHỈ dùng khi 1 task có từ 2 người trở lên; task 1-người-1-việc như
  // trước đây (Giai đoạn 1) không cần tạo dòng nào ở đây, AssigneeEmployeeID trên Tasks vẫn coi là
  // 100% giá trị (xem Kpi.Engine.gs#getTaskParticipantShares_). Tổng ValuePercent của các dòng cùng
  // TaskID phải = 100 (kiểm tra ở Task.Service.gs#addTaskParticipant).
  [SHEETS.TASK_PARTICIPANTS]: [
    'TaskParticipantID', 'TaskID', 'EmployeeID', 'RoleInTask', 'ValuePercent', 'CreatedAt'
  ],

  // "Thông tin người thân" trên trang Hồ sơ nhân viên — Relationship tự do nhập (VD "Vợ"/"Con"/"Bố"...).
  [SHEETS.EMPLOYEE_FAMILY_MEMBERS]: [
    'FamilyMemberID', 'EmployeeID', 'Relationship', 'FullName', 'PhoneNumber', 'BirthYear',
    'CreatedAt', 'UpdatedAt'
  ],

  // Đặc tả tái cấu trúc Nhân sự V1 (2026-08-15) §14: "Chức danh" (chuyên môn, VD "Bác sĩ") và "Chức vụ"
  // (quản lý, VD "Trưởng khoa") tách 2 danh mục CẤU HÌNH ĐƯỢC — cùng pattern DutyTypes/DutyPositions
  // (08_DutySchedule/DutySchedule.Catalog.gs). Employees.Position/JobTitle VẪN LÀ CỘT TEXT (không đổi
  // sang khoá ngoại) — không nơi nào trong hệ thống so khớp chính xác 2 cột này cho logic nghiệp vụ
  // (KPI dùng EmployeeType, không dùng Position — xem Kpi.Service.gs#getApplicableKpiRulesForEmployee),
  // nên chỉ cần UI chọn từ danh mục thay vì gõ tự do là đủ đáp ứng "không nhập tự do tuỳ ý", không cần
  // đổi kiểu dữ liệu rủi ro cao.
  [SHEETS.POSITIONS]: ['PositionID', 'PositionName', 'Description', 'Status', 'CreatedAt', 'UpdatedAt'],
  [SHEETS.JOB_TITLES]: ['JobTitleID', 'JobTitleName', 'Description', 'Status', 'CreatedAt', 'UpdatedAt'],

  // "Quá trình công tác" (§8) — lịch sử đơn vị/chức danh/chức vụ theo thời gian. EndDate rỗng = giai
  // đoạn đang hiệu lực (dòng mới nhất của 1 nhân viên). Sinh tự động bởi
  // Employee.Service.gs#changeEmployeeAssignment khi đổi khoa/phòng hoặc chức danh/chức vụ — KHÔNG sinh
  // khi chỉ sửa thông tin cá nhân (SĐT/địa chỉ...) để tránh làm loãng lịch sử.
  [SHEETS.EMPLOYMENT_HISTORY]: [
    'HistoryID', 'EmployeeID', 'DepartmentID', 'Position', 'JobTitle',
    'StartDate', 'EndDate', 'Note', 'CreatedByUserID', 'CreatedAt'
  ],

  // "Bằng cấp & Chứng chỉ" (§9) — V1 chỉ quản lý dữ liệu hồ sơ cơ bản, CHƯA xây cảnh báo hết hạn (đúng
  // đặc tả §18 "chưa làm ở V1"). Type tự do nhập (VD "Bằng cấp"/"Chuyên khoa"/"Chứng chỉ").
  [SHEETS.QUALIFICATIONS]: [
    'QualificationID', 'EmployeeID', 'Type', 'Name', 'IssueDate', 'ExpiryDate',
    'IssuingOrg', 'EvidenceNote', 'CreatedAt', 'UpdatedAt'
  ],

  // "Phân công nhân sự" (§15) — CỐ Ý tách khỏi Permissions (phân quyền hệ thống) và RecordOwnerUserID
  // (phụ trách hồ sơ) — đây là "người đó được giao vị trí/nhiệm vụ gì trong tổ chức", một khái niệm
  // nghiệp vụ/tổ chức thuần tuý, không cấp bất kỳ quyền thao tác hệ thống nào. EndDate rỗng = đang hiệu
  // lực. Một nhân viên có thể có nhiều dòng theo thời gian (lịch sử phân công).
  [SHEETS.EMPLOYEE_ASSIGNMENTS]: [
    'AssignmentID', 'EmployeeID', 'AssignmentText', 'StartDate', 'EndDate',
    'CreatedByUserID', 'CreatedAt', 'UpdatedAt'
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

  // Danh mục loại trực/vị trí trực — cấu hình được (Admin/Phòng KH-NV quản lý), KHÔNG hard-code trong
  // UI. Bổ sung theo đặc tả KPI + Quản lý Trực & Làm ngoài giờ V1 (2026-08-15).
  [SHEETS.DUTY_TYPES]: ['DutyTypeID', 'DutyTypeName', 'Description', 'Status', 'CreatedAt', 'UpdatedAt'],
  // EmployeeType rỗng = áp dụng cho mọi loại nhân viên; có giá trị = chỉ hiện trong danh sách chọn khi
  // xếp trực cho nhân viên đúng loại đó (VD vị trí "LĐ" chỉ dành Bác sĩ).
  // IsTruongTruc: đánh dấu vị trí trực này = "Trưởng trực" — cấu hình được (KH-NV tự đặt cho đúng vị
  // trí thật của bệnh viện), KHÔNG hard-code tên "TT" trong code. Dùng bởi DutySchedule.RoleGrant.gs
  // để tự động cấp quyền tạm thời SUBMIT_OVERTIME theo ca đúng §31 đặc tả KPI + Quản lý Trực V1.
  [SHEETS.DUTY_POSITIONS]: ['DutyPositionID', 'PositionName', 'EmployeeType', 'IsTruongTruc', 'Description', 'Status', 'CreatedAt', 'UpdatedAt'],

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

  // Làm thêm giờ tự đề nghị (LAM_THEM_GIO) — nhân viên/quản lý tự tạo, duyệt đơn giản 1 bước, KHÔNG
  // gắn với ca trực. KHÁC "Làm ngoài giờ theo ca trực" (§30-36 đặc tả KPI + Quản lý Trực V1) — đúng
  // §17 "3 loại dữ liệu phải tách riêng, không gộp thành 1 bảng", luồng đó có sheet + quy trình riêng ở
  // SHEETS.OVERTIME_LISTS/OVERTIME_LIST_ITEMS (17_OvertimeList/), do Trưởng trực lập theo đúng phạm vi
  // ca được phân công (quyền tự động từ DutySchedule.RoleGrant.gs, không qua Permissions sheet).
  [SHEETS.OVERTIME]: [
    'OvertimeID', 'EmployeeID', 'DepartmentID', 'WorkDate', 'StartTime', 'EndTime', 'Hours',
    'OvertimeType', 'Reason', 'WorkDescription', 'Status',
    'ApprovedByUserID', 'ApprovedAt', 'RejectedByUserID', 'RejectedAt', 'RejectionReason',
    'CreatedAt', 'UpdatedAt'
  ],

  // Làm ngoài giờ theo ca trực — đúng §30-36: Trưởng trực (quyền tự động theo ca, xem
  // DutySchedule.RoleGrant.gs) lập 1 danh sách cho ca mình phụ trách, KH-NV tiếp nhận/kiểm tra/chốt.
  // Status: DRAFT -> SUBMITTED -> KHNV_RECEIVED -> UNDER_REVIEW -> (NEED_REVISION -> DRAFT lại) ->
  // FINALIZED. Unlock*: yêu cầu/duyệt mở khoá để sửa sau khi đã chốt (§36) — KHÔNG tự động khoá theo
  // thời hạn (chưa có giá trị cấu hình được duyệt, xem DutySchedule.RoleGrant.gs quy tắc "không tự suy
  // đoán").
  [SHEETS.OVERTIME_LISTS]: [
    'OvertimeListID', 'DutyShiftID', 'DepartmentID', 'SubmittedByUserID', 'Status',
    'SubmittedAt', 'ReceivedByUserID', 'ReceivedAt', 'ReviewComment',
    'FinalizedByUserID', 'FinalizedAt',
    'UnlockRequestedByUserID', 'UnlockRequestedAt', 'UnlockReason', 'UnlockedByUserID', 'UnlockedAt',
    'CreatedAt', 'UpdatedAt'
  ],
  // Mỗi dòng = 1 nhân viên làm ngoài giờ trong danh sách — đúng bảng ví dụ §30 (Nhân viên/Khoa/Thời
  // gian/Nội dung), dữ liệu nhân sự lấy từ Employees (§30 "không nhập lại họ tên/chức danh thủ công").
  [SHEETS.OVERTIME_LIST_ITEMS]: [
    'OvertimeListItemID', 'OvertimeListID', 'EmployeeID', 'DepartmentID',
    'WorkDate', 'StartTime', 'EndTime', 'WorkDescription', 'CreatedAt', 'UpdatedAt'
  ],

  // Số liệu hoạt động chuyên môn theo tháng — Giai đoạn 3. CHỈ số liệu tổng hợp (không có tên/mã bệnh
  // nhân, không chẩn đoán) — đúng nguyên tắc "không kết nối HIS, không lấy dữ liệu bệnh nhân" xuyên
  // suốt toàn bộ hệ thống. Nguồn: Excel/CSV, form nội bộ, hoặc người được phân quyền
  // (NGUOI_NHAP_SO_LIEU) nhập trực tiếp.
  [SHEETS.MONTHLY_CLINICAL_STATS]: [
    'StatID', 'EmployeeID', 'DepartmentID', 'YearMonth', 'StatType', 'Value',
    'Source', 'EnteredByUserID', 'Notes', 'CreatedAt', 'UpdatedAt'
  ],

  // BHYT/Xuất toán theo tháng, theo khoa/phòng — KHÔNG tự động quy đổi 1 ca xuất toán thành điểm trừ
  // KPI (đúng §7). AffectsKpi/LinkedKpiResultID: chỉ điền SAU KHI ExplanationStatus đã có kết luận
  // (giải trình xong), do người có thẩm quyền quyết định THỦ CÔNG có đưa vào KPI hay không — xem
  // InsuranceAudit.Service.gs#linkInsuranceAuditToKpi.
  [SHEETS.INSURANCE_AUDITS]: [
    'AuditID', 'DepartmentID', 'YearMonth', 'TotalRecords', 'WriteOffCount', 'WriteOffAmount',
    'Reason', 'RelatedDepartmentID', 'RelatedEmployeeID', 'ExplanationStatus', 'ExplanationResult',
    'AcceptedAmountAfterExplanation', 'AffectsKpi', 'LinkedKpiResultID',
    'EnteredByUserID', 'CreatedAt', 'UpdatedAt'
  ],

  // Sự cố/an toàn — đúng §6: KHÔNG tự động trừ KPI khi phát sinh sự cố, phải xác minh nguyên nhân
  // trước. Status: REPORTED -> VERIFYING -> CONCLUDED. RootCauseCategory chỉ điền khi CONCLUDED, theo
  // đúng 6 phân loại đặc tả nêu ví dụ (không do cá nhân/do hệ thống/do quy trình/do nhiều nguyên nhân/
  // do cá nhân/chưa xác định — xem Incident.Service.gs#INCIDENT_ROOT_CAUSE_CATEGORIES). AffectsKpi:
  // quyết định THỦ CÔNG của người kết luận, không tự động suy ra từ RootCauseCategory.
  [SHEETS.INCIDENTS]: [
    'IncidentID', 'DepartmentID', 'RelatedEmployeeID', 'IncidentType', 'Description',
    'ReportedByUserID', 'ReportedAt', 'Status',
    'RootCauseCategory', 'ConclusionNote', 'ConcludedByUserID', 'ConcludedAt',
    'AffectsKpi', 'LinkedKpiResultID', 'CreatedAt', 'UpdatedAt'
  ],

  // KPI là lớp đánh giá, không phải nơi nhân viên tự nhập số liệu — chỉ tiêu/trọng số/cách quy đổi
  // điểm đều cấu hình được qua đây, KHÔNG hard-code công thức trong code. ScoringMethod lưu JSON mô tả
  // cách quy đổi (VD {"type":"LINEAR","target":100,"maxScore":10} hoặc {"type":"THRESHOLD",
  // "thresholds":[...]})  — xem Kpi.Engine.gs.
  // IsCommonCriterion: đúng §3-4 đặc tả KPI + Quản lý Trực V1 — "KPI cá nhân" tách 2 nhánh, TIÊU CHÍ
  // CHUNG TOÀN BỆNH VIỆN (AIDET/5S/Thái độ/Trách nhiệm/Kỷ luật/Phối hợp/Phản ánh sau xác minh — áp dụng
  // MỌI nhân viên, không phân biệt chức danh) và TIÊU CHÍ ĐẶC THÙ THEO CHỨC DANH (ObjectGroup thật,
  // VD "Bác sĩ"). true = tiêu chí chung, ObjectGroup lúc đó bị ép về '*' (xem createKpiRule).
  // Nhóm chỉ tiêu KPI (§13) — "KPI cơ bản = Σ(điểm nhóm × trọng số nhóm)". Weight tính theo %, TỔNG
  // các nhóm Active nên = 100 (kiểm tra mềm ở UI, không chặn cứng — cho phép cấu hình tạm thời trong
  // lúc thiết lập). Chưa có nhóm nào tương ứng = KpiRule đó không đóng góp vào KPI tổng cuối kỳ, chỉ
  // dùng để lưu tham khảo — GroupID trên KpiRules để trống là hợp lệ.
  [SHEETS.KPI_CRITERION_GROUPS]: ['GroupID', 'GroupName', 'Weight', 'Status', 'CreatedAt', 'UpdatedAt'],

  // KPI là lớp đánh giá, không phải nơi nhân viên tự nhập số liệu — chỉ tiêu/trọng số/cách quy đổi
  // điểm đều cấu hình được qua đây, KHÔNG hard-code công thức trong code. ScoringMethod lưu JSON mô tả
  // cách quy đổi (VD {"type":"LINEAR","target":100,"maxScore":10} hoặc {"type":"THRESHOLD",
  // "thresholds":[...]})  — xem Kpi.Engine.gs.
  // IsCommonCriterion: đúng §3-4 đặc tả KPI + Quản lý Trực V1 — "KPI cá nhân" tách 2 nhánh, TIÊU CHÍ
  // CHUNG TOÀN BỆNH VIỆN (AIDET/5S/Thái độ/Trách nhiệm/Kỷ luật/Phối hợp/Phản ánh sau xác minh — áp dụng
  // MỌI nhân viên, không phân biệt chức danh) và TIÊU CHÍ ĐẶC THÙ THEO CHỨC DANH (ObjectGroup thật,
  // VD "Bác sĩ"). true = tiêu chí chung, ObjectGroup lúc đó bị ép về '*' (xem createKpiRule).
  // GroupID: thuộc nhóm chỉ tiêu nào (KpiCriterionGroups) — quyết định trọng số khi gộp vào KPI tổng.
  // ScopeType: INDIVIDUAL (mặc định, đánh giá cá nhân) | DEPARTMENT (đúng §12 "KPI quản lý = KPI cá
  // nhân + KPI đơn vị/lĩnh vực phụ trách" — kết quả vẫn ghi nhận trên EmployeeID của người quản lý,
  // ScopeType chỉ là nhãn phân loại để UI hiển thị đúng ngữ cảnh, KHÔNG đổi cách tính điểm).
  // DataSourceType/DataSourceKey: gợi ý tự tính ActualValue từ dữ liệu thật đã có (§14 "dữ liệu KPI
  // phải có nguồn") thay vì bắt nhập tay — MANUAL (mặc định, nhập tay), TASK_COMPLETION (tự tính từ
  // % hoàn thành giá trị Task đã giao, xem Kpi.Engine.gs#computeTaskCompletionPercentForPeriod_),
  // CLINICAL_STAT (tự tính từ MonthlyClinicalStats.StatType = DataSourceKey). Tự tính chỉ để ĐIỀN SẴN
  // gợi ý — người lập KPI vẫn có thể sửa tay trước khi gửi, không bỏ qua bước con người xác nhận.
  [SHEETS.KPI_RULES]: [
    'RuleID', 'ObjectGroup', 'IsCommonCriterion', 'GroupID', 'ScopeType',
    'DataSourceType', 'DataSourceKey', 'Criterion', 'Weight', 'ScoringMethodJson',
    'EffectiveFrom', 'EffectiveTo', 'Version', 'Status', 'CreatedAt', 'UpdatedAt'
  ],

  [SHEETS.KPI_RESULTS]: [
    'ResultID', 'EmployeeID', 'DepartmentID', 'Period', 'RuleID', 'Criterion',
    'ActualValue', 'Score', 'ManagerComment', 'Status',
    'EvaluatedByUserID', 'EvaluatedAt', 'CreatedAt', 'UpdatedAt'
  ],

  // "Điểm cộng" tuỳ chọn khi tổng hợp KPI cuối kỳ (§13: "KPI cuối = min(100, KPI cơ bản + điểm cộng)")
  // — cấp thủ công bởi người có thẩm quyền (KH-NV/SUPER_ADMIN), có lý do, không tự động phát sinh.
  [SHEETS.KPI_BONUS_POINTS]: ['BonusID', 'EmployeeID', 'Period', 'Points', 'Reason', 'GrantedByUserID', 'GrantedAt', 'CreatedAt'],

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
  [SHEETS.EMPLOYEES]: ['StartDate', 'DateOfBirth', 'IdIssueDate'],
  [SHEETS.TASKS]: ['DueDate', 'Period'],
  [SHEETS.RECURRING_TASK_TEMPLATES]: ['EffectiveFrom', 'EffectiveTo'],
  [SHEETS.EMPLOYMENT_HISTORY]: ['StartDate', 'EndDate'],
  [SHEETS.QUALIFICATIONS]: ['IssueDate', 'ExpiryDate'],
  [SHEETS.EMPLOYEE_ASSIGNMENTS]: ['StartDate', 'EndDate'],
  [SHEETS.CLINICAL_ASSIGNMENTS]: ['AssignmentDate', 'ShiftStart', 'ShiftEnd'],
  [SHEETS.DUTY_SCHEDULES]: ['WeekStartDate', 'WeekEndDate'],
  [SHEETS.DUTY_SHIFTS]: ['ShiftDate', 'ShiftStart', 'ShiftEnd'],
  [SHEETS.ATTENDANCE]: ['WorkDate', 'CheckIn', 'CheckOut'],
  [SHEETS.OVERTIME]: ['WorkDate', 'StartTime', 'EndTime'],
  [SHEETS.OVERTIME_LIST_ITEMS]: ['WorkDate', 'StartTime', 'EndTime'],
  [SHEETS.MONTHLY_CLINICAL_STATS]: ['YearMonth'],
  [SHEETS.INSURANCE_AUDITS]: ['YearMonth'],
  [SHEETS.KPI_RULES]: ['EffectiveFrom', 'EffectiveTo'],
  // KPI_RESULTS.Period: lỗ hổng có sẵn từ trước phiên này (dạng "YYYY-MM" giống YearMonth ở
  // MONTHLY_CLINICAL_STATS/INSURANCE_AUDITS nhưng bị bỏ sót khỏi danh sách này) — vá luôn khi phát
  // hiện lúc mở rộng KPI Engine, dùng cùng logic apply-format-trước-khi-ghi đã áp dụng cho các cột
  // khác trong toàn hệ thống.
  [SHEETS.KPI_RESULTS]: ['Period'],
  [SHEETS.KPI_BONUS_POINTS]: ['Period'],
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
