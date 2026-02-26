# Copilot 代码生成规范（Code Generation Standards）

> 本文档是 ai-forum 项目的 **代码生成约束规范**，用于指导 GitHub Copilot Agent 及所有开发者在本项目中编写一致、健壮、可维护的代码。

---

## 1. 技术栈约束

| 层级       | 技术选型                                       |
|------------|------------------------------------------------|
| 前端框架   | Next.js 14+（React 18 + TypeScript 5.3+）      |
| 状态管理   | Zustand                                        |
| 数据请求   | @tanstack/react-query + Axios                  |
| 样式       | Tailwind CSS                                   |
| 后端框架   | NestJS 10+（TypeScript + Node.js）              |
| ORM        | TypeORM 0.3                                    |
| 数据库     | PostgreSQL 15+                                 |
| 认证       | JWT（@nestjs/jwt + Passport）                   |
| 测试框架   | Jest + supertest（后端）；Jest + Testing Library（前端） |

- 不得随意引入新框架或替换现有技术选型。如必须引入新依赖，需在 PR 描述中说明理由。

---

## 2. 测试要求

### 2.1 每个功能必须包含测试

- **后端**：每个 Service 方法必须有对应的单元测试（`*.spec.ts`）；每个用户可见的 API 端点必须有 E2E 测试覆盖。
- **前端**：每个业务组件必须有对应的单元测试（`*.test.tsx`）；关键用户流程必须有 E2E 测试覆盖。
- **禁止**提交无测试的功能代码。

### 2.2 单元测试规范

```
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should <expected behavior> when <condition>', () => {
      // Arrange — 准备数据和 mock
      // Act    — 调用被测方法
      // Assert — 断言结果
    });
  });
});
```

- 使用 `@nestjs/testing` 的 `Test.createTestingModule` 构建测试模块。
- 所有外部依赖（Repository、第三方服务）必须通过 mock 注入，禁止在单元测试中连接真实数据库。
- 使用 `jest.fn()` / `jest.spyOn()` 进行 mock，mock 数据需具备真实业务语义。
- 测试用例命名使用 `should ... when ...` 格式，清晰表达预期行为和触发条件。
- 必须覆盖：正常路径、边界条件、异常/错误路径。

### 2.3 E2E 测试规范

- 使用 `supertest` 对完整 HTTP 请求链路进行测试。
- 测试应模拟真实用户操作链路（如：注册 → 登录 → 创建资源 → 查询验证）。
- E2E 测试中需初始化全局 Pipe、Interceptor、Filter，与生产环境保持一致。
- 测试数据库使用独立实例，测试结束后清理数据。
- 使用 RFC 4122 v4 格式的 UUID 作为测试种子数据的 ID（如 `00000000-0000-4000-a000-000000000001`）。

### 2.4 测试覆盖率要求

- 新增代码的单元测试行覆盖率不低于 **80%**。
- 核心业务逻辑（认证、权限、支付等）覆盖率不低于 **90%**。
- CI 流水线中测试失败则禁止合并。

---

## 3. 代码注释规范

### 3.1 基本原则

- **解释"为什么"，而非"是什么"**。代码本身应具备自解释性，注释用于补充意图和决策背景。
- **禁止冗余注释**：不要对显而易见的代码添加注释（如 `// 返回结果` → `return result`）。
- **保持注释与代码同步**：修改代码时必须同步更新相关注释，过时的注释比没有注释更有害。

### 3.2 必须添加注释的场景

| 场景                         | 示例                                           |
|------------------------------|------------------------------------------------|
| 复杂业务规则或算法            | `// 楼层号使用自增序列以保证在高并发下的连续性`    |
| 非显而易见的设计决策          | `// 使用游标分页而非 offset，避免深分页性能退化`   |
| 临时方案或技术债务            | `// TODO(#issue-id): 暂用同步调用，后续迁移至消息队列` |
| 对外部系统/协议的依赖说明     | `// JWT payload 结构需与前端 AuthContext 保持一致` |
| 正则表达式或位运算等不直观语法 | `// 匹配 UUID v4 格式：8-4-4-4-12 hex digits`   |

### 3.3 注释格式

- 行内注释使用 `//`，与代码间隔至少一个空格。
- 文件级别说明使用 `/** ... */` 块注释，置于文件顶部。
- TODO 注释格式：`// TODO(#issue-id): 描述` — 必须关联 Issue 编号。
- 禁止使用 `FIXME` 或 `HACK` 等无追踪信息的标记。

