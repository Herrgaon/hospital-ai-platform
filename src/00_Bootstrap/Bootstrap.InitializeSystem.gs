// Tự khởi tạo hệ thống lần đầu — xem docs/04-use-cases.md UC-06 và
// PROJECT_CONSTITUTION mục "SYSTEM BOOTSTRAP": Product Owner chỉ cần bấm Initialize System,
// toàn bộ Sheet/Folder/Role/Permission/Rule/Template/Workflow còn lại phải tự tạo.

function initializeSystem() {
  if (isSystemInitialized()) {
    return { success: true, alreadyInitialized: true };
  }

  const spreadsheet = createSystemSpreadsheet_();
  setConfig(CONFIG_KEYS.SYSTEM_DB_SPREADSHEET_ID, spreadsheet.getId());

  const rootFolder = createRootFolderStructure_();
  setConfig(CONFIG_KEYS.ROOT_FOLDER_ID, rootFolder.getId());

  seedDefaultData_();
  syncDefaultRuleFiles_(rootFolder);
  seedDefaultLibraryAndTemplate_();

  setConfig(CONFIG_KEYS.AI_ENABLED, 'false');
  setConfig(CONFIG_KEYS.AI_CLASSIFICATION_THRESHOLD, '90');
  setConfig(CONFIG_KEYS.MAX_BULK_UPLOAD_COUNT, '15');
  ensureBackupTrigger_();

  const adminUser = promoteInitializingUserToAdmin_();
  setConfig(CONFIG_KEYS.SYSTEM_INITIALIZED, 'true');
  logAudit(adminUser.UserID, 'SYSTEM_INITIALIZED', 'System', spreadsheet.getId(), 'Khởi tạo hệ thống lần đầu, gán Admin cho người khởi tạo');

  return { success: true, alreadyInitialized: false, spreadsheetId: spreadsheet.getId(), rootFolderId: rootFolder.getId() };
}

// Người bấm "Initialize System" trở thành Admin đầu tiên của hệ thống — đúng UC-06:
// Product Owner chỉ cần cấp quyền Drive/Sheets rồi bấm nút, không phải tự tạo tài khoản Admin thủ công.
function promoteInitializingUserToAdmin_() {
  const user = getCurrentUser();
  return getSheetRepository(SHEETS.USERS).updateById('UserID', user.UserID, {
    Role: ROLE_NAMES.ADMIN,
    UpdatedAt: nowIso()
  });
}

// Tự tạo Trigger sao lưu hàng tuần — đúng docs/13-security.md mục 8, không cần Admin vào
// Apps Script Editor cấu hình Trigger thủ công (đúng nguyên tắc Self Bootstrap).
function ensureBackupTrigger_() {
  const alreadyExists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'runScheduledBackup';
  });
  if (alreadyExists) return;
  ScriptApp.newTrigger('runScheduledBackup')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(2)
    .create();
}

function createSystemSpreadsheet_() {
  const ss = SpreadsheetApp.create('AIOP_SystemDB');
  Object.keys(SCHEMA).forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    const headers = SCHEMA[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    ss.setNamedRange('RNG_' + sheetName, sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), headers.length));
  });
  // Sheet mặc định "Sheet1" do SpreadsheetApp.create() tạo sẵn, không nằm trong SCHEMA — xoá đi.
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
  return ss;
}

function createRootFolderStructure_() {
  const root = getOrCreateSubfolder(DriveApp.getRootFolder(), DRIVE_FOLDERS.ROOT);
  const librariesFolder = getOrCreateSubfolder(root, DRIVE_FOLDERS.LIBRARIES);
  getOrCreateSubfolder(root, DRIVE_FOLDERS.TEMPLATES);
  const systemFolder = getOrCreateSubfolder(root, DRIVE_FOLDERS.SYSTEM);
  getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_RULES);
  getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_LOGS);
  getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_BACKUPS);
  const uploadsFolder = getOrCreateSubfolder(root, DRIVE_FOLDERS.UPLOADS);
  getOrCreateSubfolder(uploadsFolder, DRIVE_FOLDERS.UPLOADS_INBOX);
  void librariesFolder;
  return root;
}

function seedDefaultData_() {
  const rolesRepo = getSheetRepository(SHEETS.ROLES);
  getDefaultRoles_().forEach(function (role) { rolesRepo.append(role); });

  const permissionsRepo = getSheetRepository(SHEETS.PERMISSIONS);
  getDefaultPermissions_().forEach(function (perm) { permissionsRepo.append(perm); });

  const providersRepo = getSheetRepository(SHEETS.AI_PROVIDERS);
  getDefaultAIProviders_().forEach(function (provider) { providersRepo.append(provider); });

  const workflowsRepo = getSheetRepository(SHEETS.WORKFLOWS);
  workflowsRepo.append({
    WorkflowID: 'WF_DEFAULT',
    WorkflowName: 'Quy trình văn bản hành chính mặc định',
    LibraryID: '*',
    StepsDefinition: getDefaultWorkflowStepsJson_(),
    Status: 'Active'
  });
}

