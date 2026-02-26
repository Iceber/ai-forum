# 第二阶段实现计划（不含 AI 功能）

> 本文基于 `README.md`、`DEVELOP/PHASE1_IMPLEMENTATION_PLAN.md`、`DEVELOP/TODO.md`、`DOC/usage.md`、`DOC/arch.md` 整理第二阶段应完善和实现的功能，明确排除 AI 相关能力。

## 1. 阶段目标

- 在第一阶段 MVP 的基础上，完成吧的创建与审核流程、管理员后台治理能力、基础社区成员关系以及个人中心体验。
- AI 相关能力（重复帖检测、审核辅助、摘要）继续保持在后续版本，不纳入本阶段。
- 互动能力（点赞/收藏/分享）、回复增强（楼中楼）、内容删除、媒体上传等功能移入 PRE_PHASE3 实现。

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

### 2.3 加入/退出吧与首页展示
- 加入/退出吧：用户可主动加入或退出吧，沉淀"我的吧"数据。吧主不可退出（需先转让）。
- 加入吧前置校验：吧状态必须为 `active` 或 `suspended`（临时封禁期间仍允许加入）。
- 首页"我的吧"展示：用户登录后，在首页展示其已加入吧列表。

### 2.4 个人中心
- 我的帖子：查看自己发布的帖子列表。
- 我的回复：查看自己发布的回复列表。
- 我的吧：查看已加入吧列表。
- 我创建的吧：查看自己申请创建的吧及其审核状态。
- 个人资料编辑：修改昵称、头像、个人签名。

---

## 3. 设计补全：能力边界与 UX 合理性分析

### 3.1 吧状态对用户行为的影响

| 吧状态 | 浏览内容 | 发帖/回复 | 加入 | 退出 | 在公开列表可见 |
|--------|---------|----------|------|------|--------------|
| `active` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `pending_review` | ❌（仅创建者可见） | ❌ | ❌ | ❌ | ❌ |
| `rejected` | ❌（仅创建者可见状态） | ❌ | ❌ | ❌ | ❌ |
| `suspended` | ✅（只读） | ❌ | ✅ | ✅ | ❌（从列表移除） |
| `permanently_banned` | ✅（只读） | ❌ | ❌ | ❌ | ❌ |
| `closed` | ✅（只读） | ❌ | ❌ | ❌ | ❌ |

- `suspended` 状态的吧：新用户可加入，已有成员可退出。`permanently_banned` 或 `closed` 状态的吧：不允许任何人加入或退出，已有成员仍可在"我的吧"列表中看到该吧（附带状态标识）并进入查看历史内容。
- 被封禁/关闭的吧详情页顶部展示醒目的状态提示（如"该吧已被封禁"）。
- 在被封禁/关闭的吧内，发帖和回复按钮禁用并展示提示。

### 3.2 吧创建被拒绝后的处理
- 创建者在"我创建的吧"中可看到被拒绝的申请及拒绝原因。
- 被拒绝的吧不可直接重新提交，创建者需发起新的创建申请。
- 被拒绝的记录保留可查阅，不可删除。

### 3.3 个人资料编辑安全边界
- 头像上传（预签名上传链路）整体移入 PRE_PHASE3；第二阶段仅支持用户直接填写头像 URL，不对接任何上传服务。
- 个人签名限长 200 字符。

### 3.4 管理员身份判定
- 管理员通过 `users.role = 'admin'` 判定。
- 第二阶段管理员手动指定（数据库直接修改），不提供管理员注册/指派 UI。

### 3.5 吧列表与详情响应字段补充

第二阶段 `GET /api/bars` 和 `GET /api/bars/:id` 响应字段需扩展以支持前端渲染加入/退出按钮、成员数展示等功能：

**`GET /api/bars` 列表响应（每条吧记录新增）**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `memberCount` | integer | 吧成员数（来自 `bars.member_count` 冗余字段） |
| `isMember` | boolean \| null | 已登录时返回是否已加入，未登录返回 `null` |

> `GET /api/bars` 在第二阶段起仅返回 `status = 'active'` 的吧（第一阶段 `active` 为默认值，第二阶段变为显式过滤约束）。

