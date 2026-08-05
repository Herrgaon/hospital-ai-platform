// Dữ liệu mặc định được nạp bởi InitializeSystem — xem docs/11-permission-design.md, docs/07-workflow.md.

function getDefaultRoles_() {
  return [
    { RoleID: ROLE_NAMES.ADMIN, RoleName: 'Admin', Description: 'Toàn quyền quản trị hệ thống' },
    { RoleID: ROLE_NAMES.MANAGER, RoleName: 'Manager', Description: 'Quản lý dữ liệu trong phạm vi được giao' },
    { RoleID: ROLE_NAMES.USER, RoleName: 'User', Description: 'Nhân viên nghiệp vụ' },
    { RoleID: ROLE_NAMES.GUEST, RoleName: 'Guest', Description: 'Chỉ xem' }
  ];
}

function getDefaultPermissions_() {
  // Xem ma trận đầy đủ tại docs/11-permission-design.md mục 3.
  // Chỉ Admin có quyền toàn hệ thống ('*'). Manager/User CHỈ được xem ('*' = mọi kho) theo mặc định —
  // quyền Thêm/Sửa/Xoá/Quản lý trong một kho cụ thể do Trưởng khoa/phòng của kho đó cấp riêng
  // (Permissions theo UserID+LibraryID, xem Knowledge.Library.gs#createLibrary và
  // Admin.UserManagement.gs#setUserPermissionOverride) — đúng mô hình "mỗi khoa phòng quản lý
  // riêng kho của mình, người khác chỉ xem" mà Product Owner mô tả (2026-08-05).
  return [
    { RoleID: ROLE_NAMES.ADMIN, LibraryID: '*', CanView: true, CanCreate: true, CanEdit: true, CanDelete: true, CanApprove: true, CanManage: true },
    { RoleID: ROLE_NAMES.MANAGER, LibraryID: '*', CanView: true, CanCreate: false, CanEdit: false, CanDelete: false, CanApprove: false, CanManage: false },
    { RoleID: ROLE_NAMES.USER, LibraryID: '*', CanView: true, CanCreate: false, CanEdit: false, CanDelete: false, CanApprove: false, CanManage: false },
    { RoleID: ROLE_NAMES.GUEST, LibraryID: '*', CanView: true, CanCreate: false, CanEdit: false, CanDelete: false, CanApprove: false, CanManage: false }
  ].map(function (p) {
    p.PermissionID = generateId('PERM');
    p.UserID = '';
    return p;
  });
}

function getDefaultAIProviders_() {
  // Claude là Provider duy nhất kích hoạt sẵn ở giai đoạn đầu (quyết định Product Owner 2026-08-05,
  // xem docs/99-bootstrap-report.md mục 3). Các Provider còn lại giữ trong danh mục nhưng IsActive=false
  // cho tới khi có nhu cầu bổ sung — không cần sửa code khi bật, chỉ cần đổi dữ liệu Sheet.
  return [
    { ProviderID: 'claude', ProviderName: 'Claude', BaseURL: 'https://api.anthropic.com', IsActive: true },
    { ProviderID: 'openai', ProviderName: 'OpenAI', BaseURL: 'https://api.openai.com', IsActive: false },
    { ProviderID: 'gemini', ProviderName: 'Gemini', BaseURL: 'https://generativelanguage.googleapis.com', IsActive: false },
    { ProviderID: 'openrouter', ProviderName: 'OpenRouter', BaseURL: 'https://openrouter.ai', IsActive: false },
    { ProviderID: 'local', ProviderName: 'Local (Ollama/LM Studio)', BaseURL: '', IsActive: false }
  ];
}

function getDefaultTemplateFieldsJson_() {
  // Khớp với placeholder [tenField] trong Bootstrap.InitializeSystem.gs#createDefaultTemplateDoc_.
  return JSON.stringify([
    { name: 'coQuanBanHanh', label: 'Cơ quan ban hành', multiline: false },
    { name: 'docNumber', label: 'Số ký hiệu, không kèm chữ "Số:" (ví dụ: 12/CV-BVDS)', multiline: false },
    { name: 'diaDanhNgayThang', label: 'Địa danh, ngày tháng', multiline: false },
    { name: 'trichYeu', label: 'Trích yếu nội dung (V/v ...)', multiline: false },
    { name: 'noiNhan', label: 'Kính gửi', multiline: true },
    { name: 'noiDung', label: 'Nội dung', multiline: true },
    { name: 'nguoiKy', label: 'Người ký (chức danh, họ tên)', multiline: false }
  ]);
}

function getDefaultWorkflowStepsJson_() {
  // Đúng workflow mặc định tại docs/07-workflow.md mục 3.
  return JSON.stringify({
    workflowId: 'WF_DEFAULT',
    name: 'Quy trình văn bản hành chính mặc định',
    scope: { libraryId: '*' },
    steps: [
      { id: 'UPLOAD', type: 'UPLOAD', next: 'RULE_CHECK' },
      { id: 'RULE_CHECK', type: 'RULE_CHECK', onError: 'EDIT', onPass: 'EDIT' },
      { id: 'EDIT', type: 'USER_EDIT', next: 'APPROVAL', allowAIAssist: true },
      { id: 'APPROVAL', type: 'APPROVAL', approverRole: ROLE_NAMES.MANAGER, onApprove: 'EXPORT', onReject: 'EDIT' },
      { id: 'EXPORT', type: 'EXPORT_WORD', next: null }
    ]
  });
}
