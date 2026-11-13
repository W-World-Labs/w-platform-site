# W Platform Site（myfastools.com）

W 平台的 **双语静态生成站点与统一项目控制台**（React 19 + TanStack Router + Vite 8 + Tailwind 4）。
`https://myfastools.com/` 当前提供经 W-ID 登录保护的 fleet overview；HTML 与静态资源由共享登录门控保护。
仓库也包含主页、产品介绍、定价等营销页面的静态生成实现，以及每产品域名根路径门页的源文件；
这些营销页面的线上发布与 overview 是分开的，发布状态需按对应部署记录核实。页面内嵌的 W-Radar 访客分析
（`/platform/bootstrap.js`）为 enhancement-only，不阻塞渲染。

本公开仓保留双语站点、统一项目控制台、产品门页生成器和既有功能断言。原作者
zots0127、kanshan 与 W 项目贡献者保留署名；W 自有代码按 MIT 发布。
许可证和资产边界见 [PUBLIC_SOURCE.md](PUBLIC_SOURCE.md) 与 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

## 产品目录（catalog）——事实以 Radar 为权威

`src/data/products.ts` 是产品**文案**（tagline/features/长文，中文在
`products.zh.ts`）的源；但"有哪些产品、什么域名、什么状态"这些**平台事实**
以 W-Radar 注册表（`/api/platform/projects`）为权威：

- `scripts/radar-product-map.json` — 营销 slug → Radar project_id 的连接键
- `npm run test:catalog` — 构建期校验 products.ts 与 Radar 注册表不漂移
  （需要 `W_RADAR_API_KEY`；无 key 时降级为离线映射检查）
- `npm run export:products` — 输出规范 JSON，下游
  `product-landings/_products.json`（本仓库内）必须由它生成，禁止手工拷贝

## 常用命令

```bash
npm run dev          # 开发服务器
npm run build        # tsc + client + SSR 构建 + 预渲染（输出 dist/）
npm test             # contract / console UI / reference / routes / images / CTAs / i18n / catalog / Radar code 检查
npm run export:landings   # writes product-landings/_products.json
```

## 构建与接入

构建输出为静态目录，站点登录门控与各产品 API 由独立服务提供。保留的公开域名和
OAuth client ID 是原有集成契约，克隆源码不会获得对应服务或部署权限。新部署应由站点
owner 配置自己的域名、已注册 callback、同源 API 路由和 Radar 接入；本仓不自动部署。

所有图片只在 `product-landings/_images/` 保存一份，包含原始创作提示词和派生脚本。
`dev`、`test`、`build:client` 会准备忽略的 `public/_images/` 精确镜像，页面 URL 不变。
W-ID 浏览器 SDK 使用已通过实际消费 API 核对的原 PUBLIC CI npm 包，以 SHA512 锁定稳定公开 URL，不访问私有 npm。

## 统一控制台安全边界

`/console` 从 W-ID `/api/me/saas-context` 读取当前用户的 Workspace 成员关系，且前端会
再次按成员关系过滤项目；平台管理员角色本身不会生成或扩大客户项目列表。项目能力区按
W-DB 的 Auth / Database / Storage / Functions discovery 模型展示。一次性 publishable key
只保存在 React 内存中。Auth 用户列表使用当前 W-ID token；Database 与 Storage 在调用前，
必须以当前 token 精确 `POST /api/workspaces/{workspace}/projects/{project}/management-token`，
并严格校验返回 JWT 的 project audience 与不超过 5 分钟的 expiry。项目 management token
只作为下游请求的 bearer 存活于函数内存，绝不写入存储、日志或 URL；交换失败时不会调用
任何数据服务。所有响应继续经过 workspace/project identity 校验和字段白名单过滤，页面不会
展示 DSN、service-role、原始 secret 或 discovery 中的额外字段。

