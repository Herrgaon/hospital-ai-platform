# 06 — UI Specification

## 1. Phong cách tham khảo

Microsoft 365, Google Workspace, ChatGPT, Notion (mục 23 PROJECT_CONSTITUTION) — hiện đại, đơn giản, dễ học. Không giao diện rườm rà, không tính năng làm giảm trải nghiệm.

## 2. Công nghệ giao diện

- HTML Service (Apps Script) làm shell.
- **Alpine.js** (qua CDN, ~15KB, MIT license, không telemetry) cho tương tác/reactivity nhẹ, không cần build step.
- **Tailwind CSS** (qua CDN hoặc file CSS build sẵn, MIT license) cho styling nhất quán, tốc độ triển khai nhanh.
- Không dùng React/Vue full SPA framework ở giai đoạn 1 — không cần build pipeline, giữ đúng "ít công nghệ, ít cấu hình" (mục 9). Xem xét lại nếu độ phức tạp UI vượt khả năng của Alpine.js trong tương lai.

## 3. Bố cục tổng thể

```
┌──────────────────────────────────────────────────────────────┐
│  Top bar: Logo | Tìm kiếm toàn cục | Chuông thông báo | Avatar │
├───────────┬──────────────────────────────────────────────────┤
│           │                                                    │
│  Sidebar  │                  Nội dung chính                    │
│           │                                                    │
│ Dashboard │                                                    │
│ Văn bản   │                                                    │
│ Tri thức  │                                                    │
│ AI Chat   │                                                    │
│ Workflow  │                                                    │
│ Admin*    │                                                    │
│           │                                                    │
└───────────┴──────────────────────────────────────────────────┘
```

`Admin` chỉ hiện với Role Admin/Manager. Sidebar thu gọn được (icon-only) trên màn hình nhỏ.

## 4. Các màn hình chính

| Màn hình | Mục đích | Thành phần chính |
|---|---|---|
| Dashboard | Tổng quan cá nhân | Văn bản chờ xử lý, chờ duyệt (nếu có quyền), thông báo gần đây |
| Danh sách văn bản | Quản lý văn bản | Bảng có filter theo Library/trạng thái/người tạo, tìm kiếm |
| Soạn thảo văn bản | Tạo/sửa văn bản | Form field theo Template + panel kết quả kiểm tra Rule + nút gọi AI hỗ trợ |
| Quản lý Template | CRUD Template | Danh sách, preview, import/export |
| Kho tri thức | Duyệt/tra cứu tài liệu | Sidebar cây Category, danh sách tài liệu, panel chi tiết + lịch sử phiên bản |
| AI Chat | Hỏi đáp | Khung chat, chọn phạm vi Library, hiển thị trích dẫn nguồn dưới mỗi câu trả lời |
| Workflow Inbox | Xử lý phê duyệt | Danh sách văn bản chờ duyệt, hành động Duyệt/Từ chối kèm ý kiến |
| Cài đặt Admin | Cấu hình hệ thống | Tab: Người dùng & Phân quyền, AI Provider, Rule/Template/Workflow, Audit Log |

## 5. Trạng thái hiển thị văn bản (nhãn màu thống nhất)

| Status | Màu gợi ý | Ý nghĩa |
|---|---|---|
| `DRAFT` | Xám | Đang soạn |
| `NEEDS_EDIT` | Vàng/cam | Cần chỉnh sửa (lỗi Rule hoặc bị từ chối) |
| `PENDING_APPROVAL` | Xanh dương | Đang chờ duyệt |
| `APPROVED` | Xanh lá | Đã duyệt |
| `PUBLISHED` | Xanh lá đậm | Đã xuất bản chính thức |
| `REJECTED` | Đỏ | Bị từ chối |

Bảng màu áp dụng nhất quán toàn hệ thống — không định nghĩa lại theo từng màn hình.

## 6. Dark Mode / Light Mode

- Mặc định theo cấu hình hệ điều hành/trình duyệt (`prefers-color-scheme`).
- Có công tắc chuyển đổi thủ công ở Top bar, lưu lựa chọn vào `localStorage` phía client (không cần lưu server vì là sở thích cá nhân, không phải dữ liệu nghiệp vụ).

## 7. Responsive

- Ưu tiên trải nghiệm desktop/laptop (đối tượng dùng chính là nhân viên văn phòng).
- Tablet: sidebar tự thu gọn thành icon.
- Điện thoại: hỗ trợ ở mức xem/tra cứu/phê duyệt cơ bản (Dashboard, Workflow Inbox, AI Chat, Kho tri thức) — không tối ưu soạn thảo văn bản dài trên màn hình nhỏ.

## 8. Nguyên tắc UX

- Không yêu cầu người dùng hiểu khái niệm kỹ thuật (Library/Workflow/Rule) — dùng ngôn ngữ nghiệp vụ tiếng Việt gần gũi ("Kho tài liệu", "Quy trình duyệt", "Quy tắc kiểm tra").
- Mọi lỗi từ Rule Engine hiển thị cụ thể, có vị trí và hướng dẫn sửa — không hiển thị lỗi kỹ thuật thô (stack trace) cho người dùng cuối.
- Hành động phá huỷ (xoá) luôn có bước xác nhận.
- Trạng thái tải (loading) rõ ràng cho mọi thao tác gọi AI hoặc xử lý tài liệu (đúng NFR-01/NFR-09 — có thể mất vài giây).

## 9. Khả năng tiếp cận (Accessibility)

- Độ tương phản màu chữ/nền đạt tối thiểu WCAG AA.
- Toàn bộ hành động chính thao tác được bằng bàn phím (điều hướng Tab, Enter/Esc cho modal).
- Icon quan trọng luôn kèm label văn bản hoặc `aria-label`, không dùng icon đơn độc cho hành động phá huỷ.
