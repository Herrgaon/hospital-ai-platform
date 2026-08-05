# 04 — Use Cases

## UC-01: Soạn văn bản từ mẫu

- **Actor chính**: User (Văn thư)
- **Liên quan**: US-01, FR-DOC-01
- **Điều kiện trước**: Người dùng đã đăng nhập, có quyền `CanCreate` trên Library đích, Template tồn tại và đang `Active`.
- **Luồng chính**:
  1. Người dùng chọn "Tạo văn bản mới" → chọn Template.
  2. Hệ thống hiển thị form các field của Template.
  3. Người dùng điền thông tin, nhấn "Tạo".
  4. `Template.Merge.gs` sinh Google Doc nháp, lưu vào thư mục `_Inbox` cá nhân.
  5. Hệ thống tạo bản ghi `Documents` (Status = `DRAFT`) và `DocumentVersions` (v1).
- **Luồng phụ**: Field bắt buộc còn trống → chặn nút "Tạo", báo lỗi tại field.
- **Kết quả**: Một văn bản nháp sẵn sàng để kiểm tra Rule (UC-02).

## UC-02: Kiểm tra thể thức văn bản

- **Actor chính**: Hệ thống (tự động, do User kích hoạt)
- **Liên quan**: US-02, FR-DOC-02, [08-rule-engine.md](08-rule-engine.md)
- **Điều kiện trước**: Văn bản ở trạng thái `DRAFT` hoặc `NEEDS_EDIT`.
- **Luồng chính**:
  1. Người dùng nhấn "Kiểm tra thể thức".
  2. `RuleEngine.DocxInspector.gs` trích xuất cấu trúc văn bản.
  3. `RuleEngine.Core.gs` chạy Rule Set áp dụng cho Library/loại văn bản.
  4. Hệ thống hiển thị danh sách lỗi (nếu có), phân loại ERROR/WARNING.
- **Luồng phụ**: Không còn lỗi ERROR → cho phép chuyển bước "Gửi phê duyệt".
- **Kết quả**: Văn bản đủ điều kiện hoặc cần chỉnh sửa tiếp.

## UC-03: Phê duyệt văn bản

- **Actor chính**: Manager/Admin có quyền `CanApprove`
- **Liên quan**: US-06, US-07, FR-WF-02, FR-WF-03
- **Điều kiện trước**: Văn bản ở trạng thái `PENDING_APPROVAL`, người dùng có quyền duyệt trên Library đó.
- **Luồng chính**:
  1. Người duyệt mở "Workflow Inbox", chọn văn bản.
  2. Xem nội dung, kết quả kiểm tra Rule đã qua.
  3. Chọn "Duyệt" hoặc "Từ chối", nhập ý kiến (tuỳ chọn khi duyệt, bắt buộc khi từ chối).
  4. Hệ thống cập nhật `WorkflowInstances.Status`, ghi `WorkflowStepLog`, gửi thông báo cho người tạo văn bản.
- **Luồng thay thế**: Workflow có nhiều cấp duyệt → sau khi duyệt cấp 1, chuyển sang cấp duyệt tiếp theo thay vì `APPROVED` ngay.
- **Kết quả**: Văn bản chuyển `APPROVED` (→ tự động Xuất Word) hoặc `NEEDS_EDIT` (nếu bị từ chối).

## UC-04: Hỏi đáp theo tài liệu nội bộ

- **Actor chính**: User/Guest (theo quyền xem Library)
- **Liên quan**: US-09, US-10, FR-KNOW-04, [09-ai-design.md](09-ai-design.md)
- **Điều kiện trước**: AI đang được bật (`AI_ENABLED = true`), có ít nhất một Library người dùng có quyền xem.
- **Luồng chính**:
  1. Người dùng vào "AI Chat", chọn phạm vi Library (hoặc "Tất cả Library tôi có quyền").
  2. Nhập câu hỏi.
  3. `Knowledge.Search.gs` tìm tài liệu liên quan trong phạm vi được phép.
  4. `AIGateway.run({task:"QA", ...})` sinh câu trả lời dựa trên đoạn trích.
  5. Hệ thống hiển thị câu trả lời kèm liên kết tới tài liệu nguồn.
- **Luồng phụ**: AI tắt hoặc lỗi Provider → hiển thị thông báo rõ ràng, gợi ý dùng tìm kiếm từ khoá thay thế (UC-05).
- **Kết quả**: Người dùng nhận câu trả lời có căn cứ, hoặc được hướng dẫn phương án thay thế.

## UC-05: Tìm kiếm tài liệu theo từ khoá

- **Actor chính**: User/Guest
- **Liên quan**: US-05, US-10, FR-KNOW-03
- **Luồng chính**:
  1. Người dùng nhập từ khoá vào ô tìm kiếm (toàn cục hoặc trong 1 Library).
  2. Hệ thống trả danh sách tài liệu khớp, sắp xếp theo độ liên quan/ngày cập nhật, chỉ trong phạm vi quyền xem.
- **Kết quả**: Danh sách tài liệu, có thể mở xem hoặc tải về.

## UC-06: Khởi tạo hệ thống lần đầu (Initialize System)

- **Actor chính**: Admin
- **Liên quan**: US-12, FR-ADM-05, [16-development-roadmap.md](16-development-roadmap.md)
- **Điều kiện trước**: Apps Script Project đã tạo, Admin đã cấp quyền Drive/Sheets cho script.
- **Luồng chính**:
  1. Admin mở Web App lần đầu, hệ thống phát hiện `SYSTEM_INITIALIZED` chưa được set.
  2. Hiển thị màn hình "Initialize System", Admin xác nhận.
  3. `Bootstrap.InitializeSystem.gs` tạo: Spreadsheet `AIOP_SystemDB` với đủ Sheet/Header/Named Range/Data Validation, thư mục gốc Drive, Role mặc định, Permission mặc định, Rule mặc định, Template mẫu, Workflow mặc định.
  4. Ghi `SYSTEM_INITIALIZED = true`, ghi Audit Log "SYSTEM_INITIALIZED".
- **Kết quả**: Hệ thống sẵn sàng dùng ngay, không cần Admin tạo tay bất kỳ Sheet nào (đúng SYSTEM BOOTSTRAP trong PROJECT_CONSTITUTION).

## UC-07: Cấu hình AI Provider

- **Actor chính**: Admin
- **Liên quan**: US-13, US-16, FR-ADM-01
- **Luồng chính**:
  1. Admin vào "Cài đặt hệ thống" → "AI Provider".
  2. Chọn Provider, nhập Model, API Key, Temperature, Max Tokens, Timeout.
  3. Hệ thống mã hoá API Key trước khi lưu (`AIGateway.KeyVault.gs`), ghi `AIProviderKeyHistory` + `AuditLog`.
  4. [Tuỳ chọn] Admin bấm "Kiểm tra kết nối" — gọi thử 1 request nhỏ để xác nhận cấu hình đúng.
- **Kết quả**: Provider đang active được cập nhật, các chức năng AI trong hệ thống dùng cấu hình mới ngay lập tức.

## UC-08: Phân quyền người dùng

- **Actor chính**: Admin (toàn hệ thống) / Manager (trong phạm vi Library)
- **Liên quan**: US-14, FR-ADM-02
- **Luồng chính**:
  1. Chọn người dùng từ danh sách `Users`.
  2. Gán Role và/hoặc quyền override theo Library.
  3. Hệ thống ghi `Permissions`, `AuditLog`.
- **Kết quả**: Người dùng có hiệu lực quyền mới ngay lần thao tác kế tiếp (không cần đăng nhập lại).
