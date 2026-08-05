// Lớp truy cập cấu hình hệ thống — xem docs/12-storage-design.md mục 4.
// Không module nào khác được gọi PropertiesService trực tiếp, luôn qua đây.

const CONFIG_KEYS = {
  ROOT_FOLDER_ID: 'ROOT_FOLDER_ID',
  SYSTEM_DB_SPREADSHEET_ID: 'SYSTEM_DB_SPREADSHEET_ID',
  ENV: 'ENV',
  SYSTEM_INITIALIZED: 'SYSTEM_INITIALIZED',
  ENCRYPTION_SECRET: 'ENCRYPTION_SECRET',
  AI_ENABLED: 'AI_ENABLED',
  // Ngưỡng % tự động chấp nhận kết quả phân loại của AI — xem docs/10-knowledge-design.md mục 9,
  // Bước 5 (Confidence Evaluation). Dưới ngưỡng này phải hỏi lại người dùng, không tự lưu.
  AI_CLASSIFICATION_THRESHOLD: 'AI_CLASSIFICATION_THRESHOLD'
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

function getClassificationThreshold() {
  const raw = getConfig(CONFIG_KEYS.AI_CLASSIFICATION_THRESHOLD);
  return raw ? Number(raw) : 90;
}
