// Đồng bộ cấu trúc Sheet với SCHEMA hiện tại (Storage.Schema.gs) — dùng khi mã nguồn thêm cột/sheet
// mới SAU KHI hệ thống đã Initialize System. KHÔNG xoá cột/dữ liệu cũ, chỉ thêm cột/sheet còn thiếu
// — an toàn để chạy nhiều lần (idempotent). Admin chạy tay 1 lần mỗi khi cập nhật mã nguồn có đổi
// schema, thay vì phải Initialize lại từ đầu (sẽ mất toàn bộ dữ liệu đã có).
function syncSchemaWithSpreadsheet(user) {
  if (user.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được đồng bộ cấu trúc dữ liệu.');
  }

  const spreadsheet = getSystemSpreadsheet_();
  const report = [];

  Object.keys(SCHEMA).forEach(function (sheetName) {
    const expectedHeaders = SCHEMA[sheetName];
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      sheet.setFrozenRows(1);
      report.push(sheetName + ': tạo sheet mới (' + expectedHeaders.length + ' cột)');
    } else {
      const existingWidth = Math.max(sheet.getLastColumn(), 1);
      const existingHeaders = sheet.getRange(1, 1, 1, existingWidth).getValues()[0];
      const missing = expectedHeaders.filter(function (h) { return existingHeaders.indexOf(h) === -1; });

      if (missing.length > 0) {
        sheet.getRange(1, existingWidth + 1, 1, missing.length).setValues([missing]);
        report.push(sheetName + ': thêm cột ' + missing.join(', '));
      }
    }

    const finalWidth = Math.max(sheet.getLastColumn(), expectedHeaders.length);
    const rangeName = 'RNG_' + sheetName;
    spreadsheet.getNamedRanges()
      .filter(function (nr) { return nr.getName() === rangeName; })
      .forEach(function (nr) { nr.remove(); });
    spreadsheet.setNamedRange(rangeName, sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), finalWidth));
  });

  const backfillCount = backfillRuleTypeForExistingRows_();
  if (backfillCount > 0) {
    report.push('Rules: gán lại RuleType cho ' + backfillCount + ' dòng cũ (dữ liệu tạo trước khi có cột RuleType)');
  }

  logAudit(user.UserID, 'SCHEMA_SYNCED', 'System', spreadsheet.getId(), report.join(' | ') || 'Không có thay đổi');
  return { changes: report };
}

// Sửa dữ liệu cũ: các dòng Rules tạo trước khi có cột RuleType (xem RuleEngine.Core.gs và
// Knowledge.ClassificationRules.gs — 2 Rule Engine khác nhau dùng chung sheet, thiếu RuleType sẽ
// khiến cả hai không tìm thấy rule của mình). Suy luận RuleType từ RuleSetName đã biết trước.
function backfillRuleTypeForExistingRows_() {
  const repo = getSheetRepository(SHEETS.RULES);
  const rows = repo.findAll();
  let count = 0;
  rows.forEach(function (row) {
    if (!isBlank(row.RuleType)) return;
    const inferredType = row.RuleSetName === CLASSIFICATION_RULE_SET_NAME ? RULE_TYPES.CLASSIFICATION : RULE_TYPES.FORMAT_CHECK;
    repo.updateById('RuleID', row.RuleID, { RuleType: inferredType });
    count++;
  });
  return count;
}
