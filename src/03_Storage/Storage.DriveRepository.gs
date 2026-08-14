// Lớp truy cập Google Drive dùng chung cho mọi Service. Service không được gọi DriveApp trực tiếp,
// luôn qua các hàm này.

function getRootFolder_() {
  return DriveApp.getFolderById(getConfig(CONFIG_KEYS.ROOT_FOLDER_ID));
}

function getOrCreateSubfolder(parentFolder, name) {
  const existing = parentFolder.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return parentFolder.createFolder(name);
}

// 1 thư mục con riêng cho mỗi Task — cho phép nhiều tệp đính kèm/việc mà không cần thêm 1 sheet
// Attachments riêng (liệt kê trực tiếp qua DriveApp khi cần, xem Task.Service.gs).
function getTaskAttachmentsFolder(taskId) {
  const uploadsRoot = getOrCreateSubfolder(getRootFolder_(), DRIVE_FOLDERS.UPLOADS);
  const tasksRoot = getOrCreateSubfolder(uploadsRoot, DRIVE_FOLDERS.UPLOADS_TASKS);
  return getOrCreateSubfolder(tasksRoot, taskId);
}

function getAvatarsFolder() {
  const systemFolder = getOrCreateSubfolder(getRootFolder_(), DRIVE_FOLDERS.SYSTEM);
  return getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_AVATARS);
}