数据库数据行以可横向滚动的表格展示，列优先遵循 schema 顺序，并保留响应中的额外列。
单元格使用 JSON 表示保留字符串、数字、布尔、null 和嵌套数据的区别；缺失字段另行标识，
分页行号按页偏移连续显示。编辑、删除和当前页导出继续使用已加载的原始行与既有接口。
新增和编辑行可在 JSON 与按 schema 生成的字段表单之间切换，草稿保留原始类型。字段支持
文本、安全范围内的整数、布尔和 JSON，并明确区分省略、空字符串与 NULL；省略在新增时
使用默认值，在编辑时保持原值。自增、生成及身份绑定列在表单中只读，编辑初始化也会省略
它们。元数据不授予写权限，保存仍通过既有项目鉴权、RLS 和原始行快照冲突检查；无效值
不会提交，冲突保留当前草稿。JSON 模式可继续处理其他类型与额外字段。
默认浏览不请求总数；选择“Count visible rows / 统计可见行”并成功后，控制台才持续请求 W-DB
在同一 RLS 快照中精确统计可见行。本表后续翻页、刷新和行写入后的数据回读都会重新统计；
切换表会关闭统计。计数失败会保留已加载的数据行，并恢复无计数浏览；较旧 W-DB 若不支持此
可选能力，用户仍可继续浏览，之后可再次显式请求统计。

数据库表结构视图复用已加载的项目 schema 清单，按列顺序展示类型、可空性、默认值是否存在、
自增标识和生成列状态。只投影这些字段，不展示默认值 SQL 表达式或上游额外字段；切换表或
项目会清除旧表结构。此视图不新增请求或改变数据库 schema。

Realtime 支持向当前已授权私有频道发送自定义事件名和 JSON 对象。事件名最多 64 个
UTF-8 字节且不含空白，JSON 最多 8 KiB，并预留协议开销以遵守项目帧限制。
发送通过官方 SDK，重复点击只发送一次；ACK 缺失时保留草稿，不自动重试，并明确提示
是否送达未知。只统计当前测试事件名，展示最近收到的匹配事件名，不保留收到的消息内容。
断开或切换项目后的迟到 ACK 不更新新会话；项目、身份、权限或密钥切换清除自定义草稿。

Realtime 连接时自动加入 Presence；连接后可手动「离开 Presence / 加入 Presence」，无需断开私有频道，离开期间仍可发送广播和接收数据库变更。页面分别显示成员总数与此浏览器最近一次已确认的加入/离开状态，不展示 Presence 内容。Presence 与广播共用发送锁；缺少确认时自身成员状态显示未知，不根据总人数猜测，不自动重试。断开、重连或切换项目后丢弃旧操作回执。

Realtime 控制台可在连接前输入服务端订阅条件，例如 `status=eq.open,priority=gte.2`。
条件通过官方 Realtime SDK 的 `filter` 原样传给 W-DB，由服务端检查已发布标量字段、类型和值，
在已有项目权限和 RLS 范围内筛选；最多 16 个 AND 条件、4 KiB，不支持 JSON 字段或路径。
留空保持整表订阅。连接中条件锁定，断开后修改用于下一次连接，不改变现存历史。

Realtime 控制台按接收时间倒序保留最多 100 条已授权数据库事件，仅包含 UTC
接收时间、事件类型与所订阅的表。类型筛选不改变订阅；暂停时事件继续计数但不保存，
继续记录不会重放暂停期间的事件。清空记录保留累计计数，新连接重置记录与计数。
切换用户、项目、权限或密钥时丢弃当前会话记录。记录不包含数据行或令牌，也不持久化。
记录支持 JSON／CSV 下载，仅导出当前筛选匹配的已保存事件，附项目、订阅表、筛选类型、
暂停状态、100 条保留上限、保留与导出记录数，以及当前连接的累计增删改计数。
JSON 格式为 `w-console.realtime-history/v1`；CSV 每行包含同一份范围信息，并转义公式文本。
已筛选订阅的下载额外包含 `subscription_filter`，使用生成该历史的条件；无条件下载保持原有格式。
下载不读取更多数据，不重连或重放事件；断开后仍可下载已保存记录，
更改下一次订阅的表名不会改写旧记录的表范围。下载失败保留记录，离开会话释放下载对象。
Channel 错误、超时或关闭后立即停用旧连接，并保留最后记录；手动重新连接会交换新的项目授权。
旧连接的迟到事件或测试回执不会恢复旧状态，也不会使用旧授权自动重连。

