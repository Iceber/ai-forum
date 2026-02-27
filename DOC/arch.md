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
│          表: users, bars, bar_members, posts, replies,│
│              admin_actions, user_likes, user_favorites │
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
├── TypeOrmModule (PostgreSQL 连接，注册所有实体: User, Bar, BarMember, Post, Reply, AdminAction, UserLike, UserFavorite)
├── AuthModule
│   ├── → UsersModule (用户查询/创建)
│   ├── → JwtModule (JWT 签发/验证)
│   └── → PassportModule (认证策略)
├── UsersModule
│   └── → TypeOrmModule.forFeature([User, Post, Reply, BarMember, Bar])
├── BarsModule
│   └── → TypeOrmModule.forFeature([Bar, BarMember])
├── AdminModule
│   ├── → TypeOrmModule.forFeature([Bar, AdminAction])
│   └── → BarsModule
├── LikesModule (点赞)
│   └── TypeORM: UserLike, Post, Reply
├── FavoritesModule (收藏)
│   └── TypeORM: UserFavorite, Post
├── UploadsModule (媒体上传)
│   └── ConfigService
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
     │         │          │
     │         └────┬─────┘
     │              │ 1:N (post→replies)
     │         ┌────┴─────┐
     │         │ replies   │──self── parent_reply_id (楼中楼，第一阶段置 null)
     │         └──────────┘
     │
     │ 1:N (admin→admin_actions)
     │         ┌────────────────┐
     └─────────│ admin_actions  │── target_id → bars/posts/... (逻辑外键)
               │ (审计日志)      │
               └────────────────┘
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
│   ├── PHASE2_IMPLEMENTATION_PLAN.md  # 第二阶段实现计划（不含 AI）
│   ├── PHASE3_IMPLEMENTATION_PLAN.md  # 第三阶段实现计划
│   └── TODO.md               # 延期功能与候选能力待办
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
│   ├── 001_initial_schema.sql    # 数据库初始化 DDL（手动迁移）
│   └── 002_phase2_bars_admin.sql # Phase 2: 吧状态扩展 + 管理员操作表
├── src/
│   ├── main.ts               # 应用启动入口（CORS、全局管道、前缀 /api）
│   ├── app.module.ts         # 根模块（注册所有子模块、TypeORM、Config）
│   ├── common/               # 全局公共基础设施
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts       # JWT 认证守卫
│   │   │   ├── admin.guard.ts          # 管理员角色守卫
│   │   │   └── optional-auth.guard.ts  # 可选认证守卫（未登录返回 null）
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
│       │   ├── users.controller.ts    # 个人中心接口（我的帖子/回复/吧/资料）
│       │   ├── users.service.ts        # 用户 CRUD + 个人中心查询
│       │   ├── user.entity.ts          # 用户实体
│       │   └── dto/
│       │       └── update-profile.dto.ts # 更新个人资料参数校验
│       ├── bars/             # 吧模块
│       │   ├── bars.module.ts
│       │   ├── bars.controller.ts      # 吧列表/详情/创建/加入/退出
│       │   ├── bars.service.ts         # 吧查询/创建/加入/退出
│       │   ├── bar.entity.ts           # 吧实体
│       │   ├── bar-member.entity.ts    # 吧成员实体
│       │   └── dto/
│       │       ├── query-bars.dto.ts   # 列表查询参数
│       │       └── create-bar.dto.ts   # 创建吧参数校验
│       ├── posts/            # 帖子模块
│       │   ├── posts.module.ts
│       │   ├── posts.controller.ts     # 帖子列表/详情/创建
│       │   ├── posts.service.ts        # 帖子 CRUD + 回复计数
│       │   ├── post.entity.ts          # 帖子实体
│       │   └── dto/
│       │       └── create-post.dto.ts  # 发帖参数校验
│       ├── replies/          # 回复模块
│       │   ├── replies.module.ts
│       │   ├── replies.controller.ts   # 回复列表/创建
│       │   ├── replies.service.ts      # 回复 CRUD + 楼层号分配
│       │   ├── reply.entity.ts         # 回复实体
│       │   └── dto/
│       │       └── create-reply.dto.ts # 回复参数校验
│       └── admin/            # 管理员模块（Phase 2 新增）
│           ├── admin.module.ts
│           ├── admin.controller.ts     # 吧审核/管理/审计日志
│           ├── admin.service.ts        # 管理操作业务逻辑
│           ├── admin-action.entity.ts  # 管理操作审计实体
│           └── dto/
│               ├── reject-bar.dto.ts   # 拒绝吧参数校验
│               ├── suspend-bar.dto.ts  # 暂停吧参数校验
│               ├── ban-bar.dto.ts      # 封禁吧参数校验
│               └── close-bar.dto.ts    # 关闭吧参数校验
└── test/                     # 测试目录
```

#### 后端模块职责表

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| **common/guards** | JWT 认证守卫、管理员角色守卫、可选认证守卫 | `jwt-auth.guard.ts`, `admin.guard.ts`, `optional-auth.guard.ts` |
| **common/decorators** | `@CurrentUser()` 从请求中提取当前用户 | `current-user.decorator.ts` |
| **common/response.interceptor** | 将所有成功响应包装为 `{ data, meta, error }` 信封 | `response.interceptor.ts` |
| **common/http-exception.filter** | 将所有异常转换为统一错误信封格式 | `http-exception.filter.ts` |
| **auth** | 注册、登录、JWT 签发与验证 | `auth.controller.ts`, `auth.service.ts`, `jwt.strategy.ts` |
| **users** | 用户实体定义、基础查询、个人中心（我的帖子/回复/吧/资料编辑） | `user.entity.ts`, `users.controller.ts`, `users.service.ts` |
| **bars** | 吧的列表查询、详情查询、用户创建吧（pending_review）、加入/退出吧、成员计数 | `bars.controller.ts`, `bars.service.ts` |
| **posts** | 帖子的列表、详情、创建，回复计数更新 | `posts.controller.ts`, `posts.service.ts` |
| **replies** | 回复的列表、创建，楼层号自动递增 | `replies.controller.ts`, `replies.service.ts` |
| **admin** | 管理员吧审核（approve/reject/suspend/unsuspend/ban/close）、审计日志查询 | `admin.controller.ts`, `admin.service.ts`, `admin-action.entity.ts` |

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
    │   ├── create-bar/
    │   │   └── page.tsx      # 创建吧页（需登录）
    │   ├── profile/
    │   │   ├── layout.tsx    # 个人中心布局（侧边导航）
    │   │   ├── page.tsx      # 个人中心首页（我的帖子）
    │   │   ├── edit/
    │   │   │   └── page.tsx  # 编辑个人资料
    │   │   ├── bars/
    │   │   │   └── page.tsx  # 我加入的吧
    │   │   ├── created-bars/
    │   │   │   └── page.tsx  # 我创建的吧
    │   │   └── replies/
    │   │       └── page.tsx  # 我的回复
    │   ├── admin/
    │   │   ├── layout.tsx    # 管理后台布局（导航标签）
    │   │   ├── page.tsx      # 管理后台首页
    │   │   ├── bars/
    │   │   │   └── pending/
    │   │   │       └── page.tsx  # 待审核吧列表
    │   │   └── actions/
    │   │       └── page.tsx  # 审计日志
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
    │   │   ├── BarCard.tsx   # 吧卡片组件
    │   │   ├── BarStatusBadge.tsx  # 吧状态标签（6 种状态颜色映射）
    │   │   └── JoinBarButton.tsx   # 加入/退出吧按钮
    │   ├── post/
    │   │   └── PostCard.tsx  # 帖子卡片组件
    │   ├── reply/
    │   │   └── ReplyItem.tsx # 回复楼层组件
    │   ├── profile/
    │   │   └── ProfileNav.tsx # 个人中心侧边导航
    │   └── admin/
    │       └── AdminNav.tsx  # 管理后台导航标签
    ├── lib/                  # 工具库
    │   ├── api-client.ts     # Axios 实例（自动附加 JWT、401 处理）
    │   ├── auth.ts           # Zustand 登录态 Store（token + user）
    │   └── server-api.ts     # 服务端数据请求（SSR 多地址回退）
    └── types/
        └── index.ts          # TypeScript 类型定义（User, Bar, Post, Reply, AdminAction, CreatedBar, MyBar, ApiResponse 等）
```

