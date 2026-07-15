# ADR-001: Everything 插件配置界面实现方案

## 状态

✅ Accepted

## 背景

Everything 插件缺少可视化配置界面，端口(26983)、超时时间(3000ms)、最大结果数(20)全部硬编码在 `everything.ts` 中。用户需要修改配置时必须直接编辑代码。

需求：
- 提供可视化配置界面（在插件管理器中点击⚙️打开）
- 支持端口、超时时间、最大结果数三項配置
- 配置需持久化，重启后保留
- 修改后即时生效

## 决策

采纳 **方案 A：插件层独立实现**（详见 `requirement_spec.md` 方案对比）

## 设计

### 配置存储

使用 MQBox 的 `context.storage` API 存储配置 JSON，不自建文件读写。

```typescript
// 写入
context.storage.setItem('config', JSON.stringify({
  port: 26983,
  timeout: 3000,
  maxResults: 20
}))

// 读取
const config = JSON.parse(context.storage.getItem('config'))
```

理由：
- 统一存储 API，无需处理文件路径和权限
- 框架层已实现持久化（磁盘写），插件无需关心

### 配置界面

Vue 3 单文件组件，通过 Vite 多入口独立构建为 `dist/Config.js`。

**控件布局：**
```
端口:        [ 26983 ]     范围 1-65535
超时(ms):    [ 3000  ]     范围 ≥100
最大结果数:  [ 20    ]     范围 1-999
[ 保存 ]  [ 取消 ]
```

**数据流：**
```
页面加载 → storage.getItem('config') → 填充表单
点击保存 → invokeCommand('saveConfig', formData) → storage.setItem → 通知完成
```

### 命令注册

在 `index.ts` 中注册两个命令：

| 命令 | 触发方式 | 行为 |
|------|----------|------|
| `search` | 搜索框 Enter | 调起 ETP 搜索 |
| `saveConfig` | Config.vue 保存 | 持久化到 storage |

### 搜索提供者

将 `search` 命令暴露为 `SearchProvider`，注册到 MQBox 搜索框架。用户在搜索框输入关键词按 Enter 时自动调起。

## 影响

### 正面
- ✅ 用户无需编辑代码即可修改配置
- ✅ 配置持久化，重启保留
- ✅ 修改即时生效（每次搜索重新读取配置）
- ✅ 插件层独立实现，不阻塞框架改造

### 负面
- ❌ 配置项只包含三个字段，未来扩展需改代码
- ❌ 无「测试连接」按钮（已列入 TODO）
- ⚠️ 需在 `package.json` 中添加 `storage` 权限声明

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/index.ts` | 插件入口：命令注册、配置加载、搜索提供者 |
| `src/Config.vue` | 配置界面 Vue 组件 |
| `src/everything.ts` | ETP 客户端（接收 options 参数） |
| `package.json` | 插件元数据 + 配置声明 + 权限 |
| `vite.config.ts` | 多入口构建配置 |
| `requirement_spec.md` | 需求规格 + 方案对比 |
