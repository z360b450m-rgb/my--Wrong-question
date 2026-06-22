# 从零做一遍这个项目 · 完整流程清单

把这套 **notes-app（Electron 错题本）+ RAG-AIAgent（本地 RAG 服务）** 从空白机器一步一步搭起来要做什么，全在这。按顺序读。

---

## 〇、项目最终长什么样

- **前端**：Vue 3 + Electron 桌面错题本，内嵌 AI 问答侧栏，支持多知识库
- **后端**：Python FastAPI + LangGraph，跑本地 RAG（DeepSeek + 中文 Embedding + Chroma 向量库）
- **协作**：错题保存自动同步进 RAG 索引；提问可锁定单题或全库检索

部署形态：**两个服务都跑在本机**，前端 `localhost:5173`，后端 `localhost:8000`。

---

## 一、前置软件准备（一次性）

| 软件 | 版本 | 干啥用 | 装法 |
|---|---|---|---|
| **Git** | 任意新版 | 版本控制 | https://git-scm.com/ |
| **Node.js** | ≥ 20 LTS | 前端构建 / Electron | https://nodejs.org/ ，含 npm |
| **Python** | ≥ 3.11 | 后端 RAG 服务 | https://www.python.org/ ；安装时勾上 "Add to PATH" |
| **VS Code** | 任意 | 编辑器 | https://code.visualstudio.com/ |
| **Chrome 或 Edge** | 任意 | 浏览器 + 调试 | 系统自带或下载 |

### 推荐 VS Code 插件

| 插件 | 作用 |
|---|---|
| Volar (Vue Official) | Vue 3 + TypeScript 支持 |
| Tailwind CSS IntelliSense | Tailwind 工具类补全 |
| ESLint | 代码规范 |
| Prettier | 自动格式化 |
| Python | 后端调试 |
| Pylance | Python 类型检查 |

### 命令行环境

Windows 用户推荐 **Git Bash**（Git 自带）或 **PowerShell 7+**，不要用 cmd（编码会爆炸）。

---

## 二、申请外部服务（一次性）

### 2.1 DeepSeek API Key（**必需，主 LLM**）

1. 打开 https://platform.deepseek.com/
2. 注册账号
3. 充值（最少 1 元就够测试用大半天）
4. 控制台 → API Keys → 创建 → 复制 `sk-xxxxx...`
5. **存好这个 key，下面要写进 `.env` 文件**

**为什么选 DeepSeek**：国产、便宜、OpenAI 兼容接口、支持中文好。

### 2.2 HuggingFace（**可选**，加速模型下载）

中国大陆环境下从 huggingface.co 直连慢，配镜像 `https://hf-mirror.com`：
- 在 `.env` 里加 `HF_ENDPOINT=https://hf-mirror.com`，或
- 设系统环境变量 `HF_ENDPOINT`

不配也能跑，就是首次下 embedding 模型（约 100MB）会慢。

### 2.3 不需要 OpenAI Key

embedding 用本地 HuggingFace 模型，整个项目只调 DeepSeek API。

---

## 三、初始化项目结构

```bash
mkdir -p E:/01_Dev_Projects/Vibe_Coding
cd E:/01_Dev_Projects/Vibe_Coding
```

两个项目并列存放：

```
E:/01_Dev_Projects/Vibe_Coding/
├── RAG-AIAgent/    # 后端
└── notes-app/      # 前端
```

---

## 四、搭后端 RAG-AIAgent

### 4.1 建项目骨架

```bash
mkdir RAG-AIAgent && cd RAG-AIAgent
mkdir -p src data/notes
```

### 4.2 装 Python 依赖

新建 `requirements.txt`：