Functions 编辑器提供 Hello JSON 和官方 Supabase SDK 读取模板。使用模板不会自动部署；
已有编辑草稿须明确选择替换。数据模板强制预设用户授权，按 `?table=todos` 指定 public 表，
以调用者身份读取最多 20 行，数据请求限时 5 秒；不返回运行时凭据或原始数据库错误。
函数就绪信息读取 W-DB 函数清单中的 `capabilities.functions`，不依赖需要 `auth:use`
的通用 discovery；后端须包含该新增投影，缺失时界面按能力不可用处理。
函数清单、版本和日志读取允许精确项目的 `project:read` 成员；部署、激活、回滚和删除
仍需 `functions:deploy`。清单能力按当前调用者投影，只读能力可用时不会将整个 Functions
面板误标为不可用，管理按钮逐项检查权限；就绪读取失败或缺失时按钮默认禁用。
没有密钥管理权限的成员可输入已有含 `functions:invoke` 的项目公开密钥，
只保留在当前函数页面内存，切换项目、用户、成员权限或离开页面时清除；
不写入持久存储或 URL，也不授予成员资格。需配合 W-ID 的只读项目令牌交换
和支持读取权限的 W-DB 后端版本发布。

独立 Functions 解锁默认仍只签发 15 分钟的 `functions:invoke` 密钥；需要读取模板时可明确
勾选 `data:read`，不授予数据写入或管理权限。返回的授权范围必须与所选范围完全一致。
已有 Functions-only 密钥不具备数据读取权限；可在页面点击“更换密钥”，再解锁时选择读取权限，
或使用已有含 `data:read` 的控制台密钥。行级访问策略始终由数据平面执行。

“更换密钥”会清空当前函数清单、详情、日志、调用结果及编辑/测试草稿，取消未完成的读取，回到空密钥表单。新密钥重新读取能力，不能沿用旧密钥的管理权限；失败密钥可直接更换。该操作不撤销密钥，不写入浏览器存储或 URL。管理操作进行中或函数变更结果尚未核实时禁用更换；切换项目或成员身份会丢弃页面内覆盖密钥。

Functions 支持直接在控制台编写 TypeScript，或上传源文件部署；两种输入共享现有
精确项目部署接口，源码按 UTF-8 字节限于 256 KiB，与 W-DB 运行时一致。编辑器与
文件输入显示字节用量；空白、空字节或超限源码在授权与部署请求前拒绝。
编辑草稿仅保留于当前页面，
部署失败或后续读取失败时不会丢弃；切换用户、项目、工作区成员权限或控制台
密钥后重建面板。部署回执记录已确认的函数、版本、授权模式和源码摘要，不会
从后续清单读取虚构新的部署回执。部署、授权和后续读取共用 30 秒期限，防止
重复提交；结果未知时需刷新清单、就绪状态及对应函数详情后才能再写入。
激活、回滚和删除复用同一提交锁及 30 秒期限，包含身份授权、项目令牌交换、写入和后续读取。切换项目或密钥取消旧请求；未开始写入的失败可重试，已发出写入但回执未知时先核对对应函数清单、就绪状态和详情，已删除函数则清空旧选中数据，不自动重放请求。激活回执必须匹配请求的函数和目标版本，返回的项目标识也必须一致。

Functions 调用测试器支持 GET、HEAD、POST、PUT、PATCH、DELETE。GET 和 HEAD 不发送正文，
HEAD 不返回响应正文；其他方法可选择 JSON、text/plain、application/xml 或
application/x-www-form-urlencoded，接受最多 64 KiB UTF-8 正文。默认保持 JSON 校验；
其余类型按原文发送，不自动校验 XML 或重新编码表单。切换类型保留草稿，
GET／HEAD 不发送 Content-Type；切换函数、项目或密钥恢复 JSON 默认值。六种方法都支持最多 4 KiB 的 URL 查询参数，
保留重复键、中文、空值和编码后的加号；无效编码、片段及控制字符在请求前拒绝。
结果显示状态、关联 ID、脱敏预览与包含授权的
客户端耗时。可以停止等待并重试，停止等待不会保证服务端函数停止执行。
切换用户、项目或控制台密钥时会重新创建函数面板，清除调用草稿与结果。
同源调用方法由 Caddy 的 `myfastools-project-data.openapi.json` 契约约束。
每次控制台调用发送独立的 `x-w-trace-marker`，结果显示该标记，并自动读取对应
`trace_id` 的后端事件。追踪标记与上游响应的关联 ID 分开显示；日志中的后端
`marker` 会映射为追踪标记。手动搜索使用 1–128 个 ASCII 字母、数字、点、
下划线或连字符，并在后续游标页保留该筛选；状态、事件、关联 ID 和时间仍只
筛选已加载记录。日志页最多累积 200 条，空的更早页保留现有记录并停止分页。
读取失败保留当前记录与游标；重复提交不会发起并行的重复读取，切换函数、项目
或权限后忽略迟到结果。筛选回执必须匹配当前项目、函数和追踪标记，以及递减
的事件 ID 和游标；只保留浏览器安全元数据，不读取原始运行时输出。


