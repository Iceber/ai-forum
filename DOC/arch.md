# 项目架构文档

> 本文档面向 GitHub Copilot Agent 及开发者，详细梳理 ai-forum 项目的整体架构、模块关系、目录结构以及前后端 API 接口规范。

---

## 1. 系统架构总览

```
┌─────────────────────────────────────────────────────┐
│                    用户浏览器                         │
│  Next.js 前端 (http://localhost:3000)                │
│  React + TypeScript + Tailwind CSS                   │
│  状态管理: Zustand  |  数据请求: Axios + React Query  │
└──────────────────────┬──────────────────────────────┘
                       │  HTTP REST (JSON)
                       │  Authorization: Bearer <JWT>
                       ▼
┌─────────────────────────────────────────────────────┐
│              NestJS 后端 (http://localhost:3001)      │
│              TypeScript + Node.js                     │
│  全局中间件: ValidationPipe / ResponseInterceptor     │
│              / HttpExceptionFilter                    │
│  认证: Passport-JWT                                  │
│  ORM: TypeORM                                        │
└──────────────────────┬──────────────────────────────┘
                       │  TCP/SQL
                       ▼
┌─────────────────────────────────────────────────────┐
│          PostgreSQL 15  (localhost:5432)              │
│          数据库: aiforum                              │
│          表: users, bars, bar_members, posts, replies │
└─────────────────────────────────────────────────────┘
```

### 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js (React + TypeScript) | SSR/CSR 混合渲染 |
| UI 样式 | Tailwind CSS | 原子化 CSS |
| 前端状态 | Zustand | 轻量状态管理（登录态） |
| 数据请求 | Axios + React Query | 统一 HTTP 客户端 + 缓存 |
| 后端框架 | NestJS (TypeScript + Node.js) | 模块化、依赖注入 |
| ORM | TypeORM | 实体映射、Repository |
| 认证 | Passport-JWT + bcrypt | JWT 令牌 + 密码哈希 |
| 数据库 | PostgreSQL 15 | 关系型数据库，UUID v4 主键 |
| 容器化 | Docker + Docker Compose | 一键编排启动 |

---

## 2. 模块依赖关系图

```
AppModule (根模块)
├── ConfigModule (全局配置，读取 .env)
├── TypeOrmModule (PostgreSQL 连接，注册所有实体)
├── AuthModule
│   ├── → UsersModule (用户查询/创建)
│   ├── → JwtModule (JWT 签发/验证)
│   └── → PassportModule (认证策略)
├── UsersModule
│   └── → TypeOrmModule.forFeature([User])
├── BarsModule
│   └── → TypeOrmModule.forFeature([Bar, BarMember])
├── PostsModule
│   └── → TypeOrmModule.forFeature([Post])
└── RepliesModule
    ├── → TypeOrmModule.forFeature([Reply])
    └── → PostsModule (更新帖子回复计数)
```

### 实体关系图 (ER)

```
┌──────────┐       ┌──────────────┐       ┌──────────┐
│  users   │──1:N──│ bar_members  │──N:1──│   bars   │
│          │       │ (role:owner/ │       │          │
│          │       │  moderator/  │       │          │
│          │       │  member)     │       │          │
└────┬─────┘       └──────────────┘       └────┬─────┘
     │                                         │
     │ 1:N (author)            1:N (bar→posts) │
     │         ┌──────────┐                    │
     └─────────│  posts   │────────────────────┘
               │          │
               └────┬─────┘
                    │ 1:N (post→replies)
               ┌────┴─────┐
               │ replies   │──self── parent_reply_id (楼中楼，第一阶段置 null)
               └──────────┘
```

---

## 3. 项目目录结构与模块说明

### 3.1 根目录

