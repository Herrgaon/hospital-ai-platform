# 02 — Software Requirements Specification (SRS)

## 1. Giới thiệu

Tài liệu này đặc tả yêu cầu phần mềm cho AI Office Platform, giai đoạn 1 triển khai tại Bệnh viện Đa khoa Đông Sơn, cụ thể hoá [01-business-requirements.md](01-business-requirements.md) thành yêu cầu chức năng/phi chức năng có thể kiểm thử.

## 2. Yêu cầu chức năng (Functional Requirements)

Mã hoá `FR-<nhóm>-<số>`.

### 2.1 Văn bản (DOC)
- **FR-DOC-01**: Hệ thống phải cho phép tạo văn bản mới từ một Template đã chọn, điền các field bắt buộc, sinh Google Doc/Word.
- **FR-DOC-02**: Hệ thống phải kiểm tra thể thức văn bản bằng Rule Engine trước khi cho phép chuyển sang bước Phê duyệt, hiển thị danh sách lỗi cụ thể theo `ruleId`.
- **FR-DOC-03**: Hệ thống phải cho phép so sánh 2 phiên bản của cùng một văn bản, hiển thị phần khác biệt.
- **FR-DOC-04**: Hệ thống phải chuẩn hoá tên file và vị trí lưu trữ theo quy tắc cấu hình (Rule_Document.json) khi văn bản được xuất bản.
- **FR-DOC-05**: Hệ thống phải cho phép chỉnh sửa văn bản (soạn thảo trực tiếp hoặc mở bằng Google Docs) trong phạm vi quyền của người dùng.
- **FR-DOC-06**: Hệ thống phải xuất được văn bản ra định dạng Word (.docx) ở bước cuối quy trình.

### 2.2 Tri thức (KNOW)
- **FR-KNOW-01**: Hệ thống phải cho phép tạo, đổi tên, xoá (Admin/Manager) một Knowledge Library, có người quản lý và danh mục riêng.
- **FR-KNOW-02**: Hệ thống phải cho phép upload tài liệu (DOCX/PDF/TXT/Ảnh) vào một Library/Category cụ thể.
- **FR-KNOW-03**: Hệ thống phải cho phép tìm kiếm tài liệu theo từ khoá trong phạm vi Library người dùng có quyền xem.
- **FR-KNOW-04**: Hệ thống phải cho phép người dùng đặt câu hỏi tự nhiên và nhận câu trả lời kèm trích dẫn nguồn tài liệu nội bộ.
- **FR-KNOW-05**: Hệ thống phải lưu và hiển thị lịch sử phiên bản của mỗi tài liệu trong kho tri thức.

### 2.3 AI (AI)
- **FR-AI-01**: Hệ thống phải cung cấp giao diện AI Chat cho hỏi đáp tự do.
- **FR-AI-02**: Hệ thống phải hỗ trợ AI viết/viết lại đoạn văn bản theo yêu cầu người dùng.
- **FR-AI-03**: Hệ thống phải hỗ trợ AI tóm tắt văn bản dài.
- **FR-AI-04**: Hệ thống phải hỗ trợ AI giải thích thuật ngữ/quy định.
- **FR-AI-05**: Mọi tính năng không thuộc danh sách tại [09-ai-design.md](09-ai-design.md) mục 4 không được gọi AI.
- **FR-AI-06**: Khi AI bị tắt hoặc chưa cấu hình, các chức năng không dùng AI (FR-DOC-*, FR-KNOW-01..03/05, FR-WF-*) phải hoạt động bình thường.

### 2.4 Workflow (WF)
- **FR-WF-01**: Hệ thống phải cho phép cấu hình một Workflow gồm nhiều bước theo Library/loại văn bản.
- **FR-WF-02**: Hệ thống phải chuyển trạng thái Workflow Instance đúng theo định nghĩa Workflow (không hard-code trạng thái).
- **FR-WF-03**: Hệ thống phải ghi nhật ký từng bước Workflow: người thực hiện, hành động, ý kiến, thời gian.
- **FR-WF-04**: Hệ thống phải thông báo (trong ứng dụng + email) cho người có quyền phê duyệt khi có văn bản chờ duyệt trong phạm vi phụ trách.

