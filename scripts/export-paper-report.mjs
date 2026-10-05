import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const slug = process.argv[2];
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  throw new Error('用法：node scripts/export-paper-report.mjs <论文文件名>');
}

const prefix = (process.env.BASE_PATH || '/blog/').replace(/^\/+|\/+$/g, '');
const origin = process.env.PAPER_PREVIEW_ORIGIN || 'http://127.0.0.1:4321';
const url = new URL(`${prefix ? `/${prefix}` : ''}/papers/${slug}/`, origin);
const outputDir = resolve('public', 'papers', slug, 'files');
const output = resolve(outputDir, `${slug}-reading-report.pdf`);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  const page = await browser.newPage();
  const response = await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  if (!response?.ok()) throw new Error(`无法打开报告：${url.href}`);
  await page.locator('[data-report-body] .report-sheet').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  const sheets = await page.locator('[data-report-body] .report-sheet').count();
  if (sheets < 1 || sheets > 3)
    throw new Error(`报告须有 1–3 个 report-sheet，当前为 ${sheets}`);
  await page.emulateMedia({ media: 'print' });
  await mkdir(outputDir, { recursive: true });
  await page.pdf({
    path: output,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    tagged: true,
  });
  console.log(`已导出 ${output}；请检查实际 PDF 为 1–3 页，且无截断。`);
} finally {
  await browser.close();
}
