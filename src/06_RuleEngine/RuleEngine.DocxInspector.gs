// Trích xuất cấu trúc Google Doc thành object trung gian cho RuleEngine.Core.gs.
// Đây là heuristic hợp lý cho Phase 1 (đoạn văn/font/lề), KHÔNG kiểm tra bố cục 2 cột
// (tên cơ quan bên trái / quốc hiệu bên phải) — xem giới hạn tại docs/08-rule-engine.md mục 7.

function inspectDocument(driveFileId) {
  const doc = DocumentApp.openById(driveFileId);
  const body = doc.getBody();
  const paragraphs = body.getParagraphs();

  return {
    fonts: extractFonts_(paragraphs),
    bodyFontSize: extractBodyFontSize_(paragraphs),
    margins: {
      top: pointsToMm(body.getMarginTop()),
      bottom: pointsToMm(body.getMarginBottom()),
      left: pointsToMm(body.getMarginLeft()),
      right: pointsToMm(body.getMarginRight())
    },
    fields: {
      title: doc.getName(),
      fileName: doc.getName(),
      docNumber: extractDocNumber_(paragraphs)
    },
    structureBlocks: extractStructureBlocks_(paragraphs)
  };
}

function extractFonts_(paragraphs) {
  const fonts = {};
  paragraphs.forEach(function (p) {
    const text = p.editAsText();
    if (text.getText().length === 0) return;
    const font = text.getFontFamily(0);
    if (font) fonts[font] = true;
  });
  return Object.keys(fonts);
}

function extractBodyFontSize_(paragraphs) {
  const sizes = paragraphs
    .map(function (p) {
      const text = p.editAsText();
      return text.getText().length > 0 ? text.getFontSize(0) : null;
    })
    .filter(function (size) { return size !== null; });
  return sizes.length > 0 ? mostFrequent(sizes) : 0;
}

function extractDocNumber_(paragraphs) {
  const match = paragraphs.find(function (p) { return /^\s*Số:/i.test(p.getText()); });
  return match ? match.getText().trim() : '';
}

function extractStructureBlocks_(paragraphs) {
  const blocks = [];
  const topParagraphs = paragraphs.slice(0, 6);
  const hasNationalHeader = topParagraphs.some(function (p) {
    return p.getText().toUpperCase().indexOf('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM') !== -1;
  });
  if (hasNationalHeader) blocks.push('NATIONAL_HEADER');
  return blocks;
}
