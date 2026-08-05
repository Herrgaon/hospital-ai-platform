# 16 — Development Roadmap

Roadmap chia theo Phase, mỗi Phase kết thúc bằng một mốc dùng được thực tế (không chờ "hoàn thiện toàn bộ" mới có giá trị sử dụng).

> **Trạng thái (2026-08-05)**: Phase 0-5 đã lập trình và `clasp push` lên Apps Script, sẵn sàng test qua Web App (deployment `@HEAD`, tự cập nhật mỗi lần push). Còn lại trước khi Phase 5 "xong hẳn": Dashboard vẫn là màn hình placeholder (chưa có giá trị nghiệp vụ riêng, ưu tiên thấp), chưa test thật trên Apps Script runtime (chỉ mới kiểm tra cú pháp + tham chiếu chéo tĩnh). Phase 6 (go-live, đào tạo người dùng) chưa bắt đầu, đúng thực tế vì cần vận hành thật mới thực hiện được. Chi tiết implementation bám sát thiết kế nhưng có vài đơn giản hoá thực dụng so với thiết kế ban đầu (ví dụ Workflow chạy 1 bước duyệt cố định thay vì diễn giải JSON động — xem comment đầu `src/08_Workflow/Workflow.Engine.gs`; Rule Engine chưa kiểm tra bố cục 2 cột — xem docs/08-rule-engine.md mục 7).

## Phase 0 — Nền tảng & Bootstrap

- Cấu trúc mã nguồn `src/` theo [17-project-structure.md](17-project-structure.md).
- `Bootstrap.InitializeSystem.gs`: tự tạo Spreadsheet, Sheet, Header, Named Range, Data Validation, thư mục Drive gốc, Role/Permission mặc định.
- `Core.Router.gs`, `Auth.Session.gs`, `Auth.Permission.gs`, Repository layer (`Storage.SheetRepository.gs`, `Storage.DriveRepository.gs`).
- Shell UI (sidebar, top bar, đăng nhập ngầm định qua Google Session).
- **Mốc hoàn thành**: Bấm "Initialize System" trên một Apps Script Project trống → hệ thống tự dựng đủ hạ tầng dữ liệu, đăng nhập được, thấy giao diện rỗng nhưng đúng cấu trúc.

## Phase 1 — Văn bản & Rule Engine (giá trị cốt lõi đầu tiên)

- Quản lý Template, sinh văn bản từ mẫu (`Template.Merge.gs`).
- Rule Engine cho DOCX/Google Docs (`RuleEngine.Core.gs`, `RuleEngine.DocxInspector.gs`) với `Rule_NghiDinh30.json`, `Rule_Document.json`.
- Quản lý văn bản, phiên bản (`Document.Service.gs`, `Document.Version.gs`), xuất Word (`Document.Export.gs`).
- **Mốc hoàn thành**: Văn thư soạn một văn bản từ mẫu, hệ thống phát hiện lỗi thể thức cụ thể, sửa xong xuất được file Word. (Đáp ứng UC-01, UC-02.)

## Phase 2 — Kho tri thức & Phân quyền đầy đủ

- Knowledge Library, Category, Ingest, Search (`Knowledge.*.gs`).
- RBAC đầy đủ theo Library (`Permissions` override theo UserID/LibraryID).
- So sánh phiên bản văn bản.
- **Mốc hoàn thành**: Tạo được nhiều kho tri thức theo khoa/phòng, upload/tìm kiếm tài liệu, phân quyền đúng theo ma trận tại [11-permission-design.md](11-permission-design.md). (Đáp ứng UC-05.)

## Phase 3 — Workflow phê duyệt

- `Workflow.Engine.gs`, `Workflow.Approval.gs`, Workflow Inbox UI, thông báo Gmail.
- Workflow mặc định + khả năng cấu hình nhiều cấp duyệt.
- **Mốc hoàn thành**: Một văn bản đi hết vòng đời Upload → Kiểm tra → Chỉnh sửa → Phê duyệt → Xuất Word, có nhật ký đầy đủ. (Đáp ứng UC-03.)

## Phase 4 — AI Gateway & Trợ lý AI

- `AIGateway.Core.gs` + adapter **Claude** (duy nhất kích hoạt ở giai đoạn này — quyết định Product Owner 2026-08-05, tận dụng Claude Pro sẵn có). Adapter OpenAI/Gemini/OpenRouter/Local đã có sẵn trong mã nguồn nhờ Provider Pattern, chỉ bật khi có nhu cầu thực tế.
- `AIGateway.KeyVault.gs` + `AIGateway.SecretStore.gs`: lưu API Key qua **PropertiesService** (quyết định Product Owner 2026-08-05 — xem [13-security.md](13-security.md) mục 4). Thiết kế Storage Provider Pattern để chuyển sang Google Secret Manager sau này mà không sửa module khác.
- AI Chat, Hỏi đáp theo tài liệu (RAG cơ bản), Hỗ trợ viết/tóm tắt/giải thích.
- Trang cấu hình AI cho Admin (chỉ cần cấu hình Claude ở giai đoạn này).
- **Mốc hoàn thành**: Admin cấu hình được Claude, người dùng hỏi đáp được dựa trên tài liệu nội bộ, tắt AI thì các Phase 1-3 vẫn hoạt động bình thường (kiểm chứng NFR liên quan tại [02-srs.md](02-srs.md)). (Đáp ứng UC-04, UC-06, UC-07.)

## Phase 5 — Quản trị, Audit, Hoàn thiện

- Trang quản lý người dùng/phân quyền đầy đủ cho Admin (UC-08).
- Audit Log: tìm kiếm, lọc, xuất Excel.
- Sao lưu định kỳ (`System/Backups/`).
- OCR bổ sung (Google OCR) cho ảnh/scan trong kho tri thức.
- Hoàn thiện Dark Mode, responsive, accessibility theo [06-ui-specification.md](06-ui-specification.md).
- **Mốc hoàn thành**: Toàn bộ FR trong [02-srs.md](02-srs.md) đã triển khai, checklist tại [15-testing-strategy.md](15-testing-strategy.md) mục 5 đạt 100%.

## Phase 6 — Go-live tại Đông Sơn & Ổn định

- Đào tạo người dùng (~50 người), migrate dữ liệu/mẫu văn bản hiện có vào kho tri thức.
- Theo dõi sát 2-4 tuần đầu (log lỗi, phản hồi người dùng), ưu tiên vá lỗi hơn thêm tính năng mới.
- Tổng kết bài học, chuẩn bị tài liệu để nhân rộng cho đơn vị tiếp theo (không viết lại hệ thống — đúng mục 1 PROJECT_CONSTITUTION).

## Nguyên tắc xuyên suốt roadmap

- Mỗi Phase kết thúc bằng một mốc **dùng được thực tế**, không phải "code xong nhưng chưa dùng được".
- Không bắt đầu Phase sau khi Phase trước chưa đạt mốc hoàn thành, trừ khi Product Owner chủ động yêu cầu đổi ưu tiên.
- Phạm vi ngoài roadmap (chữ ký số, EMR/HIS, tìm kiếm ngữ nghĩa nâng cao...) chỉ xem xét sau khi có nhu cầu thực tế được xác nhận, theo đúng mục 9 PROJECT_CONSTITUTION.
