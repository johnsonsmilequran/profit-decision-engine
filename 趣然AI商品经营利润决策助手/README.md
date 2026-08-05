# 趣然 AI 商品经营利润决策助手

PC 端内部经营工作台，由 React 前端、FastAPI Web、PostgreSQL 和独立 Worker 组成。业务入口只接受钉钉身份，角色映射由 IT 维护。

## 本地容器运行

1. 复制 `.env.example` 为 `.env`，填写独立的数据库密码、备份密码、钉钉参数和公开 HTTPS URL。
2. 确保 `QURAN_DATABASE_URL` 中使用 URL 编码后的同一数据库密码。
3. 构建并启动：

```sh
docker compose build web
docker compose up -d postgres migrate web worker backup
docker compose ps -a
curl --fail https://profit.example.internal/api/health
```

Web 默认只绑定 `127.0.0.1:8000`，生产应由公司反向代理提供 HTTPS。PostgreSQL 不发布宿主机端口。

## 开发门禁

```sh
cd backend
.venv312/bin/ruff check app tests alembic
.venv312/bin/mypy app tests
QURAN_DATABASE_URL=postgresql+psycopg://quran:quran@localhost:5432/quran_test .venv312/bin/pytest

cd ../frontend
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
```

## 运维边界

- 迁移服务必须以退出码 0 完成，Web/Worker 才会启动。
- 备份每 24 小时产生 AES-256-CBC/PBKDF2 密文，保留 30 天；备份密码与数据库密码分离保管。
- 生产配置会拒绝 HTTP URL、非 Secure Cookie、默认数据库凭据和缺失的钉钉密钥。
- 不要使用共享账号绕过 `RoleMapping`，也不要把前端菜单隐藏当作服务端权限隔离。
