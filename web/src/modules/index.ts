// ============================================
// 应用模块注册表（入口页「模块导航」的数据源）
// --------------------------------------------
// 新增模块只需两步：
//   1. 在 APP_MODULES 数组末尾追加一条配置（id 唯一）；
//   2. 在 web/src/router/index.ts 的 routes 中登记该模块的 path（外链模块则不必登记）。
// 入口页会自动渲染新卡片，无需改动入口页代码。
//
// 字段说明：
//   id:          模块唯一标识
//   name:        模块名称（卡片标题）
//   description: 一句话描述
//   icon:        图标（emoji，或 Vant 图标名，见 iconType）
//   iconType:    'emoji' | 'vant'，默认 emoji
//   path:        站内路由路径；external 为 true 时填完整 URL
//   status:      'available' 可进入 | 'coming' 开发中（置灰不可点）
//   badge?:      卡片右上角角标文案
//   accent?:     图标砖底色（浅色；入口页用深色 emoji/图标压在其上）
//   external?:   是否外部链接
// ============================================

export interface AppModule {
  id: string
  name: string
  description: string
  icon: string
  iconType?: 'emoji' | 'vant'
  path: string
  status: 'available' | 'coming'
  badge?: string
  accent?: string
  external?: boolean
}

export const APP_MODULES: AppModule[] = [
  {
    id: 'ordering',
    name: '小厨点餐',
    description: '在线点餐、订单跟踪与积分签到',
    icon: '🍜',
    path: '/app',
    status: 'available',
    badge: '原有',
    accent: '#FBE3D6',
  },
  {
    id: 'snacks',
    name: '零食日期管理',
    description: '登记零食保质期，临期与过期自动提醒',
    icon: '🍪',
    path: '/snacks',
    status: 'available',
    badge: '新增',
    accent: '#F7EDD8',
  },
  {
    id: 'couple',
    name: '我们的空间',
    description: '纪念日、每日一句、天气与经期记录',
    icon: '💗',
    path: '/couple',
    status: 'available',
    badge: '新增',
    accent: '#FBE9E5',
  },
]
