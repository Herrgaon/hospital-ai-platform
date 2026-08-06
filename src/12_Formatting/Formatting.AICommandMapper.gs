// AI Formatting — ánh xạ lệnh tự do (tiếng Việt tự nhiên) sang 1 hành động ĐỊNH SẴN trong danh sách
// trắng (whitelist) bên dưới. AI KHÔNG bao giờ được tự bịa hành động hay tham số ngoài whitelist,
// và KHÔNG có hành động nào trong whitelist đụng tới NỘI DUNG văn bản — chỉ đổi thuộc tính định dạng
// (font/màu/căn lề/lề trang...). Đúng nguyên tắc PROJECT_CONSTITUTION: AI chỉ dùng cho việc ngôn ngữ
// (hiểu ý người dùng muốn gì), không tự quyết định logic có thể kiểm tra được bằng luật (giá trị
// font/lề cụ thể vẫn do code/Rule JSON quyết định, không phải AI tự bịa).
//
// FORMATTING_ACTIONS là NGUỒN DUY NHẤT: cả prompt AI lẫn whitelist kiểm tra phía server đều đọc từ
// đây — thêm 1 action mới chỉ cần sửa 1 chỗ, không thể lệch nhau giữa "AI được dạy gì" và "server
// chấp nhận gì".
const FORMATTING_ACTIONS = {
  SET_FONT_FAMILY: {
    // Hàm thay vì chuỗi tĩnh: Apps Script gộp mọi file .gs vào 1 scope toàn cục và chạy code cấp cao
    // nhất (top-level) theo thứ tự tên file — nếu ghép chuỗi ALLOWED_FONT_FAMILIES.join() NGAY TẠI
    // ĐÂY (top-level của file này), file Formatting.Primitives.gs (nơi khai báo hằng số đó) có thể
    // CHƯA chạy tới (vì "AICommandMapper" đứng trước "Primitives" theo thứ tự chữ cái) → lỗi
    // "ALLOWED_FONT_FAMILIES is not defined". Bọc trong hàm để chỉ tính khi thực sự được GỌI (lúc đó
    // toàn bộ file chắc chắn đã nạp xong) — lỗi này đã xảy ra thật và được phát hiện qua clasp run.
    description: function () { return 'Đổi phông chữ toàn văn bản. params: {fontFamily: một trong ' + ALLOWED_FONT_FAMILIES.join('/') + '}'; },
    validate: function (p) { return isValidFontFamily_(p.fontFamily) ? { valid: true, errors: [] } : { valid: false, errors: ['fontFamily không hợp lệ'] }; },
    toFormatOptions: function (p) { return { text: { fontFamily: p.fontFamily } }; }
  },
  SET_FONT_SIZE: {
    description: 'Đổi cỡ chữ toàn văn bản. params: {fontSize: số nguyên 8-32}',
    validate: function (p) { return isInRange_(p.fontSize, 8, 32) ? { valid: true, errors: [] } : { valid: false, errors: ['fontSize ngoài phạm vi 8-32'] }; },
    toFormatOptions: function (p) { return { text: { fontSize: p.fontSize } }; }
  },
  SET_TEXT_STYLE: {
    description: 'Bật/tắt in đậm, in nghiêng, gạch chân, gạch ngang toàn văn bản. params: {bold?, italic?, underline?, strikethrough?: true|false}',
    validate: function (p) {
      const keys = ['bold', 'italic', 'underline', 'strikethrough'];
      const present = keys.filter(function (k) { return p[k] !== undefined; });
      if (present.length === 0) return { valid: false, errors: ['Cần ít nhất 1 trong bold/italic/underline/strikethrough'] };
      const bad = present.filter(function (k) { return typeof p[k] !== 'boolean'; });
      return bad.length === 0 ? { valid: true, errors: [] } : { valid: false, errors: ['Giá trị phải là true/false: ' + bad.join(', ')] };
    },
    toFormatOptions: function (p) { return { text: { bold: p.bold, italic: p.italic, underline: p.underline, strikethrough: p.strikethrough } }; }
  },
  SET_TEXT_CASE: {
    description: 'Đổi hoa/thường toàn văn bản. params: {mode: UPPERCASE|LOWERCASE|SENTENCE_CASE|TITLE_CASE}',
    validate: function (p) { return isValidTextCaseMode_(p.mode) ? { valid: true, errors: [] } : { valid: false, errors: ['mode không hợp lệ'] }; },
    toFormatOptions: function (p) { return { text: { textCase: p.mode } }; }
  },
  SET_TEXT_COLOR: {
    description: 'Đổi màu chữ toàn văn bản. params: {colorHex: mã màu dạng #RRGGBB}',
    validate: function (p) { return isValidHexColor_(p.colorHex) ? { valid: true, errors: [] } : { valid: false, errors: ['colorHex không hợp lệ'] }; },
    toFormatOptions: function (p) { return { text: { textColor: p.colorHex } }; }
  },
  SET_HIGHLIGHT_COLOR: {
    description: 'Đổi màu nền/tô sáng (highlight) toàn văn bản. params: {colorHex: mã màu dạng #RRGGBB}',
    validate: function (p) { return isValidHexColor_(p.colorHex) ? { valid: true, errors: [] } : { valid: false, errors: ['colorHex không hợp lệ'] }; },
    toFormatOptions: function (p) { return { text: { backgroundColor: p.colorHex } }; }
  },
  SET_ALIGNMENT: {
    description: 'Căn lề đoạn văn toàn văn bản. params: {alignment: LEFT|CENTER|RIGHT|JUSTIFY}',
    validate: function (p) { return isValidAlignment_(p.alignment) ? { valid: true, errors: [] } : { valid: false, errors: ['alignment không hợp lệ'] }; },
    toFormatOptions: function (p) { return { paragraph: { alignment: p.alignment } }; }
  },
  SET_LINE_SPACING: {
    description: 'Đổi giãn dòng toàn văn bản. params: {lineSpacing: 1|1.15|1.5|2}',
    validate: function (p) { return isValidLineSpacing_(p.lineSpacing) ? { valid: true, errors: [] } : { valid: false, errors: ['lineSpacing không hợp lệ'] }; },
    toFormatOptions: function (p) { return { paragraph: { lineSpacing: p.lineSpacing } }; }
  },
  SET_PARAGRAPH_SPACING: {
    description: 'Đổi khoảng cách trước/sau đoạn văn (đơn vị point). params: {spacingBeforePt?, spacingAfterPt?: số 0-72}',
    validate: function (p) {
      const keys = ['spacingBeforePt', 'spacingAfterPt'].filter(function (k) { return p[k] !== undefined; });
      if (keys.length === 0) return { valid: false, errors: ['Cần ít nhất 1 trong spacingBeforePt/spacingAfterPt'] };
      const bad = keys.filter(function (k) { return !isInRange_(p[k], 0, 72); });
      return bad.length === 0 ? { valid: true, errors: [] } : { valid: false, errors: ['Ngoài phạm vi 0-72pt: ' + bad.join(', ')] };
    },
    toFormatOptions: function (p) { return { paragraph: { spacingBeforePt: p.spacingBeforePt, spacingAfterPt: p.spacingAfterPt } }; }
  },
  SET_FIRST_LINE_INDENT: {
    description: 'Đổi thụt lề dòng đầu đoạn văn (đơn vị mm). params: {indentMm: số 0-50}',
    validate: function (p) { return isInRange_(p.indentMm, 0, 50) ? { valid: true, errors: [] } : { valid: false, errors: ['indentMm ngoài phạm vi 0-50'] }; },
    toFormatOptions: function (p) { return { paragraph: { firstLineIndentMm: p.indentMm } }; }
  },
  SET_MARGINS: {
    description: 'Đổi lề trang (đơn vị mm). params: {topMm, bottomMm, leftMm, rightMm: số 5-100}',
    validate: function (p) {
      const keys = ['topMm', 'bottomMm', 'leftMm', 'rightMm'];
      const bad = keys.filter(function (k) { return !isInRange_(p[k], 5, 100); });
      return bad.length === 0 ? { valid: true, errors: [] } : { valid: false, errors: ['Ngoài phạm vi 5-100mm: ' + bad.join(', ')] };
    },
    toFormatOptions: function (p) { return { margins: { topMm: p.topMm, bottomMm: p.bottomMm, leftMm: p.leftMm, rightMm: p.rightMm } }; }
  },
  APPLY_ND30_QUICK_STYLE: {
    description: 'Áp dụng thể thức chuẩn Nghị định 30/2020/NĐ-CP (font, cỡ chữ, lề) cho toàn văn bản — dùng khi người dùng yêu cầu "định dạng theo Nghị định 30" hoặc "định dạng công văn chuẩn".',
    validate: function () { return { valid: true, errors: [] }; },
    isQuickStyle: true
  }
};

