# 10 — Knowledge Design

## 1. Khái niệm

**Kho tri thức (Knowledge Library)**: một tập hợp tài liệu nội bộ thuộc một lĩnh vực/đơn vị, có người quản lý, danh mục, quyền truy cập, nhật ký, phiên bản riêng — đúng mục 18 PROJECT_CONSTITUTION.

Ví dụ tại Bệnh viện Đông Sơn: Văn thư, Đấu thầu, Dược, Kế toán, CNTT, Điều dưỡng, Công tác xã hội, Pháp luật, Biểu mẫu, Cá nhân (không gian riêng của mỗi người dùng).

## 2. Cấu trúc một Library

```
Library
├── LibraryID, Tên, Mô tả
├── Người quản lý (Manager) — 1 hoặc nhiều UserID
├── Danh mục (Categories) — cây phân cấp, ví dụ:
│     Dược
│     ├── Quy trình cấp phát thuốc
│     ├── Danh mục thuốc
│     └── Văn bản quy định dược
├── Quyền truy cập — theo Permissions (xem 11-permission-design.md)
├── Nhật ký — mọi thao tác upload/sửa/xoá/duyệt trong Library
└── Tài liệu — mỗi tài liệu có phiên bản, trạng thái, loại file
```

Ánh xạ 1-1 với 1 thư mục Drive tại `/AIOP_ROOT/Libraries/{LibraryName}/` (xem [12-storage-design.md](12-storage-design.md)).

## 3. Vòng đời một tài liệu trong kho tri thức

```
Upload (DOCX/DOC/PDF/Ảnh/TXT)
        │
        ▼
Knowledge.Ingest.gs#stageUploadForClassification — lưu tạm vào Uploads/_Inbox
   - Convert DOCX/DOC → Google Docs (để đọc được nội dung)
   - Duplicate Check (Level 1 — Hash SHA256, xem mục 10)
   - Document Parser + Metadata Extraction, KHÔNG dùng AI (xem mục 9)
   - Rule Engine phân loại theo tên file (Knowledge.ClassificationRules.gs), KHÔNG dùng AI
   - AI chỉ bù các trường Rule chưa xác định được (Knowledge.ClassificationAI.gs), kèm Confidence
     Score riêng từng trường
   - So khớp ngưỡng Auto-Accept (Admin cấu hình, mặc định 90%) — dưới ngưỡng phải người dùng xác nhận
        │
        ▼
Màn hình xác nhận Metadata (Library/Category/Tags/Applicable Departments/...) — người dùng luôn
được sửa/thêm/xoá, giá trị người dùng luôn thắng AI
        │
        ▼
Knowledge.Ingest.gs#confirmClassificationAndSave — chuyển file vào đúng Library, ghi Documents
        │
        ▼
Knowledge Governance (xem mục 11) — PENDING_REVIEW (hoặc PUBLISHED thẳng nếu Library không yêu cầu
duyệt) → người quản lý kho Duyệt/Từ chối
        │
        ▼
CHỈ khi Status = PUBLISHED: sẵn sàng cho Tra cứu / AI Chat / Rà soát pháp lý
```

Cập nhật tài liệu (upload đè/sửa) → tạo `DocumentVersions` mới, `Documents.CurrentVersion` trỏ bản mới nhất, bản cũ vẫn truy xuất được qua Drive revision.

## 4. Tra cứu tri thức

Ba hình thức, theo mục 2 PROJECT_CONSTITUTION (Tra cứu quy định / biểu mẫu / hướng dẫn):

| Hình thức | Cơ chế |
|---|---|
| Tìm kiếm từ khoá | `Knowledge.Search.gs` — tìm trên tiêu đề, tag, nội dung (Drive full-text search) trong phạm vi Library người dùng có quyền xem |
| Duyệt theo danh mục | Cây Category, giống Explorer quen thuộc |
| Hỏi đáp tự nhiên (AI) | Xem [09-ai-design.md](09-ai-design.md) mục 5 — trả lời kèm trích dẫn nguồn |

## 5. Quản lý phiên bản

- Nguồn sự thật nội dung: **Drive revision history**.
- Nguồn sự thật metadata phiên bản (ai, khi nào, ghi chú thay đổi): `DocumentVersions` sheet.
- Người dùng xem được lịch sử phiên bản và **so sánh hai phiên bản** (chức năng "So sánh văn bản" tại mục 2 PROJECT_CONSTITUTION) — dùng Google Docs API để lấy nội dung text hai revision rồi diff theo đoạn/câu.

## 6. OCR — tính năng bổ sung

Theo mục 17: OCR không phải thành phần cốt lõi.

```
Ưu tiên 1: Google OCR (Drive.Files.insert với ocr=true / Advanced Drive Service)
Ưu tiên 2: API OCR bên thứ ba (chỉ khi Google OCR không đáp ứng, cần đánh giá theo mục 12 — license, rò rỉ dữ liệu)
Ưu tiên 3: Giải pháp khác — chỉ xem xét khi có nhu cầu thực tế cụ thể
```

Không tự xây OCR Engine. OCR chỉ kích hoạt theo yêu cầu (nút "Trích văn bản từ ảnh/scan"), không chạy ngầm mặc định cho mọi file để tránh phát sinh chi phí/độ trễ không cần thiết.

