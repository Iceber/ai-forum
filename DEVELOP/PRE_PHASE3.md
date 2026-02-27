# PHASE3：第三阶段实现计划（V3）

> 本文档基于 `DEVELOP/PHASE2_IMPLEMENTATION_PLAN.md`、`DOC/arch.md`、`DOC/usage.md` 制定第三阶段实现方案。
> 目标是在不引入 AI 功能的前提下，完善社区互动、内容表达、成员治理的核心闭环。

---

## 1. 概述

以下功能为第三阶段实现内容，覆盖社区互动、内容表达、成员治理等核心能力，是论坛完整体验的重要组成部分。

---

## 2. 功能清单

### 2.1 回复能力增强
- **二级回复（楼中楼）**：开放 `parent_reply_id` 字段，支持对指定回复进行回复。
- **楼中楼分页**：二级回复默认折叠，展示前 3 条，点击「查看更多回复」按需加载（cursor 分页，每页 10 条）。
- **引用回复**：回复时携带被引用楼层信息，前端显示“回复 @用户名：引用内容”。
- **楼主标识**：在回复列表中，使用特殊标记标识帖子作者的回复。

### 2.2 互动能力
- **点赞**：支持对帖子、回复点赞，同一用户仅可点赞一次，可取消。
- **收藏**：用户可收藏帖子，在个人中心查看收藏列表，支持取消收藏。
- **分享**：提供帖子分享入口（复制链接），后端记录分享次数。

### 2.3 吧成员与社区治理能力（扩展）
- **吧资料编辑**：吧主/版主可编辑吧描述、吧规、头像、分类（吧名不可修改）。
- **吧务角色管理**：吧主可任命/撤销版主；吧主可将吧主身份转让给吧内其他成员。
- **吧内内容管理**：吧主/版主可隐藏（`status = 'hidden'`）吧内帖子和回复，隐藏后对普通用户不可见。
- **发帖权限**：`active` 状态的吧，任何登录用户均可发帖（无需加入）；`suspended`/`permanently_banned`/`closed` 状态下禁止发帖。

### 2.4 帖子与回复删除
- **作者删除**：帖子/回复作者可删除自己的内容（软删除，设置 `deleted_at`）。
- **吧务删除**：吧主/版主可删除吧内任意帖子/回复（软删除）。
- **删除后表现**：普通用户不可见已删除内容；作者本人可见“内容已删除”占位符。

### 2.5 内容表达与媒体能力
- **Markdown 渲染**：帖子与回复支持 `content_type='markdown'`，前端使用 Markdown 渲染器展示。
- **媒体上传**：接入 S3/MinIO 预签名上传链路，支持图片上传并在内容中引用。
  - 仅用于帖子/回复内容引用，不用于用户头像编辑（详见 §9 阶段边界）。

### 2.6 个人中心扩展：我的收藏
- 新增「我的收藏」页签，展示用户收藏的帖子列表（分页），包含帖子标题、所属吧、作者等信息。

---

## 3. UX 边界分析

### 3.1 楼中楼回复展示与交互
- 主楼回复（`parent_reply_id IS NULL`）按 `floor_number` 升序排列，每层展示：作者、内容、点赞按钮、楼主标识、子回复预览区。
- 子回复预览区默认展示前 3 条最新子回复，按创建时间升序。超过 3 条时显示「查看剩余 xx 条回复」按钮，点击后展开完整分页列表（分页加载）。
- 子回复列表页支持分页（cursor 基于 `created_at`），每页 10 条，加载更多时追加在预览区下方。
- 回复输入框增加“引用”图标，点击后自动填充被引用楼层的内容（格式：`> @用户名：内容`）。

### 3.2 点赞/收藏状态一致性
- 帖子详情、回复列表接口返回 `isLiked`、`isFavorited` 字段（登录用户），未登录时返回 `null`。
- 点赞/收藏操作使用乐观更新：前端立即变更 UI，若请求失败则回滚并提示。
- 点赞/收藏按钮附带计数，点击后计数瞬时变化。

### 3.3 删除与隐藏的可见性规则

