// Đồng bộ cấu trúc Sheet với SCHEMA hiện tại (Storage.Schema.gs) — dùng khi mã nguồn thêm/đổi vị trí
// cột/sheet SAU KHI hệ thống đã Initialize System. KHÔNG mất dữ liệu cũ — đọc toàn bộ dữ liệu hiện có
// theo header CŨ (so khớp theo TÊN cột, không theo vị trí), rồi ghi lại đúng thứ tự header MỚI. An
// toàn để chạy nhiều lần (idempotent).
//
// LỊCH SỬ: phiên bản đầu chỉ "thêm cột còn thiếu vào CUỐI sheet" — sai khi cột mới được chèn ở GIỮA
// mảng SCHEMA (ví dụ RuleType), vì lúc đó vị trí cột trong SCHEMA không còn khớp vị trí cột vật lý
// trong Sheet, khiến toàn bộ giá trị các cột phía sau bị đọc/ghi lệch. Bản này sửa triệt để bằng cách
// luôn ghi lại theo đúng tên cột, không phụ thuộc vị trí.
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
      const lastRow = sheet.getLastRow();
      const existingWidth = Math.max(sheet.getLastColumn(), 1);
      const existingHeaders = sheet.getRange(1, 1, 1, existingWidth).getValues()[0];

      const headersMatch = existingHeaders.length === expectedHeaders.length &&
        existingHeaders.every(function (h, i) { return h === expectedHeaders[i]; });

      if (!headersMatch) {
        let existingRows = [];
        if (lastRow > 1) {
          existingRows = sheet.getRange(2, 1, lastRow - 1, existingWidth).getValues();
        }

        // So khớp theo TÊN cột — cột mới (chưa từng có) sẽ nhận giá trị rỗng, cột bị đổi vị trí
        // vẫn giữ đúng giá trị cũ.
        const remappedRows = existingRows.map(function (row) {
          const rowObj = {};
          existingHeaders.forEach(function (h, i) { if (h) rowObj[h] = row[i]; });
          return expectedHeaders.map(function (h) { return rowObj[h] !== undefined ? rowObj[h] : ''; });
        });

        sheet.clearContents();
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        if (remappedRows.length > 0) {
          sheet.getRange(2, 1, remappedRows.length, expectedHeaders.length).setValues(remappedRows);
        }
        sheet.setFrozenRows(1);
        report.push(sheetName + ': sắp xếp lại đúng thứ tự cột (' + remappedRows.length + ' dòng dữ liệu được giữ nguyên)');
      }
    }

    const rangeName = 'RNG_' + sheetName;
    spreadsheet.getNamedRanges()
      .filter(function (nr) { return nr.getName() === rangeName; })
      .forEach(function (nr) { nr.remove(); });
    spreadsheet.setNamedRange(rangeName, sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), expectedHeaders.length));
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
