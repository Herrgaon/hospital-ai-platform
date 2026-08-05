# 05 — Architecture Document

## 1. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│                      Trình duyệt (Người dùng)                    │
│              HTML Service UI (Alpine.js + Tailwind CDN)          │
└───────────────────────────────┬─────────────────────────────────┘
                                 │ HTTPS (doGet/doPost, google.script.run)
┌───────────────────────────────▼─────────────────────────────────┐
│                    GOOGLE APPS SCRIPT WEB APP                    │
│                     (Nền tảng điều phối chính)                   │
│                                                                   │
│  Core.Router → Auth (RBAC) → Service Layer:                      │
│    Document / Template / RuleEngine / Knowledge / Workflow /     │
│    Admin / OCR                                                   │
│                                                                   │
│              AI Gateway (Provider Pattern) ──────────────┐       │
└───────┬───────────────────────┬──────────────────────────┼──────┘
        │                       │                           │
┌───────▼────────┐     ┌────────▼─────────┐         ┌───────▼───────┐
│  Google Drive   │     │  Google Sheets    │         │  AI Provider   │
│  (Tài liệu)     │     │  (AIOP_SystemDB)  │         │  (qua HTTPS)   │
└─────────────────┘     └───────────────────┘         └───────────────┘
```

Đúng mô hình tại mục 10 PROJECT_CONSTITUTION: **Google Apps Script Web App → Google Workspace → AI Provider**. Không Backend riêng, không Microservice, không Message Queue, không Cache riêng, không Event Bus.

## 2. Các lớp trong Apps Script

| Lớp | Trách nhiệm | Ví dụ module |
|---|---|---|
| **Router** | Nhận request (`doGet`/`doPost`/`google.script.run`), điều hướng | `Core.Router.gs` |
| **Auth** | Xác định danh tính (`Session.getActiveUser()`), kiểm tra RBAC | `Auth.Session.gs`, `Auth.Permission.gs` |
| **Service** | Nghiệp vụ: Document, Template, Knowledge, Workflow, Admin | `Document.Service.gs`... |
| **Rule Engine** | Nạp Rule JSON, kiểm tra thể thức bằng lập trình thông thường | `RuleEngine.Core.gs` |
| **AI Gateway** | Điều phối gọi AI Provider qua Provider Pattern | `AIGateway.Core.gs` |
| **Repository** | Truy cập dữ liệu (Sheets/Drive), che giấu chi tiết lưu trữ khỏi Service | `Storage.SheetRepository.gs`, `Storage.DriveRepository.gs` |
| **UI** | HTML Service views, gọi Service qua `google.script.run` | `ui/views/*.html` |

Chi tiết cấu trúc file: [17-project-structure.md](17-project-structure.md).

## 3. Nguyên tắc kiến trúc

1. **Service không truy cập trực tiếp SpreadsheetApp/DriveApp** — luôn qua Repository, để có thể thay đổi cách lưu trữ mà không sửa nghiệp vụ.
2. **Không module nào gọi trực tiếp API của AI Provider** — luôn qua AI Gateway (mục 14 PROJECT_CONSTITUTION).
3. **Rule Engine là lập trình thông thường, không gọi AI** — mục 13 PROJECT_CONSTITUTION quy định rõ những gì kiểm tra được bằng rule (font, margin, numbering...) không được dùng AI.
4. **Toàn bộ Rule/Template/Workflow là dữ liệu cấu hình (JSON/Sheet), không hard-code trong mã nguồn.**
5. **Không AI vẫn chạy được** — mọi luồng nghiệp vụ chính (upload, kiểm tra rule, phê duyệt, xuất Word) không phụ thuộc AI đang bật hay tắt.

## 4. Luồng xử lý chính (ví dụ: Soạn văn bản theo mẫu)

```
Người dùng chọn Template
        │
        ▼
Template.Merge.gs → điền field → sinh Google Doc nháp
        │
        ▼
RuleEngine.Core.gs → kiểm tra thể thức (font/lề/số hiệu/quốc hiệu...)
        │
        ├── Có lỗi ─────► Trả danh sách lỗi cụ thể cho người dùng sửa
        │
        ▼ (đạt)
[Tuỳ chọn] AI Gateway → hỗ trợ viết lại/tóm tắt/giải thích theo yêu cầu người dùng
        │
        ▼
Workflow.Engine.gs → đưa vào bước Phê duyệt (nếu quy trình yêu cầu)
        │
        ▼
Document.Export.gs → Xuất Word/PDF, lưu vào Drive, ghi DocumentVersions + AuditLog
```

## 5. Xử lý bất đồng bộ / tác vụ dài

Apps Script giới hạn thời gian thực thi (tối đa 6 phút với tài khoản cá nhân, 30 phút với Workspace). Các tác vụ có khả năng vượt giới hạn (xử lý AI trên tài liệu dài, ingest nhiều tài liệu vào kho tri thức) áp dụng mẫu:

- Chia nhỏ theo lô (batch) và dùng **Time-driven Trigger** để tiếp tục lô sau.
- Lưu trạng thái tiến độ trong `SystemConfig` hoặc một Sheet hàng đợi riêng (`ProcessingQueue`), không giữ trạng thái trong bộ nhớ.
- UI polling trạng thái qua `google.script.run` thay vì kỳ vọng phản hồi tức thời cho tác vụ dài.

## 6. Môi trường triển khai (Dev / Staging / Prod)

| Môi trường | Apps Script Deployment | Spreadsheet & Drive Root |
|---|---|---|
| Dev | Deployment riêng, quyền giới hạn nhóm phát triển | `AIOP_SystemDB_DEV`, `/AIOP_ROOT_DEV/` |
| Staging | Deployment riêng, dùng để Product Owner nghiệm thu | `AIOP_SystemDB_STG`, `/AIOP_ROOT_STG/` |
| Prod | Deployment chính thức cho người dùng bệnh viện | `AIOP_SystemDB_PROD`, `/AIOP_ROOT_PROD/` |

Mỗi môi trường tách biệt hoàn toàn về dữ liệu (Script Properties khác nhau trỏ tới Spreadsheet ID / Folder ID khác nhau), cùng một mã nguồn.

## 7. Công nghệ lựa chọn (tóm tắt — chi tiết so sánh tại [ADR-001](adr/ADR-001-google-apps-script-platform.md))

| Thành phần | Lựa chọn | Lý do ngắn gọn |
|---|---|---|
| Nền tảng chạy | Google Apps Script (V8) | Đáp ứng mục 10 PROJECT_CONSTITUTION, không cần hạ tầng riêng |
| Giao diện | HTML Service + Alpine.js + Tailwind CSS (qua CDN, không build step) | Nhẹ, không cần Node build pipeline, vẫn đạt chuẩn UI hiện đại theo mục 23 |
| Dữ liệu cấu trúc | Google Sheets | Đáp ứng mục 16, đủ cho quy mô 50 người dùng |
| Lưu tệp | Google Drive | Đáp ứng mục 16 |
| Quản lý mã nguồn | `clasp` + Git | Cho phép version control, code review ngoài Apps Script Editor |
| Gọi AI | `UrlFetchApp` trực tiếp tới REST API của từng Provider (không dùng SDK Node, vì không chạy trong V8 GAS runtime) | Không thêm phụ thuộc, kiểm soát được toàn bộ request/response |

## 8. Rủi ro kiến trúc & điểm cần Product Owner xác nhận

Xem tổng hợp đầy đủ tại [99-bootstrap-report.md](99-bootstrap-report.md). Hai điểm kỹ thuật trọng yếu nhất:

1. **Mã hoá API Key**: Apps Script không có hàm mã hoá đối xứng dựng sẵn (chỉ có HMAC/digest một chiều). Cần vendor một thư viện AES thuần JavaScript (không gọi mạng ngoài, không telemetry) để đáp ứng yêu cầu "API Key phải được mã hoá, không lưu Plain Text" (mục 15). Phương án thay thế là dùng Google Cloud Secret Manager (cùng GCP Project ẩn sau Apps Script) — chi tiết so sánh tại [13-security.md](13-security.md) mục 4.
2. **Provider AI cục bộ (Ollama/LM Studio)**: `UrlFetchApp` chỉ gọi được endpoint có thể truy cập từ Internet công khai. Muốn dùng model cục bộ tại bệnh viện, cần một cổng HTTPS công khai trỏ vào máy chạy Ollama/LM Studio (ví dụ Cloudflare Tunnel) — đây là yêu cầu hạ tầng bổ sung, cần Product Owner xác nhận trước khi triển khai (mục 7 PROJECT_CONSTITUTION).
