# notes-app + RAG-AIAgent 完整技术档案

## 一、项目结构

```
notes-app/                          # 前端 Electron + Vue 应用
└── src/
    ├── components/                 # Vue 组件层
    ├── composables/                # 组合式逻辑 (Vue 3 composable)
    ├── services/                   # 数据持久化层
    ├── types/                      # TypeScript 类型
    └── utils/                      # 工具函数

RAG-AIAgent/                        # 后端 Python RAG 服务
├── src/
│   ├── api.py                      # FastAPI 路由
│   ├── graph.py                    # LangGraph 工作流装配
│   ├── nodes.py                    # 状态机节点
│   ├── state.py                    # AgentState / 结构化输出
│   ├── retrieval.py                # 混合检索 + 重排
│   ├── ingest.py                   # 文档入库
│   ├── entries.py                  # 错题实时同步
│   ├── kb.py                       # 知识库注册表
│   └── config.py                   # DeepSeek + Embedding 配置
├── data/<kb_id>/                   # 各知识库源文档
├── chroma_db/                      # 向量库持久化
├── checkpoints.sqlite              # LangGraph 会话状态
└── kb_registry.json                # 知识库元数据
```

---

## 二、技术栈

### 前端 (notes-app)

| 类别 | 技术 | 版本 / 说明 |
|---|---|---|
| 框架 | **Vue 3** | Composition API + `<script setup>` |
| 桌面壳 | **Electron** | 跨平台桌面应用 |
| 构建工具 | **Vite 6** | 开发服务器 + 打包 |
| 语言 | **TypeScript** | 全量类型化 |
| 样式 | **Tailwind CSS** | 工具类 + PostCSS + 暗黑模式 |
| 本地存储 | **IndexedDB** | 错题主数据（通过 `db.ts`） |
| 偏好存储 | **localStorage** | AI Skills / 选中 KB |
| 代码规范 | ESLint + Prettier + Husky | Git hook 自动格式化 |
| 网络 | 原生 **fetch + ReadableStream** | 零额外 HTTP 依赖，手写 SSE 解析 |

### 后端 (RAG-AIAgent)

| 类别 | 技术 | 用途 |
|---|---|---|
| 语言 | **Python 3.11+** | |
| Web 框架 | **FastAPI** | REST + SSE 端点 |
| ASGI 服务器 | **Uvicorn** | |
| 流式响应 | **sse-starlette** | Server-Sent Events |
| Agent 编排 | **LangChain 0.3** + **LangGraph 0.2** | 状态机工作流 |
| LLM 客户端 | **langchain-openai** | OpenAI 兼容协议接 DeepSeek |
| 持久化 | **langgraph-checkpoint-sqlite** | 多轮会话状态 |
| 校验 | **Pydantic 2** | 结构化输出 schema |
| CORS | **FastAPI CORSMiddleware** | 跨域支持 |
| 环境配置 | **python-dotenv** | `.env` 加载 |

### 模型与算法依赖

| 类别 | 选型 | 备注 |
|---|---|---|
| 主 LLM | **DeepSeek `deepseek-chat`** | OpenAI 兼容接口（`base_url=https://api.deepseek.com/v1`） |
| 备用 LLM | **DeepSeek `deepseek-reasoner`** | 复杂推理场景（已配置未默认启用） |
| 中文 Embedding | **BAAI/bge-small-zh-v1.5** | HuggingFace 本地推理，512 维 |
| Reranker | **BAAI/bge-reranker-base** | CrossEncoder；模型不可用时**自动降级**为向量相似度排序 |
| 向量库 | **Chroma** | 本地持久化，多 collection |
| 关键词检索 | **rank-bm25** | LangChain `BM25Retriever` |
| 文档切分 | **RecursiveCharacterTextSplitter** | chunk_size=500，overlap=80 |
| PDF 解析 | **pypdf** | 按页提取文本（文字层 PDF） |

---

## 三、核心算法

### 1. LangGraph 状态机（全库 RAG 流程）

