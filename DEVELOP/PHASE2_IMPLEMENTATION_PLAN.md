# 第二阶段实现计划（不含 AI 功能）

> 本文基于 `README.md`、`DEVELOP/PHASE1_IMPLEMENTATION_PLAN.md`、`DEVELOP/TODO.md`、`DOC/usage.md`、`DOC/arch.md` 整理第二阶段应完善和实现的功能，明确排除 AI 相关能力。

## 1. 阶段目标

- 在第一阶段 MVP 的基础上，补齐社区可持续运营所需的核心互动、治理与个人体验能力。
- 优先实现文档中已明确为"第二阶段"的功能项，以及第一阶段已预留但未开放的能力。
- AI 相关能力（重复帖检测、审核辅助、摘要）继续保持在后续版本，不纳入本阶段。

---

## 2. 第二阶段功能清单（非 AI）

### 2.1 用户创建吧（需管理员审核）

- 登录用户可提交创建吧申请（填写吧名、简介、分类、吧规、头像）。
- 提交后吧状态为 `pending_review`，仅创建者在"我创建的吧"中可见，不在公开列表展示。
- 管理员审核通过后状态变为 `active`，进入公开吧列表。
- 管理员审核拒绝时记录拒绝原因，创建者可在"我创建的吧"中查看拒绝理由。
- 创建者进入"我创建的吧"列表可看到所有状态（`pending_review` / `active` / `rejected`）。

### 2.2 管理员后台

#### 2.2.1 吧审核管理
- 管理员可查看待审核吧列表（`pending_review` 状态）。
- 管理员可审核通过或拒绝（附拒绝原因）。

#### 2.2.2 吧状态管理
- 临时封禁吧（`suspended`）：管理员指定封禁原因和时长（到期自动解封），封禁期间吧内禁止发帖和回复，已有内容仍可浏览。
- 永久封禁吧（`permanently_banned`）：吧被永久封禁，所有内容变为只读，吧从公开列表移除。
- 关闭吧（`closed`）：吧被关闭归档，所有内容变为只读，吧从公开列表移除。
- 解封吧：管理员可将 `suspended` 状态的吧恢复为 `active`。

#### 2.2.3 管理操作审计
- 所有管理员对吧的审核、封禁、关闭操作记录到 `admin_actions` 审计表。

### 2.3 回复能力增强
- 二级回复（楼中楼）：开放 `parent_reply_id` 能力，支持对指定回复进行回复。
- 引用回复：在回复中携带被引用楼层信息，保留上下文。
- 楼主标识：在回复列表中标识帖子作者的回复，便于追踪楼主观点。

### 2.4 互动能力
- 点赞：帖子点赞、回复点赞（同一用户对同一目标仅可点赞一次，支持取消）。
- 收藏：支持用户收藏帖子并在个人中心查看（支持取消收藏）。
- 分享：提供帖子分享入口（复制链接），记录分享次数。

### 2.5 吧成员与社区治理能力
- 加入/退出吧：用户可主动加入或退出吧，沉淀"我的吧"数据。吧主不可退出（需先转让）。
- 首页"我的吧"展示：用户登录后，在首页展示其已加入吧列表。
- 吧资料编辑：吧主/版主可编辑吧描述、吧规、头像等基础资料。
- 吧务角色管理：吧主可任命/撤销版主；吧主可转让吧主身份给吧内成员。
- 吧内内容管理：吧主/版主可隐藏（`hidden`）吧内帖子和回复。
- 发帖权限：被封禁/关闭的吧禁止发帖和回复；正常状态的吧任何登录用户均可发帖（无需加入）。

### 2.6 个人中心
- 我的帖子：查看自己发布的帖子列表。
- 我的回复：查看自己发布的回复列表。
- 我的收藏：查看已收藏帖子。
- 我的吧：查看已加入吧列表。
- 我创建的吧：查看自己申请创建的吧及其审核状态。
- 个人资料编辑：修改昵称、头像、个人签名。

