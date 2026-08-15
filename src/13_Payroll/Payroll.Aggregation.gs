// Tổng hợp trực + Trung tâm tổng hợp cho kế toán — Giai đoạn 2. CHỈ thu thập/đối chiếu/tổng hợp SỐ
// LƯỢNG (ngày công, số ca trực, số giờ làm thêm...) — không tính tiền, không hard-code công thức quy
// đổi ra tiền (đúng nguyên tắc "không mặc định thay thế phần mềm kế toán"). Số liệu thủ thuật/phẫu
// thuật/BHYT (Giai đoạn 3) chưa có ở đây — cột tương ứng sẽ bổ sung khi module đó tồn tại, không dựng
// trước cột rỗng chờ sẵn (YAGNI).

// So sánh chuỗi ngày dạng YYYY-MM-DD — "-31" làm cận trên luôn hợp lệ vì không tháng nào có ngày > 31,
// so sánh lexicographic là đủ, không cần tính ngày cuối tháng thật.
function yearMonthRange_(yearMonth) {
  return { from: yearMonth + '-01', to: yearMonth + '-31' };
}

function getDutySummaryForMonth(user, departmentId, yearMonth) {
  requirePermission(user, departmentId, 'CanView');
  const range = yearMonthRange_(yearMonth);
  const employees = listEmployeesByDepartment(departmentId).filter(function (e) { return e.Status === 'Active'; });
  const shifts = getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().filter(function (s) {
    return s.DepartmentID === departmentId && s.Status === 'OFFICIAL' && s.ShiftDate >= range.from && s.ShiftDate <= range.to;
  });

  return employees.map(function (employee) {
    const myShifts = shifts.filter(function (s) { return s.EmployeeID === employee.EmployeeID; });
    const countByType = {};
    myShifts.forEach(function (s) { countByType[s.DutyType] = (countByType[s.DutyType] || 0) + 1; });
    return { EmployeeID: employee.EmployeeID, FullName: employee.FullName, countByType: countByType, total: myShifts.length };
  });
}