```
┌──────────────┐
│ route_question│ ──── chat ────► generate_direct_chat ─► END
└──────┬───────┘
       │ rag
       ▼
┌──────────────┐
│ rewrite_query│
└──────┬───────┘
       ▼
┌──────────────┐
│  retrieve    │  (hybrid_recall + rerank)
└──────┬───────┘
       ▼
┌──────────────┐
│grade_documents│
└──┬───────────┘
   ├── docs empty ──► generate_direct_chat (fallback) ─► END
   └── docs valid ──► generate_rag_answer ─► END
```

| 节点 | 行为 | LLM |
|---|---|---|
| `route_question` | 判定 chat / rag | `deepseek-chat` + 结构化输出 `RouteDecision` |
| `rewrite_query` | 优化检索查询（去寒暄、保留实体） | `deepseek-chat` + `RewriteResult` |
| `retrieve` | 当前 KB 内混合检索 + 重排 | 无 LLM |
| `grade_documents` | 逐 chunk 判定 `relevant: bool` | `deepseek-chat` + `GradeDecision` |
| `generate_rag_answer` | 基于上下文生成 | `deepseek-chat` + `AgentResponse` |
| `generate_direct_chat` | 无文档直答 / 闲聊 / fallback | `deepseek-chat` + `AgentResponse` |

### 2. 混合检索 + 重排（Hybrid RAG）

```
查询
 ├── Chroma 向量相似度召回 (top_k=10)
 └── BM25 关键词召回 (top_k=10)
        ↓
    去重合并
        ↓
   CrossEncoder 重排 (top_k=4)
   (bge-reranker 或 fallback 向量序)
        ↓
    返回 chunk 文本
```

### 3. Entry 锁定模式（针对当前错题）

`/chat/entry` 端点**跳过**路由 / 检索 / 评分，把当前错题作为唯一上下文直接调生成节点 —— 保证 100% 不跑偏到别的题。

### 4. 结构化输出强约束

所有 LLM 调用都用 `.with_structured_output(<Pydantic Schema>, method="function_calling")` —— Pydantic 校验失败抛错，避免前端解析 Markdown 抖动。

| Schema | 字段 |
|---|---|
| `AgentResponse` | `answer / sources / confidence_score` |
| `RouteDecision` | `destination: "chat" \| "rag"` |
| `RewriteResult` | `rewritten: str` |
| `GradeDecision` | `relevant: bool` |

### 5. 重试与降级

| 失败场景 | 策略 |
|---|---|
| DeepSeek API 抖动 | `_invoke_with_retry`：3 次指数退避 (0.6s/1.2s/2.4s) |
| 重试仍失败 | 返回 `[服务暂不可用] <错误类型>` 明确标记，confidence=0.0 |
| Reranker 模型不可用 | 自动 fallback 用向量相似度顺序 |
| 检索失败 / 0 文档 | 自动 fallback 到 `generate_direct_chat` |
| RAG 服务挂掉 | 前端 4 秒超时 + 静默捕获，不影响错题保存 |
| 浏览器 GBK 终端 | 移除 emoji print 防 UnicodeEncodeError |

### 6. 数据同步策略

| 触发 | 行为 |
|---|---|
| 错题保存 (`saveEntry`) | `POST /entries/upsert` —— 先全 KB 删旧 chunk，再写到目标 KB |
| 错题删除 (`deleteCurrent`) | `POST /entries/delete` —— 全 KB 删 |
| 错题改名 (`updateEntryTitle`) | `POST /entries/upsert` |
| KB 切换 | upsert 自动处理跨库迁移，不留残留 |
| 失败 | 静默 + `console.warn`，**不阻塞 IndexedDB 主流程** |

### 7. SSE 流式协议

```
event: node\r\n
data: {"node":"route_question","patch":{"route":"rag"}}\r\n
\r\n
event: final\r\n
data: {"answer":"...","sources":[...],"confidence_score":0.95}\r\n
\r\n
```

前端用 `fetch` + `ReadableStream` 手写解析，同时兼容 `\r\n\r\n` 和 `\n\n` 分隔符。

---

## 四、功能总览

### 1. notes-app 错题本

- 错题 CRUD（题目 / 我的错误答案 / 正确答案与解析 / 学科 / 来源 / 标签 / 知识库归属）
- 富文本编辑 + 图片粘贴 + 截图 + 摄像头拍照 + 图片裁剪与滤镜
- Canvas 手写绘图
- 多 Notebook 笔记本切换
- 复习模式 + SRS 间隔重复 + 复习历史时间线
- 统计面板
- PDF 批量导入
- 数据备份 / 导出
- 暗黑模式
- 桌面 / Web 双模式（Electron + Vite）