// Tạo sẵn 1 Library + 1 Template mặc định để UC-01 dùng được ngay sau khi Initialize System,
// đúng yêu cầu "Default Template" tại PROJECT_CONSTITUTION mục SYSTEM BOOTSTRAP.
function seedDefaultLibraryAndTemplate_() {
  const user = getCurrentUser();
  const libraryFolder = getLibraryFolder('Văn thư');

  const library = getSheetRepository(SHEETS.LIBRARIES).append({
    LibraryID: generateId('LIB'),
    LibraryName: 'Văn thư',
    Description: 'Kho tài liệu văn thư - hành chính (tạo tự động khi Initialize System)',
    ManagerUserID: user.UserID,
    DriveFolderID: libraryFolder.getId(),
    CreatedAt: nowIso(),
    Status: 'Active'
  });

  const category = getSheetRepository(SHEETS.CATEGORIES).append({
    CategoryID: generateId('CAT'),
    LibraryID: library.LibraryID,
    CategoryName: 'Công văn hành chính',
    ParentCategoryID: ''
  });

  const templatesRoot = getOrCreateSubfolder(getRootFolder_(), DRIVE_FOLDERS.TEMPLATES);
  const templateFile = createDefaultTemplateDoc_(templatesRoot);

  getSheetRepository(SHEETS.TEMPLATES).append({
    TemplateID: generateId('TPL'),
    TemplateName: 'Công văn hành chính',
    LibraryID: library.LibraryID,
    CategoryID: category.CategoryID,
    DriveFileID: templateFile.getId(),
    Fields: getDefaultTemplateFieldsJson_(),
    Status: 'Active',
    CreatedAt: nowIso()
  });
}

// Mẫu công văn tối thiểu, dùng font/lề đúng khung Rule_NghiDinh30.json để việc kiểm tra thể thức
// (UC-02) có kết quả PASS ngay trên tài liệu mẫu. Văn thư cần rà lại đúng mẫu chính thức của
// bệnh viện trước khi dùng thật — xem docs/08-rule-engine.md mục 7.
function createDefaultTemplateDoc_(templatesFolder) {
  const doc = DocumentApp.create('Mau_CongVan_HanhChinh');
  const body = doc.getBody();
  body.clear();

  body.setMarginTop(mmToPoints(22));
  body.setMarginBottom(mmToPoints(22));
  body.setMarginLeft(mmToPoints(32));
  body.setMarginRight(mmToPoints(18));

  const heading = body.appendParagraph('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM');
  heading.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  const motto = body.appendParagraph('Độc lập - Tự do - Hạnh phúc');
  motto.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('-------------------------').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('[coQuanBanHanh]');
  body.appendParagraph('Số: [docNumber]');

  const place = body.appendParagraph('[diaDanhNgayThang]');
  place.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  const title = body.appendParagraph('V/v [trichYeu]');
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph('Kính gửi: [noiNhan]');
  body.appendParagraph('[noiDung]');

  const signBlock = body.appendParagraph('[nguoiKy]');
  signBlock.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  const text = body.editAsText();
  text.setFontFamily('Times New Roman').setFontSize(14);

  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());
  file.moveTo(templatesFolder);
  return file;
}

function syncDefaultRuleFiles_(rootFolder) {
  const systemFolder = getOrCreateSubfolder(rootFolder, DRIVE_FOLDERS.SYSTEM);
  const rulesFolder = getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_RULES);
  const ruleFiles = [
    { name: 'Rule_NghiDinh30.json', ruleSetName: 'Thể thức văn bản hành chính (NĐ 30/2020)' },
    { name: 'Rule_Document.json', ruleSetName: 'Quy tắc chung tên file và metadata' }
  ];
  const rulesRepo = getSheetRepository(SHEETS.RULES);
  ruleFiles.forEach(function (rf) {
    const content = getRuleFileContent_(rf.name);
    const file = rulesFolder.createFile(rf.name, content, MimeType.PLAIN_TEXT);
    rulesRepo.append({
      RuleID: generateId('RULE'),
      RuleSetName: rf.ruleSetName,
      RuleType: RULE_TYPES.FORMAT_CHECK,
      LibraryID: '*',
      DriveFileID: file.getId(),
      Version: 1,
      Status: 'Active'
    });
  });

  // Rule phân loại tài liệu (docs/10-knowledge-design.md mục 9) — ruleSet riêng, không lẫn với
  // rule kiểm tra thể thức ở trên (RuleType khác nhau — xem Storage.Schema.gs).
  const classificationFile = rulesFolder.createFile('Rule_Classification.json', getDefaultClassificationRuleSetContent_(), MimeType.PLAIN_TEXT);
  rulesRepo.append({
    RuleID: generateId('RULE'),
    RuleSetName: CLASSIFICATION_RULE_SET_NAME,
    RuleType: RULE_TYPES.CLASSIFICATION,
    LibraryID: '*',
    DriveFileID: classificationFile.getId(),
    Version: 1,
    Status: 'Active'
  });
}
