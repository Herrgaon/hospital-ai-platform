# 00 — Vision Document

## AI Office Platform — Intelligent Document & Knowledge Management Platform

---

## 1. Tầm nhìn

AI Office Platform là nền tảng hỗ trợ **xử lý văn bản** và **quản lý tri thức** dành cho bệnh viện, cơ quan nhà nước và doanh nghiệp Việt Nam.

Đây **không phải** một chatbot, và **không phải** một hệ sinh thái AI phức tạp. Đây là một nền tảng nghiệp vụ, trong đó AI là một dịch vụ hỗ trợ — không phải trung tâm của hệ thống.

Phiên bản đầu tiên triển khai tại **Bệnh viện Đa khoa Đông Sơn**, dùng làm môi trường hoàn thiện sản phẩm trước khi nhân rộng cho các đơn vị khác.

## 2. Vấn đề cần giải quyết

Trong vận hành hành chính hàng ngày tại bệnh viện, nhân viên văn thư, các khoa/phòng và ban lãnh đạo gặp phải:

| Vấn đề | Hệ quả |
|---|---|
| Soạn văn bản thủ công, lặp lại nhiều mẫu giống nhau | Tốn thời gian, dễ sai sót |
| Không có công cụ kiểm tra thể thức theo Nghị định 30/2020/NĐ-CP | Văn bản sai thể thức, phải sửa nhiều lần |
| Tài liệu nội bộ (quy định, hướng dẫn, biểu mẫu) nằm rải rác | Khó tra cứu, mất thời gian tìm kiếm |
| Không có lịch sử phiên bản rõ ràng | Nhầm lẫn bản cũ/bản mới |
| Quy trình duyệt văn bản thủ công qua giấy/email | Chậm, khó theo dõi trạng thái |
| Không có kênh hỏi đáp nhanh về quy định nội bộ | Nhân viên hỏi lại nhiều lần, làm phiền người quản lý |

## 3. Giải pháp

Một nền tảng web, chạy trên nền **Google Workspace** sẵn có của đơn vị, cho phép:

- Quản lý và sinh văn bản theo mẫu chuẩn.
- Tự động kiểm tra thể thức, lỗi trình bày bằng **Rule Engine** (không dùng AI cho việc máy móc kiểm tra được).
- Xây dựng kho tri thức nội bộ theo từng lĩnh vực (văn thư, dược, đấu thầu, điều dưỡng...).
- Hỏi đáp, tra cứu quy định/biểu mẫu bằng AI dựa trên chính tài liệu nội bộ.
- Vận hành quy trình upload → kiểm tra → phê duyệt → xuất bản có kiểm soát phiên bản và nhật ký.

## 4. Đối tượng sử dụng

- **Văn thư / Hành chính tổng hợp**: soạn thảo, quản lý văn bản đi/đến, kiểm tra thể thức.
- **Lãnh đạo khoa/phòng, Ban Giám đốc**: phê duyệt, tra cứu, chỉ đạo điều hành.
- **Nhân viên các khoa/phòng** (điều dưỡng, dược, kế toán, CNTT...): tra cứu quy định, biểu mẫu, quy trình nội bộ.
- **Quản trị viên hệ thống (Admin/IT)**: cấu hình AI, phân quyền, quản lý danh mục, giám sát nhật ký.

## 5. Giá trị mang lại

- Giảm thời gian soạn thảo và kiểm tra văn bản.
- Giảm sai sót thể thức nhờ kiểm tra tự động, nhất quán.
- Tập trung hóa tri thức nội bộ, dễ tra cứu, dễ kiểm soát phiên bản.
- Không phát sinh chi phí hạ tầng mới — tận dụng Google Workspace đã có.
- Kiến trúc đủ linh hoạt để nhân rộng cho đơn vị khác mà không viết lại hệ thống.

## 6. Ngoài phạm vi (Out of Scope) giai đoạn đầu

- Không xây dựng OCR Engine riêng — chỉ dùng dịch vụ OCR có sẵn (Google OCR/API OCR) khi cần.
- Không xây dựng hệ thống quản lý bệnh án điện tử (EMR/HIS) — đây là nền tảng văn bản & tri thức hành chính, không phải hệ thống lâm sàng.
- Không xây dựng hạ tầng Enterprise (Microservice, Message Queue, Cache riêng, Event Bus) khi chưa có nhu cầu thực tế đã được chứng minh.
- Không tích hợp chữ ký số / hoá đơn điện tử trong giai đoạn đầu (có thể xem xét ở giai đoạn sau).

## 7. Nguyên tắc dẫn dắt

Đơn giản → Ổn định → Dễ sử dụng → Dễ bảo trì → Dễ mở rộng → Hiệu năng → Chi phí thấp.

Xem chi tiết triết lý thiết kế tại [PROJECT_CONSTITUTION](../PROJECT_CONSTITUTION.md) mục 4, và quyết định kiến trúc nền tảng tại [ADR-001](adr/ADR-001-google-apps-script-platform.md).

## 8. Định nghĩa thành công (giai đoạn 1 — Đông Sơn)

- Hệ thống được ~50 người dùng tại bệnh viện sử dụng ổn định hàng ngày.
- Xử lý được 30–50 tài liệu mới/ngày mà không lỗi, không mất dữ liệu.
- Thời gian soạn một văn bản theo mẫu giảm rõ rệt so với thao tác thủ công trên Word.
- Tỷ lệ văn bản sai thể thức giảm nhờ kiểm tra tự động trước khi trình ký.
- Không phát sinh chi phí hạ tầng ngoài Google Workspace và chi phí gọi AI Provider.