// departmentId rỗng/'*' = toàn viện (yêu cầu quyền CanView phạm vi '*', đúng vai trò Phòng TC-KT/Kế
// toán/Ban Giám đốc). Có departmentId = chỉ trong 1 khoa/phòng (Trưởng khoa xem trước khi gửi kế toán).
// Từ Giai đoạn 3: gộp thêm số liệu chuyên môn (thủ thuật/phẫu thuật/khám...) và điểm KPI trung bình đã
// duyệt trong tháng — đúng tinh thần "1 dữ liệu tạo ra 1 lần, dùng cho nhiều nghiệp vụ" của đặc tả,
// không nhập lại số liệu đã có ở Task/DutySchedule/ClinicalStats/Kpi.
function getPayrollAggregationForMonth(actingUser, departmentId, yearMonth) {
  const scope = departmentId || '*';
  requirePermission(actingUser, scope, 'CanView');
  const range = yearMonthRange_(yearMonth);

  const employees = (departmentId ? listEmployeesByDepartment(departmentId) : listEmployees()).filter(function (e) { return e.Status === 'Active'; });
  const attendanceRows = getSheetRepository(SHEETS.ATTENDANCE).findAll().filter(function (a) { return a.WorkDate >= range.from && a.WorkDate <= range.to; });
  const dutyShiftRows = getSheetRepository(SHEETS.DUTY_SHIFTS).findAll().filter(function (s) { return s.Status === 'OFFICIAL' && s.ShiftDate >= range.from && s.ShiftDate <= range.to; });
  const overtimeRows = getSheetRepository(SHEETS.OVERTIME).findAll().filter(function (o) { return o.Status === 'APPROVED' && o.WorkDate >= range.from && o.WorkDate <= range.to; });
  const clinicalStatRows = getSheetRepository(SHEETS.MONTHLY_CLINICAL_STATS).findAll().filter(function (s) { return s.YearMonth === yearMonth; });
  const kpiResultRows = getSheetRepository(SHEETS.KPI_RESULTS).findAll().filter(function (r) { return r.Period === yearMonth && r.Status === 'APPROVED'; });

  return employees.map(function (employee) {
    const myAttendance = attendanceRows.filter(function (a) { return a.EmployeeID === employee.EmployeeID; });
    const workDays = myAttendance.filter(function (a) { return isBlank(a.LeaveType); }).reduce(function (sum, a) { return sum + (Number(a.WorkUnits) || 0); }, 0);
    const leaveDays = myAttendance.filter(function (a) { return !isBlank(a.LeaveType); }).reduce(function (sum, a) { return sum + (Number(a.WorkUnits) || 0); }, 0);

    const myShifts = dutyShiftRows.filter(function (s) { return s.EmployeeID === employee.EmployeeID; });
    const dutyCountByType = {};
    myShifts.forEach(function (s) { dutyCountByType[s.DutyType] = (dutyCountByType[s.DutyType] || 0) + 1; });

    const myOvertime = overtimeRows.filter(function (o) { return o.EmployeeID === employee.EmployeeID; });
    const overtimeHours = myOvertime.filter(function (o) { return o.OvertimeType === 'LAM_THEM_GIO'; }).reduce(function (sum, o) { return sum + (Number(o.Hours) || 0); }, 0);
    const outOfHoursHours = myOvertime.filter(function (o) { return o.OvertimeType === 'LAM_NGOAI_GIO'; }).reduce(function (sum, o) { return sum + (Number(o.Hours) || 0); }, 0);

    const myClinicalStats = clinicalStatRows.filter(function (s) { return s.EmployeeID === employee.EmployeeID; });
    const clinicalStatByType = {};
    myClinicalStats.forEach(function (s) { clinicalStatByType[s.StatType] = (clinicalStatByType[s.StatType] || 0) + (Number(s.Value) || 0); });

    const myKpiResults = kpiResultRows.filter(function (r) { return r.EmployeeID === employee.EmployeeID; });
    const avgKpiScore = myKpiResults.length > 0
      ? Math.round((myKpiResults.reduce(function (sum, r) { return sum + (Number(r.Score) || 0); }, 0) / myKpiResults.length) * 100) / 100
      : null;

    return {
      EmployeeID: employee.EmployeeID, EmployeeCode: employee.EmployeeCode, FullName: employee.FullName,
      DepartmentID: employee.DepartmentID, WorkDays: workDays, LeaveDays: leaveDays,
      DutyShiftCount: myShifts.length, DutyCountByType: dutyCountByType,
      OvertimeHours: overtimeHours, OutOfHoursHours: outOfHoursHours,
      ClinicalStatByType: clinicalStatByType, AvgKpiScore: avgKpiScore
    };
  });
}

function exportPayrollAggregationToExcel(actingUser, departmentId, yearMonth) {
  const scope = departmentId || '*';
  requirePermission(actingUser, scope, 'CanExport');
  const rows = getPayrollAggregationForMonth(actingUser, departmentId, yearMonth);

  const tempSpreadsheet = SpreadsheetApp.create('TongHopKeToan_' + yearMonth + '_' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmmss'));
  const sheet = tempSpreadsheet.getSheets()[0];
  const headers = ['Mã NV', 'Họ tên', 'Ngày công', 'Ngày nghỉ', 'Số ca trực', 'Giờ làm thêm', 'Giờ làm ngoài giờ', 'Điểm KPI TB (đã duyệt)'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length > 0) {
    const values = rows.map(function (r) {
      return [r.EmployeeCode, r.FullName, r.WorkDays, r.LeaveDays, r.DutyShiftCount, r.OvertimeHours, r.OutOfHoursHours, r.AvgKpiScore != null ? r.AvgKpiScore : ''];
    });
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }

  const tempFile = DriveApp.getFileById(tempSpreadsheet.getId());
  const excelBlob = tempFile.getAs(MimeType.MICROSOFT_EXCEL);
  const excelFile = getExportsFolder().createFile(excelBlob);
  tempFile.setTrashed(true);

  logAudit(actingUser.UserID, 'PAYROLL_AGGREGATION_EXPORTED', 'PayrollAggregation', scope, yearMonth + ' (' + rows.length + ' dòng)');
  return { fileId: excelFile.getId(), url: excelFile.getUrl() };
}
