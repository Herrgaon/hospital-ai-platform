# 13 — Security Design

Bảo mật là yêu cầu mặc định, không phải tính năng bổ sung (mục 24 PROJECT_CONSTITUTION).

## 1. Authentication

- Dùng cơ chế đăng nhập Google Workspace có sẵn — Apps Script Web App deploy với "Execute as: User accessing the web app", "Who has access: Chỉ người dùng trong domain bệnh viện".
- Không tự xây màn hình đăng nhập/mật khẩu riêng — tận dụng danh tính Google đã được CNTT quản lý (đúng triết lý "không phát minh lại", mục 12).
- `Session.getActiveUser().getEmail()` là nguồn định danh duy nhất, đối chiếu với `Users` sheet.

## 2. Authorization

- RBAC theo [11-permission-design.md](11-permission-design.md), kiểm tra ở tầng Service (server-side), không tin tưởng bất kỳ giá trị quyền nào gửi từ client.
- Fail-closed: không xác định được quyền → từ chối.

## 3. Bảo vệ dữ liệu truyền tải và lưu trữ

- Toàn bộ giao tiếp qua HTTPS (mặc định của Apps Script Web App và `UrlFetchApp`).
- Không lưu Password, API Key, Access Token dạng Plain Text (mục 24).
- File tài liệu thừa hưởng cơ chế mã hoá at-rest của Google Drive; dữ liệu Sheets thừa hưởng mã hoá at-rest của Google Sheets — không cần tự triển khai thêm ở lớp lưu trữ này.

## 4. Lưu trữ API Key — quyết định (Product Owner, 2026-08-05)

Apps Script **không có hàm mã hoá đối xứng dựng sẵn** (chỉ có `Utilities.computeHmacSha256Signature`/`computeDigest`, là hàm một chiều). Hai phương án đã trình bày:

| Phương án | Mô tả | Ưu điểm | Nhược điểm |
|---|---|---|---|
| **A. PropertiesService (Script Properties) qua lớp SecretStore** | Sheet `AIProviderConfig` không lưu giá trị Key — chỉ lưu `ApiKeySecretRef` (con trỏ). Giá trị Key thật lưu trong Script Properties, chỉ script phía server đọc được, không bao giờ trả về client | Không thêm phụ thuộc hạ tầng, không thêm thư viện mã hoá cần tự kiểm toán, đủ an toàn ở quy mô ~50 người dùng chỉ Admin thao tác | Không phải mã hoá đối xứng thật sự — an toàn dựa trên việc Script Properties không thể truy cập từ bên ngoài Apps Script (không phải dựa trên cipher) |
| **B. Google Cloud Secret Manager** | Apps Script gọi Secret Manager API (cùng GCP Project ẩn sau Apps Script) | Chuẩn công nghiệp, tách biệt rõ secret, access control riêng của GCP | Cần bật GCP Project liên kết + API, phát sinh thao tác cấu hình ngoài Apps Script Editor, chi phí nhỏ theo số lần truy cập |

**Quyết định**: Dùng **Phương án A (PropertiesService)** cho giai đoạn triển khai đầu tiên tại Đông Sơn — đúng triết lý "chưa tăng độ phức tạp khi chưa có nhu cầu thực tế" (mục 9 PROJECT_CONSTITUTION). Chuyển sang **Phương án B (Secret Manager)** chỉ khi nền tảng nhân rộng cho nhiều đơn vị hoặc có yêu cầu bảo mật cao hơn được xác nhận.

Để đổi phương án sau này không phải sửa các module gọi AI, thiết kế theo **Storage Provider Pattern**: mọi module chỉ gọi qua `AIGateway.KeyVault.gs` (`storeApiKey`/`retrieveApiKey`/`revokeApiKey`), bản thân KeyVault uỷ quyền cho `AIGateway.SecretStore.gs` — nơi duy nhất biết đang dùng PropertiesService hay Secret Manager. Đổi backend = đổi hằng số `ACTIVE_SECRET_STORE_PROVIDER` + thêm 1 implementation, không đổi bất kỳ Service nào khác. Xem cài đặt tại `src/09_AIGateway/AIGateway.SecretStore.gs` và `src/09_AIGateway/AIGateway.KeyVault.gs`.

Bất kể phương án nào: API Key không bao giờ trả về nguyên vẹn cho client — UI chỉ hiển thị 4 ký tự cuối (`maskApiKey`), việc cập nhật luôn ghi đè (không có API "lấy lại key cũ"), mọi thay đổi ghi vào `AIProviderKeyHistory` (không lưu giá trị cũ, chỉ lưu ai/khi nào/hành động gì).

## 5. Audit Logging

Theo mục 25, ghi log tối thiểu các hành động: Đăng nhập, Đăng xuất, Upload, Xóa, Sửa, Đổi quyền, Đổi AI Provider, Đổi cấu hình. Log lưu tại `AuditLog` sheet, có thể lọc theo người dùng/hành động/khoảng thời gian, xuất Excel (`SpreadsheetApp` export hoặc `DriveApp` tạo bản sao dạng xlsx).

## 6. Bảo mật thư viện bên thứ ba

Theo mục 12 và 24: mọi thư viện/CDN được đề xuất (Alpine.js, Tailwind CSS, thư viện AES vendor) phải được đánh giá License, mức độ phổ biến/bảo trì, có gửi dữ liệu ra ngoài hay không, có Telemetry hay không — trước khi tích hợp chính thức, trình bày tại [99-bootstrap-report.md](99-bootstrap-report.md). Không tích hợp thư viện có nguy cơ rò rỉ dữ liệu khi chưa được Product Owner phê duyệt.

## 7. Bề mặt tấn công cần lưu ý riêng cho Apps Script Web App

| Rủi ro | Biện pháp |
|---|---|
| XSS qua nội dung tài liệu hiển thị trong HTML Service | Escape/encode mọi nội dung động khi render trong `ui/views/*.html`; không dùng `innerHTML` với dữ liệu chưa qua escape |
| Lộ Script Properties / ID nội bộ qua client | Không bao giờ trả `ROOT_FOLDER_ID`, `SYSTEM_DB_SPREADSHEET_ID`, secret ra client; Repository là lớp duy nhất biết các ID này |
| Giả mạo request `google.script.run` | Mọi hàm `google.script.run` public đều tự kiểm tra quyền lại ở server, không tin dữ liệu do client gửi (ví dụ LibraryID, Role) |
| Thư viện CDN (Alpine.js/Tailwind) bị thay đổi nội dung (supply chain) | Dùng Subresource Integrity (SRI hash) khi nhúng script/style từ CDN |
| Prompt injection qua nội dung tài liệu khi dùng AI (RAG) | Tách rõ vai trò "system instruction" và "nội dung tài liệu" khi dựng prompt trong AI Gateway; không cho nội dung tài liệu ghi đè hướng dẫn hệ thống |

## 8. Sao lưu & khôi phục

- Google Drive/Sheets có version history gốc của Google — là lớp bảo vệ đầu tiên.
- Bổ sung sao lưu định kỳ (Time-driven Trigger) copy `AIOP_SystemDB` sang `/AIOP_ROOT/System/Backups/` theo lịch (ví dụ hàng tuần), giữ số bản gần nhất theo cấu hình — đơn giản, không cần dịch vụ backup chuyên biệt ở quy mô này.
