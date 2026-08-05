# 99 — Bootstrap Report (Báo cáo tổng hợp khởi tạo dự án)

Ngày: 2026-08-05
Thực hiện bởi: AI Chief Architect, theo PROJECT_CONSTITUTION mục 28 (Bootstrap Execution)

---

## 1. Các tài liệu đã tạo

| # | Tài liệu | Nội dung chính |
|---|---|---|
| 00 | [Vision](00-vision.md) | Tầm nhìn, vấn đề, giải pháp, phạm vi, tiêu chí thành công |
| 01 | [Business Requirements](01-business-requirements.md) | Mục tiêu nghiệp vụ, stakeholders, yêu cầu theo nhóm, rủi ro |
| 02 | [SRS](02-srs.md) | Yêu cầu chức năng (FR) và phi chức năng (NFR), ma trận truy vết |
| 03 | [User Stories](03-user-stories.md) | 18 user story theo vai trò, ưu tiên P0/P1/P2 |
| 04 | [Use Cases](04-use-cases.md) | 8 use case chi tiết (UC-01 → UC-08) |
| 05 | [Architecture](05-architecture.md) | Kiến trúc tổng thể, các lớp, luồng xử lý, môi trường triển khai |
| 06 | [UI Specification](06-ui-specification.md) | Công nghệ giao diện, bố cục, màn hình, UX/Accessibility |
| 07 | [Workflow](07-workflow.md) | Workflow mặc định, cấu trúc JSON, đa cấp phê duyệt |
| 08 | [Rule Engine](08-rule-engine.md) | Cấu trúc Rule JSON, phạm vi kiểm tra được, giới hạn |
| 09 | [AI Design](09-ai-design.md) | AI Gateway, Provider Pattern, retrieval, kiểm soát chi phí |
| 10 | [Knowledge Design](10-knowledge-design.md) | Kho tri thức, vòng đời tài liệu, OCR bổ sung |
| 11 | [Permission Design](11-permission-design.md) | RBAC, ma trận quyền, vòng đời người dùng |
| 12 | [Storage Design](12-storage-design.md) | Schema Sheets, cấu trúc Drive, ngưỡng mở rộng |
| 13 | [Security](13-security.md) | Auth/Authorization, mã hoá API Key, audit, bề mặt tấn công |
| 14 | [Coding Standard](14-coding-standard.md) | KISS→DRY→SOLID→Clean Code→YAGNI, quy ước đặt tên |
| 15 | [Testing Strategy](15-testing-strategy.md) | Các lớp kiểm thử, ưu tiên theo rủi ro, checklist release |
| 16 | [Development Roadmap](16-development-roadmap.md) | 7 Phase (0→6), mỗi Phase có mốc dùng được thực tế |
| 17 | [Project Structure](17-project-structure.md) | Cấu trúc thư mục `src/`, quy ước file, ghi chú `clasp` |
| ADR-001 | [ADR-001](adr/ADR-001-google-apps-script-platform.md) | Quyết định chọn Google Apps Script làm nền tảng chính |

## 2. Quyết định kỹ thuật đã đưa ra (không cần Product Owner duyệt lại — thuộc quyền kỹ thuật thông thường theo mục 7)

- Nền tảng: Google Apps Script Web App, không Backend/Microservice riêng ([ADR-001](adr/ADR-001-google-apps-script-platform.md)).
- Dữ liệu: một Spreadsheet trung tâm "AIOP_SystemDB" + Google Drive theo cấu trúc thư mục cố định ([12-storage-design.md](12-storage-design.md)).
- Giao diện: HTML Service + Alpine.js + Tailwind CSS qua CDN, không build pipeline ([06-ui-specification.md](06-ui-specification.md)).
- Kiến trúc Service → Repository → Storage, không Service nào truy cập trực tiếp SpreadsheetApp/DriveApp hay gọi thẳng AI Provider ([05-architecture.md](05-architecture.md)).
- Rule Engine kiểm tra thể thức dùng lập trình thông thường (JSON-driven), không dùng AI ([08-rule-engine.md](08-rule-engine.md)).
- Quản lý mã nguồn qua `clasp` + Git, cấu trúc module theo `src/` ([17-project-structure.md](17-project-structure.md)).

## 3. Quyết định của Product Owner (2026-08-05)

