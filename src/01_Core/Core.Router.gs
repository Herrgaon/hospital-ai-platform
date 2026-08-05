// Điểm vào Web App — xem docs/05-architecture.md mục 2.

function doGet(e) {
  if (!isSystemInitialized()) {
    return HtmlService.createTemplateFromFile('ui/Bootstrap').evaluate()
      .setTitle('AI Office Platform - Khởi tạo hệ thống')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const template = HtmlService.createTemplateFromFile('ui/Index');
  return template.evaluate()
    .setTitle('AI Office Platform')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
