// Apps Script không có API đọc file khác trong cùng Project tại runtime, nên nội dung Rule mặc định
// (giữ đồng bộ thủ công với src/06_RuleEngine/Rules/*.json, vốn là bản tham chiếu cho Git/Code Review)
// phải được nhúng ở đây để Bootstrap.InitializeSystem.gs ghi ra Drive khi khởi tạo lần đầu.

function getRuleFileContent_(fileName) {
  const content = {
    'Rule_NghiDinh30.json': JSON.stringify({
      ruleSetId: 'ND30_FORMAT_V1',
      name: 'Thể thức văn bản hành chính theo Nghị định 30/2020/NĐ-CP',
      appliesTo: ['DOCX', 'GOOGLE_DOC'],
      version: 1,
      rules: [
        { id: 'FONT_FAMILY', description: 'Toàn văn bản dùng font Times New Roman', type: 'FONT_CHECK', params: { allowedFonts: ['Times New Roman'] }, severity: 'ERROR' },
        { id: 'FONT_SIZE_BODY', description: 'Cỡ chữ phần nội dung là 13-14pt', type: 'FONT_SIZE_CHECK', params: { scope: 'BODY', min: 13, max: 14 }, severity: 'ERROR' },
        { id: 'MARGIN', description: 'Lề trên/dưới 20-25mm, trái 30-35mm, phải 15-20mm', type: 'MARGIN_CHECK', params: { top: [20, 25], bottom: [20, 25], left: [30, 35], right: [15, 20] }, severity: 'ERROR' },
        { id: 'DOC_NUMBER_FORMAT', description: 'Số ký hiệu văn bản đúng định dạng Số: {n}/{năm}/{viết tắt cơ quan}-{viết tắt đơn vị}', type: 'REGEX_CHECK', params: { field: 'docNumber', pattern: '^Số:\\s*\\d+/[A-ZĐ\\-]+$' }, severity: 'ERROR' },
        { id: 'NATIONAL_HEADER', description: 'Có Quốc hiệu - Tiêu ngữ trong các dòng đầu văn bản', type: 'STRUCTURE_CHECK', params: { requiredBlock: 'NATIONAL_HEADER' }, severity: 'ERROR' }
      ]
    }, null, 2),
    'Rule_Document.json': JSON.stringify({
      ruleSetId: 'DOCUMENT_GENERAL_V1',
      name: 'Quy tắc chung về tên file và metadata văn bản',
      appliesTo: ['DOCX', 'GOOGLE_DOC', 'PDF'],
      version: 1,
      rules: [
        { id: 'FILE_NAME_FORMAT', description: 'Tên file không chứa ký tự đặc biệt, không dấu cách kép', type: 'REGEX_CHECK', params: { field: 'fileName', pattern: '^[^\\\\/:*?"<>|]+$' }, severity: 'WARNING' },
        { id: 'METADATA_TITLE_REQUIRED', description: 'Văn bản phải có tiêu đề (Title) không rỗng', type: 'REQUIRED_FIELD_CHECK', params: { field: 'title' }, severity: 'ERROR' }
      ]
    }, null, 2)
  };
  return content[fileName];
}
