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

前端工程约定（第一阶段定规范）：
- `lib/auth.ts` 统一管理登录态（Context 或 Zustand 二选一），避免页面状态分散
- `lib/api-client.ts` 统一处理中间层：自动附加 token、401 统一处理、错误结构对齐 §4.6
- 渲染策略：
  - 吧主页、帖子详情：SSR 优先
  - 登录/注册/发帖：CSR
  - 首页：SSR 首屏 + CSR 增量

---

## 3. 数据模型（第一阶段最小表）

> 所有表主键统一使用 **UUID v4**，避免自增 ID 带来的枚举风险和分布式扩展问题。

### 3.1 users
- `id` (pk, uuid)
- `email` (unique)
- `password_hash`
- `nickname`
- `avatar_url` (nullable) — 第一阶段预留，前端暂不展示
- `bio` (nullable) — 个人签名，第一阶段预留
- `role` (default `user`) — 全局角色（`user` / `admin`），第一阶段仅区分普通用户
- `token_version` (default 0) — JWT 版本号，用于改密/封禁后的会话失效
- `email_verified` (default false)
- `auth_provider` (default `local`)
- `created_at`
- `updated_at`

### 3.2 bars
- `id` (pk, uuid)
- `name` (unique)
- `description`
- `avatar_url` (nullable) — 吧头像，第一阶段预留
- `rules` (nullable, text) — 吧规，第一阶段预留
- `category` (nullable) — 吧分类，第一阶段预留
- `status` (default `active`) — 吧状态（`active` / `archived`），第一阶段预留
- `created_by` (fk -> users.id)
- `created_at`
- `updated_at`

### 3.3 bar_members
- `id` (pk, uuid)
- `bar_id` (fk -> bars.id)
- `user_id` (fk -> users.id)
- `role` (default `member`) — 吧内角色（`member` / `moderator` / `owner`）
- `joined_at`
- `updated_at`
- unique constraint: (`bar_id`, `user_id`)

> 第一阶段仅在创建吧时自动写入一条 owner 记录，不暴露加入/管理 API。该表为第二阶段吧务角色、"我的吧"、成员统计提供基础。

### 3.4 posts
- `id` (pk, uuid)
- `bar_id` (fk -> bars.id)
- `author_id` (fk -> users.id)
- `title`
- `content`
- `content_type` (default `plaintext`) — 内容格式（`plaintext` / `markdown`），第一阶段仅支持纯文本
- `reply_count` (default 0) — 回帖数冗余计数，用于列表性能优化
- `last_reply_at` (nullable timestamp) — 最后回复时间，用于“热门/顶帖”排序
- `status` (default `published`) — 帖子状态（`published` / `hidden` / `deleted` / `under_review`），第一阶段仅使用 `published`
- `deleted_at` (nullable timestamp) — 软删除标记，第一阶段预留
- `created_at`
- `updated_at`

### 3.5 replies
- `id` (pk, uuid)
- `post_id` (fk -> posts.id)
- `author_id` (fk -> users.id)
- `parent_reply_id` (nullable fk -> replies.id) — 楼中楼父回复，第一阶段置 null（仅一级回复）
- `floor_number` (int) — 楼层号，第一阶段自动递增分配
- `content`
- `content_type` (default `plaintext`) — 同 posts
- `status` (default `published`) — 同 posts
- `deleted_at` (nullable timestamp) — 同 posts
- `created_at`
- `updated_at`

### 3.6 索引规划（第一阶段建议直接建立）
- `posts(bar_id, created_at)`：吧内帖子列表查询
- `replies(post_id, floor_number)`：帖子回复楼层查询
- `bar_members(user_id, joined_at)`：我的吧列表查询

---

## 4. API 设计（第一阶段）

## 4.1 Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

第一阶段登录注册设计（最小落地）：
- 仅支持邮箱注册与登录（不接入短信/用户名登录）
- 注册参数：`email`、`password`、`nickname`
- 登录参数：`email`、`password`
- 密码仅存储哈希值（bcrypt/argon2）
- 会话使用 JWT（可选 refresh token）
- 第一阶段不做邮件发送与二次验证，仅保留 `email_verified` 字段供后续扩展

后续扩展预留（非第一阶段）：
- 邮箱验证：新增验证 token 表，支持过期与重发策略
- 第三方登录：新增 `user_identities`（`provider` + `provider_user_id` 唯一）支持 OAuth2/OIDC 账号绑定

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

第一阶段访问策略（匿名可读）：
- 未登录用户可访问：`GET /api/bars`、`GET /api/bars/:id`、`GET /api/posts`、`GET /api/posts/:id`、`GET /api/posts/:id/replies`
- 登录后才可访问：`POST /api/posts`、`POST /api/posts/:id/replies`

## 4.5 分页策略

第一阶段统一采用 **cursor-based** 分页，避免后续改动成为 breaking change：
- 请求参数：`cursor`（可选，首次请求不传）+ `limit`（默认 20，最大 100）
- 适用接口：`GET /api/bars`、`GET /api/posts`、`GET /api/posts/:id/replies`

## 4.6 统一响应格式

所有 API 响应采用统一信封结构，便于前端通用组件和错误处理：
```json
{
  "data": { ... },
  "meta": {
    "cursor": "下一页游标",
    "hasMore": true
  },
  "error": null
}
```
- 列表接口：`data` 为数组，附带 `meta` 分页信息
- 单资源接口：`data` 为对象，`meta` 可省略
- 错误响应：`data` 为 null，`error` 包含 `code` + `message`

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

## 6.3 迁移与配置基线
- 数据库 schema 仅通过 migration 文件管理，避免使用 ORM 自动同步
- 环境变量管理：
  - 后端：`@nestjs/config` + `.env` + `.env.example`
  - 前端：`NEXT_PUBLIC_*` 规范管理可公开配置

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

- 回复二级楼层与引用（`parent_reply_id` 已预留）
- 吧务角色与管理操作（`bar_members` 表已预留）
- 收藏、点赞、通知中心
- 接入 AI 能力（相关帖推荐、审核提示、摘要）
- 对象存储媒体上传（S3/MinIO）
- 内容格式扩展：Markdown / 富文本渲染（`content_type` 已预留）
- 内容治理：帖子/回复审核队列与软删除流程（`status` + `deleted_at` 已预留）

## 9. AI 能力预埋方向（不在第一阶段实现，仅记录设计方向）

### 9.1 内容向量化
- AI 重复帖检测与相关帖推荐依赖内容 embedding
- 后续可在 posts 表新增 `embedding vector(1536)` 列（PG pgvector 扩展），或独立 `post_embeddings` 表
- 第一阶段 ORM entity 设计时保持扩展空间，不封死字段列表

### 9.2 审核日志
- AI 审核与人工治理需要统一的操作记录
- 后续新增 `moderation_logs` 表：`target_type`、`target_id`、`action`、`reason`、`actor_id`、`created_at`
- 第一阶段不实现，但帖子/回复的 `status` 字段已为审核状态机预留基础

---
