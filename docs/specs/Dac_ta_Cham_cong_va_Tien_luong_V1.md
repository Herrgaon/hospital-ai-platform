# ĐẶC TẢ BỔ SUNG – CHẤM CÔNG VÀ TIỀN LƯƠNG

## Hệ thống quản trị nội bộ – Bệnh viện Đa khoa Đông Sơn

**Trạng thái:** Đặc tả nghiệp vụ định hướng V1.
**Trạng thái triển khai:** Giai đoạn 2 (Chấm công khoa/phòng, Chấm công toàn viện, Đối chiếu, Chốt
công) đang được triển khai (2026-08-16) — xem `Attendance.Service.gs`, `Attendance.Workflow.gs`.
Giai đoạn 3-6 (Payroll) CHƯA triển khai, đúng nguyên tắc gate dưới đây.

> **Nguyên tắc:** Module tiền lương chưa triển khai công thức chính thức cho đến khi bệnh viện hoàn
> thiện, rà soát và phê duyệt cơ chế tính lương áp dụng cho từng nhóm nhân sự.

---

## 1. Mục tiêu

Xây dựng cơ chế:
- Khoa/phòng lập và gửi chấm công hàng tháng.
- Trưởng khoa xác nhận trước khi gửi.
- Hệ thống tổng hợp, đối chiếu và phát hiện bất thường.
- Chốt dữ liệu chấm công.
- Dùng dữ liệu đã chốt làm đầu vào cho Payroll Engine.
- Sau khi hoàn thiện quy tắc, hệ thống tự tính bảng lương hàng tháng.
- Thiết kế sẵn khả năng kết nối máy chấm công vân tay.

---

## 2. Bảo mật thông tin lương

Tiền lương **không hiển thị trong trang thông tin cá nhân chung**.

Cấu trúc:

```text
THÔNG TIN CÁ NHÂN
├── Thông tin cá nhân
├── Thông tin công tác
├── Bằng cấp - Chứng chỉ
├── Quá trình công tác
├── Tài liệu
└── Lương & Thu nhập của tôi
```

Phạm vi:
- Người lao động: chỉ xem lương của chính mình.
- Trưởng khoa: không mặc nhiên xem lương nhân viên.
- Người phụ trách tiền lương: xử lý theo quyền nghiệp vụ.
- Ban Giám Đốc: xem theo quyền quản trị.
- Admin kỹ thuật: không mặc định có quyền xem dữ liệu lương.

Phải kiểm soát ở backend: User → Role → Permission → Data Scope → Record. Không chỉ ẩn menu ở
frontend.

---

## 3. Quy trình chấm công hàng tháng

```text
KHOA/PHÒNG → LẬP/KIỂM TRA → TRƯỞNG KHOA XÁC NHẬN → GỬI → ĐƠN VỊ PHỤ TRÁCH KIỂM TRA → ĐỐI CHIẾU →
XỬ LÝ NGOẠI LỆ → CHỐT CHẤM CÔNG → PAYROLL ENGINE
```

Khi tạo kỳ chấm công, hệ thống tự đưa vào:
- Nhân sự thuộc đơn vị.
- Lịch làm việc.
- Lịch trực.
- Đổi trực đã phê duyệt.
- Nghỉ đã được phê duyệt.
- Làm ngoài giờ đã chốt.
- Dữ liệu máy chấm công nếu đã tích hợp.

Mục tiêu là khoa/phòng chủ yếu **kiểm tra và xác nhận**, không nhập lại toàn bộ.

*(Trạng thái triển khai: đã tự động sinh dòng công cho mọi nhân sự Active × mọi ngày trong tháng khi
tạo kỳ, đối chiếu sẵn ShiftType theo DutyShifts OFFICIAL đúng ngày. "Nghỉ đã được phê duyệt" CHƯA tự
động — hệ thống hiện chưa có khái niệm đơn xin nghỉ/duyệt nghỉ riêng, LeaveType vẫn để khoa tự nhập
tay ở bước Nhập — đơn giản hoá có chủ đích cho V1.)*

---

## 4. Trạng thái chấm công

```text
NHẬP → KHOA HOÀN THIỆN → TRƯỞNG KHOA XÁC NHẬN → ĐÃ GỬI → ĐANG KIỂM TRA → ĐÃ CHỐT
```