```
# LangChain / LangGraph 核心
langchain>=0.3.0
langchain-core>=0.3.0
langchain-openai>=0.2.0
langchain-community>=0.3.0
langchain-huggingface>=0.1.0
langchain-chroma>=0.1.4
langgraph>=0.2.40
langgraph-checkpoint-sqlite>=2.0.0

# 向量库 / 检索 / 重排
chromadb>=0.5.0
sentence-transformers>=3.0.0
rank-bm25>=0.2.2

# Embedding / Reranker 后端
torch>=2.1.0
transformers>=4.40.0
huggingface-hub>=0.23.2,<1.0

# Web 接口
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sse-starlette>=2.1.0

# 文档解析
pypdf>=4.0.0

# 工具
pydantic>=2.0.0
python-dotenv>=1.0.0
```

执行：

```bash
pip install -r requirements.txt
```

**注意**：transformers 和 huggingface-hub 有版本耦合，按上面这套 `<1.0` 约束装，否则会冲突。

### 4.3 配置环境变量

新建 `.env`（不要提交到 git）：

```bash
# DeepSeek
DEEPSEEK_API_KEY=sk-你的key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_CHAT_MODEL=deepseek-chat
DEEPSEEK_REASONER_MODEL=deepseek-reasoner

# 本地中文 Embedding / Reranker
EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5
RERANKER_MODEL=BAAI/bge-reranker-base

# 持久化路径
CHROMA_PERSIST_DIR=./chroma_db
SQLITE_CHECKPOINT_PATH=./checkpoints.sqlite
DATA_DIR=./data

# 检索参数
RECALL_TOP_K=10
RERANK_TOP_K=4

# API
API_HOST=0.0.0.0
API_PORT=8000

# 可选：HF 镜像
# HF_ENDPOINT=https://hf-mirror.com
```

### 4.4 写代码文件

按 [TECH_OVERVIEW.md](TECH_OVERVIEW.md) 的结构写 `src/` 下的模块：

| 文件 | 职责 |
|---|---|
| `src/__init__.py` | 空文件，标记 package |
| `src/config.py` | 加载 .env、DeepSeek LLM 工厂、Embedding 工厂 |
| `src/state.py` | `AgentState` / `AgentResponse` / `RouteDecision` 等 Pydantic schema |
| `src/kb.py` | 知识库注册表、`kb_registry.json` 读写 |
| `src/retrieval.py` | Chroma + BM25 混合检索 + Reranker |
| `src/entries.py` | 错题 upsert/delete 同步逻辑 |
| `src/nodes.py` | LangGraph 节点函数（路由 / 改写 / 检索 / 评分 / 生成） |
| `src/graph.py` | StateGraph 装配 + SqliteSaver |
| `src/ingest.py` | 命令行入库脚本 |
| `src/api.py` | FastAPI 路由：`/chat /chat/stream /chat/entry /entries/* /kbs /ingest` |

代码逻辑直接看 `TECH_OVERVIEW.md` 第三章「核心算法」和第五章「API 速查」。

### 4.5 数据准备

```bash
mkdir data/notes
# 把你要 RAG 检索的 PDF / MD 拷进 data/notes/
```

### 4.6 首次启动 + 入库

```bash
# 文档入库（首次会下载 bge 模型，约 100MB）
python -m src.ingest --kb notes --reset

# 起服务
uvicorn src.api:app --host 0.0.0.0 --port 8000
```

打开 http://localhost:8000/docs 看 Swagger，能看到 `/chat`、`/kbs` 这些端点说明 OK。

### 4.7 常见坑

| 现象 | 原因 | 解决 |
|---|---|---|
| `huggingface-hub>=0.23.2,<1.0 required` | 版本冲突 | `pip install "huggingface-hub>=0.23.2,<1.0"` |
| `Connection broken: IncompleteRead` | HF 模型下载断 | 配 `HF_ENDPOINT=https://hf-mirror.com` 重试 |
| 终端中文乱码 / UnicodeEncodeError | Windows GBK 终端不认 emoji | print 不用 emoji |
| `Method Not Allowed` | 浏览器直接 GET `/chat` | `/chat` 是 POST，看 `/docs` 测试 |
| 答案是 "Connection error" 字符串 | DeepSeek 瞬时网络抖动被 SDK 吞 | 已内置 3 次指数退避重试 |

