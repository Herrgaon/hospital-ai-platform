// Lớp truy cập Google Sheets dùng chung cho mọi Service — xem docs/05-architecture.md mục 3.
// Service không được gọi SpreadsheetApp trực tiếp, luôn qua getSheetRepository().

function getSystemSpreadsheet_() {
  const id = getConfig(CONFIG_KEYS.SYSTEM_DB_SPREADSHEET_ID);
  return SpreadsheetApp.openById(id);
}

function getSheetRepository(sheetName) {
  return {
    append: function (rowObject) {
      const sheet = getSystemSpreadsheet_().getSheetByName(sheetName);
      const headers = SCHEMA[sheetName];
      const row = headers.map(function (h) { return rowObject[h] !== undefined ? rowObject[h] : ''; });
      sheet.appendRow(row);
      return rowObject;
    },

    findAll: function () {
      const sheet = getSystemSpreadsheet_().getSheetByName(sheetName);
      const headers = SCHEMA[sheetName];
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];
      const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
      return values.map(function (row) { return rowToObject_(headers, row); });
    },

    findById: function (idColumn, idValue) {
      return this.findAll().filter(function (r) { return r[idColumn] === idValue; })[0] || null;
    },

    updateById: function (idColumn, idValue, patch) {
      const sheet = getSystemSpreadsheet_().getSheetByName(sheetName);
      const headers = SCHEMA[sheetName];
      const idIndex = headers.indexOf(idColumn);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return null;
      const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
      const values = range.getValues();
      for (let i = 0; i < values.length; i++) {
        if (values[i][idIndex] === idValue) {
          headers.forEach(function (h, colIndex) {
            if (patch[h] !== undefined) values[i][colIndex] = patch[h];
          });
          range.setValues(values);
          return rowToObject_(headers, values[i]);
        }
      }
      return null;
    }
  };
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach(function (h, i) { obj[h] = row[i]; });
  return obj;
}
