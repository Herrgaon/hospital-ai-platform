// Số liệu hoạt động chuyên môn theo tháng — Giai đoạn 3. CHỈ số liệu tổng hợp theo nhân viên/tháng
// (VD "BS001, 08/2026, Khám ngoại trú, 426") — KHÔNG có trường nào chứa dữ liệu bệnh nhân, đúng
// nguyên tắc "không kết nối HIS" xuyên suốt hệ thống. Người nhập: NGUOI_NHAP_SO_LIEU được uỷ quyền
// theo khoa/phòng (qua setEmployeePermissionOverride, giống mô hình NGUOI_LAP_LICH_TRUC), hoặc
// Trưởng khoa/phòng.

function recordMonthlyClinicalStat(actingUser, input) {
  requirePermission(actingUser, input.departmentId, 'CanCreate');
  if (isBlank(input.employeeId) || isBlank(input.yearMonth) || isBlank(input.statType)) {
    throw new Error('Thiếu nhân viên, tháng hoặc loại số liệu.');
  }
  const repo = getSheetRepository(SHEETS.MONTHLY_CLINICAL_STATS);
  const duplicate = repo.findAll().find(function (s) {
    return s.EmployeeID === input.employeeId && s.YearMonth === input.yearMonth && s.StatType === input.statType;
  });
  if (duplicate) {
    const updated = repo.updateById('StatID', duplicate.StatID, { Value: input.value, Source: input.source || duplicate.Source, UpdatedAt: nowIso() });
    logAudit(actingUser.UserID, 'CLINICAL_STAT_UPDATED', 'MonthlyClinicalStat', duplicate.StatID, input.statType + ': ' + input.value);
    return updated;
  }

  const stat = repo.append({
    StatID: generateId('CSTAT'),
    EmployeeID: input.employeeId,
    DepartmentID: input.departmentId,
    YearMonth: input.yearMonth,
    StatType: input.statType,
    Value: input.value,
    Source: input.source || 'Manual',
    EnteredByUserID: actingUser.UserID,
    Notes: input.notes || '',
    CreatedAt: nowIso(), UpdatedAt: nowIso()
  });
  logAudit(actingUser.UserID, 'CLINICAL_STAT_RECORDED', 'MonthlyClinicalStat', stat.StatID, input.statType + ': ' + input.value);
  return stat;
}

// Nhập hàng loạt (dán từ Excel/CSV, client tự phân tách thành mảng rows trước khi gửi lên — Apps
// Script không cần tự đọc file nhị phân). Mỗi dòng upsert độc lập qua recordMonthlyClinicalStat,
// không rollback cả lô nếu 1 dòng lỗi (báo lỗi riêng từng dòng để người nhập biết sửa đúng chỗ).
function importMonthlyClinicalStats(actingUser, departmentId, yearMonth, rows) {
  requirePermission(actingUser, departmentId, 'CanCreate');
  const employees = listEmployeesByDepartment(departmentId);
  const results = rows.map(function (row) {
    const employee = employees.find(function (e) { return e.EmployeeCode === row.employeeCode; });
    if (!employee) return { employeeCode: row.employeeCode, success: false, error: 'Không tìm thấy mã nhân viên trong khoa/phòng này.' };
    try {
      recordMonthlyClinicalStat(actingUser, {
        employeeId: employee.EmployeeID, departmentId: departmentId, yearMonth: yearMonth,
        statType: row.statType, value: row.value, source: 'Import'
      });
      return { employeeCode: row.employeeCode, success: true };
    } catch (e) {
      return { employeeCode: row.employeeCode, success: false, error: e.message };
    }
  });
  logAudit(actingUser.UserID, 'CLINICAL_STAT_IMPORTED', 'Department', departmentId, yearMonth + ' (' + results.length + ' dòng)');
  return results;
}

function deleteMonthlyClinicalStat(actingUser, statId) {
  const stat = getSheetRepository(SHEETS.MONTHLY_CLINICAL_STATS).findById('StatID', statId);
  if (!stat) throw new Error('Không tìm thấy số liệu.');
  requirePermission(actingUser, stat.DepartmentID, 'CanDelete');
  getSheetRepository(SHEETS.MONTHLY_CLINICAL_STATS).updateById('StatID', statId, { Value: 0, Notes: '[Đã xoá]', UpdatedAt: nowIso() });
  logAudit(actingUser.UserID, 'CLINICAL_STAT_DELETED', 'MonthlyClinicalStat', statId, '');
  return { success: true };
}

function listMonthlyClinicalStatsByDepartment(user, departmentId, yearMonth) {
  requirePermission(user, departmentId, 'CanView');
  return getSheetRepository(SHEETS.MONTHLY_CLINICAL_STATS).findAll().filter(function (s) {
    return s.DepartmentID === departmentId && (!yearMonth || s.YearMonth === yearMonth);
  });
}

function listMyMonthlyClinicalStats(user, yearMonth) {
  const employee = getEmployeeByUserId_(user.UserID);
  if (!employee) return [];
  return getSheetRepository(SHEETS.MONTHLY_CLINICAL_STATS).findAll().filter(function (s) {
    return s.EmployeeID === employee.EmployeeID && (!yearMonth || s.YearMonth === yearMonth);
  });
}
