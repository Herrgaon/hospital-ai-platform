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

  logAudit(user.UserID, 'SCHEMA_SYNCED', 'System', spreadsheet.getId(), report.join(' | ') || 'Không có thay đổi');
  return { changes: report };
}