---

## 五、搭前端 notes-app

### 5.1 用脚手架建项目

```bash
cd E:/01_Dev_Projects/Vibe_Coding
npm create vite@latest notes-app -- --template vue-ts
cd notes-app
npm install
```

### 5.2 加 Electron + Tailwind + 工具链

```bash
# Electron
npm install -D electron electron-builder vite-plugin-electron vite-plugin-electron-renderer

# Tailwind
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p

# 代码规范
npm install -D eslint prettier eslint-plugin-vue @typescript-eslint/parser @typescript-eslint/eslint-plugin husky lint-staged

npx husky init
```

### 5.3 配置文件

| 文件 | 作用 | 关键配置 |
|---|---|---|
| `vite.config.ts` | Vite 配置 | 加 electron 插件，配 `@` 别名指向 `src/` |
| `tailwind.config.js` | Tailwind 配置 | `content: ['./index.html', './src/**/*.{vue,ts}']`，`darkMode: 'class'`，自定义 `accent` 色 |
| `postcss.config.js` | PostCSS | 引入 tailwindcss + autoprefixer |
| `tsconfig.json` / `tsconfig.app.json` | TS 配置 | `paths: { "@/*": ["./src/*"] }` |
| `.eslintrc` / `eslint.config.js` | ESLint | Vue + TS 规则 |
| `.prettierrc` | Prettier | 项目格式风格 |
| `.husky/pre-commit` | Git hook | 跑 `npm run lint` 阻止脏代码进库 |
| `electron/main.ts` | Electron 主进程 | 创建 BrowserWindow、加载 Vite dev URL 或打包后的 dist |
| `electron/preload.ts` | Electron preload | 暴露安全 API 给 renderer |

### 5.4 src 目录组织

```
src/
├── App.vue                  # 根组件
├── main.ts                  # 入口
├── style.css                # Tailwind @tailwind 指令
├── components/              # 所有 .vue 组件（见 TECH_OVERVIEW）
├── composables/             # 组合式逻辑（useEntries / useAiChat / ...）
├── services/db.ts           # IndexedDB 封装
├── types/index.ts           # NoteEntry / AiSkill 等类型
└── utils/                   # 工具函数
```

### 5.5 关键 composable 写法（按顺序写）

1. **`useEntries`** — 错题 CRUD（IndexedDB）
2. **`useNotebooks`** — 笔记本切换
3. **`useReview`** — SRS 间隔重复
4. **`useDarkMode`** — 暗黑模式切换
5. **`useAiChat`** — 调 `/chat/stream`，手写 SSE 解析（**关键**：分隔符要同时支持 `\r\n\r\n` 和 `\n\n`）
6. **`useAiSkills`** — Skill 系统，localStorage 持久化
7. **`useKnowledgeBases`** — KB 列表，调 `/kbs` 接口
8. **`useRagSync`** — 错题保存时静默同步 RAG，失败不阻塞

详见 `TECH_OVERVIEW.md` 第六章数据流图。

### 5.6 启动开发模式

```bash
npm run dev
```

打开 http://localhost:5173/。

### 5.7 常见坑

| 现象 | 原因 | 解决 |
|---|---|---|
| 5173 / 5174 被占 | 旧进程没关 | `netstat -ano | grep :5173` 找 PID，PowerShell `Stop-Process -Id N -Force` |
| CORS 错 | 后端没装 CORSMiddleware | api.py 加 `app.add_middleware(CORSMiddleware, allow_origins=['*'], ...)` |
| 侧栏聊天显示空 | SSE 解析卡 `\r\n\r\n` | 看 `useAiChat.ts` 的 `findSep` 函数 |
| 侧栏聊天显示 "Connection error" | 后端 DeepSeek 抖动 | 后端 nodes.py 加 `_invoke_with_retry` |
| Vue 响应式不更新 | 闭包持有原始对象 | push 进数组后用 `arr[arr.length-1]` 取代理引用 |
| TS 报 `Property 'at' does not exist` | tsconfig 没开 ES2022 | 改用 `arr[arr.length-1]` 替代 `arr.at(-1)` |
| `Property 'confirm' does not exist` | template 里直接用 `confirm()` | setup 里包一层 `function confirmAsk(msg) { return window.confirm(msg) }` |

