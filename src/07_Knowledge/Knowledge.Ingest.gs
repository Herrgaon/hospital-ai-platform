// Nạp tài liệu mới vào kho tri thức — 2 giai đoạn theo docs/10-knowledge-design.md mục 9:
// (1) stageUploadForClassification: lưu tạm vào Uploads/_Inbox, chạy Rule Engine rồi AI (nếu cần),
//     trả gợi ý kèm độ tin cậy cho client, CHƯA ghi vào Documents sheet.
// (2) confirmClassificationAndSave: sau khi người dùng xác nhận/sửa, chuyển file vào đúng Library
//     và ghi bản ghi Document chính thức, trạng thái PENDING_REVIEW (chờ duyệt tri thức).

// Tải lên hàng loạt — xem docs/10-knowledge-design.md mục 13 (Bulk Document Import Policy).
// Xử lý TUẦN TỰ từng file (Apps Script vốn đơn luồng, không có xử lý song song thật để cân nhắc bỏ),
// 1 file lỗi không dừng các file còn lại — mỗi kết quả trả về độc lập cho client tổng hợp.
function stageBulkUpload(user, files) {
  const maxCount = getMaxBulkUploadCount();
  if (files.length > maxCount) {
    throw new Error('Bạn đang tải lên ' + files.length + ' tài liệu, vượt giới hạn ' + maxCount + ' tài liệu/lần. Vui lòng chia thành nhiều đợt.');
  }

  return files.map(function (f) {
    try {
      return { success: true, fileName: f.fileName, staging: stageUploadForClassification(user, f.fileName, f.mimeType, f.base64Data) };
    } catch (e) {
      return { success: false, fileName: f.fileName, error: e.message };
    }
  });
}

function stageUploadForClassification(user, fileName, mimeType, base64Data) {
  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType, fileName);
  const inbox = getUploadsInboxFolder();

  let parserCategory = detectParserCategory_(mimeType);
  let stagedFile;

  if (parserCategory === 'WORD') {
    const resource = { title: fileName, mimeType: MimeType.GOOGLE_DOCS, parents: [{ id: inbox.getId() }] };
    const converted = Drive.Files.insert(resource, blob, { convert: true });
    stagedFile = DriveApp.getFileById(converted.id);
    parserCategory = 'GOOGLE_DOC';
  } else {
    stagedFile = inbox.createFile(blob);
  }

  const parsed = parseDocumentForClassification_(stagedFile, parserCategory);

  // Document Duplication Check — Level 1 (Hash) — xem docs/10-knowledge-design.md mục 10.
  // Level 2-5 (số hiệu, độ giống tiêu đề/nội dung, AI semantic) hoãn lại (YAGNI), Level 1 đã chặn
  // được trường hợp phổ biến nhất: tải nhầm đúng 1 file đã có trong hệ thống.
  const duplicateOf = findDocumentByHash_(parsed.metadata.fileHash);

  const availableLibraries = listLibrariesForUser(user);
  const availableLibraryNames = availableLibraries.map(function (l) { return l.LibraryName; });

  const classification = classifyDocument_(fileName, parsed.docText, parsed.headingsText, availableLibraryNames);
  const threshold = getClassificationThreshold();
  const evaluated = evaluateConfidence_(classification.fields, threshold);

  return {
    fileId: stagedFile.getId(),
    fileName: fileName,
    parserCategory: parserCategory,
    metadata: parsed.metadata,
    ocrStatus: parsed.ocrStatus,
    accepted: evaluated.accepted,
    needsConfirmation: evaluated.needsConfirmation,
    allFields: classification.fields,
    aiError: classification.aiError,
    availableLibraries: availableLibraries,
    duplicateOf: duplicateOf
  };
}

function findDocumentByHash_(hash) {
  if (isBlank(hash)) return null;
  const match = getSheetRepository(SHEETS.DOCUMENTS).findAll().find(function (d) { return d.FileHash === hash; });
  if (!match) return null;
  return {
    documentId: match.DocumentID,
    title: match.Title,
    libraryId: match.LibraryID,
    ownerUserId: match.OwnerUserID,
    uploadedAt: match.CreatedAt,
    currentVersion: match.CurrentVersion
  };
}

