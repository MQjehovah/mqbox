# Everything 插件 — 需求文档与实际实现差异对照

> 本文档记录需求规格文档与最终代码实现之间的已知差异，供读者对照参考。

## 差异对照表

| 文档 | 段落 | 需求/规格原文 | 实际实现 | 说明 |
|------|------|-------------|---------|------|
| `requirement_spec.md` | 多处 | 引用 "HTTP 服务"、"HTTP API 端口" | 使用 **ETP 协议**（Everything TCP Protocol） | Everything 本身提供的是 ETP 协议（TCP 端口 26983），非 HTTP。代码中 `everything.ts` 使用 `net.createConnection` 通过 TCP 发送 ETP 命令 |
| `config_requirements.md` | 多处 | 引用 "HTTP 服务" | 使用 **ETP 协议** | 同上 |
| `requirements.md` | 多处 | 引用 "HTTP 服务" | 使用 **ETP 协议** | 同上 |
| `requirement_spec.md` | 默认值 | 超时 5000ms，最大结果 100 | 超时 **3000ms**，最大结果 **20** | 实际代码中 `everything.ts` 的 `search()` 选项默认值：`{ timeout: 3000, maxResults: 20 }` |
| `requirement_spec.md` | 明确不做的范围 | "不修改 vite.config.ts 的构建配置（保持单入口）" | 已修改为**多入口构建** | `vite.config.ts` 已添加 `index.ts` + `Config.vue` 双入口 |
| `requirement_spec.md` | 明确不做的范围 | "不修改 PluginConfig.vue" | 已创建 `src/Config.vue` | 这是插件自身的配置组件，非框架的 `PluginConfig.vue`，实际无冲突 |
| `requirement_spec.md` | ETP 协议 | "Everything 通过 TCP 协议提供搜索服务"（正确） | 正确实现 | 此处标注正确，仅 HTTP 引用有误 |

## 变更原因

| 差异项 | 原因 |
|--------|------|
| HTTP → ETP | 需求文档初期对 Everything 协议理解有误，实际 Everything 未开放 HTTP API，仅支持 ETP 协议 |
| 默认值调整 | 5000ms/100 是基于网络搜索服务的假设上设定的。ETP 协议本地查询速度更快，30ms/20 条更贴近实际使用 |
| 多入口构建 | 实现配置界面需要独立构建 Config.vue 组件，必须修改 vite.config.ts 以支持双入口 |

## 影响范围

- 用户侧：无影响（用户仅通过配置界面使用，不接触协议细节）
- 开发者侧：了解 ETP 协议有助于调试连接问题；构建配置已改，勿回退单入口
