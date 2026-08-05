# 08 — Rule Engine Design

## 1. Nguyên tắc

Theo mục 13 và 20 PROJECT_CONSTITUTION: mọi thứ kiểm tra được bằng lập trình thông thường (font, cỡ chữ, margin, numbering, heading, style, khoảng cách, tên file, metadata...) **không được dùng AI**. Rule Engine xử lý bằng mã nguồn thông thường, đọc quy tắc từ file JSON cấu hình được — sửa Rule không cần sửa mã nguồn.

## 2. Phạm vi kiểm tra được (giai đoạn 1)

| Loại tài liệu | Kiểm tra được | Ghi chú |
|---|---|---|
| Google Docs / DOCX | Font, cỡ chữ, giãn dòng, lề trang, căn lề, quốc hiệu/tiêu ngữ, số/ký hiệu văn bản, thẩm quyền ban hành, nơi nhận, chữ ký, ngày tháng | Đọc được cấu trúc qua Google Docs API/DocumentApp — DOCX được convert sang Google Docs khi upload để phân tích |
| PDF | Tên file, metadata cơ bản | Không kiểm tra được thể thức chi tiết (font/margin) vì PDF không giữ cấu trúc soạn thảo dễ trích xuất qua Apps Script — PDF chủ yếu dùng để lưu trữ/tra cứu tri thức, không phải đối tượng kiểm tra thể thức |
| Ảnh/Scan | Tên file, metadata | Không kiểm tra thể thức; nếu cần trích nội dung dùng OCR (tính năng bổ sung, xem [10-knowledge-design.md](10-knowledge-design.md)) |

## 3. Cấu trúc Rule (JSON)

Ví dụ `Rule_NghiDinh30.json` (rút gọn minh hoạ):

```json
{
  "ruleSetId": "ND30_FORMAT_V1",
  "name": "Thể thức văn bản hành chính theo NĐ 30/2020",
  "appliesTo": ["DOCX", "GOOGLE_DOC"],
  "version": 1,
  "rules": [
    {
      "id": "FONT_FAMILY",
      "description": "Toàn văn bản dùng font Times New Roman",
      "type": "FONT_CHECK",
      "params": { "allowedFonts": ["Times New Roman"] },
      "severity": "ERROR"
    },
    {
      "id": "FONT_SIZE_BODY",
      "description": "Cỡ chữ phần nội dung là 13-14pt",
      "type": "FONT_SIZE_CHECK",
      "params": { "scope": "BODY", "min": 13, "max": 14 },
      "severity": "ERROR"
    },
    {
      "id": "MARGIN",
      "description": "Lề trên/dưới 20-25mm, trái 30-35mm, phải 15-20mm",
      "type": "MARGIN_CHECK",
      "params": { "top": [20,25], "bottom": [20,25], "left": [30,35], "right": [15,20] },
      "severity": "ERROR"
    },
    {
      "id": "DOC_NUMBER_FORMAT",
      "description": "Số ký hiệu văn bản đúng định dạng Số: {n}/{năm}/{viết tắt cơ quan}-{viết tắt đơn vị}",
      "type": "REGEX_CHECK",
      "params": { "field": "docNumber", "pattern": "^Số:\\s*\\d+/[A-ZĐ\\-]+$" },
      "severity": "ERROR"
    },
    {
      "id": "NATIONAL_HEADER",
      "description": "Có Quốc hiệu - Tiêu ngữ trong các dòng đầu văn bản",
      "type": "STRUCTURE_CHECK",
      "params": { "requiredBlock": "NATIONAL_HEADER" },
      "severity": "ERROR"
    }
  ]
}
```

- `type` ánh xạ tới một hàm kiểm tra tương ứng trong `RuleEngine.Core.gs` (`FONT_CHECK`, `FONT_SIZE_CHECK`, `MARGIN_CHECK`, `REGEX_CHECK`, `STRUCTURE_CHECK`...) — thêm loại kiểm tra mới cần thêm handler code, nhưng **áp dụng/điều chỉnh tham số của rule hiện có không cần sửa code**.
- `severity`: `ERROR` (chặn không cho trình ký) hoặc `WARNING` (cảnh báo, vẫn cho qua).

## 4. Luồng thực thi

```
Document (Google Doc) ──► RuleEngine.DocxInspector.gs
                              │  (trích xuất: font map theo đoạn, margin, header/footer,
                              │   text các vùng cố định như số hiệu, nơi nhận...)
                              ▼
                     RuleEngine.Core.gs
                              │  nạp RuleSet JSON tương ứng (theo Library/loại văn bản)
                              │  chạy từng rule, gom kết quả
                              ▼
                 Danh sách lỗi: { ruleId, description, severity, location }
                              │
                              ▼
                    Hiển thị cho người dùng, chặn bước Phê duyệt nếu còn lỗi severity=ERROR
```

## 5. Rule Set theo lĩnh vực

Tên file gợi ý (đúng mục 20 PROJECT_CONSTITUTION):

- `Rule_NghiDinh30.json` — thể thức văn bản hành chính chung.
- `Rule_Document.json` — quy tắc chung về tên file, metadata, cấu trúc thư mục.
- `Rule_BenhVien.json` — quy tắc đặc thù của Bệnh viện Đông Sơn (nếu khác biệt so với chuẩn chung).
- `Rule_DauThau.json`, `Rule_KeToan.json` — quy tắc riêng theo từng kho tri thức chuyên môn, áp dụng khi Library đó bật kiểm tra thể thức riêng.

Mỗi Library có thể gán một hoặc nhiều Rule Set áp dụng (cấu hình trong `Libraries`/`Rules` sheet), không bắt buộc dùng chung một bộ rule cho toàn hệ thống.

## 6. Quản lý phiên bản Rule

- Mỗi lần Admin/Manager (được phân quyền `CanManage`) sửa Rule, hệ thống tăng `version`, lưu bản cũ vào `System/Rules/_history/` trên Drive, ghi `AuditLog`.
- Văn bản đã kiểm tra bằng version nào được lưu lại version đó trong `DocumentVersions` để tra cứu — tránh tình huống rule đổi sau khiến lịch sử kiểm tra bị hiểu sai.

## 7. Giới hạn đã biết

- Kiểm tra thể thức đầy đủ chỉ đáng tin cậy với DOCX/Google Docs. PDF/ảnh không kiểm tra thể thức chi tiết — Product Owner đã xác nhận chấp nhận giới hạn này (xem [99-bootstrap-report.md](99-bootstrap-report.md) mục 3, quyết định #3).
- `STRUCTURE_CHECK` (ví dụ `NATIONAL_HEADER`) ở Phase 1 chỉ kiểm tra **có tồn tại** đoạn văn bản quốc hiệu/tiêu ngữ trong các dòng đầu văn bản, **chưa kiểm tra bố cục 2 cột** (tên cơ quan ban hành bên trái, quốc hiệu-tiêu ngữ căn giữa bên phải theo đúng mẫu Nghị định 30/2020/NĐ-CP) — việc phát hiện bố cục bảng/cột chính xác phức tạp hơn đáng kể so với lợi ích ở Phase 1, chỉ xây khi có nhu cầu thực tế (mục 9 PROJECT_CONSTITUTION).
- Rule Engine không thay thế người kiểm tra thể thức theo quy định (mục 7, Nghị định 30/2020 — vẫn cần người chịu trách nhiệm) — đây là công cụ hỗ trợ, giảm sai sót, không phải công cụ pháp lý cuối cùng.