| 角色 | 普通用户 | 作者本人 | 吧主/版主 | 管理员 |
|------|----------|----------|-----------|--------|
| 已删除帖子/回复 | 不可见 | 可见占位符（“已删除”） | 可见占位符 | 可见原始内容（带删除标记） |
| 已隐藏帖子/回复 | 不可见 | 不可见（作者无特殊权限） | 可见原始内容 | 可见原始内容 |

### 3.4 吧资料编辑权限
- **吧主**：可编辑所有可修改字段（描述、吧规、头像、分类）。
- **版主**：可编辑描述、吧规、头像，不可修改分类（分类由吧主维护）。
- 吧名在任何情况下不可修改。

### 3.5 转让吧主流程
1. 当前吧主在成员列表中选择目标成员（必须是 `member` 或 `moderator`）。
2. 点击“转让吧主”，弹出确认框。
3. 确认后，目标成员角色变为 `owner`，原吧主角色变为 `moderator`。

---

## 4. 数据库变更

### 4.1 posts 表扩展

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `like_count` | INTEGER | DEFAULT 0 | 点赞数冗余计数 |
| `favorite_count` | INTEGER | DEFAULT 0 | 收藏数冗余计数 |
| `share_count` | INTEGER | DEFAULT 0 | 分享数冗余计数 |

### 4.2 replies 表扩展

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `like_count` | INTEGER | DEFAULT 0 | 点赞数冗余计数 |
| `child_count` | INTEGER | DEFAULT 0 | 楼中楼子回复数量（仅主楼回复使用） |

### 4.3 新增 user_likes 表（点赞记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `user_id` | UUID | FK → users.id, NOT NULL | 点赞用户 |
| `target_type` | VARCHAR(20) | NOT NULL | 目标类型：`post` / `reply` |
| `target_id` | UUID | NOT NULL | 目标 ID |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 点赞时间 |

**约束**：`UNIQUE(user_id, target_type, target_id)`

**索引**：
- `(target_type, target_id)` — 查询某目标的点赞列表
- `(user_id, target_type, target_id)` — 已由唯一约束覆盖

### 4.4 新增 user_favorites 表（收藏记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `user_id` | UUID | FK → users.id, NOT NULL | 收藏用户 |
| `post_id` | UUID | FK → posts.id, NOT NULL | 收藏帖子 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 收藏时间 |

**约束**：`UNIQUE(user_id, post_id)`

**索引**：`(user_id, created_at)` — 个人中心收藏列表查询

### 4.5 索引补充

```sql
-- 楼中楼子回复查询
CREATE INDEX idx_replies_parent_reply_id ON replies (parent_reply_id, created_at)
  WHERE parent_reply_id IS NOT NULL;
```

> **注**：第二阶段已创建的 `admin_actions` 表保持不变，本阶段不扩展其操作类型。吧内管理操作（如任命版主、隐藏内容等）及帖子/回复删除操作均不记录到管理员审计日志，仅通过数据库自身记录或应用日志留存。

---

## 5. 后端 API 设计

### 5.1 通用说明
- 所有接口遵循 `DOC/arch.md` 定义的统一响应格式、认证方式（JWT）、错误码规范。
- 分页采用 cursor 分页，游标编码规则与第二阶段一致（base64 编码的排序字段值）。
- 涉及计数的冗余字段（如 `like_count`）在事务内同步更新。
- 所有针对吧的管理操作（编辑资料、成员管理、隐藏、删除等）需检查吧状态：仅当吧状态为 `active` 或 `suspended` 时允许操作；若吧状态为 `permanently_banned` 或 `closed`，返回 `403 FORBIDDEN`，错误码 `BAR_NOT_MANAGEABLE`。

### 5.2 吧管理扩展

#### `PATCH /api/bars/:id` — 编辑吧资料
- **认证**：需要（Bearer Token）
- **权限**：吧主或版主（角色检查）
- **请求体**（可部分更新）：
  ```json
  {
    "description": "新描述",
    "rules": "新吧规",
    "avatarUrl": "https://...",
    "category": "新分类"
  }
  ```
- **校验**：字段长度等与创建时一致
- **成功响应** (200)：更新后的吧对象
- **错误**：403（权限不足或吧状态不可管理），404（吧不存在）

#### `GET /api/bars/:id/members` — 获取吧成员列表
- **认证**：可选（登录用户可获知自身角色）
- **查询参数**：`cursor`（可选）、`limit`（默认 20，最大 100）
- **响应**：成员列表，包含用户基本信息、角色、加入时间；支持按角色过滤（通过查询参数 `role`）

