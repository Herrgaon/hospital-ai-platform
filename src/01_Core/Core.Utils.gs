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