### 2. RAG 智能问答 ⭐

**三种问答模式**

| 模式 | 端点 | 检索 |
|---|---|---|
| 锁定当前错题 | `/chat/entry` | 跳过检索，错题原文做唯一上下文 |
| 全库 RAG | `/chat/stream` | LangGraph 完整流程 |
| 全库同步 | `/chat` | 同上但非流式 |

**侧栏 UI**

- 编辑模式自动出现 340px 侧栏
- 头部胶囊显示「当前错题 / 全库」scope
- 全库模式头部下拉切换 KB
- 流式输出 + 节点进度展示 + 来源 details 折叠
- 置信度显示
- 切换错题自动清空对话防串题

### 3. AI 指令库 / Skill 系统

- 输入 `/<触发词> <问题>` 触发自定义 system prompt
- localStorage 持久化
- 内置 3 个示例：`/讲解`（苏格拉底引导）、`/答`（极简）、`/口诀`（记忆口诀）
- 可视化编辑器（设置面板内）：名称 / 触发词 / 描述 / 适用范围 / system prompt
- 启用复选框 / 删除 / 重置
- JSON 导入导出（跨设备迁移）
- 输入框实时显示「✓ 已应用 XX」+ 可用指令速查列表
- skill 与默认 prompt 是**追加关系不是覆盖**，保留 RAG 上下文

### 4. 多知识库系统

- 每个 KB = 独立 Chroma collection + 独立 BM25 + 独立 `data/<id>/` 目录
- 设置面板「知识库」区：列表 / 新建 / 改名 / 删除 / 复制路径到剪贴板 / 一键重建索引
- 默认 `notes` 错题库不可删
- 错题编辑页 📚 下拉选择归属 KB
- 全库聊天模式头部 📚 下拉切换检索范围
- KB 切换后聊天自动清空
- 删除 KB 自动清 collection 数据但**保留物理文件夹**防误删
- 跨 KB 错题迁移：upsert 自动清旧 chunk

### 5. 文档入库

- 支持 `.md` / `.txt` / `.markdown` / `.pdf`
- PDF 按页切分，metadata 带 `page` 字段便于回溯
- 命令行 `python -m src.ingest --kb <id> --reset`
- 或 HTTP `POST /ingest {kb_id, reset}` —— 设置面板「重建」按钮
- 不带 kb_id 时入所有已注册 KB

### 6. 会话持久化

- LangGraph + `SqliteSaver` 写 `checkpoints.sqlite`
- 同一 `thread_id` 跨重启保留多轮上下文
- 前端 `notes-${uid}` 自动生成会话 ID

### 7. 跨域 / 工程化

- FastAPI CORS 全开（开发期）
- TypeScript 严格类型检查（vue-tsc）
- 前端零新增 HTTP 依赖（原生 fetch + SSE）
- `.env.example` + 路径常量集中管理

---

## 五、关键 API 速查

| 端点 | 方法 | 用途 |
|---|---|---|
| `/health` | GET | 健康检查 |
| `/chat` | POST | 同步 RAG 问答（带 kb_id） |
| `/chat/stream` | POST | SSE 流式全库 RAG |
| `/chat/entry` | POST | SSE 锁定单题问答（支持 skill_prompt） |
| `/entries/upsert` | POST | 错题同步入 RAG（带 kbId） |
| `/entries/delete` | POST | 错题从 RAG 删除（跨 KB） |
| `/ingest` | POST | 文档入库（kb_id + reset） |
| `/kbs` | GET / POST | 知识库列表 / 新建 |
| `/kbs/<id>` | PATCH / DELETE | 改名 / 删除 |
| `/kbs/<id>/data-dir` | GET | 取该 KB 的本地数据目录绝对路径 |

---

## 六、数据流图