### 2.7 帖子与回复编辑
- 帖子作者可编辑自己的帖子（标题和内容）。
- 回复作者可编辑自己的回复内容。
- 帖子作者可删除自己的帖子（软删除）。
- 回复作者可删除自己的回复（软删除）。

### 2.8 内容表达与媒体能力
- Markdown 内容渲染：帖子与回复支持 `content_type=markdown` 渲染。
- 媒体上传：接入 S3/MinIO 预签名上传链路，支持图片内容引用。

---

## 3. 设计补全：能力边界与 UX 合理性分析

> 以下为发散思考后识别出的潜在 UX 缺陷和边界情况，确保用户体验完整一致。

### 3.1 吧状态对用户行为的影响

| 吧状态 | 浏览内容 | 发帖/回复 | 加入/退出 | 在公开列表可见 |
|--------|---------|----------|----------|--------------|
| `active` | ✅ | ✅ | ✅ | ✅ |
| `pending_review` | ❌（仅创建者可见） | ❌ | ❌ | ❌ |
| `rejected` | ❌（仅创建者可见状态） | ❌ | ❌ | ❌ |
| `suspended` | ✅（只读） | ❌ | ❌ | ❌（从列表移除） |
| `permanently_banned` | ✅（只读） | ❌ | ❌ | ❌ |
| `closed` | ✅（只读） | ❌ | ❌ | ❌ |

- 已加入被封禁/关闭吧的用户，在"我的吧"列表中仍可看到该吧（附带状态标识），可进入查看历史内容。
- 被封禁/关闭的吧详情页顶部展示醒目的状态提示（如"该吧已被封禁"）。
- 在被封禁/关闭的吧内，发帖和回复按钮禁用并展示提示。

### 3.2 吧创建被拒绝后的处理
- 创建者在"我创建的吧"中可看到被拒绝的申请及拒绝原因。
- 被拒绝的吧不可直接重新提交，创建者需发起新的创建申请。
- 被拒绝的记录保留可查阅，不可删除。

### 3.3 楼中楼回复展示逻辑
- 主楼回复（`parent_reply_id = null`）按楼层号升序展示。
- 楼中楼回复（`parent_reply_id != null`）折叠在父回复下方，默认展示前 3 条，点击"展开更多"加载完整子回复。
- 楼中楼回复按创建时间升序排列，不单独分配楼层号（复用父回复楼层标识）。

### 3.4 点赞/收藏状态一致性
- 已登录用户浏览帖子/回复时，需在响应中携带当前用户的点赞/收藏状态（`isLiked` / `isFavorited`），避免额外请求。
- 点赞/收藏操作使用乐观更新（前端先变更 UI，失败后回滚）。

### 3.5 个人资料编辑安全边界
- 头像上传使用与帖子媒体相同的预签名上传链路。
- 个人签名限长 200 字符。

### 3.6 帖子编辑边界
- 编辑帖子后展示"已编辑"标记和最后编辑时间。
- 帖子被吧主/版主隐藏后，作者不可再编辑。
- 不记录编辑历史（第二阶段不做，保留在 TODO）。

### 3.7 管理员身份判定
- 管理员通过 `users.role = 'admin'` 判定。
- 第二阶段管理员手动指定（数据库直接修改），不提供管理员注册/指派 UI。

---

## 4. 数据库表修改

### 4.1 bars 表变更

**修改 `status` 字段取值范围**（原 `active` / `archived`）：

```sql
ALTER TABLE bars DROP CONSTRAINT IF EXISTS bars_status_check;
ALTER TABLE bars ADD CONSTRAINT bars_status_check
  CHECK (status IN ('pending_review', 'active', 'rejected', 'suspended', 'permanently_banned', 'closed'));
ALTER TABLE bars ALTER COLUMN status SET DEFAULT 'pending_review';
```

**新增字段**：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `reject_reason` | TEXT | NULL | 审核拒绝原因 |
| `reviewed_by` | UUID | FK → users.id, NULL | 审核人 |
| `reviewed_at` | TIMESTAMPTZ | NULL | 审核时间 |
| `suspend_reason` | TEXT | NULL | 封禁原因 |
| `suspend_until` | TIMESTAMPTZ | NULL | 临时封禁到期时间（null 表示永久封禁或非封禁状态） |

