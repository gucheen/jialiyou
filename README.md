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

可以用 `openssl rand -base64 32` 生成 `AUTH_SECRET`。登录状态保存在签名的 HttpOnly Cookie 中，默认有效期为 7 天。生产环境不会启用开发用默认账号；缺少任一变量时，登录页会提示认证尚未配置。登录失败限制为同一客户端 15 分钟内最多 8 次，超出后返回 `429`。

## 生产运行

```bash
pnpm build
pnpm start
```

物资和购物清单保存在 `data/home.json`。该文件已被 Git 和 Docker 构建上下文忽略；首次启动时会从公开的 `data/home.example.json` 自动创建。部署时需要让服务器对 `data/` 目录拥有写权限，并定期备份该文件。项目适合运行在自己的电脑、NAS、VPS 或支持持久磁盘的 Node.js 服务器上。

## Docker 镜像

项目使用多阶段构建和 Next.js standalone 输出，最终镜像以非 root 用户运行，并固定支持 `linux/amd64`（Linux x64）。

本地构建镜像：

```bash
docker buildx build --platform linux/amd64 --load -t jialiyou:local .
```

推送前先登录 GitHub Container Registry，然后运行发布脚本：

```bash
docker login ghcr.io
./scripts/publish-image.sh ghcr.io/<github-name>/jialiyou 1.0.0
```

部署时复制 `.env.example` 并填写认证信息与完整镜像地址，然后运行：

```bash
docker compose --env-file .env up -d
```

默认 Compose 只把 HTTP 端口绑定在 `127.0.0.1`，适合本机访问或接入已有反向代理，不应直接暴露到公网。公网 HTTPS、域名、证书申请与续期由部署者使用自己的 Nginx、Caddy、Traefik、NAS 或云平台处理，不属于本项目容器职责。

反向代理需要：

- 将请求转发到 `http://127.0.0.1:JIALIYOU_PORT`。
- 覆盖客户端传入的 `X-Forwarded-For`，写入真实客户端地址，供登录限速使用。
- 覆盖 `X-Forwarded-Proto` 并设置为实际协议；HTTPS 请求必须传递 `https`，以启用 Secure Cookie。

物资数据保存在 Compose 命名卷 `jialiyou-data` 中，更新镜像不会清空数据。使用宿主机目录挂载 `/app/data` 时，需确保容器用户 UID/GID `1001:1001` 可写。

### GitHub Actions 自动发布

工作流 `.github/workflows/publish-container.yml` 会构建 `linux/amd64` 镜像：

- 推送到 `main` 或创建 `v*` 标签时，自动发布到 `ghcr.io/<owner>/<repo>`。
- 在 Actions 页面手动运行时，可以指定镜像标签。
- GHCR 使用仓库自带的 `GITHUB_TOKEN`，无需额外密钥。
- 所有第三方 Actions 都固定到从官方仓库核验的完整提交 SHA，版本号保留在行尾注释中。

## 功能

- 新增、搜索和按空间查看家庭物品
- 快速移动物品、常用位置建议、撤销与移动历史
- 充足、不多了、快用完、已用完状态
- 到期提醒与快速盘点
- 共享购物清单
- 桌面端与移动端自适应