Sau khi gửi, khoa không tự ý sửa.

Nếu sai: Đề nghị mở lại → Người có thẩm quyền → Mở khóa → Khoa điều chỉnh → Trưởng khoa xác nhận lại
→ Gửi lại.

Mọi mở khóa/chỉnh sửa phải có Audit Log.

*(Trạng thái triển khai: đúng 6 trạng thái DRAFT/DEPT_COMPLETED/DEPT_HEAD_CONFIRMED/SUBMITTED/
UNDER_REVIEW/LOCKED, luồng Đề nghị mở lại riêng cho kỳ ĐÃ CHỐT qua AttendancePeriodReopenRequests,
mọi bước đều logAudit.)*

---

## 5. Dashboard chấm công toàn viện

Hiển thị tình trạng từng đơn vị: Đã gửi / Cần bổ sung / Chưa gửi, kèm thống kê tổng hợp.

*(Đã triển khai — `getAttendanceDashboard`, tính theo kỳ của THÁNG HIỆN TẠI từng khoa/phòng.)*

---

## 6. Đối chiếu chấm công

```text
CHẤM CÔNG → ĐỐI CHIẾU
├── Lịch làm việc
├── Lịch trực
├── Đổi trực
├── Nghỉ
├── Làm ngoài giờ
└── Máy chấm công
```

Nếu dữ liệu không khớp → **cảnh báo, không tự động kết luận vi phạm**.

*(Đã triển khai — `getAttendancePeriodReconciliation`, đối chiếu với DutyShifts OFFICIAL/SWAPPED_OUT
và OvertimeListItems thuộc OvertimeList đã FINALIZED. Máy chấm công: luôn "chưa có dữ liệu" — chưa
tích hợp, đúng Giai đoạn 6.)*

---

## 7. Các lớp dữ liệu chấm công

- **Attendance Raw**: ID, AttendanceUserID, EmployeeID, DeviceID, Timestamp, EventType, RawData,
  ImportedAt — không sửa dữ liệu gốc.
- **Attendance Processed**: dữ liệu đã chuẩn hóa.
- **Attendance Result**: kết quả đối chiếu với lịch, trực, đổi trực, nghỉ, ngoài giờ.
- **Approved Attendance**: dữ liệu đã xác nhận và chốt.

*(Trạng thái triển khai: KHÔNG xây riêng 4 sheet theo đúng câu chữ — chưa có máy chấm công nên dữ
liệu nhập tay hiện tại coi Attendance = "Processed/Result" gộp, chuyển thành "Approved" khi Kỳ LOCKED.
Khi tích hợp máy chấm công thật (Giai đoạn 6), thêm AttendanceRaw + bước import riêng lúc đó, không
phá cấu trúc hiện tại.)*

---

## 8. Máy chấm công vân tay

Giai đoạn đầu: Excel/CSV → Import → Attendance Raw.

Sau này có thể tích hợp: Máy chấm công → API/Database/SDK/Phần mềm nhà cung cấp → Attendance
Integration → Attendance Raw.

Không phụ thuộc một hãng/model. Máy chấm công là **nguồn dữ liệu sự kiện**, không phải nguồn duy nhất
quyết định công, lương hoặc KPI.

*(CHƯA triển khai — đúng lộ trình Giai đoạn 6, để sau.)*

---

## 9. Chốt chấm công

Phân biệt: Khoa xác nhận / Đơn vị phụ trách kiểm tra / Chấm công đã chốt.

```text
KHOA XÁC NHẬN → KIỂM TRA → XỬ LÝ NGOẠI LỆ → CHỐT CHẤM CÔNG → TÍNH LƯƠNG
```

Sau khi chốt không sửa trực tiếp. Điều chỉnh: Đề nghị mở khóa → Phê duyệt → Mở khóa → Điều chỉnh →
Chốt lại.

---

## 10. Payroll Engine

**Chưa triển khai công thức chính thức ngay.**

