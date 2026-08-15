// Diễn giải ScoringMethodJson của KpiRules — KHÔNG hard-code công thức tính điểm trong code, mọi quy
// tắc đọc từ dữ liệu (KpiRules.ScoringMethodJson), thay đổi bằng cách sửa dữ liệu (Admin/Phòng KH-NV),
// không cần sửa code/deploy lại. Cùng tinh thần "single source of truth qua JSON cấu hình" như
// RuleEngine trước đây dùng cho kiểm tra thể thức văn bản.
//
// 2 kiểu cơ bản, đủ dùng cho V0.1 (đặc tả chưa định nghĩa trọng số/mức đạt cụ thể theo từng vị trí):
// LINEAR (điểm tỷ lệ thuận với target, có trần maxScore) và THRESHOLD (điểm bậc thang theo ngưỡng).
function computeKpiScore_(actualValue, scoringMethodJson) {
  let method;
  try {
    method = JSON.parse(scoringMethodJson);
  } catch (e) {
    throw new Error('Cấu hình cách quy đổi điểm không hợp lệ (không phải JSON).');
  }

  if (method.type === 'LINEAR') {
    if (!method.target || method.target <= 0) throw new Error('Cấu hình LINEAR thiếu target hợp lệ.');
    const maxScore = method.maxScore != null ? method.maxScore : 10;
    const ratio = Number(actualValue) / Number(method.target);
    return Math.min(maxScore, Math.round(ratio * maxScore * 100) / 100);
  }

  if (method.type === 'THRESHOLD') {
    if (!Array.isArray(method.thresholds) || method.thresholds.length === 0) {
      throw new Error('Cấu hình THRESHOLD thiếu danh sách thresholds.');
    }
    const sorted = method.thresholds.slice().sort(function (a, b) { return b.min - a.min; });
    const matched = sorted.find(function (t) { return Number(actualValue) >= t.min; });
    return matched ? matched.score : 0;
  }

  throw new Error('Loại cách quy đổi điểm không được hỗ trợ: ' + method.type);
}

// Kiểm tra cấu trúc JSON hợp lệ trước khi lưu KpiRules — tách riêng khỏi computeKpiScore_ (hàm đó chỉ
// lo tính điểm, không lo báo lỗi cấu hình lúc TẠO rule) để validate được ngay khi Admin/Phòng KH-NV
// nhập cấu hình, không phải đợi tới lần tính điểm đầu tiên mới phát hiện sai.
function isValidScoringMethodJson_(scoringMethodJson) {
  let method;
  try {
    method = JSON.parse(scoringMethodJson);
  } catch (e) {
    return false;
  }
  if (method.type === 'LINEAR') return typeof method.target === 'number' && method.target > 0;
  if (method.type === 'THRESHOLD') return Array.isArray(method.thresholds) && method.thresholds.length > 0 &&
    method.thresholds.every(function (t) { return typeof t.min === 'number' && typeof t.score === 'number'; });
  return false;
}

// --- Độ phức tạp nhiệm vụ (§9 đặc tả KPI + Quản lý Trực V1) ---
//
// 6 tiêu chí + trọng số ĐÚNG NGUYÊN VĂN bảng trong đặc tả (đây là giá trị đặc tả đã cho cụ thể, không
// phải "chưa chốt" — khác với "hệ số chuyển đổi P thành giá trị KPI" ở dưới, đặc tả nói rõ CHƯA CHỐT).
// Giữ trong code (không đưa vào Sheet cấu hình) vì đây là công thức đã có sẵn số liệu rõ ràng trong
// đặc tả, giống cách computeKpiScore_ đọc JSON — nhưng bảng 6 tiêu chí này bản thân đã LÀ cấu hình gốc
// được duyệt, không phải baby step tạm; nếu bệnh viện muốn đổi phải sửa đặc tả trước.
const TASK_COMPLEXITY_CRITERIA = [
  { key: 'chuyenMon', label: 'Yêu cầu chuyên môn/nghiệp vụ', weight: 0.20 },
  { key: 'quyMo', label: 'Quy mô/khối lượng', weight: 0.15 },
  { key: 'phoiHop', label: 'Mức độ phối hợp', weight: 0.15 },
  { key: 'tuChu', label: 'Tự chủ/ra quyết định', weight: 0.15 },
  { key: 'trachNhiem', label: 'Trách nhiệm/rủi ro', weight: 0.20 },
  { key: 'dacThu', label: 'Đặc thù/không thường xuyên', weight: 0.15 }
];

