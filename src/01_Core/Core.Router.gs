// Điểm vào Web App — xem docs/05-architecture.md mục 2.

function doGet(e) {
  if (!isSystemInitialized()) {
    return HtmlService.createTemplateFromFile('ui/Bootstrap').evaluate()
      .setTitle('Hệ thống trợ lý hỗ trợ xử lý văn bản - Khởi tạo hệ thống')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const template = HtmlService.createTemplateFromFile('ui/Index');
  return template.evaluate()
    .setTitle('Hệ thống trợ lý hỗ trợ xử lý văn bản')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
