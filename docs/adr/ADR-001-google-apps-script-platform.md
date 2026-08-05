# ADR-001: Chọn Google Apps Script làm nền tảng điều phối chính

- **Trạng thái**: Accepted
- **Ngày**: 2026-08-05
- **Người quyết định**: AI Chief Architect (theo uỷ quyền tại PROJECT_CONSTITUTION mục 7)

## Bối cảnh

Hệ thống cần phục vụ ~50 người dùng, 30–50 tài liệu/ngày, dữ liệu chủ yếu Word/PDF lưu trên Google Drive, ngân sách và nhu cầu vận hành ở quy mô một bệnh viện tuyến huyện/tỉnh. PROJECT_CONSTITUTION quy định rõ: ưu tiên đơn giản, không thêm hạ tầng nếu Google Workspace đáp ứng được, không xây Backend/Microservice riêng nếu chưa có nhu cầu thực tế.

## Các phương án xem xét

| Phương án | Mô tả | Ưu điểm | Nhược điểm |
|---|---|---|---|
| **A. Google Apps Script + Drive + Sheets** | Toàn bộ backend + frontend chạy trên Apps Script Web App, dữ liệu trên Drive/Sheets | Không cần server, không cần DevOps, miễn phí trong hạn mức Workspace, tích hợp Drive/Docs/Sheets native, cập nhật tập trung, người dùng chỉ cần trình duyệt | Giới hạn quota (6 phút/execution, 20.000 request/ngày với tài khoản thường), không phù hợp xử lý nặng/real-time |
| **B. Backend riêng (Node.js/Python) + PostgreSQL + Frontend React, đồng bộ với Drive** | Kiến trúc kiểu SaaS truyền thống | Không giới hạn quota, linh hoạt kỹ thuật cao | Cần VPS/hạ tầng, cần DevOps, chi phí vận hành, phức tạp hơn hẳn nhu cầu thực tế 50 người dùng |
| **C. Low-code platform (Retool/Appsheet) trên Google Workspace** | Dùng nền tảng low-code có sẵn | Triển khai nhanh | Phụ thuộc nhà cung cấp thứ ba, khó tuỳ biến Rule Engine/AI Gateway theo yêu cầu đặc thù văn bản hành chính VN, có thể phát sinh chi phí license |

## Quyết định

Chọn **Phương án A: Google Apps Script Web App** làm nền tảng điều phối chính, theo đúng mục 10 của PROJECT_CONSTITUTION.

- Google Apps Script (V8 runtime) là lớp điều phối (backend logic + API).
- HTML Service là lớp giao diện.
- Google Drive là nơi lưu tài liệu.
- Google Sheets là nơi lưu dữ liệu cấu hình và dữ liệu nghiệp vụ.
- AI Provider chỉ được gọi qua AI Gateway nội bộ (`UrlFetchApp`), không phụ thuộc một nhà cung cấp AI duy nhất.

## Hệ quả

**Tích cực**
- Không phát sinh chi phí VPS/Server/Docker.
- Người dùng dùng ngay bằng tài khoản Google Workspace đã cấp, không cài đặt gì.
- Toàn bộ cập nhật tập trung tại một Apps Script Project — mọi người luôn dùng bản mới nhất.
- Tận dụng tối đa hạ tầng đã có (Drive, Sheets, quyền truy cập theo domain).

**Đánh đổi / Giới hạn cần chấp nhận**
- Mỗi lần thực thi hàm bị giới hạn tối đa 6 phút (30 phút với Workspace) — các tác vụ xử lý AI/tài liệu lớn phải thiết kế dạng bất đồng bộ (trigger, chia nhỏ).
- Giới hạn `UrlFetchApp` và quota gọi dịch vụ Google mỗi ngày — cần theo dõi khi số lượng người dùng/tài liệu tăng.
- Google Sheets không phải là RDBMS thật sự — không có transaction, không có index mạnh, không phù hợp khi dữ liệu vượt quá vài trăm nghìn dòng/sheet. Đây là giới hạn đã được chấp nhận ở quy mô hiện tại (xem [12-storage-design.md](../12-storage-design.md) mục "Ngưỡng mở rộng").
- Không có khả năng chạy tác vụ nền dài hạn thật sự (chỉ có Time-driven Triggers, tối đa tần suất theo phút).

## Điểm sẽ xem xét lại quyết định này

Theo mục 10 của PROJECT_CONSTITUTION, chỉ bổ sung dịch vụ xử lý chuyên biệt khi có nhu cầu thực tế, ví dụ:
- Số tài liệu/ngày vượt quá ~500 hoặc số người dùng đồng thời vượt quá vài trăm.
- Cần xử lý AI thời gian thực có độ trễ thấp (streaming liên tục) mà Apps Script không đáp ứng tốt.
- Cần tìm kiếm ngữ nghĩa (vector search) trên khối lượng tài liệu lớn mà Sheets không còn phù hợp làm chỉ mục.

Khi đó, phương án bổ sung một dịch vụ xử lý chuyên biệt (ví dụ Cloud Function riêng cho vector index) sẽ được trình bày lại theo đúng quy trình tại mục 7 của PROJECT_CONSTITUTION (tối thiểu 2 phương án, ưu nhược điểm, khuyến nghị), không tự ý bổ sung.
