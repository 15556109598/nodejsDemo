# 小厨点餐 H5 —— 全栈项目

移动端点餐 H5 应用：点餐 / 订单管理 / 个人中心（积分签到日历）。

| 端 | 技术栈 | 目录 |
|---|---|---|
| 前端 | Vue3 + TypeScript + Vite4 + Pinia + Vue Router + Vant4 + SCSS | [web/](web/) |
| 后端 | Node.js + Express + TypeScript + Supabase（Postgres + Auth） | [server/](server/) |
| 数据库/认证 | Supabase（建表 SQL 见 [supabase/](supabase/)） | — |

> 当前机器 Node 为 v16.16.0，依赖版本已做兼容（Vite4/Express4）。生产部署建议使用 **Node 20 LTS**（可用 `nvm install 20` 升级，注意升级后删除 `node_modules` 重新 `npm install`）。

---

## 一、准备工作：创建 Supabase 项目（必须）

1. 打开 https://supabase.com/dashboard 注册/登录 → **New Project**（区域选 Singapore，记好数据库密码）。
2. 进入项目 → 左侧 **SQL Editor** → New query：
   - 粘贴 [supabase/schema.sql](supabase/schema.sql) 全部内容 → **Run**
   - 再粘贴 [supabase/seed.sql](supabase/seed.sql) 全部内容 → **Run**（写入 5 个分类 + 15 道菜品）
3. 获取三把钥匙：**Project Settings → API**
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `anon public` key（Publishable/匿名 key）
   - `service_role` key（**保密！只放后端**）

## 二、本地开发调试

### 1. 配置后端环境变量 `server/.env`

```env
PORT=3000
SUPABASE_URL=https://你的项目ref.supabase.co
SUPABASE_ANON_KEY=你的anon-public-key
SUPABASE_SERVICE_ROLE_KEY=你的service_role-key
CORS_ORIGIN=*
```

### 2. 启动后端（终端 1）

```powershell
cd d:\work\nodejsdemo\server
npm run dev      # ts-node-dev 热重载，http://localhost:3000
```

验证：浏览器打开 http://localhost:3000/api/health → `{"code":0,"data":"ok"}`

### 3. 启动前端（终端 2）

```powershell
cd d:\work\nodejsdemo\web
npm run dev      # http://localhost:5173（API 直连 localhost:3000，后端 CORS 已放行）
```

### 4. 调试流程

- 手机模拟：浏览器 F12 → 设备工具栏选 iPhone SE (375px)
- 注册任意邮箱密码即自动登录（Supabase Auth，无需邮箱验证码）
- 点餐 → 加购（抛物线动画）→ 下单 → 订单页「去支付」→ 状态 20 秒后自动变「待取餐」→ 确认取餐赚积分 → 「我的」签到领积分（撒花动画）
- 排错入口：
  - 后端终端日志（ts-node-dev 实时报错）
  - Supabase Dashboard → Logs → API / Postgres 日志
  - 浏览器 Network 面板看 `/api/*` 请求的响应体

---

## 三、部署上线

### 后端 → Render（免费档）

