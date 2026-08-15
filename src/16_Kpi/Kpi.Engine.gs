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