function isValidTaskComplexityScores_(scores) {
  if (!scores || typeof scores !== 'object') return false;
  return TASK_COMPLEXITY_CRITERIA.every(function (c) {
    const v = scores[c.key];
    return typeof v === 'number' && v >= 1 && v <= 5;
  });
}

// P = Σ(điểm tiêu chí × trọng số) — đúng công thức §9. Phân loại theo đúng 5 mức + khoảng đã cho.
function computeTaskComplexity_(scores) {
  if (!isValidTaskComplexityScores_(scores)) {
    throw new Error('Điểm độ phức tạp không hợp lệ — mỗi tiêu chí phải chấm từ 1 đến 5.');
  }
  const p = Math.round(TASK_COMPLEXITY_CRITERIA.reduce(function (sum, c) {
    return sum + scores[c.key] * c.weight;
  }, 0) * 100) / 100;

  let level;
  if (p <= 1.79) level = 'Đơn giản';
  else if (p <= 2.59) level = 'Thông thường';
  else if (p <= 3.39) level = 'Trung bình';
  else if (p <= 4.19) level = 'Phức tạp';
  else level = 'Rất phức tạp';

  return { p: p, level: level };
}

// "Các hệ số chuyển đổi [P] thành giá trị KPI CHƯA CHỐT" (đặc tả §9, nguyên văn) — dùng thẳng P (thang
// 1-5) làm hệ số nhân trong công thức §8 là lựa chọn TẠM THỜI, đơn giản nhất, minh bạch nhất để điều
// chỉnh sau (đổi 1 dòng ở đây, không phải sửa lại toàn bộ luồng) — KHÔNG phải kết luận nghiệp vụ chính
// thức, chờ bệnh viện phê duyệt hệ số quy đổi thật.
function taskComplexityToMultiplier_(complexityP) {
  return complexityP || 1;
}

// Giá trị hoàn thành (§8) = Giá trị cơ sở × Hệ số phức tạp × %hoàn thành × Hệ số chất lượng.
// task.Progress đã có sẵn (0-100, Task.Service.gs#updateTaskProgress) — đây chính là "%hoàn thành" của
// riêng task đó trong công thức, KHÔNG phải %hoàn thành công việc tổng hợp cả kỳ (xem hàm dưới).
function computeTaskCompletionValue_(task) {
  const baseValue = Number(task.BaseValue) || 0;
  const complexityMultiplier = taskComplexityToMultiplier_(Number(task.ComplexityP) || 0) || 1;
  const progressRatio = (Number(task.Progress) || 0) / 100;
  const qualityCoefficient = (task.QualityCoefficient !== '' && task.QualityCoefficient != null) ? Number(task.QualityCoefficient) : 1;
  return baseValue * complexityMultiplier * progressRatio * qualityCoefficient;
}

// §11 "Nhiều người cùng làm" — không có dòng TaskParticipants nào ứng với task = coi AssigneeEmployeeID
// nhận 100% giá trị (tương thích ngược với mọi Task tạo trước khi có tính năng này).
function getTaskParticipantShares_(task) {
  const rows = getSheetRepository(SHEETS.TASK_PARTICIPANTS).findAll().filter(function (p) { return p.TaskID === task.TaskID; });
  if (rows.length === 0) {
    return task.AssigneeEmployeeID ? [{ EmployeeID: task.AssigneeEmployeeID, ValuePercent: 100 }] : [];
  }
  return rows.map(function (r) { return { EmployeeID: r.EmployeeID, ValuePercent: Number(r.ValuePercent) || 0 }; });
}

// %hoàn thành công việc (kỳ) = Σ Giá trị hoàn thành / Σ Giá trị nhiệm vụ được giao × 100 (§8) — CHỈ
// tính trên KPI Task cấp cao nhất (ParentTaskID rỗng + IsKpiTask=true, đúng §10 "không tính trùng
// task": Subtask không bao giờ vào công thức này dù có đánh dấu IsKpiTask hay không), trong khoảng
// [dateFrom, dateTo] theo AssignedDate. Giá trị mỗi task được nhân theo % phần chia của nhân viên này
// nếu task có nhiều người cùng làm (§11).
function computeTaskCompletionPercentForPeriod_(employeeId, dateFrom, dateTo) {
  const allTasks = getSheetRepository(SHEETS.TASKS).findAll().filter(function (t) {
    if (!t.IsKpiTask || !isBlank(t.ParentTaskID)) return false;
    if (t.AssignedDate < dateFrom || t.AssignedDate > dateTo) return false;
    return true;
  });

  let totalAssigned = 0;
  let totalCompleted = 0;
  allTasks.forEach(function (task) {
    const shares = getTaskParticipantShares_(task);
    const myShare = shares.find(function (s) { return s.EmployeeID === employeeId; });
    if (!myShare) return;
    const ratio = myShare.ValuePercent / 100;
    totalAssigned += (Number(task.BaseValue) || 0) * ratio;
    totalCompleted += computeTaskCompletionValue_(task) * ratio;
  });

  return totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 10000) / 100 : null;
}

