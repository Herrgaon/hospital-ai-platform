// Lớp truy cập Google Drive dùng chung cho mọi Service — xem docs/12-storage-design.md mục 3.
// Service không được gọi DriveApp trực tiếp, luôn qua các hàm này.

function getRootFolder_() {
  return DriveApp.getFolderById(getConfig(CONFIG_KEYS.ROOT_FOLDER_ID));
}

function getOrCreateSubfolder(parentFolder, name) {
  const existing = parentFolder.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(name);
}

function getLibraryFolder(libraryName) {
  const librariesRoot = getOrCreateSubfolder(getRootFolder_(), DRIVE_FOLDERS.LIBRARIES);
  return getOrCreateSubfolder(librariesRoot, libraryName);
}

function getUploadsInboxFolder() {
  const uploadsRoot = getOrCreateSubfolder(getRootFolder_(), DRIVE_FOLDERS.UPLOADS);
  return getOrCreateSubfolder(uploadsRoot, DRIVE_FOLDERS.UPLOADS_INBOX);
}
