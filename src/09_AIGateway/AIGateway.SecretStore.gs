// Nơi lưu trữ thật của API Key — tách biệt khỏi Sheet để không ai mở AIOP_SystemDB bằng
// quyền edit Sheet là đọc được Key. Sheet AIProviderConfig chỉ lưu ApiKeySecretRef (con trỏ),
// không lưu giá trị Key. Xem quyết định tại docs/13-security.md mục 4 và docs/99-bootstrap-report.md.
//
// Product Owner (2026-08-05): Giai đoạn đầu dùng PropertiesService (đủ dùng ở quy mô ~50 người
// dùng, chỉ Admin thao tác). Thiết kế theo Provider Pattern để sau này đổi sang Google Secret
// Manager (khi triển khai nhiều đơn vị hoặc yêu cầu bảo mật cao hơn) mà KHÔNG cần sửa
// AIGateway.KeyVault.gs hay bất kỳ module nào khác gọi qua secretStore — chỉ đổi SECRET_STORE_PROVIDER.

const SECRET_STORE_PROVIDERS = {
  PROPERTIES_SERVICE: 'PROPERTIES_SERVICE'
  // SECRET_MANAGER: 'SECRET_MANAGER'  // Bổ sung khi Product Owner phê duyệt chuyển đổi.
};

const ACTIVE_SECRET_STORE_PROVIDER = SECRET_STORE_PROVIDERS.PROPERTIES_SERVICE;

const secretStore = {
  save: function (refKey, plainValue) {
    return SECRET_STORE_BACKENDS[ACTIVE_SECRET_STORE_PROVIDER].save(refKey, plainValue);
  },
  get: function (refKey) {
    return SECRET_STORE_BACKENDS[ACTIVE_SECRET_STORE_PROVIDER].get(refKey);
  },
  remove: function (refKey) {
    return SECRET_STORE_BACKENDS[ACTIVE_SECRET_STORE_PROVIDER].remove(refKey);
  }
};

const SECRET_STORE_BACKENDS = {
  [SECRET_STORE_PROVIDERS.PROPERTIES_SERVICE]: {
    save: function (refKey, plainValue) {
      PropertiesService.getScriptProperties().setProperty('SECRET_' + refKey, plainValue);
      return refKey;
    },
    get: function (refKey) {
      return PropertiesService.getScriptProperties().getProperty('SECRET_' + refKey);
    },
    remove: function (refKey) {
      PropertiesService.getScriptProperties().deleteProperty('SECRET_' + refKey);
    }
  }
};
