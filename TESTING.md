# 测试指南

## 概览

本项目采用多层测试策略，覆盖后端单元测试、后端 E2E 测试、全栈冒烟测试（可本地 + CI 运行），以及手动测试流程。

| 测试层级 | 工具 | 运行方式 | 覆盖范围 |
|----------|------|----------|----------|
| 后端单元测试 | Jest + NestJS Testing | `cd backend && npm test` | Service 层逻辑 |
| 后端 E2E 测试 | Jest + Supertest | `cd backend && npm run test:e2e` | 完整 API 链路（含 DB） |
| 全栈冒烟测试 | Shell + curl + docker compose | `./e2e/run-all.sh` | 前后端集成，核心 happy path |
| 手动测试 | 浏览器 / curl | 开发者手工 | 全链路体验 |

---

## 1. 后端单元测试

```bash
cd backend && npm run test
```

测试框架为 Jest，覆盖各模块的 Service 层逻辑单元测试。

当前覆盖的模块:
- **AuthService**: 注册、登录、密码校验、Token 生成、用户信息脱敏
- **PostsService**: 分页查询、游标分页、按 barId 过滤、单帖查询、创建帖子、回复计数更新

---

## 2. 后端 E2E 测试

### 前置条件

- PostgreSQL 必须正在运行
- 已创建测试数据库并执行过迁移
- 在 `backend/.env` 中配置 `TEST_DATABASE_URL`，或在命令行中内联传入
- 数据库中已 seed 至少一条 bar 记录

### 配置测试数据库连接

```bash
# 方式一：在 .env 中添加
TEST_DATABASE_URL=postgresql://aiforum:aiforum_dev_pass@localhost:5432/aiforum_test

# 方式二：内联环境变量
TEST_DATABASE_URL=postgresql://aiforum:aiforum_dev_pass@localhost:5432/aiforum_test \
  npm run test:e2e
```

### 运行 E2E 测试

```bash
cd backend && npm run test:e2e
```

### E2E 测试覆盖矩阵

后端 E2E 测试覆盖以下场景:

#### 认证模块 (Auth)

| 测试场景 | 方法 | 路径 | 预期状态码 | 验证点 |
|----------|------|------|-----------|--------|
| 注册新用户 | POST | `/api/auth/register` | 201 | 返回 accessToken + user，不泄露 passwordHash |
| 重复邮箱注册 | POST | `/api/auth/register` | 409 | 返回 CONFLICT 错误 |
| 无效邮箱格式 | POST | `/api/auth/register` | 400 | 返回 BAD_REQUEST 错误 |
| 密码过短 | POST | `/api/auth/register` | 400 | 返回 BAD_REQUEST 错误 |
| 缺少必填字段 | POST | `/api/auth/register` | 400 | 参数校验失败 |
| 正常登录 | POST | `/api/auth/login` | 201 | 返回 accessToken，不泄露 passwordHash |
| 错误密码登录 | POST | `/api/auth/login` | 401 | 返回 UNAUTHORIZED 错误 |
| 不存在的邮箱登录 | POST | `/api/auth/login` | 401 | 返回 UNAUTHORIZED 错误 |
| 获取当前用户（有 Token）| GET | `/api/auth/me` | 200 | 返回用户信息，不泄露 passwordHash |
| 获取当前用户（无 Token）| GET | `/api/auth/me` | 401 | 未认证拒绝 |
| 获取当前用户（无效 Token）| GET | `/api/auth/me` | 401 | 无效 Token 拒绝 |

#### 吧模块 (Bars)

| 测试场景 | 方法 | 路径 | 预期状态码 | 验证点 |
|----------|------|------|-----------|--------|
| 获取吧列表 | GET | `/api/bars` | 200 | 分页数据 + meta.hasMore |
| 获取吧列表（限制数量）| GET | `/api/bars?limit=1` | 200 | 返回不超过 1 条 |
| 获取单个吧详情 | GET | `/api/bars/:id` | 200 | 返回吧信息，id 匹配 |
| 获取不存在的吧 | GET | `/api/bars/:id` | 404 | 返回 NOT_FOUND 错误 |

#### 帖子模块 (Posts)

