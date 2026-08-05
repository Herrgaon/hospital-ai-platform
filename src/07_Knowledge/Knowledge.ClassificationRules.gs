// Rule Engine phân loại tài liệu — LUÔN chạy trước AI, không dùng AI cho việc suy ra được bằng
// quy tắc (regex/từ khoá tên file). Xem docs/10-knowledge-design.md mục 9, Bước 3.
// Khác với RuleEngine.Core.gs (kiểm tra THỂ THỨC văn bản) — đây là rule PHÂN LOẠI, ruleSetId riêng.

function classifyByFilenameRules_(fileName) {
  const ruleSet = loadClassificationRuleSet_();
  const assigned = {};

  ruleSet.rules.forEach(function (rule) {
    const matched = rule.type === 'FILENAME_REGEX'
      ? new RegExp(rule.pattern, 'i').test(fileName)
      : rule.type === 'FILENAME_KEYWORD'
        ? fileName.toLowerCase().indexOf(rule.keyword.toLowerCase()) !== -1
        : false;

    if (!matched) return;
    Object.keys(rule.assign).forEach(function (field) {
      if (assigned[field] === undefined) {
        assigned[field] = { value: rule.assign[field], confidence: 100, source: 'RULE' };
      }
    });
  });

  return assigned;
}

function loadClassificationRuleSet_() {
  const ruleRow = getSheetRepository(SHEETS.RULES).findAll().find(function (r) {
    return r.RuleSetName === CLASSIFICATION_RULE_SET_NAME && r.Status === 'Active';
  });
  if (!ruleRow) return { rules: [] };
  return loadRuleSet(ruleRow.DriveFileID);
}

const CLASSIFICATION_RULE_SET_NAME = 'Phân loại tài liệu theo tên file';

function getDefaultClassificationRuleSetContent_() {
  // Ví dụ tối thiểu — Admin chỉnh sửa trực tiếp file JSON trên Drive
  // (/System/Rules/Rule_Classification.json) để bổ sung quy tắc riêng của bệnh viện, không cần sửa code.
  return JSON.stringify({
    ruleSetId: 'DOC_CLASSIFICATION_V1',
    name: CLASSIFICATION_RULE_SET_NAME,
    version: 1,
    rules: [
      { id: 'THONG_TU', type: 'FILENAME_REGEX', pattern: 'th[oô]ng[\\s_-]*t[uư]', assign: { documentType: 'Thông tư', category: 'Thông tư' } },
      { id: 'NGHI_DINH', type: 'FILENAME_REGEX', pattern: 'ngh[iị][\\s_-]*[dđ][iị]nh', assign: { documentType: 'Nghị định', category: 'Nghị định', library: 'Pháp luật' } },
      { id: 'QUYET_DINH', type: 'FILENAME_REGEX', pattern: 'quy[eế]t[\\s_-]*[dđ][iị]nh', assign: { documentType: 'Quyết định', category: 'Quyết định' } },
      { id: 'CONG_VAN', type: 'FILENAME_REGEX', pattern: 'c[oô]ng[\\s_-]*v[aă]n', assign: { documentType: 'Công văn', category: 'Công văn' } },
      { id: 'BIEU_MAU_PREFIX', type: 'FILENAME_REGEX', pattern: '^BM[._-]', assign: { library: 'Biểu mẫu' } },
      { id: 'QUY_TRINH_PREFIX', type: 'FILENAME_REGEX', pattern: '^QT[._-]', assign: { category: 'Quy trình' } }
    ]
  });
}
