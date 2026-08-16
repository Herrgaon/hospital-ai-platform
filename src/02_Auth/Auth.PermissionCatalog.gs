// "Kho quyền dùng chung toàn hệ thống", nhóm theo MODULE nghiệp vụ thực tế (đúng Đặc tả Cơ chế Phân
// quyền V1 §1/§22 "mỗi phân quyền gắn với hệ thống thực tế, cần bổ sung khi có chức năng mới"). Đây là
// NGUỒN SỰ THẬT DUY NHẤT cho việc UI hiển thị tên quyền tiếng Việt — không hard-code tên quyền rải rác
// trong HTML. Khi thêm module/chức năng mới: (1) thêm 1 mục vào PERMISSION_MODULES_, (2) truyền đúng
// module đó vào requirePermission()/hasPermission() ở Service tương ứng.
//
// CHỦ ĐÍCH ĐƠN GIẢN HOÁ: vẫn dùng chung 10 hành động (CanView...CanExport) cho mọi module — KHÔNG tách
// thành mã hành động tự do riêng từng quyền (VD "Duyệt lịch trực" và "Duyệt đổi trực" hiện dùng CHUNG
// CanApprove trong module DUTY_SCHEDULE, không tách 2 dòng riêng) — tách được nhưng cần đổi hẳn
// Permissions từ "1 dòng/module/khoa-phòng gộp 10 cờ" sang "1 dòng/hành động", ngoài phạm vi đợt này.
// Mỗi module chỉ liệt kê CÁC HÀNH ĐỘNG THỰC SỰ ĐƯỢC KIỂM TRA ở Service (khớp requirePermission() thật
// trong code, không bịa hành động không có tác dụng).
const PERMISSION_MODULES_ = [
  {
    key: 'DUTY_SCHEDULE', label: 'Lịch trực', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem lịch trực' },
      { action: 'CanCreate', label: 'Tạo lịch trực' },
      { action: 'CanEdit', label: 'Sửa lịch trực' },
      { action: 'CanSubmit', label: 'Gửi duyệt lịch trực' },
      { action: 'CanApprove', label: 'Phê duyệt lịch trực / đổi trực' },
      { action: 'CanReject', label: 'Từ chối lịch trực / đổi trực' },
      { action: 'CanPublish', label: 'Công bố lịch trực' }
    ]
  },
  {
    key: 'TASK', label: 'Công việc', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem công việc' },
      { action: 'CanCreate', label: 'Giao việc / Lập mẫu định kỳ' },
      { action: 'CanEdit', label: 'Can thiệp công việc (thay người khác)' },
      { action: 'CanApprove', label: 'Đánh giá công việc' }
    ]
  },
  {
    key: 'CLINICAL_ASSIGNMENT', label: 'Phân công chuyên môn', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem phân công chuyên môn' },
      { action: 'CanCreate', label: 'Tạo phân công chuyên môn' },
      { action: 'CanEdit', label: 'Sửa phân công chuyên môn' },
      { action: 'CanDelete', label: 'Xoá phân công chuyên môn' }
    ]
  },
  {
    key: 'ATTENDANCE', label: 'Chấm công', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem công' },
      { action: 'CanCreate', label: 'Ghi nhận công' },
      { action: 'CanEdit', label: 'Sửa công' },
      { action: 'CanApprove', label: 'Duyệt điều chỉnh công' },
      { action: 'CanReject', label: 'Từ chối điều chỉnh công' },
      { action: 'CanLock', label: 'Chốt công' }
    ]
  },
  {
    key: 'OVERTIME', label: 'Làm thêm giờ', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem làm thêm giờ' },
      { action: 'CanCreate', label: 'Đề nghị làm thêm giờ' },
      { action: 'CanApprove', label: 'Duyệt làm thêm giờ' },
      { action: 'CanReject', label: 'Từ chối làm thêm giờ' }
    ]
  },
  {
    key: 'OVERTIME_LIST', label: 'DS ngoài giờ theo ca', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem danh sách ngoài giờ theo ca' },
      { action: 'CanApprove', label: 'Tiếp nhận / Chốt danh sách ngoài giờ' },
      { action: 'CanReject', label: 'Yêu cầu bổ sung danh sách ngoài giờ' }
    ]
  },
  {
    key: 'PAYROLL', label: 'Tổng hợp thu nhập', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem tổng hợp thu nhập' },
      { action: 'CanExport', label: 'Xuất tổng hợp thu nhập' }
    ]
  },
  {
    key: 'CLINICAL_STATS', label: 'Số liệu chuyên môn', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem số liệu chuyên môn' },
      { action: 'CanCreate', label: 'Nhập số liệu chuyên môn' },
      { action: 'CanDelete', label: 'Xoá số liệu chuyên môn' }
    ]
  },
  {
    key: 'INSURANCE_AUDIT', label: 'BHYT / Xuất toán', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem BHYT / Xuất toán' },
      { action: 'CanCreate', label: 'Nhập dữ liệu xuất toán' },
      { action: 'CanEdit', label: 'Cập nhật giải trình xuất toán' },
      { action: 'CanApprove', label: 'Duyệt kết luận xuất toán' }
    ]
  },
  {
    key: 'KPI', label: 'KPI', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem KPI' },
      { action: 'CanCreate', label: 'Nhập kết quả KPI' },
      { action: 'CanApprove', label: 'Chấm điểm / Duyệt KPI' }
    ]
  },
  {
    key: 'INCIDENT', label: 'Sự cố / An toàn', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem sự cố / an toàn' },
      { action: 'CanApprove', label: 'Xác minh / Kết luận sự cố' }
    ]
  },
  {
    key: 'EMPLOYEE', label: 'Nhân sự', icon: '📁',
    actions: [
      { action: 'CanView', label: 'Xem hồ sơ nhân sự người khác' }
    ]
  }
];

function listPermissionModules() {
  return PERMISSION_MODULES_;
}

function getPermissionModuleLabel_(moduleKey) {
  if (!moduleKey) return 'Toàn hệ thống (kiểu cũ)';
  var found = PERMISSION_MODULES_.find(function (m) { return m.key === moduleKey; });
  return found ? found.label : moduleKey;
}
