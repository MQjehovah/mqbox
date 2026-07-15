# 快速笔记插件 — 面板笔记详情视图 架构设计

> 更新于 2026-07-14 · 范围锁定 HOLD SCOPE（P0 + P1）
> 对应需求: requirements.md | 影响范围: plugins/quick-notes/src/

---

## 1. 架构概览（ASCII 图）

```
┌──────────────────────────────────────────────────────────┐
│                     MQBox 主进程                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │             quick-notes 插件 (index.ts)             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │  Panel   │  │  Page    │  │  NoteDetail      │ │  │
│  │  │ (概览)   │  │ (全屏)   │  │ (详情视图/子组件) │ │  │
│  │  └────┬─────┘  └──────────┘  └──────────────────┘ │  │
│  │       │                                                │
│  │       │ 状态切换: selectedNote ∈ {null, Note}          │
│  │       │ execute('update'|'delete')                     │
│  │  ┌────▼────────────────────────────────────────────┐   │
│  │  │          notes[] (内存 + storage 持久化)         │   │
│  │  └─────────────────────────────────────────────────┘   │
│  └────────────────────────────────────────────────────────┘
│                        ▲
│                        │ IPC
│                        ▼
│  ┌────────────────────────────────────────────────────────┐
│  │              Renderer (Vue 3 + Pinia)                  │
│  │  Panel.vue ──→ NoteDetail.vue (条件渲染)               │
│  └────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────┘
```

### 视图切换流程

```
┌─────────┐   点击笔记条目      ┌──────────┐   点击编辑    ┌───────────┐
│  LIST   │ ──────────────────> │  DETAIL  │ ────────────> │  EDITING  │
│ (概览)  │                     │ (只读)   │               │ (可编辑)  │
│         │ <────────────────── │          │ <──────────── │           │
└─────────┘   ESC/返回/遮罩     └──────────┘   保存/取消   └───────────┘
               删除(确认后)          │
               回到 LIST             │
                                    │ 删除确认
                                    ▼
                               [execute delete]
                                    │
                                    ▼
                              回到 LIST
```

---

## 2. 模块列表

### 2.1 修改: `index.ts` — 插件入口

| 项目 | 说明 |
|------|------|
| **职责** | 注册 commands 和面板/页面组件 |
| **新增** | `quick-notes:open` / `quick-notes:toggle` 命令 |

**[待更新: 实际实现中数据管理移至 Panel.vue，未使用 IPC command 模式]**

**实际实现的命令接口：**

```typescript
// 注册面板组件
context.registerPanelComponent('quick-notes-panel', Panel)

// 注册页面组件
context.registerPageComponent('quick-notes-page', Page)

// 注册命令
context.registerCommand('quick-notes:open', handler)    // 呼出搜索/创建面板
context.registerCommand('quick-notes:toggle', handler)  // 切换面板显示
```

> ⚠️ **架构设计阶段的 `update`/`delete` command 方案未采用。**
> 实际实现中，数据管理（CRUD）全部在 `Panel.vue` 内部通过 `localStorage` 直接完成，未经过 IPC 命令层。详见 §3 数据流。
> 这一简化避免了主进程/渲染进程间的通信开销，适合单用户本地场景。

### 2.2 修改: `Panel.vue` — 面板组件（主视图控制器）

| 项目 | 说明 |
|------|------|
| **职责** | 展示笔记列表概览；管理详情的显示/隐藏状态；作为 NoteDetail 的宿主 |
| **Props** | 不变: `data`, `execute`, `openPage`, `refresh` |
| **新增状态** | `selectedNote: Note \| null` |

**状态迁移：**
```typescript
const selectedNote = ref<Note | null>(null)

// selectedNote === null       → 渲染 LIST 视图（当前面板内容）
// selectedNote !== null       → 渲染 NoteDetail 组件
```

