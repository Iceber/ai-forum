# 第一阶段功能与接口说明

本文档整理当前第一阶段已实现的前后端功能、接口规范与用户操作流程，方便本地部署与验收。

## 1. 后端功能（NestJS）

### 1.1 已实现模块
- **Auth**：注册 / 登录 / 获取当前用户
- **Bars**：吧列表、吧详情（只读）
- **Posts**：发帖、帖子列表、帖子详情
- **Replies**：帖子下回复列表、发布回复（一级回复）

### 1.2 统一响应格式
所有接口采用统一信封结构：

```json
{
  "data": { ... } | null,
  "meta": { "cursor": "...", "hasMore": true } | null,
  "error": null | { "code": "...", "message": "..." }
}
```

- 列表接口返回 `data` 数组，并包含分页 `meta`
- 单对象接口返回 `data` 对象，`meta` 可省略

### 1.3 分页策略
- 使用 **cursor-based** 分页
- `cursor` 为 base64 编码的 `createdAt`（bars/posts）或 `floor_number`（replies）
- `limit` 默认 20，最大 100

### 1.4 认证方式
- 注册/登录返回 JWT（字段名 `accessToken`）
- 前端将 token 存入 `localStorage`，请求时携带 `Authorization: Bearer <token>`

## 2. 前端功能（Next.js）

### 2.1 页面能力
- 首页：帖子列表（支持加载更多）
- 吧详情：吧信息 + 吧内帖子列表
- 帖子详情：主楼 + 回复列表 + 发布回复
- 登录 / 注册
- 发帖页（需登录）

### 2.2 登录态管理
- 使用 `Zustand` 保存 `token` 与 `user`
- 请求时自动附加 JWT，401 自动清除登录态并跳转登录页

## 3. API 接口清单（第一阶段）

### 3.1 Auth
- `POST /api/auth/register`
  - 请求：`{ email, password, nickname }`
  - 响应：`{ data: { accessToken, user }, ... }`
- `POST /api/auth/login`
  - 请求：`{ email, password }`
  - 响应：`{ data: { accessToken, user }, ... }`
- `GET /api/auth/me`（需登录）

### 3.2 Bars
- `GET /api/bars?cursor=&limit=`
- `GET /api/bars/:id`

### 3.3 Posts
- `GET /api/posts?barId=&cursor=&limit=`
- `GET /api/posts/:id`
- `POST /api/posts`（需登录）
  - 请求：`{ barId, title, content, contentType? }`

### 3.4 Replies
- `GET /api/posts/:id/replies?cursor=&limit=`
- `POST /api/posts/:id/replies`（需登录）
  - 请求：`{ content, contentType? }`

## 4. 用户操作流程（可支持的主链路）

### 4.1 匿名浏览
1. 打开首页查看最新帖子
2. 点击帖子进入详情页查看主楼与回复
3. 点击吧名称进入吧详情页浏览更多帖子

### 4.2 注册 / 登录
1. 访问 `/register` 提交邮箱、密码、昵称
2. 注册成功后自动登录并跳转首页
3. 或访问 `/login` 使用邮箱 + 密码登录

### 4.3 发帖流程（需登录）
1. 点击「发帖」进入发帖页
2. 选择吧、填写标题与内容
3. 提交后跳转帖子详情页

### 4.4 回复流程（需登录）
1. 打开帖子详情页
2. 填写回复内容并提交
3. 回复成功后出现在回复列表

---

如需扩展 AI 能力、吧管理、二级回复等功能，可参考 `DEVELOP/PHASE1_IMPLEMENTATION_PLAN.md` 中的后续规划。
