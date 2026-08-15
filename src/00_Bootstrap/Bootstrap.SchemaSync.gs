// Đồng bộ cấu trúc Sheet với SCHEMA hiện tại (Storage.Schema.gs) — dùng khi mã nguồn thêm/đổi vị trí
// cột/sheet SAU KHI hệ thống đã Initialize System. KHÔNG mất dữ liệu cũ — đọc toàn bộ dữ liệu hiện có
// theo header CŨ (so khớp theo TÊN cột, không theo vị trí), rồi ghi lại đúng thứ tự header MỚI. An
// toàn để chạy nhiều lần (idempotent).
//
// LỊCH SỬ: phiên bản đầu chỉ "thêm cột còn thiếu vào CUỐI sheet" — sai khi cột mới được chèn ở GIỮA
// mảng SCHEMA, vì lúc đó vị trí cột trong SCHEMA không còn khớp vị trí cột vật lý trong Sheet, khiến
// toàn bộ giá trị các cột phía sau bị đọc/ghi lệch. Bản này sửa triệt để bằng cách luôn ghi lại theo
// đúng tên cột, không phụ thuộc vị trí.
//
// 2026-08-15: hệ thống tái cấu trúc sang miền nghiệp vụ mới (Quản lý công việc/Lịch trực/KPI) — thêm
// bước XOÁ hẳn các sheet không còn nằm trong SCHEMA (Documents/Libraries/Templates/Rules/Workflows...)
// khỏi Google Sheet thật, tránh để lại dữ liệu cũ gây nhầm lẫn (Product Owner yêu cầu tái cấu trúc
// toàn bộ, không chỉ ngừng tham chiếu trong code).
function syncSchemaWithSpreadsheet(user) {
  if (user.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được đồng bộ cấu trúc dữ liệu.');
  }

  const spreadsheet = getSystemSpreadsheet_();
  const report = [];
  const expectedSheetNames = Object.keys(SCHEMA);

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

    // Idempotent — an toàn gọi lại mỗi lần đồng bộ, kể cả khi không có gì thay đổi ở trên (vá cho hệ
    // thống khởi tạo trước khi có PLAIN_TEXT_COLUMNS, hoặc khi danh sách cột này được bổ sung sau này).
    applyPlainTextColumnFormats_(sheet, sheetName);

    const rangeName = 'RNG_' + sheetName;
    spreadsheet.getNamedRanges()
      .filter(function (nr) { return nr.getName() === rangeName; })
      .forEach(function (nr) { nr.remove(); });
    spreadsheet.setNamedRange(rangeName, sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), expectedHeaders.length));
  });

  const removedSheets = removeObsoleteSheets_(spreadsheet, expectedSheetNames);
  removedSheets.forEach(function (name) { report.push(name + ': xoá sheet (thuộc miền nghiệp vụ cũ, không còn dùng)'); });

  logAudit(user.UserID, 'SCHEMA_SYNCED', 'System', spreadsheet.getId(), report.join(' | ') || 'Không có thay đổi');
  return { changes: report };
}

// Xoá mọi sheet KHÔNG còn xuất hiện trong SCHEMA hiện tại — dữ liệu cũ (Documents/Libraries/
// Templates/Rules/Categories/Workflows/WorkflowInstances/WorkflowStepLog/ClassificationFeedback...)
// bị xoá thẳng khỏi bảng tính thật, không chỉ ngừng tham chiếu trong code (yêu cầu tái cấu trúc toàn
// bộ của Product Owner, 2026-08-15). Google Sheets không cho phép xoá HẾT sheet — luôn giữ lại ít
// nhất 1 sheet, nên bỏ qua nếu spreadsheet chỉ còn đúng 1 sheet thuộc diện xoá.
function removeObsoleteSheets_(spreadsheet, expectedSheetNames) {
  const removed = [];
  spreadsheet.getSheets().forEach(function (sheet) {
    const name = sheet.getName();
    if (expectedSheetNames.indexOf(name) !== -1) return;
    if (spreadsheet.getSheets().length <= 1) return;
    spreadsheet.deleteSheet(sheet);
    removed.push(name);
  });
  return removed;
}
