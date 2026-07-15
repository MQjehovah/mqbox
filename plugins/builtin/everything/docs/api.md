# Everything 插件 API 参考

> 自动从代码提取，更新时间: 2026-07-15

## 插件入口 — `src/index.ts`

### 导出接口

#### `activate(context: MQBoxContext): void`

插件激活入口。在 MQBox 加载插件时自动调用。

**参数：**
| 名 | 类型 | 说明 |
|---|------|------|
| context | `MQBoxContext` | 插件运行时上下文 |

**行为：**
1. 注册 `search` 命令，绑定搜索功能
2. 注册 `saveConfig` 命令，绑定配置持久化
3. 将 `search` 暴露为 `SearchProvider` 供全局搜索框调用
4. 加载已有配置到上下文

**命令清单：**

| 命令 ID | 名称 | 说明 |
|---------|------|------|
| `search` | 搜索 | 调起 Everything ETP 搜索 |
| `saveConfig` | 保存配置 | 持久化配置项 |

---

#### `deactivate(context: MQBoxContext): void`

插件停用钩子（可选）。MQBox 卸载插件时调用。

---

#### `search(query: string): Promise<SearchResult[]>`

实现 `SearchProvider` 接口的搜索方法。

**参数：**
| 名 | 类型 | 说明 |
|---|------|------|
| query | `string` | 搜索关键词 |

**返回：** `Promise<SearchResult[]>` — 搜索结果数组

**SearchResult 结构：**
| 字段 | 类型 | 说明 |
|------|------|------|
| name | `string` | 文件名 |
| path | `string` | 文件完整路径 |
| description | `string` | 格式: `文件名 (路径)` |

---

#### `saveConfig(config: EverythingConfig): Promise<void>`

保存插件配置到持久化存储。

**参数：**
| 名 | 类型 | 说明 |
|---|------|------|
| config | `EverythingConfig` | 配置对象 |

**EverythingConfig 结构：**
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| port | `number` | `26983` | ETP 服务端口 |
| timeout | `number` | `3000` | 连接超时时间（毫秒） |
| maxResults | `number` | `20` | 最大返回结果数 |

---

## ETP 客户端 — `src/everything.ts`

### 导出函数

#### `search(query: string, options?: SearchOptions): Promise<SearchResult[]>`

通过 ETP 协议连接 Everything 服务执行搜索。

**参数：**
| 名 | 类型 | 说明 |
|---|------|------|
| query | `string` | 搜索关键词 |
| options | `SearchOptions`（可选） | 搜索选项 |

**SearchOptions 结构：**
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| port | `number` | `26983` | ETP 服务端口 |
| timeout | `number` | `3000` | 连接超时时间（毫秒） |
| maxResults | `number` | `20` | 最大返回结果数 |

**返回：** `Promise<SearchResult[]>`

**SearchResult：**
| 字段 | 类型 | 说明 |
|------|------|------|
| name | `string` | 文件名 |
| path | `string` | 完整路径 |

**搜索行为：**
- 连接到 `localhost:{port}` 的 ETP 服务
- 发送 ETP 搜素请求，匹配文件名
- 按 `maxResults` 限制返回条数
- 超时未响应则返回空列表

**异常处理：**
| 场景 | 行为 |
|------|------|
| 连接失败 | 返回空数组 `[]` |
| 超时 | 返回空数组 `[]` |
| 协议错误 | 返回空数组 `[]` |

---

## 配置界面 — `src/Config.vue`

Vue 3 组件，通过 MQBox 插件管理器的配置入口加载。

### Props / Bindings

| 字段 | 类型 | 默认值 | 控件 | 说明 |
|------|------|--------|------|------|
| port | `number` | `26983` | `<input type="number">` | ETP 端口 |
| timeout | `number` | `3000` | `<input type="number">` | 超时（ms） |
| maxResults | `number` | `20` | `<input type="number">` | 最大结果数 |

### UI 行为

| 事件 | 行为 |
|------|------|
| 页面加载 | 🌱 从 `context.storage` 加载已有配置填充表单 |
| 点击「保存」 | ✅ 通过 `context.invokeCommand('saveConfig', config)` 保存 |
| 点击「取消」 | ❌ 返回插件管理列表 |
| 输入校验 | 端口 1-65535，超时 ≥100，结果数 1-999 |

### 存储 API

| 调用 | 说明 |
|------|------|
| `context.storage.getItem('config')` | 读取配置 JSON |
| `context.storage.setItem('config', JSON.stringify(config))` | 写入配置 JSON |

---

## 类型汇总

### `EverythingConfig`

```typescript
interface EverythingConfig {
  port: number;       // 默认 26983
  timeout: number;    // 默认 3000 (ms)
  maxResults: number; // 默认 20
}
```

### `SearchOptions`

```typescript
interface SearchOptions {
  port?: number;
  timeout?: number;
  maxResults?: number;
}
```

### `SearchResult`

```typescript
interface SearchResult {
  name: string;
  path: string;
  description?: string; // 由 index.ts 的 search() 补充
}
```
