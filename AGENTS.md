# W Platform Site

本仓包含 React / TanStack Router / Vite 的双语静态站点、统一项目控制台和产品门页。

- 最简单、直接、改动最少；优先复用现有文件、函数和类型。
- 改动前阅读 README.md、PUBLIC_SOURCE.md、相关契约与既有测试。
- 前端 HTML/CSS/浏览器 JavaScript 改动或审查先使用 modern-web-guidance。
- 保留现有页面、产品 API、PKCE callback、subject/tenant、内存令牌和授权边界。
- 不减少断言以获得绿色结果；不添加非必要测试。
- 本轮验收禁止本机安装/构建/运行产品或下载模型，使用 PUBLIC 免费标准 GitHub Actions。
- Node 22.23.1、npm 10.9.9；完整检查为 `npm ci` 后 `npm run ci`。
- canonical 图片与提示词在 product-landings/_images；public/_images 为生成镜像，不提交。
- W-ID Browser 依赖使用原 PUBLIC CI npm 包，按 licenses/W_ID_BROWSER_SOURCE.json 的来源/hash 锁定。
- 公开源码包不包含 node_modules、dist、真实用户/商户/流量数据、凭据或运维配置。
- 五组件真实参考验收默认 pending；不得绕过 final pin/独立审阅/实际 CI 工件门槛。
- 不执行生产操作或部署；不触发私有 Actions；已有 live CI 不重复触发。
- 不覆盖他人 dirty，不重写合法历史；Git author 与 committer 使用 noreply。
