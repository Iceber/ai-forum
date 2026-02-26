# PRE_PHASE3：第三阶段前预备功能

> 从第二阶段实现计划中移出的功能，作为第三阶段前的预备实现。
> 本文档包含完整的功能规格、数据库变更、API 设计和前端页面规划。

## 1. 概述

以下功能原属第二阶段范围，因第二阶段聚焦吧创建/审核、管理员后台、基础成员关系和个人中心，将其余能力移至此文档作为下一批实现目标。

---

## 2. 功能清单

### 2.1 回复能力增强
- 二级回复（楼中楼）：开放 `parent_reply_id` 能力，支持对指定回复进行回复。
- 楼中楼分页：二级回复过多时提供分页加载，默认展示前 3 条子回复，点击"查看更多回复"按需加载（cursor 分页）。
- 引用回复：在回复中携带被引用楼层信息，保留上下文。
- 楼主标识：在回复列表中标识帖子作者的回复，便于追踪楼主观点。

### 2.2 互动能力
- 点赞：帖子点赞、回复点赞（同一用户对同一目标仅可点赞一次，支持取消）。
- 收藏：支持用户收藏帖子并在个人中心查看（支持取消收藏）。
- 分享：提供帖子分享入口（复制链接），记录分享次数。

### 2.3 吧成员与社区治理能力（扩展）

> 基础的加入/退出吧已在第二阶段实现，此处为扩展治理能力。

- 吧资料编辑：吧主/版主可编辑吧描述、吧规、头像等基础资料。
- 吧务角色管理：吧主可任命/撤销版主；吧主可转让吧主身份给吧内成员。
- 吧内内容管理：吧主/版主可隐藏（`hidden`）吧内帖子和回复。
- 发帖权限：被封禁/关闭的吧禁止发帖和回复；正常状态的吧任何登录用户均可发帖（无需加入）。

### 2.4 帖子与回复删除
- 帖子作者可删除自己的帖子（软删除）。
- 回复作者可删除自己的回复（软删除）。
- 帖子和回复不支持二次编辑（发布后内容不可修改）。

### 2.5 内容表达与媒体能力
- Markdown 内容渲染：帖子与回复支持 `content_type=markdown` 渲染。
- 媒体上传：接入 S3/MinIO 预签名上传链路，支持图片内容引用。

### 2.6 个人中心扩展：我的收藏
- 在个人中心增加"我的收藏"页签，查看已收藏帖子列表。
- 依赖互动能力（§2.2）中的收藏功能。

---

## 3. UX 边界分析

### 3.1 楼中楼回复展示与分页逻辑
- 主楼回复（`parent_reply_id = null`）按楼层号升序展示。
- 楼中楼回复（`parent_reply_id != null`）折叠在父回复下方，默认展示前 3 条，点击"查看更多回复"按需加载后续子回复（cursor 分页）。
- 楼中楼回复按创建时间升序排列，不单独分配楼层号（复用父回复楼层标识）。
- 子回复分页使用 cursor 分页（基于 `created_at`），每页默认 10 条，最大 50 条。

### 3.2 点赞/收藏状态一致性
- 已登录用户浏览帖子/回复时，需在响应中携带当前用户的点赞/收藏状态（`isLiked` / `isFavorited`），避免额外请求。
- 点赞/收藏操作使用乐观更新（前端先变更 UI，失败后回滚）。

### 3.3 吧内容管理审计
- 吧主/版主对帖子和回复的隐藏操作记录到 `admin_actions` 审计表（扩展第二阶段已建立的审计表）。

---

## 4. 数据库变更

### 4.1 posts 表变更

**新增字段**：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `like_count` | INTEGER | DEFAULT 0 | 点赞数冗余计数 |
| `favorite_count` | INTEGER | DEFAULT 0 | 收藏数冗余计数 |
| `share_count` | INTEGER | DEFAULT 0 | 分享数冗余计数 |

### 4.2 replies 表变更

**新增字段**：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `like_count` | INTEGER | DEFAULT 0 | 点赞数冗余计数 |

### 4.3 新增 user_likes 表（点赞记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `user_id` | UUID | FK → users.id, NOT NULL | 点赞用户 |
| `target_type` | VARCHAR(20) | NOT NULL | 目标类型：`post` / `reply` |
| `target_id` | UUID | NOT NULL | 目标 ID |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 点赞时间 |

**约束**：`UNIQUE(user_id, target_type, target_id)` — 同一用户对同一目标仅可点赞一次。

**索引**：`(target_type, target_id)` — 查询某帖子/回复的点赞列表。

### 4.4 新增 user_favorites 表（收藏记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `user_id` | UUID | FK → users.id, NOT NULL | 收藏用户 |
| `post_id` | UUID | FK → posts.id, NOT NULL | 收藏帖子 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 收藏时间 |

**约束**：`UNIQUE(user_id, post_id)` — 同一用户对同一帖子仅可收藏一次。

**索引**：`(user_id, created_at)` — 个人中心收藏列表查询。

### 4.5 admin_actions 表扩展

> 该表在第二阶段已创建，此处为扩展。

