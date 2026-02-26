# TODO（未纳入当前阶段）

以下为本轮评审建议中，暂不纳入第一阶段实现基线的事项，作为后续迭代待办：

1. 接口限流基线落地（`@nestjs/throttler`）
   - 登录按 IP + email 限流
   - 发帖/回帖按 user_id 限流

2. 本地一键启动编排（`docker-compose.yml`）
   - postgres / backend / frontend 统一编排

3. 搜索能力路由预留与实现（`GET /api/search?q=&type=`）
   - 第一阶段可先 SQL LIKE，后续升级全文检索

4. 通知中心数据模型落地
   - `notifications(id, user_id, type, source_type, source_id, is_read, created_at)`

---

## 第二阶段暂不实现（后续迭代）

1. 通知与提醒能力
   - @用户提醒
   - 消息通知中心（`@我` / `回复我` / 系统通知）
   - 通知查询与已读管理接口

2. 搜索能力
   - `GET /api/search?q=&type=`（吧/帖子/用户）
   - 检索能力实现与升级路径（LIKE / 全文检索）

3. 平台工程与安全基线增强
   - 接口限流基线（登录按 IP+email，发帖/回帖按 user_id）
   - 本地一键启动编排完善（postgres / backend / frontend）
