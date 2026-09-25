# 渐明 · Clearer Notes

**用交互图解，读懂 LLM、Agent 与推理系统。**

Interactive guides to LLMs, AI agents, and inference systems.

从模型结构、推理引擎到 Agent 记忆与评测，把复杂概念拆成可探索的图解、源码导读和学习笔记。先打开一个专题，带着问题看动画，再回到论文或代码验证理解。

[**开始阅读 →**](https://2218342221.github.io/blog/) · [English](README.md) · [RSS 订阅](https://2218342221.github.io/blog/rss.xml) · [反馈与建议](https://github.com/2218342221/blog/issues)

[![Deploy to GitHub Pages](https://github.com/2218342221/blog/actions/workflows/deploy.yml/badge.svg)](https://github.com/2218342221/blog/actions/workflows/deploy.yml)

[![LLM 架构图鉴的真实交互界面：GQA 分组查询注意力与因果注意力](docs/images/learning-preview.webp)](https://2218342221.github.io/blog/lab/llm-architecture-atlas/)

> 专题正文主要使用简体中文；博客首页支持中英文切换。无需注册，直接在浏览器中阅读。

## 先选一个想弄清楚的问题

| 专题                                                                                 | 从这里开始                       | 你会看到什么                                                                               |
| ------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------ |
| [LLM 架构图鉴](https://2218342221.github.io/blog/lab/llm-architecture-atlas/)        | 模型内部怎样处理 token？         | **10 个章节**，连接结构图、张量形状和公式，附可下载的 PyTorch 教学实现。                   |
| [推理引擎学院](https://2218342221.github.io/blog/lab/inference-engine-academy/)      | vLLM 怎样调度、缓存和执行？      | 从 nano-vLLM 到生产架构的 **28 个模块、50 段源码导读**，配合实验与测验。                   |
| [Agent Memory 综述](https://2218342221.github.io/blog/lab/agent-memory/)             | 过去的信息怎样影响未来决策？     | **12 章、19 幅交互图解**，围绕任务状态、事实证据和经验迁移梳理研究路线。                   |
| [LLM 评测图谱](https://2218342221.github.io/blog/lab/llm-benchmark-atlas/)           | 一个评测分数究竟怎样产生？       | **41 个评测集、48 个案例**，逐步展示输入、环境、工具调用与判分流程。                       |
| [软件工程经典](https://2218342221.github.io/blog/lab/software-engineering-classics/) | 怎样把经典书里的方法用到工程中？ | **5 本书、25 个学习单元**，串起 DDIA、DDD、Clean Code、Clean Architecture 与 Refactoring。 |

## 不止是读一篇文章

- **把过程播放出来**：在支持动画的图解里暂停、逐步推进或调整参数，看清数据和状态怎样变化。
- **从图解走到实现**：[PyTorch 实验室](https://2218342221.github.io/blog/lab/llm-architecture-atlas/#lab)提供可下载的教学代码；推理课程沿源码调用链展开。
- **沿证据继续读**：专题保留论文、官方资料和实现来源，并区分机制解释、教学示例与实测结论。
- **按自己的节奏积累**：用搜索、专题和归档回到旧笔记，通过 RSS 获取更新；Memory、架构与评测专题支持下载 HTML 离线阅读。

<details>
<summary>展开看一段演示：Terminal-Bench 案例怎样从任务走到判分？</summary>

[![Terminal-Bench 跨表匿名化案例：题目、操作、输出、独立判分与结果解读](docs/images/benchmark-walkthrough.gif)](https://2218342221.github.io/blog/lab/llm-benchmark-atlas/#case-animation-terminal-1)

预览录自站点的五步交互图解。点击图片进入案例，可以自行切换步骤、播放或暂停。

</details>

## 推荐阅读路线

- **理解语言模型**：架构图鉴 → 推理引擎学院 → 评测图谱，把模型结构、执行过程与评价方法连起来。
- **开发 Agent**：Agent Memory 综述 → [评测运行环境与工具](https://2218342221.github.io/blog/lab/llm-benchmark-atlas/#runtime)，先厘清记忆和工具各自解决的问题。

## 在本地运行

想直接阅读，打开[线上站点](https://2218342221.github.io/blog/)即可。本地运行需要 **Node.js 22.12+**，推荐 Node.js 24：

```bash
git clone https://github.com/2218342221/blog.git
cd blog
npm ci
BASE_PATH=/blog/ npm run dev
```

打开 [http://localhost:4321/blog/](http://localhost:4321/blog/)。

项目使用 Astro、TypeScript 和 Markdown，发布到 GitHub Pages：

```bash
SITE_URL=https://2218342221.github.io BASE_PATH=/blog/ npm run build
BASE_PATH=/blog/ npm run preview
```

构建包含 Astro/TypeScript 检查，产物位于 `dist/`。本仓库推送到 `main` 后，由 [GitHub Actions](https://github.com/2218342221/blog/actions/workflows/deploy.yml) 自动部署。

| 位置                                       | 用途                         |
| ------------------------------------------ | ---------------------------- |
| [`src/content/notes/`](src/content/notes/) | Markdown 笔记与专题入口      |
| [`public/lab/`](public/lab/)               | 可独立访问的学习专题         |
| [`src/config/site.ts`](src/config/site.ts) | 站点名称、简介和专题配置     |
| [内容维护指南](docs/WRITING.md)            | 新增文章、添加资源与发布步骤 |

`public/lab/` 包含专题的静态发布资源；部分专题提供的是 HTML 和打包后的 JS/CSS，并非全部原始开发工程。PyTorch 示例用于学习计算机制；评测动画用于解释流程，不代表在本站实际运行了对应模型。研究与榜单的时间范围以各专题标注为准。

## 一起把它写得更清楚

欢迎通过 [Issue](https://github.com/2218342221/blog/issues/new) 提交概念纠错、失效链接、示例改进或希望展开的问题。附上**页面链接、具体位置和参考资料**，会更容易核对；如果已有明确修改，也欢迎提交 PR。

如果某个图解帮你弄清楚了一个问题，欢迎点个 **Star** 收藏，方便下次继续读。订阅更新可以使用 [RSS](https://2218342221.github.io/blog/rss.xml)。
