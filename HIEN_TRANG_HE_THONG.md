# Hiện trạng hệ thống — Hệ thống Quản lý Công việc – Phân công – Lịch trực – KPI – Hỗ trợ tổng hợp thu nhập

**Bệnh viện Đa khoa Đông Sơn** · Cập nhật: 2026-08-15 · Người duy trì: Product Owner (herrgaon15@gmail.com)

> Tài liệu này mô tả ĐÚNG những gì đang tồn tại trong mã nguồn và đã được xác minh chạy thật (qua Execution API), không phải kế hoạch/mong muốn. Phần "Chưa làm" ở cuối liệt kê rõ ràng những gì còn thiếu.
>
> ⚠️ Thư mục `docs/` trong repo (00-vision.md → 17-project-structure.md, adr/) là tài liệu của **dự án cũ đã xoá** (hệ thống Quản lý tài liệu/tri thức) — không còn đúng với hệ thống hiện tại, đọc sẽ gây nhầm lẫn. Xem mục "Lịch sử" ở cuối file này.

---

## 1. Hệ thống này là gì

Hệ thống nội bộ cho Bệnh viện Đa khoa Đông Sơn, gồm 2 nhóm nghiệp vụ:

- **Phần A — Quản lý và phân công**: nhân sự, khoa/phòng, phân công công việc, lịch trực, KPI.
- **Phần B — Hỗ trợ tổng hợp cho kế toán**: chấm công, làm thêm giờ, tổng hợp trực, số liệu chuyên môn, BHYT/xuất toán, tổng hợp thu nhập.

**Nguyên tắc nền tảng (bắt buộc giữ khi phát triển tiếp):**
- Không kết nối HIS, không lưu bất kỳ dữ liệu bệnh nhân nào (tên, mã BHYT, chẩn đoán...) — chỉ số liệu tổng hợp theo tháng.
- Không tự động quy đổi số ca xuất toán BHYT thành điểm trừ KPI.
- KPI là lớp đánh giá tính từ dữ liệu công việc/hoạt động đã có — không phải nơi nhân viên tự nhập điểm.
- Không hard-code công thức tính tiền/công thức KPI trong code — mọi công thức đọc từ dữ liệu cấu hình (JSON), sửa qua UI/Sheet, không cần sửa code.
- Không sửa âm thầm dữ liệu đã "chốt" (chấm công) — phải qua quy trình Điều chỉnh công có lịch sử.
- Hệ thống không thay thế phần mềm kế toán — chỉ thu thập/đối chiếu/tổng hợp/xuất dữ liệu.

---

## 2. Kiến trúc

```
NGƯỜI DÙNG (trình duyệt, sau này thêm Desktop App)
        │
        ▼
1 APPS SCRIPT PROJECT DUY NHẤT — 2 lối vào:
  - google.script.run (trình duyệt, nội bộ, nhanh)
  - doPost RPC-over-POST (Desktop App/client ngoài, HTTP+JSON)
        │
        ▼
   Service Layer (không đổi giữa 2 lối vào)
        │
        ▼
   Repository Layer (SheetRepository)
        │
   ┌────┴────┐
   ▼         ▼
Google      Google
Sheets      Drive
(dữ liệu)   (file)
```

**Quyết định kiến trúc quan trọng nhất**: KHÔNG dựng 2 Apps Script project riêng (Backend/API tách khỏi Web App) — cả 2 vai trò nằm trong CÙNG 1 project, vì Apps Script project khác gọi nhau qua HTTP sẽ mất lợi thế tốc độ + phải tự dựng lại toàn bộ cơ chế xác thực token, không có lợi ích gì. Xem chi tiết lập luận trong 2 báo cáo thẩm định kiến trúc đã lưu (không còn trong repo, đã trình bày trực tiếp cho Product Owner qua Artifact trong phiên làm việc 2026-08-15).

**Đăng nhập**: mã nhân viên/mật khẩu KHÔNG dùng — dùng **Username + mật khẩu**, tách hoàn toàn khỏi `Employees.EmployeeCode` (mã nhân viên chỉ phục vụ HR/nghiệp vụ, đổi được mà không ảnh hưởng đăng nhập). Không còn phụ thuộc tài khoản Google — Web App deploy ở chế độ `executeAs=USER_DEPLOYING`, `access=ANYONE_ANONYMOUS` (xem `src/appsscript.json`), nghĩa là bất kỳ ai có link đều tải được trang đăng nhập, nhưng KHÔNG vào được hệ thống nếu không có Username/mật khẩu hợp lệ do SUPER_ADMIN/Phòng TC-HC cấp — **không có đường tự đăng ký nào**.