**`GET /api/bars/:id` 详情响应（新增字段）**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `memberCount` | integer | 吧成员数 |
| `isMember` | boolean \| null | 已登录时返回是否已加入，未登录返回 `null` |
| `memberRole` | string \| null | 已加入时返回角色（`member` / `owner`），否则 `null`。`moderator` 角色在 PRE_PHASE3 启用，第二阶段仅有 `member` 和 `owner` |
| `suspendUntil` | ISO8601 \| null | 临时封禁时返回到期时间，其他状态为 `null` |
| `statusReason` | string \| null | 封禁/关闭原因（`suspended`/`permanently_banned`/`closed` 时有值），其他状态为 `null` |

> 非 `active` 状态的吧详情页仍可通过 `GET /api/bars/:id` 访问（已加入成员需能查看历史内容），但吧列表（`GET /api/bars`）不展示这些吧。

### 3.6 吧状态流转规则

| 当前状态 | 可迁移至 | 操作来源 |
|---------|---------|---------|
| `pending_review` | `active` | 管理员审核通过 |
| `pending_review` | `rejected` | 管理员审核拒绝 |
| `active` | `suspended` | 管理员临时封禁 |
| `active` | `permanently_banned` | 管理员永久封禁 |
| `active` | `closed` | 管理员关闭吧 |
| `suspended` | `active` | 管理员手动解封 / 封禁到期自动解封 |
| `suspended` | `permanently_banned` | 管理员在封禁期内升级为永久封禁 |
| `suspended` | `closed` | 管理员在封禁期内关闭吧 |
| `rejected` | — | 终态，不可迁移（创建者需发起新申请） |
| `permanently_banned` | — | 终态，不可迁移 |
| `closed` | — | 终态，不可迁移 |

> 管理员接口在执行状态变更前应校验当前状态是否满足迁移前提，不合法时返回 `409 Conflict`，错误码 `INVALID_STATE_TRANSITION`。

### 3.7 封禁到期自动解封策略

临时封禁吧（`suspended`）到期后的解封采用**延迟求值（Lazy Evaluation）**策略：

- **适用范围**：任何需要读取或依赖吧状态的操作（包括 `GET /api/bars`、`GET /api/bars/:id`、`POST /api/bars/:id/join`、`POST /api/bars/:id/leave` 以及所有管理员接口），在执行业务逻辑前均应先执行到期检查并在同一事务内完成自动解封，确保状态读取的一致性。
- 每次访问吧详情（`GET /api/bars/:id`）时，若吧状态为 `suspended` 且 `suspend_until ≤ NOW()`，服务端在同一事务内将其状态更新为 `active` 后再返回结果（事务确保并发读取时不产生重复解封写入）。
- 吧列表（`GET /api/bars`）查询时同样执行此检查，确保 `active` 过滤的准确性。
- 无需额外定时任务，第二阶段实现成本低。
- 后续可在工程质量迭代中引入定时任务（`@nestjs/schedule`）批量处理到期封禁，两种策略可并存。

> **边界说明**：若封禁已通过 Lazy Evaluation 自动到期解封（吧状态已变为 `active`），此时管理员手动调用 `POST /api/admin/bars/:id/unsuspend` 会返回 `409 INVALID_STATE_TRANSITION`（当前状态非 `suspended`）。这是预期行为，前端应将此 `409` 提示为"该吧封禁已自动到期，无需手动解封，请刷新查看最新状态"，避免误导管理员认为操作失败。

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
| `status_reason` | TEXT | NULL | 封禁/关闭原因（适用于 `suspended`、`permanently_banned`、`closed` 状态） |
| `suspend_until` | TIMESTAMPTZ | NULL | 临时封禁到期时间（null 表示永久封禁或非封禁状态） |
| `member_count` | INTEGER | DEFAULT 0, NOT NULL | 成员数冗余计数，加入/退出时由服务层维护 |

### 4.2 新增 admin_actions 表（管理操作审计）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 记录 ID |
| `admin_id` | UUID | FK → users.id, NOT NULL | 操作管理员 |
| `action` | VARCHAR(50) | NOT NULL | 操作类型（见下方枚举） |
| `target_type` | VARCHAR(20) | NOT NULL | 目标类型：`bar` |
| `target_id` | UUID | NOT NULL | 目标 ID |
| `reason` | TEXT | NULL | 操作原因/备注 |
| `metadata` | JSONB | NULL | 额外信息（如封禁时长） |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 操作时间 |