#### 前端模块职责表

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| **lib/api-client** | Axios 封装，自动附加 Bearer Token，401 自动清除登录态 | `api-client.ts` |
| **lib/auth** | Zustand Store，管理 token/user 持久化到 localStorage | `auth.ts` |
| **lib/server-api** | SSR 数据请求，支持 Docker 内部地址 → 公网地址多级回退 | `server-api.ts` |
| **types** | 全局类型定义：`User`, `Bar`, `Post`, `Reply`, `AdminAction`, `CreatedBar`, `MyBar`, `PageMeta`, `ApiResponse` | `index.ts` |
| **components/layout** | 顶部导航栏（Logo、发帖按钮、登录/登出、个人中心/管理入口） | `Navbar.tsx` |
| **components/bar** | 吧卡片展示、吧状态标签（6 种状态）、加入/退出吧按钮 | `BarCard.tsx`, `BarStatusBadge.tsx`, `JoinBarButton.tsx` |
| **components/post** | 帖子卡片（标题、内容摘要、作者、吧名、回复数） | `PostCard.tsx` |
| **components/reply** | 回复楼层（楼层号、作者、时间、内容） | `ReplyItem.tsx` |
| **components/profile** | 个人中心侧边导航（我的帖子/回复/吧/创建的吧/编辑资料） | `ProfileNav.tsx` |
| **components/admin** | 管理后台导航标签（待审核/吧管理/审计日志） | `AdminNav.tsx` |
| **components/interaction** | 互动按钮：点赞、收藏、分享（乐观更新） | `LikeButton.tsx`, `FavoriteButton.tsx`, `ShareButton.tsx` |
| **components/reply/ChildReplies** | 楼中楼子回复折叠区（分页加载） | `ChildReplies.tsx` |
| **components/editor** | Markdown 编辑器、图片上传 | `MarkdownEditor.tsx`, `ImageUpload.tsx` |
| **components/bar/BarManageMenu** | 吧管理下拉菜单（编辑资料、成员管理） | `BarManageMenu.tsx` |
| **app/page + HomeClient** | 首页：帖子流 + 吧推荐 + 无限加载 | `page.tsx`, `HomeClient.tsx` |
| **app/login** | 登录页：邮箱 + 密码，登录后跳转首页 | `login/page.tsx` |
| **app/register** | 注册页：邮箱 + 密码 + 昵称，注册后自动登录 | `register/page.tsx` |
| **app/create-post** | 发帖页：选择吧 + 标题 + 内容，需登录 | `create-post/page.tsx` |
| **app/create-bar** | 创建吧页：名称 + 描述 + 分类 + 吧规，需登录，提交后 pending_review | `create-bar/page.tsx` |
| **app/bars/[id]** | 吧详情页：吧信息 + 吧内帖子列表 + 加入/退出按钮 | `bars/[id]/page.tsx`, `BarPostsClient.tsx` |
| **app/posts/[id]** | 帖子详情页：主楼 + 回复列表 + 回复输入 | `posts/[id]/page.tsx`, `PostRepliesClient.tsx` |
| **app/profile** | 个人中心：我的帖子/回复/加入的吧/创建的吧/编辑资料 | `profile/layout.tsx`, `profile/page.tsx` 等 |
| **app/admin** | 管理后台：待审核吧列表、吧管理操作、审计日志 | `admin/layout.tsx`, `admin/page.tsx` 等 |

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
| `status` | VARCHAR(20) | DEFAULT 'pending_review' | 状态：`pending_review` / `active` / `rejected` / `suspended` / `permanently_banned` / `closed` |
| `status_reason` | TEXT | NULL | 状态变更原因（拒绝/暂停/封禁/关闭理由） |
| `suspend_until` | TIMESTAMPTZ | NULL | 暂停到期时间（仅 suspended 状态使用） |
| `member_count` | INTEGER | DEFAULT 0 | 成员数（冗余计数，加入/退出时更新） |
| `created_by` | UUID | FK → users.id | 创建者 |
| `reviewed_by` | UUID | FK → users.id, NULL | 审核管理员 |
| `reviewed_at` | TIMESTAMPTZ | NULL | 审核时间 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

