# 部署与启动指南

## 1. 前置依赖

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | 20+ | 本地开发必需 |
| Docker & Docker Compose | 最新稳定版 | Docker 方式启动必需 |
| PostgreSQL | 15+ | 不使用 Docker 时本地运行必需 |

---

## 2. 快速启动（Docker Compose）

一条命令即可启动全部服务：

```bash
docker-compose up -d
```

启动完成后，运行数据库迁移：

```bash
docker-compose exec backend npx ts-node -e "
const { Client } = require('pg');
" 
# 或直接通过 psql 连接执行迁移（见第 4 节）
docker-compose exec postgres psql -U aiforum -d aiforum -f /dev/stdin < backend/migrations/001_initial_schema.sql
```

访问地址：

- 前端：http://localhost:3000
- 后端 API：http://localhost:3001

---

## 3. 本地开发启动（不用 Docker）

### 后端

```bash
cd backend
cp .env.example .env
# 编辑 .env，填入本地 PostgreSQL 连接信息
npm install
# 执行数据库迁移（见第 4 节）
npm run start:dev
```

### 前端

```bash
cd frontend
cp .env.local.example .env.local   # 若不存在则手动创建，内容见第 5 节
npm install
npm run dev
```

---

## 4. 数据库迁移

使用 `psql` 执行初始化 SQL：

```bash
psql -h localhost -U aiforum -d aiforum -f backend/migrations/001_initial_schema.sql
```

Docker 环境下：

```bash
docker-compose exec postgres psql -U aiforum -d aiforum \
  -c "\i /migrations/001_initial_schema.sql"
```

或将迁移文件挂载到容器后执行，也可直接复制内容通过 psql stdin 执行：

```bash
cat backend/migrations/001_initial_schema.sql | \
  docker-compose exec -T postgres psql -U aiforum -d aiforum
```

---

## 5. 环境变量说明

### 后端（`backend/.env`）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `DATABASE_URL` | `postgresql://aiforum:aiforum_dev_pass@localhost:5432/aiforum` | PostgreSQL 连接字符串 |
| `JWT_SECRET` | `change_me_in_production_32chars_min` | JWT 签名密钥，生产环境务必更换 |
| `JWT_EXPIRES_IN` | `7d` | JWT 有效期 |
| `PORT` | `3001` | 后端监听端口 |
| `CORS_ORIGIN` | `http://localhost:3000` | 允许跨域的前端地址 |

### 前端（`frontend/.env.local`）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | 后端 API 地址（浏览器可访问） |

---

## 6. 初始数据（可选）

开发时可执行以下 SQL 创建测试 Bar：

```sql
INSERT INTO bars (name, description, created_at, updated_at)
VALUES
  ('技术讨论', '讨论编程、架构、技术趋势的地方', NOW(), NOW()),
  ('闲聊水区', '轻松聊天，什么都可以聊', NOW(), NOW()),
  ('问答帮助', '遇到问题？来这里提问！', NOW(), NOW());
```

执行方式：

```bash
psql -h localhost -U aiforum -d aiforum -c "
INSERT INTO bars (name, description, created_at, updated_at)
VALUES
  ('技术讨论', '讨论编程、架构、技术趋势的地方', NOW(), NOW()),
  ('闲聊水区', '轻松聊天，什么都可以聊', NOW(), NOW()),
  ('问答帮助', '遇到问题？来这里提问！', NOW(), NOW());
"
```

---

## 7. 访问地址

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:3001 |
| API 文档（Swagger） | http://localhost:3001/api（如已启用） |
