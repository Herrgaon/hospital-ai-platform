function generateId(prefix) {
  const raw = Utilities.getUuid().replace(/-/g, '').substring(0, 8);
  return prefix + '_' + raw;
}

function nowIso() {
  return new Date().toISOString();
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

// 1mm = 2.834645669pt — dùng để quy đổi giữa đơn vị point của Document Body (DocumentApp)
// và đơn vị mm dùng trong Rule JSON (đúng quy ước đo lường của Nghị định 30/2020/NĐ-CP).
const MM_TO_PT = 2.834645669;

function mmToPoints(mm) {
  return mm * MM_TO_PT;
}

function pointsToMm(pt) {
  return pt / MM_TO_PT;
}

function mostFrequent(values) {
  const counts = {};
  values.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
  let best = null;
  let bestCount = 0;
  Object.keys(counts).forEach(function (v) {
    if (counts[v] > bestCount) { best = v; bestCount = counts[v]; }
  });
  return best;
}
