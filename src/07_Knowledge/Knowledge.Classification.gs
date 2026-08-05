// Điều phối phân loại tài liệu: Rule Engine trước, AI chỉ bù cho trường Rule chưa xác định được,
// đánh giá độ tin cậy theo ngưỡng Admin cấu hình. Xem docs/10-knowledge-design.md mục 9.

const CLASSIFICATION_FIELDS = [
  'library', 'category', 'subCategory', 'documentType', 'issuer',
  'importance', 'summary', 'tags', 'keywords', 'applicableDepartments'
];

function classifyDocument_(fileName, docText, headingsText, availableLibraryNames) {
  const ruleFields = classifyByFilenameRules_(fileName);
  const missingFields = CLASSIFICATION_FIELDS.filter(function (f) { return ruleFields[f] === undefined; });

  let aiFields = {};
  let aiError = null;
  if (missingFields.length > 0 && !isBlank(docText)) {
    const aiResult = classifyByAI_(fileName, docText, headingsText, missingFields, availableLibraryNames);
    if (aiResult.success) {
      aiFields = aiResult.fields;
    } else {
      aiError = aiResult.error;
    }
  }

  // Rule Engine luôn ưu tiên hơn AI khi cả hai cùng xác định một trường (không nên xảy ra vì AI
  // chỉ được yêu cầu điền missingFields, nhưng vẫn merge theo thứ tự này để tôn trọng đúng nguyên tắc
  // "AI không được quyền tự quyết định hoàn toàn việc phân loại tài liệu").
  const fields = Object.assign({}, aiFields, ruleFields);
  return { fields: fields, aiError: aiError };
}

function evaluateConfidence_(fields, threshold) {
  const accepted = {};
  const needsConfirmation = {};

  Object.keys(fields).forEach(function (field) {
    const f = fields[field];
    if (f.source === 'RULE' || f.confidence >= threshold) {
      accepted[field] = f;
    } else {
      needsConfirmation[field] = f;
    }
  });

  return { accepted: accepted, needsConfirmation: needsConfirmation };
}

// Tìm Category theo tên (không phân biệt hoa/thường) trong 1 Library, tạo mới nếu chưa có.
// Không yêu cầu CanManage riêng — nếu người dùng đã có CanCreate để upload vào Library này thì
// việc tự phát sinh 1 Category khớp tên gợi ý là một phần hợp lý của thao tác upload đó.
function resolveOrCreateCategory_(libraryId, categoryName) {
  if (isBlank(categoryName)) return null;
  const existing = listCategoriesByLibrary(libraryId).find(function (c) {
    return c.CategoryName.toLowerCase() === categoryName.toLowerCase();
  });
  if (existing) return existing;
  return getSheetRepository(SHEETS.CATEGORIES).append({
    CategoryID: generateId('CAT'),
    LibraryID: libraryId,
    CategoryName: categoryName,
    ParentCategoryID: ''
  });
}

function resolveLibraryByName_(libraryName, availableLibraries) {
  if (isBlank(libraryName)) return null;
  return availableLibraries.find(function (l) { return l.LibraryName.toLowerCase() === libraryName.toLowerCase(); }) || null;
}

function recordClassificationFeedback_(documentId, field, suggested, final, confidence, source) {
  if (suggested === final) return; // chỉ ghi khi người dùng THỰC SỰ sửa lại so với đề xuất
  getSheetRepository(SHEETS.CLASSIFICATION_FEEDBACK).append({
    FeedbackID: generateId('FB'),
    DocumentID: documentId,
    Field: field,
    SuggestedValue: String(suggested),
    FinalValue: String(final),
    Confidence: confidence,
    Source: source,
    Timestamp: nowIso()
  });
}

// Báo cáo độ chính xác phân loại — chỉ dùng dữ liệu đã có sẵn (ClassificationFeedback chỉ ghi khi
// người dùng THỰC SỰ sửa lại đề xuất, xem recordClassificationFeedback_ ở trên), nên "đúng" ở đây
// suy ra từ (tổng tài liệu đã phân loại - số lần bị sửa), không cần thêm bảng ghi "khớp".
function getClassificationAccuracyReport(user) {
  if (user.Role !== ROLE_NAMES.ADMIN) {
    throw new Error('Chỉ Admin được xem báo cáo độ chính xác phân loại.');
  }

  const totalClassified = getSheetRepository(SHEETS.DOCUMENTS).findAll()
    .filter(function (d) { return !isBlank(d.AiConfidence); }).length;

  const feedback = getSheetRepository(SHEETS.CLASSIFICATION_FEEDBACK).findAll();

  const byField = {};
  const patternCounts = {};
  feedback.forEach(function (f) {
    byField[f.Field] = (byField[f.Field] || 0) + 1;
    const patternKey = f.Field + '||' + f.SuggestedValue + '||' + f.FinalValue;
    patternCounts[patternKey] = patternCounts[patternKey] || { field: f.Field, suggested: f.SuggestedValue, final: f.FinalValue, count: 0 };
    patternCounts[patternKey].count++;
  });

  const fieldReport = Object.keys(byField).map(function (field) {
    const corrections = byField[field];
    const accuracyRate = totalClassified > 0 ? Math.round(((totalClassified - corrections) / totalClassified) * 1000) / 10 : null;
    return { field: field, corrections: corrections, accuracyRate: accuracyRate };
  }).sort(function (a, b) { return b.corrections - a.corrections; });

  const topPatterns = Object.values(patternCounts)
    .sort(function (a, b) { return b.count - a.count; })
    .slice(0, 15);

  return {
    totalClassified: totalClassified,
    totalCorrections: feedback.length,
    byField: fieldReport,
    topPatterns: topPatterns
  };
}
