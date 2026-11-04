// 应用入口
import './polyfill'; // 必须最先导入：Node16 fetch polyfill
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { env } from './env';
import { adminClient } from './lib/supabase';
import { ok, fail } from './utils/resp';
import { ensureStorageReady } from './store/snacks';
import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import orderRoutes from './routes/orders';
import signinRoutes from './routes/signins';
import pointsRoutes from './routes/points';
import snackRoutes from './routes/snacks';

const app = express();

// 跨域配置：CORS_ORIGIN 为 * 时放行任意来源
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: false,
  })
);
app.use(express.json({ limit: '1mb' }));

// 上传的零食图片：静态访问
app.use(
  '/uploads',
  express.static(env.UPLOAD_DIR, { maxAge: '7d', index: false, fallthrough: true })
);

// 健康检查（不依赖数据库）
app.get('/api/health', (_req: Request, res: Response) => {
  ok(res, 'ok');
});

// 探活接口：供定时任务调用，执行一次真实的数据库查询，
// 避免 Supabase 免费版因 7 天无活动被自动暂停
app.get('/api/keepalive', async (_req: Request, res: Response): Promise<void> => {
  const { error } = await adminClient.from('categories').select('id', { count: 'exact', head: true });
  if (error) {
    fail(res, 500, error.message);
    return;
  }
  ok(res, 'alive');
});

// 业务路由
app.use('/api/auth', authRoutes);
app.use('/api', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/signin', signinRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/snacks', snackRoutes);

// 前端打包产物（web/dist）：存在则由本服务统一托管，单服务部署时无需再配 CORS
const WEB_DIST = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST, { index: 'index.html' }));
  // SPA 兜底：非接口路径一律返回 index.html（支持 /app、/snacks 等前端路由）
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      next();
      return;
    }
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

// 404 处理
app.use((_req: Request, res: Response) => {
  fail(res, 404, '接口不存在');
});

// 统一错误处理
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.too.large') {
    fail(res, 413, '提交内容过大（图片上限 5MB）');
    return;
  }
  console.error('[server error]', err);
  fail(res, 500, err?.message || '服务器内部错误');
});

// 初始化零食模块存储目录（JSON 数据 + uploads）
ensureStorageReady();

app.listen(env.PORT, () => {
  console.log(`小厨点餐 API 服务已启动: http://localhost:${env.PORT}`);
});
