# 如何向博客添加内容

## 写入规则

只有用户明确要求写入博客时，才可以新增或修改博客内容；整理学习笔记、回答问题、分析代码、生成总结等请求，本身不代表允许写入博客，不得自动把这些结果保存成博客文章。

只执行本次明确要求的范围：要求维护文档时不新增文章，要求本地写入时不自动发布；本次要求包含发布时，再执行下文的发布步骤。不要为了演示或验证而新增示例文章，也不要使用真实姓名作为署名。

## 1. 进入项目

在工作区根目录执行：

```bash
cd blog
```

后续命令均在博客项目根目录执行。需要 Node.js 22.12 或更新版本，推荐 Node.js 24。

```bash
git status --short
npm ci
```

保留已有修改；工作区干净且处于 `main` 分支时，可以先执行 `git pull --ff-only origin main` 获取远端更新。

## 2. 创建或更新文章

得到明确的写入要求后，按实际主题选择文件名和标题：

```bash
npm run new -- first-note "第一篇学习笔记"
```

命令创建 `src/content/notes/first-note.md`，自动填写北京时间日期和 `draft: true`，不会覆盖同名文件。文件名只允许小写英文字母、数字和单个连字符，最长 80 个字符；文件名会成为文章 URL 的一部分，发布后尽量不改名。

更新已有文章时直接编辑对应的 Markdown 文件，保留原始 `published`，按实际日期填写 `updated`，无需新建一篇文章。

文章开头的 YAML 信息以两行 `---` 包围，字段如下：

| 字段          | 填写方式                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`       | 文章标题。                                                                                                                                                                       |
| `description` | 一句话摘要，显示在文章列表和页面描述中。                                                                                                                                         |
| `destination` | 可选，直接打开的站内目录路径，例如 `lab/llm-benchmark-atlas/`。使用小写字母、数字、连字符和斜杠，末尾保留 `/`，不要包含开头的 `/` 或部署前缀 `blog/`；省略时打开 Markdown 文章。 |
| `published`   | 发布日期，格式 `YYYY-MM-DD`。                                                                                                                                                    |
| `updated`     | 可选，最近更新日期，格式 `YYYY-MM-DD`。                                                                                                                                          |
| `category`    | 仅支持 `系统设计`、`AI 工程`、`后端开发`、`学习方法`。                                                                                                                           |
| `tags`        | 字符串列表，例如 `["笔记"]`，也可保留 `[]`。                                                                                                                                     |
| `cover`       | 内置封面图解名称：`cache`、`rag`、`api`、`learning`、`database`、`transformer`、`benchmark`、`memory`、`inference`、`architecture`、`engineering`；不是图片路径。                |
| `featured`    | 是否精选，通常为 `false`。                                                                                                                                                       |
| `draft`       | 明确填写 `true` 或 `false`；新文章保持 `true`，准备展示时改成 `false`。                                                                                                          |

手动创建文章时不要省略 `draft`：数据定义中的缺省值是 `false`。`published` 用于显示和排序，未来日期不会自动延迟发布。

正文使用 Markdown，支持代码块、列表、链接、表格和普通 HTML；正文标题从 `##` 开始，`##` 和 `###` 会自动生成文章目录。只写实际需要记录的内容，不必保留生成模板的全部章节。

## 3. 添加图片或独立 HTML 页面

文章图片放在 `public/images/文章文件名/` 中，例如 `public/images/first-note/diagram.png`，正文引用：

```markdown
![图解说明](/blog/images/first-note/diagram.png)
```

当前线上网站部署在 `/blog/` 下，所以此类公共图片地址必须包含 `/blog/`；下文的本地预览命令也使用相同前缀。如果以后更换部署路径，需要同步调整这些图片链接。

独立 HTML 页面可放在 `public/lab/index.html`，上线后地址为 `https://2218342221.github.io/blog/lab/`；页面内资源使用相对路径，不要与已有路由重名。独立 HTML 页面不会自动进入笔记列表、专题、归档或搜索，需要按本次要求添加入口。普通学习笔记优先放在 `src/content/notes/`。

如果入口需要直接打开独立 HTML，在对应 Markdown 的开头设置 `destination`，指向 `public/` 下实际存在的目录。首页卡片的封面与标题、专题、归档、相关推荐、搜索和 RSS 将直接链接到该目录，不经过 Markdown 介绍页。原 Markdown 地址仍可访问。

## 4. 本地预览和检查

草稿在开发预览和正式构建中都会被排除；需要预览完整文章时，将该文章的 `draft` 暂时改成 `false`，未准备发布时再恢复为 `true`。

```bash
BASE_PATH=/blog/ npm run dev
```

打开终端提示的地址并进入 `/blog/`，默认是 `http://localhost:4321/blog/`；上面的文章示例路径是 `/blog/notes/first-note/`。检查正文、代码块、目录、图片、链接和手机端排版。

发布前按实际线上路径构建：

```bash
SITE_URL=https://2218342221.github.io BASE_PATH=/blog/ npm run build
BASE_PATH=/blog/ npm run preview
```

构建会执行 Astro/TypeScript 检查并生成 `dist/`；用预览命令显示的地址进入 `/blog/`，确认文章及其图片能正常访问。若需整理 Markdown 格式，仅格式化本次修改的文件，例如 `npx prettier --write src/content/notes/first-note.md`。