**修改点：**
1. 导入 `NoteDetail.vue` 组件
2. 新增 `selectedNote` ref
3. 笔记条目 `<div>` 增加 `@click="selectedNote = note"`
4. 条件渲染：`v-if="selectedNote"` 显示 `NoteDetail`，`v-else` 显示现有列表
5. 监听 NoteDetail 的 `close` / `deleted` / `updated` 事件

### 2.3 新增: `NoteDetail.vue` — 详情视图子组件

| 项目 | 说明 |
|------|------|
| **职责** | 展示笔记完整内容、标签、时间；提供编辑和删除功能 |
| **Props** | `note: Note`（必填）, `compact?: boolean`（可选） |
| **Emits** | `close` → 关闭详情回到列表；`deleted` → 删除后通知父组件；`updated` → 更新后通知父组件 |

**[待更新: 实际 Props 为 `note` + `compact`，无 `execute` prop；编辑/删除操作直接通过 emit 通知父组件处理]**

**实际内部状态：**
```typescript
// 编辑模式标记
const isEditing = ref(false)

// 编辑表单
const editContent = ref('')
const editTags = ref('')

// 删除使用浏览器原生 confirm()，无独立确认弹窗状态
```

**操作列表：**

| 操作 | 触发 | 动作 |
|------|------|------|
| 关闭详情 | 点击返回按钮 / ESC 键 / 点击遮罩层 | `emit('close')` |
| 进入编辑 | 点击"编辑"按钮 | `viewMode = 'edit'`; `editContent = note.content` |
| 保存编辑 | 点击"保存"按钮 | `await execute('update', { id, content })` → 成功后 `emit('updated')` → `viewMode = 'view'` |
| 取消编辑 | 点击"取消"按钮 | `viewMode = 'view'`; `editContent` 恢复原值 |
| 删除笔记 | 点击"删除" → 确认弹窗 → 确认 | `await execute('delete', { id })` → 成功后 `emit('deleted')` |
| 取消删除 | 确认弹窗 → 取消 | 关闭确认弹窗，无操作 |

**键盘事件（HOLD SCOPE 严谨性）：**
- ESC 键：如果在编辑模式 → 先退出编辑；如果在查看模式 → `emit('close')`
- 在编辑模式下按 ESC → 视为取消编辑，不是关闭详情

### 2.4 不变: `Page.vue` — 全屏列表页

| 项目 | 说明 |
|------|------|
| 状态 | **不做任何修改** |
| 理由 | 本次需求限定面板内闭环，不涉及 Page 页的联动 |

---

## 3. 核心类/接口定义

### 3.1 共享类型 (`src/types.ts` — 新增)

```typescript
export interface Note {
  id: string
  content: string
  tags: string[]
  time: number
}

export interface PanelProps {
  data: { notes: Note[] }
  execute: (action: string, args?: unknown) => Promise<unknown>
  openPage: () => void
  refresh: () => Promise<void>
}

export interface NoteDetailProps {
  note: Note
  execute: (action: string, args?: unknown) => Promise<unknown>
}

export interface NoteDetailEmits {
  (e: 'close'): void
  (e: 'deleted', noteId: string): void
  (e: 'updated', note: Note): void
}
```

### 3.2 `index.ts` 新增 update command 原型

```typescript
context.registerCommand('update', async (args: { id: string; content?: string; tags?: string[] }) => {
  if (!args?.id) {
    return { success: false, error: '缺少笔记ID' }
  }

  const index = notes.findIndex(n => n.id === args.id)
  if (index === -1) {
    return { success: false, error: '笔记不存在或已被删除' }
  }

  // 合并更新（仅更新提供的字段）
  if (args.content !== undefined) {
    notes[index].content = args.content
  }
  if (args.tags !== undefined) {
    notes[index].tags = args.tags
  }
  notes[index].time = Date.now()

  // 持久化
  await context.storage?.set('notes', notes)

  return { success: true, note: { ...notes[index] } }
})
```

---

## 4. 数据流图（关键路径）

