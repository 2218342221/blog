# Pagewise · 知页

记录学习笔记的个人博客，使用 Astro 生成静态 HTML，支持 GitHub Pages 自动发布。新项目的文章目录为空，从自己的第一篇真实笔记开始写。

视觉借鉴 [ByteByteGo](https://bytebytego.com/) 的排版、配色和图解表达，图解为原创，没有复制课程内容。

首页默认使用英文品牌 Pagewise，点击顶部的地球图标按钮即可在中英文之间切换，按钮文字显示将要切换到的语言，浏览器会记住选择。切换覆盖首页界面与搜索提示，文章内容保持原文，专题、归档、关于及文章页继续使用中文；不会根据浏览器语言自动切换。

## 本地启动

需要 Node.js 22.12 或更新版本，推荐 Node.js 24 LTS。

```bash
npm ci
npm run dev
```

打开终端显示的网址，默认是 `http://localhost:4321`。在 `src/config/site.ts` 修改博客名称、署名、简介和站点链接。

## 写笔记

```bash
npm run new -- first-note "第一篇学习笔记"
```

命令会创建 `src/content/notes/first-note.md`，自动填入北京时间日期，且不会覆盖已有文件。修改开头的文章信息，然后用 Markdown 写正文。

- `title`、`description`：标题和摘要。
- `published`：发布日期，格式为 `YYYY-MM-DD`；`updated` 可选，用于记录更新日期。
- `category`：系统设计、AI 工程、后端开发、学习方法之一。
- `tags`：标签列表。
- `cover`：图解类型，可选 `cache`、`rag`、`api`、`learning`、`database`、`transformer`。
- `featured`：是否精选。
- `draft`：新文章默认为 `true`，完成后改为 `false` 才会发布。

Markdown 内可以直接写普通 HTML。独立 HTML 页面放在 `public/` 下会原样发布，例如 `public/lab/index.html` 对应网站的 `lab/` 路径。独立页面不会自动列入笔记索引，需要自行添加入口；资源使用相对路径，避免与已有博客页面重名。

## 发布到 GitHub Pages

1. 创建 GitHub 仓库，把本项目内的文件放在仓库根目录，包括 `.github/` 和 `package-lock.json`。
2. 在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送到 `main` 分支，工作流会自动构建和部署。也可以在 Actions 中手动运行 **Deploy to GitHub Pages**。
4. 部署完成后，通过 Pages 设置或工作流里的链接访问博客。

使用 `用户名.github.io` 仓库时部署在域名根路径，其他仓库部署在仓库名子路径。工作流会自动读取 Pages 地址并适配链接，无需手写路径。

自定义域名在 GitHub Pages 设置中配置。需要覆盖构建地址时，可设置仓库变量 `SITE_URL` 和 `BASE_PATH`；前者为站点 origin，后者为子路径，根路径填 `/`。本地构建也接受同名环境变量。仓库为 `2218342221/blog`，推送到 `main` 后自动发布到 https://2218342221.github.io/blog/。

## 构建与检查

```bash
npm run build
npm run preview
```

构建会检查 Astro/TypeScript 并将静态网站生成到 `dist/`。预览确认内容与链接后再推送。

`npm run format:check` 检查格式，`npm run format` 统一格式。浏览器检查使用 `npm run test:e2e`，首次执行前运行 `npx playwright install chromium` 安装浏览器。