备份面板支持手动刷新、创建、下载、恢复风险预览和输入完整项目 ID 后恢复。
授权与操作共用 30 秒期限，重复提交会被拦截；切换用户、项目或密钥会取消等待，
迟到授权不会发起旧项目操作。恢复回执按成功、失败或进行中分别显示，
清单刷新失败仍保留已确认回执。写入超时显示结果未知，需刷新清单与审计，
重新预览并确认后才能再次恢复；取消客户端等待不保证服务端操作回滚。
Provider 的 HTTP 501／502／503 若包含精确项目、资源和备份的规范失败回执，
会显示任务 ID 与安全错误码。进行中的恢复会阻止新建备份和再次恢复；
刷新通过同一任务的现有审计记录更新最终状态，审计失败仍保留原回执。
成功恢复后，仅当任务回执明确允许回滚且当前 Provider 支持时显示回滚表单。
必须再次输入完整项目 ID；回滚会还原到本次恢复前的数据库，并替换恢复后的变更。
回滚共用防重复提交、30 秒期限和项目切换保护；超时后可刷新同一任务的审计
确认是否已回滚，不自动重试。该入口依赖 Caddy 的精确 POST rollback facade。
概览页的恢复入口统一进入该面板，Provider 未提供的能力保持明确不可用。

Storage 签名下载链接显示对象范围、剩余秒数和失效时间。到期后移除下载入口并禁用复制；
返回浏览器窗口或点击下载／复制时会重新检查有效期。复制生成当前站点的完整链接，
不追加 API 请求或延长有效期；持有链接的人可在到期前读取对象。
显式续签使用当前所选的白名单有效期，并重新交换精确项目权限；签发新链接不撤销旧链接。
剪贴板失败保留下载入口，续签与项目切换隔离旧的复制／签发结果；控制台不在本地存储中持久化链接。

Storage 图片预览复用精确桶／对象路径的签名下载授权，仅对清单标注的 PNG、JPEG、GIF、
WebP 提供入口；其他类型仍通过下载查看。点击后才签发并加载图片，不预加载对象清单。
关闭预览移除图片但保留已有下载链接；到期或切换桶／项目／密钥时移除旧图片。
加载失败可重新签发后重试；更新链接会忽略旧图片的迟到加载事件。预览不会延长签名有效期。

Storage 可为指定桶和完整对象路径生成最长两小时的签名上传链接，默认仅允许创建，
可在签发时明确允许覆盖。持有链接的人可直接 PUT 文件字节，并设置 Content-Type；
上传仍受当前桶的 MIME、大小、配额和生命周期限制。复制不重新签发，清除视图或
生成新链接不撤销已签发的链接。链接只保存在当前页面内存；编辑目标、切换桶、
项目或密钥会清除旧结果并取消待处理请求。界面使用保守的本地两小时显示截止时间，
实际有效期由服务端决定。后端须支持 Supabase signed-upload 接口，拒绝或未支持时
明确显示失败；不会伪造可用链接。

Storage 支持在项目内复制或移动不超过 64 MiB 的对象，可选择目标桶和完整路径。
目标采用仅创建写入，已有对象不会被覆盖；移动须输入完整源路径确认。
移动先写入目标再删除源，失败可能留下两份对象。已发出的失败／未知响应锁定写入；
刷新桶清单会分别检查捕获的源和目标路径，只有两边读取成功才解除锁定，
不会重放操作。若有界前缀页无法证明对象不存在，继续保留锁定。
确认回执与位置检查结果分开展示，切换桶／项目／密钥会清除旧结果。

