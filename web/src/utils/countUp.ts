// rAF 数字滚动：从 from 滚动到 to，可保留整数 / 2 位小数
export function countUp(el: HTMLElement, from: number, to: number, duration = 800, decimals = 0): void {
  const startTime = performance.now()

  function frame(now: number) {
    const progress = Math.min(1, (now - startTime) / duration)
    // easeOutCubic 缓动
    const eased = 1 - Math.pow(1 - progress, 3)
    const value = from + (to - from) * eased
    el.textContent = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
    if (progress < 1) {
      requestAnimationFrame(frame)
    }
  }

  requestAnimationFrame(frame)
}
