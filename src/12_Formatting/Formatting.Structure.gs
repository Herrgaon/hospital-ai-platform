// Dựng LẠI bố cục thể thức hành chính (không chỉ font/cỡ/lề) — bổ sung sau khi Product Owner phản
// hồi bản đầu "nhiều chỗ khá xấu" (2026-08-06), kèm ảnh mẫu văn bản thật để đối chiếu. Vấn đề gốc:
// Quick Style trước đó chỉ chỉnh font/cỡ chữ/lề đồng loạt — với văn bản thô (dán trực tiếp/scan chưa
// có khung), kết quả vẫn phẳng, không có khung Quốc hiệu-Tiêu ngữ 2 CỘT đúng thể thức, không có tiêu
// đề in đậm giữa trang, không có đề mục La Mã in đậm — đúng những gì ảnh mẫu cho thấy khác biệt.
//
// Kỹ thuật: khung Quốc hiệu-Tiêu ngữ dùng BẢNG 1 hàng/2 cột ẩn viền (đúng cách các mẫu văn bản hành
// chính thật dùng trong Google Docs/Word — DocumentApp không có khái niệm "2 cột văn bản" như page
// layout, phải dùng bảng). Nhận diện tiêu đề/đề mục dựa trên MẪU VĂN BẢN (từ khoá loại văn bản, số La
// Mã đầu dòng) — không dùng AI (đúng nguyên tắc "AI không dùng cho việc kiểm tra được bằng luật").

const KNOWN_DOCUMENT_TYPE_LINES_ = [
  'KẾ HOẠCH', 'QUYẾT ĐỊNH', 'CÔNG VĂN', 'TỜ TRÌNH', 'THÔNG BÁO', 'BIÊN BẢN',
  'BÁO CÁO', 'CHỈ THỊ', 'NGHỊ QUYẾT', 'HƯỚNG DẪN', 'CÔNG ĐIỆN', 'GIẤY MỜI'
];
const ROMAN_HEADING_PATTERN_ = /^[IVXLCDM]+\.\s+\S/;

// Chèn khung Quốc hiệu-Tiêu ngữ 2 cột tại vị trí atIndex — cơ quan ban hành bên TRÁI, quốc hiệu-tiêu
// ngữ bên PHẢI, đúng thể thức Nghị định 30/2020/NĐ-CP (khác cách xếp chồng 1 cột trước đây).
function insertOfficialHeaderBlock_(body, atIndex, options) {
  const agencyLine = (options && options.agencyLine) || '[Tên cơ quan ban hành]';
  const docNumber = (options && options.docNumber) || 'Số: ……/……';
  const placeDate = (options && options.placeDate) || '……, ngày …… tháng …… năm ……';

  const table = body.insertTable(atIndex, [
    [agencyLine, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
    [docNumber, 'Độc lập - Tự do - Hạnh phúc']
  ]);
  table.setBorderWidth(0);

  const agencyCell = table.getCell(0, 0);
  agencyCell.editAsText().setBold(true);
  agencyCell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  const nationalHeaderCell = table.getCell(0, 1);
  nationalHeaderCell.editAsText().setBold(true);
  nationalHeaderCell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  const docNumberCell = table.getCell(1, 0);
  docNumberCell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.LEFT);

  const mottoCell = table.getCell(1, 1);
  mottoCell.editAsText().setBold(true).setUnderline(true);
  mottoCell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // Dòng địa danh, ngày tháng năm — nằm NGOÀI bảng (đã hết cột để căn riêng), căn phải toàn trang vẫn
  // rơi đúng nửa phải trang nên đủ đúng thị giác, đúng cách nhiều văn bản thật vẫn làm.
  const dateParagraph = body.insertParagraph(atIndex + 1, placeDate);
  dateParagraph.setAlignment(DocumentApp.HorizontalAlignment.RIGHT).editAsText().setItalic(true);

  // Dòng trống ngăn cách khung với nội dung bên dưới.
  body.insertParagraph(atIndex + 2, '');

  return table;
}

// true nếu ĐÃ có khung — dấu hiệu: có 1 Bảng nằm trong 2 phần tử đầu Body (đã chèn từ lần áp dụng
// trước, hoặc tài liệu vốn đã có sẵn khung). Xét 2 phần tử đầu chứ không chỉ phần tử đầu tiên vì
// Google Docs KHÔNG cho phép Bảng là phần tử đầu tiên tuyệt đối của văn bản — API tự chèn thêm 1 đoạn
// văn rỗng ngay trước bảng khi bảng được chèn ở vị trí 0 (phát hiện qua clasp run: kiểm tra chỉ
// child(0) luôn trả về false, khiến khung bị chèn LẶP LẠI mỗi lần bấm "Mặc định theo chuẩn").
function documentAlreadyHasHeaderBlock_(body) {
  const limit = Math.min(body.getNumChildren(), 2);
  for (let i = 0; i < limit; i++) {
    if (body.getChild(i).getType() === DocumentApp.ElementType.TABLE) return true;
  }
  return false;
}

function ensureOfficialHeaderBlock_(body, options) {
  if (documentAlreadyHasHeaderBlock_(body)) {
    return false;
  }
  insertOfficialHeaderBlock_(body, 0, options);
  return true;
}

// In đậm đề mục La Mã ("I. MỤC ĐÍCH"...) và in đậm+căn giữa dòng loại văn bản ("KẾ HOẠCH"...) cùng
// dòng trích yếu/tiêu đề ngay sau nó — CHỈ dựa trên mẫu văn bản rõ ràng (từ khoá/số La Mã đầu dòng),
// không đoán mò nội dung tuỳ ý để tránh in đậm/căn giữa nhầm đoạn văn thường.
function applyOfficialHeadingStyles_(body) {
  const paragraphs = body.getParagraphs();
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const text = paragraph.getText().trim();
    if (text.length === 0) continue;

    if (ROMAN_HEADING_PATTERN_.test(text)) {
      paragraph.editAsText().setBold(true);
      continue;
    }

    if (KNOWN_DOCUMENT_TYPE_LINES_.indexOf(text.toUpperCase()) !== -1) {
      paragraph.editAsText().setBold(true);
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      const titleParagraph = findNextNonEmptyParagraph_(paragraphs, i + 1);
      if (titleParagraph) {
        titleParagraph.editAsText().setBold(true);
        titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      }
    }
  }
}

function findNextNonEmptyParagraph_(paragraphs, startIndex) {
  for (let i = startIndex; i < paragraphs.length; i++) {
    if (paragraphs[i].getText().trim().length > 0) return paragraphs[i];
  }
  return null;
}

// Điểm vào dùng chung cho Quick Style — gộp cả 2 bước dựng khung + in đậm đề mục vào 1 lần mở/lưu
// tài liệu duy nhất (tránh mở/đóng nhiều lần không cần thiết).
function applyOfficialStructure_(driveFileId) {
  const doc = DocumentApp.openById(driveFileId);
  const body = doc.getBody();
  const headerInserted = ensureOfficialHeaderBlock_(body);
  applyOfficialHeadingStyles_(body);
  doc.saveAndClose();
  return { headerInserted: headerInserted };
}