#### `PATCH /api/bars/:id/members/:userId/role` — 修改成员角色
- **认证**：需要（Bearer Token）
- **权限**：仅吧主可操作
- **请求体**：
  ```json
  { "role": "moderator" }
  ```
  或
  ```json
  { "role": "member" }
  ```
- **说明**：可将 `member` 升为 `moderator`，或将 `moderator` 降为 `member`
- **成功响应** (200)：更新后的成员对象
- **错误**：403（非吧主或吧状态不可管理），404（成员不存在），409（角色变更非法，如转让吧主需用专门接口）

#### `POST /api/bars/:id/transfer` — 转让吧主
- **认证**：需要（Bearer Token）
- **权限**：仅当前吧主
- **请求体**：
  ```json
  { "targetUserId": "uuid" }
  ```
- **校验**：目标用户必须是该吧成员且角色非 `owner`
- **成功响应** (200)：返回新吧主信息
- **错误**：403（权限不足或吧状态不可管理），404（目标用户非成员），409（目标已是吧主）

#### `POST /api/posts/:id/hide` — 隐藏帖子
- **认证**：需要（Bearer Token）
- **权限**：吧主或版主
- **请求体**（可选）：
  ```json
  { "reason": "违规内容" }
  ```
- **说明**：设置帖子 `status = 'hidden'`
- **成功响应** (200)：隐藏后的帖子对象
- **错误**：403（权限不足或所属吧状态不可管理），404（帖子不存在）

#### `POST /api/replies/:id/hide` — 隐藏回复
- 类似隐藏帖子，作用于回复。

### 5.3 回复能力增强

#### `POST /api/posts/:postId/replies` — 创建回复（扩展）
- **请求体**新增字段：
  ```json
  {
    "content": "回复内容",
    "contentType": "plaintext",
    "parentReplyId": "uuid"
  }
  ```
- **校验**：`parentReplyId` 必须属于同一帖子
- **成功响应** (201)：返回创建的回复对象，包含 `floorNumber`（主楼回复分配新楼层号，楼中楼回复无楼层号）
- **额外逻辑**：
  - 若为楼中楼回复，父回复的 `child_count` 字段需 +1（在事务内完成）。
  - 帖子总回复数 `reply_count` 仅对主楼回复递增，楼中楼回复不改变帖子回复计数。

#### `GET /api/replies/:replyId/children` — 获取楼中楼子回复列表
- **认证**：无需
- **路径参数**：`replyId` — 父回复 ID
- **查询参数**：`cursor`（基于 `created_at`）、`limit`（默认 10，最大 50）
- **响应**：子回复列表（按创建时间升序），每条包含作者、内容、点赞数、是否楼主等

### 5.4 互动接口

#### `POST /api/posts/:id/like` — 点赞帖子
- **认证**：需要
- **成功响应** (201)：返回当前点赞状态及更新后的 `likeCount`
- **幂等性**：已点赞则返回 409（错误码 `ALREADY_LIKED`），前端应处理为已点赞状态

#### `DELETE /api/posts/:id/like` — 取消点赞帖子
- **认证**：需要
- **成功响应** (200)：返回当前点赞状态及更新后的 `likeCount`
- **错误**：404（未点赞）

#### 类似接口针对回复：`POST /api/replies/:id/like`、`DELETE /api/replies/:id/like`

#### `POST /api/posts/:id/favorite` — 收藏帖子
- **认证**：需要
- **成功响应** (201)：返回当前收藏状态及更新后的 `favoriteCount`
- **幂等性**：已收藏返回 409 `ALREADY_FAVORITED`

#### `DELETE /api/posts/:id/favorite` — 取消收藏
- **认证**：需要
- **成功响应** (200)

#### `POST /api/posts/:id/share` — 记录分享
- **认证**：需要
- **成功响应** (200)：
  ```json
  {
    "shareUrl": "https://.../posts/:id",
    "shareCount": 42
  }
  ```
- **说明**：分享次数 +1，可返回分享链接（前端可直接使用当前页面 URL，此处仅用于计数）

### 5.5 帖子与回复删除