### 4.2 posts 表变更

**新增字段**：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `like_count` | INTEGER | DEFAULT 0 | 点赞数冗余计数 |
| `favorite_count` | INTEGER | DEFAULT 0 | 收藏数冗余计数 |
| `share_count` | INTEGER | DEFAULT 0 | 分享数冗余计数 |
| `edited_at` | TIMESTAMPTZ | NULL | 最后编辑时间（非 null 则展示"已编辑"） |

### 4.3 replies 表变更

**新增字段**：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `like_count` | INTEGER | DEFAULT 0 | 点赞数冗余计数 |
| `edited_at` | TIMESTAMPTZ | NULL | 最后编辑时间 |

### 4.4 新增 user_likes 表（点赞记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `user_id` | UUID | FK → users.id, NOT NULL | 点赞用户 |
| `target_type` | VARCHAR(20) | NOT NULL | 目标类型：`post` / `reply` |
| `target_id` | UUID | NOT NULL | 目标 ID |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 点赞时间 |

**约束**：`UNIQUE(user_id, target_type, target_id)` — 同一用户对同一目标仅可点赞一次。

**索引**：`(target_type, target_id)` — 查询某帖子/回复的点赞列表。

### 4.5 新增 user_favorites 表（收藏记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `user_id` | UUID | FK → users.id, NOT NULL | 收藏用户 |
| `post_id` | UUID | FK → posts.id, NOT NULL | 收藏帖子 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 收藏时间 |

**约束**：`UNIQUE(user_id, post_id)` — 同一用户对同一帖子仅可收藏一次。

**索引**：`(user_id, created_at)` — 个人中心收藏列表查询。

### 4.6 新增 admin_actions 表（管理操作审计）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `admin_id` | UUID | FK → users.id, NOT NULL | 操作管理员 |
| `action` | VARCHAR(50) | NOT NULL | 操作类型（见下方枚举） |
| `target_type` | VARCHAR(20) | NOT NULL | 目标类型：`bar` / `post` / `reply` |
| `target_id` | UUID | NOT NULL | 目标 ID |
| `reason` | TEXT | NULL | 操作原因/备注 |
| `metadata` | JSONB | NULL | 额外信息（如封禁时长） |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 操作时间 |

**`action` 枚举值**：`approve_bar`、`reject_bar`、`suspend_bar`、`unsuspend_bar`、`ban_bar`、`close_bar`、`hide_post`、`hide_reply`。

**索引**：`(target_type, target_id, created_at)` — 查询某目标的操作历史。

### 4.7 索引补充

```sql
-- 吧列表查询（仅展示 active 状态）
CREATE INDEX idx_bars_status_created_at ON bars (status, created_at);
-- 用户创建的吧查询
CREATE INDEX idx_bars_created_by ON bars (created_by, created_at);
-- 子回复查询（楼中楼）
CREATE INDEX idx_replies_parent_reply_id ON replies (parent_reply_id, created_at)
  WHERE parent_reply_id IS NOT NULL;
-- 用户帖子查询（个人中心）
CREATE INDEX idx_posts_author_id ON posts (author_id, created_at);
-- 用户回复查询（个人中心）
CREATE INDEX idx_replies_author_id ON replies (author_id, created_at);
```

---

## 5. 后端 API 设计

