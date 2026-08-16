# ĐẶC TẢ CƠ CHẾ PHÂN QUYỀN HỆ THỐNG – BẢN CHỐT V1

**Trạng thái triển khai:** Đã triển khai một phần quan trọng (2026-08-16) — xem
`Auth.Permission.gs`, `Auth.PermissionCatalog.gs`, `Admin.UserManagement.gs`, tab "Phân quyền phụ
trách" trong Quản trị hệ thống. Phần còn thiếu được liệt kê ở cuối file.

---

## 1. Nguyên tắc tổng thể

Hệ thống sử dụng một **bộ quyền dùng chung cho toàn bộ các module**.

Không tạo quyền riêng cho từng khoa/phòng.

Ví dụ KHÔNG tạo: "Xem lịch trực Khoa Nội", "Xem lịch trực Khoa Ngoại", "Xem lịch trực Khoa Dược",
"Xem lịch trực toàn viện" — mà chỉ có **Quyền: Xem lịch trực**, sau đó xác định **Phạm vi quản lý:
Khoa Nội / Khoa Ngoại / Khoa Dược / Toàn viện...**

> **Quyền = được làm gì**
> **Phạm vi quản lý = được làm trên phạm vi nào**

---

## 2. Không mặc định cấp toàn bộ quyền theo chức vụ

Chức vụ chỉ là **một cơ sở để xác định quyền mặc định**.

Ví dụ Trưởng khoa Nội KHÔNG mặc nhiên được: quản lý nhân sự toàn viện, quản lý lịch trực toàn viện,
quản lý KPI toàn viện, quản lý chấm công toàn viện, xem lương toàn viện, quản lý tài khoản, quản lý
quyền hệ thống.

Trưởng khoa chỉ được quyền đối với **những chức năng thuộc nhiệm vụ của Khoa Nội đã được cấu hình**.
Các quyền ngoài phạm vi đó phải được **Admin cấp thêm**.

---

## 3. Quyền được cấu tạo bởi "Quyền + Phạm vi"

Ví dụ: Người A (Quyền: Quản lý lịch trực, Phạm vi: Khoa Nội) và Người B (Quyền: Quản lý lịch trực,
Phạm vi: Toàn viện) — đây vẫn là **cùng một quyền**, chỉ khác phạm vi.

---

## 4. Các cấp phạm vi quản lý

Hệ thống cần hỗ trợ:

1. **Cá nhân** — chỉ chính người đó (VD: Xem lịch trực của tôi).
2. **Nhóm** — một nhóm người được xác định (VD: Nhóm Điều dưỡng).
3. **Khoa/Phòng** — một đơn vị cụ thể (VD: Khoa Nội).
4. **Nhiều khoa/phòng** — một người có thể được giao nhiều đơn vị.
5. **Toàn viện** — toàn bộ bệnh viện.

*(Trạng thái triển khai: chỉ mới hỗ trợ Khoa/Phòng và Toàn viện qua DepartmentID ('*' = toàn viện).
Cá nhân/Nhóm/Nhiều khoa-phòng làm 1 lượt cấp CHƯA triển khai — "Nhóm" chưa tồn tại như một khái niệm
trong hệ thống.)*

---

## 5. Phạm vi phải có đối tượng cụ thể

```text
Phạm vi: Khoa/Phòng
Đối tượng: Khoa Nội
```

hoặc

```text
Phạm vi: Nhiều khoa/phòng
Đối tượng: Khoa Nội, Khoa Ngoại, Khoa Dược, Khoa Xét nghiệm, Phòng KH-NV
```

Không cần tạo thêm quyền mới.

---

## 6. Quyền có thể được cấp trực tiếp cho từng người

Admin có thể mở hồ sơ phân quyền của một người và cấp trực tiếp — không cần thay đổi chức vụ của
người đó.

---

## 7. Màn hình quản lý phân quyền tập trung

Admin có một danh sách người dùng: Tìm kiếm, lọc theo Khoa/Phòng, Chức vụ, Vai trò. Mỗi người có nút
**Phân quyền** mở bảng riêng để điều chỉnh quyền.

---

## 8. Bảng phân quyền dùng dạng nhóm + tích chọn

Ví dụ nhóm theo module (📁 LỊCH TRỰC, 📁 CÔNG VIỆC...), mỗi dòng trong nhóm là 1 quyền cụ thể (Xem
lịch trực/Tạo lịch trực/Sửa lịch trực/Phê duyệt đổi trực...), có tích chọn + Phạm vi quản lý riêng.

Cách này được ưu tiên vì dễ nhìn và dễ quản trị.

*(Trạng thái triển khai: đã nhóm theo module thật của hệ thống, hiển thị dạng thẻ có thể thu gọn.
Phạm vi quản lý và "Cho phép phân quyền" hiện áp dụng CHUNG cho cả nhóm quyền của 1 module + 1
khoa/phòng trong 1 lượt cấp — CHƯA tách riêng phạm vi/cho-phép-phân-quyền cho TỪNG quyền lẻ trong
nhóm như mockup minh hoạ, vì mô hình lưu trữ hiện tại là 1 dòng/module/khoa-phòng gộp 10 hành động,
không phải 1 dòng/hành động.)*

