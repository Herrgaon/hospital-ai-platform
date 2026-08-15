// Tự khởi tạo hệ thống lần đầu — Product Owner chỉ cần bấm Initialize System, toàn bộ
// Sheet/Folder/Role/Permission/Khoa-Phòng còn lại phải tự tạo.

function initializeSystem() {
  if (isSystemInitialized()) {
    return { success: true, alreadyInitialized: true };
  }

  const spreadsheet = createSystemSpreadsheet_();
  setConfig(CONFIG_KEYS.SYSTEM_DB_SPREADSHEET_ID, spreadsheet.getId());

  const rootFolder = createRootFolderStructure_();
  setConfig(CONFIG_KEYS.ROOT_FOLDER_ID, rootFolder.getId());

  seedDefaultData_();

  setConfig(CONFIG_KEYS.AI_ENABLED, 'false');
  getTokenSigningSecret_(); // sinh 1 lần cho Gateway (Auth.Token.gs) — idempotent, không sinh lại nếu đã có
  ensureBackupTrigger_();

  const adminUser = promoteInitializingUserToAdmin_();
  setConfig(CONFIG_KEYS.SYSTEM_INITIALIZED, 'true');
  logAudit(adminUser.UserID, 'SYSTEM_INITIALIZED', 'System', spreadsheet.getId(), 'Khởi tạo hệ thống lần đầu, gán Quản trị hệ thống cho người khởi tạo');

  return { success: true, alreadyInitialized: false, spreadsheetId: spreadsheet.getId(), rootFolderId: rootFolder.getId() };
}

// Người bấm "Initialize System" trở thành Quản trị hệ thống đầu tiên. Cũng tạo sẵn 1 hồ sơ Nhân viên
// gắn với Ban Giám đốc (khoa/phòng đầu tiên trong danh mục mặc định) để hệ thống dùng được ngay
// (giao việc/xếp trực cần EmployeeID, không chỉ UserID) thay vì bị kẹt "user Admin nhưng chưa có
// Nhân viên" ngay sau khi khởi tạo.
function promoteInitializingUserToAdmin_() {
  const user = getCurrentUser();
  const adminUser = getSheetRepository(SHEETS.USERS).updateById('UserID', user.UserID, {
    Role: ROLE_NAMES.SUPER_ADMIN,
    UpdatedAt: nowIso()
  });

  const banGiamDoc = getSheetRepository(SHEETS.DEPARTMENTS).findAll().find(function (d) { return d.DepartmentType === DEPARTMENT_TYPES.BAN_GIAM_DOC; });
  if (banGiamDoc) {
    getSheetRepository(SHEETS.EMPLOYEES).append({
      EmployeeID: generateId('EMP'),
      UserID: adminUser.UserID,
      FullName: adminUser.FullName,
      DepartmentID: banGiamDoc.DepartmentID,
      Position: 'Quản trị hệ thống',
      EmployeeType: 'Hành chính',
      PhoneNumber: '',
      Email: adminUser.Email,
      StartDate: nowIso(),
      Status: 'Active',
      CreatedAt: nowIso(),
      UpdatedAt: nowIso()
    });
  }
  return adminUser;
}

// Tự tạo Trigger sao lưu hàng tuần, không cần Admin vào Apps Script Editor cấu hình Trigger thủ công.
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
  const ss = SpreadsheetApp.create('BVDS_SystemDB');
  Object.keys(SCHEMA).forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    const headers = SCHEMA[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    applyPlainTextColumnFormats_(sheet, sheetName);
    ss.setNamedRange('RNG_' + sheetName, sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), headers.length));
  });
  // Sheet mặc định "Sheet1" do SpreadsheetApp.create() tạo sẵn, không nằm trong SCHEMA — xoá đi.
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
  return ss;
}

function createRootFolderStructure_() {
  const root = getOrCreateSubfolder(DriveApp.getRootFolder(), DRIVE_FOLDERS.ROOT);
  const systemFolder = getOrCreateSubfolder(root, DRIVE_FOLDERS.SYSTEM);
  getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_LOGS);
  getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_BACKUPS);
  getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_AVATARS);
  getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_EXPORTS);
  const uploadsFolder = getOrCreateSubfolder(root, DRIVE_FOLDERS.UPLOADS);
  getOrCreateSubfolder(uploadsFolder, DRIVE_FOLDERS.UPLOADS_TASKS);
  return root;
}

// Bước tiếp theo NGAY sau initializeSystem() thành công — đặt mã nhân viên + mật khẩu đăng nhập đầu
// tiên cho Quản trị hệ thống. Cần thiết vì kể từ khi chuyển sang đăng nhập mã NV/mật khẩu (thay
// Session Google, xem Auth.Session.gs), initializeSystem() tự nó KHÔNG tạo được lối vào nào để đăng
// nhập lại — không có bước này, hệ thống vừa khởi tạo xong sẽ không ai vào được.
// Vẫn dùng getCurrentUser() (Session-based) ở đây — hợp lý vì gọi ngay trong cùng phiên vừa chạy
// initializeSystem(), cùng resolve về đúng 1 danh tính (executeAs=USER_DEPLOYING nên luôn nhất quán).
// Tự khoá lại sau lần đầu (chỉ chạy được khi tài khoản CHƯA có mật khẩu) — không phải cửa hậu vĩnh viễn.
function setupFirstAdminCredentials(username, password) {
  if (!isSystemInitialized()) throw new Error('Hệ thống chưa được khởi tạo.');
  if (isBlank(username)) throw new Error('Vui lòng nhập tên đăng nhập.');
  if (!isValidPassword_(password)) throw new Error('Mật khẩu phải có ít nhất 8 ký tự.');

  const adminUser = getCurrentUser();
  if (!isBlank(adminUser.PasswordHash)) {
    throw new Error('Tài khoản này đã có mật khẩu — vào lại bằng màn hình đăng nhập.');
  }

  const usersRepo = getSheetRepository(SHEETS.USERS);
  const duplicateUsername = usersRepo.findAll().find(function (u) { return u.Username === username && u.UserID !== adminUser.UserID; });
  if (duplicateUsername) throw new Error('Tên đăng nhập đã được sử dụng.');

  const hashed = hashPassword_(password);
  usersRepo.updateById('UserID', adminUser.UserID, {
    Username: username, PasswordHash: hashed.hash, PasswordSalt: hashed.salt, UpdatedAt: nowIso()
  });
  logAudit(adminUser.UserID, 'USER_PASSWORD_CHANGED', 'User', adminUser.UserID, 'Đặt tên đăng nhập/mật khẩu quản trị lần đầu sau Initialize System');
  return { success: true, username: username };
}

function seedDefaultData_() {
  const rolesRepo = getSheetRepository(SHEETS.ROLES);
  getDefaultRoles_().forEach(function (role) { rolesRepo.append(role); });

  const permissionsRepo = getSheetRepository(SHEETS.PERMISSIONS);
  getDefaultPermissions_().forEach(function (perm) { permissionsRepo.append(perm); });

  const departmentsRepo = getSheetRepository(SHEETS.DEPARTMENTS);
  getDefaultDepartments_().forEach(function (dept) { departmentsRepo.append(dept); });

  const providersRepo = getSheetRepository(SHEETS.AI_PROVIDERS);
  getDefaultAIProviders_().forEach(function (provider) { providersRepo.append(provider); });
}