#### `DELETE /api/posts/:id` — 删除帖子
- **认证**：需要（Bearer Token）
- **权限**：作者本人、吧主、版主
- **前置检查**：所属吧状态必须为 `active` 或 `suspended`，否则返回 403 `BAR_NOT_MANAGEABLE`
- **成功响应** (204)
- **说明**：软删除（设置 `deleted_at`），同时递归软删除该帖下所有回复（批量更新 `replies` 表设置 `deleted_at`，不逐条维护 `child_count`）。删除操作不记录到管理员审计日志。
  - `child_count` 仅用于未删除主楼回复的子回复展示；父级主楼回复被删除时该计数不再用于前台展示，因此级联删除场景不做逐条回写，字段值可保持原值。

#### `DELETE /api/replies/:id` — 删除回复
- **认证**：需要（Bearer Token）
- **权限**：作者本人、吧主、版主
- **前置检查**：所属吧状态必须为 `active` 或 `suspended`，否则返回 403
- **成功响应** (204)
- **说明**：
  - 软删除（设置 `deleted_at`）。
  - 若为父回复，其子回复一并软删除（级联）；该父回复删除后不再参与前台子回复计数展示，因此不逐条维护 `child_count`。
  - 若为子回复，需同时将父回复的 `child_count` 减 1（在事务内完成）。
  - 删除操作不记录到管理员审计日志。

### 5.6 媒体上传

#### `POST /api/uploads/presign` — 获取预签名上传 URL
- **认证**：需要
- **请求体**：
  ```json
  {
    "filename": "image.png",
    "contentType": "image/png"
  }
  ```
- **校验**：`contentType` 必须是允许的图片类型（如 `image/jpeg`, `image/png`, `image/gif`），文件大小需限制（可通过预签名 URL 的 `content-length-range` 条件限制）
- **成功响应** (200)：
  ```json
  {
    "uploadUrl": "https://s3.../presigned-url",
    "fileUrl": "https://cdn.../image.png"
  }
  ```
- **说明**：`fileUrl` 为上传后的公开访问地址，前端可将其插入 Markdown 内容中。

### 5.7 个人中心扩展

#### `GET /api/users/me/favorites` — 我的收藏列表
- **认证**：需要
- **查询参数**：`cursor`、`limit`
- **响应**：帖子列表（包含帖子标题、吧名、作者昵称、收藏时间），支持分页。若原帖已被删除（`deleted_at` 不为空），则帖子信息返回占位内容（如标题“帖子已删除”），仍保留收藏记录以便用户管理。
- **说明**：查询时左连接 `posts` 表，即使帖子被删除也返回记录，但填充默认值。建议统一为：
  - `title = "帖子已删除"`
  - `barName = null`、`authorNickname = null`
  - `postId` 保留原收藏目标 ID，`favoritedAt` 保留真实收藏时间

> **注**：个人资料编辑接口（`PATCH /api/users/me/profile`）维持第二阶段实现，仅支持修改昵称和签名，本阶段不扩展头像编辑功能。

### 5.8 帖子/回复列表响应扩展

**帖子详情响应**（`GET /api/posts/:id`）新增：
```json
{
  "likeCount": 10,
  "favoriteCount": 5,
  "shareCount": 2,
  "isLiked": true,
  "isFavorited": false
}
```

**回复列表响应**（`GET /api/posts/:postId/replies`）每条新增：
```json
{
  "likeCount": 3,
  "isLiked": false,
  "isAuthor": true,
  "childCount": 5,
  "parentReplyId": null
}
```

---

## 6. 前端页面规划

### 6.1 现有页面改造

| 页面 | 改造内容 |
|------|----------|
| **首页 `/`** | 帖子卡片展示点赞/收藏计数；点击点赞/收藏图标直接操作（需登录） |
| **吧详情 `/bars/[id]`** | 增加成员数展示；吧主/版主可见“管理”下拉菜单（编辑资料、成员管理） |
| **帖子详情 `/posts/[id]`** | 增加点赞/收藏/分享按钮；回复区展示楼主标识；楼中楼回复折叠区；作者/吧务可见删除按钮；Markdown 渲染支持 |
| **发帖 `/create-post`** | 增加 Markdown 编辑模式切换；图片上传按钮（调用预签名接口并插入 Markdown） |
| **个人中心 `/profile`** | 增加“我的收藏”页签 |