Trước tiên phải xác định và phê duyệt: Nhóm nhân sự, Chế độ tiền lương áp dụng, Thành phần thu nhập,
Phụ cấp, Trực, Làm ngoài giờ, Thủ thuật/phẫu thuật nếu áp dụng, Các khoản khác, Khấu trừ, Quy tắc làm
tròn, Quy trình kiểm tra/phê duyệt.

Không dùng một công thức khổng lồ. Thiết kế:

```text
Employee → Salary Profile → Approved Attendance → Duty → Overtime → Allowances → Other Earnings →
Deductions → Payroll Rules → Payroll Result
```

**CHƯA TRIỂN KHAI** — chờ Giai đoạn 3 (rà soát/phê duyệt cơ chế tiền lương) hoàn tất.

---

## 11. Khung dữ liệu Payroll

```text
Payroll
├── PayrollPeriod
├── EmployeeID
├── Salary Components
├── Allowances
├── Duty Payment
├── Overtime Payment
├── Procedure/Operation Payment
├── Other Earnings
├── Insurance Deductions
├── Tax Deductions
├── Other Deductions
├── Gross Income
├── Total Deductions
└── Net Pay
```

Đây chỉ là khung dữ liệu, **chưa phải công thức tính lương chính thức**. **CHƯA TRIỂN KHAI.**

---

## 12. Quy trình tính lương

```text
CHỐT CHẤM CÔNG → CHỐT TRỰC → CHỐT NGOÀI GIỜ → TẬP HỢP THU NHẬP → TẬP HỢP KHẤU TRỪ → PAYROLL ENGINE →
BẢNG LƯƠNG DỰ THẢO → KIỂM TRA → PHÊ DUYỆT → CHỐT LƯƠNG
```

Không tự động chốt ngay sau khi tính. **CHƯA TRIỂN KHAI.**

---

## 13. Phiếu lương cá nhân

Sau khi bảng lương được chốt: Thông tin cá nhân → Lương & Thu nhập của tôi. Người lao động chỉ xem dữ
liệu của mình. Có thể xem lịch sử theo kỳ và xuất/in phiếu lương nếu được phép. **CHƯA TRIỂN KHAI.**

---

## 14. Giao diện

```text
⏱ CHẤM CÔNG
├── Chấm công đơn vị
├── Chấm công toàn viện
├── Đối chiếu
└── Chốt công

💰 TIỀN LƯƠNG
├── Kỳ lương
├── Tính lương
├── Bảng lương dự thảo
├── Kiểm tra
├── Phê duyệt
├── Bảng lương đã chốt
└── Phiếu lương
```

Menu chỉ hiển thị theo quyền. Phần "⏱ CHẤM CÔNG" đã triển khai (gộp Đối chiếu + Chốt công vào modal
Chi tiết kỳ thay vì 2 tab riêng). Phần "💰 TIỀN LƯƠNG" CHƯA triển khai.

---

## 15. Audit và Snapshot

Phải ghi Audit Log cho: Mở khóa/chỉnh sửa công, Điều chỉnh dữ liệu lương, Thay đổi quy tắc, Tính
lương, Phê duyệt, Chốt lương, Mở khóa lương, Điều chỉnh sau chốt.

Sau khi chốt, dữ liệu phải được bảo toàn.

Điều chỉnh sau chốt: Yêu cầu điều chỉnh → Lý do → Người có thẩm quyền → Mở khóa → Điều chỉnh → Tính
lại → Phê duyệt → Chốt lại.

*(Phần Chấm công đã triển khai đúng nguyên tắc này. Phần Tiền lương CHƯA triển khai.)*

---

## 16. Quan hệ giữa các module

```text
                    NHÂN SỰ
                       │
          ┌────────────┼─────────────┐
          ▼            ▼             ▼
       LỊCH TRỰC    CÔNG VIỆC     CHẤM CÔNG
          │                         │
          ▼                         │
      ĐỔI TRỰC                       │
          │                         │
          ▼                         │
     NGOÀI GIỜ                       │
          │                         │
          └────────────┬─────────────┘
                       ▼
                APPROVED DATA
                       │
                       ▼
                 PAYROLL ENGINE
                       │
                       ▼
                  BẢNG LƯƠNG
                       │
              ┌────────┴────────┐
              ▼                 ▼
       NGƯỜI LAO ĐỘNG      NGƯỜI CÓ QUYỀN
       XEM LƯƠNG CỦA MÌNH    XỬ LÝ/QUẢN LÝ
```