```
┌────────────────┐  保存错题   ┌────────────────┐  upsert  ┌────────────────┐
│   NoteEditor   │ ─────────► │   IndexedDB    │ ───────► │  Chroma + BM25 │
│  (kbId 下拉)   │            │  useEntries.ts │          │   (kb_<id>)    │
└───────┬────────┘            └────────────────┘          └────────┬───────┘
        │                                                            │
        │  打开错题                                                  │
        ▼                                                            ▼
┌────────────────┐  /chat/entry  ┌──────────────────────────────────┐
│ AiChatSidebar  │ ────────────► │   FastAPI + LangGraph + DeepSeek │
│ (KB 选择 / skill)│ ◄──── SSE ── │   (skill prompt + 重试 + 降级)   │
└────────────────┘               └──────────────────────────────────┘
```

---

## 七、扩展实施指南

按工程量从小到大排列，每一项给出：**目标 / 改哪些代码 / 关键变更点 / 工程量估计**。

---

### 7.1 全库模式接入 Skill（小）

**目标**：现在 `/<触发词>` 只在错题锁定模式生效，让全库 RAG 也能用 skill。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `RAG-AIAgent/src/state.py` | `AgentState` 加 `skill_prompt: str` 字段 |
| `RAG-AIAgent/src/api.py` | `ChatRequest` 加 `skill_prompt: Optional[str]`；`/chat/stream` 把 `skill_prompt` 注入 graph state |
| `RAG-AIAgent/src/nodes.py` | `generate_rag_answer` 读 `state.get("skill_prompt")`，命中时拼到 system 末尾（与 `/chat/entry` 同样的「追加不覆盖」策略） |
| `notes-app/src/composables/useAiChat.ts` | `if (skillPrompt && !useEntryMode) body.skill_prompt = skillPrompt`（去掉现有 `useEntryMode` 限制） |

**注意**：skill 是追加到默认 system 末尾，不是替换 —— 防止丢掉 RAG 上下文约束。

**工程量**：~30 行，1 小时内。

---

### 7.2 DeepSeek Prompt Caching（小）

**目标**：长上下文 RAG 命中缓存能省 ~90% token 成本。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `RAG-AIAgent/src/nodes.py` | `generate_rag_answer` 的 `SystemMessage` 改用 `additional_kwargs={"cache_control": {"type": "ephemeral"}}` 标记缓存块 |
| `RAG-AIAgent/src/config.py` | 升级到支持缓存的模型版本；检查 DeepSeek 当前是否支持 Anthropic 风格 `cache_control`（不支持的话需要换 `extra_body` 透传 `cache: {...}` 参数） |

**关键**：把 system prompt 中固定不变的「上下文片段拼接」部分单独切块标缓存；用户问题不缓存。

**坑**：DeepSeek 官方文档中 prompt caching 是**自动启用**的（同 prefix 命中），不需要手动标记；但需要确保**system prompt 的前缀 1024 token 完全一致**才能命中。改造方向是把"上下文库"放在 system prompt **最前**而不是最后。

**工程量**：~20 行 + 测试 cache hit rate，半天。

---

### 7.3 OCR 扫描件 PDF（中）

**目标**：图片型 PDF 也能入库。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `RAG-AIAgent/requirements.txt` | 加 `paddleocr>=2.7` 或 `pytesseract` + 系统装 Tesseract |
| `RAG-AIAgent/src/ingest.py` | `_load_pdf` 函数：先 `page.extract_text()`，若空字符串则用 `pdfplumber` / `pymupdf` 提取页面图，再调 OCR；可加 `--ocr` 命令行开关按需启用 |
| `RAG-AIAgent/src/config.py` | 新增 `OCR_ENABLED` 环境变量 |
| 新增 `src/ocr.py` | OCR 单独模块，封装初始化（重资源，要 lru_cache） |

**注意**：PaddleOCR 首次跑会下 ~50MB 模型；速度比纯 pypdf 慢 100x，**只在 pypdf 提取为空时兜底**。

**工程量**：~150 行 + 模型下载，1-2 天。

---

### 7.4 LangSmith Tracing（中）

**目标**：可视化每次问答的全链路调用、token 消耗、节点耗时。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `RAG-AIAgent/.env.example` | 加 `LANGCHAIN_TRACING_V2=true` / `LANGCHAIN_API_KEY=...` / `LANGCHAIN_PROJECT=notes-app` |
| `RAG-AIAgent/requirements.txt` | 加 `langsmith` |
| `RAG-AIAgent/src/config.py` | 启动时检查环境变量并 `print` 提示已开启 tracing |
| 无需改其他代码 | LangChain 自动捕获所有 chain/llm 调用 |