**Cơ chế token**: PBKDF2-HMAC-SHA256 tự dựng (Apps Script không có bcrypt/argon2), 20.000 vòng lặp. Token ký HMAC (base64url payload + chữ ký, không phải chuẩn JWT đầy đủ), hạn dùng 6 giờ, thu hồi qua `CacheService` (không cần bảng Session riêng). Rate-limit đăng nhập theo Username (không theo IP — Apps Script không lộ IP người gọi), khoá 15 phút sau 5 lần sai.

---

## 3. Cấu trúc thư mục mã nguồn (`src/`)

```
00_Bootstrap/     Tự khởi tạo hệ thống lần đầu, seed dữ liệu mặc định, đồng bộ schema
01_Core/          Điểm vào API (Core.Api.gs cho trình duyệt, Core.HttpApi.gs cho Gateway),
                  cấu hình, log, thông báo, router
02_Auth/          RBAC (Auth.Permission.gs), đăng nhập (Auth.Gateway.gs/Token.gs/Password.gs),
                  danh tính (Auth.Session.gs — CHỈ còn dùng cho bước Initialize System)
03_Storage/       Lớp truy cập Sheets (SheetRepository) + Drive (DriveRepository) dùng chung,
                  Storage.Schema.gs = NGUỒN SỰ THẬT DUY NHẤT cho tên Sheet/cột
04_Employee/      Hồ sơ nhân viên trung tâm
05_Department/    Khoa/Phòng (danh mục tổ chức + phạm vi phân quyền)
06_Task/          Quản lý công việc (khối hành chính)
07_ClinicalSchedule/  Phân công khối lâm sàng (khác Lịch trực)
08_DutySchedule/  Lịch trực tuần + quy trình duyệt + Đổi trực (module trọng tâm)
09_AIGateway/     Gateway gọi AI đa provider (Claude/OpenAI/Gemini/OpenRouter/Local) — ĐÃ CÓ SẴN
                  TỪ HỆ THỐNG CŨ, giữ nguyên, CHƯA CÓ MÀN HÌNH NÀO DÙNG trong hệ thống hiện tại
10_Attendance/    Chấm công + Điều chỉnh công
11_Admin/         Quản lý người dùng, cấu hình AI, sao lưu, audit log
12_Overtime/      Làm thêm giờ / Làm ngoài giờ
13_Payroll/       Tổng hợp trực + Trung tâm tổng hợp kế toán (đọc từ nhiều module khác)
14_ClinicalStats/ Số liệu hoạt động chuyên môn theo tháng
15_Insurance/     BHYT / Xuất toán
16_Kpi/           KPI (engine tính điểm cấu hình qua JSON + service)

ui/
  Index.html          Shell chính (sidebar + header + toàn bộ view, gate bằng authToken)
  Bootstrap.html       Màn hình Initialize System (lần đầu)
  css/main.html        CSS dùng chung (Tailwind CDN + custom "holo" theme)
  js/main.html          TOÀN BỘ logic Alpine.js phía trình duyệt (~1600 dòng, 1 file)
  js/bootstrapJs.html   Logic riêng cho màn Bootstrap
  views/*.html          14 view (xem mục 6)
```

**Quy ước đánh số thư mục**: KHÔNG có ý nghĩa thứ tự chạy (Apps Script nạp mọi file phẳng), chỉ để tổ chức trực quan trong Git. Có khoảng trống số thư mục (không có 17+) — có thể dùng tiếp cho module mới.

---

## 4. Mô hình dữ liệu (Google Sheets = database)

Nguồn sự thật DUY NHẤT: `src/03_Storage/Storage.Schema.gs` (hằng số `SHEETS` + `SCHEMA`). Không được hard-code tên sheet/cột ở bất kỳ đâu khác.

