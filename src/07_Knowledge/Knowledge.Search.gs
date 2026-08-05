// Tra cứu/tìm kiếm tài liệu — xem docs/09-ai-design.md mục 5.

// filters (tuỳ chọn): { status, documentType, importance } — rỗng/undefined = không lọc theo tiêu chí đó.
function searchDocumentsByKeyword(user, keyword, libraryId, filters) {
  const documents = libraryId
    ? listDocumentsByLibrary(libraryId)
    : getSheetRepository(SHEETS.DOCUMENTS).findAll();

  const visible = documents.filter(function (d) {
    return d.Status !== 'ARCHIVED' && hasPermission(user, d.LibraryID, 'CanView');
  });
  const lowerKeyword = keyword.toLowerCase();
  return visible
    .filter(function (d) { return matchesKeyword_(d, lowerKeyword); })
    .filter(function (d) { return matchesFilters_(d, filters); });
}

// DocumentType là văn bản tự do (Rule/AI gán, không phải enum cố định) nên so khớp theo chứa chuỗi,
// không phân biệt hoa/thường — giống cách matchesKeyword_ đã làm, tránh lọc "trượt" vì khác hoa/thường.
function matchesFilters_(document, filters) {
  if (!filters) return true;
  if (!isBlank(filters.status) && document.Status !== filters.status) return false;
  if (!isBlank(filters.documentType) && (document.DocumentType || '').toLowerCase().indexOf(filters.documentType.toLowerCase()) === -1) return false;
  if (!isBlank(filters.importance) && document.Importance !== filters.importance) return false;
  return true;
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

  const context = contextParts.length > 0 ? contextParts.join('\n\n') : '(Không tìm thấy tài liệu liên quan trong kho tài liệu)';

  const result = runAI({ task: 'QA', input: { context: context, question: question } });

  return {
    success: result.success,
    error: result.error,
    answer: result.text,
    sources: scored.map(function (r) { return { documentId: r.document.DocumentID, title: r.document.Title }; })
  };
}

// Hỏi đáp về 1 file đính kèm tức thời trong AI Chat — KHÔNG lưu vào kho tài liệu, chỉ trích văn bản
// tạm để làm ngữ cảnh trả lời rồi xoá ngay (khác hẳn luồng nạp tài liệu chính thức ở Knowledge.Ingest.gs).
// Dùng lại đúng cơ chế trích văn bản (parseDocumentForClassification_) đã có, không xây lại.
function askAboutAttachedFile(user, question, fileName, mimeType, base64Data) {
  let parserCategory = detectParserCategory_(mimeType);
  if (parserCategory === 'OTHER') {
    return { success: false, error: 'UNSUPPORTED_FILE_TYPE' };
  }

  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const inbox = getUploadsInboxFolder();

  let stagedFile;
  if (parserCategory === 'WORD') {
    const resource = { title: fileName, mimeType: MimeType.GOOGLE_DOCS, parents: [{ id: inbox.getId() }] };
    const converted = Drive.Files.insert(resource, blob, { convert: true });
    stagedFile = DriveApp.getFileById(converted.id);
    parserCategory = 'GOOGLE_DOC';
  } else {
    stagedFile = inbox.createFile(blob);
  }

  let docText = '';
  let ocrStatus = 'NOT_APPLICABLE';
  try {
    const parsed = parseDocumentForClassification_(stagedFile, parserCategory);
    docText = parsed.docText;
    ocrStatus = parsed.ocrStatus;
  } finally {
    stagedFile.setTrashed(true);
  }

  if (isBlank(docText)) {
    return { success: false, error: ocrStatus === 'FAILED' ? 'OCR_FAILED' : 'EMPTY_FILE' };
  }

  const context = '## ' + fileName + '\n' + docText.substring(0, 8000);
  const result = runAI({ task: 'QA', input: { context: context, question: question } });

  return {
    success: result.success,
    error: result.error,
    answer: result.text,
    sources: [{ documentId: null, title: fileName }]
  };
}