### 5.1 吧创建与管理

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/bars` | 是（登录用户） | 提交创建吧申请 |
| PATCH | `/api/bars/:id` | 是（吧主/版主） | 编辑吧资料 |
| GET | `/api/bars/:id/members` | 否 | 获取吧成员列表（cursor 分页） |
| POST | `/api/bars/:id/join` | 是 | 加入吧 |
| POST | `/api/bars/:id/leave` | 是 | 退出吧（吧主不可退出） |
| PATCH | `/api/bars/:id/members/:userId/role` | 是（吧主） | 修改吧成员角色（任命/撤销版主） |
| POST | `/api/bars/:id/transfer` | 是（吧主） | 转让吧主身份 |

#### `POST /api/bars` — 提交创建吧申请

请求体：
```json
{
  "name": "新吧名称",
  "description": "吧描述",
  "category": "分类",
  "rules": "吧规",
  "avatarUrl": "https://..."
}
```
| 字段 | 类型 | 必填 | 校验 |
|------|------|------|------|
| name | string | 是 | 2-100 字符，唯一 |
| description | string | 是 | 1-2000 字符 |
| category | string | 否 | 最长 100 字符 |
| rules | string | 否 | 最长 5000 字符 |
| avatarUrl | string | 否 | 合法 URL |

成功响应（201）：返回创建的吧对象（status=`pending_review`）。

#### `PATCH /api/bars/:id` — 编辑吧资料

权限：吧主或版主。请求体仅包含需要修改的字段。

#### `POST /api/bars/:id/join` — 加入吧

前置校验：吧状态必须为 `active`；用户未加入过该吧。
成功响应（201）：返回新建的成员记录。

#### `POST /api/bars/:id/leave` — 退出吧

前置校验：用户已加入该吧；吧主不可退出（需先转让吧主）。
成功响应（200）：返回操作结果。

#### `PATCH /api/bars/:id/members/:userId/role` — 修改成员角色

请求体：
```json
{ "role": "moderator" }
```
权限：仅吧主可操作。可将 `member` 升为 `moderator`，或将 `moderator` 降为 `member`。

#### `POST /api/bars/:id/transfer` — 转让吧主

请求体：
```json
{ "targetUserId": "uuid" }
```
权限：仅当前吧主可操作。目标用户必须为该吧成员。操作后原吧主变为 `moderator`，目标用户变为 `owner`。

### 5.2 管理员接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/admin/bars/pending` | 是（admin） | 待审核吧列表 |
| POST | `/api/admin/bars/:id/approve` | 是（admin） | 审核通过吧 |
| POST | `/api/admin/bars/:id/reject` | 是（admin） | 审核拒绝吧 |
| POST | `/api/admin/bars/:id/suspend` | 是（admin） | 临时封禁吧 |
| POST | `/api/admin/bars/:id/unsuspend` | 是（admin） | 解封吧 |
| POST | `/api/admin/bars/:id/ban` | 是（admin） | 永久封禁吧 |
| POST | `/api/admin/bars/:id/close` | 是（admin） | 关闭吧 |
| GET | `/api/admin/actions` | 是（admin） | 管理操作审计日志（cursor 分页） |

#### `POST /api/admin/bars/:id/approve` — 审核通过

将吧状态从 `pending_review` 变更为 `active`，记录审计日志。

#### `POST /api/admin/bars/:id/reject` — 审核拒绝

请求体：
```json
{ "reason": "拒绝原因说明" }
```
将吧状态变更为 `rejected`，记录拒绝原因和审计日志。

#### `POST /api/admin/bars/:id/suspend` — 临时封禁

请求体：
```json
{
  "reason": "封禁原因",
  "duration": 72
}
```
| 字段 | 类型 | 说明 |
|------|------|------|
| reason | string | 封禁原因 |
| duration | number | 封禁时长（小时） |

#### `POST /api/admin/bars/:id/ban` — 永久封禁

请求体：
```json
{ "reason": "永久封禁原因" }
```

#### `POST /api/admin/bars/:id/close` — 关闭吧

请求体：
```json
{ "reason": "关闭原因" }
```

### 5.3 回复能力增强

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/posts/:postId/replies` | 是 | 创建回复（支持 `parentReplyId`） |
| GET | `/api/replies/:replyId/children` | 否 | 获取楼中楼子回复列表（cursor 分页） |

创建回复时，如指定 `parentReplyId`，则该回复为楼中楼回复。`parentReplyId` 必须属于同一帖子。

### 5.4 互动接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/posts/:id/like` | 是 | 点赞帖子 |
| DELETE | `/api/posts/:id/like` | 是 | 取消点赞帖子 |
| POST | `/api/replies/:id/like` | 是 | 点赞回复 |
| DELETE | `/api/replies/:id/like` | 是 | 取消点赞回复 |
| POST | `/api/posts/:id/favorite` | 是 | 收藏帖子 |
| DELETE | `/api/posts/:id/favorite` | 是 | 取消收藏帖子 |
| POST | `/api/posts/:id/share` | 是 | 记录分享（返回分享链接） |

