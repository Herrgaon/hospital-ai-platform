// Định dạng văn bản — nhóm hàm thuần DocumentApp (không đụng Sheet/Drive/quyền), xem
// docs/10-knowledge-design.md và kế hoạch Document Formatting Module Phase 1 (2026-08-06).
// Quy ước: 1 field được ÁP DỤNG khi và chỉ khi giá trị != null (undefined/null = "giữ nguyên,
// không đổi"). Không tự bỏ qua chuỗi rỗng — nơi gọi phải tự gửi null nếu muốn "không đổi".

const ALLOWED_FONT_FAMILIES = ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Verdana'];
const TEXT_CASE_MODES = { UPPERCASE: 'UPPERCASE', LOWERCASE: 'LOWERCASE', SENTENCE_CASE: 'SENTENCE_CASE', TITLE_CASE: 'TITLE_CASE' };
const ALIGNMENT_VALUES = ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFY'];
const LINE_SPACING_VALUES = [1, 1.15, 1.5, 2];

function isValidFontFamily_(v) { return ALLOWED_FONT_FAMILIES.indexOf(v) !== -1; }
function isValidHexColor_(v) { return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v); }
function isValidAlignment_(v) { return ALIGNMENT_VALUES.indexOf(v) !== -1; }
function isValidLineSpacing_(v) { return LINE_SPACING_VALUES.indexOf(v) !== -1; }
function isValidTextCaseMode_(v) { return Object.prototype.hasOwnProperty.call(TEXT_CASE_MODES, v); }
function isInRange_(v, min, max) { return typeof v === 'number' && !isNaN(v) && v >= min && v <= max; }

// Đổi hoa/thường tiếng Việt — hàm thuần, không đụng DocumentApp, test trực tiếp qua clasp run được.
// toUpperCase/toLowerCase của V8 không theo locale nên không gặp vấn đề kiểu "İ/i" Thổ Nhĩ Kỳ; với
// tiếng Việt dựng sẵn (NFC) độ dài chuỗi luôn giữ nguyên sau biến đổi.
function transformVietnameseCase_(text, mode) {
  switch (mode) {
    case TEXT_CASE_MODES.UPPERCASE:
      return text.toUpperCase();
    case TEXT_CASE_MODES.LOWERCASE:
      return text.toLowerCase();
    case TEXT_CASE_MODES.TITLE_CASE:
      return text.toLowerCase().replace(/\S+/gu, function (w) { return w.charAt(0).toUpperCase() + w.slice(1); });
    case TEXT_CASE_MODES.SENTENCE_CASE:
      return text.toLowerCase().replace(/(^\s*\S|[.!?]\s+\S)/gu, function (m) { return m.toUpperCase(); });
    default:
      throw new Error('Không hỗ trợ kiểu chữ hoa/thường: ' + mode);
  }
}

// Text.setText() không đảm bảo giữ định dạng ký tự (đậm/màu...) khi thay cả chuỗi — thay từng ký tự
// một tại đúng vị trí cũ (xoá 1 ký tự, chèn lại 1 ký tự) để giữ nguyên định dạng, chỉ đổi hoa/thường.
function applyTextCaseTransform_(body, mode) {
  body.getParagraphs().forEach(function (paragraph) {
    const text = paragraph.editAsText();
    const original = text.getText();
    if (original.length === 0) return;
    const transformed = transformVietnameseCase_(original, mode);
    if (transformed.length !== original.length) { text.setText(transformed); return; }
    for (let i = 0; i < transformed.length; i++) {
      if (transformed[i] !== original[i]) {
        text.deleteText(i, i);
        text.insertText(i, transformed[i]);
      }
    }
  });
}

// opts: { fontFamily, fontSize, bold, italic, underline, strikethrough, textColor, backgroundColor, textCase }
// Font/cỡ/đậm/nghiêng/gạch chân/gạch ngang/màu là thuộc tính cấp KÝ TỰ (class Text) — PHẢI áp dụng
// qua body.editAsText(), không phải lặp qua getParagraphs() (đó là cấp đoạn văn, xem
// applyParagraphFormatting_ bên dưới) — nhầm 2 cấp này là lỗi hay gặp nhất khi dùng DocumentApp.
function applyTextFormatting_(body, opts) {
  const text = body.editAsText();
  if (opts.fontFamily != null) text.setFontFamily(opts.fontFamily);
  if (opts.fontSize != null) text.setFontSize(opts.fontSize);
  if (opts.bold != null) text.setBold(opts.bold);
  if (opts.italic != null) text.setItalic(opts.italic);
  if (opts.underline != null) text.setUnderline(opts.underline);
  if (opts.strikethrough != null) text.setStrikethrough(opts.strikethrough);
  if (opts.textColor != null) text.setForegroundColor(opts.textColor);
  if (opts.backgroundColor != null) text.setBackgroundColor(opts.backgroundColor);
  // Đổi hoa/thường chạy SAU CÙNG: ký tự được chèn lại (deleteText+insertText ở trên) kế thừa định
  // dạng của ký tự liền kề — chạy sau khi font/màu/đậm đã áp dụng xong thì ký tự mới chèn mới thừa
  // hưởng đúng định dạng đích, không phải định dạng cũ còn sót lại.
  if (opts.textCase != null) applyTextCaseTransform_(body, opts.textCase);
}

// opts: { alignment, lineSpacing, spacingBeforePt, spacingAfterPt, firstLineIndentMm }
// Căn lề/giãn dòng/khoảng cách đoạn/thụt lề là thuộc tính cấp ĐOẠN VĂN (class Paragraph) — PHẢI lặp
// qua body.getParagraphs(). Lưu ý: chỉ trả về đoạn văn cấp ngoài cùng, KHÔNG bao gồm nội dung trong
// bảng/danh sách (giống hạn chế đã biết của RuleEngine.DocxInspector.gs) — chấp nhận được vì Bảng/
// Danh sách nằm ngoài phạm vi Phase 1.
function applyParagraphFormatting_(body, opts) {
  body.getParagraphs().forEach(function (paragraph) {
    if (opts.alignment != null) paragraph.setAlignment(DocumentApp.HorizontalAlignment[opts.alignment]);
    if (opts.lineSpacing != null) paragraph.setLineSpacing(opts.lineSpacing);
    if (opts.spacingBeforePt != null) paragraph.setSpacingBefore(opts.spacingBeforePt);
    if (opts.spacingAfterPt != null) paragraph.setSpacingAfter(opts.spacingAfterPt);
    if (opts.firstLineIndentMm != null) paragraph.setIndentFirstLine(mmToPoints(opts.firstLineIndentMm));
  });
}

// opts: { topMm, bottomMm, leftMm, rightMm } — dùng lại mmToPoints() (Core.Utils.gs), đúng quy ước
// đo lường đã dùng ở Bootstrap.InitializeSystem.gs#createDefaultTemplateDoc_ và RuleEngine.
function applyMarginFormatting_(body, opts) {
  if (opts.topMm != null) body.setMarginTop(mmToPoints(opts.topMm));
  if (opts.bottomMm != null) body.setMarginBottom(mmToPoints(opts.bottomMm));
  if (opts.leftMm != null) body.setMarginLeft(mmToPoints(opts.leftMm));
  if (opts.rightMm != null) body.setMarginRight(mmToPoints(opts.rightMm));
}
