// 环境变量集中管理：先加载 .env，再导出 env 常量
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// 编译后 __dirname = server/dist，开发时 = server/src，上一级都是 server 目录
const SERVER_ROOT = path.resolve(__dirname, '..');

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  // 零食模块数据目录（JSON）与图片目录；生产环境可用持久化磁盘挂载路径
  DATA_DIR: process.env.DATA_DIR || path.join(SERVER_ROOT, 'data'),
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(SERVER_ROOT, 'uploads'),
  // 默认临近过期阈值（天）
  NEAR_DAYS: Number(process.env.NEAR_DAYS) || 7,
};
