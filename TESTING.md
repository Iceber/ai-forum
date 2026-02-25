# 测试指南

## 1. 后端单元测试

```bash
cd backend && npm run test
```

测试框架为 Jest，覆盖各模块的 Service 层逻辑单元测试。

---

## 2. 后端 E2E 测试

### 前置条件

- PostgreSQL 必须正在运行
- 已创建测试数据库并执行过迁移
- 在 `backend/.env` 中配置 `TEST_DATABASE_URL`，或在命令行中内联传入

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

### E2E 测试覆盖流程

E2E 测试覆盖完整的用户操作链路：

1. **注册**：`POST /auth/register` — 创建新用户
2. **登录**：`POST /auth/login` — 获取 JWT Token
3. **创建帖子**：`POST /bars/:barId/posts` — 在指定 Bar 下发帖
4. **创建回复**：`POST /posts/:postId/replies` — 对帖子进行回复

---

## 3. 前端测试（预留）

前端测试基础设施已搭建完毕（Jest + Testing Library），但组件测试为 **Phase 2** 交付内容，当前版本暂无可运行的前端测试用例。

```bash
cd frontend && npm run test   # Phase 2 后可用
```

---

## 4. 手动测试流程

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

## 5. API 手动测试（curl 示例）

### 注册用户

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Test1234!"}'
```

### 用户登录

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
# 返回值中包含 access_token，后续请求需携带
```

### 获取 Bar 列表

```bash
curl http://localhost:3001/bars
```

### 获取某个 Bar 下的帖子

```bash
curl http://localhost:3001/bars/1/posts
```

### 创建帖子（需登录）

```bash
TOKEN="your_jwt_token_here"
curl -X POST http://localhost:3001/bars/1/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"我的第一篇帖子","content":"这是帖子内容"}'
```

### 创建回复（需登录）

```bash
TOKEN="your_jwt_token_here"
curl -X POST http://localhost:3001/posts/1/replies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content":"这是我的回复"}'
```
