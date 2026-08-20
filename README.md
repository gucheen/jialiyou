# 家里有 · 独立版

一个完全独立的家庭物资管理 Web 应用，不依赖 ChatGPT Sites、Cloudflare 或第三方数据库。

## 本地运行

需要 Node.js 20.9 或更高版本。

```bash
pnpm install
pnpm dev
```

浏览器打开 `http://localhost:3000`。

## 生产运行

```bash
pnpm build
pnpm start
```

物资和购物清单保存在 `data/home.json`。部署时需要让服务器对 `data/` 目录拥有写权限，并定期备份该文件。项目适合运行在自己的电脑、NAS、VPS 或支持持久磁盘的 Node.js 服务器上。

## 功能

- 新增、搜索和按空间查看家庭物品
- 充足、不多了、快用完、已用完状态
- 到期提醒与快速盘点
- 共享购物清单
- 桌面端与移动端自适应
