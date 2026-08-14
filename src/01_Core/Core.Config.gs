// Lớp truy cập cấu hình hệ thống — xem docs/12-storage-design.md mục 4.
// Không module nào khác được gọi PropertiesService trực tiếp, luôn qua đây.

const CONFIG_KEYS = {
  ROOT_FOLDER_ID: 'ROOT_FOLDER_ID',
  SYSTEM_DB_SPREADSHEET_ID: 'SYSTEM_DB_SPREADSHEET_ID',
  ENV: 'ENV',
  SYSTEM_INITIALIZED: 'SYSTEM_INITIALIZED',
  ENCRYPTION_SECRET: 'ENCRYPTION_SECRET',
  AI_ENABLED: 'AI_ENABLED',
  // Khoá ký token đăng nhập Gateway (Auth.Token.gs) — sinh 1 lần khi Initialize System, không tự sinh
  // lại ngầm (sinh lại sẽ âm thầm làm mọi token đang phát hành mất hiệu lực).
  TOKEN_SIGNING_SECRET: 'TOKEN_SIGNING_SECRET'
};

function getConfig(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function setConfig(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function isSystemInitialized() {
  return getConfig(CONFIG_KEYS.SYSTEM_INITIALIZED) === 'true';
}

function isAiEnabled() {
  return getConfig(CONFIG_KEYS.AI_ENABLED) === 'true';
}
