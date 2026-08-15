// Tự động cấp quyền TẠM THỜI theo lịch trực — đúng §31 đặc tả KPI + Quản lý Trực & Làm ngoài giờ V1:
// "Không cấp cố định User → Role = Trưởng trực" mà suy ra Quyền tạm thời từ chuỗi
// User → DutyAssignment → Vai trò trong ca → Quyền tạm thời, tự động hết hiệu lực khi hết ca.
// KHÔNG ghi bất kỳ dòng Permissions nào vào Sheet — luôn tính lại tại đúng thời điểm hành động, nên
// không có trạng thái lưu trữ nào có thể "quên thu hồi" sau khi ca kết thúc (đúng §39: "Không cấp
// quyền Trưởng trực thủ công nếu quyền có thể sinh từ lịch").
//
// "Trưởng trực" KHÔNG hard-code theo tên vị trí ("TT") — DutyPositions.IsTruongTruc (cấu hình qua màn
// Danh mục trực) mới là nguồn xác định, đúng nguyên tắc "công thức/tiêu chí phải cấu hình được".

const HANOI_TZ_ = 'Asia/Ho_Chi_Minh';

function addDaysToDateString_(dateStr, days) {
  const parts = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

// Ca qua đêm khi ShiftEnd <= ShiftStart (VD 18:00 -> 06:00) — cửa sổ hiệu lực trải qua 2 ngày dương
// lịch: từ ShiftStart ngày ShiftDate đến ShiftEnd ngày hôm sau.
function isNowWithinShiftWindow_(shift, todayStr, nowTimeStr) {
  const crossesMidnight = shift.ShiftEnd <= shift.ShiftStart;
  if (!crossesMidnight) {
    return todayStr === shift.ShiftDate && nowTimeStr >= shift.ShiftStart && nowTimeStr < shift.ShiftEnd;
  }
  const nextDayStr = addDaysToDateString_(shift.ShiftDate, 1);
  const firstNight = todayStr === shift.ShiftDate && nowTimeStr >= shift.ShiftStart;
  const secondNight = todayStr === nextDayStr && nowTimeStr < shift.ShiftEnd;
  return firstNight || secondNight;
}

function truongTrucPositionNames_() {
  return listActiveDutyPositions().filter(function (p) { return p.IsTruongTruc; }).map(function (p) { return p.PositionName; });
}

// Trả về ca trực OFFICIAL hiện tại (nếu có) mà nhân viên này đang giữ vị trí Trưởng trực — null nếu
// không có. Dùng cho cả banner "Bạn đang là Trưởng trực ca..." (§33) lẫn kiểm tra quyền khi Lập danh
// sách làm ngoài giờ (Giai đoạn 4 sẽ gọi requireTruongTrucForShift_ bên dưới).
function getActiveDutyLeaderShiftForEmployee_(employeeId) {
  const truongTrucNames = truongTrucPositionNames_();
  if (truongTrucNames.length === 0) return null;

  const todayStr = Utilities.formatDate(new Date(), HANOI_TZ_, 'yyyy-MM-dd');
  const nowTimeStr = Utilities.formatDate(new Date(), HANOI_TZ_, 'HH:mm');
  const yesterdayStr = addDaysToDateString_(todayStr, -1);

  const candidates = getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().filter(function (s) {
    if (s.Status !== 'OFFICIAL') return false;
    if (s.EmployeeID !== employeeId) return false;
    if (truongTrucNames.indexOf(s.RoleInShift) === -1) return false;
    // Chỉ xét ca hôm nay/hôm qua — đủ để phủ mọi ca qua đêm, tránh quét toàn bộ lịch sử mỗi lần kiểm
    // tra quyền (hàm này có thể được gọi trên đường đi của một request thông thường).
    return s.ShiftDate === todayStr || s.ShiftDate === yesterdayStr;
  });

  return candidates.find(function (s) { return isNowWithinShiftWindow_(s, todayStr, nowTimeStr); }) || null;
}

function getMyActiveDutyLeaderShift(user) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return null;
  const shift = getActiveDutyLeaderShiftForEmployee_(employee.EmployeeID);
  if (!shift) return null;
  return { shift: shift, schedule: getSheetRepository(SHEETS.DUTY_SCHEDULES).findById('DutyScheduleID', shift.DutyScheduleID) };
}

// Điểm kiểm tra bắt buộc TRƯỚC khi cho phép "Lập danh sách làm ngoài giờ" của 1 ca cụ thể (module Làm
// ngoài giờ riêng — Giai đoạn 4 — sẽ gọi hàm này). Đúng §39: "Không cho người không có phân công lập
// danh sách ngoài giờ của ca đó." CỐ Ý không có ngoại lệ SUPER_ADMIN — đây là quyền gắn với vai trò
// TRONG CA thực tế, không phải quyền quản trị hệ thống.
function requireTruongTrucForShift_(actingUser, dutyShiftId) {
  const shift = getSheetRepository(SHEETS.DUTY_SHIFTS).findById('DutyShiftID', dutyShiftId);
  if (!shift) throw new Error('Không tìm thấy ca trực.');

  const employee = getEmployeeByUserId_(actingUser.UserID);
  if (!employee || shift.EmployeeID !== employee.EmployeeID) {
    throw new Error('Bạn không phải người giữ vai trò Trưởng trực của ca này.');
  }
  if (truongTrucPositionNames_().indexOf(shift.RoleInShift) === -1) {
    throw new Error('Vị trí trực của bạn trong ca này không phải Trưởng trực.');
  }
  if (shift.Status !== 'OFFICIAL') {
    throw new Error('Quyền này chỉ có hiệu lực với ca trực đã công bố chính thức.');
  }

  const todayStr = Utilities.formatDate(new Date(), HANOI_TZ_, 'yyyy-MM-dd');
  const nowTimeStr = Utilities.formatDate(new Date(), HANOI_TZ_, 'HH:mm');
  if (!isNowWithinShiftWindow_(shift, todayStr, nowTimeStr)) {
    throw new Error('Quyền lập danh sách làm ngoài giờ chỉ có hiệu lực trong phạm vi ca trực — ca này chưa bắt đầu hoặc đã kết thúc.');
  }
  return shift;
}