```
ai-forum/
├── README.md                 # 项目定位、产品目标、MVP 范围
├── ARCHITECTURE.md           # 技术选型与架构设计原则
├── DEPLOY.md                 # 部署与启动指南
├── TESTING.md                # 测试指南
├── docker-compose.yml        # Docker 一键编排（postgres + backend + frontend）
├── DOC/                      # 项目文档目录
│   ├── arch.md               # 本文档：架构与 API 接口
│   └── usage.md              # 功能与用户使用链路
├── DEVELOP/                  # 开发规划文档
│   ├── PHASE1_IMPLEMENTATION_PLAN.md  # 第一阶段实现计划
│   └── TODO.md               # 未纳入阶段一的待办
├── backend/                  # NestJS 后端
└── frontend/                 # Next.js 前端
```

### 3.2 后端目录 (`backend/`)

```
backend/
├── Dockerfile                # 后端 Docker 镜像构建
├── package.json              # 依赖与脚本（build/test/start:dev）
├── tsconfig.json             # TypeScript 编译配置
├── .env.example              # 环境变量模板
├── migrations/
│   └── 001_initial_schema.sql  # 数据库初始化 DDL（手动迁移）
├── src/
│   ├── main.ts               # 应用启动入口（CORS、全局管道、前缀 /api）
│   ├── app.module.ts         # 根模块（注册所有子模块、TypeORM、Config）
│   ├── common/               # 全局公共基础设施
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts       # JWT 认证守卫
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts  # @CurrentUser() 参数装饰器
│   │   ├── response.interceptor.ts     # 统一响应信封包装
│   │   └── http-exception.filter.ts    # 统一异常处理
│   └── modules/              # 业务模块
│       ├── auth/             # 认证模块
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts      # 注册/登录/获取当前用户
│       │   ├── auth.service.ts         # 密码哈希、JWT 签发
│       │   ├── strategies/
│       │   │   └── jwt.strategy.ts     # Passport JWT 策略
│       │   └── dto/
│       │       ├── register.dto.ts     # 注册参数校验
│       │       └── login.dto.ts        # 登录参数校验
│       ├── users/            # 用户模块
│       │   ├── users.module.ts
│       │   ├── users.service.ts        # 用户 CRUD
│       │   └── user.entity.ts          # 用户实体
│       ├── bars/             # 吧模块
│       │   ├── bars.module.ts
│       │   ├── bars.controller.ts      # 吧列表/详情
│       │   ├── bars.service.ts         # 吧查询/创建
│       │   ├── bar.entity.ts           # 吧实体
│       │   ├── bar-member.entity.ts    # 吧成员实体
│       │   └── dto/
│       │       └── query-bars.dto.ts   # 列表查询参数
│       ├── posts/            # 帖子模块
│       │   ├── posts.module.ts
│       │   ├── posts.controller.ts     # 帖子列表/详情/创建
│       │   ├── posts.service.ts        # 帖子 CRUD + 回复计数
│       │   ├── post.entity.ts          # 帖子实体
│       │   └── dto/
│       │       └── create-post.dto.ts  # 发帖参数校验
│       └── replies/          # 回复模块
│           ├── replies.module.ts
│           ├── replies.controller.ts   # 回复列表/创建
│           ├── replies.service.ts      # 回复 CRUD + 楼层号分配
│           ├── reply.entity.ts         # 回复实体
│           └── dto/
│               └── create-reply.dto.ts # 回复参数校验
└── test/                     # 测试目录
```

#### 后端模块职责表

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| **common/guards** | JWT 认证守卫，保护需登录的路由 | `jwt-auth.guard.ts` |
| **common/decorators** | `@CurrentUser()` 从请求中提取当前用户 | `current-user.decorator.ts` |
| **common/response.interceptor** | 将所有成功响应包装为 `{ data, meta, error }` 信封 | `response.interceptor.ts` |
| **common/http-exception.filter** | 将所有异常转换为统一错误信封格式 | `http-exception.filter.ts` |
| **auth** | 注册、登录、JWT 签发与验证 | `auth.controller.ts`, `auth.service.ts`, `jwt.strategy.ts` |
| **users** | 用户实体定义与基础查询 | `user.entity.ts`, `users.service.ts` |
| **bars** | 吧的列表查询、详情查询、内部创建（seed 使用，含 owner 成员写入） | `bars.controller.ts`, `bars.service.ts` |
| **posts** | 帖子的列表、详情、创建，回复计数更新 | `posts.controller.ts`, `posts.service.ts` |
| **replies** | 回复的列表、创建，楼层号自动递增 | `replies.controller.ts`, `replies.service.ts` |

