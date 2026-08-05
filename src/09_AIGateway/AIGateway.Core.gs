// Điều phối gọi AI theo Provider Pattern — xem docs/09-ai-design.md. Duy nhất module Service được phép
// gọi AI Provider bên ngoài; không module nghiệp vụ nào khác được gọi thẳng UrlFetchApp tới AI Provider.

const AI_PROVIDER_ADAPTERS = {
  claude: callClaudeProvider,
  openai: callOpenAIProvider,
  gemini: callGeminiProvider,
  openrouter: callOpenRouterProvider,
  local: callLocalProvider
};

function runAI(request) {
  if (!isAiEnabled()) {
    return { success: false, error: 'AI_NOT_CONFIGURED' };
  }

  const config = getActiveAIProviderConfig();
  if (!config) {
    return { success: false, error: 'AI_NOT_CONFIGURED' };
  }

  const adapter = AI_PROVIDER_ADAPTERS[config.ProviderID];
  if (!adapter) {
    return { success: false, error: 'AI_PROVIDER_NOT_SUPPORTED' };
  }

  try {
    const apiKey = retrieveApiKey(config.ApiKeySecretRef);
    const result = adapter(request, config, apiKey);
    return { success: true, text: result.text, usage: result.usage };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function getActiveAIProviderConfig() {
  const configs = getSheetRepository(SHEETS.AI_PROVIDER_CONFIG).findAll();
  return configs.find(function (c) { return c.IsDefault === true; }) || null;
}