1. 代码推到 GitHub（Render 从仓库部署；本机未装 git，可安装 [Git for Windows](https://git-scm.com/download/win) 或用 GitHub Desktop）
2. https://dashboard.render.com → **New → Web Service** → 连接仓库
3. 配置：
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Environment**: 添加 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`CORS_ORIGIN=https://你的前端域名.vercel.app`
4. 部署完成后得到后端地址：`https://xxx.onrender.com`

### 前端 → Vercel（免费）

1. https://vercel.com → 用 GitHub 登录 → **Add New → Project** → 导入同一仓库
2. 配置：
   - **Root Directory**: `web`
   - Framework Preset 选 **Vite**（Build: `npm run build`，Output: `dist`）
   - **Environment Variables** 添加：`VITE_API_BASE = https://xxx.onrender.com/api`（用上一步的后端地址；环境变量优先级高于 `.env.production`）
3. 部署完成后即可在手机浏览器打开使用。

### 备选：后端 Railway / 前端 Cloudflare Pages，步骤同理。

---

## 四、安全与注意事项

- **service_role key 绝不能进前端代码或公开仓库**；只放 Render/Vercel 的环境变量里。
- 所有业务表已开启 RLS 且未建匿名策略：anon key 无法直接读写数据，必须经过后端（后端用 service_role 绕过 RLS）。
- 认证使用 Supabase Auth 邮箱+密码；如需手机验证码登录，需在 Dashboard 配置短信服务商。
- `.env` 不要提交 git；本项目根目录建议添加 `.gitignore`（node_modules/、dist/、.env）。

## 五、常用命令速查

| 命令 | 说明 |
|---|---|
| `server: npm run dev` | 后端热重载开发 |
| `server: npm run build` | 后端 TS 编译到 dist |
| `server: npm run start` | 生产模式启动（读 dist） |
| `web: npm run dev` | 前端开发服务器 |
| `web: npm run build` | 前端打包到 dist |
| `web: npm run type-check` | vue-tsc 类型检查 |

---

## 六、模块化入口（如何新增模块）

项目入口 `/` 已改造为「模块导航页」，点餐系统整体迁到 `/app`，新增的零食模块为 `/snacks`。

模块信息集中在一处配置：[web/src/modules/index.ts](web/src/modules/index.ts)。

新增一个模块只需两步：

1. 在 `APP_MODULES` 数组追加一条配置（`id` 唯一）：

```ts
{
  id: 'your-module',
  name: '模块名称',
  description: '一句话说明',
  icon: '🧩',            // emoji，或用 iconType: 'vant' + Vant 图标名
  path: '/your-module',  // 站内路由；外链填完整 URL 并设置 external: true
  status: 'available',   // 'coming' 会显示为置灰的「开发中」
  badge: '新增',
  accent: '#1989FA',
}
```

2. 在 [web/src/router/index.ts](web/src/router/index.ts) 的 `routes` 里登记该 `path`（外链模块可跳过）；若该模块无需登录，同时把路径加入 `PUBLIC_PATHS`。

入口页会自动渲染新卡片，无需改动入口页代码。后端模块按现有方式在 `server/src/index.ts` 中 `app.use('/api/xxx', xxxRoutes)` 挂载即可。

## 七、零食日期管理模块

- 页面：`/snacks`（无需登录，所有人共用同一份清单）
- 数据：`server/data/snacks.json`（可用 `DATA_DIR` 覆盖）
- 图片：`server/uploads/snacks/`，通过 `/uploads/snacks/xxx.jpg` 访问（可用 `UPLOAD_DIR` 覆盖）
- 上传限制：JPG / PNG / WEBP / GIF；单张 ≤ 5MB；校验 MIME + 文件头魔数；文件名随机生成
- 默认临近过期阈值 7 天（`NEAR_DAYS` 或页面「设置」内可改，设置保存在数据文件里，全局共享）

接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/snacks` | 列表 + 设置（按到期日由近到远，已吃完排最后） |
| POST | `/api/snacks` | 新增（JSON） |
| PUT | `/api/snacks/:id` | 编辑（JSON） |
| POST | `/api/snacks/:id/finish` | 标记吃完 / 取消归档（`{finished:true/false}`） |
| DELETE | `/api/snacks/:id` | 删除（同时清理未被引用的图片） |
| POST | `/api/snacks/photo` | 上传图片（请求体为原始二进制，`Content-Type` 为图片 MIME） |
| PUT | `/api/snacks/settings` | 修改临近过期阈值 `{nearDays: 1~60}` |

前端：卡片倒计时（正常 / 临近 / 已过期 / 已用完 配色区分）、名称搜索、状态筛选、编辑删除、吃完归档、打开页面时的过期/临期提示条、获得通知权限后发送浏览器通知（同一记录同一状态每天只提醒一次）、每 20 秒自动刷新。

## 八、部署上线（Render 单服务）

`server/src/index.ts` 会自动托管 `web/dist`（存在时），因此推荐**一个 Web Service 托管全部内容**，同源部署无需处理跨域。

1. 推送到 GitHub 仓库（本仓库已有 `origin`）。
2. Render Dashboard → **New → Blueprint** → 选择本仓库（会自动读取根目录 [render.yaml](render.yaml)：`rootDir: .`，构建前端 + 后端，启动 `node server/dist/index.js`）。
3. 在服务 Environment 中手动填入：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`（零食模块不依赖它们，但点餐系统需要）。
4. 部署完成后访问 `https://<服务名>.onrender.com`：`/` 为模块导航，`/app` 为点餐，`/snacks` 为零食模块；`/api/health` 应返回 `{"code":0,"data":"ok"}`。

数据持久化注意：

- Render 免费实例磁盘为**临时盘**，重新部署 / 实例重启后 `server/data` 与 `server/uploads` 会清空。
- 需要长期保存：升级付费实例 → 挂载 Persistent Disk（如 `/var/data`，1GB 起）→ 在 Environment 设置 `DATA_DIR=/var/data`、`UPLOAD_DIR=/var/data/uploads`（`render.yaml` 内已有注释示例）。
- 也可以用备份方案：定期下载 `server/data/snacks.json` 与 `uploads` 目录。

备选部署方式：

- 前端静态站点（Vercel / Render Static Site）+ 后端 Web Service：前端构建时设置 `VITE_API_BASE=https://<后端域名>/api`，后端 `CORS_ORIGIN` 填前端域名；但图片地址依赖后端 `/uploads`，需保证后端可公网访问。
- 仅本地运行：`server` 下 `npm run build && npm start`（先 `web` 下 `npm run build`，由后端托管页面），浏览器打开 `http://localhost:3000`。