**`action` 枚举值**：`approve_bar`、`reject_bar`、`suspend_bar`、`unsuspend_bar`、`ban_bar`、`close_bar`。

> PRE_PHASE3 中将扩展 `target_type` 支持 `post` / `reply`，并新增 `hide_post`、`hide_reply` 等操作类型。

**索引**：`(target_type, target_id, created_at)` — 查询某目标的操作历史。

### 4.3 索引补充

```sql
-- 吧列表查询（仅展示 active 状态）
CREATE INDEX idx_bars_status_created_at ON bars (status, created_at);
-- 用户创建的吧查询
CREATE INDEX idx_bars_created_by ON bars (created_by, created_at);
-- 用户帖子查询（个人中心）
CREATE INDEX idx_posts_author_id ON posts (author_id, created_at);
-- 用户回复查询（个人中心）
CREATE INDEX idx_replies_author_id ON replies (author_id, created_at);
```

### 4.4 bar_members 表（已有，第二阶段扩展使用）

`bar_members` 表在第一阶段已创建（吧创建时自动插入 `owner` 记录），第二阶段加入/退出吧功能将正式使用该表，无需新增列，补充以下索引：

```sql
-- 用户在某吧的成员记录快速查找（加入/退出、memberRole 查询时使用）
-- 第一阶段 Entity 已定义 UNIQUE(bar_id, user_id)，确认同步至数据库：
CREATE UNIQUE INDEX IF NOT EXISTS uidx_bar_members_bar_user ON bar_members (bar_id, user_id);
-- 用户已加入的吧列表查询（个人中心 /profile/bars）
-- 第一阶段已建 bar_members(user_id, joined_at)，确认存在即可
```

> `member_count` 字段在加入吧（`JOIN`）时 +1，退出吧（`LEAVE`）时 -1，由 Service 层在同一事务内维护，使吧列表可直接读取成员数而无需额外 COUNT 查询（避免批量展示时的聚合开销）。**注意**：吧创建时，Service 层在同一事务内插入创建者的 `bar_members`（`role = 'owner'`）记录并同时将 `member_count` 初始化为 `1`；若遗漏此步骤，新吧的成员数将显示为 `0`（与 `DEFAULT 0` 冲突）。后续如需高精度一致性，可改为数据库触发器实现。

---

## 5. 后端 API 设计

### 5.1 吧创建与成员

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/bars` | 否 | 获取吧列表（仅 `active` 状态，cursor 分页） |
| GET | `/api/bars/:id` | 否（登录用户返回额外字段） | 获取吧详情 |
| POST | `/api/bars` | 是（登录用户） | 提交创建吧申请 |
| POST | `/api/bars/:id/join` | 是 | 加入吧 |
| POST | `/api/bars/:id/leave` | 是 | 退出吧（吧主不可退出） |

#### `GET /api/bars` — 获取吧列表（第二阶段变更）

- **第二阶段变更**：仅返回 `status = 'active'` 的吧（之前无此过滤约束）。
- 执行查询前，对 `suspended` 且已到期的吧自动解封（见 §3.7）。
- 每条吧记录响应新增 `memberCount`；已登录用户新增 `isMember` 字段。
- 分页参数：`cursor`（可选）、`limit`（默认 20，最大 100）。

#### `GET /api/bars/:id` — 获取吧详情（第二阶段变更）

- `pending_review` 和 `rejected` 状态的吧仅创建者本人可访问；非创建者请求时返回 `404 Not Found`（对外不暴露这两种状态的存在）。
- `suspended`、`permanently_banned`、`closed` 状态的吧对所有人可访问（已加入的成员需能查看历史内容），不返回 `404`。
- 若吧为临时封禁且已到期，服务端自动解封后再返回。
- 响应新增字段：`memberCount`、`isMember`、`memberRole`、`suspendUntil`、`statusReason`（见 §3.5）。

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

#### `POST /api/bars/:id/join` — 加入吧

前置校验：吧状态必须为 `active` 或 `suspended`；用户未加入过该吧。
成功响应（201）：返回新建的成员记录。
失败响应：`404` 吧不存在（`pending_review`/`rejected` 状态的吧对非创建者同样返回 `404`）；`409` 已是成员或吧状态不允许加入（错误码 `BAR_NOT_JOINABLE`）。

#### `POST /api/bars/:id/leave` — 退出吧

前置校验：用户已加入该吧；吧主不可退出（需先转让吧主）；吧状态为 `active` 或 `suspended`（`permanently_banned`/`closed` 状态的吧不允许退出）。
成功响应（200）：返回操作结果。
失败响应：`404` 吧不存在（`pending_review`/`rejected` 状态的吧对非创建者同样返回 `404`）或用户未加入；`403` 吧主不可退出；`409` 吧状态不允许退出（错误码 `BAR_NOT_LEAVABLE`）。

### 5.2 管理员接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/admin/bars` | 是（admin） | 全量吧列表（支持按状态过滤，cursor 分页） |
| POST | `/api/admin/bars/:id/approve` | 是（admin） | 审核通过吧 |
| POST | `/api/admin/bars/:id/reject` | 是（admin） | 审核拒绝吧 |
| POST | `/api/admin/bars/:id/suspend` | 是（admin） | 临时封禁吧 |
| POST | `/api/admin/bars/:id/unsuspend` | 是（admin） | 解封吧 |
| POST | `/api/admin/bars/:id/ban` | 是（admin） | 永久封禁吧 |
| POST | `/api/admin/bars/:id/close` | 是（admin） | 关闭吧 |
| GET | `/api/admin/actions` | 是（admin） | 管理操作审计日志（cursor 分页） |