### 3.3 前端目录 (`frontend/`)

```
frontend/
├── Dockerfile                # 前端 Docker 镜像构建
├── package.json              # 依赖与脚本（dev/build/start）
├── tsconfig.json             # TypeScript 编译配置
├── next.config.mjs           # Next.js 配置
├── tailwind.config.ts        # Tailwind CSS 配置
├── postcss.config.js         # PostCSS 配置
├── .env.local.example        # 前端环境变量模板
├── public/                   # 静态资源
└── src/
    ├── app/                  # Next.js App Router 页面
    │   ├── layout.tsx        # 根布局（引入 Providers + Navbar）
    │   ├── page.tsx          # 首页（服务端渲染入口）
    │   ├── HomeClient.tsx    # 首页客户端组件（帖子流 + 加载更多）
    │   ├── providers.tsx     # React Query Provider 包装
    │   ├── globals.css       # 全局样式
    │   ├── login/
    │   │   └── page.tsx      # 登录页
    │   ├── register/
    │   │   └── page.tsx      # 注册页
    │   ├── create-post/
    │   │   └── page.tsx      # 发帖页（需登录）
    │   ├── bars/
    │   │   └── [id]/
    │   │       ├── page.tsx          # 吧详情页
    │   │       └── BarPostsClient.tsx # 吧内帖子客户端组件
    │   └── posts/
    │       └── [id]/
    │           ├── page.tsx              # 帖子详情页
    │           └── PostRepliesClient.tsx  # 帖子回复客户端组件
    ├── components/           # 可复用组件
    │   ├── layout/
    │   │   └── Navbar.tsx    # 顶部导航栏
    │   ├── bar/
    │   │   └── BarCard.tsx   # 吧卡片组件
    │   ├── post/
    │   │   └── PostCard.tsx  # 帖子卡片组件
    │   └── reply/
    │       └── ReplyItem.tsx # 回复楼层组件
    ├── lib/                  # 工具库
    │   ├── api-client.ts     # Axios 实例（自动附加 JWT、401 处理）
    │   ├── auth.ts           # Zustand 登录态 Store（token + user）
    │   └── server-api.ts     # 服务端数据请求（SSR 多地址回退）
    └── types/
        └── index.ts          # TypeScript 类型定义（User, Bar, Post, Reply, ApiResponse 等）
```

#### 前端模块职责表

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| **lib/api-client** | Axios 封装，自动附加 Bearer Token，401 自动清除登录态 | `api-client.ts` |
| **lib/auth** | Zustand Store，管理 token/user 持久化到 localStorage | `auth.ts` |
| **lib/server-api** | SSR 数据请求，支持 Docker 内部地址 → 公网地址多级回退 | `server-api.ts` |
| **types** | 全局类型定义：`User`, `Bar`, `Post`, `Reply`, `PageMeta`, `ApiResponse` | `index.ts` |
| **components/layout** | 顶部导航栏（Logo、发帖按钮、登录/登出） | `Navbar.tsx` |
| **components/bar** | 吧卡片展示（名称 + 描述，点击跳转） | `BarCard.tsx` |
| **components/post** | 帖子卡片（标题、内容摘要、作者、吧名、回复数） | `PostCard.tsx` |
| **components/reply** | 回复楼层（楼层号、作者、时间、内容） | `ReplyItem.tsx` |
| **app/page + HomeClient** | 首页：帖子流 + 吧推荐 + 无限加载 | `page.tsx`, `HomeClient.tsx` |
| **app/login** | 登录页：邮箱 + 密码，登录后跳转首页 | `login/page.tsx` |
| **app/register** | 注册页：邮箱 + 密码 + 昵称，注册后自动登录 | `register/page.tsx` |
| **app/create-post** | 发帖页：选择吧 + 标题 + 内容，需登录 | `create-post/page.tsx` |
| **app/bars/[id]** | 吧详情页：吧信息 + 吧内帖子列表 | `bars/[id]/page.tsx`, `BarPostsClient.tsx` |
| **app/posts/[id]** | 帖子详情页：主楼 + 回复列表 + 回复输入 | `posts/[id]/page.tsx`, `PostRepliesClient.tsx` |

