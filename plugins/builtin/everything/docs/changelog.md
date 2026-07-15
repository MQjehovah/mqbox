# Everything 插件变更记录

> 基于 git log 整理

## [v0.3.0] — 2026-07-15（当前版本）

### 新增
- ✨ 配置界面 `Config.vue` — 可视化编辑端口/超时/最大结果数
- ✨ `saveConfig` 命令 — 配置持久化到 `context.storage`
- ✨ 插件的 `SearchProvider` 暴露 — 支持全局搜索框调用
- 📦 Vite 多入口构建配置（`index.ts` + `Config.vue`）

### 变更
- 🔧 硬编码配置 → 可持久化配置（默认值：端口 26983、超时 3000ms、最大结果 20）

---

## [v0.2.0] — 2026-07-14

### 修复
- 🐛 修复 Everything 插件的搜索功能（commit `fc2d437`）
- 🐛 多个稳定性修复（commits `76f4a20`, `80e38d0`, `a2cf949`）

---

## [v0.1.0] — 初始版本

### 新增
- ETP 客户端实现（`everything.ts`）
- 基础搜索命令注册
- `search(query, options?)` 核心搜索功能

---

## 待办（TODOs）

- [ ] 配置界面增加「测试连接」按钮
- [ ] 支持搜索指定目录（限定路径前缀）
- [ ] 结果中高亮匹配关键词
- [ ] 支持 Everything 的 `match_whole_word`、`match_case` 等高级选项
