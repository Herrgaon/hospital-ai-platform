# 07 — Workflow Design

## 1. Nguyên tắc

Workflow phải cấu hình được, không hard-code (mục 22 PROJECT_CONSTITUTION). Một Workflow là một chuỗi bước (Step) áp dụng cho một loại văn bản/Library cụ thể.

## 2. Workflow mặc định

```
Upload → Kiểm tra Rule → AI (nếu cần) → Người dùng chỉnh sửa → Phê duyệt → Xuất Word
```

| Bước | Mô tả | Bắt buộc? | Ai thực hiện |
|---|---|---|---|
| Upload | Tải văn bản lên hoặc tạo từ Template | Có | User |
| Kiểm tra Rule | Rule Engine kiểm tra thể thức, trả lỗi nếu có | Có | Hệ thống (tự động) |
| AI (nếu cần) | Người dùng chủ động gọi AI hỗ trợ viết/tóm tắt/giải thích | Không | User (tuỳ chọn) |
| Người dùng chỉnh sửa | Sửa theo lỗi Rule Engine hoặc góp ý | Có (nếu có lỗi ERROR) | User |
| Phê duyệt | Người có quyền `CanApprove` trên Library duyệt/từ chối | Tuỳ cấu hình Workflow | Manager/Admin |
| Xuất Word | Sinh file Word/PDF cuối cùng, đánh dấu phiên bản chính thức | Có | Hệ thống (tự động sau khi duyệt) |

## 3. Cấu trúc dữ liệu Workflow (JSON, lưu trong `Workflows.StepsDefinition`)

```json
{
  "workflowId": "WF_DEFAULT",
  "name": "Quy trình văn bản hành chính mặc định",
  "scope": { "libraryId": "*" },
  "steps": [
    { "id": "UPLOAD", "type": "UPLOAD", "next": "RULE_CHECK" },
    { "id": "RULE_CHECK", "type": "RULE_CHECK", "onError": "EDIT", "onPass": "EDIT" },
    { "id": "EDIT", "type": "USER_EDIT", "next": "APPROVAL", "allowAIAssist": true },
    { "id": "APPROVAL", "type": "APPROVAL", "approverRole": "Manager",
      "onApprove": "EXPORT", "onReject": "EDIT" },
    { "id": "EXPORT", "type": "EXPORT_WORD", "next": null }
  ]
}
```

- `type` ánh xạ tới handler trong `Workflow.Engine.gs`/`Workflow.Approval.gs`.
- Mỗi Library có thể gán Workflow riêng (ví dụ Đấu thầu cần 2 cấp phê duyệt) — thêm bước `APPROVAL` nối tiếp, không cần sửa code.

## 4. Trạng thái Workflow Instance

```
DRAFT → CHECKING → NEEDS_EDIT → PENDING_APPROVAL → APPROVED → PUBLISHED
                                        │
                                        └──► REJECTED → NEEDS_EDIT
```

Lưu tại `WorkflowInstances.Status`, mỗi lần chuyển trạng thái ghi 1 dòng vào `WorkflowStepLog` (ai, hành động, ý kiến, thời gian) — phục vụ BR-11 và yêu cầu minh bạch quy trình.

## 5. Đa cấp phê duyệt

Hỗ trợ nhiều bước `APPROVAL` liên tiếp trong cùng Workflow (ví dụ: Trưởng khoa duyệt → Ban Giám đốc duyệt) bằng cách khai báo nhiều step `APPROVAL` nối tiếp nhau với `approverRole`/`approverUserId` khác nhau. Không cần cơ chế riêng ngoài Rule Engine kiểu step-chain đã có.

## 6. Thông báo

- Khi có văn bản chờ duyệt trong phạm vi phụ trách: hiển thị trong "Workflow Inbox" (view riêng trong UI) + Gmail notification qua `MailApp`/`GmailApp` (đã sẵn có trong Workspace, không thêm hạ tầng).
- Tần suất: theo thời gian thực khi action xảy ra trong phiên làm việc; với trigger nền dùng Time-driven Trigger gom thông báo (tránh spam email).

## 7. Liên hệ thiết kế khác

- Kiểm tra quyền `CanApprove`: [11-permission-design.md](11-permission-design.md).
- Bước RULE_CHECK gọi [08-rule-engine.md](08-rule-engine.md).
- Bước cho phép AI hỗ trợ gọi [09-ai-design.md](09-ai-design.md), không bắt buộc.