---

## 4. 数据库表结构

### 4.1 users（用户表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK, 自动生成 | 用户 ID |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | 邮箱 |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt 哈希密码 |
| `nickname` | VARCHAR(100) | NOT NULL | 昵称 |
| `avatar_url` | VARCHAR(500) | NULL | 头像 URL（预留） |
| `bio` | TEXT | NULL | 个人签名（预留） |
| `role` | VARCHAR(20) | DEFAULT 'user' | 全局角色：`user` / `admin` |
| `token_version` | INTEGER | DEFAULT 0 | JWT 版本号（改密/封禁失效） |
| `email_verified` | BOOLEAN | DEFAULT FALSE | 邮箱已验证（预留） |
| `auth_provider` | VARCHAR(50) | DEFAULT 'local' | 认证来源（预留第三方登录） |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

### 4.2 bars（吧表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 吧 ID |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | 吧名称 |
| `description` | TEXT | NOT NULL | 吧描述 |
| `avatar_url` | VARCHAR(500) | NULL | 吧头像（预留） |
| `rules` | TEXT | NULL | 吧规（预留） |
| `category` | VARCHAR(100) | NULL | 吧分类（预留） |
| `status` | VARCHAR(20) | DEFAULT 'active' | 状态：`active` / `archived` |
| `created_by` | UUID | FK → users.id | 创建者 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

### 4.3 bar_members（吧成员表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 成员记录 ID |
| `bar_id` | UUID | FK → bars.id, UNIQUE(bar_id, user_id) | 所属吧 |
| `user_id` | UUID | FK → users.id | 用户 |
| `role` | VARCHAR(20) | DEFAULT 'member' | 吧内角色：`member` / `moderator` / `owner` |
| `joined_at` | TIMESTAMPTZ | DEFAULT NOW() | 加入时间 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

### 4.4 posts（帖子表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 帖子 ID |
| `bar_id` | UUID | FK → bars.id | 所属吧 |
| `author_id` | UUID | FK → users.id | 作者 |
| `title` | VARCHAR(300) | NOT NULL | 标题 |
| `content` | TEXT | NOT NULL | 正文 |
| `content_type` | VARCHAR(20) | DEFAULT 'plaintext' | 格式：`plaintext` / `markdown` |
| `reply_count` | INTEGER | DEFAULT 0 | 回复数（冗余计数） |
| `last_reply_at` | TIMESTAMPTZ | NULL | 最后回复时间 |
| `status` | VARCHAR(20) | DEFAULT 'published' | 状态：`published` / `hidden` / `deleted` / `under_review` |
| `deleted_at` | TIMESTAMPTZ | NULL | 软删除标记 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**索引**: `(bar_id, created_at)` — 吧内帖子列表查询

