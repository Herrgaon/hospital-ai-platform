// Định dạng văn bản — tầng nghiệp vụ: kiểm tra quyền, validate, điều phối. Xem
// docs/10-knowledge-design.md và kế hoạch Document Formatting Module Phase 1 (2026-08-06).

// formatOptions: { text?: {...}, paragraph?: {...}, margins?: {...} } — xem Formatting.Primitives.gs
// cho tên field đầy đủ của từng nhóm. Trả về mảng lỗi tiếng Việt, rỗng = hợp lệ.
function validateFormatOptions_(formatOptions) {
  const errors = [];
  const text = formatOptions.text || {};
  const paragraph = formatOptions.paragraph || {};
  const margins = formatOptions.margins || {};

  if (text.fontFamily != null && !isValidFontFamily_(text.fontFamily)) errors.push('Phông chữ không hợp lệ');
  if (text.fontSize != null && !isInRange_(text.fontSize, 8, 32)) errors.push('Cỡ chữ phải trong khoảng 8-32');
  ['bold', 'italic', 'underline', 'strikethrough'].forEach(function (k) {
    if (text[k] != null && typeof text[k] !== 'boolean') errors.push('Giá trị "' + k + '" phải là true/false');
  });
  if (text.textColor != null && !isValidHexColor_(text.textColor)) errors.push('Màu chữ không hợp lệ (cần dạng #RRGGBB)');
  if (text.backgroundColor != null && !isValidHexColor_(text.backgroundColor)) errors.push('Màu tô sáng không hợp lệ (cần dạng #RRGGBB)');
  if (text.textCase != null && !isValidTextCaseMode_(text.textCase)) errors.push('Kiểu hoa/thường không hợp lệ');

  if (paragraph.alignment != null && !isValidAlignment_(paragraph.alignment)) errors.push('Căn lề không hợp lệ');
  if (paragraph.lineSpacing != null && !isValidLineSpacing_(paragraph.lineSpacing)) errors.push('Giãn dòng không hợp lệ');
  if (paragraph.spacingBeforePt != null && !isInRange_(paragraph.spacingBeforePt, 0, 72)) errors.push('Khoảng cách trước đoạn phải trong khoảng 0-72pt');
  if (paragraph.spacingAfterPt != null && !isInRange_(paragraph.spacingAfterPt, 0, 72)) errors.push('Khoảng cách sau đoạn phải trong khoảng 0-72pt');
  if (paragraph.firstLineIndentMm != null && !isInRange_(paragraph.firstLineIndentMm, 0, 50)) errors.push('Thụt lề dòng đầu phải trong khoảng 0-50mm');

  ['topMm', 'bottomMm', 'leftMm', 'rightMm'].forEach(function (k) {
    if (margins[k] != null && !isInRange_(margins[k], 5, 100)) errors.push('Lề "' + k + '" phải trong khoảng 5-100mm');
  });

  // Client (form thủ công) luôn gửi đủ tên field nhưng để null cho field "không đổi" — nên phải đếm
  // giá trị KHÁC null, không phải đếm tên field (Object.keys luôn > 0 kể cả khi mọi giá trị đều null).
  const hasAnyValue = [text, paragraph, margins].some(function (group) {
    return Object.keys(group).some(function (k) { return group[k] != null; });
  });
  if (!hasAnyValue) {
    errors.push('Chưa chọn thay đổi định dạng nào');
  }

  return errors;
}

// Không tự kiểm tra quyền — nơi gọi (applyManualFormatting/applyND30QuickStyle/applyAiFormattingCommand)
// đã requirePermission trước khi tới đây, giống quy ước ở Document.Service.gs.
function applyFormatOptionsToDocument_(driveFileId, formatOptions) {
  const errors = validateFormatOptions_(formatOptions);
  if (errors.length > 0) {
    throw new Error('Định dạng không hợp lệ: ' + errors.join('; '));
  }
  const doc = DocumentApp.openById(driveFileId);
  const body = doc.getBody();
  if (formatOptions.text) applyTextFormatting_(body, formatOptions.text);
  if (formatOptions.paragraph) applyParagraphFormatting_(body, formatOptions.paragraph);
  if (formatOptions.margins) applyMarginFormatting_(body, formatOptions.margins);
  doc.saveAndClose();
}

