# 15 — Testing Strategy

## 1. Thách thức đặc thù của Apps Script

Apps Script không có framework unit test chính thức chạy độc lập như Jest/JUnit — code chạy trong runtime V8 riêng của Google, phụ thuộc nhiều vào các service (`SpreadsheetApp`, `DriveApp`, `UrlFetchApp`). Chiến lược kiểm thử phải thích nghi với đặc điểm này thay vì áp nguyên xi mô hình testing của backend truyền thống.

## 2. Các lớp kiểm thử

| Lớp | Phạm vi | Công cụ/Cách làm |
|---|---|---|
| **Unit test (logic thuần)** | Hàm không phụ thuộc Google Service: Rule Engine (đánh giá điều kiện), Workflow state machine, hàm tiện ích | Tách logic thuần khỏi phần gọi `SpreadsheetApp`/`DriveApp` (Dependency injection đơn giản: truyền dữ liệu đã đọc sẵn vào hàm xử lý); chạy bằng **clasp + Node.js với `google-apps-script` type stubs**, dùng một test runner nhẹ (ví dụ Node built-in `node:test`) trên mã đã tách thuần logic |
| **Integration test (trong Apps Script)** | Repository (đọc/ghi Sheet/Drive thật), AI Gateway (gọi Provider thật/sandbox) | Chạy trong một Apps Script Project riêng cho **môi trường Dev**, có hàm test thủ công (`Test_*.gs`) gọi qua Apps Script Editor hoặc trigger theo yêu cầu, ghi kết quả PASS/FAIL vào log |
| **Manual QA theo kịch bản** | Toàn bộ luồng người dùng (UC-01..UC-08) | Checklist thủ công trên môi trường Staging trước mỗi lần release lên Prod |
| **UAT (User Acceptance Test)** | Product Owner/đại diện bệnh viện xác nhận trước khi go-live | Kịch bản thực tế bằng dữ liệu gần giống thật, trên Staging |

## 3. Ưu tiên kiểm thử theo rủi ro

1. **Rule Engine** — sai sót ở đây ảnh hưởng trực tiếp tính đúng đắn thể thức văn bản → cần bộ test case theo từng loại rule (FONT_CHECK, MARGIN_CHECK, REGEX_CHECK...) với input mẫu đã biết trước kết quả đúng/sai.
2. **Permission/RBAC** — sai sót gây lộ dữ liệu hoặc chặn nhầm người dùng hợp lệ → test theo ma trận tại [11-permission-design.md](11-permission-design.md) mục 3, mọi ô trong ma trận phải có ít nhất 1 test case.
3. **Workflow state machine** — đảm bảo không có trạng thái "kẹt" hoặc chuyển sai bước.
4. **AI Gateway** — test riêng từng adapter Provider bằng request mẫu nhỏ, test tình huống `AI_ENABLED=false`/Provider lỗi/timeout để đảm bảo FR-AI-06.

## 4. Dữ liệu kiểm thử

- Môi trường Dev/Staging dùng Spreadsheet và Drive Folder riêng biệt (xem [05-architecture.md](05-architecture.md) mục 6), có bộ dữ liệu mẫu (Rule, Template, Workflow, User giả lập theo từng Role) được tạo bởi chính `Bootstrap.InitializeSystem.gs` — đảm bảo môi trường test luôn khởi tạo được từ trạng thái sạch giống hệt quy trình thật.
- Không dùng dữ liệu thật của bệnh viện (văn bản nội bộ thật) trong môi trường Dev.

## 5. Kiểm thử trước mỗi lần release lên Prod

Checklist tối thiểu:
- [ ] Toàn bộ Unit test logic thuần PASS.
- [ ] Chạy lại `Bootstrap.InitializeSystem.gs` trên một Spreadsheet/Drive trống ở Staging — xác nhận tự tạo đủ cấu trúc, không lỗi.
- [ ] Thực hiện đủ 8 Use Case chính (UC-01 → UC-08) bằng tài khoản test theo từng Role (Admin/Manager/User/Guest).
- [ ] Kiểm tra AI bị tắt (`AI_ENABLED=false`) — các luồng không dùng AI vẫn hoạt động đầy đủ.
- [ ] Kiểm tra Audit Log ghi đủ và đúng cho các hành động tại FR-ADM-03.
- [ ] Xác nhận không có secret/API Key lộ ra console log hoặc phản hồi client.

## 6. Giám sát sau triển khai (không phải test nhưng bổ trợ)

- Theo dõi `Stackdriver`/`exceptionLogging` (đã bật trong `appsscript.json`) để phát hiện lỗi runtime thực tế sau khi go-live.
- Audit Log đóng vai trò kênh phát hiện hành vi bất thường sớm, không chỉ phục vụ kiểm thử.
