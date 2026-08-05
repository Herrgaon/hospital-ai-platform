# 09 — AI Design

## 1. Vai trò của AI trong hệ thống

Theo mục 13 PROJECT_CONSTITUTION: **AI không phải trung tâm hệ thống**, chỉ là dịch vụ hỗ trợ, dùng cho: giải thích, hỏi đáp, viết lại, tóm tắt, sinh nội dung, phân tích, gợi ý, phân loại, dịch thuật. Mọi việc kiểm tra máy móc thuộc về [Rule Engine](08-rule-engine.md), không gọi AI.

## 2. Kiến trúc AI Gateway (Provider Pattern)

```
Service (Document/Knowledge/Chat...) 
        │  gọi duy nhất qua interface chung
        ▼
   AIGateway.Core.gs
        │  đọc AIProviderConfig đang active (Sheet)
        │  chọn adapter theo ProviderName
        ▼
┌───────┴──────────────────────────────────────────┐
│ AIGateway.Providers.Claude.gs                     │
│ AIGateway.Providers.OpenAI.gs                     │
│ AIGateway.Providers.Gemini.gs                      │
│ AIGateway.Providers.OpenRouter.gs                  │
│ AIGateway.Providers.Local.gs (Ollama / LM Studio)  │
└───────┬──────────────────────────────────────────┘
        │  UrlFetchApp → REST API của Provider tương ứng
        ▼
   AI Provider (bên ngoài)
```

- **Không module nghiệp vụ nào gọi trực tiếp API AI Provider** — luôn qua `AIGateway.Core.gs`, đúng mục 14.
- Mỗi adapter chỉ có trách nhiệm: dựng request đúng format của Provider, gọi `UrlFetchApp`, chuẩn hoá response về một cấu trúc chung `{ text, usage, raw }`.
- Đổi Provider = đổi cấu hình trong `AIProviderConfig`, không sửa mã nguồn Service.

**Quyết định Product Owner (2026-08-05)**: Giai đoạn đầu triển khai tại Đông Sơn **chỉ kích hoạt Claude** (`AIProviders.claude.IsActive = true`, phù hợp với Claude Pro sẵn có — mạnh về lập trình, phân tích tài liệu, viết văn bản, RAG). Các adapter OpenAI/Gemini/OpenRouter/Local vẫn tồn tại trong mã nguồn (kiến trúc Provider Pattern đã sẵn sàng) nhưng ở trạng thái `IsActive = false` — bật thêm Provider sau này chỉ cần đổi dữ liệu cấu hình, không sửa code.

## 3. Interface chung của AI Gateway

Mọi Service gọi AI qua một hàm duy nhất dạng:

```
AIGateway.run({
  task: "SUMMARIZE" | "EXPLAIN" | "REWRITE" | "GENERATE" | "ANALYZE" | "QA" | "CLASSIFY" | "TRANSLATE",
  input: string | { context, question, ... },
  options: { temperature?, maxTokens?, timeout? }   // override cấu hình mặc định nếu cần
})
→ { success, text, usage, error }
```

- Nếu `AI_ENABLED = false` hoặc chưa cấu hình Provider hợp lệ: trả `{ success: false, error: "AI_NOT_CONFIGURED" }` — Service phải xử lý được trường hợp này mà không crash (đúng BR-09/mục 15: hệ thống vẫn hoạt động khi tắt AI).
- Timeout và MaxTokens luôn lấy từ cấu hình Admin, có thể override thấp hơn (không được override cao hơn) từ phía Service để tránh lạm dụng.

## 4. Danh sách chức năng dùng AI (và chỉ các chức năng này)

| Chức năng | Task | Mô tả |
|---|---|---|
| AI Chat | QA | Hỏi đáp tự do, có thể kèm ngữ cảnh tài liệu đang mở |
| Hỏi đáp theo tài liệu (RAG cơ bản) | QA | Trả lời dựa trên nội dung tài liệu trong kho tri thức, kèm trích dẫn nguồn |
| Hỗ trợ viết | GENERATE / REWRITE | Soạn thảo/viết lại đoạn văn bản theo yêu cầu |
| Hỗ trợ giải thích | EXPLAIN | Giải thích thuật ngữ, quy định |
| Hỗ trợ phân tích | ANALYZE | Phân tích nội dung văn bản (ví dụ so sánh ý chính) |
| **Rà soát căn cứ pháp lý theo kho tự chọn** | ANALYZE | Người dùng tự chọn 1 hoặc nhiều kho tri thức làm căn cứ đối chiếu (ví dụ văn bản hồ sơ thầu → chỉ chọn kho "Đấu thầu"), AI chỉ ra căn cứ pháp lý thiếu/sai/lỗi thời. Có gợi ý sơ bộ kho phù hợp (heuristic khớp tên kho với tiêu đề văn bản — xem `Knowledge.Review.gs`), người dùng luôn tự chọn lại được. Quyết định Product Owner 2026-08-05: giới hạn phạm vi kho giúp kết quả nhanh hơn, chính xác hơn, tiết kiệm chi phí AI hơn so với quét toàn hệ thống. |
| Hỗ trợ tóm tắt | SUMMARIZE | Tóm tắt văn bản dài |
| Sinh nội dung theo mẫu (khi Template cần đoạn tự do) | GENERATE | Sinh phần nội dung không cấu trúc cứng trong Template |
| Phân loại tài liệu khi upload (gợi ý Library/Category) | CLASSIFY | Chỉ gợi ý — người dùng luôn xác nhận lại, không tự động di chuyển file |