### 4.5 replies（回复表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 回复 ID |
| `post_id` | UUID | FK → posts.id | 所属帖子 |
| `author_id` | UUID | FK → users.id | 作者 |
| `parent_reply_id` | UUID | FK → replies.id, NULL | 父回复（楼中楼，第一阶段置 null） |
| `floor_number` | INTEGER | NOT NULL | 楼层号（帖内自增） |
| `content` | TEXT | NOT NULL | 回复内容 |
| `content_type` | VARCHAR(20) | DEFAULT 'plaintext' | 格式：`plaintext` / `markdown` |
| `status` | VARCHAR(20) | DEFAULT 'published' | 状态（同帖子） |
| `deleted_at` | TIMESTAMPTZ | NULL | 软删除标记 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**索引**: `(post_id, floor_number)` — 帖子回复楼层查询

---

## 5. API 接口文档

### 5.1 通用约定

#### 基础路径
所有后端 API 统一前缀为 `/api`。

#### 认证方式
- 注册/登录返回 JWT（字段名 `accessToken`）
- 需认证接口请求头携带 `Authorization: Bearer <token>`

#### 统一响应格式

**成功响应**:
```json
{
  "data": { ... },
  "meta": { "cursor": "xxx", "hasMore": true },
  "error": null
}
```

**错误响应**:
```json
{
  "data": null,
  "meta": null,
  "error": { "code": "BAD_REQUEST", "message": "具体错误信息" }
}
```

错误码映射:
| HTTP 状态码 | error.code | 说明 |
|-------------|-----------|------|
| 400 | BAD_REQUEST | 请求参数错误 |
| 401 | UNAUTHORIZED | 未认证或 Token 无效 |
| 403 | FORBIDDEN | 无权访问 |
| 404 | NOT_FOUND | 资源不存在 |
| 422 | UNPROCESSABLE_ENTITY | 数据校验失败 |
| 500 | INTERNAL_SERVER_ERROR | 服务器内部错误 |

#### 分页策略
- 采用 **cursor-based** 分页
- 请求参数: `cursor`（可选，首次不传）+ `limit`（默认 20，最大 100）
- `cursor` 为 base64 编码值：bars/posts 使用 `createdAt`，replies 使用 `floor_number`
- 响应 `meta` 包含 `cursor`（下一页游标）和 `hasMore`（是否有下一页）

---

### 5.2 Auth 认证接口

#### `POST /api/auth/register` — 用户注册

- **认证**: 无需
- **请求体**:
  ```json
  {
    "email": "user@example.com",
    "password": "Min8Chars!",
    "nickname": "用户昵称"
  }
  ```
  | 字段 | 类型 | 校验 |
  |------|------|------|
  | email | string | 合法邮箱格式 |
  | password | string | 8-128 字符 |
  | nickname | string | 2-50 字符 |

- **成功响应** (201):
  ```json
  {
    "data": {
      "accessToken": "eyJhbGciOi...",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "nickname": "用户昵称",
        "role": "user",
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    },
    "meta": null,
    "error": null
  }
  ```

#### `POST /api/auth/login` — 用户登录

- **认证**: 无需
- **请求体**:
  ```json
  {
    "email": "user@example.com",
    "password": "Min8Chars!"
  }
  ```
  | 字段 | 类型 | 校验 |
  |------|------|------|
  | email | string | 合法邮箱格式 |
  | password | string | 不为空 |

- **成功响应** (200):
  ```json
  {
    "data": {
      "accessToken": "eyJhbGciOi...",
      "user": { ... }
    },
    "meta": null,
    "error": null
  }
  ```

#### `GET /api/auth/me` — 获取当前用户

- **认证**: 需要 (Bearer Token)
- **成功响应** (200):
  ```json
  {
    "data": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "用户昵称",
      "role": "user",
      "createdAt": "..."
    },
    "meta": null,
    "error": null
  }
  ```

---

### 5.3 Bars 吧接口

#### `GET /api/bars` — 获取吧列表

- **认证**: 无需
- **查询参数**:
  | 参数 | 类型 | 必填 | 默认值 | 说明 |
  |------|------|------|--------|------|
  | cursor | string | 否 | - | 分页游标（base64 编码的 createdAt） |
  | limit | number | 否 | 20 | 每页数量，最大 100 |