---

## 17. Nguyên tắc bắt buộc

1. Không hiển thị tiền lương cho người không có quyền.
2. Admin kỹ thuật không mặc định có quyền xem lương.
3. Dùng EmployeeID làm khóa.
4. Không dùng tên nhân viên làm khóa.
5. Không hard-code công thức lương trong UI.
6. Không triển khai công thức chính thức khi chưa được phê duyệt.
7. Khoa phải xác nhận chấm công trước khi gửi.
8. Chấm công phải được kiểm tra trước khi chốt.
9. Không sửa trực tiếp dữ liệu đã chốt.
10. Mọi điều chỉnh sau chốt phải có quy trình mở khóa.
11. Lịch trực và đổi trực phải lấy từ dữ liệu đã được phê duyệt.
12. Ngoài giờ phải lấy từ dữ liệu đã xác nhận/chốt.
13. Máy chấm công chỉ là nguồn dữ liệu để ghi nhận/đối chiếu.
14. Bảng lương phải đi qua Dự thảo → Kiểm tra → Phê duyệt → Chốt.
15. Mọi thay đổi quan trọng phải có Audit Log.
16. Quy tắc chưa được bệnh viện phê duyệt phải để dạng cấu hình.

---

## 18. Lộ trình

- **Giai đoạn 1** (xong): Nhân sự, Phân quyền, Lịch trực, Đổi trực, Làm ngoài giờ, Công việc.
- **Giai đoạn 2** (đang làm 2026-08-16): Chấm công khoa/phòng, Chấm công toàn viện, Đối chiếu, Chốt
  công.
- **Giai đoạn 3** (chưa làm — cần quyết định của bệnh viện, không phải việc code): Rà soát và phê
  duyệt cơ chế tiền lương.
- **Giai đoạn 4** (chưa làm, chờ Giai đoạn 3): Xây Payroll Engine.
- **Giai đoạn 5** (chưa làm, chờ Giai đoạn 4): Bảng lương dự thảo, Kiểm tra, Phê duyệt, Chốt lương,
  Phiếu lương cá nhân, Lịch sử lương.
- **Giai đoạn 6** (chưa làm, tương lai): Tích hợp máy chấm công.

---

# PROMPT CHO AI AGENT (nguyên văn yêu cầu ban đầu)

> Bổ sung hai phân hệ `Attendance` và `Payroll` vào hệ thống.
>
> Attendance phải cho phép từng khoa/phòng lập và gửi chấm công hàng tháng, Trưởng khoa xác nhận
> trước khi gửi. Hệ thống đối chiếu với nhân sự, lịch làm việc, lịch trực, đổi trực, nghỉ, làm ngoài
> giờ và máy chấm công nếu có.
>
> Phải lưu dữ liệu chấm công nguyên bản vào Attendance Raw trước khi xử lý. Giai đoạn đầu hỗ trợ
> Excel/CSV; kiến trúc phải mở rộng được sang API/database/SDK. Máy chấm công không được trực tiếp
> quyết định KPI hoặc tiền lương.
>
> Payroll chưa được hard-code công thức. Trước khi triển khai Payroll Engine phải xác định và phê
> duyệt đầy đủ các quy tắc tính lương. Payroll Engine phải nhận dữ liệu từ Approved Attendance, Duty,
> Overtime, Salary Profile và các thành phần thu nhập/khấu trừ được cấu hình.
>
> Quy trình bảng lương: Chốt công → Chốt trực/ngoài giờ → Payroll Engine → Bảng lương dự thảo → Kiểm
> tra → Phê duyệt → Chốt.
>
> Tiền lương là dữ liệu hạn chế truy cập. Người lao động chỉ xem lương của chính mình. Trưởng khoa
> không mặc định xem lương nhân viên. Admin kỹ thuật không mặc định có quyền xem lương. Kiểm soát phải
> thực hiện ở backend theo User → Role → Permission → Data Scope.
>
> Phải có Audit Log và Snapshot/Lock sau chốt. Điều chỉnh sau chốt phải qua quy trình mở khóa có thẩm
> quyền.