#### `GET /api/admin/bars` — 全量吧列表

用于管理员后台"吧管理"页面（`/admin/bars`），支持按状态过滤和分页。待审核吧列表使用 `?status=pending_review` 参数过滤即可，无需单独端点。

查询参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| `status` | string | 可选，按状态过滤（不传则返回所有状态）。待审核列表使用 `pending_review` |
| `cursor` | string | 分页游标 |
| `limit` | integer | 每页条数，默认 20，最大 100 |

#### `POST /api/admin/bars/:id/approve` — 审核通过

将吧状态从 `pending_review` 变更为 `active`，记录审计日志。
失败响应：`404` 吧不存在；`409` 吧当前状态不允许此操作（非 `pending_review`）。

#### `POST /api/admin/bars/:id/reject` — 审核拒绝

请求体：
```json
{ "reason": "拒绝原因说明" }
```
将吧状态变更为 `rejected`，记录拒绝原因和审计日志。
失败响应：`400` 未提供拒绝原因；`404` 吧不存在；`409` 吧当前状态不允许此操作。

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
| duration | number | 封禁时长（小时），最小 1，最大 720（30 天） |

失败响应：`400` 未提供原因或时长；`404` 吧不存在；`409` 吧当前状态不允许此操作（非 `active` 或 `suspended`）。

#### `POST /api/admin/bars/:id/unsuspend` — 解封吧

将吧状态从 `suspended` 恢复为 `active`，清空 `status_reason` 和 `suspend_until`，记录审计日志。
失败响应：`404` 吧不存在；`409` 吧当前状态非 `suspended`。

#### `POST /api/admin/bars/:id/ban` — 永久封禁

请求体：
```json
{ "reason": "永久封禁原因" }
```
将吧状态变更为 `permanently_banned`，记录审计日志。
失败响应：`400` 未提供原因；`404` 吧不存在；`409` 吧当前状态不允许此操作（非 `active` 或 `suspended`）。

#### `POST /api/admin/bars/:id/close` — 关闭吧

请求体：
```json
{ "reason": "关闭原因" }
```
将吧状态变更为 `closed`，记录审计日志。
失败响应：`400` 未提供原因；`404` 吧不存在；`409` 吧当前状态不允许此操作（非 `active` 或 `suspended`）。

#### 管理员接口公共校验说明

- 所有管理员接口在执行前先验证目标吧是否存在，不存在则返回 `404 Not Found`。
- 状态迁移不合法时（参见 §3.6）返回 `409 Conflict`，错误体：`{ "error": { "code": "INVALID_STATE_TRANSITION", "message": "..." } }`。
- `suspend`、`ban`、`close` 操作中的 `reason` 字段写入 `bars.status_reason`，`unsuspend` 时清空该字段。
- 所有操作记录到 `admin_actions` 审计表，`admin_id` 取当前登录用户 ID。