Storage 对象浏览器可导出当前已加载页的 JSON／CSV，不追加网络读取。
`w-console.storage-page/v1` JSON 仅包含对象路径、字节数、MIME、版本 ID、修改时间，
附项目／工作区、桶、实际加载的前缀、偏移量、50 条上限、后续页标记与获取时间。
这是当前页快照，不代表完整桶清单；编辑但未提交的前缀不会改变导出范围。
CSV 复用公式转义，空页仍可导出分页元数据；下载失败保留当前页。
加载失败或切换桶／项目时禁止导出旧范围，离开页面会释放下载对象。

Storage 支持每批最多 100 个文件、总大小 64 MiB 的顺序上传。单文件使用完整
对象路径，多文件按原文件名上传到指定前缀；重复路径、超限和 URL 点路径段会
在上传前拒绝。可以查看逐项结果、只重试未完成项或停止队列；已成功的文件保留，
停止等待后的进行中请求显示结果未知。每次授权与上传共享 30 秒期限，切换桶、
用户、项目或控制台密钥会取消待处理队列。该功能复用现有管理 PUT 接口。
上传来源可切换为文件夹，并在上传前预览完整目标路径。文件夹模式保留所选根目录
名称及子目录，即使只有一个文件；可追加目标前缀，不上传空目录。同名文件在不同
子目录中仍是不同对象；缺失目录信息、非法相对路径和重复目标会在授权前被拒绝。
上传默认使用现有管理接口的 `If-None-Match: *` 原子条件，保留同名对象；勾选
“替换已有文件”后才允许覆盖。冲突保留待上传文件，用户可允许替换后仅重试未完成项，
已确认成功的路径不会重复上传。进行中禁止修改替换选项，切换桶、项目或密钥恢复默认；
结果未知时先检查对象，再决定是否允许替换。后端路由、请求体和返回合约不变。
逐项失败结果区分同名文件、单文件大小限制、桶配额和 MIME 类型拒绝，提供中英提示。
仅识别现有管理接口的精确状态码与错误码组合；错误体最多读取 4 KiB，未知或异常
响应显示“未能确认上传结果”，不展示上游诊断。成功重试清除旧原因，切换范围清空旧结果。

存储对象支持当前页选择和批量删除（最多 50 个）。确认面板显示完整路径清单，
要求输入桶 ID；队列逐项执行，遇到失败即停止，展示已确认、失败、结果未知和未执行项。
删除仅移除当前对象，不清理保留的历史版本。进行中的删除被停止或响应丢失后，须刷新对象列表
再重新选择、确认；不会自动重试，也不会把刷新后消失的对象伪造为已确认删除。
分页、筛选和刷新清空选择；桶、项目或用户切换取消旧队列与迟到授权，并清空旧结果。

Storage 支持按完整对象路径查找保留版本，包括当前对象已经删除的路径。
仅在 Provider 声明支持版本查询与恢复时提供相应入口；最多展示 100 个版本，
截断时明确提示。输入完整版本 ID 后恢复，回执显示新版本 ID；配额或列表
刷新失败仍保留该回执。版本查询、恢复、删除与签名链接共用本地操作锁，
与上传互斥；授权与请求共用 30 秒期限，切换桶或项目会取消旧操作。
恢复超时显示结果未知，需重新查找版本确认结果后才能重试。

SQL 预览与执行支持取消浏览器请求，立即释放编辑器，取消期间取得的授权与迟到结果不会发送后续请求或覆盖新操作。服务端查询可能继续运行至执行超时；取消提示明确说明这一边界。迁移应用保留事务确认与未知结果处理。

SQL 编辑器支持下载当前已加载查询结果的 JSON／CSV，不重新执行查询。JSON 包含项目 ID、
数据行、截断标记和返回字节数；CSV 复用公式转义，截断下载的文件名含 `-truncated`。
结果表格合并各行的列名，并区分缺失字段与 NULL。修改 SQL、再次执行或切换项目会清除
旧结果；下载失败保留当前结果，空结果可下载 JSON，CSV 按钮禁用。

数据库数据行支持导出当前已加载页的 JSON／CSV，不额外查询数据。JSON 保留原始
类型，CSV 支持中文、换行和嵌套 JSON，并转义可能被电子表格解释为公式的文本。
下载文件名包含项目、表与页码；加载失败、切换项目或加载新页时无法导出旧数据。
数据行与 RLS 策略写入共享防重入锁，授权和写入共用 30 秒期限。行冲突保留草稿，
网络失败或超时提示先刷新确认结果；切换项目会停止客户端等待，忽略旧响应，
但不保证服务端写入回滚。写入期间禁用相关编辑和导航操作，失败后可再次操作。
SQL 与迁移面板也会拦截重复执行、冻结执行中的草稿并在草稿修改后清除旧预览。
迁移应用超时显示结果未知；已确认提交后的历史读取失败单独显示，不改写提交结果。
切换项目会取消等待并丢弃迟到授权和响应，迁移历史读取同样有期限与取消保护。

