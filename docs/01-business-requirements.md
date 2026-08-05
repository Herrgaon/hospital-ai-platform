# 01 — Business Requirements Document (BRD)

## 1. Bối cảnh nghiệp vụ

Bệnh viện Đa khoa Đông Sơn vận hành hành chính hàng ngày với khối lượng văn bản đi/đến, quy định nội bộ, biểu mẫu chuyên môn (dược, đấu thầu, điều dưỡng, kế toán, CNTT...) tương đối lớn so với quy mô nhân sự văn thư. Ban Giám đốc mong muốn số hoá và chuẩn hoá quy trình soạn thảo — kiểm tra — phê duyệt — lưu trữ — tra cứu văn bản, tận dụng hạ tầng Google Workspace đã có, không phát sinh chi phí hạ tầng mới.

## 2. Mục tiêu nghiệp vụ

| Mục tiêu | Chỉ số đo lường |
|---|---|
| Chuẩn hoá thể thức văn bản theo Nghị định 30/2020/NĐ-CP | ≥ 90% văn bản qua kiểm tra Rule Engine đạt chuẩn ngay lần đầu sau 3 tháng sử dụng |
| Rút ngắn thời gian soạn văn bản lặp lại | Giảm thời gian soạn thảo văn bản theo mẫu so với thao tác thủ công trên Word |
| Tập trung hoá tri thức nội bộ | 100% quy định/biểu mẫu đang lưu rải rác được đưa vào kho tri thức trong 6 tháng đầu |
| Minh bạch hoá quy trình phê duyệt | Mọi văn bản trình ký đều có nhật ký trạng thái tra cứu được |
| Không phát sinh chi phí hạ tầng ngoài dự kiến | Chi phí vận hành = phí Google Workspace hiện có + chi phí gọi AI Provider (theo dõi được, có thể tắt) |

## 3. Các bên liên quan (Stakeholders)

| Vai trò | Lợi ích quan tâm |
|---|---|
| Ban Giám đốc | Kiểm soát, phê duyệt, báo cáo tổng quan |
| Phòng Hành chính – Văn thư | Công cụ chính soạn thảo, kiểm tra, quản lý văn bản đi/đến |
| Trưởng/phó các khoa, phòng | Tra cứu quy định, phê duyệt văn bản trong phạm vi phụ trách |
| Nhân viên các khoa/phòng | Tra cứu biểu mẫu, hướng dẫn, hỏi đáp nhanh |
| Phòng CNTT (Admin hệ thống) | Cấu hình, phân quyền, giám sát, bảo trì |
| Product Owner (đại diện Bệnh viện) | Quyết định phạm vi, ưu tiên, phê duyệt tài liệu thiết kế |

## 4. Yêu cầu nghiệp vụ theo nhóm

### 4.1 Văn bản
- BR-01: Người dùng phải soạn được văn bản mới từ mẫu có sẵn, điền thông tin và sinh file Word hoàn chỉnh.
- BR-02: Hệ thống phải tự động kiểm tra thể thức (font, cỡ chữ, lề, dòng, quốc hiệu, số hiệu, thẩm quyền ban hành...) trước khi trình ký.
- BR-03: Người dùng phải so sánh được hai phiên bản văn bản để thấy phần thay đổi.
- BR-04: Hệ thống phải chuẩn hoá văn bản (tên file, định dạng, cấu trúc thư mục lưu trữ) theo quy tắc cấu hình được.

### 4.2 Tri thức
- BR-05: Mỗi đơn vị/khoa phòng có thể có kho tri thức riêng, có người quản lý và phân quyền riêng.
- BR-06: Người dùng phải tra cứu được quy định, biểu mẫu, hướng dẫn bằng từ khoá hoặc câu hỏi tự nhiên.
- BR-07: Hệ thống phải trả lời câu hỏi dựa trên chính tài liệu nội bộ (không bịa nội dung ngoài tài liệu).

