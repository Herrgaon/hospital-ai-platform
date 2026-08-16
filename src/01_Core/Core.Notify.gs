// Thông báo qua email (MailApp — đã sẵn có trong Google Workspace, không thêm hạ tầng) —
// xem docs/07-workflow.md mục 6 và PROJECT_CONSTITUTION mục 6 (Thông báo).
// Mọi lỗi gửi mail đều bị NUỐT có chủ đích (try/catch) — một thông báo gửi lỗi không được phép làm
// hỏng hành động nghiệp vụ chính (submit/duyệt/từ chối vẫn phải thành công dù mail gửi thất bại).

function findApproversForDepartment(departmentId, module) {
  return getSheetRepository(SHEETS.USERS).findAll()
    .filter(function (u) { return u.Status === 'Active'; })
    .filter(function (u) { return hasPermission(u, departmentId, 'CanApprove', module); });
}

function notifyApprovers(actingUser, departmentId, subject, body, module) {
  const approvers = findApproversForDepartment(departmentId, module);
  const emails = approvers
    .map(function (u) { return u.Email; })
    .filter(function (email) { return email && email.toLowerCase() !== actingUser.Email.toLowerCase(); });
  sendNotificationEmail_(emails, subject, body);
}

function notifyUser(userId, subject, body) {
  const user = getSheetRepository(SHEETS.USERS).findById('UserID', userId);
  if (!user) return;
  sendNotificationEmail_([user.Email], subject, body);
}

function sendNotificationEmail_(emails, subject, body) {
  const uniqueEmails = Array.from(new Set(emails.filter(function (e) { return !isBlank(e); })));
  if (uniqueEmails.length === 0) return;
  try {
    MailApp.sendEmail({
      to: uniqueEmails.join(','),
      subject: '[BVĐK Đông Sơn] ' + subject,
      body: body + '\n\n--\nThư tự động từ Hệ thống Quản lý Công việc – Phân công – Lịch trực, vui lòng không trả lời email này.'
    });
  } catch (e) {
    // Không throw lại — hết quota MailApp hoặc lỗi mạng không được phép chặn hành động nghiệp vụ chính.
    Logger.log('Gửi email thông báo thất bại: ' + e.message);
  }
}
