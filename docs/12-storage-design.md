# 12 — Storage Design

Tuân thủ PROJECT_CONSTITUTION mục 16: ưu tiên Google Workspace, không mặc định dùng SQLite/PostgreSQL/MongoDB/Redis/Elasticsearch/ChromaDB.

## 1. Tổng quan phân lớp lưu trữ

| Lớp | Công nghệ | Dùng để lưu |
|---|---|---|
| Tệp tài liệu | Google Drive | Word, PDF, Scan, hình ảnh, Template, tài liệu tri thức |
| Dữ liệu có cấu trúc | Google Sheets ("AIOP_SystemDB") | Metadata, danh mục, người dùng, phân quyền, workflow, nhật ký, cấu hình |
| Cấu hình hệ thống nhạy cảm | Properties Service (Script Properties) | Root Folder ID, Spreadsheet ID, cờ bật/tắt tính năng, secret nội bộ dùng để mã hoá API Key |

## 2. Google Sheets — "AIOP_SystemDB"

Một Spreadsheet trung tâm mỗi môi trường (Dev/Staging/Prod tách biệt — xem [05-architecture.md](05-architecture.md) mục Deployment). ID được lưu trong Script Properties, không hard-code.

### 2.1 Danh sách Sheet (bảng)

| Sheet | Khoá chính | Mô tả |
|---|---|---|
| `Users` | UserID | Người dùng: Email, FullName, Role, Department, Status |
| `Roles` | RoleID | Admin / Manager / User / Guest + role tuỳ biến |
| `Permissions` | PermissionID | Ma trận quyền theo Role × Library (CanView/Create/Edit/Delete/Approve/Manage) |
| `Libraries` | LibraryID | Kho tri thức: tên, mô tả, người quản lý, DriveFolderID |
| `Categories` | CategoryID | Danh mục trong từng Library (hỗ trợ cây cha–con) |
| `Documents` | DocumentID | Văn bản: Library, Category, Title, DriveFileID, phiên bản hiện tại, trạng thái |
| `DocumentVersions` | VersionID | Lịch sử phiên bản văn bản |
| `Templates` | TemplateID | Mẫu văn bản: DriveFileID, danh sách field, trạng thái |
| `Rules` | RuleID | Rule Set: tên, phạm vi áp dụng, đường dẫn file JSON trên Drive, phiên bản |
| `Workflows` | WorkflowID | Định nghĩa quy trình (các bước, điều kiện chuyển bước) |
| `WorkflowInstances` | InstanceID | Một lượt chạy workflow gắn với 1 Document |
| `WorkflowStepLog` | LogID | Nhật ký từng bước: người thực hiện, hành động, ý kiến, thời gian |
| `AIProviders` | ProviderID | Danh sách nhà cung cấp AI hỗ trợ (Claude, OpenAI, Gemini, OpenRouter, Ollama, LM Studio, Local) |
| `AIProviderConfig` | ConfigID | Cấu hình đang dùng: Model, ApiKeySecretRef (con trỏ tới Script Properties — không lưu giá trị Key trong Sheet, xem [13-security.md](13-security.md) mục 4), Temperature, MaxTokens, Timeout, IsDefault |
| `AIProviderKeyHistory` | HistoryID | Lịch sử thay đổi API Key (không lưu giá trị cũ, chỉ lưu ai/khi nào/hành động gì) |
| `AuditLog` | LogID | Nhật ký toàn hệ thống (đăng nhập, upload, xoá, sửa, đổi quyền, đổi cấu hình AI...) |
| `SystemConfig` | Key | Cấu hình dạng key-value bổ sung, đồng bộ với Properties Service |

### 2.2 Quy ước

