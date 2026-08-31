// 应用入口
import './polyfill'; // 必须最先导入：Node16 fetch polyfill
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './env';
import { ok, fail } from './utils/resp';
import authRoutes from './routes/auth';
import menuRoutes from './routes/menu';
import orderRoutes from './routes/orders';
import signinRoutes from './routes/signins';
import pointsRoutes from './routes/points';

const app = express();

// 跨域配置：CORS_ORIGIN 为 * 时放行任意来源
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: false,
  })
);
app.use(express.json({ limit: '1mb' }));

// 健康检查（不依赖数据库）
app.get('/api/health', (_req: Request, res: Response) => {
  ok(res, 'ok');
});

// 业务路由
app.use('/api/auth', authRoutes);
app.use('/api', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/signin', signinRoutes);
app.use('/api/points', pointsRoutes);

// 404 处理
app.use((_req: Request, res: Response) => {
  fail(res, 404, '接口不存在');
});

// 统一错误处理
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server error]', err);
  fail(res, 500, err?.message || '服务器内部错误');
});

app.listen(env.PORT, () => {
  console.log(`小厨点餐 API 服务已启动: http://localhost:${env.PORT}`);
});