| 测试场景 | 方法 | 路径 | 预期状态码 | 验证点 |
|----------|------|------|-----------|--------|
| 创建帖子（已认证）| POST | `/api/posts` | 201 | 返回帖子数据，字段匹配 |
| 创建帖子（未认证）| POST | `/api/posts` | 401 | 返回 UNAUTHORIZED |
| 缺少标题 | POST | `/api/posts` | 400 | 参数校验失败 |
| 缺少 barId | POST | `/api/posts` | 400 | 参数校验失败 |
| 无效 barId 格式 | POST | `/api/posts` | 400 | UUID 格式校验失败 |
| 获取帖子列表 | GET | `/api/posts` | 200 | 数组，至少 1 条 |
| 按 barId 过滤 | GET | `/api/posts?barId=xxx` | 200 | 返回该吧下帖子 |
| 限制数量 | GET | `/api/posts?limit=1` | 200 | 不超过 1 条 + meta 分页 |
| 获取单帖详情 | GET | `/api/posts/:id` | 200 | id 和 title 匹配 |
| 获取不存在的帖子 | GET | `/api/posts/:id` | 404 | 返回 NOT_FOUND |

#### 回复模块 (Replies)

| 测试场景 | 方法 | 路径 | 预期状态码 | 验证点 |
|----------|------|------|-----------|--------|
| 创建回复 | POST | `/api/posts/:id/replies` | 201 | floorNumber=1，内容匹配 |
| 楼层号递增 | POST | `/api/posts/:id/replies` | 201 | floorNumber=2 |
| 未认证回复 | POST | `/api/posts/:id/replies` | 401 | UNAUTHORIZED |
| 空内容回复 | POST | `/api/posts/:id/replies` | 400 | 参数校验失败 |
| 回复不存在的帖子 | POST | `/api/posts/:id/replies` | 404 | NOT_FOUND |
| 获取回复列表 | GET | `/api/posts/:id/replies` | 200 | 数组 + meta 分页 |
| 限制回复数量 | GET | `/api/posts/:id/replies?limit=1` | 200 | 不超过 1 条 + hasMore |

#### 响应信封格式 (Response Envelope)

| 测试场景 | 验证点 |
|----------|--------|
| 成功响应格式 | 包含 `data`、`error: null` |
| 错误响应格式 | 包含 `error.code`、`error.message` |

---

## 3. 全栈冒烟测试（本地 + CI）

冒烟测试脚本位于 `e2e/` 目录，可在本地和 CI 中运行。详见 [e2e/README.md](e2e/README.md)。

### 一键运行

```bash
# 构建镜像 + 启动服务 + 运行测试 + 自动清理
./e2e/run-all.sh

# 跳过镜像重建（更快）
./e2e/run-all.sh --no-build

# 测试后保留容器（便于调试）
./e2e/run-all.sh --keep
```

### 分步运行

```bash
./e2e/setup-e2e.sh            # 启动 docker compose + 迁移 + 种子数据
./e2e/backend-e2e-smoke.sh    # 后端 API 冒烟测试
./e2e/frontend-e2e-smoke.sh   # 前端页面 + API 集成冒烟测试
./e2e/teardown-e2e.sh         # 清理容器
```

### 前置条件

- Docker + Docker Compose 已安装
- curl + jq 已安装
- 端口 3000 / 3001 / 5432 未被占用

### 脚本说明

| 脚本 | 说明 |
|------|------|
| `e2e/seed.sql` | E2E 种子数据（用户 + 吧），CI 和本地共用 |
| `e2e/setup-e2e.sh` | docker compose up + 迁移 + 种子 + 等待服务就绪 |
| `e2e/teardown-e2e.sh` | docker compose down -v |
| `e2e/backend-e2e-smoke.sh` | 注册 → 创建帖子 → 创建回复 |
| `e2e/frontend-e2e-smoke.sh` | 页面可访问 + 内容验证 + API 集成 |
| `e2e/run-all.sh` | 一键运行：setup → backend → frontend → teardown |

### CI 中的调用

CI 定义在 `.github/workflows/ci.yml`，E2E Job 直接调用 `e2e/` 下的脚本：

- **`backend-e2e`**: 应用迁移 → `e2e/seed.sql` → 启动后端 → `./e2e/backend-e2e-smoke.sh`
- **`frontend-e2e`**: docker compose up → 迁移 + `e2e/seed.sql` → `./e2e/frontend-e2e-smoke.sh`

