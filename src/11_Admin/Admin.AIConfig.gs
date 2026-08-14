// Cấu hình AI Provider — xem docs/04-use-cases.md UC-07.
// Giai đoạn đầu (Phase 4 trong roadmap) chỉ cấu hình Provider Claude — xem docs/09-ai-design.md mục 4b.

// Đúng ma trận tại docs/11-permission-design.md mục 3 ("Cấu hình AI Provider/API Key": chỉ Admin).
function updateAIProviderConfig(actingUser, providerId, modelName, plainApiKey, temperature, maxTokens, timeout) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được cấu hình AI Provider.');
  }

  const configsRepo = getSheetRepository(SHEETS.AI_PROVIDER_CONFIG);
  const configId = generateId('AICFG');
  const secretRef = storeApiKey(configId, plainApiKey);

  const config = configsRepo.append({
    ConfigID: configId,
    ProviderID: providerId,
    ModelName: modelName,
    ApiKeySecretRef: secretRef,
    Temperature: temperature,
    MaxTokens: maxTokens,
    Timeout: timeout,
    IsDefault: true,
    UpdatedByUserID: actingUser.UserID,
    UpdatedAt: nowIso()
  });

  getSheetRepository(SHEETS.AI_PROVIDER_KEY_HISTORY).append({
    HistoryID: generateId('AIKH'),
    ConfigID: config.ConfigID,
    ChangedByUserID: actingUser.UserID,
    ChangedAt: nowIso(),
    Action: 'KEY_UPDATED'
  });

  logAudit(actingUser.UserID, 'AI_PROVIDER_CONFIG_CHANGED', 'AIProviderConfig', config.ConfigID, providerId + '/' + modelName);
  return config;
}

function listAIProviders() {
  return getSheetRepository(SHEETS.AI_PROVIDERS).findAll();
}

function getActiveAIProviderConfigMasked() {
  const config = getActiveAIProviderConfig();
  if (!config) return null;
  const plainKey = retrieveApiKey(config.ApiKeySecretRef);
  return {
    ConfigID: config.ConfigID,
    ProviderID: config.ProviderID,
    ModelName: config.ModelName,
    ApiKeyMasked: maskApiKey(plainKey),
    Temperature: config.Temperature,
    MaxTokens: config.MaxTokens,
    Timeout: config.Timeout,
    UpdatedAt: config.UpdatedAt
  };
}

function setAiEnabled(actingUser, enabled) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được bật/tắt AI.');
  }
  setConfig(CONFIG_KEYS.AI_ENABLED, enabled ? 'true' : 'false');
  logAudit(actingUser.UserID, 'AI_TOGGLE', 'System', 'AI_ENABLED', String(enabled));
}
