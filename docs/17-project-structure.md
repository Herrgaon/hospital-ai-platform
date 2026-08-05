# 17 — Cấu trúc thư mục dự án (đề xuất)

Áp dụng cho repository local, đồng bộ lên Apps Script bằng `clasp push`. Apps Script không có thư mục con thật sự (mọi file `.gs`/`.html` nằm phẳng trong một Project) — cấu trúc thư mục dưới đây là cấu trúc **local/git**, còn tên file dùng tiền tố để mô phỏng phân lớp khi hiển thị trên Apps Script Editor.

```
hospital-ai-platform/
├── PROJECT_CONSTITUTION.md
├── .clasp.json
├── appsscript.json
├── .claspignore
├── docs/                                  # Toàn bộ tài liệu thiết kế (bootstrap output)
│   ├── 00-vision.md
│   ├── 01-business-requirements.md
│   ├── 02-srs.md
│   ├── 03-user-stories.md
│   ├── 04-use-cases.md
│   ├── 05-architecture.md
│   ├── 06-ui-specification.md
│   ├── 07-workflow.md
│   ├── 08-rule-engine.md
│   ├── 09-ai-design.md
│   ├── 10-knowledge-design.md
│   ├── 11-permission-design.md
│   ├── 12-storage-design.md
│   ├── 13-security.md
│   ├── 14-coding-standard.md
│   ├── 15-testing-strategy.md
│   ├── 16-development-roadmap.md
│   ├── 17-project-structure.md
│   ├── 99-bootstrap-report.md
│   └── adr/
│       └── ADR-001-google-apps-script-platform.md
│
└── src/                                   # Mã nguồn Apps Script (push lên bằng clasp)
    ├── appsscript.json
    │
    ├── 00_Bootstrap/
    │   ├── Bootstrap.InitializeSystem.gs   # Hàm "Initialize System" — tự tạo Sheet/Folder/Rule/Template mặc định
    │   └── Bootstrap.Defaults.gs           # Dữ liệu mặc định: Role, Permission, Rule, Template, Workflow
    │
    ├── 01_Core/
    │   ├── Core.Router.gs                  # doGet/doPost, điều hướng route
    │   ├── Core.Config.gs                  # Đọc/ghi Script Properties, SystemConfig
    │   ├── Core.Logger.gs                  # Ghi AuditLog
    │   └── Core.Utils.gs                   # Hàm dùng chung (không nghiệp vụ)
    │
    ├── 02_Auth/
    │   ├── Auth.Session.gs                 # Xác định user hiện tại (Session.getActiveUser)
    │   ├── Auth.Permission.gs              # Kiểm tra RBAC
    │   └── Auth.Roles.gs                   # Truy vấn Role/Permission từ Sheet
    │
    ├── 03_Storage/
    │   ├── Storage.SheetRepository.gs      # Lớp truy cập Sheets (CRUD chung)
    │   ├── Storage.DriveRepository.gs      # Lớp truy cập Drive (folder/file)
    │   └── Storage.Schema.gs               # Định nghĩa tên Sheet, cột, hằng số schema
    │
    ├── 04_Document/
    │   ├── Document.Service.gs             # Nghiệp vụ quản lý văn bản
    │   ├── Document.Version.gs             # Quản lý phiên bản
    │   └── Document.Export.gs              # Xuất Word/PDF
    │
    ├── 05_Template/
    │   ├── Template.Service.gs             # Quản lý mẫu văn bản
    │   └── Template.Merge.gs               # Sinh văn bản theo mẫu (mail-merge)
    │
    ├── 06_RuleEngine/
    │   ├── RuleEngine.Core.gs              # Nạp & thực thi Rule (JSON-driven)
    │   ├── RuleEngine.DocxInspector.gs     # Đọc cấu trúc DOCX/Google Docs để kiểm tra thể thức
    │   └── Rules/                          # Rule mặc định dạng JSON (đồng bộ lên Drive khi Initialize)
    │       ├── Rule_NghiDinh30.json
    │       └── Rule_Document.json
    │
    ├── 07_Knowledge/
    │   ├── Knowledge.Library.gs            # Quản lý kho tri thức
    │   ├── Knowledge.Search.gs             # Tra cứu/tìm kiếm tài liệu
    │   └── Knowledge.Ingest.gs             # Nạp tài liệu mới vào kho tri thức
    │
    ├── 08_Workflow/
    │   ├── Workflow.Engine.gs              # Điều phối workflow cấu hình được
    │   └── Workflow.Approval.gs            # Bước phê duyệt
    │
    ├── 09_AIGateway/
    │   ├── AIGateway.Core.gs               # Điều phối gọi AI theo Provider đang cấu hình
    │   ├── AIGateway.Providers.Claude.gs
    │   ├── AIGateway.Providers.OpenAI.gs
    │   ├── AIGateway.Providers.Gemini.gs
    │   ├── AIGateway.Providers.OpenRouter.gs
    │   ├── AIGateway.Providers.Local.gs    # Ollama / LM Studio (qua endpoint HTTPS công khai)
    │   └── AIGateway.KeyVault.gs           # Mã hoá/giải mã API Key
    │
    ├── 10_OCR/
    │   └── OCR.Service.gs                  # Tính năng bổ sung — Google OCR / API OCR
    │
    ├── 11_Admin/
    │   ├── Admin.UserManagement.gs
    │   ├── Admin.AIConfig.gs
    │   └── Admin.SystemLog.gs
    │
    └── ui/                                 # HTML Service — giao diện
        ├── Index.html                      # Shell chính (SPA-like), sidebar + router phía client
        ├── css/
        │   └── main.html                   # <style> dùng chung, đóng gói qua include
        ├── js/
        │   └── main.html                   # <script> dùng chung
        └── views/
            ├── Dashboard.html
            ├── DocumentList.html
            ├── DocumentEditor.html
            ├── TemplateManager.html
            ├── KnowledgeLibrary.html
            ├── AIChat.html
            ├── WorkflowInbox.html
            └── AdminSettings.html
```

## Quy ước đặt tên file `.gs`

`<Module>.<TênChứcNăng>.gs` — giúp Apps Script Editor (vốn hiển thị file dạng danh sách phẳng, sắp xếp theo bảng chữ cái) tự nhóm các file cùng module lại gần nhau.

## Ghi chú triển khai với `clasp`

- Thư mục thật sự đẩy lên Apps Script là `src/` (cập nhật `rootDir` trong `.clasp.json` khi khởi tạo cấu trúc này).
- `docs/` không được push lên Apps Script (thêm vào `.claspignore`) — chỉ tồn tại trong Git.
- Mỗi file trong `06_RuleEngine/Rules/*.json` được đồng bộ vào Drive (`/AIOP_ROOT/System/Rules/`) bởi `Bootstrap.InitializeSystem.gs` khi chạy lần đầu, sau đó Rule Engine đọc từ Drive (cấu hình được) chứ không đọc trực tiếp file nguồn — đúng nguyên tắc "chỉ thay đổi Rule, không sửa mã nguồn" (mục 20 PROJECT_CONSTITUTION).