// Hàm gốc theo driveFileId — dùng chung cho cả 2 luồng: (1) tài liệu ĐÃ có trong hệ thống (qua
// applyManualFormatting, đã requirePermission trước khi tới đây), (2) file người dùng tải lên tạm để
// chỉnh định dạng (trang "Chỉnh sửa định dạng" — không thuộc Library nào nên không có quyền theo Thư
// viện để kiểm tra; Drive ACL + Web App chạy executeAs USER_ACCESSING đã tự chặn người khác đụng vào
// file không phải của họ, xem Formatting.Upload.gs).
function applyManualFormattingToFile(user, driveFileId, formatOptions) {
  applyFormatOptionsToDocument_(driveFileId, formatOptions);
  logAudit(user.UserID, 'DOCUMENT_FORMATTED', 'File', driveFileId, JSON.stringify(formatOptions));
  return { success: true, applied: formatOptions };
}

function applyManualFormatting(user, documentId, formatOptions) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanEdit');
  applyFormatOptionsToDocument_(document.DriveFileID, formatOptions);
  logAudit(user.UserID, 'DOCUMENT_FORMATTED', 'Document', documentId, JSON.stringify(formatOptions));
  return { success: true, applied: formatOptions };
}

// "Định dạng công văn (Nghị định 30)" — 1 chạm, KHÔNG dùng AI (font/cỡ/lề đã có sẵn giá trị chính
// xác trong Rule_NghiDinh30.json, không cần AI suy đoán). Đọc TRỰC TIẾP rule set mà RuleEngine dùng
// để kiểm tra — 1 nguồn dữ liệu duy nhất: Admin sửa file JSON trên Drive thì cả kiểm tra lẫn định
// dạng tự động đều theo giá trị mới, không cần sửa code.
const ND30_RULE_SET_ID = 'ND30_FORMAT_V1';

const ND30_RULE_TYPE_MAPPERS_ = {
  FONT_CHECK: function (params, formatOptions) {
    formatOptions.text = formatOptions.text || {};
    formatOptions.text.fontFamily = params.allowedFonts[0];
  },
  FONT_SIZE_CHECK: function (params, formatOptions) {
    formatOptions.text = formatOptions.text || {};
    formatOptions.text.fontSize = params.max;
  },
  MARGIN_CHECK: function (params, formatOptions) {
    formatOptions.margins = {
      topMm: (params.top[0] + params.top[1]) / 2,
      bottomMm: (params.bottom[0] + params.bottom[1]) / 2,
      leftMm: (params.left[0] + params.left[1]) / 2,
      rightMm: (params.right[0] + params.right[1]) / 2
    };
  }
};

// Rule REGEX_CHECK/STRUCTURE_CHECK (số hiệu văn bản, quốc hiệu-tiêu ngữ) không có mapper tương ứng —
// đó là nội dung/cấu trúc, không phải định dạng có thể "1 chạm áp dụng", nên bị bỏ qua có chủ đích.
function buildFormatOptionsFromRuleSet_(ruleSet) {
  const formatOptions = {};
  ruleSet.rules.forEach(function (rule) {
    const mapper = ND30_RULE_TYPE_MAPPERS_[rule.type];
    if (mapper) mapper(rule.params, formatOptions);
  });
  return formatOptions;
}

// libraryId: '*' hợp lệ (rule ND30 đăng ký ở mức toàn hệ thống, LibraryID='*') — dùng cho file tải
// lên tạm không thuộc Library nào. Hàm gốc theo driveFileId, xem lý do ở applyManualFormattingToFile.
function applyND30QuickStyleToFile(user, driveFileId, libraryId) {
  const ruleSet = getRuleSetById(libraryId || '*', ND30_RULE_SET_ID);
  if (!ruleSet) {
    return { success: false, error: 'ND30_RULE_SET_NOT_FOUND' };
  }
  const formatOptions = buildFormatOptionsFromRuleSet_(ruleSet);
  applyFormatOptionsToDocument_(driveFileId, formatOptions);
  logAudit(user.UserID, 'DOCUMENT_ND30_QUICK_STYLE_APPLIED', 'File', driveFileId, ruleSet.ruleSetId);
  return { success: true, ruleSetId: ruleSet.ruleSetId, applied: formatOptions };
}

function applyND30QuickStyle(user, documentId) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanEdit');

  const ruleSet = getRuleSetById(document.LibraryID, ND30_RULE_SET_ID);
  if (!ruleSet) {
    return { success: false, error: 'ND30_RULE_SET_NOT_FOUND' };
  }

  const formatOptions = buildFormatOptionsFromRuleSet_(ruleSet);
  applyFormatOptionsToDocument_(document.DriveFileID, formatOptions);
  logAudit(user.UserID, 'DOCUMENT_ND30_QUICK_STYLE_APPLIED', 'Document', documentId, ruleSet.ruleSetId);
  return { success: true, ruleSetId: ruleSet.ruleSetId, applied: formatOptions };
}