### 4.3 bar_members（吧成员表）

> Phase 2 启用：用户可通过 POST /api/bars/:id/join 加入吧，POST /api/bars/:id/leave 退出吧。加入/退出时同步更新 bars.member_count。

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
| `like_count` | INTEGER | DEFAULT 0 | 点赞数（冗余计数） |
| `favorite_count` | INTEGER | DEFAULT 0 | 收藏数（冗余计数） |
| `share_count` | INTEGER | DEFAULT 0 | 分享数（冗余计数） |
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
| `floor_number` | INTEGER | NULL | 楼层号（帖内自增，子回复为 NULL） |
| `content` | TEXT | NOT NULL | 回复内容 |
| `content_type` | VARCHAR(20) | DEFAULT 'plaintext' | 格式：`plaintext` / `markdown` |
| `like_count` | INTEGER | DEFAULT 0 | 点赞数（冗余计数） |
| `child_count` | INTEGER | DEFAULT 0 | 楼中楼子回复数量 |
| `status` | VARCHAR(20) | DEFAULT 'published' | 状态（同帖子） |
| `deleted_at` | TIMESTAMPTZ | NULL | 软删除标记 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**索引**: `(post_id, floor_number)` — 帖子回复楼层查询

### 4.6 admin_actions（管理操作审计表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 操作记录 ID |
| `admin_id` | UUID | FK → users.id, NOT NULL, ON DELETE RESTRICT | 操作管理员 |
| `action` | VARCHAR(50) | NOT NULL | 操作类型（如 `approve_bar`, `reject_bar`, `suspend_bar`, `unsuspend_bar`, `ban_bar`, `close_bar`） |
| `target_type` | VARCHAR(20) | NOT NULL | 目标类型（如 `bar`） |
| `target_id` | UUID | NOT NULL | 目标资源 ID（逻辑外键） |
| `reason` | TEXT | NULL | 操作理由 |
| `metadata` | JSONB | NULL | 附加元数据（如暂停时长） |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 操作时间 |