### 5.3 个人中心接口

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/users/me/posts` | 是 | 我的帖子列表（cursor 分页） |
| GET | `/api/users/me/replies` | 是 | 我的回复列表（cursor 分页） |
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

---

## 6. 前端页面规划

### 6.1 新增页面

| 页面 | 路由 | 渲染方式 | 说明 |
|------|------|---------|------|
| 创建吧 | `/create-bar` | CSR（需登录） | 吧创建申请表单 |
| 个人中心 | `/profile` | CSR（需登录） | 个人中心首页（我的帖子，默认页签） |
| 我的回复 | `/profile/replies` | CSR（需登录） | 我的回复列表（cursor 分页） |
| 我的吧 | `/profile/bars` | CSR（需登录） | 已加入吧列表（cursor 分页） |
| 个人资料编辑 | `/profile/edit` | CSR（需登录） | 编辑昵称、头像、签名 |
| 我创建的吧 | `/profile/created-bars` | CSR（需登录） | 查看创建的吧及审核状态 |
| 管理员后台 | `/admin` | CSR（需 admin） | 管理员仪表盘入口 |
| 吧审核列表 | `/admin/bars/pending` | CSR（需 admin） | 待审核吧列表与审核操作 |
| 吧管理 | `/admin/bars` | CSR（需 admin） | 全部吧列表（可执行封禁/关闭） |
| 审计日志 | `/admin/actions` | CSR（需 admin） | 管理操作日志查看 |

### 6.2 现有页面改造

| 页面 | 改造内容 |
|------|---------|
| **首页 `/`** | 登录后展示"我的吧"区域 |
| **吧详情 `/bars/[id]`** | 增加"加入/退出吧"按钮；被封禁/关闭的吧展示状态提示并禁用交互 |
| **导航栏 Navbar** | 增加"个人中心"入口；管理员可见"管理后台"入口；增加"创建吧"入口 |

### 6.3 新增组件

| 组件 | 说明 |
|------|------|
| `components/bar/BarStatusBadge.tsx` | 吧状态标识组件 |
| `components/bar/JoinBarButton.tsx` | 加入/退出吧按钮 |
| `components/bar/BarCreateForm.tsx` | 创建吧申请表单（含字段校验与提交） |
| `components/bar/CreatedBarCard.tsx` | 我创建的吧卡片（展示审核状态与拒绝原因） |
| `components/profile/ProfileNav.tsx` | 个人中心侧边导航 |
| `components/admin/AdminNav.tsx` | 管理后台导航 |
| `components/admin/BarReviewCard.tsx` | 待审核吧卡片（含通过/拒绝操作） |
| `components/admin/AdminBarTable.tsx` | 管理后台吧列表表格（含状态过滤与操作入口） |
| `components/admin/SuspendBanModal.tsx` | 封禁/关闭弹窗（含原因填写与时长选择） |

---

## 7. 后端模块规划

### 7.1 新增模块

| 模块 | 目录 | 职责 |
|------|------|------|
| **admin** | `modules/admin/` | 管理后台：吧审核、封禁、审计日志 |

### 7.2 现有模块扩展

| 模块 | 扩展内容 |
|------|---------|
| **bars** | 新增创建吧 API、加入/退出吧 |
| **users** | 新增个人中心相关查询（我的帖子/回复/吧）、个人资料编辑 |
| **auth** | AdminGuard 新增管理员权限守卫 |

---

## 8. 阶段边界（本阶段不做）

- 不实现任何 AI 相关功能：重复帖检测、AI 审核提示、长帖摘要。
- 不实现互动能力：点赞、收藏、分享（移入 PRE_PHASE3）。
- 不实现回复增强：楼中楼回复、引用回复、楼主标识（移入 PRE_PHASE3）。
- 不实现社区治理扩展：吧资料编辑、角色管理、吧主转让、内容隐藏（移入 PRE_PHASE3）。
- 不实现帖子/回复删除（移入 PRE_PHASE3）。
- 不实现 Markdown 渲染与媒体上传（移入 PRE_PHASE3）。
- 不实现通知与提醒能力（@提醒、消息中心）。
- 不实现全局搜索能力。
- 不实现接口限流。
- 不实现帖子/回复二次编辑。
- 不实现编辑历史记录。
- 不实现用户封禁（帖吧级/全站级用户封禁）。

---

## 9. 验收基线

- 第二阶段功能清单中的每个模块均具备对应 API 与前端页面/入口。
- 所有新增写接口具备权限校验与参数校验。
- 吧创建→审核→上线完整链路可走通。
- 管理员可在后台完成吧审核、封禁、关闭操作。
- 用户可加入/退出吧，登录后首页展示"我的吧"。
- 个人中心主要页面可正常浏览。
- 被封禁/关闭的吧正确展示只读状态，禁止写操作。

---

## 10. 用户操作流程

本节描述第二阶段各核心场景下用户在前端页面的完整操作步骤，用于指导 UI 交互设计与接口调用时序。

### 10.1 创建吧流程

**前提**：用户已登录。

```
用户点击导航栏"创建吧"
        │
        ▼
  跳转 /create-bar
        │
        ▼
  填写创建吧表单
  ┌─────────────────────────────┐
  │ 吧名（必填）                 │
  │ 吧描述（必填）               │
  │ 吧分类（选填）               │
  │ 吧规（选填）                 │
  │ 吧头像 URL（选填）           │
  └─────────────────────────────┘
        │
        ▼
  点击"提交申请"
        │
   ┌────┴────┐
