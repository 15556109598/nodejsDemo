// 抛物线飞入购物车动画
// 外层 div 控制 translateX（linear），内层圆点控制 translateY（前半程上抛后下落）
export function flyToCart(startX: number, startY: number, target: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    // 目标元素中心（视口坐标）
    const rect = target.getBoundingClientRect()
    const dx = rect.left + rect.width / 2 - startX
    const dy = rect.top + rect.height / 2 - startY

    // 外层：fixed 定位在起点
    const outer = document.createElement('div')
    outer.style.cssText = `position:fixed;left:${startX}px;top:${startY}px;z-index:9999;pointer-events:none;`

    // 内层：20px 橙色渐变圆点
    const dot = document.createElement('div')
    dot.style.cssText =
      'width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#FF6B35,#FF8F5E);box-shadow:0 2px 8px rgba(255,107,53,0.5);'
    outer.appendChild(dot)
    document.body.appendChild(outer)

    const DURATION = 600

    // 外层：X 方向匀速
    const animX = outer.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, 0)` }], {
      duration: DURATION,
      easing: 'linear',
      fill: 'forwards',
    })

    // 内层：Y 方向前半程上抛（cubic-bezier(0.5,0,1,1)），后半程加速下落
    const animY = dot.animate(
      [
        { transform: 'translateY(0)', easing: 'cubic-bezier(0.5, 0, 1, 1)' },
        { transform: 'translateY(-36px)', offset: 0.4, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
        { transform: `translateY(${dy}px)` },
      ],
      { duration: DURATION, fill: 'forwards' }
    )

    Promise.all([animX.finished, animY.finished])
      .catch(() => undefined)
      .finally(() => {
        outer.remove()
        resolve()
      })
  })
}