### 5.5 个人中心接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/users/me/posts` | 是 | 我的帖子列表（cursor 分页） |
| GET | `/api/users/me/replies` | 是 | 我的回复列表（cursor 分页） |
| GET | `/api/users/me/favorites` | 是 | 我的收藏列表（cursor 分页） |
| GET | `/api/users/me/bars` | 是 | 我加入的吧列表（cursor 分页） |
| GET | `/api/users/me/created-bars` | 是 | 我创建的吧列表（含所有状态） |
| PATCH | `/api/users/me/profile` | 是 | 编辑个人资料 |

#### `PATCH /api/users/me/profile` — 编辑个人资料

请求体：
```json
{
  "nickname": "新昵称",
  "avatarUrl": "https://...",
  "bio": "个人签名"
}
```
| 字段 | 类型 | 必填 | 校验 |
|------|------|------|------|
| nickname | string | 否 | 2-50 字符 |
| avatarUrl | string | 否 | 合法 URL |
| bio | string | 否 | 最长 200 字符 |

### 5.6 帖子与回复编辑/删除

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| PATCH | `/api/posts/:id` | 是（作者） | 编辑帖子 |
| DELETE | `/api/posts/:id` | 是（作者/吧主/版主） | 删除帖子（软删除） |
| PATCH | `/api/replies/:id` | 是（作者） | 编辑回复 |
| DELETE | `/api/replies/:id` | 是（作者/吧主/版主） | 删除回复（软删除） |

帖子编辑请求体：
```json
{
  "title": "更新后的标题",
  "content": "更新后的内容",
  "contentType": "markdown"
}
```
编辑成功后自动更新 `edited_at` 字段。

