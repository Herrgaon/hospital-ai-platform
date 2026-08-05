// Adapter Claude — xem docs/09-ai-design.md mục 2. Chỉ AIGateway.Core.gs được gọi hàm này.

function callClaudeProvider(request, config, apiKey) {
  const response = UrlFetchApp.fetch(config.BaseURL + '/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({
      model: config.ModelName,
      max_tokens: Number(request.options && request.options.maxTokens || config.MaxTokens),
      temperature: Number(request.options && request.options.temperature || config.Temperature),
      messages: [{ role: 'user', content: buildPromptText_(request) }]
    }),
    muteHttpExceptions: true
  });

  const body = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200) {
    throw new Error('Claude API error: ' + (body.error ? body.error.message : response.getContentText()));
  }
  return { text: body.content[0].text, usage: body.usage };
}