---

## 9. Nguồn cấp quyền

Một quyền cần biết nó đến từ đâu: Theo chức vụ/vai trò | Admin cấp trực tiếp | Được uỷ quyền | Bị
Admin thu hồi.

---

## 10. Admin có thể điều chỉnh từng người

Admin có thể: Cấp quyền, Điều chỉnh quyền, Thay đổi phạm vi, Thu hồi quyền, Khôi phục quyền, Xem lịch
sử thay đổi.

Việc thu hồi riêng một người không ảnh hưởng đến những người khác có cùng chức vụ.

---

## 11. Quyền quản lý phân quyền là một quyền riêng

Không phải cứ có quyền nghiệp vụ là được phân quyền cho người khác.

Hệ thống có riêng nhóm **Quản lý phân quyền**, gồm: Xem phân quyền, Cấp quyền, Điều chỉnh quyền, Thu
hồi quyền, Quản lý phạm vi quyền, Uỷ quyền phân quyền, Xác định quyền được phép phân cấp, Xem lịch sử
phân quyền.

*(Trạng thái triển khai: CHƯA xây thành 1 nhóm quyền/tab "Quyền phân quyền" riêng biệt trong UI —
hiện chỉ SUPER_ADMIN mới truy cập được toàn bộ màn Quản lý phân quyền, tương đương coi
"quyền quản lý phân quyền" = vai trò SUPER_ADMIN. Backend đã có sẵn logic ép buộc §13/§14 cho MỌI
actingUser, sẵn sàng khi mở rộng.)*

---

## 12. "Cho phép phân quyền" là thuộc tính của quyền

Mỗi quyền có thể có: **Cho phép phân quyền: Có/Không**.

Ví dụ: "Quản lý lịch trực" → Có; "Quản lý tiền lương" → Không.

---

## 13. Phải có giới hạn quyền được phép phân cấp

Không chỉ xác định có được phân quyền hay không, mà phải xác định: **được phép phân quyền những quyền
nào và đến phạm vi nào.**

Ví dụ Trưởng khoa Nội có "Quản lý lịch trực – Khoa Nội" có thể được phép phân cho nhân viên "Xem lịch
trực – Khoa Nội", nhưng không thể cấp "Quản lý lịch trực – Toàn viện".

---

## 14. Không được phân quyền vượt quá quyền của mình

> **Một người chỉ được phép phân quyền trong phạm vi quyền mà họ đang có và được phép uỷ quyền.**

*(Trạng thái triển khai: đã triển khai và kiểm chứng qua clasp run — grantUserPermission() từ chối
cấp 1 hành động mà actingUser không có, và từ chối nếu quyền đó không có CanDelegate=true, cho MỌI
actingUser không phải SUPER_ADMIN.)*

---

## 15. Ban Giám Đốc, Trưởng/Phó khoa/phòng và người được chỉ định

Tất cả dùng **cùng một cơ chế phân quyền**. Không xây cơ chế riêng cho từng nhóm.

- Ban Giám Đốc: có quyền nào thì cấp quyền đó.
- Trưởng khoa/phòng: có quyền trong phạm vi nhiệm vụ của khoa/phòng.
- Phó khoa/phòng: có quyền nào thì sử dụng quyền đó.
- Điều dưỡng trưởng: có quyền trong phạm vi nhiệm vụ điều dưỡng được giao.
- Người được chỉ định: Admin có thể cấp trực tiếp quyền phù hợp.

Không cần sửa code khi lãnh đạo thay đổi việc phân công; chỉ cần thay đổi cấu hình quyền.

---

## 16. Trưởng khoa có thể phân quyền cho thành viên

Nhưng chỉ khi:
1. Trưởng khoa có quyền quản lý phân quyền.
2. Quyền đó được phép uỷ quyền.
3. Trưởng khoa được phép phân quyền loại quyền đó.
4. Phạm vi không vượt quá phạm vi Trưởng khoa được phép quản lý.
5. Người được cấp thuộc phạm vi mà Trưởng khoa được phép quản lý.

*(Trạng thái triển khai: CHƯA MỞ UI tự phục vụ cho Trưởng khoa — giữ nguyên quyết định "Giai đoạn 1"
đã có từ trước (chỉ SUPER_ADMIN thao tác qua UI Quản lý phân quyền). Backend đã sẵn sàng cho việc mở
rộng này.)*

---

## 17. Phân biệt "phân công" và "phân quyền"

Hai khái niệm không được gộp.

- **Phân công**: Giao cho ai làm một công việc/nhiệm vụ (VD: Giao bác sĩ A lập báo cáo).
- **Phân quyền**: Cho phép bác sĩ A có khả năng thực hiện một loại thao tác (VD: Cho bác sĩ A quyền
  tạo và giao công việc).

