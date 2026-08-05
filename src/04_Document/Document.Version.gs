// Quản lý phiên bản văn bản — xem docs/10-knowledge-design.md mục 5. Cài đặt đầy đủ thuộc Phase 2.

function createDocumentVersion(user, documentId, driveFileId, changeNote) {
  const document = getDocumentById(documentId);
  const nextVersion = Number(document.CurrentVersion) + 1;

  const version = getSheetRepository(SHEETS.DOCUMENT_VERSIONS).append({
    VersionID: generateId('VER'),
    DocumentID: documentId,
    VersionNumber: nextVersion,
    DriveFileID: driveFileId,
    ChangedByUserID: user.UserID,
    ChangeNote: changeNote || '',
    CreatedAt: nowIso()
  });

  getSheetRepository(SHEETS.DOCUMENTS).updateById('DocumentID', documentId, {
    CurrentVersion: nextVersion,
    DriveFileID: driveFileId,
    UpdatedAt: nowIso()
  });

  logAudit(user.UserID, 'DOCUMENT_VERSION_CREATED', 'Document', documentId, 'v' + nextVersion);
  return version;
}

function listDocumentVersions(documentId) {
  return getSheetRepository(SHEETS.DOCUMENT_VERSIONS).findAll().filter(function (v) { return v.DocumentID === documentId; });
}

// So sánh văn bản (FR-DOC-03) — chỉ đọc được nội dung dạng văn bản của Google Docs qua DocumentApp.
// Văn bản DOCX/DOC được convert sang Google Docs ngay khi nạp vào kho tri thức (xem
// Knowledge.Ingest.gs#ingestUploadedFile) nên vẫn so sánh được; PDF/ảnh thì không (nằm ngoài
// phạm vi Phase 2, xem docs/08-rule-engine.md mục 7).
function compareDocumentVersions(user, documentId, versionIdA, versionIdB) {
  const document = getDocumentById(documentId);
  requirePermission(user, document.LibraryID, 'CanView');

  const versions = listDocumentVersions(documentId);
  const versionA = versions.find(function (v) { return v.VersionID === versionIdA; });
  const versionB = versions.find(function (v) { return v.VersionID === versionIdB; });
  if (!versionA || !versionB) {
    throw new Error('Không tìm thấy phiên bản để so sánh.');
  }

  const textA = DocumentApp.openById(versionA.DriveFileID).getBody().getText();
  const textB = DocumentApp.openById(versionB.DriveFileID).getBody().getText();

  return {
    versionA: versionA.VersionNumber,
    versionB: versionB.VersionNumber,
    diff: diffLines_(textA, textB)
  };
}

function diffLines_(textA, textB) {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const lcsTable = buildLcsTable_(linesA, linesB);
  return backtrackDiff_(linesA, linesB, lcsTable);
}

function buildLcsTable_(a, b) {
  const table = [];
  for (let i = 0; i <= a.length; i++) {
    table.push(new Array(b.length + 1).fill(0));
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      table[i][j] = a[i - 1] === b[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }
  return table;
}

function backtrackDiff_(a, b, table) {
  const result = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'same', text: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.unshift({ type: 'added', text: b[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', text: a[i - 1] });
      i--;
    }
  }
  return result;
}