- **成功响应** (200):
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "name": "技术讨论",
        "description": "讨论编程与技术趋势",
        "status": "active",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "meta": { "cursor": "base64...", "hasMore": true },
    "error": null
  }
  ```

#### `GET /api/bars/:id` — 获取吧详情

- **认证**: 无需
- **路径参数**: `id` — 吧 UUID
- **成功响应** (200):
  ```json
  {
    "data": {
      "id": "uuid",
      "name": "技术讨论",
      "description": "...",
      "avatarUrl": null,
      "rules": null,
      "category": null,
      "status": "active",
      "createdBy": { "id": "uuid", "nickname": "管理员" },
      "createdAt": "...",
      "updatedAt": "..."
    },
    "meta": null,
    "error": null
  }
  ```

---

### 5.4 Posts 帖子接口

#### `GET /api/posts` — 获取帖子列表

- **认证**: 无需
- **查询参数**:
  | 参数 | 类型 | 必填 | 默认值 | 说明 |
  |------|------|------|--------|------|
  | barId | string (UUID) | 否 | - | 按吧筛选 |
  | cursor | string | 否 | - | 分页游标 |
  | limit | number | 否 | 20 | 每页数量，最大 100 |

- **成功响应** (200):
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "title": "帖子标题",
        "content": "帖子内容...",
        "contentType": "plaintext",
        "replyCount": 5,
        "lastReplyAt": "...",
        "author": { "id": "uuid", "nickname": "用户" },
        "bar": { "id": "uuid", "name": "技术讨论" },
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "meta": { "cursor": "...", "hasMore": false },
    "error": null
  }
  ```

#### `GET /api/posts/:id` — 获取帖子详情

- **认证**: 无需
- **路径参数**: `id` — 帖子 UUID
- **成功响应** (200): 同列表单项结构，包含完整 `author` 和 `bar` 关联

#### `POST /api/posts` — 创建帖子

- **认证**: 需要 (Bearer Token)
- **请求体**:
  ```json
  {
    "barId": "uuid",
    "title": "帖子标题",
    "content": "帖子内容",
    "contentType": "plaintext"
  }
  ```
  | 字段 | 类型 | 必填 | 校验 |
  |------|------|------|------|
  | barId | string (UUID) | 是 | 合法 UUID |
  | title | string | 是 | 1-300 字符 |
  | content | string | 是 | 不为空 |
  | contentType | string | 否 | `plaintext`(默认) / `markdown` |

- **成功响应** (201): 返回创建的帖子对象

---

### 5.5 Replies 回复接口

#### `GET /api/posts/:postId/replies` — 获取帖子回复列表

- **认证**: 无需
- **路径参数**: `postId` — 帖子 UUID
- **查询参数**:
  | 参数 | 类型 | 必填 | 默认值 | 说明 |
  |------|------|------|--------|------|
  | cursor | string | 否 | - | 分页游标（base64 编码的 floor_number） |
  | limit | number | 否 | 20 | 每页数量，最大 100 |

