// Quản lý danh mục trong 1 Library (cây phân cấp) — xem docs/10-knowledge-design.md mục 2.

function createCategory(user, libraryId, categoryName, parentCategoryId) {
  requirePermission(user, libraryId, 'CanManage');
  const category = getSheetRepository(SHEETS.CATEGORIES).append({
    CategoryID: generateId('CAT'),
    LibraryID: libraryId,
    CategoryName: categoryName,
    ParentCategoryID: parentCategoryId || ''
  });
  logAudit(user.UserID, 'CATEGORY_CREATED', 'Category', category.CategoryID, categoryName);
  return category;
}

function listCategoriesByLibrary(libraryId) {
  return getSheetRepository(SHEETS.CATEGORIES).findAll().filter(function (c) { return c.LibraryID === libraryId; });
}
