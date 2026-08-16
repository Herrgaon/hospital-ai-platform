# ĐẶC TẢ TÁI CẤU TRÚC MODULE NHÂN SỰ – V1

## Hệ thống quản lý công việc – lịch trực – nhân sự | Bệnh viện Đa khoa Đông Sơn

**Mục đích:** Gửi AI Agent để tái cấu trúc module Nhân sự.
**Phạm vi:** Chỉ tập trung vào Nhân sự V1; không triển khai trước các chức năng chưa cần thiết.

**Trạng thái triển khai:** Đã hoàn thành (2026-08-16) — xem `Personnel.html`, `Profile.html`, `Employee.Service.gs`, `Employee.Catalog.gs`, `Department.Service.gs`.

---

## 1. Mục tiêu

Tái tổ chức module Nhân sự theo hướng:

- Gọn, dễ sử dụng.
- Tập trung vào **con người và cơ cấu tổ chức**.
- Không trộn quản lý nhân sự với quản trị tài khoản hệ thống.
- Làm dữ liệu nền cho Công việc, Lịch trực, KPI, Chấm công và Tiền lương.
- Không xây quá nhiều chức năng ngay từ V1.

---

## 2. Cấu trúc module mới

Chỉ giữ 4 khu vực:

```text
👥 NHÂN SỰ
├── 👤 Danh sách nhân sự
│     └── Hồ sơ nhân viên
├── 🏢 Cơ cấu tổ chức
├── 🏷 Chức danh & chức vụ
└── 📌 Phân công nhân sự
```

**Không tạo mục Tổng quan riêng.**

Tổng quan được tích hợp ngay trong **Danh sách nhân sự** và thay đổi theo bộ lọc.

---

## 3. Trang Danh sách nhân sự

Đây là màn hình trung tâm của module.

Thứ tự giao diện: Tìm kiếm → Bộ lọc → Thống kê theo bộ lọc → Danh sách nhân sự

Bố cục: header + tìm kiếm tên/mã nhân viên + bộ lọc (Khoa/Phòng, Chức danh, Chức vụ, Trạng thái) +
nút Thêm nhân sự/Nhập danh sách/Xuất danh sách + thẻ thống kê + bảng danh sách.

### Bộ lọc

- Tìm kiếm theo họ tên hoặc mã nhân viên.
- Khoa/phòng.
- Chức danh.
- Chức vụ.
- Trạng thái công tác.

### Thao tác

- Thêm nhân sự.
- Nhập danh sách.
- Xuất danh sách.
- Mở hồ sơ nhân viên.

---

## 4. Thống kê phải phụ thuộc bộ lọc

**Đây là yêu cầu bắt buộc.**

Không hiển thị thống kê cố định toàn viện khi người dùng đang lọc.

Luồng: Bộ lọc → Tập dữ liệu kết quả → Thống kê → Danh sách.

Không được để: Thống kê toàn viện + Danh sách đã lọc (vì dễ gây hiểu nhầm).

Các thẻ thống kê không nên hard-code theo 1 màn hình duy nhất. V1 chỉ cần các chỉ số cơ bản và kiến
trúc phải cho phép thay đổi theo tập dữ liệu.

---

## 5. Danh sách nhân sự

Bảng chính: ☐ | Mã NV | Họ tên | Khoa/Phòng | Chức danh | Chức vụ | Trạng thái

### Không hiển thị trực tiếp trong bảng

- CCCD.
- Địa chỉ.
- Số điện thoại cá nhân.
- Thông tin gia đình.
- Tài khoản ngân hàng.
- Lương.
- Dữ liệu nhạy cảm khác.
- Email đăng nhập nếu không cần thiết.

Email đăng nhập thuộc **Tài khoản hệ thống**, không phải thông tin nhận diện chính của danh sách nhân sự.

---

## 6. Hồ sơ nhân viên

Click một nhân sự sẽ mở hồ sơ chi tiết, gồm các tab:
Thông tin cá nhân / Thông tin công tác / Quá trình công tác / Bằng cấp & Chứng chỉ / Phân công / Lịch trực.

### Hồ sơ phải có

- Thông tin cá nhân.
- Thông tin công tác.
- Quá trình công tác.
- Bằng cấp & chứng chỉ.
- Phân công.
- Lịch trực của cá nhân.

### Không đưa vào hồ sơ chung

- Tài khoản ngân hàng.
- Lương.
- Các dữ liệu không cần thiết.

**Lương là module riêng và có phân quyền dữ liệu.**

---

## 7. Thông tin công tác

