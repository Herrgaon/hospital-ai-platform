// AI chỉ xử lý các trường Rule Engine KHÔNG xác định được — xem docs/10-knowledge-design.md mục 9,
// Bước 4. AI đọc tên file + metadata + heading + đoạn đầu (KHÔNG mặc định đọc toàn bộ tài liệu).

const CLASSIFICATION_EXCERPT_CHAR_LIMIT = 6000; // ~20-30 đoạn văn bản hành chính thông thường

function classifyByAI_(fileName, docText, headingsText, missingFields, availableLibraryNames) {
  if (!isAiEnabled()) {
    return { success: false, error: 'AI_NOT_CONFIGURED', fields: {} };
  }

  const excerpt = docText.substring(0, CLASSIFICATION_EXCERPT_CHAR_LIMIT);
  const instruction =
    'Bạn là công cụ phân loại tài liệu nội bộ cho bệnh viện. Chỉ trả về DUY NHẤT một JSON hợp lệ ' +
    '(không kèm giải thích, không dùng markdown code fence), đúng cấu trúc sau — mỗi trường có "value" và ' +
    '"confidence" (số nguyên 0-100 thể hiện mức độ chắc chắn của bạn):\n' +
    '{\n' +
    '  "library": {"value": "", "confidence": 0},\n' +
    '  "category": {"value": "", "confidence": 0},\n' +
    '  "subCategory": {"value": "", "confidence": 0},\n' +
    '  "documentType": {"value": "", "confidence": 0},\n' +
    '  "issuer": {"value": "", "confidence": 0},\n' +
    '  "importance": {"value": "Low|Medium|High", "confidence": 0},\n' +
    '  "summary": {"value": "", "confidence": 0},\n' +
    '  "tags": [{"value": "", "confidence": 0}],\n' +
    '  "keywords": [{"value": "", "confidence": 0}],\n' +
    '  "applicableDepartments": [{"value": "", "confidence": 0}]\n' +
    '}\n' +
    'Chỉ điền các trường sau (các trường khác trả confidence 0, value rỗng): ' + missingFields.join(', ') + '.\n' +
    'Trường "library" PHẢI chọn đúng một trong các kho tri thức đang có sẵn sau (không tự đặt tên khác): ' +
    availableLibraryNames.join(', ') + '. Nếu không chắc, để confidence thấp.';

  const context = 'Tên file: ' + fileName + '\n\nCác heading trong tài liệu:\n' + (headingsText || '(không có)') +
    '\n\nTrích đoạn nội dung:\n' + excerpt;

  const result = runAI({ task: 'CLASSIFY', input: { context: context, question: instruction } });
  if (!result.success) {
    return { success: false, error: result.error, fields: {} };
  }

  const parsed = parseClassificationJson_(result.text);
  if (!parsed) {
    return { success: false, error: 'AI_RESPONSE_NOT_JSON', fields: {} };
  }

  return { success: true, fields: normalizeAiFields_(parsed) };
}

function parseClassificationJson_(rawText) {
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

function normalizeAiFields_(parsed) {
  const fields = {};
  ['library', 'category', 'subCategory', 'documentType', 'issuer', 'importance', 'summary'].forEach(function (key) {
    if (parsed[key] && !isBlank(parsed[key].value)) {
      fields[key] = { value: parsed[key].value, confidence: Number(parsed[key].confidence) || 0, source: 'AI' };
    }
  });
  ['tags', 'keywords', 'applicableDepartments'].forEach(function (key) {
    if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
      fields[key] = {
        value: parsed[key].map(function (item) { return item.value; }).filter(function (v) { return !isBlank(v); }),
        confidence: Math.min.apply(null, parsed[key].map(function (item) { return Number(item.confidence) || 0; })),
        source: 'AI',
        perItem: parsed[key]
      };
    }
  });
  return fields;
}
