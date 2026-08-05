// Document Parser + Metadata Extraction — xem docs/10-knowledge-design.md mục 9, Bước 1-2.
// KHÔNG dùng AI ở bước này — chỉ đọc cấu trúc/metadata bằng lập trình thông thường.

const WORD_MIME_TYPES_PARSER = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];

function detectParserCategory_(mimeType) {
  if (mimeType === MimeType.GOOGLE_DOCS) return 'GOOGLE_DOC';
  if (WORD_MIME_TYPES_PARSER.indexOf(mimeType) !== -1) return 'WORD';
  if (mimeType === MimeType.PDF) return 'PDF';
  if (mimeType.indexOf('image/') === 0) return 'IMAGE';
  if (mimeType === MimeType.PLAIN_TEXT || mimeType === 'text/plain') return 'TEXT';
  return 'OTHER';
}

// file: DriveApp File đã ở dạng cuối (DOCX đã được convert sang Google Docs trước khi gọi hàm này).
function parseDocumentForClassification_(file, parserCategory) {
  const metadata = {
    fileName: file.getName(),
    fileFormat: parserCategory,
    fileSizeBytes: file.getSize(),
    createdDate: file.getDateCreated().toISOString(),
    modifiedDate: file.getLastUpdated().toISOString(),
    fileHash: computeFileHash_(file)
  };

  let docText = '';
  let headingsText = '';
  let ocrStatus = 'NOT_APPLICABLE';

  if (parserCategory === 'GOOGLE_DOC') {
    const doc = DocumentApp.openById(file.getId());
    const body = doc.getBody();
    docText = body.getText();
    headingsText = extractHeadings_(body);
  } else if (parserCategory === 'PDF' || parserCategory === 'IMAGE') {
    try {
      docText = extractTextFromImage(file.getId());
      ocrStatus = isBlank(docText) ? 'EMPTY' : 'SUCCESS';
    } catch (e) {
      ocrStatus = 'FAILED';
    }
  } else if (parserCategory === 'TEXT') {
    docText = file.getBlob().getDataAsString();
  }

  metadata.language = detectLanguageHeuristic_(docText);
  metadata.titleGuess = extractTitleGuess_(docText, metadata.fileName);

  return { docText: docText, headingsText: headingsText, metadata: metadata, ocrStatus: ocrStatus };
}

function extractHeadings_(body) {
  const headingStyles = [
    DocumentApp.ParagraphHeading.HEADING1,
    DocumentApp.ParagraphHeading.HEADING2,
    DocumentApp.ParagraphHeading.HEADING3,
    DocumentApp.ParagraphHeading.TITLE
  ];
  const headings = body.getParagraphs()
    .filter(function (p) { return headingStyles.indexOf(p.getHeading()) !== -1 && p.getText().trim().length > 0; })
    .map(function (p) { return p.getText().trim(); });
  return headings.join('\n');
}

function computeFileHash_(file) {
  const bytes = file.getBlob().getBytes();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(function (b) { return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'); }).join('');
}

// Heuristic đơn giản (YAGNI) — không dùng thư viện phát hiện ngôn ngữ chuyên dụng, chỉ dựa trên
// tần suất ký tự có dấu tiếng Việt. Đủ dùng vì hệ thống chủ yếu chỉ có văn bản tiếng Việt/tiếng Anh.
function detectLanguageHeuristic_(text) {
  const sample = text.substring(0, 500);
  const vietnameseCharPattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  return vietnameseCharPattern.test(sample) ? 'vi' : 'en';
}

function extractTitleGuess_(text, fileName) {
  const firstLine = text.split('\n').map(function (l) { return l.trim(); }).find(function (l) { return l.length > 0; });
  return firstLine || fileName.replace(/\.[^.]+$/, '');
}