## 5. Retrieval cho "Hỏi đáp theo tài liệu"

Ở quy mô 50 người dùng / vài nghìn tài liệu, **không cần vector database riêng** (đúng mục 9 — không thêm hạ tầng khi chưa cần):

```
Câu hỏi người dùng
        │
        ▼
Knowledge.Search.gs: lọc ứng viên bằng tìm kiếm từ khoá/metadata
   trên Sheet Documents + Google Drive full-text search (DriveApp/Advanced Drive Service)
        │  (giới hạn top-N tài liệu liên quan nhất theo Library đang chọn)
        ▼
Trích đoạn nội dung liên quan (chunk theo đoạn/heading)
        │
        ▼
AIGateway.run({ task: "QA", input: { context: <đoạn trích>, question } })
        │
        ▼
Trả lời kèm trích dẫn tên tài liệu + đường dẫn Drive
```

Nếu chất lượng tìm kiếm từ khoá không đủ tốt khi kho tri thức lớn dần, đây là điểm mở rộng đã xác định (xem [12-storage-design.md](12-storage-design.md) mục 5) — không xây trước khi cần.

## 6. Cấu hình AI (chỉ Admin)

Theo mục 15 PROJECT_CONSTITUTION, chỉ Admin được: thêm API Key, đổi Provider, chọn Model, chỉnh Temperature/MaxTokens/Timeout, bật/tắt AI.

| Trường | Ràng buộc |
|---|---|
| API Key | Lưu qua `AIGateway.SecretStore.gs` (PropertiesService ở giai đoạn đầu — xem [13-security.md](13-security.md) mục 4), Sheet chỉ giữ con trỏ `ApiKeySecretRef`, không hiển thị đầy đủ trên UI (chỉ hiện 4 ký tự cuối), có lịch sử thay đổi (`AIProviderKeyHistory`) |
| Provider | Enum theo `AIProviders` sheet |
| Model | Text, theo danh sách model Provider hỗ trợ (validate ở tầng UI, không hard-code cứng trong code để dễ thêm model mới) |
| Temperature | 0.0 - 1.0 |
| Max Tokens | Giới hạn trên theo Provider, có giá trị mặc định an toàn |
| Timeout | Tối đa phù hợp với giới hạn 6 phút/execution của Apps Script (khuyến nghị ≤ 60s cho tác vụ đồng bộ trong request người dùng) |

## 7. Kiểm soát chi phí

- Giới hạn Max Tokens mặc định thấp, tăng dần theo nhu cầu thực tế.
- Ghi nhận `usage` (số token ước tính hoặc theo Provider trả về) vào `AuditLog`/bảng usage riêng nếu cần theo dõi chi phí theo thời gian — bổ sung khi có nhu cầu thực tế, không xây sẵn dashboard chi phí phức tạp ở giai đoạn 1.
- Admin có nút tắt AI toàn hệ thống ngay lập tức trong tình huống phát sinh chi phí bất thường.

## 8. Giới hạn hạ tầng cần lưu ý

- `UrlFetchApp` chỉ gọi được endpoint HTTPS công khai — Provider cục bộ (Ollama, LM Studio) cần một cổng công khai (ví dụ Cloudflare Tunnel) mới dùng được từ Apps Script. **Quyết định Product Owner (2026-08-05): không triển khai Provider cục bộ ở giai đoạn đầu** — không có lý do thực tế để dùng khi đã có Claude Pro và quy mô chỉ ~50 người dùng. Adapter `AIGateway.Providers.Local.gs` vẫn giữ trong mã nguồn cho nhu cầu tương lai, nhưng không kích hoạt.
- Một lệnh gọi AI đồng bộ trong request người dùng nên hoàn thành trong vài chục giây để không ảnh hưởng trải nghiệm — tác vụ AI dài (ví dụ tóm tắt tài liệu rất dài) nên dùng mẫu bất đồng bộ tại [05-architecture.md](05-architecture.md) mục 5.