Một người có thể được giao công việc nhưng **không có quyền giao việc cho người khác**.

*(Đã triển khai đúng nguyên tắc này ở module "Phân công nhân sự" trong Nhân sự — EmployeeAssignments
hoàn toàn tách biệt khỏi Permissions, không cấp bất kỳ quyền thao tác hệ thống nào.)*

---

## 18. Nhật ký phân quyền bắt buộc

Mọi thay đổi quyền phải được lưu lịch sử: Thời gian, Người thực hiện, Đối tượng, Thao tác, Quyền,
Phạm vi.

Phải ghi nhận tối thiểu: Cấp quyền, Thu hồi, Thay đổi phạm vi, Thay đổi quyền được uỷ quyền.

Không cho phép thay đổi quyền mà không có nhật ký.

*(Đã triển khai — dùng lại AuditLog chung, action PERMISSION_GRANTED/PERMISSION_REVOKED/
PERMISSION_RESTORED, xem tab "Lịch sử phân quyền".)*

---

## 19. Cấu trúc một bản ghi phân quyền

Một quyền được cấp cho một người nên có tối thiểu: Người dùng, Quyền, Phạm vi quản lý, Đối tượng phạm
vi, Nguồn cấp quyền, Được phép phân quyền, Phạm vi được phép phân quyền, Thời gian bắt đầu, Thời gian
kết thúc (nếu có), Trạng thái, Người cấp, Thời điểm cấp.

Cho phép cấp quyền có thời hạn (VD: một chuyên viên được giao quản lý lịch trực toàn viện trong 3
tháng — hết thời hạn quyền tự động hết hiệu lực).

*(Đã triển khai qua các cột Status/EffectiveFrom/EffectiveTo/CanDelegate/GrantedByUserID/GrantedAt
trên sheet Permissions.)*

---

## 20. Bảy nguyên tắc nền tảng

1. Quyền dùng chung toàn hệ thống — không tạo quyền riêng cho từng khoa/phòng.
2. Quyền và phạm vi tách biệt — Quyền = được làm gì; Phạm vi = được làm ở đâu/với ai.
3. Mặc định từ chối — không có quyền → không được thao tác.
4. Chức vụ không đồng nghĩa với toàn quyền — Trưởng khoa chỉ mặc định có quyền trong phạm vi chức
   năng, nhiệm vụ được giao.
5. Admin có thể cấp quyền đặc biệt — có thể cấp trực tiếp cho bất kỳ người nào theo nhu cầu quản lý.
6. Quyền phân quyền là một quyền riêng — có quyền nghiệp vụ không có nghĩa được phép cấp quyền đó cho
   người khác.
7. Không được phân quyền vượt quá phạm vi — người được uỷ quyền chỉ được phân quyền trong phạm vi
   được phép.

---

## 22. Ghi chú triển khai cho AI Agent

- Giao diện người dùng sử dụng tiếng Việt.
- Các tên kỹ thuật trong code/database có thể dùng tiếng Anh để thống nhất lập trình, nhưng không
  hiển thị trực tiếp cho cán bộ.
- Không hard-code quyền theo từng khoa/phòng.
- Không hard-code việc Trưởng khoa/Phó khoa/Điều dưỡng trưởng được quyền gì.
- Xây kho quyền dùng chung và cơ chế cấu hình.
- Xây cơ chế quyền + phạm vi quản lý.
- Xây cơ chế cấp quyền trực tiếp cho từng người.
- Xây cơ chế thu hồi/điều chỉnh quyền từng người.
- Xây cơ chế quyền được phép phân quyền.
- Xây cơ chế giới hạn phạm vi được phân quyền.
- Xây nhật ký đầy đủ mọi thay đổi phân quyền.
- Phải kiểm tra quyền ở backend, không chỉ ẩn/hiện nút trên giao diện.
- Thiết kế để sau này thay đổi phân công nghiệp vụ chỉ cần thay đổi cấu hình, hạn chế tối đa việc sửa
  code.

---

## Phần CHƯA triển khai (còn lại sau đợt 2026-08-16)

- Cấp "Nhóm" (named group) như một loại phạm vi độc lập.
- "Nhiều khoa/phòng" trong CÙNG một lượt cấp (hiện phải tạo nhiều dòng riêng, mỗi dòng 1 khoa/phòng).
- Phạm vi/"Cho phép phân quyền" tách riêng theo TỪNG hành động lẻ trong 1 nhóm quyền (hiện áp dụng
  chung cho cả nhóm quyền của 1 module).
- Tab/nhóm quyền "Quản lý phân quyền" tách biệt khỏi vai trò SUPER_ADMIN.
- UI tự phục vụ cho Trưởng khoa/phòng tự phân quyền cho thành viên (backend đã sẵn sàng, chỉ chưa mở
  UI theo đúng quyết định "Giai đoạn 1" trước đó).