本地校验失败   校验通过
   │          │
字段旁提示   POST /api/bars
错误信息       │
          ┌───┴───┐
         201      4xx
          │        │
    提示"已提交   展示错误提示
    等待审核"    409→"吧名重复"
          │
          ▼
    跳转 /profile/created-bars
    可见新申请（状态：审核中）
```

**细节说明**：
- 吧名查重在提交时由后端校验，前端不做实时查重请求（避免频繁调用）。
- 表单提交期间按钮禁用，防止重复提交。
- 创建成功后吧不出现在公开列表，仅在创建者的"我创建的吧"中可见。

---

### 10.2 管理员审核流程

**前提**：管理员已登录。

```
管理员进入 /admin/bars/pending
        │
        ▼
  查看待审核吧列表（分页）
  每条显示：吧名、简介、申请人、申请时间
        │
        ▼
  点击某条待审核吧，查看详情
        │
  ┌─────┴──────┐
审核通过       审核拒绝
  │              │
点击"通过"    点击"拒绝"
  │              │
  ▼              ▼
POST /api/     弹窗填写拒绝原因（必填）
admin/bars       │
/:id/approve   确认
  │              │
  ▼              ▼
吧状态→active  POST /api/admin/bars/:id/reject
  │              │
  └──────┬───────┘
         ▼
    当前列表自动刷新
    操作记录到审计日志

创建者侧（异步感知）：
  登录后查看 /profile/created-bars
  可见吧状态变更为 active 或 rejected（附拒绝原因）
```

**细节说明**：
- 拒绝原因为必填项，前端弹窗须校验不为空。
- 管理员操作后当前页列表刷新（乐观更新或重新请求）。
- 审核后状态改变是终态迁移（见 §3.6），不可在后台撤销。

---

### 10.3 加入与退出吧流程

**前提**：用户已登录。

**加入吧**：

```
用户浏览吧详情页 /bars/[id]
        │
  ┌─────┴──────────┐
已加入（isMember=true）  未加入（isMember=false）
  │                       │
显示"退出吧"按钮          显示"加入吧"按钮
                          │
                    点击"加入吧"
                          │
                    POST /api/bars/:id/join
                          │
                   ┌──────┴──────┐
                  201            4xx
                   │              │
            按钮切换为"退出吧"   409→"你已是该吧成员"
            memberCount +1       409→"吧状态不允许加入"
```

**退出吧**：

```
用户在吧详情页点击"退出吧"
        │
        ▼
  弹出确认对话框
  "确认退出「吧名」？"
        │
   ┌────┴────┐
  取消       确认
   │          │
  关闭弹窗  POST /api/bars/:id/leave
              │
         ┌────┴────┐
        200         403
         │           │
   按钮切换为"加入吧"  提示"你是该吧吧主，
   memberCount -1     无法退出，请先转让
                      吧主（功能待开放）"
