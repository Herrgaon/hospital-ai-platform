// Adapter OpenRouter — tương thích OpenAI Chat Completions format. Xem docs/09-ai-design.md mục 2.

function callOpenRouterProvider(request, config, apiKey) {
  const response = UrlFetchApp.fetch(config.BaseURL + '/api/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
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
    throw new Error('OpenRouter API error: ' + (body.error ? body.error.message : response.getContentText()));
  }
  return { text: body.choices[0].message.content, usage: body.usage };
}