function buildFormattingCommandInstruction_() {
  const actionLines = Object.keys(FORMATTING_ACTIONS).map(function (code) {
    const description = FORMATTING_ACTIONS[code].description;
    return code + ': ' + (typeof description === 'function' ? description() : description);
  }).join('\n');

  return 'Bạn là công cụ điều khiển định dạng văn bản hành chính. Người dùng sẽ mô tả một yêu cầu ' +
    'định dạng bằng tiếng Việt tự nhiên. Nhiệm vụ của bạn CHỈ là chọn ĐÚNG MỘT hành động từ danh sách ' +
    'hành động định dạng CỐ ĐỊNH sau đây (không được bịa ra hành động khác, không được đề xuất chỉnh ' +
    'sửa NỘI DUNG văn bản):\n' + actionLines +
    '\n\nChỉ trả về DUY NHẤT một JSON hợp lệ (không kèm giải thích, không dùng markdown code fence), ' +
    'đúng cấu trúc:\n{"action": "<một trong các mã hành động ở trên>", "params": { ... }, "confidence": <số nguyên 0-100>}\n' +
    'Nếu yêu cầu của người dùng KHÔNG khớp với bất kỳ hành động nào ở trên (ví dụ yêu cầu sửa nội ' +
    'dung, thêm bảng, chèn ảnh...), trả về {"action": null, "params": {}, "confidence": 0}.\n' +
    'Tham số "params" PHẢI đúng tên trường đã liệt kê cho hành động đó, không thêm trường thừa.';
}

