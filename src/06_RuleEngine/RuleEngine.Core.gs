// Thực thi Rule Set bằng lập trình thông thường (không AI) — xem docs/08-rule-engine.md.
// Cài đặt đầy đủ handler theo RuleEngine.DocxInspector.gs thuộc Phase 1 (docs/16-development-roadmap.md).

function loadRuleSet(driveFileId) {
  const file = DriveApp.getFileById(driveFileId);
  return JSON.parse(file.getBlob().getDataAsString());
}

function runRuleSet(ruleSet, inspectedDocument) {
  const results = ruleSet.rules.map(function (rule) {
    const handler = RULE_HANDLERS[rule.type];
    if (!handler) {
      throw new Error('Không có handler cho loại rule: ' + rule.type);
    }
    const passed = handler(rule.params, inspectedDocument);
    return { ruleId: rule.id, description: rule.description, severity: rule.severity, passed: passed };
  });
  return {
    passed: results.every(function (r) { return r.passed || r.severity !== 'ERROR'; }),
    results: results
  };
}

// CHỈ lấy Rule kiểm tra thể thức (RuleType=FORMAT_CHECK) — sheet Rules còn chứa cả Rule phân loại
// tài liệu (RuleType=CLASSIFICATION, xem Knowledge.ClassificationRules.gs), 2 loại rule có cấu trúc
// "type" khác nhau hoàn toàn, lẫn vào đây sẽ crash vì RULE_HANDLERS không có handler tương ứng.
function getApplicableRuleSets(libraryId) {
  const ruleRows = getSheetRepository(SHEETS.RULES).findAll().filter(function (r) {
    return r.Status === 'Active' && r.RuleType === RULE_TYPES.FORMAT_CHECK && (r.LibraryID === '*' || r.LibraryID === libraryId);
  });
  return ruleRows.map(function (r) { return loadRuleSet(r.DriveFileID); });
}

// Dùng bởi Formatting.Service.gs (Quick Style "Định dạng công văn") để đọc đúng 1 rule set theo id —
// tái dùng cơ chế đọc rule của Rule Engine thay vì tự đọc Drive lại, đảm bảo checker và formatter
// luôn cùng 1 nguồn dữ liệu.
function getRuleSetById(libraryId, ruleSetId) {
  return getApplicableRuleSets(libraryId).find(function (rs) { return rs.ruleSetId === ruleSetId; }) || null;
}

function checkDocument(user, documentId) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanEdit');

  const inspected = inspectDocument(document.DriveFileID);
  const ruleSets = getApplicableRuleSets(document.LibraryID);

  const ruleSetResults = ruleSets.map(function (ruleSet) {
    const outcome = runRuleSet(ruleSet, inspected);
    return { ruleSetId: ruleSet.ruleSetId, ruleSetName: ruleSet.name, passed: outcome.passed, results: outcome.results };
  });

  const hasError = ruleSetResults.some(function (rs) { return !rs.passed; });
  if (hasError) {
    updateDocumentStatus(user, documentId, 'NEEDS_EDIT');
  }
  logAudit(user.UserID, 'DOCUMENT_RULE_CHECKED', 'Document', documentId, hasError ? 'FAILED' : 'PASSED');

  return { documentId: documentId, passed: !hasError, ruleSets: ruleSetResults };
}

const RULE_HANDLERS = {
  FONT_CHECK: function (params, doc) { return doc.fonts.every(function (f) { return params.allowedFonts.indexOf(f) !== -1; }); },
  FONT_SIZE_CHECK: function (params, doc) { return doc.bodyFontSize >= params.min && doc.bodyFontSize <= params.max; },
  MARGIN_CHECK: function (params, doc) {
    return doc.margins.top >= params.top[0] && doc.margins.top <= params.top[1] &&
      doc.margins.bottom >= params.bottom[0] && doc.margins.bottom <= params.bottom[1] &&
      doc.margins.left >= params.left[0] && doc.margins.left <= params.left[1] &&
      doc.margins.right >= params.right[0] && doc.margins.right <= params.right[1];
  },
  REGEX_CHECK: function (params, doc) { return new RegExp(params.pattern).test(doc.fields[params.field] || ''); },
  REQUIRED_FIELD_CHECK: function (params, doc) { return !isBlank(doc.fields[params.field]); },
  STRUCTURE_CHECK: function (params, doc) { return doc.structureBlocks.indexOf(params.requiredBlock) !== -1; }
};
