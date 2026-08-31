// Node16 fetch polyfill，必须在任何 supabase 导入之前执行
if (typeof (globalThis as any).fetch !== 'function') {
  const undici = require('undici');
  (globalThis as any).fetch = undici.fetch;
  (globalThis as any).Headers = undici.Headers;
  (globalThis as any).Request = undici.Request;
  (globalThis as any).Response = undici.Response;
  (globalThis as any).FormData = undici.FormData;
}
export {}
