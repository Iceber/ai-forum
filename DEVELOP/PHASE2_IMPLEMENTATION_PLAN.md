# 第二阶段实现计划（不含 AI 功能）

> 本文基于 `README.md`、`DEVELOP/PHASE1_IMPLEMENTATION_PLAN.md`、`DEVELOP/TODO.md`、`DOC/usage.md`、`DOC/arch.md` 整理第二阶段应完善和实现的功能，明确排除 AI 相关能力。
> 其余功能移入 `DEVELOP/PRE_PHASE3.md` 作为第三阶段前的预备实现。

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
- 加入吧前置校验：吧状态必须为 `active`。
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

### 3.3 个人资料编辑安全边界
- 头像上传使用预签名上传链路（预签名上传的完整实现在 PRE_PHASE3）。
- 个人签名限长 200 字符。

### 3.4 管理员身份判定
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

---

## 5. 后端 API 设计

### 5.1 吧创建与成员

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/bars` | 是（登录用户） | 提交创建吧申请 |
| POST | `/api/bars/:id/join` | 是 | 加入吧 |
| POST | `/api/bars/:id/leave` | 是 | 退出吧（吧主不可退出） |

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

前置校验：吧状态必须为 `active`；用户未加入过该吧。
成功响应（201）：返回新建的成员记录。

#### `POST /api/bars/:id/leave` — 退出吧

前置校验：用户已加入该吧；吧主不可退出（需先转让吧主）。
成功响应（200）：返回操作结果。

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
| duration | number | 封禁时长（小时），最小 1，最大 720（30 天） |

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
| 个人中心 | `/profile` | CSR（需登录） | 个人中心首页（我的帖子/回复/吧） |
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
| `components/profile/ProfileNav.tsx` | 个人中心侧边导航 |
| `components/admin/AdminNav.tsx` | 管理后台导航 |
| `components/admin/BarReviewCard.tsx` | 待审核吧卡片（含通过/拒绝操作） |

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
