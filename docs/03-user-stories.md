# 03 — User Stories

Định dạng: *Là [vai trò], tôi muốn [hành động], để [giá trị].* Ước lượng độ ưu tiên: P0 (phải có ở bản đầu tiên) / P1 (quan trọng, có thể theo sau) / P2 (mở rộng).

## Văn thư / Hành chính

- **US-01** (P0): Là nhân viên văn thư, tôi muốn soạn văn bản từ mẫu có sẵn, để không phải gõ lại các phần cố định mỗi lần.
- **US-02** (P0): Là nhân viên văn thư, tôi muốn hệ thống tự kiểm tra thể thức trước khi trình ký, để giảm số lần bị trả lại vì sai thể thức.
- **US-03** (P1): Là nhân viên văn thư, tôi muốn so sánh bản văn bản mới với bản trước, để biết chính xác phần nào đã thay đổi.
- **US-04** (P0): Là nhân viên văn thư, tôi muốn xuất văn bản ra Word sau khi được duyệt, để gửi/lưu trữ theo đúng quy định.
- **US-05** (P1): Là nhân viên văn thư, tôi muốn tra cứu nhanh biểu mẫu đúng chuẩn, để không dùng nhầm mẫu cũ.

## Lãnh đạo khoa/phòng, Ban Giám đốc

- **US-06** (P0): Là trưởng khoa, tôi muốn thấy danh sách văn bản đang chờ tôi duyệt, để không bỏ sót việc cần xử lý.
- **US-07** (P0): Là trưởng khoa, tôi muốn duyệt hoặc từ chối kèm ý kiến ngay trên hệ thống, để không phải in giấy hay trao đổi qua nhiều kênh.
- **US-08** (P1): Là Ban Giám đốc, tôi muốn tra cứu lại toàn bộ lịch sử phê duyệt của một văn bản, để nắm rõ quá trình xử lý khi cần.

## Nhân viên các khoa/phòng

- **US-09** (P0): Là điều dưỡng, tôi muốn tra cứu quy trình/hướng dẫn nội bộ bằng cách hỏi trực tiếp, để không phải hỏi lại đồng nghiệp hoặc quản lý.
- **US-10** (P1): Là nhân viên dược, tôi muốn tìm nhanh văn bản quy định trong kho tri thức Dược, để đối chiếu khi cần.
- **US-11** (P2): Là nhân viên CNTT, tôi muốn AI tóm tắt một văn bản dài, để nắm ý chính nhanh hơn khi không có thời gian đọc hết.

## Quản trị viên (Admin/CNTT)

- **US-12** (P0): Là Admin, tôi muốn nhấn "Initialize System" khi triển khai lần đầu, để hệ thống tự tạo toàn bộ cấu trúc dữ liệu cần thiết mà tôi không phải tạo tay từng Sheet.
- **US-13** (P0): Là Admin, tôi muốn cấu hình AI Provider và API Key, để bật tính năng AI cho toàn hệ thống.
- **US-14** (P0): Là Admin, tôi muốn phân quyền người dùng theo Role và theo từng Library, để kiểm soát ai được làm gì ở đâu.
- **US-15** (P1): Là Admin, tôi muốn xem và xuất Audit Log, để phục vụ kiểm tra/đối soát khi có sự cố.
- **US-16** (P1): Là Admin, tôi muốn tắt AI ngay lập tức nếu chi phí phát sinh bất thường, để kiểm soát ngân sách mà không ảnh hưởng các chức năng khác.

## Manager (quản lý một Library)

- **US-17** (P0): Là quản lý kho tri thức Dược, tôi muốn thêm/sửa/xoá danh mục và tài liệu trong phạm vi Dược, để giữ kho tri thức luôn cập nhật.
- **US-18** (P1): Là quản lý kho tri thức, tôi muốn chỉnh Rule kiểm tra thể thức riêng cho lĩnh vực của mình, để phù hợp đặc thù chuyên môn mà không cần nhờ CNTT sửa code.

## Ghi chú

Mỗi User Story P0 phải có tối thiểu một Use Case tương ứng tại [04-use-cases.md](04-use-cases.md) và một Functional Requirement tương ứng tại [02-srs.md](02-srs.md).
