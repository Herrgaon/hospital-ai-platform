// API Key không bao giờ được lưu hay trả về ở dạng đầy đủ ra ngoài module này — xem docs/13-security.md
// mục 4. Việc lưu trữ thật sự uỷ quyền cho AIGateway.SecretStore.gs (Provider Pattern), module này chỉ
// lo việc sinh tham chiếu (ref) gắn với một ConfigID và che dấu (mask) khi hiển thị ra UI.

function storeApiKey(configId, plainTextKey) {
  const refKey = configId;
  secretStore.save(refKey, plainTextKey);
  return refKey;
}

function retrieveApiKey(refKey) {
  const value = secretStore.get(refKey);
  if (isBlank(value)) {
    throw new Error('Không tìm thấy API Key cho tham chiếu: ' + refKey);
  }
  return value;
}

function revokeApiKey(refKey) {
  secretStore.remove(refKey);
}

function maskApiKey(plainTextKey) {
  if (isBlank(plainTextKey) || plainTextKey.length < 4) return '****';
  return '****' + plainTextKey.slice(-4);
}