Có thể gồm: Đơn vị hiện tại, Chức danh, Chức vụ, Quản lý trực tiếp, Trạng thái công tác.

Không cần làm "Ngày vào viện" thành trường nổi bật nếu đã có **Quá trình công tác**.

---

## 8. Quá trình công tác

Quản lý lịch sử thay đổi (đơn vị/chức danh/chức vụ theo thời gian).

Mục tiêu:
- Biết nhân sự từng thuộc đơn vị nào.
- Biết thay đổi chức danh/chức vụ.
- Có dữ liệu để đối chiếu theo thời điểm khi các module khác cần.

---

## 9. Bằng cấp & Chứng chỉ

Có thể quản lý: Bằng cấp, Chuyên khoa, Chứng chỉ, Ngày cấp, Ngày hết hạn nếu có, Đơn vị cấp, Thông tin
minh chứng nếu cần.

V1 chỉ quản lý dữ liệu hồ sơ cơ bản; chưa cần xây riêng module cảnh báo hồ sơ.

---

## 10. Lịch trực trong hồ sơ

Cho phép nhân viên xem lịch trực của **chính mình**. Có thể hiển thị theo tháng.

Chi tiết nghiệp vụ lịch trực thuộc module **Lịch trực**; hồ sơ chỉ hiển thị phần cần thiết cho cá nhân.

---

## 11. Không hiển thị lương trong hồ sơ nhân sự chung

Không có: Lương, Phụ cấp, Tổng thu nhập, Số tài khoản — trong hồ sơ nhân sự chung.

Module tiền lương được quản lý riêng và có phân quyền.

Nếu chính người lao động xem hệ thống, có thể có **Lương & Thu nhập của tôi**, nhưng đây là quyền cá
nhân riêng, không phải trường dữ liệu công khai trong hồ sơ.

---

## 12. Cơ cấu tổ chức

Thay màn hình Khoa/Phòng hiện tại bằng **Cơ cấu tổ chức** — cây phân cấp: Bệnh viện → Ban Giám đốc /
Phòng chức năng / Khoa lâm sàng / Khoa cận lâm sàng.

Cơ cấu thực tế phải lấy từ dữ liệu bệnh viện, không tự tạo thêm đơn vị.

---

## 13. Thông tin của một khoa/phòng

Khi mở một đơn vị: Trưởng khoa, Phó khoa, Điều dưỡng trưởng, Số nhân sự, Danh sách nhân sự.

Chức vụ nào thực tế không có thì không hiển thị.

---

## 14. Chức danh & chức vụ

Tách hai danh mục:

- **Chức vụ** (quản lý): Giám đốc, Phó Giám đốc, Trưởng khoa/phòng, Phó khoa/phòng, Điều dưỡng
  trưởng, ...
- **Chức danh** (chuyên môn): Bác sĩ, Điều dưỡng, Hộ sinh, Kỹ thuật viên, Dược sĩ, ...

Không để nhập tự do tuỳ ý nếu có thể dùng danh mục thống nhất.

Các danh mục này làm nền cho: Phân công, Lịch trực, Công việc, KPI, Chấm công, Báo cáo.

---

## 15. Phân công nhân sự

Giữ lại chức năng này.

Phải phân biệt: **Phân công nhân sự ≠ Phân quyền hệ thống.**

Một người có thể có lịch sử phân công theo thời gian.

---

## 16. Tách khỏi module Nhân sự

Các phần hiện tại: Người dùng & Vai trò, Phân quyền phụ trách — không tiếp tục đặt trong Nhân sự.

Chuyển về:

```text
⚙️ QUẢN TRỊ HỆ THỐNG
├── Tài khoản
├── Vai trò
├── Quyền
├── Phân quyền nghiệp vụ
└── Nhật ký hệ thống
```

### Phân biệt bắt buộc

- NHÂN SỰ = người làm việc tại bệnh viện.
- TÀI KHOẢN = danh tính đăng nhập hệ thống.
- VAI TRÒ/QUYỀN = người đó được phép làm gì trên hệ thống.
- PHÂN CÔNG = người đó được giao vị trí/nhiệm vụ gì trong tổ chức.

Không gộp bốn khái niệm này thành một logic duy nhất.

---

## 17. Sidebar mục tiêu

```text
👥 NHÂN SỰ
   ├── Danh sách nhân sự
   ├── Cơ cấu tổ chức
   ├── Chức danh & chức vụ
   └── Phân công nhân sự

⚙️ QUẢN TRỊ
   ├── Tài khoản
   ├── Vai trò
   ├── Phân quyền
   └── ...
```