// Uploader chọn "Huỷ" khi thấy cảnh báo trùng — dọn file tạm trong Uploads/_Inbox, không để rác lại.
function discardStagedUpload(user, fileId) {
  DriveApp.getFileById(fileId).setTrashed(true);
  logAudit(user.UserID, 'STAGED_UPLOAD_DISCARDED', 'Document', fileId, 'Huỷ do trùng với tài liệu đã có');
}

// finalFields: { libraryId, category, subCategory, documentType, issuer, importance, summary,
//                tags: [], keywords: [], applicableDepartments: [] }
// originalFields: `allFields` gốc trả về từ bước stage (dùng để so sánh, ghi Classification Feedback).
function confirmClassificationAndSave(user, fileId, fileName, parserCategory, metadata, ocrStatus, finalFields, originalFields) {
  requirePermission(user, finalFields.libraryId, 'CanCreate');

  const library = getSheetRepository(SHEETS.LIBRARIES).findById('LibraryID', finalFields.libraryId);
  const targetFolder = DriveApp.getFolderById(library.DriveFolderID);
  const file = DriveApp.getFileById(fileId);
  file.moveTo(targetFolder);

  const category = resolveOrCreateCategory_(finalFields.libraryId, finalFields.category);

  // Kho không yêu cầu duyệt (RequiresReview=false, ví dụ kho rủi ro thấp) → Published ngay,
  // không qua PENDING_REVIEW — xem docs/10-knowledge-design.md mục 9.
  const initialStatus = library.RequiresReview === false ? 'PUBLISHED' : 'PENDING_REVIEW';

  const doc = createDocumentRecordWithMetadata(user, finalFields.libraryId, category ? category.CategoryID : '', fileName, fileId, parserCategory, {
    SubCategory: finalFields.subCategory || '',
    DocumentType: finalFields.documentType || '',
    Issuer: finalFields.issuer || '',
    ApplicableDepartments: (finalFields.applicableDepartments || []).join(', '),
    Tags: (finalFields.tags || []).join(', '),
    Keywords: (finalFields.keywords || []).join(', '),
    Summary: finalFields.summary || '',
    Language: metadata.language || '',
    FileHash: metadata.fileHash || '',
    OcrStatus: ocrStatus || '',
    AiConfidence: JSON.stringify(originalFields || {}),
    Importance: finalFields.importance || '',
    Status: initialStatus
  });

  recordAllClassificationFeedback_(doc.DocumentID, originalFields, finalFields);

  return doc;
}

function recordAllClassificationFeedback_(documentId, originalFields, finalFields) {
  if (!originalFields) return;
  ['library', 'category', 'subCategory', 'documentType', 'issuer', 'importance'].forEach(function (field) {
    const original = originalFields[field];
    if (!original) return;
    const finalKey = field === 'library' ? 'libraryId' : field;
    const finalValue = finalFields[finalKey];
    recordClassificationFeedback_(documentId, field, original.value, finalValue, original.confidence, original.source);
  });
}

// Giữ lại cho các nơi khác (nếu có) muốn nạp file trực tiếp không qua pipeline phân loại,
// ví dụ import hàng loạt do Admin thực hiện thủ công.
function ingestUploadedFile(user, libraryId, categoryId, uploadedBlob) {
  requirePermission(user, libraryId, 'CanCreate');
  const library = getSheetRepository(SHEETS.LIBRARIES).findById('LibraryID', libraryId);
  const folder = DriveApp.getFolderById(library.DriveFolderID);

  const parserCategory = detectParserCategory_(uploadedBlob.getContentType());
  let file;
  let fileType;

  if (parserCategory === 'WORD') {
    const resource = { title: uploadedBlob.getName(), mimeType: MimeType.GOOGLE_DOCS, parents: [{ id: folder.getId() }] };
    const converted = Drive.Files.insert(resource, uploadedBlob, { convert: true });
    file = DriveApp.getFileById(converted.id);
    fileType = 'GOOGLE_DOC';
  } else {
    file = folder.createFile(uploadedBlob);
    fileType = uploadedBlob.getContentType();
  }

  return createDocumentRecord(user, libraryId, categoryId, file.getName(), file.getId(), fileType);
}