**额外可选**：在 `notes-app/src/components/SettingsPanel.vue` 加一个「调试 / Tracing 链接」按钮，跳转到 `https://smith.langchain.com/o/<your-org>/projects/notes-app`。

**工程量**：~5 行配置 + 注册 LangSmith 账号，半天。

---

### 7.5 Ragas 自动评测（中）

**目标**：跑测试集，量化 faithfulness（忠实度）/ answer relevancy / context precision 等指标。

**改这些代码**

| 文件 | 改动 |
|---|---|
| 新增 `RAG-AIAgent/evals/dataset.json` | 50-100 条 `{question, ground_truth}` |
| 新增 `RAG-AIAgent/evals/run_evals.py` | 跑 dataset → 调 `/chat/stream` → 收集 `{question, answer, contexts, ground_truth}` → 喂给 ragas |
| `RAG-AIAgent/requirements.txt` | 加 `ragas>=0.2` `datasets` |
| 新增 `RAG-AIAgent/evals/report.md` | 生成 markdown 报告 |

**模板**：

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

result = evaluate(
    dataset,
    metrics=[faithfulness, answer_relevancy, context_precision],
    llm=ChatOpenAI(model="deepseek-chat", base_url="https://api.deepseek.com/v1"),
    embeddings=HuggingFaceEmbeddings(model_name="BAAI/bge-small-zh-v1.5"),
)
```

**工程量**：构造测试集是大头（要手写 ground truth），代码本身半天。

---

### 7.6 Redis 语义缓存（中）

**目标**：相同 / 相似查询命中缓存，跳过整个 RAG 链路直接返回。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `RAG-AIAgent/requirements.txt` | 加 `redis` `langchain-redis` |
| 新增 `RAG-AIAgent/src/cache.py` | 用 `RedisSemanticCache(embedding=..., score_threshold=0.95)` |
| `RAG-AIAgent/src/config.py` | 启动时 `set_llm_cache(get_cache())` 全局注册 |
| `docker-compose.yml`（新文件） | 起一个 Redis 服务 |

**注意**：Entry 锁定模式（带具体题目内容）不要缓存 —— 每道题问的是自己；全库 RAG 模式才有缓存意义。可以在 `make_deepseek_llm` 工厂里按场景区分。

**工程量**：~80 行 + Docker 配置，1 天。

---

### 7.7 HyDE / 子问题拆解（中）

**目标**：复杂问题先让 LLM 生成"假想答案"或拆成子问题，提升召回率。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `RAG-AIAgent/src/nodes.py` | 在 `rewrite_query` 之后插入 `generate_hypothetical_answer` 节点，让 LLM 写一段"我猜答案大概是 XX"，把这段用于 embedding 检索 |
| `RAG-AIAgent/src/graph.py` | 在 `rewrite_query` 和 `retrieve` 之间加新节点边 |
| `RAG-AIAgent/src/state.py` | `AgentState` 加 `hypothetical_doc: str` |
| 可选：增加 `decompose_question` 节点 | 拆子问题，每个子问题各自检索后合并 |

**Token 成本**：每问多一次 LLM 调用，看是否值。

**工程量**：~120 行 + 评测验证效果，1-2 天。

---

### 7.8 多模态（图片 / 表格独立索引）（大）

**目标**：错题里的图（截图、手写、几何图）也能被检索。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `notes-app/src/types/index.ts` | `NoteEntry` 已有 `drawing?: string` (data URL)，新增字段或复用现有 |
| `RAG-AIAgent/src/entries.py` | `NoteEntryPayload` 加 `images: List[str]`（data URL 列表）；upsert 时调用 vision 模型生成 caption 写入 chunk |
| `RAG-AIAgent/src/config.py` | 加 vision LLM（`deepseek-vl` 或 `qwen-vl-max`，要走非 DeepSeek 兼容接口） |
| 新增 `RAG-AIAgent/src/multimodal.py` | 图片 → caption / OCR 文本提取 |
| 新增独立 collection `kb_<id>_images` | 图描述独立向量库，检索时合并两路结果 |

**前端配套**：`useRagSync.ts` 上传时把 `entry.drawing` 也塞进 payload。

**工程量**：~400 行 + vision 模型成本评估，3-5 天。

---

### 7.9 OpenTelemetry 全链路追踪（大）

**目标**：对接 Jaeger / Tempo / Datadog 等，生产级监控。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `RAG-AIAgent/requirements.txt` | 加 `opentelemetry-sdk` `opentelemetry-instrumentation-fastapi` `opentelemetry-exporter-otlp` |
| `RAG-AIAgent/src/api.py` | `FastAPIInstrumentor.instrument_app(app)` |
| 新增 `RAG-AIAgent/src/tracing.py` | 配置 TracerProvider + OTLP exporter |
| `RAG-AIAgent/src/nodes.py` | 每个节点开头加 `with tracer.start_as_current_span("node_name"):` |
| `docker-compose.yml` | 加 Jaeger UI 服务 |

**工程量**：~200 行 + Docker 编排，2-3 天。

---

### 7.10 知识库导入 PDF UI（小，但用户感知大）

**目标**：在设置面板「知识库」区直接拖拽上传 PDF，不用手动拷文件。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `RAG-AIAgent/src/api.py` | 新增 `POST /kbs/<id>/upload`，接受 `multipart/form-data`，保存到 `data/<id>/`，然后调 `ingest_kb` |
| `notes-app/src/components/KnowledgeBaseManager.vue` | 每个 KB 行加 `<input type="file" multiple accept=".pdf,.md,.txt">`；选择文件后 `FormData` 上传 |
| `notes-app/src/composables/useKnowledgeBases.ts` | 加 `async upload(kbId, files: File[])` 方法 |

**工程量**：~100 行，半天。

---

### 7.11 错题批量迁移到别的库（小）

**目标**：选中多个错题一次性移到另一个 KB。

**改这些代码**

| 文件 | 改动 |
|---|---|
| `notes-app/src/components/BatchBar.vue` | 已有批量选择 UI，加「移到 KB」按钮 |
| `notes-app/src/composables/useEntries.ts` | 加 `bulkMoveToKb(ids: string[], kbId: string)`：循环改 `entry.kbId` → db.put → `ragSync.upsertEntry` |
| 无需后端改动 | upsert 端点已经处理跨 KB 迁移 |

**工程量**：~60 行，半天。

---

## 八、扩展建议优先级

按"投入 / 收益"排序，推荐这个顺序做：

1. **7.10 PDF 拖拽上传 UI** — 半天，体验大幅提升
2. **7.4 LangSmith Tracing** — 半天，调试效率指数级提升
3. **7.1 全库模式接 Skill** — 1 小时，对称性补齐
4. **7.5 Ragas 评测** — 1 天，建立质量基线
5. **7.2 Prompt Caching** — 半天，省钱（量大时收益显著）
6. **7.6 Redis 语义缓存** — 1 天，省钱省时间
7. **7.11 批量迁移** — 半天，用户增长后的刚需
8. **7.7 HyDE** — 1-2 天，召回率优化
9. **7.3 OCR PDF** — 1-2 天，特定场景刚需
10. **7.8 多模态** — 3-5 天，质变功能
11. **7.9 OpenTelemetry** — 部署到生产环境后再做

---

## 九、扩展面（其他想到没想到的方向）

- 知识库**共享 / 同步**（云端备份 KB 元数据 + 文档）
- 错题**自动标注**（AI 看完错题自动生成 tags / subject）
- 错题**相似度推荐**（基于 embedding 相似度推送相关题）
- **跨用户 Skill 市场**（Skill JSON 上传 / 下载 / 评分）
- 复习时调 AI 生成**变式题**（基于错题原题生成同知识点新题）
- 错题**知识图谱**（提取实体 + 关系，可视化学科网络）
- 语音输入（Web Speech API → 转文本 → 调 RAG）
- 移动端适配（Capacitor 或纯 PWA）

---

整套系统已经从单文件原型走到 **生产级 MVP**：覆盖了路由、检索、重排、评分、生成、结构化输出、流式接口、多会话、多知识库、错题同步、Skill 调教、桌面端 UI 完整闭环。后续扩展按上面 7 / 8 章节路线图推进即可。

