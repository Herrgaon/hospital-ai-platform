// Nguồn sự thật duy nhất cho tên Sheet/cột — xem docs/12-storage-design.md mục 2.1.
// Không nơi nào khác được hard-code tên Sheet hay tên cột ngoài file này.

const SHEETS = {
  USERS: 'Users',
  ROLES: 'Roles',
  PERMISSIONS: 'Permissions',
  LIBRARIES: 'Libraries',
  CATEGORIES: 'Categories',
  DOCUMENTS: 'Documents',
  DOCUMENT_VERSIONS: 'DocumentVersions',
  TEMPLATES: 'Templates',
  RULES: 'Rules',
  WORKFLOWS: 'Workflows',
  WORKFLOW_INSTANCES: 'WorkflowInstances',
  WORKFLOW_STEP_LOG: 'WorkflowStepLog',
  AI_PROVIDERS: 'AIProviders',
  AI_PROVIDER_CONFIG: 'AIProviderConfig',
  AI_PROVIDER_KEY_HISTORY: 'AIProviderKeyHistory',
  AUDIT_LOG: 'AuditLog',
  SYSTEM_CONFIG: 'SystemConfig',
  CLASSIFICATION_FEEDBACK: 'ClassificationFeedback'
};

const SCHEMA = {
  [SHEETS.USERS]: ['UserID', 'Email', 'FullName', 'Role', 'Department', 'Status', 'CreatedAt', 'UpdatedAt'],
  [SHEETS.ROLES]: ['RoleID', 'RoleName', 'Description'],
  [SHEETS.PERMISSIONS]: ['PermissionID', 'RoleID', 'UserID', 'LibraryID', 'CanView', 'CanCreate', 'CanEdit', 'CanDelete', 'CanApprove', 'CanManage'],
  // RequiresReview: false = tài liệu nạp vào kho này Published ngay, không cần chờ duyệt tri thức
  // (ví dụ kho rủi ro thấp như Biểu mẫu nội bộ) — xem docs/10-knowledge-design.md mục 9.
  [SHEETS.LIBRARIES]: ['LibraryID', 'LibraryName', 'Description', 'ManagerUserID', 'DriveFolderID', 'CreatedAt', 'Status', 'RequiresReview'],
  [SHEETS.CATEGORIES]: ['CategoryID', 'LibraryID', 'CategoryName', 'ParentCategoryID'],
  // Xem docs/10-knowledge-design.md mục 9 (Document Ingestion & Knowledge Classification).
  [SHEETS.DOCUMENTS]: [
    'DocumentID', 'LibraryID', 'CategoryID', 'SubCategory', 'Title', 'DriveFileID', 'FileType',
    'CurrentVersion', 'Status', 'OwnerUserID', 'CreatedAt', 'UpdatedAt',
    'DocumentType', 'Issuer', 'ApplicableDepartments', 'Tags', 'Keywords', 'Summary', 'Language',
    'EffectiveDate', 'ExpireDate', 'FileHash', 'OcrStatus', 'AiConfidence', 'Importance'
  ],
  [SHEETS.DOCUMENT_VERSIONS]: ['VersionID', 'DocumentID', 'VersionNumber', 'DriveFileID', 'ChangedByUserID', 'ChangeNote', 'CreatedAt'],
  [SHEETS.TEMPLATES]: ['TemplateID', 'TemplateName', 'LibraryID', 'CategoryID', 'DriveFileID', 'Fields', 'Status', 'CreatedAt'],
  [SHEETS.RULES]: ['RuleID', 'RuleSetName', 'LibraryID', 'DriveFileID', 'Version', 'Status'],
  [SHEETS.WORKFLOWS]: ['WorkflowID', 'WorkflowName', 'LibraryID', 'StepsDefinition', 'Status'],
  [SHEETS.WORKFLOW_INSTANCES]: ['InstanceID', 'WorkflowID', 'DocumentID', 'CurrentStep', 'Status', 'StartedAt', 'CompletedAt'],
  [SHEETS.WORKFLOW_STEP_LOG]: ['LogID', 'InstanceID', 'StepName', 'ActorUserID', 'Action', 'Comment', 'Timestamp'],
  [SHEETS.AI_PROVIDERS]: ['ProviderID', 'ProviderName', 'BaseURL', 'IsActive'],
  [SHEETS.AI_PROVIDER_CONFIG]: ['ConfigID', 'ProviderID', 'ModelName', 'ApiKeySecretRef', 'Temperature', 'MaxTokens', 'Timeout', 'IsDefault', 'UpdatedByUserID', 'UpdatedAt'],
  [SHEETS.AI_PROVIDER_KEY_HISTORY]: ['HistoryID', 'ConfigID', 'ChangedByUserID', 'ChangedAt', 'Action'],
  [SHEETS.AUDIT_LOG]: ['LogID', 'Timestamp', 'UserID', 'Action', 'TargetType', 'TargetID', 'Detail'],
  [SHEETS.SYSTEM_CONFIG]: ['Key', 'Value', 'Description', 'UpdatedAt'],
  // "AI Learning" đơn giản hoá (docs/10-knowledge-design.md mục 9) — chỉ ghi nhận AI đề xuất gì
  // và người dùng chốt lại là gì, KHÔNG tự động fine-tune model. Dùng để Admin xem AI Accuracy sau này.
  [SHEETS.CLASSIFICATION_FEEDBACK]: ['FeedbackID', 'DocumentID', 'Field', 'SuggestedValue', 'FinalValue', 'Confidence', 'Source', 'Timestamp']
};

const ROLE_NAMES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  USER: 'User',
  GUEST: 'Guest'
};

const DRIVE_FOLDERS = {
  ROOT: 'AIOP_ROOT',
  LIBRARIES: 'Libraries',
  TEMPLATES: 'Templates',
  SYSTEM: 'System',
  SYSTEM_RULES: 'Rules',
  SYSTEM_LOGS: 'Logs',
  SYSTEM_BACKUPS: 'Backups',
  UPLOADS: 'Uploads',
  UPLOADS_INBOX: '_Inbox'
};
