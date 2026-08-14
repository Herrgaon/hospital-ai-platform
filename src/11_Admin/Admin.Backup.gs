// Sao lưu định kỳ — xem docs/13-security.md mục 8. Trigger được tạo tự động khi Initialize System
// (xem ensureBackupTrigger_ tại Bootstrap.InitializeSystem.gs), không cần Admin tự vào Apps Script
// Editor để cấu hình Trigger thủ công.

function runScheduledBackup() {
  const spreadsheetId = getConfig(CONFIG_KEYS.SYSTEM_DB_SPREADSHEET_ID);
  const file = DriveApp.getFileById(spreadsheetId);

  const systemFolder = getOrCreateSubfolder(getRootFolder_(), DRIVE_FOLDERS.SYSTEM);
  const backupsFolder = getOrCreateSubfolder(systemFolder, DRIVE_FOLDERS.SYSTEM_BACKUPS);

  const timestamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmmss');
  file.makeCopy('BVDS_SystemDB_Backup_' + timestamp, backupsFolder);

  pruneOldBackups_(backupsFolder, 8);
}

function pruneOldBackups_(folder, keepCount) {
  const files = [];
  const iterator = folder.getFiles();
  while (iterator.hasNext()) {
    files.push(iterator.next());
  }
  files.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  files.slice(keepCount).forEach(function (f) { f.setTrashed(true); });
}