### 6.2 新增组件

| 组件 | 说明 |
|------|------|
| `components/interaction/LikeButton.tsx` | 点赞按钮（传入目标类型和 ID，管理点赞状态） |
| `components/interaction/FavoriteButton.tsx` | 收藏按钮 |
| `components/interaction/ShareButton.tsx` | 分享按钮（复制链接） |
| `components/reply/ChildReplies.tsx` | 楼中楼子回复折叠区（接收父回复 ID，管理分页加载） |
| `components/editor/MarkdownEditor.tsx` | 基于简单文本编辑器的 Markdown 编辑器（支持预览） |
| `components/editor/ImageUpload.tsx` | 图片上传组件（调用预签名接口，上传后插入内容） |
| `components/bar/BarManageMenu.tsx` | 吧管理下拉菜单（编辑资料、成员管理） |

---

## 7. 后端模块规划

### 7.1 新增模块

| 模块 | 目录 | 职责 |
|------|------|------|
| **likes** | `modules/likes/` | 点赞业务：控制器、服务、实体（user_likes） |
| **favorites** | `modules/favorites/` | 收藏业务：控制器、服务、实体（user_favorites） |
| **uploads** | `modules/uploads/` | 媒体上传：预签名生成、文件类型校验 |

### 7.2 现有模块扩展

| 模块 | 扩展内容 |
|------|----------|
| **bars** | 新增编辑资料、成员列表、角色管理、转让、隐藏内容接口；增强权限校验（吧主/版主）；在操作前检查吧状态可管理性 |
| **posts** | 新增点赞/收藏计数、删除接口；响应扩展 `isLiked`/`isFavorited` 字段；删除时递归软删除回复 |
| **replies** | 新增楼中楼子回复查询、点赞计数、删除接口；响应扩展 `isAuthor`/`childCount`；维护 `child_count` 字段 |
| **users** | 新增收藏列表查询（处理已删除帖子占位） |

---

## 8. 与第二阶段的功能衔接

- **成员关系**：第二阶段实现了加入/退出吧，本阶段基于 `bar_members` 的 `role` 字段扩展角色管理。
- **吧状态影响**：第二阶段定义了各状态下的发帖权限，本阶段保持一致，并进一步明确管理操作仅允许在 `active` 或 `suspended` 状态下进行。
- **个人中心**：第二阶段已有“我的帖子/回复/吧/创建的吧”，本阶段新增“我的收藏”，与现有页签并列。

---

## 9. 阶段边界（本阶段不做）

- 不实现 AI 相关功能（重复帖检测、审核辅助、摘要等）。
- 不实现消息通知（@提醒、系统通知）。
- 不实现全局搜索。
- 不实现用户封禁（全站范围）。
- 不实现帖子/回复的二次编辑（发布后不可修改）。
- 不实现用户头像编辑功能（包括手动填写 URL 和预签名上传）。

---

## 10. 验收基线

- 用户可对帖子/回复点赞、取消点赞，计数实时更新。
- 用户可收藏帖子，在个人中心查看收藏列表（含已删除帖占位）。
- 用户可分享帖子，分享次数递增。
- 作者可删除自己的帖子/回复，吧主/版主可删除任意内容，删除后对普通用户隐藏。
- 楼中楼回复可正常发布、分页加载。
- 吧主可在成员管理页面任命/撤销版主，转让吧主。
- 吧主/版主可编辑吧资料，隐藏违规内容（仅在吧状态可管理时允许）。
- 支持 Markdown 发帖与图片上传。

---

## 11. 一致性校验结论（相对旧版 PRE_PHASE3）

- 旧版“头像编辑（`PATCH /api/users/me/profile` 扩展 `avatarUrl`）”与本阶段边界冲突，已移除，保持与第二阶段一致。
- 旧版“扩展 `admin_actions` 记录吧务隐藏操作”与本版要求冲突，已修订为“`admin_actions` 不扩展”。
- 吧务操作与删除/隐藏操作统一增加吧状态可管理校验，避免与第二阶段状态模型冲突。
- 所有新增接口均遵循 `DOC/arch.md` 的响应信封、JWT 认证、cursor 分页规则。
