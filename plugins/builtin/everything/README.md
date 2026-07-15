# Everything 搜索插件

MQBox 内置的 Everything 搜索集成插件。通过 ETP（Everything TCP Protocol）协议连接 Everything 服务，在 MQBox 内快速搜索文件。

## 功能概述

- 🔍 **文件搜索** — 通过 Everything ETP 服务搜索文件名，支持模糊匹配
- ⚙️ **配置界面** — 在插件管理器中可视化配置端口、超时时间、最大结果数
- 🔌 **搜索提供者** — 实现 MQBox `SearchProvider` 接口，支持快捷搜索唤醒
- ⚡ **即时生效** — 修改配置后立即生效，无需重启 MQBox

## 目录结构

```
plugins/builtin/everything/
├── src/
│   ├── index.ts          # 插件入口：命令注册、配置加载、搜索提供者
│   ├── Config.vue        # 配置界面组件（Vue 3）
│   └── everything.ts     # ETP 协议客户端：搜索逻辑、参数选项
├── dist/
│   ├── index.js          # 插件主模块（构建产物）
│   ├── Config.js         # 配置页面（构建产物）
│   └── style.css         # 配置页面样式（构建产物）
├── docs/                 # 文档目录
├── vite.config.ts        # Vite 构建配置（多入口）
├── package.json          # 插件元数据与配置声明
├── requirement_spec.md   # 需求规格说明
├── README.md             # 本文件
└── tsconfig.json         # TypeScript 配置
```

## 快速开始

### 前置条件

- MQBox 主应用已安装并运行
- Everything 桌面应用（v1.5 及以上）已安装并启用 ETP 服务
  - 在 Everything → **工具 → 选项 → ETP 服务器** 中启用
  - 默认端口：`26983`（与插件默认端口一致）

### 构建

```bash
cd plugins/builtin/everything
npm install      # 安装依赖（如未安装）
npm run build    # 构建插件
```

构建产物：
```
dist/
├── index.js      — 插件主模块（~2.6 KB）
├── Config.js     — 配置页面（~33 KB）
└── style.css     — 配置页面样式（~0.1 KB）
```

### 安装与使用

1. 构建完成后，插件自动注册到 MQBox
2. 在 MQBox 插件管理器中可看到 **Everything** 插件
3. 点击 **配置** 按钮（⚙️）进入配置界面
4. 设置 ETP 服务器参数，点击保存
5. 在搜索框中输入关键词，按 `Enter` 即可通过 Everything 搜索文件

### 配置项说明

| 配置项 | 默认值 | 范围 | 说明 |
|--------|--------|------|------|
| 端口 | `26983` | 1-65535 | Everything ETP 服务端口 |
| 超时时间 | `3000` ms | ≥100 ms | ETP 连接超时时间 |
| 最大结果数 | `20` | 1-999 | 搜索返回的最大文件数 |

> 配置自动持久化到 MQBox 存储系统，重启后保留。

## 搜索用法

在 MQBox 搜索框中输入关键词后按 `Enter`：

- 调起 `search` 命令 → 通过 ETP 协议向 Everything 查询
- 返回匹配文件名列表，格式：`文件名 (路径)`
- 选中结果可打开文件所在目录

## 开发者

### 构建配置

`vite.config.ts` 使用多入口构建：
- `src/index.ts` → `dist/index.js`（插件主模块）
- `src/Config.vue` → `dist/Config.js`（配置页面）

### 存储 API

插件使用 MQBox 的 `context.storage` API 进行配置持久化：
- `storage.getItem('config')` — 读取配置
- `storage.setItem('config', JSON.stringify(config))` — 保存配置

需在 `package.json` 的 `mqbox.permissions` 中添加 `"storage"` 权限。

## 许可

内置插件，随 MQBox 分发。
