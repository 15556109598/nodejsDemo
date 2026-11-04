// 一次性迁移脚本：把旧版 JSON 数据（server/data/snacks.json）导入 Supabase
// 用法（在 server 目录）：node scripts/import-snacks-json.js [json路径]
// 前置：已执行 server/sql/snacks.sql；.env 里已配置 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SNACKS_BUCKET || 'snacks';
const jsonPath = process.argv[2] || path.join(__dirname, '..', 'data', 'snacks.json');
const uploadsDir = path.join(__dirname, '..', 'uploads');

if (!url || !key) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!fs.existsSync(jsonPath)) {
  console.error(`未找到旧数据文件：${jsonPath}（无需迁移）`);
  process.exit(0);
}

const db = createClient(url, key);
const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// 旧数据里 photoUrl 形如 /uploads/snacks/xxx.png，需上传到 Storage 再改写地址
async function migratePhoto(photoUrl) {
  if (!photoUrl || !photoUrl.startsWith('/uploads/')) return photoUrl || '';
  const file = path.join(uploadsDir, photoUrl.replace(/^\/uploads\//, ''));
  if (!fs.existsSync(file)) {
    console.warn(`图片缺失，跳过：${file}`);
    return '';
  }
  const ext = path.extname(file).slice(1) || 'jpg';
  const objectPath = `imported/${path.basename(file)}`;
  const contentType = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] || 'application/octet-stream';
  const { error } = await db.storage.from(bucket).upload(objectPath, fs.readFileSync(file), { contentType, upsert: true });
  if (error) {
    console.warn(`图片上传失败：${photoUrl} -> ${error.message}`);
    return '';
  }
  return db.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

async function main() {
  const items = raw.items || [];
  console.log(`读取 ${items.length} 条旧记录：${jsonPath}`);
  let success = 0;
  for (const item of items) {
    const photoUrl = await migratePhoto(item.photoUrl);
    const { error } = await db.from('snacks').insert({
      name: item.name,
      brand: item.brand || '',
      quantity: item.quantity || 1,
      expire_date: item.expireDate,
      note: item.note || '',
      photo_url: photoUrl,
      finished: Boolean(item.finished),
      finished_at: item.finishedAt || null,
    });
    if (error) {
      console.error(`导入失败：${item.name} -> ${error.message}`);
    } else {
      success += 1;
    }
  }
  const nearDays = raw.settings && raw.settings.nearDays;
  if (nearDays) {
    await db.from('app_settings').upsert({ key: 'snacks', value: { nearDays }, updated_at: new Date().toISOString() });
  }
  console.log(`完成：成功 ${success}/${items.length} 条`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
