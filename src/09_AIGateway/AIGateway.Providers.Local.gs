// Adapter Provider cục bộ (Ollama/LM Studio) — xem docs/09-ai-design.md mục 8.
// Quyết định Product Owner (2026-08-05): KHÔNG triển khai ở giai đoạn đầu, chỉ dùng Claude.
// Adapter này giữ lại để kiến trúc Provider Pattern sẵn sàng mở rộng khi có nhu cầu thực tế —
// không tự ý bật (AIProviders.local.IsActive = false theo Bootstrap.Defaults.gs).
// UrlFetchApp chỉ gọi được endpoint HTTPS công khai: config.BaseURL phải trỏ tới một cổng công khai
// (ví dụ Cloudflare Tunnel) do bệnh viện tự vận hành nếu sau này được bật.

function callLocalProvider(request, config, apiKey) {
  if (isBlank(config.BaseURL)) {
    throw new Error('Provider cục bộ chưa cấu hình BaseURL công khai.');
  }
  const response = UrlFetchApp.fetch(config.BaseURL + '/api/chat', {
    method: 'post',
    contentType: 'application/json',
    headers: apiKey ? { Authorization: 'Bearer ' + apiKey } : {},
    payload: JSON.stringify({
      model: config.ModelName,
      messages: [{ role: 'user', content: buildPromptText_(request) }],
      stream: false
    }),
    muteHttpExceptions: true
  });

  const body = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200) {
    throw new Error('Local Provider error: ' + response.getContentText());
  }
  return { text: body.message ? body.message.content : body.response, usage: null };
}
