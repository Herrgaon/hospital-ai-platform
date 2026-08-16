# ĐẶC TẢ BỔ SUNG — CÔNG VIỆC ĐỊNH KỲ THEO CHU KỲ (V1)

**LƯU Ý:** File này KHÔNG phải nguyên văn đặc tả gốc — bản gốc do Product Owner dán trong một phiên
làm việc trước đó đã bị nén mất trong quá trình tóm tắt hội thoại dài, chỉ còn lại phần tóm tắt dưới
đây (được ghi lại từ trạng thái nội bộ của AI Agent, không phải trích dẫn trực tiếp). Nếu cần đối
chiếu chính xác từng câu chữ, nên yêu cầu Product Owner dán lại bản gốc.

**Trạng thái triển khai:** Đã hoàn thành (2026-08-15) — xem `Task.Service.gs`, `Storage.Schema.gs`
(RecurringTaskTemplates, Tasks.SourceType/TemplateID/Period/TransferredFromTaskID).

---

## Nội dung chính (tóm tắt)

### Phân loại nguồn công việc (SourceType)

Mỗi công việc (Task) thuộc đúng 1 trong 4 nguồn:

- **ASSIGNED** (Được giao) — người giao khác người thực hiện.
- **PERSONAL** (Cá nhân) — tự lập, không cần quyền CanCreate, chỉ cần có hồ sơ nhân viên.
- **SYSTEM** (Hệ thống) — dự phòng cho tương lai, chưa dùng ở V1.
- **RECURRING** (Định kỳ) — sinh ra từ 1 Mẫu công việc định kỳ (RecurringTaskTemplates).

Không mặc nhiên là KPI dù thuộc nguồn nào — chỉ `IsKpiTask=true` mới tính vào KPI (kể cả công việc
định kỳ).

### Mẫu công việc định kỳ (RecurringTaskTemplates)

Tách riêng Mẫu (Template, cấu hình 1 lần) khỏi từng lần phát sinh (Instance — vẫn là 1 dòng Task bình
thường, có `TemplateID` trỏ về Mẫu) — không tạo 1 công việc duy nhất rồi đổi ngày tháng liên tục.

- Chu kỳ (Frequency): DAILY / WEEKLY / MONTHLY / QUARTERLY / YEARLY.
- Hạn hoàn thành (Deadline) theo Mẫu, tuỳ chọn: FIXED (ngày cố định của kỳ kế tiếp, VD "ngày 05 tháng
  kế tiếp") hoặc RELATIVE (+N ngày kể từ ngày bắt đầu kỳ).
- Trạng thái Mẫu: ACTIVE / PAUSED / ENDED. Tạm dừng (PAUSED) KHÔNG sinh instance mới nhưng KHÔNG xoá
  instance đã sinh trước đó.
- Sinh instance theo kiểu LƯỜI (lazy) — không dùng Time-driven Trigger, chỉ sinh khi người dùng thực
  sự mở "Việc của tôi" và phát hiện thiếu instance đúng kỳ hiện tại. Idempotent theo cặp
  (TemplateID, Period) — không sinh trùng.
- KHÔNG backfill các kỳ đã qua bị bỏ lỡ (giới hạn V1 đã ghi rõ trong code).

### Hoàn thành công việc — 2 luồng khác nhau theo người giao/người thực hiện

- Nếu `AssignerEmployeeID === AssigneeEmployeeID` (tự giao cho chính mình — công việc cá nhân, hoặc
  định kỳ tự lập): hoàn thành THẲNG, không cần qua bước nộp kết quả → chờ đánh giá.
- Nếu người khác giao: vẫn phải nộp kết quả (submitTaskResult) → người giao đánh giá (evaluateTask)
  như luồng cũ.

### Chuyển kỳ (TransferredFromTaskID)

Task Instance quá hạn KHÔNG được tự động gộp vào kỳ sau. Chuyển kỳ là hành động THỦ CÔNG: tạo 1 Task
MỚI liên kết ngược về Task gốc qua `TransferredFromTaskID`; Task gốc chuyển `CANCELLED` (không xoá,
giữ nguyên lịch sử). Lý do + thời điểm chuyển nằm trong Audit Log.

### Huỷ công việc (cancelTask)

Cho phép người liên quan (Assigner/Assignee) hoặc người có `CanEdit` huỷ 1 công việc chưa hoàn thành,
chuyển `Status='CANCELLED'`.

### Trường tính toán (không lưu trong Sheet)

- `IsOverdue`: tính động từ `DueDate` so với ngày hiện tại (giờ Hà Nội) — KHÔNG BAO GIỜ là 1 giá trị
  `Status` lưu sẵn, luôn suy ra tại thời điểm đọc. Task đã `EVALUATED`/`CANCELLED` không bao giờ tính
  là quá hạn dù `DueDate` đã qua.

---

## Trạng thái Task đầy đủ

`ASSIGNED → IN_PROGRESS → SUBMITTED → EVALUATED`, hoặc `CANCELLED` ở bất kỳ bước nào trước khi hoàn
thành. "QUÁ HẠN" không phải 1 Status lưu trong Sheet — luôn là trường tính toán `IsOverdue`.

---

## Giao diện (UI) — 2 chế độ xem

Đặc tả UI (2 ảnh mockup Product Owner gửi kèm, không có văn bản mô tả riêng) yêu cầu trang "Công việc
của tôi" có:

1. **Chế độ Danh sách/Dashboard**: thẻ thống kê (Tổng công việc/Hôm nay/Đang làm/Chờ xác nhận/Quá
   hạn), tab theo thời gian/trạng thái (Tất cả/Hôm nay/Tuần này/Đang làm/Chờ xác nhận/Hoàn thành/Quá
   hạn), bộ lọc (tìm kiếm/Ưu tiên/Loại công việc = Nguồn/Thời gian), cột "Nguồn" hiển thị badge màu
   theo SourceType, sidebar phải có lịch mini + "Công việc sắp tới" + "Công việc quá hạn".
2. **Chế độ Dòng thời gian (Gantt rút gọn)**: các thanh theo tuần, màu theo SourceType (Được giao =
   cam, Cá nhân = xanh lá, Định kỳ = tím, Hệ thống = xanh dương), có cờ đánh dấu hạn hoàn thành, thanh
   đỏ cho việc quá hạn.

*(Đã triển khai ở `Tasks.html` — xem lịch sử commit "Task rebuild" 2026-08-16 để biết chi tiết chính
xác đã build so với mô tả tóm tắt này.)*