## 7. Không gian cá nhân ("Cá nhân")

Mỗi người dùng có một Library cá nhân mặc định (tự động tạo khi tài khoản được kích hoạt) — nơi lưu nháp, tài liệu chưa muốn chia sẻ. Không tính vào kho tri thức chung, không xuất hiện trong tra cứu của người khác.

## 9. Phân loại tài liệu tự động (Document Ingestion & Knowledge Classification)

Product Owner mô tả chi tiết ngày 2026-08-05. Nguyên tắc cốt lõi: **Rule Engine luôn ưu tiên trước AI** — chỉ gọi AI cho trường Rule không xác định được; AI không có quyền tự quyết định phân loại cuối cùng.

- Rule: `Knowledge.ClassificationRules.gs`, cấu hình JSON `Rule_Classification.json` (regex/từ khoá tên file → Library/Category/DocumentType/Issuer). Sửa rule không cần sửa code.
- AI: `Knowledge.ClassificationAI.gs` — chỉ đọc tên file + heading + ~6000 ký tự đầu (KHÔNG đọc toàn bộ tài liệu mặc định), trả JSON có Confidence từng trường.
- Ngưỡng tự động chấp nhận: `Core.Config.gs#getClassificationThreshold` (Admin cấu hình tại Admin → Cấu hình AI, mặc định 90%).
- Metadata mở rộng lưu trực tiếp trên `Documents` (SubCategory, DocumentType, Issuer, ApplicableDepartments, Tags, Keywords, Summary, Language, FileHash, OcrStatus, AiConfidence, Importance) — xem [12-storage-design.md](12-storage-design.md).
- Phản hồi khi người dùng sửa lại gợi ý AI được ghi vào sheet `ClassificationFeedback` (Admin có thể xem để đánh giá AI Accuracy sau này) — **không tự động fine-tune model, không tự sửa Rule**.
- **Đơn giản hoá so với mô tả gốc (YAGNI)**: chưa xây Knowledge Scope theo Context Profile (vai trò/đơn vị công tác) hay lịch sử 30 ngày — hiện chỉ có gợi ý theo từ khoá tức thời (`Knowledge.Review.gs#suggestLibrariesForText_`), dùng chung cho cả gợi ý kho khi rà soát pháp lý và khi hỏi đáp AI Chat.

## 10. Phát hiện trùng lặp tài liệu

Chỉ triển khai **Level 1 — Hash Check** (SHA-256, xem `Knowledge.Ingest.gs#findDocumentByHash_`): trùng tuyệt đối nội dung file thì cảnh báo trước khi lưu, người dùng chọn Huỷ hoặc vẫn tiếp tục. **Chưa triển khai** (đơn giản hoá — YAGNI, chờ nhu cầu thực tế): so khớp số hiệu văn bản, độ giống tiêu đề/nội dung theo %, AI semantic dedup, workflow thay thế phiên bản (Replace/Keep parallel/Expire) và phân tích tác động (bao nhiêu tài liệu khác bị ảnh hưởng).

## 11. Knowledge Governance (duyệt tri thức)

Product Owner mô tả một quy trình đầy đủ (Uploader → nhiều Reviewer bỏ phiếu đa số/đồng thuận theo từng Library cấu hình số lượng tối thiểu → Knowledge Manager phê duyệt → Quality Score/Trust Level ảnh hưởng thứ tự tìm kiếm của AI). **Đã đơn giản hoá còn 1 cấp duyệt** (Product Owner xác nhận 2026-08-05): người có quyền `CanApprove` trên Library đó (thường là Trưởng khoa/phòng phụ trách kho — xem [11-permission-design.md](11-permission-design.md)) duyệt trực tiếp, không có bước bỏ phiếu nhiều người. Lý do: quy mô ~50 người dùng, phần lớn kho chỉ có 1 người phụ trách thực tế nên quorum nhiều Reviewer không khả thi để vận hành.

- Trạng thái tài liệu tri thức: `PENDING_REVIEW` → `PUBLISHED` (duyệt) hoặc `NEEDS_EDIT` (từ chối, kèm lý do bắt buộc).
- **Chỉ tài liệu `PUBLISHED` được AI dùng làm ngữ cảnh** (`Knowledge.Search.gs#askKnowledgeBase`, `Knowledge.Review.gs#reviewDocumentAgainstLibraries`) — đúng nguyên tắc "AI không tự quyết định tri thức chính thức".
- Mỗi Library có cờ `RequiresReview` (Admin cấu hình khi tạo kho) — kho rủi ro thấp có thể bỏ qua bước duyệt, Published ngay khi Uploader xác nhận.
- Quality Score / Trust Level / multi-reviewer / Rule Improvement Candidate tự động đề xuất: **chưa xây**, ghi nhận là điểm mở rộng tương lai khi có nhu cầu thực tế.

## 12. Liên hệ thiết kế khác

- Phân quyền theo Library: [11-permission-design.md](11-permission-design.md).
- Kiểm tra thể thức khi tài liệu là văn bản hành chính: [08-rule-engine.md](08-rule-engine.md).
- Lưu trữ vật lý: [12-storage-design.md](12-storage-design.md).
