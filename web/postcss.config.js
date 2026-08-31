// 移动端 vw 适配：375 设计稿，全部 px 转 vw
import pxToViewport from 'postcss-px-to-viewport'

export default {
  plugins: [
    pxToViewport({
      viewportWidth: 375,
      unitPrecision: 5,
      propList: ['*'],
      viewportUnit: 'vw',
      fontViewportUnit: 'vw',
      minPixelValue: 1,
      mediaQuery: false,
    }),
  ],
}