| Sheet | Cột chính | Ghi chú |
|---|---|---|
| `Users` | UserID, Email, **Username**, FullName, Role, Status, PasswordHash, PasswordSalt | Định danh đăng nhập. Username tách khỏi EmployeeCode. |
| `Roles` | RoleID, RoleName, Description | 11 vai trò + GUEST |
| `Permissions` | RoleID/UserID, **DepartmentID**, 10 cờ Can* | DepartmentID='*' = toàn viện |
| `Departments` | DepartmentID, DepartmentName, DepartmentType, HeadUserID | 14 khoa/phòng mặc định |
| `Employees` | EmployeeID, **EmployeeCode**, UserID, DepartmentID, EmployeeType | 1 nhân viên = 1 bản ghi trung tâm |
| `Tasks` | TaskID, AssignerEmployeeID, AssigneeEmployeeID, Status, Progress, EvaluationScore | Khối hành chính |
| `ClinicalAssignments` | AssignmentID, EmployeeID, AssignmentDate, WorkType | Khối lâm sàng, KHÁC DutyShifts |
| `DutySchedules` | DutyScheduleID, DepartmentID, WeekStartDate/EndDate, Status | Trạng thái xem mục 5.1 |
| `DutyShifts` | DutyShiftID, DutyScheduleID, ShiftDate, EmployeeID, Status | PLANNED/OFFICIAL/SWAPPED_OUT/CANCELLED |
| `DutySwapRequests` | SwapRequestID, OriginalShiftID, NewShiftID, Status | Lịch sử đổi trực suy ra từ 2 cột này |
| `Attendance` | AttendanceID, EmployeeID, WorkDate, CheckIn/Out, Status | OPEN/LOCKED |
| `AttendanceAdjustments` | AdjustmentID, AttendanceID, Original*/Requested*, Status | Sub-workflow riêng |
| `Overtime` | OvertimeID, OvertimeType (LAM_THEM_GIO/LAM_NGOAI_GIO), Status | 1 sheet dùng chung 2 loại |
| `MonthlyClinicalStats` | StatID, EmployeeID, YearMonth, StatType, Value | CHỈ số liệu tổng hợp |
| `InsuranceAudits` | AuditID, DepartmentID, YearMonth, WriteOffCount, ExplanationStatus | Không có cột điểm trừ KPI |
| `KpiRules` | RuleID, ObjectGroup, Criterion, **ScoringMethodJson** | Công thức cấu hình qua JSON |
| `KpiResults` | ResultID, EmployeeID, Period, RuleID, ActualValue, Score, Status | DRAFT → APPROVED |
| `AIProviders`, `AIProviderConfig`, `AIProviderKeyHistory` | — | Hạ tầng AI, chưa có UI dùng |
| `AuditLog` | LogID, UserID, Action, TargetType, TargetID | Ghi mọi hành động quan trọng |
| `SystemConfig` | — | Hiện chưa dùng nhiều, đa số config qua PropertiesService |

### ⚠️ Gotcha quan trọng nhất khi thêm cột mới

Google Sheets **tự động chuyển chuỗi trông giống ngày/giờ** (`"2026-08-17"`, `"18:00"`) thành kiểu Date nội bộ, kể cả khi ghi bằng API dưới dạng chuỗi JS thuần. Hậu quả: lỗi serialize qua Execution API, và mọi so sánh chuỗi kiểu `a.WorkDate >= dateFrom` sẽ sai. Đã sửa bằng cách:
1. Liệt kê MỌI cột dạng "YYYY-MM-DD"/"YYYY-MM"/"HH:MM" vào `PLAIN_TEXT_COLUMNS` (`Storage.Schema.gs`).
2. Định dạng Plain Text (`'@'`) phải đặt **TRƯỚC** khi ghi giá trị, không phải sau (`SheetRepository.append()` đã làm đúng — không tự appendRow rồi format sau).
3. **KHÔNG được áp `'@'` cho cả sheet** — đã xác nhận thực nghiệm việc này biến boolean thành chuỗi `"true"`/`"false"`, phá vỡ toàn bộ RBAC.

**Nếu thêm cột mới lưu ngày/giờ dạng chuỗi ngắn → PHẢI thêm vào `PLAIN_TEXT_COLUMNS`, nếu không sẽ tái phát lỗi này.**

---

## 5. Các module nghiệp vụ đã hoàn thành

### 5.1 Lịch trực tuần (module trọng tâm)
Trạng thái: `DRAFT → SUBMITTED → UNDER_REVIEW → (NEED_REVISION → quay lại DRAFT) → APPROVED → PUBLISHED`.
Không sửa trực tiếp lịch đã PUBLISHED — phải qua Đổi trực.

**Đổi trực**: `REQUESTED → REPLACEMENT_CONFIRMED → DEPT_HEAD_CONFIRMED → KHNV_APPROVED` (hoặc `REJECTED` ở bước chờ nào). Phòng KH-NV luôn là bước duyệt cuối (đơn giản hoá so với đặc tả gốc "duyệt nếu thuộc thẩm quyền" — xem mục 7).

