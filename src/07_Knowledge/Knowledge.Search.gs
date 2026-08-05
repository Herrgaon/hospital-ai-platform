// Tra cứu/tìm kiếm tài liệu — xem docs/09-ai-design.md mục 5.

function searchDocumentsByKeyword(user, keyword, libraryId) {
  const documents = libraryId
    ? listDocumentsByLibrary(libraryId)
    : getSheetRepository(SHEETS.DOCUMENTS).findAll();

  const visible = documents.filter(function (d) { return hasPermission(user, d.LibraryID, 'CanView'); });
  const lowerKeyword = keyword.toLowerCase();
  return visible.filter(function (d) { return matchesKeyword_(d, lowerKeyword); });
}

function matchesKeyword_(document, lowerKeyword) {
  const haystack = [document.Title, document.Tags, document.Keywords, document.Summary, document.DocumentType, document.Issuer]
    .filter(function (v) { return !isBlank(v); })
    .join(' | ')
    .toLowerCase();
  return haystack.indexOf(lowerKeyword) !== -1;
}

// Hỏi đáp theo tài liệu (RAG cơ bản) — xem docs/09-ai-design.md mục 5. CHỈ dùng tài liệu
// Status = PUBLISHED (đã qua duyệt tri thức — xem Knowledge.Governance.gs) làm ngữ cảnh cho AI,
// đúng nguyên tắc "chỉ tri thức đã xác minh mới được AI dùng để trả lời người dùng".
// libraryIds: mảng LibraryID để giới hạn phạm vi tra cứu (Knowledge Scope — Product Owner,
// 2026-08-05: phạm vi nhỏ nhưng đúng luôn tốt hơn quét toàn hệ thống). Rỗng/null = toàn bộ kho
// người dùng xem được.
function askKnowledgeBase(user, question, libraryIds) {
  const scopedLibraryIds = libraryIds && libraryIds.length > 0 ? libraryIds : null;
  const candidates = scopedLibraryIds
    ? scopedLibraryIds.reduce(function (acc, libId) { return acc.concat(listDocumentsByLibrary(libId)); }, [])
    : getSheetRepository(SHEETS.DOCUMENTS).findAll();

  const visible = candidates.filter(function (d) {
    return d.Status === 'PUBLISHED' && hasPermission(user, d.LibraryID, 'CanView');
  });

  const scored = scoreDocumentsByRelevance_(visible, question).filter(function (r) { return r.score > 0; }).slice(0, 3);

  const contextParts = scored
    .map(function (r) {
      if (r.document.FileType !== 'GOOGLE_DOC') return null;
      try {
        const text = DocumentApp.openById(r.document.DriveFileID).getBody().getText();
        return '## ' + r.document.Title + '\n' + text.substring(0, 3000);
      } catch (e) {
        return null;
      }
    })
    .filter(function (t) { return t !== null; });

  const context = contextParts.length > 0 ? contextParts.join('\n\n') : '(Không tìm thấy tài liệu liên quan trong kho tri thức)';

  const result = runAI({ task: 'QA', input: { context: context, question: question } });

  return {
    success: result.success,
    error: result.error,
    answer: result.text,
    sources: scored.map(function (r) { return { documentId: r.document.DocumentID, title: r.document.Title }; })
  };
}
