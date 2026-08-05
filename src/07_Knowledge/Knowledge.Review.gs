// Rà soát căn cứ pháp lý của 1 văn bản, đối chiếu với các kho tri thức do người dùng tự chọn —
// ví dụ: văn bản hồ sơ thầu chỉ cần rà theo kho "Đấu thầu", không cần quét toàn bộ hệ thống
// (Product Owner, 2026-08-05: chọn kho phù hợp cho kết quả nhanh hơn, chính xác hơn, tiết kiệm hơn).

function reviewDocumentAgainstLibraries(user, documentId, libraryIds) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanView');

  let docText;
  try {
    docText = DocumentApp.openById(document.DriveFileID).getBody().getText();
  } catch (e) {
    return { success: false, error: 'DOCUMENT_NOT_READABLE' };
  }

  const contextParts = [];
  libraryIds.forEach(function (libraryId) {
    if (!hasPermission(user, libraryId, 'CanView')) return;
    const published = listDocumentsByLibrary(libraryId).filter(function (d) { return d.Status === 'PUBLISHED'; });
    scoreDocumentsByRelevance_(published, docText)
      .slice(0, 5)
      .forEach(function (scored) {
        if (scored.document.FileType !== 'GOOGLE_DOC') return;
        try {
          const text = DocumentApp.openById(scored.document.DriveFileID).getBody().getText();
          contextParts.push('## ' + scored.document.Title + '\n' + text.substring(0, 2500));
        } catch (e) { /* bỏ qua file không đọc được (PDF/ảnh) */ }
      });
  });

  const context = contextParts.length > 0
    ? contextParts.join('\n\n')
    : '(Không có tài liệu tham chiếu phù hợp trong các kho đã chọn)';

  const result = runAI({
    task: 'ANALYZE',
    input: {
      context: context,
      question: 'Hãy rà soát văn bản dưới đây, đối chiếu với các căn cứ pháp lý/tài liệu tham chiếu ở trên. ' +
        'Chỉ ra cụ thể: (1) căn cứ pháp lý bị thiếu, (2) căn cứ trích dẫn không chính xác hoặc không khớp ' +
        'với tài liệu tham chiếu, (3) nội dung có khả năng đã lỗi thời. Nếu không phát hiện vấn đề, nói rõ ' +
        'là không phát hiện vấn đề, không suy diễn thêm. Văn bản cần rà soát:\n\n' + docText.substring(0, 6000)
    }
  });

  return { success: result.success, error: result.error, review: result.text };
}

function suggestLibrariesForDocument(user, documentId) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanView');
  return suggestLibrariesForText_(user, document.Title + ' ' + (document.Tags || '') + ' ' + (document.Summary || ''));
}

function suggestLibrariesForQuestion(user, questionText) {
  return suggestLibrariesForText_(user, questionText);
}

// "Knowledge Scope Recommendation" rút gọn (Product Owner, 2026-08-05): gợi ý kho phù hợp bằng cách
// khớp tên/mô tả kho với nội dung tác vụ (tên văn bản, câu hỏi...). Đây là heuristic từ khoá — chưa
// phải Context Profile theo vai trò/đơn vị công tác hay lịch sử sử dụng 30 ngày như bản đầy đủ được
// mô tả — những phần đó cần lưu trữ lịch sử dùng và nhiều dữ liệu thực tế hơn để hiệu quả, nên hoãn
// lại tới khi có nhu cầu thực tế xác nhận cách làm hiện tại chưa đủ tốt (YAGNI). Người dùng luôn
// xem được toàn bộ danh sách kho và tự chọn lại — gợi ý không giới hạn quyền truy cập.
function suggestLibrariesForText_(user, text) {
  const libraries = listLibrariesForUser(user);
  const lowerText = text.toLowerCase();

  const scored = libraries.map(function (lib) {
    const nameMatch = lowerText.indexOf(lib.LibraryName.toLowerCase()) !== -1;
    const descWords = (lib.Description || '').toLowerCase().split(/\s+/).filter(function (w) { return w.length > 3; });
    const descScore = descWords.reduce(function (acc, w) { return acc + (lowerText.indexOf(w) !== -1 ? 1 : 0); }, 0);
    return { library: lib, score: (nameMatch ? 10 : 0) + descScore };
  }).sort(function (a, b) { return b.score - a.score; });

  const matched = scored.filter(function (s) { return s.score > 0; }).map(function (s) { return s.library; });
  return matched.length > 0 ? matched : libraries;
}

function scoreDocumentsByRelevance_(documents, referenceText) {
  const keywords = referenceText.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 3; });
  const uniqueKeywords = Array.from(new Set(keywords)).slice(0, 50);

  return documents
    .map(function (d) {
      const haystack = [d.Title, d.Tags, d.Keywords, d.Summary].filter(function (v) { return !isBlank(v); }).join(' ').toLowerCase();
      const score = uniqueKeywords.reduce(function (acc, kw) { return acc + (haystack.indexOf(kw) !== -1 ? 1 : 0); }, 0);
      return { document: d, score: score };
    })
    .sort(function (a, b) { return b.score - a.score; });
}
