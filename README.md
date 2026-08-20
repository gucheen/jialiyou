# 家里有 · 独立版

一个完全独立的家庭物资管理 Web 应用，不依赖 ChatGPT Sites、Cloudflare 或第三方数据库。

## 本地运行

需要 Node.js 20.9 或更高版本。

```bash
pnpm install
pnpm dev
```

浏览器打开 `http://localhost:3000`。

开发环境未配置认证变量时，可使用用户名 `admin`、密码 `jialiyou` 登录。

## 用户认证

生产运行前设置以下环境变量（可参考 `.env.example`）：

```bash
AUTH_USERNAME=family
AUTH_PASSWORD=请替换为强密码
AUTH_SECRET=请替换为足够长的随机字符串
```

可以用 `openssl rand -base64 32` 生成 `AUTH_SECRET`。登录状态保存在签名的 HttpOnly Cookie 中，默认有效期为 7 天。生产环境不会启用开发用默认账号；缺少任一变量时，登录页会提示认证尚未配置。

## 生产运行

```bash
pnpm build
pnpm start
```

物资和购物清单保存在 `data/home.json`。部署时需要让服务器对 `data/` 目录拥有写权限，并定期备份该文件。项目适合运行在自己的电脑、NAS、VPS 或支持持久磁盘的 Node.js 服务器上。

## 功能

- 新增、搜索和按空间查看家庭物品
- 快速移动物品、常用位置建议、撤销与移动历史
- 充足、不多了、快用完、已用完状态
- 到期提醒与快速盘点
- 共享购物清单
- 桌面端与移动端自适应