---

## 六、前后端联调

### 6.1 启动顺序

```bash
# Terminal 1：后端
cd E:/01_Dev_Projects/Vibe_Coding/RAG-AIAgent
uvicorn src.api:app --host 0.0.0.0 --port 8000

# Terminal 2：前端
cd E:/01_Dev_Projects/Vibe_Coding/notes-app
npm run dev
```

### 6.2 验证清单

1. `curl http://localhost:8000/health` → `{"status":"ok"}`
2. `curl http://localhost:8000/kbs` → 返回默认 `notes` 库
3. 浏览器 http://localhost:5173/ → 能看到笔记本界面
4. 新建一条错题 → 保存 → 后端控制台看到 `POST /entries/upsert 200`
5. 打开任意错题 → 右侧 AI 侧栏顶部显示「当前错题」蓝色 chip
6. 输入"这题怎么做"→ 流式输出能看到节点进度 → 最终给出答案 + 置信度

### 6.3 验证多知识库

1. 设置面板 → 知识库 → 新建 ID=`test`、名称=`测试库`
2. 点这一行的「路径」按钮 → 剪贴板得到 `E:\...\RAG-AIAgent\data\test\` 路径
3. 文件资源管理器粘贴打开 → 拷个 PDF 进去
4. 设置面板 → 点这一行「重建」按钮
5. 错题编辑页顶部 KB 下拉切到「测试库」→ 保存
6. AI 侧栏（全库模式）顶部 KB 选「测试库」→ 提问命中新 PDF

---

## 七、打包发布

### 7.1 后端打包（可选）

后端是 Python，**通常不打包**，直接配 `requirements.txt` + 启动脚本就行。需要分发给非技术用户时才考虑 PyInstaller：

```bash
pip install pyinstaller
pyinstaller --onefile --add-data ".env;." -n rag-server src/api.py
```

但有几个坑：
- LangChain 动态 import 多，要加 `--collect-all langchain`
- HuggingFace 模型路径要重定向
- Chroma 含 SQLite 依赖

**推荐做法**：写一个 `start.bat` / `start.sh` 启动脚本，配 README 让用户装 Python 再跑。

### 7.2 前端打包（Electron）

`package.json` 配置 `build` 字段：

```json
{
  "scripts": {
    "build": "vue-tsc --noEmit && vite build && electron-builder"
  },
  "build": {
    "appId": "com.yourname.notesapp",
    "productName": "错题本",
    "directories": { "output": "dist-electron" },
    "files": ["dist/**/*", "electron/**/*"],
    "win": { "target": "nsis" },
    "mac": { "target": "dmg" },
    "linux": { "target": "AppImage" }
  }
}
```

执行：

```bash
npm run build
```

产物在 `dist-electron/` —— Windows 是 `.exe` 安装包，Mac 是 `.dmg`。

### 7.3 桌面端访问后端

**默认 Electron 应用打开后**会调 `http://localhost:8000` —— 用户必须先跑后端。

更友好的做法：让 Electron 主进程**自动起 Python 后端子进程**。在 `electron/main.ts`：

```ts
import { spawn } from 'child_process'
const py = spawn('python', ['-m', 'uvicorn', 'src.api:app'], { cwd: '...' })
app.on('quit', () => py.kill())
```

但这需要用户机器装好 Python 环境。**最简单：先让用户手动起两个进程**，等用户量起来再做合包。

---

## 八、Git 工作流