// Bản sao riêng của Formatting module (không gọi parseClassificationJson_ ở Knowledge.ClassificationAI.gs)
// — tránh phụ thuộc chéo giữa 2 module chỉ vì 1 hàm parse JSON 5 dòng.
function parseFormattingCommandJson_(rawText) {
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

function mapFreeTextToFormattingAction_(commandText) {
  if (!isAiEnabled()) return { success: false, error: 'AI_NOT_CONFIGURED' };

  const result = runAI({ task: 'CLASSIFY', input: { context: commandText, question: buildFormattingCommandInstruction_() } });
  if (!result.success) return { success: false, error: result.error };

  const parsed = parseFormattingCommandJson_(result.text);
  if (!parsed) return { success: false, error: 'AI_RESPONSE_NOT_JSON' };
  if (!parsed.action || !FORMATTING_ACTIONS[parsed.action]) return { success: false, error: 'AI_ACTION_NOT_RECOGNIZED' };

  return { success: true, action: parsed.action, params: parsed.params || {}, confidence: Number(parsed.confidence) || 0 };
}

// 2 lớp chặn trước khi đụng tới DocumentApp: (1) mapFreeTextToFormattingAction_ đã loại action lạ,
// (2) actionDef.validate() ở đây loại tham số sai/ngoài phạm vi cho 1 action dù đã biết — đảm bảo
// KHÔNG BAO GIỜ tin JSON của AI một cách mù quáng. Hàm gốc theo driveFileId (xem lý do ở
// Formatting.Service.gs#applyManualFormattingToFile) — dùng chung cho tài liệu trong hệ thống lẫn
// file tải lên tạm ở trang "Chỉnh sửa định dạng".
// auditTarget: { type, id } — cho phép nơi gọi ghi nhật ký đúng đối tượng thật (Document/documentId
// khi tài liệu đã có trong hệ thống, File/driveFileId khi là file tải lên tạm) thay vì luôn ghi
// driveFileId, vốn sẽ làm mất dấu vết DocumentID trong Audit Log của luồng tài liệu chính thức.
function applyAiFormattingCommandToFile(user, driveFileId, commandText, libraryId, auditTarget) {
  const target = auditTarget || { type: 'File', id: driveFileId };
  if (isBlank(commandText)) return { success: false, error: 'EMPTY_COMMAND' };

  const mapped = mapFreeTextToFormattingAction_(commandText);
  if (!mapped.success) return mapped;

  const actionDef = FORMATTING_ACTIONS[mapped.action];
  const validation = actionDef.validate(mapped.params);
  if (!validation.valid) return { success: false, error: 'AI_ACTION_INVALID', detail: validation.errors };

  if (actionDef.isQuickStyle) {
    const result = applyND30QuickStyleToFile(user, driveFileId, libraryId);
    logAudit(user.UserID, 'DOCUMENT_AI_FORMAT_COMMAND_APPLIED', target.type, target.id, JSON.stringify({ command: commandText, action: mapped.action }));
    return Object.assign({ action: mapped.action }, result);
  }

  const formatOptions = actionDef.toFormatOptions(mapped.params);
  applyFormatOptionsToDocument_(driveFileId, formatOptions);
  logAudit(user.UserID, 'DOCUMENT_AI_FORMAT_COMMAND_APPLIED', target.type, target.id, JSON.stringify({ command: commandText, action: mapped.action, params: mapped.params }));
  return { success: true, action: mapped.action, params: mapped.params, applied: formatOptions };
}

function applyAiFormattingCommand(user, documentId, commandText) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanEdit');
  return applyAiFormattingCommandToFile(user, document.DriveFileID, commandText, document.LibraryID, { type: 'Document', id: documentId });
}
