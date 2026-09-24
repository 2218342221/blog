import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const [slug, rawTitle] = args;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (args.length !== 2 || !rawTitle?.trim()) {
  fail('用法：npm run new -- my-first-note "我的第一篇学习笔记"');
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
  fail(
    'slug 请使用小写英文字母、数字和单个连字符，长度不超过 80；例如 cache-basics。',
  );
}

const title = rawTitle.trim();
const dateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).formatToParts(new Date());
const date = Object.fromEntries(
  dateParts.map(({ type, value }) => [type, value]),
);
const published = `${date.year}-${date.month}-${date.day}`;
const notesDir = new URL('../src/content/notes/', import.meta.url);
const noteUrl = new URL(`${slug}.md`, notesDir);

const content = `---
title: ${JSON.stringify(title)}
description: "用一句话概括这篇学习笔记。"
published: ${published}
category: "学习方法"
tags: []
cover: "learning"
featured: false
draft: true
---

## 我想弄清的问题

记录学习背景、问题和边界。

## 核心概念

用自己的语言解释概念，配上必要的例子或图解。

## 实践与验证

记录操作步骤、结果，以及暂时无法确认的地方。

## 我的理解

总结这次学习带来的变化和下一步要探索的问题。

## 参考资料

记录实际参考的资料与链接。
`;

try {
  await mkdir(notesDir, { recursive: true });
  await writeFile(noteUrl, content, { encoding: 'utf8', flag: 'wx' });
  console.log(`已创建草稿：${fileURLToPath(noteUrl)}`);
  console.log('写完后将 draft 改为 false；构建会排除草稿。');
} catch (error) {
  if (error.code === 'EEXIST') {
    fail(`笔记 ${slug}.md 已存在，未覆盖。请使用其他 slug。`);
  }
  fail(`创建笔记失败：${error.message}`);
}