### 5.7 媒体上传

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/uploads/presign` | 是 | 获取预签名上传 URL |

请求体：
```json
{
  "filename": "image.png",
  "contentType": "image/png"
}
```
成功响应：
```json
{
  "data": {
    "uploadUrl": "https://s3.../presigned-url",
    "fileUrl": "https://cdn.../image.png"
  }
}
```

### 5.8 帖子/回复列表响应扩展

帖子列表和详情响应中新增字段：
```json
{
  "likeCount": 10,
  "favoriteCount": 5,
  "shareCount": 3,
  "isLiked": true,
  "isFavorited": false,
  "editedAt": "2025-01-01T00:00:00.000Z"
}
```
- `isLiked` / `isFavorited` 仅在用户已登录时返回，未登录时为 `false`。

回复列表中新增字段：
```json
{
  "likeCount": 3,
  "isLiked": false,
  "isAuthor": true,
  "editedAt": null,
  "childCount": 5
}
```
- `isAuthor` 标识该回复是否为楼主（帖子作者）发布。
- `childCount` 标识楼中楼子回复数量（仅主楼回复携带）。

---

## 6. 前端页面规划

### 6.1 新增页面

| 页面 | 路由 | 渲染方式 | 说明 |
|------|------|---------|------|
| 创建吧 | `/create-bar` | CSR（需登录） | 吧创建申请表单 |
| 个人中心 | `/profile` | CSR（需登录） | 个人中心首页（我的帖子/回复/收藏/吧） |
| 个人资料编辑 | `/profile/edit` | CSR（需登录） | 编辑昵称、头像、签名 |
| 我创建的吧 | `/profile/created-bars` | CSR（需登录） | 查看创建的吧及审核状态 |
| 管理员后台 | `/admin` | CSR（需 admin） | 管理员仪表盘入口 |
| 吧审核列表 | `/admin/bars/pending` | CSR（需 admin） | 待审核吧列表与审核操作 |
| 吧管理 | `/admin/bars` | CSR（需 admin） | 全部吧列表（可执行封禁/关闭） |
| 审计日志 | `/admin/actions` | CSR（需 admin） | 管理操作日志查看 |

### 6.2 现有页面改造

| 页面 | 改造内容 |
|------|---------|
| **首页 `/`** | 登录后展示"我的吧"区域；帖子卡片增加点赞/收藏计数展示 |
| **吧详情 `/bars/[id]`** | 增加"加入/退出吧"按钮；展示吧成员数；吧主/版主可见"管理"入口；被封禁/关闭的吧展示状态提示并禁用交互 |
| **帖子详情 `/posts/[id]`** | 增加点赞/收藏/分享按钮；楼中楼回复折叠展示；回复区展示楼主标识；作者可见编辑/删除按钮 |
| **发帖 `/create-post`** | 增加 Markdown 编辑模式切换；支持插入已上传图片 |
| **导航栏 Navbar** | 增加"个人中心"入口；管理员可见"管理后台"入口；增加"创建吧"入口 |

### 6.3 新增组件

| 组件 | 说明 |
|------|------|
| `components/interaction/LikeButton.tsx` | 点赞按钮（支持帖子和回复） |
| `components/interaction/FavoriteButton.tsx` | 收藏按钮 |
| `components/interaction/ShareButton.tsx` | 分享按钮（复制链接） |
| `components/reply/ChildReplies.tsx` | 楼中楼子回复折叠区 |
| `components/bar/BarStatusBadge.tsx` | 吧状态标识组件 |
| `components/bar/JoinBarButton.tsx` | 加入/退出吧按钮 |
| `components/profile/ProfileNav.tsx` | 个人中心侧边导航 |
| `components/admin/AdminNav.tsx` | 管理后台导航 |
| `components/admin/BarReviewCard.tsx` | 待审核吧卡片（含通过/拒绝操作） |
| `components/editor/MarkdownEditor.tsx` | Markdown 编辑器组件 |
| `components/editor/ImageUpload.tsx` | 图片上传组件 |

---

## 7. 后端模块规划

### 7.1 新增模块

| 模块 | 目录 | 职责 |
|------|------|------|
| **likes** | `modules/likes/` | 点赞功能：创建/取消点赞，查询点赞状态 |
| **favorites** | `modules/favorites/` | 收藏功能：创建/取消收藏，收藏列表 |
| **uploads** | `modules/uploads/` | 媒体上传：S3 预签名 URL 生成 |
| **admin** | `modules/admin/` | 管理后台：吧审核、封禁、审计日志 |

### 7.2 现有模块扩展

| 模块 | 扩展内容 |
|------|---------|
| **bars** | 新增创建吧 API、加入/退出、角色管理、转让、吧资料编辑 |
| **posts** | 新增编辑/删除 API、帖子分享记录、响应增加互动计数 |
| **replies** | 新增楼中楼子回复查询、编辑/删除 API、响应增加互动计数 |
| **users** | 新增个人中心相关查询（我的帖子/回复/收藏/吧）、个人资料编辑 |
| **auth** | AdminGuard 新增管理员权限守卫 |

---

## 8. 阶段边界（本阶段不做）

- 不实现任何 AI 相关功能：重复帖检测、AI 审核提示、长帖摘要。
- 不实现重度创作工具与复杂推荐系统。
- 不实现通知与提醒能力（@提醒、消息中心）。
- 不实现全局搜索能力。
- 不实现接口限流。
- 不实现编辑历史记录。
- 不实现用户封禁（帖吧级/全站级用户封禁）。

---

## 9. 验收基线

- 第二阶段功能清单中的每个模块均具备对应 API 与前端页面/入口。
- 所有新增写接口具备权限校验与参数校验。
- 吧创建→审核→上线完整链路可走通。
- 管理员可在后台完成吧审核、封禁、关闭操作。
- 楼中楼回复、点赞、收藏、分享至少覆盖一条端到端测试。
- 首页"我的吧"展示、个人中心主要页面可正常浏览。
- 帖子/回复编辑和删除功能正常运作。
- 被封禁/关闭的吧正确展示只读状态，禁止写操作。