**索引**:
- `(admin_id, created_at)` — 按管理员查询操作历史
- `(target_type, target_id)` — 按目标查询操作历史
- `(created_at)` — 审计日志时间排序

### 4.7 user_likes（点赞记录表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `user_id` | UUID | FK → users.id, NOT NULL | 点赞用户 |
| `target_type` | VARCHAR(20) | NOT NULL | 目标类型：`post` / `reply` |
| `target_id` | UUID | NOT NULL | 目标 ID |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 点赞时间 |

**约束**: UNIQUE(user_id, target_type, target_id)
**索引**: `(target_type, target_id)` — 查询目标的点赞列表

### 4.8 user_favorites（收藏记录表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `user_id` | UUID | FK → users.id, NOT NULL | 收藏用户 |
| `post_id` | UUID | FK → posts.id, NOT NULL | 收藏帖子 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 收藏时间 |

**约束**: UNIQUE(user_id, post_id)
**索引**: `(user_id, created_at)` — 个人中心收藏列表

### 4.9 索引汇总

| 表 | 索引 | 用途 |
|------|------|------|
| `posts` | `(bar_id, created_at)` | 吧内帖子列表查询 |
| `replies` | `(post_id, floor_number)` | 帖子回复楼层查询 |
| `bars` | `(status, created_at)` | 按状态查询吧列表 |
| `bars` | `(created_by)` | 查询用户创建的吧 |
| `admin_actions` | `(admin_id, created_at)` | 管理员操作历史 |
| `admin_actions` | `(target_type, target_id)` | 目标操作历史 |
| `admin_actions` | `(created_at)` | 审计日志时间排序 |
| `user_likes` | `(target_type, target_id)` | 目标点赞查询 |
| `user_favorites` | `(user_id, created_at)` | 收藏列表查询 |
| `replies` | `(parent_reply_id, created_at) WHERE parent_reply_id IS NOT NULL` | 楼中楼子回复查询 |

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

