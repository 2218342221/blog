# 渐明 · Clearer Notes

个人学习笔记博客，基于 Astro，部署于 GitHub Pages。

[在线阅读](https://2218342221.github.io/blog/)

## 本地启动

需要 Node.js 22.12 或更新版本，推荐 Node.js 24。

```bash
npm ci
BASE_PATH=/blog/ npm run dev
```

默认访问 [localhost:4321/blog/](http://localhost:4321/blog/)。站点配置位于 `src/config/site.ts`。

## 写笔记

文章位于 `src/content/notes/`，新增和更新步骤见 [内容维护指南](docs/WRITING.md)。

## 构建与发布

```bash
SITE_URL=https://2218342221.github.io BASE_PATH=/blog/ npm run build
BASE_PATH=/blog/ npm run preview
```

构建产物位于 `dist/`。推送到 `main` 后，GitHub Actions 自动部署。