### 2.5 Quản trị (ADM)
- **FR-ADM-01**: Chỉ Admin được thêm/sửa/xoá API Key và cấu hình AI Provider.
- **FR-ADM-02**: Chỉ Admin/Manager (trong phạm vi) được gán Role/Permission cho người dùng.
- **FR-ADM-03**: Hệ thống phải ghi Audit Log cho: đăng nhập, đăng xuất, upload, xoá, sửa, đổi quyền, đổi AI Provider, đổi cấu hình.
- **FR-ADM-04**: Audit Log phải tìm kiếm được, lọc được, xuất được ra Excel.
- **FR-ADM-05**: Hệ thống phải có chức năng "Initialize System" tự động tạo cấu trúc Sheet/Drive/Role/Rule/Template/Workflow mặc định khi chạy lần đầu.

## 3. Yêu cầu phi chức năng (Non-Functional Requirements)

| Mã | Yêu cầu | Tiêu chí đo |
|---|---|---|
| NFR-01 | Hiệu năng | Thao tác thông thường (mở danh sách, tra cứu) phản hồi trong ≤ 3 giây ở điều kiện mạng bình thường |
| NFR-02 | Khả dụng | Hệ thống khả dụng theo SLA của Google Workspace (không tự cam kết SLA cao hơn nền tảng nền) |
| NFR-03 | Bảo mật | Tuân thủ toàn bộ [13-security.md](13-security.md); không lưu secret dạng Plain Text |
| NFR-04 | Khả năng bảo trì | Rule/Template/Workflow thay đổi được qua cấu hình, không cần sửa/deploy lại mã nguồn |
| NFR-05 | Khả năng mở rộng | Kiến trúc cho phép thêm Library/Rule/Provider AI mới mà không đổi cấu trúc lõi |
| NFR-06 | Chi phí | Không phát sinh chi phí hạ tầng ngoài Google Workspace hiện có + chi phí AI Provider theo usage, có thể giám sát và tắt |
| NFR-07 | Khả năng dùng | Người dùng phổ thông (không rành kỹ thuật) thao tác được sau đào tạo ngắn (< 30 phút) |
| NFR-08 | Tương thích | Hoạt động tốt trên Chrome/Edge phiên bản hiện hành, responsive cho màn hình laptop phổ biến |
| NFR-09 | Giới hạn nền tảng | Mọi tác vụ đơn lẻ phải hoàn thành trong giới hạn thực thi của Apps Script (≤ 6 phút cá nhân / 30 phút Workspace); tác vụ dài hơn phải thiết kế bất đồng bộ |

## 4. Ma trận truy vết (Traceability) — trích lược

| Business Requirement | Functional Requirement liên quan |
|---|---|
| BR-01 (soạn văn bản theo mẫu) | FR-DOC-01, FR-DOC-06 |
| BR-02 (kiểm tra thể thức) | FR-DOC-02 |
| BR-03 (so sánh văn bản) | FR-DOC-03 |
| BR-06/BR-07 (tra cứu, hỏi đáp) | FR-KNOW-03, FR-KNOW-04 |
| BR-08/BR-09 (giới hạn dùng AI) | FR-AI-05, FR-AI-06 |
| BR-10/BR-11 (workflow, nhật ký duyệt) | FR-WF-01..04 |
| BR-12/BR-13 (quản trị, log) | FR-ADM-01..04 |

Ma trận đầy đủ (toàn bộ FR ↔ Use Case ↔ User Story) được duy trì trong quá trình phát triển, không lặp lại toàn bộ tại đây để tránh trùng lặp với [03-user-stories.md](03-user-stories.md) và [04-use-cases.md](04-use-cases.md).

## 5. Giả định & ràng buộc kỹ thuật

Kế thừa từ [01-business-requirements.md](01-business-requirements.md) mục 5–6 và [ADR-001](adr/ADR-001-google-apps-script-platform.md).
