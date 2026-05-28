/**
 * 從 APK 檔名中解析版本號 (例如: dodo-ledger-v1.0.8.apk -> 1.0.8)
 * @param fileName 檔案名稱
 * @returns 解析出的版本號字串，若格式不符則為 null
 */
export function parseVersionFromApkName(fileName: string): string | null {
  const match = fileName.match(/v(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

/**
 * 比較本地與遠端版本號大小 (三段式 Semantic Version 比較)
 * @param local 本地版本號 (如: "1.0.7" 或 "v1.0.7")
 * @param remote 遠端版本號 (如: "1.0.8" 或 "v1.0.8")
 * @returns 若遠端版本比本地版本新，返回 true，否則返回 false
 */
export function compareVersions(local: string, remote: string): boolean {
  const localClean = local.replace(/^v/, '');
  const remoteClean = remote.replace(/^v/, '');

  const localParts = localClean.split('.').map(Number);
  const remoteParts = remoteClean.split('.').map(Number);

  // 檢查是否含有非法非數值字元
  if (localParts.some(Number.isNaN) || remoteParts.some(Number.isNaN)) {
    return false;
  }

  // 補足長度使兩者對齊
  const maxLength = Math.max(localParts.length, remoteParts.length);
  for (let i = 0; i < maxLength; i++) {
    const localVal = localParts[i] || 0;
    const remoteVal = remoteParts[i] || 0;

    if (remoteVal > localVal) return true;
    if (remoteVal < localVal) return false;
  }

  return false;
}