| # | Quyết định | Lựa chọn | Lý do (theo Product Owner) | Đã cập nhật vào |
|---|---|---|---|---|
| 1 | **Lưu trữ API Key AI Provider** | PropertiesService cho giai đoạn đầu (Storage Provider Pattern, chuyển sang Google Secret Manager sau nếu nhân rộng nhiều đơn vị hoặc cần bảo mật cao hơn) | Chạy trên Apps Script, quy mô ~50 người dùng, chưa cần tăng độ phức tạp/chi phí quản trị | [13-security.md](13-security.md) mục 4, `src/09_AIGateway/AIGateway.SecretStore.gs`, `AIGateway.KeyVault.gs` |
| 2 | **AI Provider cục bộ (Ollama/LM Studio)** | Không triển khai ở giai đoạn đầu | Đã có Claude Pro, quy mô nhỏ, không có lý do thực tế để thêm Local LLM ngay; AI Gateway vẫn giữ kiến trúc sẵn sàng bổ sung sau | [09-ai-design.md](09-ai-design.md) mục 2/8, `AIGateway.Providers.Local.gs` |
| 3 | **Kiểm tra thể thức cho PDF** | Không kiểm tra chi tiết — PDF chỉ đọc nội dung/metadata, OCR chạy khi người dùng yêu cầu | PDF có nhiều loại (text, scan, ảnh, xuất từ Word), kiểm tra thể thức chi tiết cần OCR/phân tích bố cục phức tạp, không tương xứng lợi ích ở giai đoạn đầu | [08-rule-engine.md](08-rule-engine.md) mục 7 (không đổi, đã đúng thiết kế ban đầu) |
| 4 | **Provider AI triển khai trước (Phase 4)** | Claude | Đã có Claude Pro; mạnh về lập trình, phân tích tài liệu, viết văn bản, RAG; chưa cần OpenAI/Gemini ngay | [09-ai-design.md](09-ai-design.md) mục 2, [16-development-roadmap.md](16-development-roadmap.md) Phase 4, `Bootstrap.Defaults.gs` |

Toàn bộ 4 điểm đã được phản ánh vào tài liệu thiết kế liên quan và khung mã nguồn (`src/`). Không còn điểm nào đang chờ quyết định ở giai đoạn Bootstrap.

## 4. Rủi ro của dự án

| Rủi ro | Mức độ | Tham chiếu |
|---|---|---|
| Giới hạn thực thi 6 phút/request của Apps Script với tác vụ AI/xử lý tài liệu nặng | Trung bình | [05-architecture.md](05-architecture.md) mục 5, [ADR-001](adr/ADR-001-google-apps-script-platform.md) |
| Google Sheets không phải RDBMS thật — giới hạn khi dữ liệu tăng rất lớn | Thấp ở quy mô hiện tại | [12-storage-design.md](12-storage-design.md) mục 5 |
| Người dùng ngại đổi thói quen từ Word/giấy sang hệ thống mới | Trung bình | [01-business-requirements.md](01-business-requirements.md) mục 7 |
| Rule Engine kiểm tra thể thức PDF hạn chế | Thấp–Trung bình | [08-rule-engine.md](08-rule-engine.md) mục 7 |
| Chi phí AI Provider phát sinh ngoài kiểm soát nếu không giám sát | Thấp (đã có nút tắt AI + giới hạn Max Tokens) | [09-ai-design.md](09-ai-design.md) mục 7 |

## 5. Đề xuất cải tiến (để Product Owner cân nhắc, không bắt buộc ở giai đoạn 1)

- Khi kho tri thức lớn dần (nhiều nghìn tài liệu), cân nhắc semantic search chuyên dụng — đã xác định rõ ngưỡng chuyển đổi tại [12-storage-design.md](12-storage-design.md) mục 5, không cần quyết định ngay.
- Có thể bổ sung số hoá luồng ký số/chữ ký điện tử ở giai đoạn sau nếu bệnh viện có nhu cầu, hiện nằm ngoài phạm vi ([00-vision.md](00-vision.md) mục 6).
- Cân nhắc mở rộng Workflow Inbox thành ứng dụng di động nhẹ (PWA) nếu lãnh đạo cần phê duyệt khi di chuyển nhiều — chưa cấp thiết ở giai đoạn 1.

## 6. Trạng thái mã nguồn hiện tại

Theo yêu cầu bổ sung của Product Owner trong phiên làm việc này ("tự tạo thêm file code nếu cần"), ngoài bộ tài liệu thiết kế, đã tạo thêm **khung mã nguồn scaffold** (`src/`) bám sát kiến trúc tại mục 2 — các module rỗng/stub đúng vị trí, đúng tên file, kèm hàm `InitializeSystem` khởi tạo hệ thống theo [12-storage-design.md](12-storage-design.md) và UC-06. Đây là scaffold (khung sườn, chưa đầy đủ nghiệp vụ), không phải cài đặt hoàn chỉnh Phase 1-6 — việc lập trình đầy đủ từng Phase sẽ tiếp tục theo [16-development-roadmap.md](16-development-roadmap.md) khi có yêu cầu tiếp theo.

## 7. Bước tiếp theo

Cả 4 điểm quyết định đã được Product Owner xác nhận (2026-08-05) và phản ánh vào tài liệu + mã nguồn. Còn lại chờ Product Owner:

1. Xác nhận thứ tự ưu tiên Phase tại [16-development-roadmap.md](16-development-roadmap.md) có phù hợp thực tế vận hành của Bệnh viện Đông Sơn không.
2. Cho phép bắt đầu lập trình đầy đủ Phase 1 (Văn bản & Rule Engine).
