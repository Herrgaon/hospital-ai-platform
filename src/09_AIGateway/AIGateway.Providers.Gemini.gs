// Adapter Gemini — xem docs/09-ai-design.md mục 2. Chỉ AIGateway.Core.gs được gọi hàm này.

function callGeminiProvider(request, config, apiKey) {
  const url = config.BaseURL + '/v1beta/models/' + config.ModelName + ':generateContent?key=' + apiKey;
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: [{ text: buildPromptText_(request) }] }],
      generationConfig: {
        temperature: Number(request.options && request.options.temperature || config.Temperature),
        maxOutputTokens: Number(request.options && request.options.maxTokens || config.MaxTokens)
      }
    }),
    muteHttpExceptions: true
  });

  const body = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200) {
    throw new Error('Gemini API error: ' + (body.error ? body.error.message : response.getContentText()));
  }
  return { text: body.candidates[0].content.parts[0].text, usage: body.usageMetadata };
}
