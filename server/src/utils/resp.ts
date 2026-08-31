// 统一响应格式工具
import { Response } from 'express';

// 成功：{ code: 0, data: ... }
export function ok(res: Response, data: unknown): void {
  res.json({ code: 0, data });
}

// 失败：HTTP 状态码 + { code: 1, message: '...' }
export function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ code: 1, message });
}
