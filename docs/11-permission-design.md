# 11 — Permission Design (RBAC)

## 1. Mô hình

Role-Based Access Control (RBAC), theo mục 19 PROJECT_CONSTITUTION. Quyền được đánh giá ở hai cấp:

1. **Cấp hệ thống** (System-level): quyền theo Role cố định (Admin/Manager/User/Guest).
2. **Cấp tài nguyên** (Resource-level): quyền theo từng Library/Category cụ thể, lưu trong `Permissions` sheet — cho phép một User là Manager của Library A nhưng chỉ là User thường ở Library B.

## 2. Mô hình tổ chức (Product Owner xác nhận 2026-08-05)

Đúng cơ cấu quản lý thực tế của bệnh viện: **Ban Giám đốc quản lý chung toàn bộ khoa/phòng** (vai trò Admin), **mỗi Trưởng khoa/phòng chỉ quản lý kho tri thức và nhân sự của khoa/phòng mình** (không lan sang khoa/phòng khác). Cụ thể hoá bằng nguyên tắc:

- **Mọi người dùng đều xem được mọi kho tri thức** (CanView = true toàn hệ thống theo mặc định Role) — tri thức nội bộ không bị "silo" hoá, ai cũng tra cứu được.
- **Chỉ khoa/phòng phụ trách một kho mới được Thêm/Sửa/Xoá/Quản lý trong chính kho đó** — quyền này KHÔNG cấp mặc định theo Role toàn hệ thống, mà cấp riêng theo từng cặp (User, Library) khi Admin tạo kho và chỉ định Trưởng khoa/phòng phụ trách (xem `Knowledge.Library.gs#createLibrary`).
- **Trưởng khoa/phòng tự cấp quyền Thêm/Sửa/Xoá cho nhân viên trong khoa/phòng mình**, chỉ trong phạm vi kho họ quản lý — không cần chờ Admin can thiệp cho từng nhân viên (xem `Admin.UserManagement.gs#setUserPermissionOverride`, giao diện tại mục "Phân quyền" trong Kho tri thức).

Vì vậy Role hệ thống (Admin/Manager/User/Guest) chỉ còn ý nghĩa **phân loại nhân sự** (ai là Trưởng khoa/phòng, ai là nhân viên), KHÔNG tự động suy ra quyền Thêm/Sửa/Xoá ở bất kỳ kho cụ thể nào — quyền thao tác luôn được cấp theo từng kho, đúng người phụ trách.

## 3. Role mặc định

| Role | Mô tả | Quyền hệ thống mặc định |
|---|---|---|
| **Admin** | Ban Giám đốc / CNTT — quản lý chung | Toàn quyền mọi kho, cấu hình AI, phân quyền, xem toàn bộ Log |
| **Manager** | Trưởng khoa/phòng | Chỉ xem mặc định — có toàn quyền TRONG kho được Admin giao quản lý (không lan sang kho khác) |
| **User** | Nhân viên khoa/phòng | Chỉ xem mặc định — được Trưởng khoa/phòng cấp thêm quyền Thêm/Sửa/Xoá trong kho của khoa/phòng mình |
| **Guest** | Người xem (đối tác, thực tập) | Chỉ xem |

## 4. Ma trận quyền chi tiết

| Hành động | Admin | Manager phụ trách kho đó | User được cấp quyền trong kho đó | Người ngoài khoa/phòng (mọi Role) |
|---|:---:|:---:|:---:|:---:|
| Xem tài liệu (mọi kho) | ✅ | ✅ | ✅ | ✅ |
| Upload / Tạo tài liệu | ✅ | ✅ | ✅ (nếu được cấp `CanCreate`) | ❌ |
| Sửa tài liệu | ✅ | ✅ | ✅ (nếu được cấp `CanEdit`) | ❌ |
| Xoá tài liệu | ✅ | ✅ | ✅ (nếu được cấp `CanDelete`) | ❌ |
| Phê duyệt văn bản | ✅ | ✅ | ✅ (nếu được cấp `CanApprove`) | ❌ |
| Quản lý Template/Rule/Workflow của kho | ✅ | ✅ | ❌ | ❌ |
| Cấp quyền cho nhân viên trong kho mình quản lý | ✅ | ✅ (chỉ trong kho mình quản lý) | ❌ | ❌ |
| Tạo/Quản lý Library mới | ✅ | ❌ | ❌ | ❌ |
| Cấu hình AI Provider/API Key | ✅ | ❌ | ❌ | ❌ |
| Đổi Role hệ thống của người dùng | ✅ | ❌ | ❌ | ❌ |
| Xem Audit Log toàn hệ thống | ✅ | ❌ | ❌ | ❌ |