### 5.2 Chấm công
Ghi trực tiếp khi `Status=OPEN`. Sau khi Phòng TC-HC "Chốt" (`lockAttendanceRange`, phạm vi toàn viện) → `Status=LOCKED`, mọi thay đổi phải qua Điều chỉnh công: `REQUESTED → DEPT_HEAD_CONFIRMED → APPROVED` (Phòng TC-HC duyệt cuối).

### 5.3 KPI
`KpiRules.ScoringMethodJson` hỗ trợ 2 kiểu: `LINEAR` (`{"type":"LINEAR","target":N,"maxScore":N}`) và `THRESHOLD` (`{"type":"THRESHOLD","thresholds":[{"min":N,"score":N},...]}`). Diễn giải bởi `computeKpiScore_` (`16_Kpi/Kpi.Engine.gs`). Chỉ SUPER_ADMIN/PHONG_KH_NV cấu hình chỉ tiêu. Kết quả `DRAFT → APPROVED` (Trưởng khoa/phòng duyệt theo phạm vi khoa).

### 5.4 Tổng hợp kế toán
`getPayrollAggregationForMonth` (`13_Payroll/Payroll.Aggregation.gs`) gộp SỐ LƯỢNG (không tính tiền) từ Attendance + DutyShifts (OFFICIAL) + Overtime (APPROVED) + MonthlyClinicalStats + KpiResults (APPROVED, điểm trung bình) theo tháng, xuất Excel. Đúng nguyên tắc "1 dữ liệu tạo ra 1 lần, dùng nhiều nghiệp vụ" — không nhập lại số liệu.

---

## 6. Giao diện (UI)

Alpine.js (CDN, ghim bản 3.15.12 + SRI) + Tailwind CSS (CDN, ghim 3.4.17), không build step. 1 file `ui/js/main.html` chứa toàn bộ state/method phía client.

**14 view** (`src/ui/views/`): Dashboard, Employees, Departments, Tasks, ClinicalAssignments, DutySchedule, DutySwap, Attendance, Overtime, Payroll, ClinicalStats, InsuranceAudit, Kpi, Admin, + Login (màn đăng nhập).

**Sidebar hiện tại**: 13 mục phẳng, KHÔNG PHÂN NHÓM — đã thống nhất với Product Owner (2026-08-15) sẽ tái cấu trúc thành 5 nhóm (Tổ chức / Công việc & Lịch trực / Chấm công & Thu nhập / Số liệu & Đánh giá / Quản trị tách riêng), **CHƯA THỰC HIỆN** — xem mục "Chưa làm".

---

## 7. Phân quyền (RBAC)

**11 vai trò** + GUEST (mặc định fail-closed, không quyền gì): `SUPER_ADMIN, BAN_GIAM_DOC, PHONG_KH_NV, PHONG_TC_KT, PHONG_TC_HC, TRUONG_KHOA, PHO_KHOA, NHAN_VIEN, KE_TOAN, NGUOI_LAP_LICH_TRUC, NGUOI_NHAP_SO_LIEU`.

**10 hành động**: CanView, CanCreate, CanEdit, CanDelete, CanSubmit, CanApprove, CanReject, CanPublish, CanLock, CanExport — phạm vi theo `DepartmentID` ('*' = toàn viện).

**Thứ tự phân giải quyền** (`hasPermission`, `Auth.Permission.gs`): SUPER_ADMIN bỏ qua mọi kiểm tra → override riêng theo UserID+DepartmentID → theo Role+DepartmentID cụ thể → theo Role+'*' (toàn viện) → từ chối.

**Uỷ quyền phân tán bị TẮT ở giai đoạn này** — chỉ SUPER_ADMIN gán quyền riêng qua `setEmployeePermissionOverride`. Quyền Trưởng khoa/phòng tự động cấp khi gán `HeadUserID` cho 1 Department (`seedHeadPermission_`).

---

## 8. Đã xác minh chạy thật (qua `clasp run` / Execution API, 2026-08-15)

- Toàn bộ vòng đời Lịch trực tuần + Đổi trực (DRAFT → PUBLISHED → swap → KHNV_APPROVED).
- Đăng nhập bằng Username (không phải EmployeeCode) → token → gọi API thật thành công.
- Tạo nhân viên, giao việc, chấm công, làm thêm giờ, số liệu chuyên môn, KPI rule + tính điểm, BHYT/xuất toán.
- Bootstrap từ đầu (Initialize System → đặt Username/mật khẩu quản trị đầu tiên → đăng nhập).