- **认证**: 可选（OptionalAuthGuard，登录用户可获取 isMember 状态）
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
        "memberCount": 42,
        "isMember": true,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "meta": { "cursor": "base64...", "hasMore": true },
    "error": null
  }
  ```

#### `GET /api/bars/:id` — 获取吧详情

- **认证**: 可选（OptionalAuthGuard）
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
      "memberCount": 42,
      "isMember": true,
      "createdBy": { "id": "uuid", "nickname": "管理员" },
      "createdAt": "...",
      "updatedAt": "..."
    },
    "meta": null,
    "error": null
  }
  ```

#### `POST /api/bars` — 创建吧

- **认证**: 需要 (Bearer Token)
- **请求体**:
  ```json
  {
    "name": "新吧名称",
    "description": "吧描述",
    "category": "技术",
    "rules": "吧规内容",
    "avatarUrl": "https://..."
  }
  ```
  | 字段 | 类型 | 必填 | 校验 |
  |------|------|------|------|
  | name | string | 是 | 2-100 字符 |
  | description | string | 是 | 不为空 |
  | category | string | 否 | 最大 100 字符 |
  | rules | string | 否 | — |
  | avatarUrl | string | 否 | 合法 URL，最大 500 字符 |

- **成功响应** (201): 返回创建的吧对象，状态为 `pending_review`

#### `POST /api/bars/:id/join` — 加入吧

- **认证**: 需要 (Bearer Token)
- **路径参数**: `id` — 吧 UUID
- **成功响应** (201): 返回成员记录
- **错误**: 吧非 active 状态 → 403；已是成员 → 409

#### `POST /api/bars/:id/leave` — 退出吧

- **认证**: 需要 (Bearer Token)
- **路径参数**: `id` — 吧 UUID
- **成功响应** (200): 确认退出
- **错误**: 吧主不能退出 → 403；非成员 → 404

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

### 5.6 Admin 管理接口

> 所有管理接口需要 `JwtAuthGuard` + `AdminGuard`（`user.role === 'admin'`）。

#### `GET /api/admin/bars` — 获取吧列表（管理视图）

- **认证**: 需要 (Bearer Token + Admin 角色)
- **查询参数**:
  | 参数 | 类型 | 必填 | 默认值 | 说明 |
  |------|------|------|--------|------|
  | status | string | 否 | - | 按状态筛选（如 `pending_review`） |
  | cursor | string | 否 | - | 分页游标 |
  | limit | number | 否 | 20 | 每页数量，最大 100 |

- **成功响应** (200): 返回吧列表（含所有状态字段）

#### `POST /api/admin/bars/:id/approve` — 审批通过

- **认证**: 需要 (Bearer Token + Admin 角色)
- **成功响应** (200): 吧状态变为 `active`，记录审计日志

#### `POST /api/admin/bars/:id/reject` — 拒绝

- **认证**: 需要 (Bearer Token + Admin 角色)
- **请求体**: `{ "reason": "拒绝理由" }`
- **成功响应** (200): 吧状态变为 `rejected`，记录审计日志

#### `POST /api/admin/bars/:id/suspend` — 暂停