---

## 4. 日志规范

### 4.1 基本原则

- 使用 NestJS 内置 `Logger` 类，禁止使用 `console.log` / `console.error`。
- 每个 Service/Controller 创建命名日志实例：`private readonly logger = new Logger(ClassName.name);`。
- 日志内容必须包含足够的上下文信息以支持问题排查，但禁止记录敏感数据。

### 4.2 日志级别使用规范

| 级别    | 场景                                                     |
|---------|----------------------------------------------------------|
| `error` | 不可恢复的异常；需要人工介入的错误（如数据库连接失败）        |
| `warn`  | 可恢复但异常的情况（如接口降级、数据不一致但已兜底）          |
| `log`   | 关键业务事件（如用户注册、帖子创建、权限变更）               |
| `debug` | 开发调试信息（如 SQL 查询参数、中间计算结果）                |
| `verbose` | 详细追踪信息（如请求/响应完整体、循环迭代细节）            |

### 4.3 日志内容要求

```typescript
// ✅ 好的日志 — 包含上下文和关键标识
this.logger.log(`Post created: postId=${post.id}, barId=${barId}, authorId=${userId}`);
this.logger.error(`Failed to create post: barId=${barId}, error=${error.message}`, error.stack);

// ❌ 差的日志 — 缺乏上下文
this.logger.log('Post created');
this.logger.error('Error');
```

### 4.4 禁止记录的信息

- 用户密码、密码哈希值
- JWT Token 完整内容
- 身份证号、银行卡号等个人敏感信息
- 请求/响应中的 Authorization 头

---

## 5. 错误处理规范

### 5.1 异常类型

- 统一使用 NestJS 内置 HTTP 异常类：`NotFoundException`、`ConflictException`、`UnauthorizedException`、`ForbiddenException`、`BadRequestException`。
- 异常消息使用英文，面向开发者可读。前端展示文案由前端国际化层处理。
- 禁止抛出原生 `Error`，必须映射为对应的 HTTP 异常。

### 5.2 全局异常处理

- 项目已配置 `HttpExceptionFilter` 全局异常过滤器，所有异常统一格式化为：
  ```json
  { "data": null, "meta": null, "error": { "code": "ERROR_CODE", "message": "..." } }
  ```
- 新增模块无需重复实现异常格式化逻辑。

### 5.3 异常处理原则

- **快速失败**：参数验证在入口处完成（DTO + ValidationPipe），不将无效数据传入业务层。
- **精确异常**：针对不同错误场景抛出语义准确的异常类型，禁止统一使用 `BadRequestException`。
- **异常日志**：`error` 级别的异常必须记录完整错误堆栈；`warn` 级别记录错误消息即可。

---

## 6. API 设计规范

### 6.1 RESTful 约定

- 资源名使用复数小写：`/bars`、`/posts`、`/replies`。
- 嵌套资源路径表达从属关系：`/bars/:barId/posts`、`/posts/:postId/replies`。
- HTTP 方法语义：`GET` 查询、`POST` 创建、`PATCH` 部分更新、`DELETE` 删除。
- 状态码语义：`200` 成功、`201` 创建成功、`400` 参数错误、`401` 未认证、`403` 无权限、`404` 未找到、`409` 冲突。

### 6.2 响应格式

所有 API 统一返回信封格式（由 `ResponseInterceptor` 全局处理）：

```json
{
  "data": {},
  "meta": { "cursor": "string | null", "hasMore": true },
  "error": null
}
```

- 列表接口必须返回分页元信息。
- 单一资源接口 `meta` 可为 `null`。

### 6.3 分页策略

- 统一使用**游标分页**（Cursor-based Pagination），禁止使用 offset 分页。
- 游标值使用 Base64 编码。
- 每页默认 20 条，服务端上限 100 条。

### 6.4 输入验证

- 所有请求参数通过 DTO + `class-validator` 装饰器进行验证。
- DTO 文件放置在 `modules/{feature}/dto/` 目录下。
- DTO 命名格式：`{Action}{Entity}Dto`（如 `CreatePostDto`、`UpdateBarDto`）。

---

## 7. 数据库与 ORM 规范

### 7.1 Entity 定义

