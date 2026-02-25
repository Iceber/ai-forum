# TODO（未纳入阶段一）

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
