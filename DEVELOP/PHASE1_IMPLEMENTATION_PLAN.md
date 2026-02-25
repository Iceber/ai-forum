# 第一阶段代码实现细化（可运行骨架）

> 目标：基于 README.md 的技术选型与功能规划，在不一次性实现全部核心能力的前提下，先完成「前后端可运行、可测试、可展示」的最小闭环。

## 1. 第一阶段范围（只做基础能力）

### 1.1 本阶段要实现
- 工程骨架：`Next.js + NestJS + PostgreSQL` 基础项目结构与联调链路
- 身份能力（最小）：注册、登录、获取当前用户信息
- 吧能力（最小）：吧列表、吧详情（只读）
- 帖子能力（最小）：发帖、帖子列表、帖子详情
- 回复能力（最小）：帖子下回复列表、发布回复（仅一级回复）

### 1.2 本阶段明确不实现
- AI 相关能力（重复帖检测、审核提示、摘要）
- 复杂权限治理（吧主/版主完整后台流）
- 收藏/分享/@提醒/消息中心等增强能力
- 媒体上传（对象存储）先预留接口，不落地上传流程

---

## 2. 代码目录规划

## 2.1 后端（NestJS）
```txt
backend/
  src/
    main.ts
    app.module.ts
    modules/
      auth/
      users/
      bars/
      posts/
      replies/
    common/
      guards/
      decorators/
      dto/
```

## 2.2 前端（Next.js）
```txt
frontend/
  src/
    app/
      page.tsx                  # 首页（帖子流）
      bars/[id]/page.tsx        # 吧详情
      posts/[id]/page.tsx       # 帖子详情 + 回复区
      login/page.tsx
      register/page.tsx
      create-post/page.tsx
    components/
      post/
      reply/
      bar/
      layout/
    lib/
      api-client.ts
      auth.ts
```

---

## 3. 数据模型（第一阶段最小表）

### 3.1 users
- `id` (pk)
- `username` (unique)
- `password_hash`
- `nickname`
- `created_at`

### 3.2 bars
- `id` (pk)
- `name` (unique)
- `description`
- `created_by` (fk -> users.id)
- `created_at`

### 3.3 posts
- `id` (pk)
- `bar_id` (fk -> bars.id)
- `author_id` (fk -> users.id)
- `title`
- `content`
- `created_at`
- `updated_at`

### 3.4 replies
- `id` (pk)
- `post_id` (fk -> posts.id)
- `author_id` (fk -> users.id)
- `content`
- `created_at`

---

## 4. API 设计（第一阶段）

## 4.1 Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

## 4.2 Bars
- `GET /api/bars`
- `GET /api/bars/:id`

## 4.3 Posts
- `GET /api/posts?barId=`
- `GET /api/posts/:id`
- `POST /api/posts`（需登录）

## 4.4 Replies
- `GET /api/posts/:id/replies`
- `POST /api/posts/:id/replies`（需登录）

---

## 5. 前端页面落地（可展示）

- 首页：展示最新帖子列表（可跳转详情）
- 吧详情页：展示吧信息 + 吧下帖子
- 帖子详情页：主楼内容 + 回复列表 + 回复输入框
- 登录/注册页：完成 token 获取与登录态保存
- 发帖页：选择吧 + 输入标题正文并提交

---

## 6. 测试与运行（可测试）

## 6.1 后端
- 单元测试：`auth.service`、`posts.service` 基础用例
- e2e 测试：注册 -> 登录 -> 发帖 -> 回帖主流程

## 6.2 前端
- 组件测试：帖子卡片、回复列表渲染
- 页面测试：未登录跳转、登录后发帖提交流程

> 若第一阶段先行落地测试框架，最低要求为后端 e2e 主流程 + 前端 1~2 个关键组件测试，确保后续迭代可持续。

---

## 7. 第一阶段验收标准

- 能本地一键启动前后端与数据库（开发环境）
- 用户可完成注册/登录
- 用户可浏览吧与帖子
- 用户可发帖并在帖子下回复
- 至少有一条自动化测试链路可通过（建议后端 e2e）
- 页面可演示核心链路：首页 -> 帖子详情 -> 回复

---

## 8. 第二阶段衔接点（预留，不在本阶段实现）

- 回复二级楼层与引用
- 吧务角色与管理操作
- 收藏、点赞、通知中心
- 接入 AI 能力（相关帖推荐、审核提示、摘要）
- 对象存储媒体上传（S3/MinIO）
