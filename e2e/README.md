# E2E 测试

本目录包含 AI Forum 的端到端（E2E）冒烟测试脚本，可在本地和 CI 中运行。

## 目录结构

```
e2e/
├── README.md               # 本文档
├── seed.sql                # E2E 测试种子数据（普通用户 + 管理员 + 吧）
├── setup-e2e.sh            # 启动环境：docker compose + 迁移 + 种子数据
├── teardown-e2e.sh         # 清理环境：docker compose down -v
├── backend-e2e-smoke.sh    # 后端 API 冒烟测试
├── frontend-e2e-smoke.sh   # 前端页面 + API 集成冒烟测试
└── run-all.sh              # 一键运行全部 E2E 测试
```

## 快速开始

### 一键运行

```bash
# 构建镜像 + 启动服务 + 运行测试 + 自动清理
./e2e/run-all.sh

# 跳过镜像重建（复用已有镜像，更快）
./e2e/run-all.sh --no-build

# 测试后不清理容器（便于调试）
./e2e/run-all.sh --keep
```

### 分步运行

```bash
# 1. 启动环境
./e2e/setup-e2e.sh

# 2. 运行后端冒烟测试
./e2e/backend-e2e-smoke.sh

# 3. 运行前端冒烟测试
./e2e/frontend-e2e-smoke.sh

# 4. 清理
./e2e/teardown-e2e.sh
```

## 前置条件

- **Docker** 和 **Docker Compose** 已安装
- **curl** 和 **jq** 已安装
- 端口 `3000`（前端）、`3001`（后端）、`5432`（PostgreSQL）未被占用

## 环境变量

所有脚本都支持通过环境变量配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `FRONTEND_URL` | `http://localhost:3000` | 前端地址 |
| `API_URL` | `http://localhost:3001/api` | 后端 API 地址 |
| `TEST_BAR_ID` | `00000000-0000-4000-a000-000000000001`（后端）/ `...0011`（前端） | 测试用吧 ID |
| `JWT_SECRET` | （无） | 后端 JWT 密钥（仅 fallback 时需要） |

## 种子数据

`seed.sql` 中包含以下测试数据：

| 类型 | ID | 说明 |
|------|------|------|
| 用户 | `00000000-0000-4000-a000-000000000010` | 后端 E2E 种子用户 |
| 用户 | `00000000-0000-4000-a000-000000000030` | 后端 E2E 管理员用户 |
| 吧   | `00000000-0000-4000-a000-000000000001` | 后端 E2E 种子吧 |
| 用户 | `00000000-0000-4000-a000-000000000020` | 前端 E2E 种子用户 |
| 吧   | `00000000-0000-4000-a000-000000000011` | 前端 E2E 种子吧 |

所有 UUID 使用 RFC 4122 v4 格式（version=4, variant=a），兼容 class-validator 的 `@IsUUID()` 校验。

## 测试覆盖

### 后端冒烟测试 (`backend-e2e-smoke.sh`)

1. **注册/鉴权** — `POST /api/auth/register`、`GET /api/auth/me`
2. **吧创建与成员关系** — `POST /api/bars`、`POST /api/bars/:id/join`、`POST /api/bars/:id/leave`
3. **管理员流转** — `POST /api/admin/bars/:id/approve|suspend|unsuspend`
4. **内容创建** — `POST /api/posts`、`POST /api/posts/:id/replies`
5. **个人中心** — `GET /api/users/me/*`、`PATCH /api/users/me/profile`

### 前端冒烟测试 (`frontend-e2e-smoke.sh`)

**Phase 1 — 页面可访问性**
- `GET /` → 200
- `GET /login` → 200
- `GET /register` → 200

**Phase 2 — 页面内容验证**
- 首页包含 Next.js 渲染内容
- 登录页包含表单输入（`type="email"`、`type="password"`）
- 注册页包含表单输入

**Phase 3 — API 集成（含 Phase 2）**
- 通过 API 注册用户 → 创建吧申请 → 加入/退出吧
- 管理员审核吧与查看审计日志
- 验证个人中心相关 API（我的吧、我创建的吧）可返回数据

## 与 Jest E2E 测试的关系

| 测试类型 | 运行方式 | 覆盖范围 |
|----------|----------|----------|
| Jest E2E (`backend/test/app.e2e-spec.ts`) | `cd backend && npm run test:e2e` | 30+ 测试用例，含参数校验、权限、404 等 |
| 冒烟测试 (`e2e/*.sh`) | `./e2e/run-all.sh` | 核心 happy path，验证全栈集成 |

Jest E2E 需要连接真实数据库，测试粒度更细；冒烟测试通过 docker compose 启动完整环境，验证前后端集成。两者互补。
