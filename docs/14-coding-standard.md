# 14 — Coding Standard

Thứ tự ưu tiên (mục 26 PROJECT_CONSTITUTION): **KISS → DRY → SOLID → Clean Code → YAGNI**.

## 1. Quy tắc chung

- Không Hard-code giá trị cấu hình (ID Spreadsheet/Folder, ngưỡng Rule, danh sách Role...) — luôn qua `Core.Config.gs`/Sheet cấu hình.
- Không Duplicate Code — logic dùng chung (format ngày, sinh ID, kiểm tra quyền) đặt trong `Core.Utils.gs`/`Auth.Permission.gs`, gọi lại thay vì copy-paste.
- Không God Object/God Class — mỗi file `.gs` chỉ giữ trách nhiệm của một module (xem [17-project-structure.md](17-project-structure.md)).
- Không Circular Dependency giữa các module (ví dụ `Document` không được gọi ngược vào `Workflow` nếu `Workflow` đang gọi `Document` — điều phối qua một lớp điều phối rõ ràng, không gọi chéo hai chiều).

## 2. Cấu trúc module

- Mỗi module (`Document`, `Template`, `RuleEngine`, `AIGateway`...) expose một tập hàm public rõ ràng (namespace theo tiền tố file), phần còn lại coi là private theo quy ước (không expose ra `google.script.run` nếu không cần thiết cho UI).
- Service không được truy cập trực tiếp `SpreadsheetApp`/`DriveApp` — luôn qua Repository (`Storage.SheetRepository.gs`, `Storage.DriveRepository.gs`), đúng nguyên tắc kiến trúc tại [05-architecture.md](05-architecture.md) mục 3.

## 3. Comment

- Mặc định không viết comment giải thích "làm gì" — tên hàm/biến rõ ràng phải tự nói lên điều đó.
- Chỉ viết comment khi có lý do "tại sao" không hiển nhiên (ví dụ: giới hạn quota Apps Script buộc chia batch, một workaround cho hành vi đặc biệt của Google Docs API).
- Không viết docstring nhiều dòng cho hàm đơn giản.

## 4. Đặt tên

- File: `<Module>.<ChứcNăng>.gs` (xem quy ước tại [17-project-structure.md](17-project-structure.md)).
- Hàm public: `camelCase`, động từ + danh từ rõ nghĩa (`createDocumentFromTemplate`, không viết tắt tối nghĩa).
- Hằng số cấu hình: `UPPER_SNAKE_CASE`.
- Tên Sheet/cột: `PascalCase` cho tên Sheet, `PascalCase` cho tên cột (khớp với schema tại [12-storage-design.md](12-storage-design.md)).

## 5. Xử lý lỗi

- Chỉ validate ở biên hệ thống: đầu vào từ UI (`google.script.run`), phản hồi từ AI Provider, dữ liệu đọc từ Sheet/Drive khi có khả năng bị sửa tay ngoài luồng ứng dụng.
- Không try/catch bao trùm toàn bộ hàm để "nuốt lỗi" — chỉ bắt lỗi ở nơi có thể xử lý được ý nghĩa (ví dụ: AI Provider timeout → trả lỗi rõ ràng cho UI), lỗi lập trình thực sự nên được ném ra để phát hiện sớm khi kiểm thử.
- Không thêm fallback/giá trị mặc định che giấu cho tình huống không thể xảy ra trong logic nội bộ đã được đảm bảo đúng.

## 6. YAGNI — không làm trước khi cần

- Không xây tính năng/tham số cấu hình cho nhu cầu giả định chưa được Product Owner xác nhận.
- Không thêm abstraction (interface, factory...) cho một implementation duy nhất — chỉ trừu tượng hoá khi có ≥ 2 biến thể thực sự tồn tại (ví dụ AI Gateway trừu tượng hoá Provider vì mục 14 yêu cầu rõ đa Provider ngay từ đầu).

## 7. Quản lý mã nguồn

- Dùng `clasp` để đồng bộ giữa Git và Apps Script Project — Git là nguồn sự thật, không sửa trực tiếp trên Apps Script Editor cho thay đổi lâu dài (sửa nhanh để debug thì phải `clasp pull` lại trước khi tiếp tục sửa local).
- Mỗi thay đổi mã nguồn có ý nghĩa nghiệp vụ nên có commit message rõ lý do (why), không chỉ mô tả thay đổi (what).

## 8. Định dạng

- Indent 2 space, dùng `const`/`let`, không dùng `var`.
- File `.html` trong `ui/` tách rõ HTML/CSS/JS qua include (`<?!= include('css/main') ?>`) để tránh một file phình to lẫn lộn nhiều mối quan tâm.
