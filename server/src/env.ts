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
};