Auth 目录、角色、状态、邀请与会话操作直接使用当前第一方 W-ID 登录 bearer；W-ID 按
精确 Workspace／项目重新验证成员关系。用户目录按每页 25 人在服务端分页，
额外读取一人判断下一页，支持活跃／封禁筛选；搜索仅筛选当前页。分页与状态
切换会清空所选用户及会话，取消旧读取；同一登录时间按用户 ID 稳定排序。
待处理邀请可输入完整邮箱后撤销，
撤销成功或刷新发现邀请不再待处理时会清除对应的一次性地址。邀请历史接受
W-ID 契约规定的最多 500 条。管理员可查看所选终端用户最多 100 条项目会话，
输入完整会话 ID 后撤销单个会话及其刷新令牌，仅显示设备和创建／到期元数据。
角色、禁用／恢复、创建／撤销邀请、撤销会话共用防重入锁、30 秒期限和跨项目
取消保护；切换用户也会取消旧会话读取。会话同源路由由 Caddy 项目 Auth OpenAPI 约束。

Sites 自定义域名可下载 BIND 格式 DNS 配置：包含后端返回的验证 TXT 和一条 CNAME 或 A 路由记录（仅在后端提供 IPv4 时可选 A），TTL 为 300 秒，名称和 CNAME 目标均为完整域名。TXT 按 UTF-8 字节转义并以 255 字节分段，下载不新增 API 请求；已验证域名也保留配置供迁移使用。文件可按 [Cloudflare DNS 导入说明](https://developers.cloudflare.com/dns/manage-dns-records/how-to/import-and-export/) 导入，导入时核对记录和代理设置，再使用现有「检查 DNS」验证。生成文件不会写入 DNS 服务商。域名切换、配置更新和项目切换会撤销旧下载 URL；下载失败保留可见记录。

Sites 选择文件后显示文件数和总大小，可逐个移除或清空后重新选择。数量、单文件与总大小超限、无效路径或重复发布路径会在本地阻止发布，不读取文件内容、不请求授权。选择文件夹仍保留相对路径；成功发布和切换项目会清空选择。

Sites 网站发布保留最近一次已确认的发布或版本切换回执，显示精确网站标识、
不可变版本号、文件数、大小及版本链接；后续清单刷新失败不会丢失回执。
发布、预览、版本切换、域名修改、删除和刷新共用防重入锁。普通操作的授权
与请求共享 30 秒期限，文件发布为 120 秒；处理中冻结编辑草稿。写入网络失败、
超时或返回不匹配的网站回执时显示结果未知，需刷新清单、版本与域名并检查
服务端状态后才能重试，不会自动重发。刷新发现的新版本不会冒充已确认回执。
切换网站、项目、用户或成员权限会取消旧等待，迟到授权不会发出请求，旧响应
不会覆盖当前项目；取消客户端等待不保证服务端写入回滚。回执仅存于当前页面内存。

Project Connect 可为新服务端密钥配置名称、逐项权限及有效期（1 小时、24 小时、
7 天、30 天或永不过期）；界面默认仅选数据／存储读取权限、24 小时有效期。
权限选择来自 W-ID 已支持的项目 scope，服务端密钥不授予未勾选的权限，也不
替代用户身份或项目成员授权。创建回执核对实际名称、权限和到期时间，确认的
一次性密钥在后续清单刷新失败时保留，切换项目或用户后清除。库存只显示元数据。
密钥授权、创建／轮换／撤销及后续读取共享 30 秒期限和防重入锁，迟到授权不会
发出写入。结果未知时暂停写入，需刷新并检查清单后才能重试，不会自动重发或
从清单重新取回服务端密钥。读取到新密钥元数据不会冒充一次性创建回执。刷新
同时核对密钥清单与 Project Connect，
仅两者成功后解除未知结果锁；已撤销、过期或轮换重叠期结束的密钥不再用于连接
示例，一次性服务端密钥也会在清单确认其失效或不存在后清除。

## Formal CI

PUBLIC GitHub Actions 使用标准 Ubuntu runner、Node 22.23.1 / npm 10.9.9 和 `npm ci`，
运行原 `npm run ci`：敏感文件审计、全部契约/控制台/参考 UI/路由/图片/CTA/i18n/catalog/
Radar 断言、TypeScript、ESLint、client/SSR/预渲染和最终产物检查。路由与 HTML 数量由当前
源码动态核对，旧运行记录不能代替本提交的真实 CI 结果。`dist/build-provenance.json`
把检查过的构建绑定到精确提交与 lockfile；下载工件仅包含源码、COMMIT 和 SHA256SUMS。

参考 SaaS 的五个真实后端 pin 在公开快照中明确为 `pending`，repository/ref/commit/PR/
provenance 为 `null`。UI 与适配器合成 fixture 的全部断言照常运行；真实组合入口在
任何 checkout 前拒绝未完成的配置。实际受保护部署的配置、凭据与历史记录留在私有保管处，
可通过 `REFERENCE_HERMETIC_PINS_FILE` 显式提供经过独立审阅的最终配置。PUBLIC CI 不运行
`test:reference:production` 或 `verify:production`，其结果不证明生产或五后端组合验收。

生产 W-DB 当前若未允许 `https://myfastools.com` CORS，浏览器会明确显示网络/CORS 失败。
可选的同源修复必须使用一个固定精确 broker 路径 `POST /api/w-db/project-discovery`，由服务端
重新验证 W-ID 成员关系并转发到动态 W-DB project route；不得把 `/api/*`、`/v1/projects/*`
或其他宽前缀直接暴露在官网域名下。本仓库只记录该边缘契约，不管理或修改 Edge。

Builder 项目的可观测性入口独立于上述四项后端能力。只有 W-ID SaaS context 中已通过
成员关系过滤、且带安全 `radarProjectId` 的项目，才显示 W-Radar
`/dashboard/projects/{id}` workspace-project 页面。官网拒绝 URL、斜杠、控制字符等非项目
标识，也不会使用 `/dashboard/platform/projects/*` 或 `/api/platform/*` 运维面。

可观测性日志支持 UTC 起止时间与最近一小时／24 小时／7 天快捷选择；无效、
倒置或超过 7 天的范围会在授权请求前拒绝。分页保持同一时间范围，刷新重读
所选范围；快捷选择可更新到当前时间。最多累积 200 条日志，达到边界后明确
提示缩小筛选，不再继续读取并丢弃旧页。重复点击只发起一次读取，分页失败
保留已加载记录供重试，重叠日志按 ID 去重。授权与读取共享 30 秒期限，
修改筛选、切换项目或用户会取消旧读取，迟到授权与响应不会覆盖当前视图。
日志可导出 JSON／CSV，仅下载当前已加载的脱敏记录（最多 200 条），不追加网络读取。
导出记录项目、实际应用的时间范围与筛选条件、记录数和是否仍有后续页；尚未应用的
输入不会改变导出元数据。JSON 保留允许属性的类型；CSV 使用 UTF-8 BOM、标准引号
转义和公式前缀转义。读取中或记录为空时禁用导出，切换项目会清理下载资源。

## 相关组件

- `product-landings/` 是同仓维护的产品门页、目录输入、原始图片和生成器。
- W-ID、W-DB、W-Storage、W-Radar、W-Monitor 通过各自 API 契约接入，并分别授权。

The Database console can publish an individual table to the application's REST API after table creation and owner RLS setup. It reads the exact project's persisted publication, lets members select supported exposed/writable columns and row limits, and requires the exact table name for changes. Primary keys and authenticated-owner columns remain read-only. Server-configured publications are shown as read-only. An uncertain write locks further changes until a successful refresh reconciles the authoritative configuration; no automatic replay occurs. Publishing here does not automatically enable Realtime; the adjacent Table Realtime controls independently read and enable or disable managed table subscriptions. They display requested and effective states, require exact-table confirmation, keep configured tables read-only and reconcile uncertain writes through GET without replay. The owner column must match the project Realtime owner policy. Unicode and quoted table names use exact identifiers within 63 UTF-8 bytes. Generated TypeScript types are available from the project's published database schema through the W-DB types API. The same-origin publication/types/table-Realtime facades and W-DB control migrations must be released with this frontend.

Managed publications also drive Database console row editing and batch import. Row controls use the returned primary key and writable-column flags rather than assuming an `id` key or standard owner name. Published `tsvector` values are handled as PostgreSQL vector text in the row editor, matching W-DB's vector-text write contract. Quoted Unicode column keys keep their literal JSON names within the existing 63-byte identifier, 64-field and 32 KiB row bounds. Authoritative unpublished state disables row writes; RLS management and catalog browsing remain available. The W-DB manager resolves the current publication for each write, including optimistic snapshots and atomic imports.

The create-table form supports a custom primary-key name with either a generated bigint identity or a PostgreSQL-generated UUID. It quotes names, rejects collisions with ordinary columns, and transfers the definition to the migration editor only when Prepare is selected. The default remains an `id` bigint identity. Columns can require unique values and select no default, a typed literal, nullable SQL NULL, or the matching current timestamp/current date/generated UUID. Literal defaults are bounded to 1 KiB, preserve bigint and decimal precision, and quote text as data; arbitrary SQL expressions are not accepted. JSON `null` is distinct from SQL NULL, and unique nullable columns permit multiple SQL NULL values. Columns can also reference a primary or unique field in this project’s public schema, including a self-reference, using quoted table and column names. Deletion behavior is restricted to preventing deletion while referenced (default), deleting referencing rows, or setting the field to NULL; the last option requires a nullable field. Changing a field type clears its default and reference. PostgreSQL validates referenced uniqueness and type compatibility when the migration applies. Preparing the migration does not send requests; the existing preview and exact-project confirmation apply it transactionally.


The Database row grid supports selecting rows from the current loaded page and
confirming one atomic batch deletion. Selection clears on a refresh, query,
page or table change and cannot carry across project sessions. The request
contains exact row IDs and up to eight loaded published snapshot fields,
including the configured primary key. The W-DB batch route enforces the current
owner/RLS scope and rejects the whole transaction if any selected snapshot no
longer matches. Stale or uncertain outcomes retain the page and disable another
batch deletion until a refresh; requests are never automatically replayed.
`[CONTRACT IMPACT]` This frontend requires the additive W-DB `delete_batch`
operation on the existing exact-project POST `rows/batch` management route.
The current publication's single primary-key contract remains authoritative.

Storage bucket creation/update/deletion and retention-rule writes share the
existing object-operation lock and a 30-second deadline across identity,
fresh exact-project authorization, the write and follow-up reads. A lost or
invalid write receipt locks management controls until the user explicitly
refreshes the bucket inventory; retention uncertainty additionally requires a
successful read of the captured bucket's rules. Failed reconciliation retains
the lock, and no write is replayed. Bucket-write receipts must match the
requested bucket ID. Changing project aborts pending operations.

Database table imports accept JSON or UTF-8 CSV (paste or file), with the same atomic
1–100-row endpoint and confirmation flow. CSV requires current column metadata and exact
writable headers; missing columns use database defaults, text preserves whitespace and
empty strings, booleans use `true`/`false`, and integers must be safe JavaScript
integers. An unquoted `\N` denotes SQL NULL; a quoted `"\N"` remains literal text.
JSON/array columns use JSON cells. Duplicate, unknown, generated, identity and read-only
headers, invalid UTF-8, malformed CSV, mismatched row widths and existing size limits
are rejected before submission. Changing the CSV metadata invalidates its preview;
uncertain commits block replay. CSV export still includes read-only columns and uses its
existing spreadsheet-safe representation, so exported pages must be reviewed before
importing.

Functions 审计支持下载当前筛选匹配的已加载事件（JSON／CSV），不会请求新页或调用函数。
`w-console.function-audit/v1` 包含当前项目、函数、实际已应用的服务端追踪标记、
状态／事件／关联 ID／时间筛选、200 条保留上限、已加载和导出条数及下一页游标。
编辑中的追踪标记不会改写导出范围；时间筛选使用浏览器时区并导出为 UTC，
事件时间原样保留数据库的时间精度。
仅投影事件元数据，不包含源码、请求／响应体、stdout 或凭据；敏感文本会脱敏，
CSV 会转义公式文本。空结果仍可下载范围信息，下载失败保留列表和筛选条件。
函数／项目／密钥切换和离开会话会释放下载对象 URL。
