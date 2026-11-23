export interface HorizontalScrollTargetMetrics {
  containerClientWidth: number
  containerScrollWidth: number
  containerOffsetLeft: number
  targetOffsetLeft: number
  targetOffsetWidth: number
  isContainerOffsetParent: boolean
}

/**
 * 計算讓目標卡片在橫向捲動容器內水平置中的 scrollLeft 數值。
 * 若容器尚未顯示（寬度為 0）或目標尚未完成排版，回傳 null 以避免誤將捲軸設為 0。
 */
export function computeCenteredScrollLeft(metrics: HorizontalScrollTargetMetrics): number | null {
  const {
    containerClientWidth,
    containerScrollWidth,
    containerOffsetLeft,
    targetOffsetLeft,
    targetOffsetWidth,
    isContainerOffsetParent
  } = metrics

  if (containerClientWidth <= 0 || targetOffsetWidth <= 0) {
    return null
  }

  const relativeLeft = isContainerOffsetParent
    ? targetOffsetLeft
    : targetOffsetLeft - containerOffsetLeft

  const rawTargetLeft = relativeLeft - (containerClientWidth / 2) + (targetOffsetWidth / 2)
  const maxScrollLeft = Math.max(0, containerScrollWidth - containerClientWidth)

  return Math.max(0, Math.min(rawTargetLeft, maxScrollLeft))
}