// Tự tính ActualValue gợi ý cho 1 chỉ tiêu KPI có DataSourceType cấu hình (§14) — null nếu không tự
// tính được (MANUAL hoặc thiếu dữ liệu), để submitKpiResult vẫn yêu cầu người dùng xác nhận/nhập tay.
function computeSuggestedActualValue_(rule, employeeId, period) {
  if (rule.DataSourceType === 'TASK_COMPLETION') {
    const range = yearMonthRange_(period);
    return computeTaskCompletionPercentForPeriod_(employeeId, range.from, range.to);
  }
  if (rule.DataSourceType === 'CLINICAL_STAT' && !isBlank(rule.DataSourceKey)) {
    const rows = getSheetRepository(SHEETS.MONTHLY_CLINICAL_STATS).findAll().filter(function (s) {
      return s.EmployeeID === employeeId && s.YearMonth === period && s.StatType === rule.DataSourceKey;
    });
    if (rows.length === 0) return null;
    return rows.reduce(function (sum, s) { return sum + (Number(s.Value) || 0); }, 0);
  }
  return null;
}

// KPI cơ bản = Σ(điểm nhóm × trọng số nhóm), KPI cuối = min(100, KPI cơ bản + điểm cộng) — đúng §13.
// Nhóm không có kết quả KPI nào ĐÃ DUYỆT trong kỳ đóng góp 0 điểm cho nhóm đó (diễn giải rõ ràng, dễ
// điều chỉnh — đặc tả không nói rõ trường hợp thiếu dữ liệu 1 nhóm phải xử lý thế nào).
function computeFinalKpiForEmployeePeriod_(employeeId, period) {
  const approvedResults = getSheetRepository(SHEETS.KPI_RESULTS).findAll().filter(function (r) {
    return r.EmployeeID === employeeId && r.Period === period && r.Status === 'APPROVED';
  });
  const rules = getSheetRepository(SHEETS.KPI_RULES).findAll();
  const ruleById = {};
  rules.forEach(function (r) { ruleById[r.RuleID] = r; });
  const groups = getSheetRepository(SHEETS.KPI_CRITERION_GROUPS).findAll().filter(function (g) { return g.Status === 'Active'; });

  const groupBreakdown = groups.map(function (group) {
    const groupResults = approvedResults.filter(function (r) {
      const rule = ruleById[r.RuleID];
      return rule && rule.GroupID === group.GroupID;
    });
    let groupScore = 0;
    if (groupResults.length > 0) {
      const totalWeight = groupResults.reduce(function (s, r) { return s + (Number(ruleById[r.RuleID].Weight) || 1); }, 0);
      const weightedSum = groupResults.reduce(function (s, r) { return s + (Number(r.Score) || 0) * (Number(ruleById[r.RuleID].Weight) || 1); }, 0);
      groupScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    return { groupId: group.GroupID, groupName: group.GroupName, weight: Number(group.Weight) || 0, score: Math.round(groupScore * 100) / 100, resultCount: groupResults.length };
  });

  const baseKpi = groupBreakdown.reduce(function (sum, g) { return sum + g.score * (g.weight / 100); }, 0);
  const bonusPoints = getSheetRepository(SHEETS.KPI_BONUS_POINTS).findAll()
    .filter(function (b) { return b.EmployeeID === employeeId && b.Period === period; })
    .reduce(function (sum, b) { return sum + (Number(b.Points) || 0); }, 0);
  const finalKpi = Math.min(100, Math.round((baseKpi + bonusPoints) * 100) / 100);

  return {
    employeeId: employeeId, period: period, groupBreakdown: groupBreakdown,
    baseKpi: Math.round(baseKpi * 100) / 100, bonusPoints: bonusPoints, finalKpi: finalKpi
  };
}
