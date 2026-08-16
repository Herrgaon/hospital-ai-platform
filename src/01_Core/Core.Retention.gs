// Lưu trữ file có thời hạn — theo yêu cầu Product Owner 2026-08-16: "file công việc" (và các file tải
// về khác, không phải dữ liệu gốc trong Sheet) không cần giữ vĩnh viễn. Xác nhận cơ chế: CHUYỂN VÀO
// THÙNG RÁC DRIVE (không xoá vĩnh viễn ngay) — Drive giữ thêm ~30 ngày trong Thùng rác trước khi tự dọn
// hẳn, nên vẫn khôi phục được nếu tính sai. KHÔNG BAO GIỜ dọn file của Task chưa hoàn thành (ASSIGNED/
// IN_PROGRESS/SUBMITTED), dù cũ đến đâu — chỉ dọn Task đã EVALUATED/CANCELLED và đã quá hạn kể từ lần
// cập nhật cuối (UpdatedAt, phản ánh đúng thời điểm hoàn tất/huỷ).

const FILE_RETENTION_DAYS_ = 30;
const FILE_RETENTION_TRIGGER_HANDLER_ = 'runScheduledFileCleanup_';

function requireFileRetentionManager_(actingUser) {
  if (actingUser.Role !== ROLE_NAMES.SUPER_ADMIN) {
    throw new Error('Chỉ Quản trị hệ thống được quản lý lưu trữ file.');
  }
}

// An toàn để gọi lại nhiều lần (idempotent) — mỗi lượt chỉ dọn đúng file CHƯA bị Trash, quá hạn tính
// từ mốc gọi hàm, không phụ thuộc lần chạy trước.
function cleanupExpiredFiles(actingUser) {
  requireFileRetentionManager_(actingUser);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FILE_RETENTION_DAYS_);

  let taskFilesTrashed = 0;
  const tasks = getSheetRepository(SHEETS.TASKS).findAll().filter(function (t) {
    return (t.Status === 'EVALUATED' || t.Status === 'CANCELLED') && !isBlank(t.AttachmentFolderDriveID);
  });
  tasks.forEach(function (t) {
    if (new Date(t.UpdatedAt) >= cutoff) return;
    try {
      const files = DriveApp.getFolderById(t.AttachmentFolderDriveID).getFiles();
      while (files.hasNext()) {
        const f = files.next();
        if (!f.isTrashed()) { f.setTrashed(true); taskFilesTrashed++; }
      }
    } catch (e) {
      // Thư mục có thể đã bị xoá tay trước đó — bỏ qua 1 Task lỗi, không chặn cả lượt dọn dẹp.
    }
  });

  // File Excel xuất ra (Audit Log, Tổng hợp kế toán...) — bản TẢI VỀ, không phải dữ liệu gốc (dữ liệu
  // gốc vẫn nguyên trong Sheet) nên luôn an toàn để dọn theo ngày tạo file trực tiếp.
  let exportFilesTrashed = 0;
  const exportFiles = getExportsFolder().getFiles();
  while (exportFiles.hasNext()) {
    const f = exportFiles.next();
    if (!f.isTrashed() && f.getDateCreated() < cutoff) { f.setTrashed(true); exportFilesTrashed++; }
  }

  logAudit(actingUser.UserID, 'FILE_RETENTION_CLEANUP', 'System', 'RETENTION',
    'Chuyển vào Thùng rác: ' + taskFilesTrashed + ' file đính kèm công việc, ' + exportFilesTrashed +
    ' file xuất Excel (quá ' + FILE_RETENTION_DAYS_ + ' ngày, mốc ' + Utilities.formatDate(cutoff, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd') + ')');
  return { taskFilesTrashed: taskFilesTrashed, exportFilesTrashed: exportFilesTrashed, retentionDays: FILE_RETENTION_DAYS_ };
}

// Bật chạy TỰ ĐỘNG hằng ngày (2h sáng, giờ ít người dùng nhất) — idempotent, không tạo trigger trùng
// nếu đã bật. PHẢI được SUPER_ADMIN bật thủ công qua UI, KHÔNG tự cài lúc deploy code (tránh cài lặp
// qua nhiều lần deploy, và tránh bật tính năng xoá-file tự động mà không ai chủ động xác nhận).
function installFileRetentionTrigger(actingUser) {
  requireFileRetentionManager_(actingUser);
  const existing = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === FILE_RETENTION_TRIGGER_HANDLER_; });
  if (existing) return { alreadyInstalled: true };
  ScriptApp.newTrigger(FILE_RETENTION_TRIGGER_HANDLER_).timeBased().everyDays(1).atHour(2).create();
  logAudit(actingUser.UserID, 'FILE_RETENTION_TRIGGER_INSTALLED', 'System', 'RETENTION', 'Bật dọn dẹp file tự động hằng ngày lúc 02:00');
  return { alreadyInstalled: false };
}

function uninstallFileRetentionTrigger(actingUser) {
  requireFileRetentionManager_(actingUser);
  const triggers = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === FILE_RETENTION_TRIGGER_HANDLER_; });
  triggers.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  logAudit(actingUser.UserID, 'FILE_RETENTION_TRIGGER_REMOVED', 'System', 'RETENTION', 'Tắt dọn dẹp file tự động');
  return { removed: triggers.length };
}

function isFileRetentionTriggerInstalled(actingUser) {
  requireFileRetentionManager_(actingUser);
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === FILE_RETENTION_TRIGGER_HANDLER_; });
}

// Hàm ĐÍCH của trigger — chạy không có phiên đăng nhập (do ScriptApp gọi, không qua Web App), tự đóng
// vai "hệ thống" khi ghi Audit Log thay vì actingUser thật.
function runScheduledFileCleanup_() {
  cleanupExpiredFiles({ UserID: 'SYSTEM_TRIGGER', Role: ROLE_NAMES.SUPER_ADMIN });
}
