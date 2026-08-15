// Lớp truy cập Google Sheets dùng chung cho mọi Service — xem docs/05-architecture.md mục 3.
// Service không được gọi SpreadsheetApp trực tiếp, luôn qua getSheetRepository().

// Cache Ở CẤP EXECUTION (biến toàn cục sống hết 1 lượt gọi google.script.run, KHÔNG phải cache xuyên
// nhiều lượt gọi như CacheService) — phát hiện qua đo thời gian thực tế: api_getInitialAppData gọi
// ~10 hàm Service, mỗi hàm bên trong lại gọi getSheetRepository() cho 1-2 sheet, mỗi lần đều
// SpreadsheetApp.openById() lại TỪ ĐẦU dù cùng 1 spreadsheet — SpreadsheetApp.openById() là 1 trong
// những lệnh tốn thời gian nhất của Apps Script (mở kết nối), lặp lại 15-20 lần trong 1 lượt gọi cộng
// dồn thành độ trễ rõ rệt lúc đăng nhập. Chỉ cache HANDLE (đối tượng Spreadsheet), KHÔNG cache dữ liệu
// ô — mọi lệnh getRange()...getValues() sau đó vẫn đọc dữ liệu MỚI NHẤT như cũ, không có rủi ro dữ liệu
// cũ. An toàn vì ID spreadsheet không đổi giữa các lệnh trong cùng 1 lượt gọi.
let cachedSystemSpreadsheet_ = null;
function getSystemSpreadsheet_() {
  if (cachedSystemSpreadsheet_) return cachedSystemSpreadsheet_;
  const id = getConfig(CONFIG_KEYS.SYSTEM_DB_SPREADSHEET_ID);
  cachedSystemSpreadsheet_ = SpreadsheetApp.openById(id);
  return cachedSystemSpreadsheet_;
}

function getSheetRepository(sheetName) {
  return {
    // Định dạng PHẢI đặt trước khi ghi giá trị, không phải sau — appendRow() rồi mới setNumberFormat()
    // đã thử và sai (xác nhận qua clasp run: "06:00" bị Sheets tự phân tích thành giờ ngay lúc
    // appendRow, mất số 0 đầu thành "6:00" — đổi định dạng SAU đó chỉ đổi cách hiển thị/đọc ra, không
    // phục hồi được giá trị gốc đã mất). Vì vậy tính trước vị trí dòng mới, định dạng đúng ô đó, rồi
    // mới ghi giá trị bằng setValues() thay vì appendRow().
    append: function (rowObject) {
      const sheet = getSystemSpreadsheet_().getSheetByName(sheetName);
      const headers = SCHEMA[sheetName];
      const row = headers.map(function (h) { return rowObject[h] !== undefined ? rowObject[h] : ''; });
      const nextRow = sheet.getLastRow() + 1;
      applyPlainTextFormatToRow_(sheet, sheetName, nextRow);
      sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
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

// Ép định dạng Plain Text cho đúng các cột liệt kê ở PLAIN_TEXT_COLUMNS (Storage.Schema.gs) — ngăn
// Google Sheets tự chuyển chuỗi "YYYY-MM-DD"/"YYYY-MM" thành kiểu Date nội bộ.
//
// LỊCH SỬ: bản đầu ép định dạng trước cho 50.000 dòng/cột ngay lúc tạo sheet — phát hiện qua clasp run
// thực tế: getRange() với hàng vượt kích thước hiện tại buộc MỞ RỘNG CẢ SHEET (mọi cột, không chỉ cột
// đang định dạng), tổng số ô toàn bảng tính vượt trần 10.000.000 ô của Google Sheets chỉ sau vài sheet.
// Sửa bằng cách định dạng ĐÚNG 1 DÒNG vừa ghi mỗi lần append() — chi phí không đổi theo thời gian, không
// cần đoán trước cần bao nhiêu dòng. applyPlainTextColumnFormats_ (gọi lúc tạo sheet + đồng bộ schema)
// giữ vai trò vá lưới an toàn cho dữ liệu cũ, phạm vi nhỏ, không đủ để chạm trần ô.
function applyPlainTextFormatToRow_(sheet, sheetName, rowIndex) {
  const columns = PLAIN_TEXT_COLUMNS[sheetName];
  if (!columns || columns.length === 0) return;
  const headers = SCHEMA[sheetName];
  columns.forEach(function (columnName) {
    const colIndex = headers.indexOf(columnName);
    if (colIndex === -1) return;
    sheet.getRange(rowIndex, colIndex + 1).setNumberFormat('@');
  });
}

const PLAIN_TEXT_FORMAT_SAFETY_NET_ROWS_ = 2000;

function applyPlainTextColumnFormats_(sheet, sheetName) {
  const columns = PLAIN_TEXT_COLUMNS[sheetName];
  if (!columns || columns.length === 0) return;
  const headers = SCHEMA[sheetName];
  columns.forEach(function (columnName) {
    const colIndex = headers.indexOf(columnName);
    if (colIndex === -1) return;
    sheet.getRange(2, colIndex + 1, PLAIN_TEXT_FORMAT_SAFETY_NET_ROWS_, 1).setNumberFormat('@');
  });
}