- **成功响应** (200):
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "floorNumber": 1,
        "content": "回复内容",
        "contentType": "plaintext",
        "author": { "id": "uuid", "nickname": "用户" },
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "meta": { "cursor": "...", "hasMore": true },
    "error": null
  }
  ```
  > 回复按楼层号升序排列。

#### `POST /api/posts/:postId/replies` — 创建回复

- **认证**: 需要 (Bearer Token)
- **路径参数**: `postId` — 帖子 UUID
- **请求体**:
  ```json
  {
    "content": "回复内容",
    "contentType": "plaintext",
    "parentReplyId": null
  }
  ```
  | 字段 | 类型 | 必填 | 校验 |
  |------|------|------|------|
  | content | string | 是 | 不为空 |
  | contentType | string | 否 | `plaintext`(默认) / `markdown` |
  | parentReplyId | string (UUID) | 否 | 楼中楼父回复（第一阶段置 null） |

- **成功响应** (201): 返回创建的回复对象，包含自动分配的 `floorNumber`

---

### 5.6 API 接口汇总表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 否 | 用户注册 |
| POST | `/api/auth/login` | 否 | 用户登录 |
| GET | `/api/auth/me` | 是 | 获取当前用户信息 |
| GET | `/api/bars` | 否 | 吧列表（cursor 分页） |
| GET | `/api/bars/:id` | 否 | 吧详情 |
| GET | `/api/posts` | 否 | 帖子列表（可按 barId 筛选，cursor 分页） |
| GET | `/api/posts/:id` | 否 | 帖子详情 |
| POST | `/api/posts` | 是 | 创建帖子 |
| GET | `/api/posts/:postId/replies` | 否 | 帖子回复列表（cursor 分页） |
| POST | `/api/posts/:postId/replies` | 是 | 创建回复 |

---

## 6. 前端页面与 API 调用关系

| 页面 | 路由 | 渲染方式 | 调用的 API |
|------|------|----------|------------|
| 首页 | `/` | SSR + CSR | `GET /api/posts?limit=20`, `GET /api/bars?limit=12` |
| 登录 | `/login` | CSR | `POST /api/auth/login` |
| 注册 | `/register` | CSR | `POST /api/auth/register` |
| 发帖 | `/create-post` | CSR（需登录） | `GET /api/bars`, `POST /api/posts` |
| 吧详情 | `/bars/[id]` | CSR | `GET /api/bars/:id`, `GET /api/posts?barId=...&limit=20` |
| 帖子详情 | `/posts/[id]` | CSR | `GET /api/posts/:id`, `GET /api/posts/:id/replies?limit=50` |

---

## 7. 环境变量与配置

### 后端 (`backend/.env`)

| 变量名 | 示例 | 说明 |
|--------|------|------|
| `DATABASE_URL` | `postgresql://aiforum:aiforum_dev_pass@localhost:5432/aiforum` | PostgreSQL 连接字符串 |
| `JWT_SECRET` | `change_me_in_production_32chars_min` | JWT 签名密钥 |
| `JWT_EXPIRES_IN` | `7d` | JWT 有效期 |
| `PORT` | `3001` | 后端监听端口 |
| `CORS_ORIGIN` | `http://localhost:3000` | 允许跨域的前端地址 |

### 前端 (`frontend/.env.local`)

| 变量名 | 示例 | 说明 |
|--------|------|------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | 浏览器端 API 地址 |
| `API_INTERNAL_URL` | `http://backend:3001` | Docker 内 SSR 请求地址 |
| `API_DEFAULT_URL` | `http://localhost:3001` | SSR 回退 API 地址 |

---

## 8. Docker Compose 编排

```yaml
services:
  postgres:    # PostgreSQL 15，端口 5432
  backend:     # NestJS 后端，端口 3001，依赖 postgres
  frontend:    # Next.js 前端，端口 3000，依赖 backend
```

启动命令: `docker-compose up -d`

---

## 9. 第二阶段扩展预留

当前架构已为后续功能预留以下扩展点：

| 预留点 | 当前状态 | 扩展方向 |
|--------|---------|---------|
| `bar_members` 表 | 仅创建吧时写入 owner | 加入/退出吧、吧务管理 |
| `parent_reply_id` 字段 | 第一阶段置 null | 二级回复（楼中楼） |
| `content_type` 字段 | 仅 plaintext | Markdown / 富文本渲染 |
| `status` + `deleted_at` | 仅 published | 审核队列、软删除流程 |
| `token_version` | 默认 0 | 改密/封禁后 JWT 失效 |
| `email_verified` | 默认 false | 邮箱验证流程 |
| `auth_provider` | 默认 local | 第三方 OAuth 登录 |
| AI embedding | 未实现 | pgvector 内容向量化、相关帖推荐 |
| moderation_logs | 未实现 | AI 审核 + 人工治理日志 |
