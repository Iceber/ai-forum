# DBA SQL 设计审查报告

> **审查范围**：`backend/migrations/` 全部 3 个迁移文件（001–003）+ `backend/src/modules/` 全部 9 个 Service 文件及 8 个 Entity 文件的数据库操作  
> **数据库**：PostgreSQL 15  
> **ORM**：TypeORM 0.3

---

## 目录

1. [P0 - 楼层号并发竞争（floor_number 重复）](#issue-1)
2. [P0 - 点赞/收藏存在性检查在事务外，并发下产生脏数据库错误](#issue-2)
3. [P1 - 去规范化计数器无负值保护，可能归零以下](#issue-3)
4. [P1 - user_likes / admin_actions 多态关联缺失外键，无法保证引用完整性](#issue-4)
5. [P1 - 删帖时未更新子回复 child_count，denormalized 计数不一致](#issue-5)
6. [P1 - 每次 GET /bars 都执行全表 UPDATE（自动解封），高并发下产生锁争用](#issue-6)
7. [P2 - floor_number 缺失 UNIQUE 约束，索引无法防止重复楼层](#issue-7)
8. [P2 - status 与 deleted_at 双重删除标记冗余，缺少一致性约束](#issue-8)
9. [P2 - 全局帖子列表缺少覆盖索引，status+deleted_at+created_at 组合无索引](#issue-9)
10. [P2 - 自动解封查询缺少 (status, suspend_until) 专用索引](#issue-10)
11. [P2 - 游标分页仅用时间戳，高并发写入时存在翻页数据丢失/重复](#issue-11)
12. [P3 - incrementReplyCount / decrementReplyCount 为非事务性死代码](#issue-12)
13. [P3 - auto-unsuspend TOCTOU 竞态（autoUnsuspendIfExpired）](#issue-13)
14. [P3 - findByIds 已弃用，可能在未来 TypeORM 升级中失效](#issue-14)
15. [附录：各问题快速索引](#appendix)

---

<a name="issue-1"></a>
## Issue 1 — P0：楼层号并发竞争（floor_number 重复）

### 位置
`backend/src/modules/replies/replies.service.ts` `create()` 方法（第 278–287 行）

### 问题描述

创建主回复时，通过 `MAX(floor_number) + 1` 方式计算下一楼层号：

```typescript
const result = await manager
  .createQueryBuilder(Reply, 'reply')
  .select('MAX(reply.floor_number)', 'maxFloor')
  .where('reply.post_id = :postId', { postId })
  .andWhere('reply.parent_reply_id IS NULL')
  .getRawOne<{ maxFloor: number | null }>();

floorNumber = (result?.maxFloor ?? 0) + 1;
```

`MAX()` 读取与后续 `INSERT` 之间不在同一行级锁保护下（TypeORM 的 `transaction` 默认为 `READ COMMITTED` 隔离级别）。两个并发请求都可读到相同的 `maxFloor`，各自计算出相同的楼层号并成功插入，导致同一帖子出现**重复楼层号**。

由于 `idx_replies_post_id_floor_number` 是**普通索引**（非 UNIQUE），数据库层面**不会拦截**该冲突。

### 影响范围

- `POST /api/posts/:postId/replies`（创建主回复）
- 帖子下可见的楼层列表顺序错乱、楼层号重复展示

### 触发条件

同一帖子在同一时间段内有 **≥ 2 个并发回复**请求（在日活量较大时极易触发）。

### 修复建议

使用数据库序列（Sequence）或对该帖子行加 `SELECT ... FOR UPDATE` 锁，确保楼层号分配的原子性：

```sql
-- 方案 A：对 posts 行加写锁，序列化楼层分配
SELECT id FROM posts WHERE id = :postId FOR UPDATE;
-- 此后执行 MAX+1 在同一事务内，其他事务必须等待

-- 方案 B：独立序列（推荐）
CREATE SEQUENCE replies_floor_seq;
-- 或使用 per-post 计数器列（posts.next_floor_number）
```

---

<a name="issue-2"></a>
## Issue 2 — P0：点赞/收藏存在性检查在事务外，并发下产生未处理的数据库错误

### 位置
- `backend/src/modules/likes/likes.service.ts` `likePost()`（第 33–41 行）、`likeReply()`（第 87–95 行）
- `backend/src/modules/favorites/favorites.service.ts` `favoritePost()`（第 30–38 行）

### 问题描述

重复点赞检查在**事务外**执行：

```typescript
// 1. 事务外：检查是否已点赞（READ COMMITTED 读）
const existing = await this.likesRepository.findOne({
  where: { userId, targetType: 'post', targetId: postId },
});
if (existing) throw new ConflictException('ALREADY_LIKED');

// 2. 进入事务：插入 + 计数器 +1
return this.dataSource.transaction(async (manager) => {
  await manager.save(like);           // 可能触发 UNIQUE violation
  await manager.increment(Post, ...);
  ...
});
```

在步骤 1 和步骤 2 之间，另一个相同用户的请求也通过了步骤 1 的检查并进入事务。第一个事务提交后，第二个事务的 `INSERT` 会命中 `UNIQUE(user_id, target_type, target_id)` 约束，抛出**原始 PostgreSQL 数据库错误**（而非业务层 409 ConflictException），导致接口返回 500。

### 影响范围

- `POST /api/posts/:postId/like`
- `POST /api/replies/:replyId/like`
- `POST /api/posts/:postId/favorite`
- 并发场景下用户重复点击"点赞"/"收藏"按钮时会得到 500 错误

### 触发条件

同一用户在网络较差或前端防抖未生效时，连续发送 **≥ 2 个并发相同**点赞/收藏请求。

### 修复建议

将存在性检查移入事务内，或捕获数据库唯一约束错误并转换为业务异常：

```typescript
// 方案 A：捕获 unique violation（PostgreSQL error code 23505）
try {
  await manager.save(like);
} catch (err: any) {
  if (err?.code === '23505') {
    throw new ConflictException({ message: 'Already liked', error: 'ALREADY_LIKED' });
  }
  throw err;
}

// 方案 B：将 findOne 检查也放入同一事务
return this.dataSource.transaction(async (manager) => {
  const existing = await manager.findOne(UserLike, { where: { ... } });
  if (existing) throw new ConflictException('ALREADY_LIKED');
  ...
});
```

---

<a name="issue-3"></a>
## Issue 3 — P1：去规范化计数器无负值保护

### 位置
- `backend/migrations/001_initial_schema.sql`（reply_count 列）
- `backend/migrations/003_phase3_interactions.sql`（like_count、favorite_count、share_count、child_count 列）
- `backend/migrations/002_phase2_bars_admin.sql`（member_count 列）

### 问题描述

所有去规范化计数器列定义为 `INTEGER NOT NULL DEFAULT 0`，但未添加 `CHECK (column >= 0)` 约束：

```sql
reply_count    INTEGER NOT NULL DEFAULT 0,   -- 无 >= 0 约束
like_count     INTEGER NOT NULL DEFAULT 0,
favorite_count INTEGER NOT NULL DEFAULT 0,
share_count    INTEGER NOT NULL DEFAULT 0,
member_count   INTEGER NOT NULL DEFAULT 0,
child_count    INTEGER NOT NULL DEFAULT 0,
```

当业务逻辑出现 Bug（例如重复 decrement）或者 Issue 1/Issue 2 所描述的并发竞态发生时，这些值可能被递减至**负数**，数据库层面不会拒绝写入。

### 影响范围

- `posts.reply_count`、`posts.like_count`、`posts.favorite_count`、`posts.share_count`
- `replies.like_count`、`replies.child_count`
- `bars.member_count`
- 前端展示可能出现负数计数，影响用户体验

### 触发条件

- 应用层 decrement 逻辑出现 Bug（双重删除、重复调用）
- 与 Issue 1、Issue 2 并发竞态同时发生

### 修复建议

```sql
-- 在 migration 中为各计数器列添加 CHECK 约束
ALTER TABLE posts ADD CONSTRAINT chk_posts_reply_count    CHECK (reply_count    >= 0);
ALTER TABLE posts ADD CONSTRAINT chk_posts_like_count     CHECK (like_count     >= 0);
ALTER TABLE posts ADD CONSTRAINT chk_posts_favorite_count CHECK (favorite_count >= 0);
ALTER TABLE posts ADD CONSTRAINT chk_posts_share_count    CHECK (share_count    >= 0);
ALTER TABLE replies ADD CONSTRAINT chk_replies_like_count  CHECK (like_count  >= 0);
ALTER TABLE replies ADD CONSTRAINT chk_replies_child_count CHECK (child_count >= 0);
ALTER TABLE bars    ADD CONSTRAINT chk_bars_member_count   CHECK (member_count >= 0);
```

---

<a name="issue-4"></a>
## Issue 4 — P1：user_likes / admin_actions 多态关联缺失外键约束

### 位置
- `backend/migrations/003_phase3_interactions.sql`（user_likes 表）
- `backend/migrations/002_phase2_bars_admin.sql`（admin_actions 表）

### 问题描述

**user_likes 表**的 `target_id` 列是 UUID 类型，但没有指向任何具体表的外键约束：

```sql
CREATE TABLE user_likes (
  target_type VARCHAR(20) NOT NULL,   -- 'post' 或 'reply'
  target_id   UUID        NOT NULL,   -- ❌ 无 FK 约束
  ...
);
```

**admin_actions 表**的 `target_id` 同样如此：

```sql
CREATE TABLE admin_actions (
  target_type VARCHAR(20) NOT NULL,
  target_id   UUID        NOT NULL,  -- ❌ 无 FK 约束
  ...
);
```

这意味着：
1. 可以向 `user_likes` 插入引用不存在帖子/回复的 `target_id`，数据库不会拒绝。
2. 当 post/reply 被**物理删除**时（虽然目前是软删除，但将来可能清理数据），对应的 `user_likes` 记录**不会级联删除**，形成悬挂引用。
3. 目前系统依赖软删除（`deleted_at` 标记）避免悬挂引用，一旦引入硬删除或数据归档，孤儿 likes 记录会积累。

### 影响范围

- `user_likes` 表：数据可能包含孤儿点赞记录
- `admin_actions` 表：审计日志 target_id 可能指向已不存在的实体
- `admin.service.ts` 的 `findAllActions()` 已通过 `barNameMap` 兜底处理 null，暂时没有崩溃风险，但数据质量降低

### 触发条件

- 向 `user_likes` 插入无效 `target_id`（应用层 Bug）
- 未来引入 posts/replies 硬删除或数据归档清理

### 修复建议

对多态关联，推荐将**单表**拆分为**具体表**，彻底解决引用完整性问题：

```sql
-- 方案 A：单独的点赞表（推荐）
CREATE TABLE post_likes  (user_id UUID REFERENCES users(id), post_id  UUID REFERENCES posts(id),   PRIMARY KEY (user_id, post_id));
CREATE TABLE reply_likes (user_id UUID REFERENCES users(id), reply_id UUID REFERENCES replies(id), PRIMARY KEY (user_id, reply_id));

-- 方案 B：保留多态表，在应用层严格验证 target_type + target_id 的存在性（已有雏形，需加固）
```

---

<a name="issue-5"></a>
## Issue 5 — P1：删帖时未清零子回复的 child_count

### 位置
`backend/src/modules/posts/posts.service.ts` `deletePost()` 方法（第 209–223 行）

### 问题描述

删除帖子时，事务内批量软删除所有回复：

```typescript
await manager
  .createQueryBuilder()
  .update(Reply)
  .set({ deletedAt: now, status: 'deleted' })
  .where('post_id = :postId AND deleted_at IS NULL', { postId })
  .execute();
```

但**没有**同步清零这些父回复的 `child_count` 字段。被软删除的主回复其 `child_count` 仍保留原值。

虽然当前没有对已删除帖子的回复提供"恢复"功能，但：
1. 如果未来引入数据恢复（撤销软删除），子回复计数将与实际不符。
2. 定期统计或数据导出时，已删除帖子的回复数据存在统计误差。
3. 同一个删帖事务中对主回复的 `child_count` 产生不一致，违背"事务完成后数据一致"的原则。

类似地，`deleteReply()` 在级联删除子回复时也未更新 `replies.like_count`，但因为计数未暴露给任何读取路径，影响较小。

### 影响范围

- `DELETE /api/posts/:postId`
- 帖子下父回复的 `child_count` 在软删除后仍为旧值

### 触发条件

删除任意含有子回复的帖子时。

### 修复建议

在 `deletePost` 事务中增加重置步骤：

```typescript
// 将被删除帖子的所有主回复的 child_count 重置为 0
await manager
  .createQueryBuilder()
  .update(Reply)
  .set({ childCount: 0 })
  .where('post_id = :postId AND parent_reply_id IS NULL', { postId })
  .execute();
```

---

<a name="issue-6"></a>
## Issue 6 — P1：每次 GET /bars 都执行全表 UPDATE，高并发下产生锁争用

### 位置
- `backend/src/modules/bars/bars.service.ts` `findAll()` 方法（第 57–63 行）
- `backend/src/modules/users/users.service.ts` `findMyBars()`（第 155–164 行）、`findMyCreatedBars()`（第 213–218 行）

### 问题描述

每次调用 `GET /api/bars` 时，都会先执行一条针对全部 `suspended` 状态 bar 的 UPDATE：

```typescript
await this.barsRepository
  .createQueryBuilder()
  .update(Bar)
  .set({ status: 'active', suspendUntil: null, statusReason: null })
  .where("status = 'suspended' AND suspend_until <= NOW()")
  .execute();
```

这意味着：
1. **每个读请求都会产生写操作**，读写分离/只读副本无法承载该接口。
2. 该 UPDATE 需要对匹配行加排他锁，高并发时多个并发 GET 请求都在尝试同时 UPDATE 同一批行，造成**锁等待/死锁**风险。
3. 即使没有到期 bar，PostgreSQL 也必须完成索引扫描和行版本检查。
4. `findMyBars()` 和 `findMyCreatedBars()` 各有类似逻辑，进一步加剧写放大。

### 影响范围

- `GET /api/bars`（公共 bar 列表，无需登录即可访问，是最高频接口之一）
- `GET /api/users/me/bars`
- `GET /api/users/me/created-bars`

### 触发条件

任意访问上述接口时，尤其在存在大量 `suspended` 状态 bar 的情况下。

### 修复建议

推荐将"懒解封"改为**定时任务（Cron Job）**：

```typescript
// @nestjs/schedule 定时任务，每分钟执行一次
@Cron(CronExpression.EVERY_MINUTE)
async unsuspendExpiredBars() {
  await this.barsRepository
    .createQueryBuilder()
    .update(Bar)
    .set({ status: 'active', suspendUntil: null, statusReason: null })
    .where("status = 'suspended' AND suspend_until <= NOW()")
    .execute();
}
```

读接口只做查询，不夹带写操作，从而支持读写分离并消除锁争用。

---

<a name="issue-7"></a>
## Issue 7 — P2：floor_number 索引非 UNIQUE，无法阻止重复楼层

### 位置
`backend/migrations/001_initial_schema.sql`（第 82 行）

### 问题描述

```sql
CREATE INDEX IF NOT EXISTS idx_replies_post_id_floor_number ON replies (post_id, floor_number);
```

这是一个**普通索引**而非唯一索引。与 Issue 1 联动：即使在应用层引入了更安全的楼层号分配策略，数据库也应作为**最后防线**保证唯一性。

同时，`floor_number` 允许 NULL（`003_phase3_interactions.sql` 中执行了 `ALTER TABLE replies ALTER COLUMN floor_number DROP NOT NULL`），NULL 值需要在唯一约束中特殊处理（PostgreSQL 对 NULL 的唯一约束默认允许多个 NULL，即子回复的 NULL floor_number 不会触发唯一冲突）。

### 影响范围

- 主回复可能产生重复楼层号
- 楼层号在排序展示时出现歧义

### 修复建议

```sql
-- 仅对主回复（parent_reply_id IS NULL）施加唯一约束
CREATE UNIQUE INDEX uidx_replies_post_floor
  ON replies (post_id, floor_number)
  WHERE parent_reply_id IS NULL AND floor_number IS NOT NULL;
```

---

<a name="issue-8"></a>
## Issue 8 — P2：status 与 deleted_at 双重删除标记冗余，缺少一致性约束

### 位置
- `backend/migrations/001_initial_schema.sql`（posts 表、replies 表）
- `backend/src/modules/posts/posts.service.ts`（`findOne` 第 102 行，`deletePost` 第 217–220 行）
- `backend/src/modules/replies/replies.service.ts`（`deleteReply` 第 366–369 行）

### 问题描述

系统同时维护两个"删除"标记：

| 字段 | 类型 | 用途 |
|------|------|------|
| `status` | `VARCHAR(20)` CHECK | 软删除标记之一，`status = 'deleted'` |
| `deleted_at` | `TIMESTAMPTZ` | 软删除时间戳 |

业务层删除时两者均被设置：

```typescript
await manager.update(Post, postId, { deletedAt: now, status: 'deleted' });
```

但**数据库层面没有约束**保证两者始终同步。理论上可能出现：
- `deleted_at IS NOT NULL` 但 `status != 'deleted'`（已删除但状态不对）
- `status = 'deleted'` 但 `deleted_at IS NULL`（状态标记为删除但无时间戳）

不同的业务逻辑路径检查条件不一致也加剧了此问题：

```typescript
// posts.service.ts findOne — 同时检查两个字段
if (post.deletedAt || post.status === 'deleted') { ... }

// posts.service.ts findAll — 只检查 status 和 deletedAt 的独立条件
.where('post.status = :status', { status: 'published' })
.andWhere('post.deletedAt IS NULL')
```

若某帖子 `status='deleted'` 但 `deleted_at IS NULL`，`findAll` 会通过 `deleted_at IS NULL` 的过滤，再被 `status='published'` 过滤掉——这是偶然正确，并非有意为之。

### 影响范围

- 所有读取 posts/replies 的接口
- 数据一致性依赖于应用层每次都正确地同步设置两个字段

### 触发条件

- 将来的代码变更中，某处只更新了 `deleted_at` 而忘记同步 `status`（或反之）

### 修复建议

**方案 A**：保留双标记，添加数据库约束确保一致性：

```sql
ALTER TABLE posts ADD CONSTRAINT chk_posts_delete_consistency
  CHECK (
    (deleted_at IS NULL AND status != 'deleted') OR
    (deleted_at IS NOT NULL AND status = 'deleted')
  );
```

**方案 B（推荐）**：只保留 `deleted_at`（时间戳更信息量更大），`status` 中去掉 `'deleted'` 枚举值，仅用于内容审核状态（`published`/`hidden`/`under_review`）。

---

<a name="issue-9"></a>
## Issue 9 — P2：全局帖子列表缺少覆盖索引

### 位置
`backend/src/modules/posts/posts.service.ts` `findAll()` 方法（第 50–92 行）  
`backend/migrations/001_initial_schema.sql`（第 81 行）

### 问题描述

全局帖子列表查询（无 `barId` 过滤）：

```sql
SELECT ... FROM posts
WHERE status = 'published' AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 21;
```

现有索引：

```sql
idx_posts_bar_id_created_at ON posts (bar_id, created_at)
```

该索引以 `bar_id` 作为前缀列。不带 `bar_id` 条件的查询**无法使用**此索引有效过滤，PostgreSQL 将执行**全表扫描**（Seq Scan）后再过滤 `status` 和 `deleted_at`，然后排序。

在帖子量较大时，全表扫描会造成显著的查询延迟。

### 影响范围

- `GET /api/posts`（全局帖子列表，无 barId 参数时）
- 随数据量增长，查询性能线性退化

### 触发条件

前端首页、探索页等无 barId 上下文时调用 `GET /api/posts`。

### 修复建议

```sql
-- 添加覆盖索引，支持全局帖子列表
CREATE INDEX idx_posts_status_deleted_created
  ON posts (status, deleted_at, created_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;
-- 或不使用部分索引（更通用）
CREATE INDEX idx_posts_status_created
  ON posts (status, created_at DESC)
  WHERE deleted_at IS NULL;
```

---

<a name="issue-10"></a>
## Issue 10 — P2：自动解封查询缺少 (status, suspend_until) 专用索引

### 位置
`backend/migrations/002_phase2_bars_admin.sql`（第 54–55 行）

### 问题描述

自动解封 UPDATE 查询条件为：

```sql
WHERE status = 'suspended' AND suspend_until <= NOW()
```

现有索引：

```sql
idx_bars_status_member_count ON bars (status, member_count DESC, created_at DESC)
```

该索引可以通过 `status = 'suspended'` 缩小扫描范围，但对 `suspend_until <= NOW()` 没有索引支持，PostgreSQL 需要对所有 `suspended` 状态的 bar 行逐一评估 `suspend_until` 条件。当 suspended bar 数量较多时效率较低。

### 影响范围

- `bars.service.ts` `findAll()` 中执行的自动解封 UPDATE
- `users.service.ts` `findMyBars()`、`findMyCreatedBars()` 中的同类 UPDATE

### 触发条件

存在大量 `status = 'suspended'` 的 bar 行时（例如批量封禁场景）。

### 修复建议

```sql
CREATE INDEX idx_bars_suspended_until
  ON bars (suspend_until)
  WHERE status = 'suspended';
```

---

<a name="issue-11"></a>
## Issue 11 — P2：游标分页仅用时间戳，翻页时存在数据丢失/重复

### 位置
全部分页查询，包括：
- `posts.service.ts` `findAll()`（第 71 行）
- `users.service.ts` `findMyPosts()`（第 72 行）
- `bars.service.ts` `findAll()` 的游标部分（第 76–83 行，此处已用复合游标，但 `bars.findOne` 中 members 游标仍是时间戳）
- `bars.service.ts` `getMembers()`（第 388 行）
- `users.service.ts` `findMyFavorites()`（第 277 行）

### 问题描述

绝大多数游标分页以 ISO 8601 时间戳作为唯一游标：

```typescript
// 游标解码后查询
qb.andWhere('post.createdAt < :ca', { ca: decodedDate });
```

PostgreSQL 的 `TIMESTAMPTZ` 精度为微秒（1μs），在高并发写入时，同一微秒内产生多条记录的概率不为零（尤其在批量导入或时钟精度不足的场景下）。更重要的是：

- 若某页最后一条记录的 `created_at` 与下一页第一条记录完全相同（时间戳碰撞），**后者将被跳过**（`<` 严格小于，等于时间戳的记录不被包含）。
- 在批量导入或测试数据中此问题更为明显。

已有的 `bars.findAll()` 对此场景做了正确处理（使用 `(memberCount, createdAt)` 复合游标），但其他接口未遵循同样策略。

### 影响范围

- 所有使用单时间戳游标的分页接口
- 时间戳碰撞时，用户翻页可能漏掉内容

### 修复建议

所有游标改为 `(created_at, id)` 复合游标，利用 `id`（UUID）的全局唯一性作为决胜键：

```sql
WHERE (created_at < :ca) OR (created_at = :ca AND id < :id)
ORDER BY created_at DESC, id DESC
```

---

<a name="issue-12"></a>
## Issue 12 — P3：incrementReplyCount / decrementReplyCount 为非事务性死代码

### 位置
`backend/src/modules/posts/posts.service.ts`（第 287–294 行）

### 问题描述

```typescript
async incrementReplyCount(postId: string, replyAt: Date): Promise<void> {
  await this.postsRepository.increment({ id: postId }, 'replyCount', 1);
  await this.postsRepository.update(postId, { lastReplyAt: replyAt });
}

async decrementReplyCount(postId: string): Promise<void> {
  await this.postsRepository.decrement({ id: postId }, 'replyCount', 1);
}
```

这两个 public 方法在整个代码库中**没有被任何地方调用**（回复计数管理已在 `replies.service.ts` 的事务内通过 `manager.increment()` 直接处理）。

但更关键的是：这两个方法执行了**两条独立的非事务 SQL**（`increment` 和 `update`），如果被调用，会产生：
- `replyCount` 递增后，`lastReplyAt` 更新前发生崩溃，导致数据不一致。
- 这两个 SQL 之间没有事务保护，其他并发事务可以读到中间状态。

### 影响范围

- 当前无实际影响（死代码未被调用）
- 若将来被误调用，会引入数据一致性问题

### 修复建议

删除这两个公共方法，或将其重构为事务版本（实际逻辑已正确实现在 `replies.service.ts` 内）。

---

<a name="issue-13"></a>
## Issue 13 — P3：autoUnsuspendIfExpired 存在 TOCTOU 竞态

### 位置
`backend/src/modules/bars/bars.service.ts` `autoUnsuspendIfExpired()` 方法（第 32–47 行）

### 问题描述

```typescript
async autoUnsuspendIfExpired(barId: string): Promise<Bar | null> {
  const bar = await this.barsRepository.findOne({ where: { id: barId } });  // 1. 读
  if (bar.status === 'suspended' && bar.suspendUntil && bar.suspendUntil <= new Date()) {
    bar.status = 'active';                                                   // 2. 修改内存对象
    await this.barsRepository.save(bar);                                     // 3. 写（UPDATE）
  }
  return bar;
}
```

步骤 1 的读取（SELECT）与步骤 3 的写入（UPDATE）之间没有加行级锁，在并发场景下：
1. 请求 A 读到 `status='suspended'`，`suspendUntil` 已过期。
2. 请求 B 同样读到 `status='suspended'`，也判断需要解封。
3. 请求 A 执行 `save()` → UPDATE 成功。
4. 请求 B 执行 `save()` → 对同一行再次 UPDATE（幂等，但执行了不必要的写）。

在 TypeORM 默认不使用乐观锁的情况下，重复 UPDATE 是幂等的（写入相同值），所以不会产生错误数据。但它会产生：
- 不必要的写操作和锁竞争
- `updated_at` 时间戳被不必要地刷新
- 与推荐的"每次读请求触发写"反模式一致（详见 Issue 6）

### 影响范围

- `bars.service.ts` 所有调用 `autoUnsuspendIfExpired` 的路径
- `admin.service.ts` 的 `getBarWithLazyEval()`

### 触发条件

同一 bar 同时有 ≥ 2 个并发请求触达时（例如 bar 详情页高并发访问）。

### 修复建议

使用原子 UPDATE-then-SELECT 模式替代 read-modify-write：

```sql
-- 单条原子语句替代三步操作
UPDATE bars
SET status = 'active', suspend_until = NULL, status_reason = NULL
WHERE id = :barId
  AND status = 'suspended'
  AND suspend_until <= NOW()
RETURNING *;
```

---

<a name="issue-14"></a>
## Issue 14 — P3：findByIds 已弃用（TypeORM 0.3）

### 位置
`backend/src/modules/admin/admin.service.ts` `findAllActions()` 方法（第 311 行）

### 问题描述

```typescript
const bars = barIds.length > 0
  ? await this.barsRepository.findByIds(barIds)   // ❌ TypeORM 0.3 已标记 @deprecated
  : [];
```

TypeORM 0.3 中 `findByIds()` 已被弃用，推荐替换为 `findBy({ id: In(ids) })`。在未来版本升级中该方法可能被移除。

### 影响范围

- `GET /api/admin/actions`（管理员操作历史列表）

### 触发条件

TypeORM 升级到未来移除 `findByIds` 的版本时，该接口将运行时报错。

### 修复建议

```typescript
import { In } from 'typeorm';

const bars = barIds.length > 0
  ? await this.barsRepository.findBy({ id: In(barIds) })
  : [];
```

---

<a name="appendix"></a>
## 附录：问题快速索引

| # | 优先级 | 问题描述 | 涉及表 | 涉及接口 |
|---|--------|----------|--------|----------|
| 1 | **P0** | floor_number MAX+1 并发竞争，重复楼层 | replies | POST /posts/:id/replies |
| 2 | **P0** | 点赞/收藏存在性检查事务外，并发产生 500 | user_likes, user_favorites | POST /posts/:id/like(fav), /replies/:id/like |
| 3 | **P1** | 计数器无 CHECK >= 0，可被减至负值 | posts, replies, bars | 所有写接口 |
| 4 | **P1** | user_likes/admin_actions 无 FK，悬挂引用 | user_likes, admin_actions | — |
| 5 | **P1** | 删帖未重置子回复 child_count | replies | DELETE /posts/:id |
| 6 | **P1** | GET /bars 触发全表 UPDATE，写放大 + 锁争用 | bars | GET /bars, /me/bars, /me/created-bars |
| 7 | **P2** | floor_number 索引非 UNIQUE，无法防重复 | replies | POST /posts/:id/replies |
| 8 | **P2** | status + deleted_at 双删除标记缺一致性约束 | posts, replies | 所有读/写帖子/回复接口 |
| 9 | **P2** | 全局帖子列表无覆盖索引，全表扫描 | posts | GET /posts（无 barId） |
| 10 | **P2** | 自动解封缺少 (status, suspend_until) 索引 | bars | GET /bars（自动解封路径） |
| 11 | **P2** | 游标分页仅用时间戳，翻页数据可能丢失 | posts, replies, bar_members, user_favorites | 所有分页接口 |
| 12 | **P3** | incrementReplyCount 死代码且非事务性 | posts | — |
| 13 | **P3** | autoUnsuspendIfExpired TOCTOU 竞态 | bars | GET /bars/:id, /bars/:id/join 等 |
| 14 | **P3** | findByIds 已弃用 | bars | GET /admin/actions |

### 优先级说明

| 级别 | 含义 |
|------|------|
| **P0** | 高概率在生产环境触发、导致数据错误或 500 错误，需立即修复 |
| **P1** | 中等概率触发或低概率但影响严重，需在下个迭代修复 |
| **P2** | 潜在性能/一致性隐患，随数据量增长影响扩大，建议近期排期 |
| **P3** | 代码质量/技术债务，在重构或版本升级前修复即可 |