### 4.3 AI hỗ trợ
- BR-08: AI chỉ hỗ trợ các việc ngôn ngữ tự nhiên (giải thích, viết, tóm tắt, phân tích, sinh nội dung) — không dùng AI để kiểm tra định dạng máy móc.
- BR-09: Khi AI không khả dụng (chưa cấu hình hoặc tắt), các chức năng không dùng AI vẫn phải hoạt động bình thường.

### 4.4 Quy trình (Workflow)
- BR-10: Văn bản phải đi qua quy trình Upload → Kiểm tra → (AI hỗ trợ nếu cần) → Chỉnh sửa → Phê duyệt → Xuất bản, có thể cấu hình lại theo từng loại văn bản/đơn vị.
- BR-11: Mỗi bước duyệt phải ghi nhận người duyệt, thời gian, ý kiến (nếu có).

### 4.5 Quản trị & Bảo mật
- BR-12: Chỉ Admin được cấu hình AI Provider, API Key, phân quyền hệ thống.
- BR-13: Mọi thao tác nhạy cảm (đăng nhập, xoá, đổi quyền, đổi cấu hình AI) phải được ghi log, tra cứu và xuất được ra Excel.
- BR-14: Hệ thống phải hoạt động qua trình duyệt, dùng tài khoản Google Workspace đã được cấp — không cài đặt phần mềm.

## 5. Ràng buộc (Constraints)

- Quy mô ban đầu: ~50 người dùng, 30–50 tài liệu mới/ngày.
- Dữ liệu lưu trên Google Drive, cấu hình/dữ liệu nghiệp vụ đơn giản lưu trên Google Sheets.
- Không xây Backend riêng, không Microservice, không hạ tầng Enterprise khi chưa cần thiết (xem [ADR-001](adr/ADR-001-google-apps-script-platform.md)).
- Tuân thủ Nghị định 30/2020/NĐ-CP về thể thức văn bản hành chính.
- OCR là tính năng bổ sung, không phải yêu cầu bắt buộc ở giai đoạn đầu.

## 6. Giả định (Assumptions)

- Bệnh viện đã có Google Workspace (hoặc tương đương) với domain quản lý được.
- Người dùng có tài khoản Google được cấp bởi phòng CNTT.
- Có sẵn ngân sách nhỏ để trả phí gọi AI Provider theo usage (không bắt buộc, hệ thống vẫn chạy được nếu tắt AI).

## 7. Rủi ro nghiệp vụ

| Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|
| Người dùng không quen giao diện mới, ngại thay đổi thói quen dùng Word/giấy | Trung bình | UI đơn giản, đúng tư duy Word quen thuộc; đào tạo ngắn |
| Rule Engine kiểm tra sai/thiếu quy tắc thực tế của bệnh viện | Trung bình | Rule cấu hình được (JSON), điều chỉnh nhanh không cần sửa code |
| Chi phí AI Provider phát sinh ngoài kiểm soát | Thấp–Trung bình | Giới hạn Max Tokens/Timeout, theo dõi usage, Admin bật/tắt được |
| Google Apps Script giới hạn quota khi số lượng tài liệu tăng nhanh | Thấp (ở quy mô hiện tại) | Theo dõi, có điểm mở rộng đã xác định tại ADR-001 |

## 8. Tiêu chí nghiệm thu ở mức nghiệp vụ

- Văn thư soạn và xuất được một văn bản hành chính hoàn chỉnh từ mẫu trong vòng vài phút.
- Một văn bản sai thể thức bị Rule Engine phát hiện và chỉ rõ lỗi cụ thể (không chỉ báo "sai" chung chung).
- Một câu hỏi tra cứu quy định trả lời đúng, kèm trích dẫn nguồn tài liệu nội bộ.
- Toàn bộ quy trình phê duyệt một văn bản mẫu có thể tái hiện và tra cứu lại đầy đủ nhật ký.