### 8.1 两个仓库还是一个 monorepo？

**推荐**：两个独立仓库

```bash
# 后端
cd RAG-AIAgent
git init
git add .
git commit -m "init"

# 前端
cd ../notes-app
git init
git add .
git commit -m "init"
```

`.gitignore` 必须包含：

**RAG-AIAgent/.gitignore**
```
.env
__pycache__/
*.pyc
chroma_db/
checkpoints.sqlite
data/
kb_registry.json
.venv/
```

**notes-app/.gitignore**
```
node_modules/
dist/
dist-electron/
.vite/
*.tsbuildinfo
.env.local
```

### 8.2 推 GitHub

```bash
gh repo create your-name/rag-aiagent --private --source=. --push
gh repo create your-name/notes-app --private --source=. --push
```

### 8.3 关键：永远不要把 `.env` 推上去

`.env` 里有 DeepSeek API key —— 推上 GitHub 等于送钱。先确认 `.gitignore` 生效再 `git add`。

---

## 九、配置一份"AI 指令库"备份（可选但推荐）

调教好的 skill 存在 localStorage，换机器就丢。建议：

1. 在 notes-app 设置面板 → AI 指令库 → 点「导出」
2. 把下载的 JSON 拷到 `notes-app/skills-backup/my-skills.json`
3. git 提交（这个文件可以推）

新机器 git clone 之后，导入这个 JSON 就恢复了。

---

## 十、整体启动顺序（每天用的时候）

```bash
# 1. 起后端
cd E:/01_Dev_Projects/Vibe_Coding/RAG-AIAgent
uvicorn src.api:app --host 0.0.0.0 --port 8000
# 看到 "Uvicorn running on http://0.0.0.0:8000" 就 OK

# 2. 起前端（另开终端）
cd E:/01_Dev_Projects/Vibe_Coding/notes-app
npm run dev
# 看到 "Local: http://localhost:5173/" 就 OK

# 3. 浏览器打开 http://localhost:5173/
```

完事关掉两个终端就行（Ctrl + C）。错题数据在浏览器 IndexedDB 里，重启不会丢；RAG 索引在 `RAG-AIAgent/chroma_db/`，也不会丢。

---

## 十一、调试技巧

| 场景 | 工具 |
|---|---|
| 看 RAG 内部决策（路由 / 改写 / 评分） | 后端终端有 `--- [Node] xxx ---` 打印 |
| 看前端 SSE 数据 | F12 → Network → 找 `chat/stream` → EventStream tab |
| 看 IndexedDB | F12 → Application → IndexedDB |
| 看 localStorage（skill / KB 选择） | F12 → Application → Local Storage |
| Vue 组件状态 | 装 Vue Devtools 浏览器扩展 |
| Python 类型 / 报错堆栈 | `uvicorn ... --log-level debug` |
| TS 类型检查 | `npx vue-tsc --noEmit -p tsconfig.app.json` |

---

## 十二、再要扩展看哪里

`TECH_OVERVIEW.md` 第七章「扩展实施指南」—— 11 个常见扩展（OCR / LangSmith / Prompt Caching / 多模态 / ...），每个都标了改哪些文件、工程量、关键代码点。

---

## 十三、备忘：项目复制粘贴清单

如果以后想在别的电脑搭一份：

1. 装好 Git / Node 20+ / Python 3.11+
2. `git clone` 两个仓库
3. **RAG-AIAgent**：
   - 拷一份 `.env`（含你的 DeepSeek key）
   - `pip install -r requirements.txt`
   - 把要 RAG 的 PDF 放到 `data/notes/`
   - `python -m src.ingest --kb notes --reset`
   - `uvicorn src.api:app --host 0.0.0.0 --port 8000`
4. **notes-app**：
   - `npm ci`
   - `npm run dev`
5. 浏览器开 http://localhost:5173/
6. 如果有 skill 备份，设置面板 → AI 指令库 → 导入 JSON

完事。
