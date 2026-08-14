// Điểm vào Web App — xem docs/05-architecture.md mục 2.

function doGet(e) {
  if (!isSystemInitialized()) {
    return HtmlService.createTemplateFromFile('ui/Bootstrap').evaluate()
      .setTitle('Hệ thống Quản lý Công việc – BVĐK Đông Sơn - Khởi tạo hệ thống')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const template = HtmlService.createTemplateFromFile('ui/Index');
  return template.evaluate()
    .setTitle('Hệ thống Quản lý Công việc – BVĐK Đông Sơn')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(fileName) {
  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}