```

**细节说明**：
- 退出操作需要确认弹窗防误操作。
- 吧主的"退出吧"按钮仍展示，但点击后提示转让说明（吧主转让在 PRE_PHASE3 实现）。
- `suspended` 状态的吧：加入和退出按钮均正常展示可操作。
- `permanently_banned` 或 `closed` 状态的吧：加入和退出按钮均禁用，已加入的成员仅可浏览历史内容。

---

### 10.4 个人中心操作流程

**前提**：用户已登录。

**浏览个人中心**：

```
点击导航栏"个人中心"
        │
        ▼
  跳转 /profile
  展示"我的帖子"列表（默认页签）
        │
  通过 ProfileNav 切换页签：
  ┌──────────────────────────────────┐
  │  我的帖子  /profile              │
  │  我的回复  /profile/replies      │
  │  我的吧    /profile/bars         │
  │  我创建的吧 /profile/created-bars │
  └──────────────────────────────────┘
        │
  各页签调用对应接口（cursor 分页）
  GET /api/users/me/posts
  GET /api/users/me/replies
  GET /api/users/me/bars
  GET /api/users/me/created-bars
```

**编辑个人资料**：

```
用户在 /profile 点击"编辑资料"
        │
        ▼
  跳转 /profile/edit
  表单预填：昵称、头像 URL、个人签名
        │
        ▼
  修改内容后点击"保存"
        │
   ┌────┴────┐
本地校验失败   校验通过
   │          │
字段提示错误  PATCH /api/users/me/profile
              │
         ┌────┴────┐
        200         400
         │           │
    跳转 /profile    展示字段校验错误
    展示更新后资料
```

**细节说明**：
- 头像上传（预签名链路）在第二阶段暂不实现，仅支持填写 URL。
- 个人签名限长 200 字符，前端展示实时字符计数。
- 所有字段均为选填，只提交有修改的字段（PATCH 语义）。

---

### 10.5 管理员治理操作流程

**前提**：管理员已登录。

**封禁/关闭吧**：

```
管理员进入 /admin/bars
        │
        ▼
  查看全量吧列表（支持按状态过滤）
        │
        ▼
  找到目标吧，点击"操作"入口
        │
   ┌────┼──────────────────┐
   │    │                  │
临时封禁  永久封禁          关闭吧
   │    │                  │
   ▼    ▼                  ▼
弹窗（SuspendBanModal）    弹窗填写关闭原因（必填）
填写原因（必填）               │
填写时长小时数（1-720）         ▼
   │    │              POST /api/admin/bars/:id/close
   │    └→ POST /api/admin/bars/:id/ban
   └──→ POST /api/admin/bars/:id/suspend
        │
        ▼
   操作成功后列表刷新，吧状态更新
   操作记录到审计日志
```

**解封吧**：

```
管理员在 /admin/bars 筛选 "suspended" 状态
        │
        ▼
  点击目标吧的"解封"操作
        │
        ▼
  POST /api/admin/bars/:id/unsuspend
        │
   ┌────┴────┐
  200         409
   │           │
吧恢复 active  重新 GET 吧详情，判断当前状态
列表刷新       │
          ┌───┴───┐
        active   其他状态
          │         │
   提示"该吧封禁已  提示"当前吧状态
   自动到期，无需   不支持该操作，
   手动解封，请     请刷新后重试"
   刷新查看最新
   状态"
```

**查看审计日志**：

```
管理员进入 /admin/actions
        │
        ▼
  审计日志列表（按时间倒序，cursor 分页）
  每条日志显示：
  ┌──────────────────────────────────────┐
  │ 操作类型  目标（吧名/ID）  操作人     │
  │ 操作时间  原因/备注                   │
  └──────────────────────────────────────┘
        │
  滚动到底部或点击"加载更多"
        │
  GET /api/admin/actions?cursor=...
```

**细节说明**：
- `SuspendBanModal` 针对临时封禁展示时长输入（小时），永久封禁/关闭不展示时长。
- 所有弹窗操作均有加载状态和错误回显。
- `409 INVALID_STATE_TRANSITION` 错误时前端通常提示"当前吧状态不支持该操作，请刷新后重试"；但在 `unsuspend` 操作收到 `409` 时，应区分场景：若返回的吧状态已为 `active`（封禁已自动到期），则提示"该吧封禁已自动到期，无需手动解封，请刷新查看最新状态"（参见 §3.7）。