扩展 `target_type` 支持 `post` / `reply`，新增 `action` 枚举值：`hide_post`、`hide_reply`。

### 4.6 索引补充

```sql
-- 子回复查询（楼中楼）
CREATE INDEX idx_replies_parent_reply_id ON replies (parent_reply_id, created_at)
  WHERE parent_reply_id IS NOT NULL;
```

---

## 5. 后端 API 设计

### 5.1 吧管理扩展

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| PATCH | `/api/bars/:id` | 是（吧主/版主） | 编辑吧资料 |
| GET | `/api/bars/:id/members` | 否 | 获取吧成员列表（cursor 分页） |
| PATCH | `/api/bars/:id/members/:userId/role` | 是（吧主） | 修改吧成员角色（任命/撤销版主） |
| POST | `/api/bars/:id/transfer` | 是（吧主） | 转让吧主身份 |
| POST | `/api/posts/:id/hide` | 是（吧主/版主） | 隐藏帖子（记录审计日志） |
| POST | `/api/replies/:id/hide` | 是（吧主/版主） | 隐藏回复（记录审计日志） |

#### `PATCH /api/bars/:id` — 编辑吧资料

权限：吧主或版主。请求体仅包含需要修改的字段。

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

### 5.2 回复能力增强

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/posts/:postId/replies` | 是 | 创建回复（支持 `parentReplyId`） |
| GET | `/api/replies/:replyId/children` | 否 | 获取楼中楼子回复列表（cursor 分页，默认 10 条/页，最大 50 条） |

创建回复时，如指定 `parentReplyId`，则该回复为楼中楼回复。`parentReplyId` 必须属于同一帖子。

子回复分页参数：`cursor`（可选）、`limit`（默认 10，最大 50）。返回结果按 `created_at` 升序。

### 5.3 互动接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/posts/:id/like` | 是 | 点赞帖子 |
| DELETE | `/api/posts/:id/like` | 是 | 取消点赞帖子 |
| POST | `/api/replies/:id/like` | 是 | 点赞回复 |
| DELETE | `/api/replies/:id/like` | 是 | 取消点赞回复 |
| POST | `/api/posts/:id/favorite` | 是 | 收藏帖子 |
| DELETE | `/api/posts/:id/favorite` | 是 | 取消收藏帖子 |
| POST | `/api/posts/:id/share` | 是 | 记录分享（返回分享链接） |

### 5.4 帖子与回复删除

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| DELETE | `/api/posts/:id` | 是（作者/吧主/版主） | 删除帖子（软删除） |
| DELETE | `/api/replies/:id` | 是（作者/吧主/版主） | 删除回复（软删除） |

> 帖子和回复不支持二次编辑，发布后内容不可修改。仅支持作者本人或吧务角色软删除。

### 5.5 媒体上传

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

### 5.6 个人中心扩展

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/users/me/favorites` | 是 | 我的收藏列表（cursor 分页） |

### 5.7 帖子/回复列表响应扩展

帖子列表和详情响应中新增字段：
```json
{
  "likeCount": 10,
  "favoriteCount": 5,
  "shareCount": 3,
  "isLiked": true,
  "isFavorited": false
}
```
- `isLiked` / `isFavorited`：已登录用户返回实际状态（`true` / `false`），未登录时返回 `null`（前端据此区分"未登录"与"未点赞"）。

回复列表中新增字段：
```json
{
  "likeCount": 3,
  "isLiked": false,
  "isAuthor": true,
  "childCount": 5
}
```
- `isAuthor` 标识该回复是否为楼主（帖子作者）发布。
- `childCount` 标识楼中楼子回复数量（仅主楼回复携带）。

---

## 6. 前端页面规划

### 6.1 现有页面改造

| 页面 | 改造内容 |
|------|---------|
| **首页 `/`** | 帖子卡片增加点赞/收藏计数展示 |
| **吧详情 `/bars/[id]`** | 展示吧成员数；吧主/版主可见"管理"入口 |
| **帖子详情 `/posts/[id]`** | 增加点赞/收藏/分享按钮；楼中楼回复折叠展示（支持分页加载更多子回复）；回复区展示楼主标识；作者可见删除按钮 |
| **发帖 `/create-post`** | 增加 Markdown 编辑模式切换；支持插入已上传图片 |

### 6.2 新增组件

| 组件 | 说明 |
|------|------|
| `components/interaction/LikeButton.tsx` | 点赞按钮（支持帖子和回复） |
| `components/interaction/FavoriteButton.tsx` | 收藏按钮 |
| `components/interaction/ShareButton.tsx` | 分享按钮（复制链接） |
| `components/reply/ChildReplies.tsx` | 楼中楼子回复折叠区 |
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

### 7.2 现有模块扩展

| 模块 | 扩展内容 |
|------|---------|
| **bars** | 角色管理、转让、吧资料编辑、内容隐藏 |
| **posts** | 删除 API、帖子分享记录、响应增加互动计数 |
| **replies** | 楼中楼子回复查询（含分页）、删除 API、响应增加互动计数 |
| **users** | 个人中心收藏查询 |