- 主键统一使用 UUID v4（`@PrimaryGeneratedColumn('uuid')`）。
- 数据库列名使用 `snake_case`，TypeScript 属性使用 `camelCase`。
- 所有表必须包含 `created_at` 和 `updated_at` 时间戳字段（`timestamptz` 类型）。
- 支持软删除的表需包含 `deleted_at` 字段。
- 外键列名显式声明（如 `author_id`、`bar_id`），并通过 `@JoinColumn` 指定。

### 7.2 查询规范

- 禁止在 Service 层拼接原始 SQL，统一使用 TypeORM 的 Repository API 或 QueryBuilder。
- 查询必须考虑索引命中，新增查询模式时需评估索引策略。
- 列表查询必须限制返回条数（`take` 参数），禁止无限制全表查询。

### 7.3 迁移管理

- 数据库结构变更必须通过 TypeORM 迁移文件管理（`synchronize: false`）。
- 迁移文件禁止手动修改已执行过的迁移。
- 每次结构变更生成独立的迁移文件，命名包含时间戳和变更摘要。

---

## 8. 安全规范

### 8.1 认证与授权

- 所有需要身份验证的接口必须使用 `@UseGuards(JwtAuthGuard)`。
- 使用 `@CurrentUser()` 装饰器获取当前用户，禁止从 `request` 对象直接取值。
- 资源操作必须验证所有权或角色权限，禁止仅凭资源 ID 即可操作。

### 8.2 输入安全

- 所有用户输入必须经过 `class-validator` 验证，禁止信任未验证的输入。
- 字符串字段必须设置合理的 `@MaxLength` 限制以防止滥用。
- 文件上传需校验文件类型、大小，使用预签名 URL 直传以避免服务端文件处理风险。

### 8.3 数据保护

- 密码存储使用 `bcrypt` 加盐哈希，禁止明文或可逆加密存储。
- API 响应中禁止返回 `passwordHash`、`tokenVersion` 等敏感字段。
- 使用 TypeORM 的 `select` 或 Entity `@Exclude` 控制字段输出。

---

## 9. 代码组织与架构规范

### 9.1 模块结构

```
backend/src/modules/{feature}/
├── {feature}.module.ts       # 模块定义
├── {feature}.controller.ts   # 路由层（薄层，不含业务逻辑）
├── {feature}.service.ts      # 业务逻辑层
├── {feature}.service.spec.ts # 单元测试
├── dto/                      # 请求验证对象
│   ├── create-{feature}.dto.ts
│   └── update-{feature}.dto.ts
└── entities/                 # 数据库实体
    └── {feature}.entity.ts
```

### 9.2 职责分离

- **Controller**：仅负责路由映射、参数提取、调用 Service，禁止包含业务逻辑。
- **Service**：封装业务逻辑和数据库操作，是可测试的核心层。
- **Entity**：仅描述数据库表结构和关系映射，不包含业务方法。
- **DTO**：仅用于请求参数验证和类型定义。

### 9.3 依赖注入

- 通过 NestJS 的 DI 容器管理依赖，禁止手动实例化 Service。
- Repository 通过 `@InjectRepository(Entity)` 注入。
- 跨模块依赖通过模块 `exports` 暴露，禁止绕过模块边界直接引用。

---

## 10. 前端开发规范

### 10.1 组件设计

- 组件文件使用 PascalCase 命名，放置在功能对应的目录下。
- 优先使用函数式组件 + Hooks，禁止使用 Class Component。
- 复杂状态逻辑抽取为自定义 Hook（`use{Feature}.ts`）。
- 展示组件与容器组件分离；展示组件通过 props 接收数据，不直接访问全局状态。

### 10.2 状态管理

- 全局状态使用 Zustand store，按功能域拆分（如 `useAuthStore`、`usePostStore`）。
- 服务端数据使用 `@tanstack/react-query` 管理，禁止将服务端数据同步到 Zustand。
- 组件内部状态使用 `useState` / `useReducer`，优先选择最局部的状态方案。

### 10.3 样式规范

- 使用 Tailwind CSS 工具类，避免自定义 CSS 文件。
- 复用样式通过组件封装而非 CSS 类继承。
- 响应式设计遵循移动优先原则，使用 Tailwind 的响应式前缀（`sm:`、`md:`、`lg:`）。

### 10.4 数据请求