`draft: true` 只控制网站是否展示文章；仓库是公开的，推送后的草稿源码仍可在 GitHub 中读取。

## 5. 发布到线上

当本次明确要求包含发布时，把文章的 `draft` 设为 `false`，完成上面的构建和预览后，再提交本次相关文件。提交身份使用 `Clearer Notes` 和 GitHub noreply 邮箱；本仓库可以单独配置，避免使用真实姓名：

```bash
git config user.name "Clearer Notes"
git config user.email 43314410+2218342221@users.noreply.github.com
git add src/content/notes/first-note.md
git diff --cached
git commit -m "docs: add first note"
git push origin main
```

上述发布命令适用于 `main` 分支，替换为本次实际文件名和提交说明；若添加了图片，也需将对应的 `public/images/文章文件名/` 加入暂存区。不要把无关文件、`node_modules/` 或 `dist/` 提交进去。在其它分支工作时，应先按本次要求将修改合入 `main`。

推送到 `main` 后，[Deploy to GitHub Pages](https://github.com/2218342221/blog/actions) 工作流会自动构建并部署，无需手动上传 HTML。等待工作流成功后，打开 [线上博客](https://2218342221.github.io/blog/) 验证新文章和图片。

`draft: false` 的 Markdown 文章会自动进入首页列表、对应专题、归档、搜索和 RSS，不需要逐个修改这些页面；首页语言切换只翻译界面，不会自动翻译文章正文。

## 6. 维护论文学习区

论文书架位于 `/papers/`，每篇论文的学习页面位于 `/papers/文件名/`。每篇只维护一份 `src/content/notes/文件名.md`，在普通文章字段上增加 `paper` 元数据；系统会同时生成书架、报告、译稿下载和复习题，并接入首页、专题、归档、搜索与 RSS。参考现有的 `src/content/notes/memgpt.md`，不要新建用于演示的占位论文。

正文采用 **1–3 页读书报告**，用于快速回顾，建议按以下顺序写：

1. 问题与机制：一句话结论、研究问题、机制图与关键概念。
2. 方法与证据：关键接口或算法、实验条件与原始数据、结果适用范围。
3. 阅读判断：适用场景、局限、个人理解、复习问题与来源。

每页用 `<section class="report-sheet" id="report-1">` 包住 Markdown，标签与 Markdown 之间保留空行；依次递增编号。每页约 500–800 个中文字，含表格或图时减少文字。屏幕阅读不限制页高，打印使用 A4 分页，导出后必须检查真实页数和内容是否截断。不要把论文结果写成自己的复现，引用源码时注明固定版本与验证方式。

`paper` 元数据字段：

| 字段                            | 填写方式                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `shortTitle`、`originalTitle`   | 简称与原文完整标题。                                                                                             |
| `authors`、`year`、`version`    | 原作者列表、首次发表年份、实际阅读版本。                                                                         |
| `sourceUrl`                     | 论文正式来源，尽量固定 arXiv 版本。                                                                              |
| `codeUrl`、`codeVersion`        | 所核对实现的固定链接、版本与日期。                                                                               |
| `license`                       | 原论文与译稿所依据的许可；发布前核对再分发权限。                                                                 |
| `reportPages`、`readingMinutes` | 实际 PDF 页数（1–3）与报告预计阅读分钟数。                                                                       |
| `takeaway`                      | 用一句话说明论文最值得记住的想法。                                                                               |
| `assets`                        | 下表中的六种资源，路径均为 `papers/文件名/files/资源文件名`，不带开头 `/` 或部署前缀。                           |
| `questions`                     | 复习题数组；每题包含 `prompt`、2–5 个 `options`、从 0 开始的正确选项 `correct` 和解释 `explanation`，建议 5 题。 |

资源放在 `public/papers/文件名/files/` 下：

| `assets` 字段    | 文件内容                                                              |
| ---------------- | --------------------------------------------------------------------- |
| `translationPdf` | 中文全文 PDF。                                                        |
| `translationTex` | 可继续维护的中文 LaTeX 源码。                                         |
| `sourceBundle`   | 译稿源码、原始源码和来源/许可说明的 ZIP；不要混入临时日志或私有路径。 |
| `originalSource` | 下载的原论文源码压缩包。                                              |
| `originalPdf`    | 与阅读版本对应的英文原论文 PDF。                                      |
| `reportPdf`      | 与网页正文一致的 1–3 页报告，命名为 `文件名-reading-report.pdf`。     |

先按第 4 节构建并启动预览，再在另一个终端导出报告：

```bash
BASE_PATH=/blog/ node scripts/export-paper-report.mjs memgpt
```

命令使用 Playwright Chromium。已有浏览器时可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定可执行文件；预览不是 4321 端口时设置 `PAPER_PREVIEW_ORIGIN`。检查 PDF 的页数、中文字体、表格、图与最后一段；如果超过 3 页，优先精简报告。正文修改后重新导出，再重新构建，将新 PDF 一起提交。

页面提供报告、译稿和快速复习三个页签。阅读状态由读者手动标记，答题进度保存在当前浏览器的 localStorage 中；不会跨设备同步。题集内容变化时，系统自动重置旧答题记录，保留手动阅读标记。新增或改题时保留清晰解释，不以浏览页面代替完成学习。