Không có "Tổng quan nhân sự" riêng. Không có "Người dùng & Vai trò" trong Nhân sự. Không có "Phân
quyền phụ trách" trong Nhân sự.

*(Lưu ý triển khai thực tế: theo phản hồi Product Owner sau đó, sidebar cuối cùng KHÔNG mở rộng
"Nhân sự" thành 4 mục con riêng — giữ 1 mục "Nhân sự" duy nhất, 4 khu vực trên vẫn tồn tại dưới dạng
tab bên trong trang. "Nhân sự" và "Quản trị hệ thống" cũng được chuyển xuống cuối sidebar vì là trang
đặc thù, không phải ai cũng dùng thường xuyên.)*

---

## 18. Những chức năng CHƯA LÀM ở V1

Không triển khai ngay:

- Hồ sơ cần xử lý.
- Dashboard cảnh báo hồ sơ.
- Lịch sử biến động nhân sự thành module riêng.
- Phân công người phụ trách hồ sơ (lưu ý: RecordOwnerUserID/"Người phụ trách hồ sơ" đã có từ trước
  đợt tái cấu trúc này và được giữ nguyên, không bị xoá — chỉ không xây thêm dashboard/cảnh báo mới
  xung quanh nó).
- Cảnh báo chứng chỉ.
- Các chức năng hồ sơ nâng cao chưa có yêu cầu thực tế.

Để dành cho phiên bản sau khi có nhu cầu.

---

## 19. Nguyên tắc dữ liệu

Nên tách các thực thể: Employee, OrganizationUnit, Position, JobTitle, Assignment, EmploymentHistory,
Qualification, Certificate, User, Role, Permission.

Quan hệ chính: Employee → OrganizationUnit → Position/JobTitle → Assignment, và Employee → User.

`Employee` và `User` là hai đối tượng khác nhau nhưng có thể liên kết.

---

## 20. Yêu cầu đối với AI Agent

AI Agent **không chỉ sửa HTML/CSS của các tab hiện tại**.

- Bước 1: Phân tích code hiện tại (file giao diện Nhân sự, backend nhân sự, Sheet/Table dữ liệu, các
  hàm xử lý Employee/Organization/User/Role/Permission, navigation/route).
- Bước 2: Mapping chức năng (giữ lại / chuyển module / loại khỏi UI).
- Bước 3: Không phá chức năng đang hoạt động — không tự ý xoá backend/dữ liệu cũ; nếu chức năng
  không còn hiển thị trong Nhân sự phải xác định nó được chuyển sang đâu.
- Bước 4: Tái cấu trúc UI (EmployeeList, EmployeeProfile, OrganizationStructure, PositionJobTitle,
  Assignment).
- Bước 5: Tách quản trị hệ thống (Users/Roles/Permissions sang Quản trị).
- Bước 6: Kiểm tra dữ liệu — không mất nhân sự/khoa-phòng/quan hệ nhân sự-đơn vị/tài khoản đã liên
  kết/vai trò-quyền, không làm hỏng các module đang dùng EmployeeID.

---

## 22. Tiêu chí hoàn thành V1

- [x] Danh sách nhân sự là màn hình trung tâm.
- [x] Có tìm kiếm.
- [x] Có lọc khoa/phòng, chức danh, chức vụ, trạng thái.
- [x] Thống kê nằm dưới bộ lọc, thay đổi theo bộ lọc.
- [x] Danh sách chỉ hiển thị thông tin cần thiết.
- [x] Click nhân sự mở hồ sơ.
- [x] Hồ sơ có thông tin cá nhân/công tác/quá trình công tác/bằng cấp-chứng chỉ/phân công/lịch trực
      cá nhân.
- [x] Không có tài khoản ngân hàng/lương trong hồ sơ chung.
- [x] Có cơ cấu tổ chức, danh mục chức danh/chức vụ, phân công nhân sự.
- [x] Tài khoản/vai trò/quyền được tách khỏi Nhân sự (chuyển sang tab trong Quản trị hệ thống).
- [x] Không mất dữ liệu hiện tại, không phá các module đang dùng dữ liệu nhân sự.

---

# KẾT LUẬN

Nguyên tắc thiết kế: **Nhân sự = quản lý con người + cơ cấu tổ chức + chức danh/chức vụ + phân công.**

Trang trung tâm: Tìm kiếm → Bộ lọc → Thống kê theo bộ lọc → Danh sách nhân sự → Hồ sơ nhân viên.

Ưu tiên V1 là **gọn, rõ, ổn định và làm nền dữ liệu cho các module sau**, không mở rộng chức năng khi
chưa có nhu cầu nghiệp vụ.