- API 调用统一封装在 `api/` 或 `services/` 目录下，组件不直接调用 `axios`。
- 使用 `@tanstack/react-query` 的 `useQuery` / `useMutation` 管理请求生命周期。
- 错误状态和加载状态必须在 UI 中体现，禁止忽略异常直接渲染空内容。

---

## 11. 命名规范

| 类别              | 风格              | 示例                              |
|-------------------|-------------------|-----------------------------------|
| TypeScript 变量   | camelCase         | `postCount`、`currentUser`         |
| TypeScript 类     | PascalCase        | `PostsService`、`CreatePostDto`    |
| TypeScript 接口   | PascalCase（不加 I 前缀）  | `User`、`PaginatedResponse`        |
| 数据库表名        | snake_case 复数    | `users`、`bar_members`、`posts`    |
| 数据库列名        | snake_case         | `created_at`、`author_id`          |
| API 路径          | kebab-case 复数    | `/bars`、`/bar-members`            |
| 环境变量          | UPPER_SNAKE_CASE   | `DATABASE_URL`、`JWT_SECRET`       |
| 文件名（后端）    | kebab-case         | `create-post.dto.ts`、`posts.service.ts` |
| 文件名（前端组件）| PascalCase         | `PostCard.tsx`、`BarList.tsx`      |
| 测试文件          | 与源文件同名 + `.spec.ts` / `.test.tsx` | `posts.service.spec.ts` |

---

## 12. Git 与 PR 规范

### 12.1 Commit 消息

- 格式：`<type>(<scope>): <description>`
- type：`feat`、`fix`、`refactor`、`test`、`docs`、`chore`、`ci`
- scope：模块名或影响范围（如 `auth`、`posts`、`frontend`）
- 示例：`feat(posts): add cursor-based pagination for post listing`

### 12.2 PR 要求

- 每个 PR 聚焦单一功能或修复，避免大范围混合变更。
- PR 描述需包含：变更目的、实现思路、测试验证方式。
- 新功能 PR 必须包含对应的测试代码。
- CI 流水线（lint + 单元测试 + E2E 测试 + 构建）全部通过后方可合并。

---

## 13. 性能与可观测性

### 13.1 性能要求

- 列表查询响应时间不超过 200ms（常规数据量）。
- 数据库查询必须有合适的索引支持，新增查询需在 PR 中说明索引策略。
- 避免 N+1 查询，关联数据使用 `leftJoinAndSelect` 或批量查询。

### 13.2 可观测性

- 关键业务操作必须有日志记录（参见第 4 节）。
- 异常必须有完整的错误堆栈记录。
- 为后续接入 APM / Tracing 预留结构，Service 方法保持清晰的调用边界。

---

## 14. 代码质量检查清单

每次提交代码前，确认以下事项：

- [ ] 新增功能包含单元测试和 E2E 测试
- [ ] 测试覆盖正常路径、边界条件和异常路径
- [ ] 代码注释解释了"为什么"而非"是什么"
- [ ] 日志使用 NestJS Logger，包含充分的上下文信息
- [ ] 无敏感信息泄露（密码、Token、个人信息）
- [ ] API 遵循 RESTful 约定和统一响应格式
- [ ] 数据库变更有对应的迁移文件
- [ ] 输入参数经过 DTO 验证
- [ ] 资源操作有权限检查
- [ ] ESLint 和 Prettier 检查通过
- [ ] CI 流水线全部通过

---

## 15. 代码风格一致性与复用规范

### 15.1 代码风格一致性

- 同一模块内保持一致的命名、参数顺序、异常处理和返回风格，避免同类逻辑出现多种写法。
- 新增代码必须遵循项目既有分层和目录约定，优先与相邻模块风格保持一致，而非引入个人习惯写法。

### 15.2 公共函数和方法复用

- 出现可复用逻辑（如通用参数校验、分页组装、状态映射）时，优先抽取为公共函数/方法，避免重复实现。
- 复用应以“提升可读性和可维护性”为前提；禁止为复用而复用，避免过度抽象。

### 15.3 避免代码无脑堆叠

- 单个函数/方法应保持职责单一；当分支、嵌套或行数明显膨胀时，及时拆分为可命名的小函数。
- 禁止通过复制粘贴堆叠业务分支；复杂流程应通过清晰的结构化拆分（守卫子句、策略映射、辅助函数）降低维护成本。