- **认证**: 需要 (Bearer Token + Admin 角色)
- **请求体**: `{ "reason": "暂停理由", "duration": 7 }`（duration 为天数）
- **成功响应** (200): 吧状态变为 `suspended`，设置 `suspend_until`

#### `POST /api/admin/bars/:id/unsuspend` — 解除暂停

- **认证**: 需要 (Bearer Token + Admin 角色)
- **成功响应** (200): 吧状态恢复为 `active`

#### `POST /api/admin/bars/:id/ban` — 永久封禁

- **认证**: 需要 (Bearer Token + Admin 角色)
- **请求体**: `{ "reason": "封禁理由" }`
- **成功响应** (200): 吧状态变为 `permanently_banned`

#### `POST /api/admin/bars/:id/close` — 关闭

- **认证**: 需要 (Bearer Token + Admin 角色)
- **请求体**: `{ "reason": "关闭理由" }`
- **成功响应** (200): 吧状态变为 `closed`

#### `GET /api/admin/actions` — 审计日志

- **认证**: 需要 (Bearer Token + Admin 角色)
- **查询参数**: `cursor`, `limit`
- **成功响应** (200):
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "action": "approve_bar",
        "targetType": "bar",
        "targetId": "uuid",
        "targetName": "技术讨论",
        "adminId": "uuid",
        "adminNickname": "管理员",
        "reason": null,
        "createdAt": "..."
      }
    ],
    "meta": { "cursor": "...", "hasMore": true },
    "error": null
  }
  ```

---

### 5.7 Users 个人中心接口

> 所有个人中心接口需要 `JwtAuthGuard`。

#### `GET /api/users/me/posts` — 我的帖子

- **认证**: 需要 (Bearer Token)
- **查询参数**: `cursor`, `limit`
- **成功响应** (200): 返回当前用户的帖子列表（cursor 分页）

#### `GET /api/users/me/replies` — 我的回复

- **认证**: 需要 (Bearer Token)
- **查询参数**: `cursor`, `limit`
- **成功响应** (200): 返回当前用户的回复列表（cursor 分页）

#### `GET /api/users/me/bars` — 我加入的吧

- **认证**: 需要 (Bearer Token)
- **查询参数**: `cursor`, `limit`
- **成功响应** (200): 返回当前用户加入的吧列表（cursor 分页）

#### `GET /api/users/me/created-bars` — 我创建的吧

- **认证**: 需要 (Bearer Token)
- **查询参数**: `cursor`, `limit`
- **成功响应** (200): 返回当前用户创建的吧列表（含状态信息，cursor 分页）

#### `PATCH /api/users/me/profile` — 更新个人资料

- **认证**: 需要 (Bearer Token)
- **请求体**:
  ```json
  {
    "nickname": "新昵称",
    "bio": "个人签名"
  }
  ```
  | 字段 | 类型 | 必填 | 校验 |
  |------|------|------|------|
  | nickname | string | 否 | 2-50 字符 |
  | bio | string | 否 | 最大 500 字符 |

- **成功响应** (200): 返回更新后的用户对象

---

### 5.8 API 接口汇总表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 否 | 用户注册 |
| POST | `/api/auth/login` | 否 | 用户登录 |
| GET | `/api/auth/me` | 是 | 获取当前用户信息 |
| GET | `/api/bars` | 可选 | 吧列表（cursor 分页，登录可返回 isMember） |
| GET | `/api/bars/:id` | 可选 | 吧详情（登录可返回 isMember） |
| POST | `/api/bars` | 是 | 创建吧（状态为 pending_review） |
| POST | `/api/bars/:id/join` | 是 | 加入吧 |
| POST | `/api/bars/:id/leave` | 是 | 退出吧 |
| GET | `/api/posts` | 否 | 帖子列表（可按 barId 筛选，cursor 分页） |
| GET | `/api/posts/:id` | 否 | 帖子详情 |
| POST | `/api/posts` | 是 | 创建帖子 |
| GET | `/api/posts/:postId/replies` | 否 | 帖子回复列表（cursor 分页） |
| POST | `/api/posts/:postId/replies` | 是 | 创建回复 |
| GET | `/api/users/me/posts` | 是 | 我的帖子 |
| GET | `/api/users/me/replies` | 是 | 我的回复 |
| GET | `/api/users/me/bars` | 是 | 我加入的吧 |
| GET | `/api/users/me/created-bars` | 是 | 我创建的吧 |
| PATCH | `/api/users/me/profile` | 是 | 更新个人资料 |
| GET | `/api/admin/bars` | 是 (Admin) | 管理视图吧列表（可按 status 筛选） |
| POST | `/api/admin/bars/:id/approve` | 是 (Admin) | 审批通过吧 |
| POST | `/api/admin/bars/:id/reject` | 是 (Admin) | 拒绝吧 |
| POST | `/api/admin/bars/:id/suspend` | 是 (Admin) | 暂停吧 |
| POST | `/api/admin/bars/:id/unsuspend` | 是 (Admin) | 解除暂停 |
| POST | `/api/admin/bars/:id/ban` | 是 (Admin) | 永久封禁吧 |
| POST | `/api/admin/bars/:id/close` | 是 (Admin) | 关闭吧 |
| GET | `/api/admin/actions` | 是 (Admin) | 审计日志 |
| PATCH | `/api/bars/:id` | 是 | 编辑吧资料（吧主/版主） |
| GET | `/api/bars/:id/members` | 是 | 获取吧成员列表（吧主/版主） |
| PATCH | `/api/bars/:id/members/:userId/role` | 是 | 修改成员角色（仅吧主） |
| POST | `/api/bars/:id/transfer` | 是 | 转让吧主（仅吧主） |
| DELETE | `/api/posts/:id` | 是 | 删除帖子（作者/吧主/版主） |
| POST | `/api/posts/:id/like` | 是 | 点赞帖子 |
| DELETE | `/api/posts/:id/like` | 是 | 取消点赞帖子 |
| POST | `/api/posts/:id/favorite` | 是 | 收藏帖子 |
| DELETE | `/api/posts/:id/favorite` | 是 | 取消收藏帖子 |
| POST | `/api/posts/:id/share` | 是 | 记录分享 |
| POST | `/api/posts/:id/hide` | 是 | 隐藏帖子（吧主/版主） |
| POST | `/api/posts/:id/unhide` | 是 | 取消隐藏帖子 |
| DELETE | `/api/replies/:id` | 是 | 删除回复（作者/吧主/版主） |
| POST | `/api/replies/:id/like` | 是 | 点赞回复 |
| DELETE | `/api/replies/:id/like` | 是 | 取消点赞回复 |
| POST | `/api/replies/:id/hide` | 是 | 隐藏回复（吧主/版主） |
| POST | `/api/replies/:id/unhide` | 是 | 取消隐藏回复 |
| GET | `/api/replies/:replyId/children` | 否 | 获取楼中楼子回复 |
| GET | `/api/users/me/favorites` | 是 | 我的收藏列表 |
| POST | `/api/uploads/presign` | 是 | 获取预签名上传 URL |

---

## 6. 前端页面与 API 调用关系

| 页面 | 路由 | 渲染方式 | 调用的 API |
|------|------|----------|------------|
| 首页 | `/` | SSR + CSR | `GET /api/posts?limit=20`, `GET /api/bars?limit=12` |
| 登录 | `/login` | CSR | `POST /api/auth/login` |
| 注册 | `/register` | CSR | `POST /api/auth/register` |
| 发帖 | `/create-post` | CSR（需登录） | `GET /api/bars`, `POST /api/posts` |
| 创建吧 | `/create-bar` | CSR（需登录） | `POST /api/bars` |
| 吧详情 | `/bars/[id]` | CSR | `GET /api/bars/:id`, `GET /api/posts?barId=...&limit=20`, `POST /api/bars/:id/join`, `POST /api/bars/:id/leave` |
| 帖子详情 | `/posts/[id]` | CSR | `GET /api/posts/:id`, `GET /api/posts/:id/replies?limit=50`, `POST/DELETE /api/posts/:id/like`, `POST/DELETE /api/posts/:id/favorite`, `POST /api/posts/:id/share`, `DELETE /api/posts/:id` |
| 个人中心 — 我的帖子 | `/profile` | CSR（需登录） | `GET /api/users/me/posts` |
| 个人中心 — 我的回复 | `/profile/replies` | CSR（需登录） | `GET /api/users/me/replies` |
| 个人中心 — 我的吧 | `/profile/bars` | CSR（需登录） | `GET /api/users/me/bars` |
| 个人中心 — 我创建的吧 | `/profile/created-bars` | CSR（需登录） | `GET /api/users/me/created-bars` |
| 个人中心 — 编辑资料 | `/profile/edit` | CSR（需登录） | `GET /api/auth/me`, `PATCH /api/users/me/profile` |
| 管理后台 — 待审核 | `/admin/bars/pending` | CSR（需 Admin） | `GET /api/admin/bars?status=pending_review` |
| 管理后台 — 吧管理 | `/admin` | CSR（需 Admin） | `GET /api/admin/bars`, `POST /api/admin/bars/:id/{action}` |
| 管理后台 — 审计日志 | `/admin/actions` | CSR（需 Admin） | `GET /api/admin/actions` |
| 个人中心 — 我的收藏 | `/profile/favorites` | CSR（需登录） | `GET /api/users/me/favorites`, `DELETE /api/posts/:id/favorite` |

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

## 9. 第三阶段已实现功能

Phase 3 已实现以下核心功能：

| 功能 | 状态 | 说明 |
|--------|---------|---------|
| 楼中楼回复 | ✅ 已实现 | `parent_reply_id` 支持二级回复，子回复预览+分页 |
| 点赞/收藏/分享 | ✅ 已实现 | `user_likes`/`user_favorites` 表，帖子+回复点赞，帖子收藏/分享 |
| 内容删除 | ✅ 已实现 | 软删除（`deleted_at` + `status='deleted'`），级联删除子回复 |
| 内容隐藏 | ✅ 已实现 | 吧主/版主可隐藏/取消隐藏帖子和回复（`status='hidden'`） |
| 吧资料编辑 | ✅ 已实现 | 吧主可编辑所有字段，版主不可修改分类 |
| 成员管理 | ✅ 已实现 | 成员列表、角色变更、吧主转让 |
| Markdown 支持 | ✅ 已实现 | `content_type='markdown'`，前端编辑器 |
| 媒体上传 | ✅ 已实现 | 预签名 URL 上传，图片插入 |
| 个人中心收藏 | ✅ 已实现 | 收藏列表（含已删除帖占位） |

### Phase 3 未来设计注意事项

- **回复状态枚举统一**：当前实现中 `Reply.status` 兼容 `under_review`，后续若继续收敛到 `published/hidden/deleted`，需同步数据库约束、DTO 校验与前端状态映射。
- **楼中楼交互文档化**：当前楼中楼回复采用“楼层内联回复框”交互，后续如调整为统一输入框或抽屉模式，需同步更新使用文档与 E2E 用例。
- **隐藏/删除内容的互动策略**：已隐藏/已删除内容在点赞、收藏、子回复加载等场景的边界行为需持续保持一致，并在 API 文档中明确。
- **收藏占位策略**：`/api/users/me/favorites` 对不可见内容返回占位项而非直接丢弃，后续优化列表时需保持该兼容行为，避免用户误判收藏丢失。

### 后续扩展预留

| 预留点 | 状态 | 扩展方向 |
|--------|---------|---------|
| AI embedding | 未实现 | pgvector 内容向量化、相关帖推荐 |
| 消息通知 | 未实现 | @提醒、系统通知 |
| 全局搜索 | 未实现 | 帖子/吧全文搜索 |
| 用户封禁 | 未实现 | 全站范围用户封禁 |