**2 lỗi thật đã phát hiện và sửa qua quá trình test này** (không phải lý thuyết): lỗi Sheets tự chuyển ngày/giờ (mục 4), lỗi tràn giới hạn 10 triệu ô do định dạng bulk quá tay (đã sửa bằng định dạng theo từng dòng lúc ghi).

**Chưa test được**: các luồng UI qua trình duyệt thật (chỉ test qua Execution API, chưa click-through đầy đủ từng màn hình).

---

## 9. Chưa làm / cố tình để sau

- **Sắp xếp lại sidebar theo nhóm** — đã thống nhất phương án (mục 6), chưa code.
- **Desktop App (Tauri + React + TypeScript)** — chưa bắt đầu. Gateway (`Core.HttpApi.gs`, RPC-over-POST, ~60 action) đã sẵn sàng cho việc này, chưa có client nào gọi tới ngoài test thủ công.
- **Quên mật khẩu tự phục vụ qua email** — hiện chỉ có "SUPER_ADMIN/Phòng TC-HC đặt lại mật khẩu tạm".
- **Refresh token / đa thiết bị nâng cao** — hiện access token 6 giờ cố định, chưa có refresh token riêng.
- **Xuất Excel theo đúng biểu mẫu kế toán thật** — hiện xuất bảng đơn giản, chưa khớp biểu mẫu chính thức của bệnh viện.
- **Thủ thuật/Phẫu thuật chi tiết theo vai trò chính/phụ** — hiện gộp chung trong `MonthlyClinicalStats.StatType`, chưa tách trường vai trò riêng như đặc tả gốc mô tả (VD "Phẫu thuật chính: 8, Phẫu thuật phụ: 5").
- **Báo cáo quản trị/Dashboard theo từng vai trò** (BGĐ toàn viện, KH-NV, TC-HC, TC-KT, Trưởng khoa, Nhân viên) — hiện chỉ có 1 Dashboard chung, chưa phân biệt nội dung theo vai trò.
- **Import Excel/CSV thật** (đọc file nhị phân) — hiện chỉ nhận CSV dán tay dạng text (client tự parse), chưa đọc file .xlsx/.csv upload trực tiếp.
- **AI Gateway** — hạ tầng còn nguyên từ hệ thống cũ, chưa có tính năng nào trong hệ thống hiện tại sử dụng.
- **Kết nối HIS** — cố ý KHÔNG làm, ngoài phạm vi theo đúng đặc tả.
- **Tối ưu quy trình phê duyệt, mở rộng tích hợp** — mở, chưa có kế hoạch cụ thể.

---

## 10. Vận hành

- **Repo**: https://github.com/Herrgaon/hospital-ai-platform (branch `main`)
- **Apps Script Project ID**: `1ovnMGttU0HW5quX11OLlBusv3YY7ErzJv-mFxll7OqBxOXFP9u9UvTQn`
- **Deployment ổn định** (URL Web App thật): `AKfycbwvTPoGJ9P7nidfF7gS98ysAoG2dRA3z6afO8Gece4MdO85dBavV-5LtTyO4EblIFHpVg`, hiện ở version **@10**
- **Quy trình chuẩn mỗi lần sửa code**: syntax check từng file `.gs` (`node --check`) + kiểm tra trùng tên hàm toàn cục + kiểm tra cân bằng thẻ HTML → `clasp push` → (nếu cần test sống) `clasp run` → `clasp deploy -i <deploymentId>` để cập nhật URL ổn định → `git commit` + `git push`.
- **clasp login cần scope riêng của project** (không phải scope mặc định của clasp) để `clasp run` hoạt động — xem OAuth Client đã tạo trên Google Cloud Console, dùng `clasp login --creds <file> --use-project-scopes --include-clasp-scopes`.

---

## 11. Lịch sử

Hệ thống này là **bản tái cấu trúc hoàn toàn** từ một hệ thống khác (Quản lý tài liệu/tri thức hành chính, kiểm tra thể thức văn bản theo Nghị định 30) — Product Owner quyết định chuyển đổi toàn bộ sang miền nghiệp vụ này ngày 2026-08-15, giữ lại hạ tầng kỹ thuật (Auth, Storage, AI Gateway, Admin) vì "vận hành rất mượt", xoá toàn bộ logic nghiệp vụ cũ (RuleEngine, Knowledge, Formatting, Document, Template, Workflow cũ). Thư mục `docs/` (00-vision.md → 17-project-structure.md, `adr/`) là tài liệu của hệ thống cũ đó, **chưa được dọn dẹp/thay thế** — nên xem là lỗi thời hoàn toàn, không tham khảo khi phát triển tiếp.