### 路径1: 查看笔记详情（P0）
```
用户点击笔记条目
  → Panel.vue: selectedNote.value = note
  → Vue 响应式更新: v-if="selectedNote" 为 true
  → NoteDetail 挂载并接收 note prop
  → 渲染: 完整 content | tags[] 标签样式 | time 格式化
```

### 路径2: 编辑并保存（P1）
```
用户点击"编辑"
  → NoteDetail: isEditing = true, editContent = note.content, editTags = note.tags.join(',')
  → 文本域聚焦，用户修改内容
  → 用户点击"保存" 或 按 Ctrl/Cmd+Enter
  → NoteDetail: emit('updated', { ...note, content: editContent, tags: editTags.split(',') })
  → Panel.vue: 收到 updated 事件 → handleUpdate(note) 更新 localStorage 并刷新列表
  → NoteDetail: isEditing = false
  → 用户看到更新后的内容
```

> ⚠️ **[待更新: 实际实现未使用 IPC command，编辑数据通过 emit 事件交给 Panel.vue 直接写入 localStorage]**

### 路径3: 删除笔记（P1）
```
用户点击"删除"
  → NoteDetail: emit('deleted', note.id)
  → Panel.vue: deleteNote(id, event) 被调用
  → 浏览器 confirm() 弹出确认框
  → 用户确认删除
  → Panel.vue: notes 数组过滤 → saveNotes() → selectedNote = null
  → 用户看到列表已更新，被删除的笔记消失
```

> ⚠️ **[待更新: 实际实现中删除操作在 Panel.vue 内直接处理，未经过 IPC command；使用浏览器原生 confirm() 确认]**

### 路径4: 关闭详情返回（P0）
```
方式A — 点击返回按钮:
  → NoteDetail: emit('close')
  → Panel.vue: selectedNote = null
  → Vue 响应式: 隐藏 NoteDetail，显示列表

方式B — 按 ESC 键:
  → NoteDetail: 如果 viewMode === 'edit' → 先取消编辑
  → NoteDetail: 如果 viewMode === 'view' → emit('close')

方式C — 点击遮罩层:
  → 同方式A
```

---

## 5. 目录结构

```
plugins/quick-notes/
├── package.json          # [改] version → 1.0.0
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── index.ts          # [改] → registerPanelComponent / registerPageComponent / 2 commands
│   ├── types.ts          # [新] 共享类型定义 (Note 接口)
│   ├── Panel.vue         # [改] + selectedNote 状态 + NoteDetail 集成 + localStorage CRUD
│   ├── NoteDetail.vue    # [新] 详情视图组件（查看/编辑/删除）
│   └── Page.vue          # [不] 无修改（保留未使用）
├── dev/                  # (开发配置)
└── dist/                 # (构建产物)
```

**文件变更清单：**

| 文件 | 变更类型 | 操作 |
|------|----------|------|
| `src/types.ts` | 新增 | 提取 Note 接口 + 组件 Props/Emits 类型 |
| `src/index.ts` | 修改 | 新增 `update` command，导入 `types.ts` |
| `src/Panel.vue` | 修改 | 新增状态管理 + 集成 NoteDetail |
| `src/NoteDetail.vue` | 新增 | 详情视图完整实现 |
| `src/Page.vue` | 不变 | 无修改 |

---

## 6. 错误处理策略

### 6.1 输入验证

| 场景 | 验证规则 | 处理方式 |
|------|----------|----------|
| update 缺少 id | `!args?.id` | 直接返回 `{ success: false, error }` |
| update 目标笔记不存在 | `findIndex === -1` | 返回 `{ success: false, error }`；前端显示 toast |
| delete 目标笔记不存在 | `findIndex === -1` | 返回 `{ success: false }`；前端 toast "笔记可能已被删除" |
| 编辑保存空内容 | 允许（用户可能想清空后重新输入） | 不做校验拦截，直接保存 |

### 6.2 运行时异常