## 5. Cấu trúc dữ liệu phân quyền

Xem schema `Permissions` tại [12-storage-design.md](12-storage-design.md) mục 2.1.

```
Permissions
├── PermissionID
├── RoleID          → tham chiếu Roles (bỏ trống nếu là override theo UserID)
├── UserID          → (tuỳ chọn) áp cho 1 user cụ thể, override theo Role — đây là cách chính để
│                      cấp quyền Thêm/Sửa/Xoá cho 1 khoa/phòng trong 1 Library cụ thể
├── LibraryID        → phạm vi áp dụng ("*" = toàn hệ thống, chỉ Admin dùng theo Role)
├── CanView / CanCreate / CanEdit / CanDelete / CanApprove / CanManage
```

- Quyền hiệu lực của một User trên một Library = hợp của quyền theo Role mặc định + quyền override theo UserID (nếu có) trên Library đó.
- Ưu tiên: override theo `UserID + LibraryID` > quyền theo `RoleID + LibraryID` > quyền theo `RoleID + "*"`.
- Khi tạo Library mới, hệ thống tự ghi 1 dòng override `UserID = Trưởng khoa/phòng` với toàn bộ quyền `true` trên đúng `LibraryID` đó — không đụng tới quyền của họ ở Library khác.

## 6. Kiểm tra quyền trong mã nguồn

- Mọi Service method thao tác dữ liệu **bắt buộc** gọi `Auth.Permission.gs` trước khi thực hiện — không kiểm tra quyền ở tầng UI một mình (UI chỉ ẩn/hiện để trải nghiệm tốt hơn, không phải lớp bảo mật).
- Nguyên tắc: **fail-closed** — nếu không xác định được quyền (lỗi đọc Permissions, user không tồn tại trong `Users`), mặc định từ chối truy cập.
- Việc cấp quyền theo UserID+LibraryID (`setUserPermissionOverride`) cho phép cả Admin (mọi kho) và người đang có `CanManage` trên chính Library đó (Trưởng khoa/phòng phụ trách) — không giới hạn Admin-only, để Trưởng khoa/phòng chủ động quản lý nhân sự của mình mà không phải chờ CNTT.

## 7. Vòng đời người dùng

```
Tài khoản Google được cấp bởi CNTT
        │
        ▼
Lần đăng nhập đầu tiên vào Web App
        │
        ▼
Auth.Session.gs kiểm tra Users sheet
        │
   ┌────┴─────┐
Chưa có bản ghi   Đã có bản ghi
        │               │
        ▼               ▼
Tạo user mới,      Nạp Role +
Role = Guest       Permission hiện có
(chờ Admin/Manager
gán Role phù hợp)
```

- Người dùng mới mặc định là **Guest** cho tới khi được Admin/Manager gán Role — tránh cấp quyền thừa mặc định.
- Việc đổi Role/Permission luôn được ghi vào `AuditLog` (mục 25 PROJECT_CONSTITUTION).

## 8. Liên hệ với các thiết kế khác

- Ma trận quyền trên Library liên hệ trực tiếp với [10-knowledge-design.md](10-knowledge-design.md) (mỗi Library có Manager riêng).
- Quyền phê duyệt liên hệ với [07-workflow.md](07-workflow.md) (bước Approval kiểm tra `CanApprove` trên Library/loại văn bản tương ứng).