---

## 4. 前端测试（预留）

前端测试基础设施已搭建完毕（Jest + Testing Library），但组件测试为 **Phase 2** 交付内容，当前版本暂无可运行的前端测试用例。

```bash
cd frontend && npm run test   # Phase 2 后可用
```

---

## 5. 完整 E2E 测试流程设计

以下为完整的前后端 E2E 测试覆盖设计，按用户旅程组织:

### 旅程 1: 新用户注册与登录

```
[注册页面] → POST /api/auth/register → [获得 Token] → [跳转首页]
[登录页面] → POST /api/auth/login → [获得 Token] → [跳转首页]
[已登录] → GET /api/auth/me → [显示用户信息]
```

**后端测试点**: 注册成功/重复/无效参数、登录成功/失败、Token 校验
**前端测试点**: 表单渲染、错误提示、Token 存储、页面跳转

### 旅程 2: 浏览社区内容

```
[首页] → GET /api/bars（推荐吧）+ GET /api/posts（最新帖子）
[吧详情页] → GET /api/bars/:id + GET /api/posts?barId=xxx
[帖子详情页] → GET /api/posts/:id + GET /api/posts/:id/replies
```

**后端测试点**: 分页、游标、过滤、404 处理
**前端测试点**: 列表渲染、加载更多、空状态、详情页内容

### 旅程 3: 发帖与回复

```
[创建帖子页] → POST /api/posts → [跳转帖子详情]
[帖子详情页] → POST /api/posts/:id/replies → [回复出现在列表中]
```

**后端测试点**: 权限校验、参数验证、楼层号递增、reply_count 更新
**前端测试点**: 表单提交、加载状态、新内容出现

### 旅程 4: 异常与边界

```
[未登录访问受保护页面] → 401 + 跳转登录
[访问不存在的资源] → 404 错误页
[提交无效数据] → 400 + 错误提示
```

**后端测试点**: 统一错误信封格式、HTTP 状态码正确性
**前端测试点**: 错误提示展示、页面不崩溃

---

## 6. 手动测试流程

### 启动应用

```bash
docker-compose up -d
# 或本地开发方式（见 DEPLOY.md 第 3 节）
```

### 测试步骤

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 访问 http://localhost:3000/register，填写用户名/邮箱/密码并提交 | 注册成功，跳转至登录页或首页 |
| 2 | 访问 http://localhost:3000/login，使用注册账号登录 | 登录成功，获得 JWT，跳转至首页 |
| 3 | 浏览 Bar 列表（需先有 Seed 数据，见 DEPLOY.md 第 6 节） | 显示 Bar 列表 |
| 4 | 进入某个 Bar，点击"发帖"，填写标题和内容并提交 | 帖子创建成功，显示在帖子列表中 |
| 5 | 点击帖子进入详情页，在回复框中输入内容并提交 | 回复成功，显示在帖子详情页底部 |

---

## 7. API 手动测试（curl 示例）

### 注册用户

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!","nickname":"TestUser"}'
```

### 用户登录

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'
# 返回值中包含 accessToken，后续请求需携带
```

### 获取 Bar 列表

```bash
curl http://localhost:3001/api/bars
```

### 获取单个 Bar 详情

```bash
curl http://localhost:3001/api/bars/<bar-id>
```

### 获取帖子列表（支持过滤）

```bash
# 全部帖子
curl http://localhost:3001/api/posts

# 按 barId 过滤
curl http://localhost:3001/api/posts?barId=<bar-id>

# 带分页
curl http://localhost:3001/api/posts?limit=10&cursor=<cursor>
```

### 创建帖子（需登录）

```bash
TOKEN="your_jwt_token_here"
curl -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"barId":"<bar-id>","title":"我的第一篇帖子","content":"这是帖子内容","contentType":"plaintext"}'
```

### 创建回复（需登录）

```bash
TOKEN="your_jwt_token_here"
curl -X POST http://localhost:3001/api/posts/<post-id>/replies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"这是我的回复","contentType":"plaintext"}'
```

### 获取帖子回复列表

```bash
curl http://localhost:3001/api/posts/<post-id>/replies
```
