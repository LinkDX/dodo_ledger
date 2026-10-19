/**
 * 日期處理公用工具函式 (解決時區偏差與跨日日期問題)
 * 嚴禁使用 `toISOString().split('T')[0]`，因其為 UTC 時間，在 UTC+8 等東區時區於清晨 00:00~07:59 會偏移至前一天。
 */

/**
 * 將 Date 物件或時間戳記格式化為本地時間的 'YYYY-MM-DD'
 */
export function formatLocalDate(d: Date | number = new Date()): string {
  const date = typeof d === 'number' ? new Date(d) : d
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 取得今天本地日期的 'YYYY-MM-DD' 字串
 */
export function getTodayLocalDateString(): string {
  return formatLocalDate(new Date())
}

/**
 * 取得昨天本地日期的 'YYYY-MM-DD' 字串
 */
export function getYesterdayLocalDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatLocalDate(d)
}

/**
 * 判斷指定日期字串或 timestamp 是否為使用者的本地「今天」
 */
export function isDateToday(dateOrStr: string | number | Date): boolean {
  if (typeof dateOrStr === 'string') {
    return dateOrStr === getTodayLocalDateString()
  }
  return formatLocalDate(dateOrStr) === getTodayLocalDateString()
}

/**
 * 將 'YYYY-MM-DD' 日期字串解析為本地時間戳記 (毫秒)
 * @param dateStr 格式為 'YYYY-MM-DD'
 * @param options.preserveCurrentTime 若為 true 且日期為今天，則保留當下的時分秒毫秒；若為 false 或自訂日期，預設使用中午 12:00:00 避免邊界偏差
 */
export function parseLocalDateToTimestamp(
  dateStr: string,
  options?: { preserveCurrentTime?: boolean }
): number {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    return Date.now()
  }
  const [y, m, d] = parts
  const isToday = dateStr === getTodayLocalDateString()

  if (options?.preserveCurrentTime && isToday) {
    const now = new Date()
    return new Date(
      y,
      m - 1,
      d,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    ).getTime()
  }

  // 預設為本地時間中午 12:00:00，防範任何 DST 與跨時區邊界偏差
  return new Date(y, m - 1, d, 12, 0, 0, 0).getTime()
}