| 场景 | 处理方式 |
|------|----------|
| `context.storage?.set()` 写入失败 | command 内部 try-catch，返回 `{ success: false, error: persistError }` |
| NoteDetail 组件 unmount 时请求未完成 | 使用 `onUnmounted` 标记取消，阻止内存泄漏 |
| 编辑过程中外部数据变更 | 保存时后端做 id 存在性检查，不存在则通知用户 |

### 6.3 UI 错误反馈

```typescript
// NoteDetail.vue 中的错误状态
const errorMsg = ref('')

// 在模板中条件渲染
<div v-if="errorMsg" class="text-red-500 text-xs">{{ errorMsg }}</div>

// 自动清除
watch(errorMsg, (val) => {
  if (val) setTimeout(() => { errorMsg.value = '' }, 3000)
})
```

---

## 7. 测试矩阵

### 7.1 单元测试

| ID | 测试场景 | 输入 | 预期结果 | 优先级 |
|----|----------|------|----------|--------|
| UT-01 | update command — 正常更新内容 | `{ id: 'abc', content: '新内容' }` | 返回 `{ success: true, note: { ... } }`，notes 数组更新 | P0 |
| UT-02 | update command — id 不存在 | `{ id: 'notexist', content: 'x' }` | 返回 `{ success: false, error: '...' }` | P0 |
| UT-03 | update command — 缺少 id | `{ content: 'x' }` | 返回 `{ success: false, error: '缺少笔记ID' }` | P1 |
| UT-04 | update command — 只更新 tags | `{ id: 'abc', tags: ['new'] }` | content 不变，tags 更新 | P1 |
| UT-05 | delete command — 已存在的 id | `{ id: 'abc' }` | notes 中移除该 id，返回 `{ success: true }` | P0 |
| UT-06 | delete command — 不存在的 id | `{ id: 'notexist' }` | 返回 `{ success: false }` | P1 |

### 7.2 NoteDetail.vue 组件测试

| ID | 测试场景 | 操作 | 预期结果 | 优先级 |
|----|----------|------|----------|--------|
| CT-01 | 显示完整内容 | 传入含长文本的 note prop | 渲染全部文本（不截断） | P0 |
| CT-02 | 显示 tags | 传入 `tags: ['tag1','tag2']` | 渲染两个标签样式元素 | P0 |
| CT-03 | 显示时间 | 传入 `time: 1720000000000` | 显示相对时间/日期 | P0 |
| CT-04 | 点击返回按钮 | 点击返回按钮 | emit('close') | P0 |
| CT-05 | 按 ESC 键（查看模式） | 在查看模式下按 ESC | emit('close') | P0 |
| CT-06 | 按 ESC 键（编辑模式） | 在编辑模式下按 ESC | 退出编辑模式（不 emit close） | P0 |
| CT-07 | 点击编辑 → 保存 | 编辑内容 → 点击保存 | 调用 execute('update')，成功后 emit('updated') | P1 |
| CT-08 | 点击编辑 → 取消 | 编辑内容 → 点击取消 | viewMode 恢复 view，内容不变 | P1 |
| CT-09 | 点击删除 → 确认 | 点击删除 → 确认 | 调用 execute('delete')，成功后 emit('deleted') | P1 |
| CT-10 | 点击删除 → 取消 | 点击删除 → 取消 | 确认弹窗关闭，不删除 | P1 |
| CT-11 | 保存时返回失败 | execute 返回 `{ success: false }` | 显示错误提示，不关闭编辑模式 | P1 |
| CT-12 | 保存空内容 | 清空内容 → 保存 | 允许保存空内容 | P2 |

### 7.3 Panel.vue 集成测试

