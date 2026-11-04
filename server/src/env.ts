// 环境变量集中管理：先加载 .env，再导出 env 常量
import * as dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  // 默认临近过期阈值（天）
  NEAR_DAYS: Number(process.env.NEAR_DAYS) || 7,
  // 零食图片所在的 Supabase Storage 桶（公开读）
  SNACKS_BUCKET: process.env.SNACKS_BUCKET || 'snacks',
  // 情侣空间：访问口令（留空则模块公开可见，页面会提示未上锁）
  COUPLE_PASSCODE: process.env.COUPLE_PASSCODE || '',
  // 情侣空间：飞书机器人 webhook（可选，未配置时每日推送跳过）
  COUPLE_FEISHU_WEBHOOK: process.env.COUPLE_FEISHU_WEBHOOK || '',
  // 情侣空间：定时接口 /api/couple/daily 的密钥（未配置时该接口关闭）
  COUPLE_CRON_SECRET: process.env.COUPLE_CRON_SECRET || '',
  // 情侣空间：默认城市与坐标（南京·雨花台，可在页面设置里改）
  COUPLE_CITY: process.env.COUPLE_CITY || '南京 · 雨花台',
  COUPLE_LATITUDE: process.env.COUPLE_LATITUDE ? Number(process.env.COUPLE_LATITUDE) : 31.9957,
  COUPLE_LONGITUDE: process.env.COUPLE_LONGITUDE ? Number(process.env.COUPLE_LONGITUDE) : 118.7635,
};