- Mỗi Sheet có **Named Range** trỏ vùng dữ liệu (`RNG_Users`, `RNG_Documents`...) để mã nguồn không phụ thuộc vào việc chèn/xoá dòng làm lệch toạ độ.
- Cột đầu tiên luôn là khoá chính dạng `PREFIX_xxxxxxxx` (ví dụ `DOC_a1b2c3`, sinh bằng `Utilities.getUuid()` rút gọn).
- Cột `CreatedAt`/`UpdatedAt` dùng ISO 8601 UTC, hiển thị theo `Asia/Ho_Chi_Minh` ở tầng UI.
- Sheet nghiệp vụ áp `Data Validation` cho các cột enum (Status, Role...) để hạn chế nhập sai khi thao tác thủ công.
- `Rules` sheet không chứa nội dung rule (JSON) trực tiếp — chỉ trỏ tới file JSON trên Drive, đúng nguyên tắc "chỉ sửa Rule, không sửa code, và tài liệu tri thức/rule không phình to Sheet".

## 3. Google Drive — Cấu trúc thư mục

```
/AIOP_ROOT/                      (Folder ID lưu ở Script Properties: ROOT_FOLDER_ID)
├── Libraries/
│   └── {LibraryName}/
│       └── {CategoryName}/
│           └── (các file tài liệu, mỗi file giữ nguyên Drive revision history)
├── Templates/
│   └── {TemplateCategory}/
├── System/
│   ├── Rules/                   # File JSON rule, đồng bộ khi Initialize hoặc khi Admin cập nhật
│   ├── Logs/                    # Xuất log định kỳ (Excel/CSV) nếu cần lưu trữ ngoài Sheet
│   └── Backups/                 # Bản sao Spreadsheet định kỳ (Time-driven Trigger)
└── Uploads/
    └── _Inbox/                  # Nơi chứa file mới upload, chờ phân loại/kiểm tra trước khi chuyển vào Libraries/
```

- Quyền truy cập thư mục **kế thừa từ Google Drive/Workspace**, đồng bộ hoá với bảng `Permissions` — Apps Script kiểm tra quyền nghiệp vụ (RBAC) trước, đồng thời không cấp quyền Drive vượt quá quyền nghiệp vụ.
- Phiên bản tài liệu tận dụng **Drive revision history** làm nguồn sự thật cho nội dung; Sheet `DocumentVersions` chỉ lưu metadata (ai đổi, khi nào, ghi chú) trỏ tới revision đó.

## 4. Properties Service

| Key | Mục đích |
|---|---|
| `ROOT_FOLDER_ID` | ID thư mục gốc trên Drive |
| `SYSTEM_DB_SPREADSHEET_ID` | ID Spreadsheet AIOP_SystemDB |
| `ENV` | `dev` / `staging` / `prod` |
| `SYSTEM_INITIALIZED` | Cờ đánh dấu đã chạy Initialize System |
| `SECRET_<ConfigID>` | Giá trị API Key thật (lưu bởi `AIGateway.SecretStore.gs`, xem [13-security.md](13-security.md) mục 4) — không hiển thị qua UI, chỉ script phía server đọc được |
| `AI_ENABLED` | Bật/tắt toàn bộ tính năng AI |

## 5. Ngưỡng mở rộng (khi nào xem xét công nghệ khác)

Theo đúng nguyên tắc "chỉ tăng độ phức tạp khi có nhu cầu thực tế" (mục 9 PROJECT_CONSTITUTION):

| Ngưỡng | Dấu hiệu | Hướng xử lý khi tới ngưỡng |
|---|---|---|
| > ~50.000–100.000 dòng trên một Sheet nghiệp vụ | Đọc/ghi chậm rõ rệt, UI load lâu | Cân nhắc archive dữ liệu cũ sang Sheet lưu trữ riêng, hoặc trình Product Owner phương án bổ sung theo mục 7 |
| Cần tìm kiếm ngữ nghĩa (semantic search) trên hàng nghìn tài liệu | Tìm kiếm từ khoá không đáp ứng chất lượng | Trình phương án bổ sung vector index (ví dụ Vertex AI Search) — không tự ý bổ sung |
| Số request AI/ngày vượt quota `UrlFetchApp` hợp lý | Lỗi quota Apps Script | Xem xét hàng đợi (Sheet-based queue + Trigger) trước khi nghĩ tới hạ tầng ngoài |

Không triển khai trước các phương án trên khi chưa chạm ngưỡng.