| ID | 测试场景 | 操作 | 预期结果 | 优先级 |
|----|----------|------|----------|--------|
| IT-01 | 点击笔记进入详情 | 点击笔记条目 | 隐藏列表，显示 NoteDetail | P0 |
| IT-02 | 关闭详情回到列表 | NoteDetail emit('close') | selectedNote = null，显示列表 | P0 |
| IT-03 | 删除后回到列表 | NoteDetail emit('deleted') | selectedNote = null，列表刷新 | P1 |
| IT-04 | 更新后刷新列表 | NoteDetail emit('updated') | 调用 refresh() 刷新列表数据 | P1 |

---

## 8. 安全审查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| XSS — 笔记内容渲染 | ✅ 安全 | Vue 模板渲染自动转义 HTML，无 `v-html` 使用 |
| XSS — 标签文本渲染 | ✅ 安全 | 同上，Vue 自动转义 |
| 输入校验 — update args | ✅ 已覆盖 | id 非空检查，content/tags 可选字段 |
| 输入校验 — delete args | ✅ 已覆盖 | id 非空检查 |
| 权限控制 | ✅ 不涉及 | 所有操作在插件进程内完成，无跨插件数据访问 |
| 存储写入校验 | ✅ 已覆盖 | 写入前确保 notes 是有效数组 |
| 内存泄漏 | ✅ 已覆盖 | NoteDetail unmount 时清除状态，无全局事件绑定 |

---

## 9. 性能关注点

| 关注点 | 评估 | 说明 |
|--------|------|------|
| 视图切换延迟 | ✅ 无感知 | 纯前端状态切换，无网络请求，<16ms |
| 笔记内容渲染 | ✅ 无瓶颈 | 文本渲染无性能开销，百万字符才需虚拟滚动 |
| 持久化写入 | ✅ 可忽略 | `storage.set` 是异步写入，不阻塞 UI |
| 频繁刷新 | ⚠️ 需注意 | `refresh()` 会触发整个面板数据重新获取，不应在每次按键时调用 |

---

## 10. 交付验收标准（DoD）

| # | 标准 | 验证方式 |
|---|------|----------|
| 1 | 点击笔记卡片能在面板内展开详情 | 手动测试 |
| 2 | 详情视图展示完整 content（不截断） | 手动测试 + CT-01 |
| 3 | 详情视图展示所有 tags（标签样式） | 手动测试 + CT-02 |
| 4 | 返回/ESC/遮罩可关闭详情回到列表 | 手动测试 + CT-04/05 |
| 5 | 编辑 content 并保存后内容更新 | 手动测试 + CT-07 |
| 6 | 删除笔记并返回列表 | 手动测试 + CT-09 |
| 7 | 编辑时保存失败有错误提示 | CT-11 |
| 8 | 编辑时 ESC 先退出编辑模式，不关闭详情 | CT-06 |
| 9 | 所有单元测试通过 | UT-01~06 |
| 10 | 所有组件测试通过 | CT-01~12, IT-01~04 |

---

## 11. 变更影响范围分析

| 范围 | 影响 | 回滚策略 |
|------|------|----------|
| `index.ts` | 新增 update command，不影响已有命令 | 回滚：恢复旧版 index.ts |
| `Panel.vue` | 新增状态和条件渲染，不影响 openPage 行为 | 回滚：恢复旧版 Panel.vue |
| `NoteDetail.vue` | 全新文件，独立部署 | 回滚：在 Panel.vue 中移除导入 |
| `Page.vue` | 无影响 | 无需回滚 |
| 其他插件 | 无影响 | 无 |

---

## 12. 时间估算

| 模块 | 估时 | 负责人 |
|------|------|--------|
| `types.ts` + `index.ts` update command | 0.5h | 代码工程师 |
| `NoteDetail.vue` 组件实现 | 2h | 代码工程师 |
| `Panel.vue` 修改集成 | 1h | 代码工程师 |
| 单元测试编写 (UT-01~06) | 1h | 测试工程师 |
| 组件测试编写 (CT-01~12, IT-01~04) | 1.5h | 测试工程师 |
| 手动验收测试 | 0.5h | 测试工程师 |
| **合计** | **6.5h** | |
