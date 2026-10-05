import { expect, test, type Page } from '@playwright/test';

const prefix = (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '');
const basePath = prefix ? `/${prefix}/` : '/';
const pathTo = (path = '') => `${basePath}${path.replace(/^\/+/, '')}`;
const libraryPath = pathTo('papers/');
const memgptPath = pathTo('papers/memgpt/');
const assetPath = pathTo('papers/memgpt/files/');
const expectedFiles = [
  'memgpt-zh.pdf',
  'memgpt-zh.tex',
  'memgpt-source.zip',
  'memgpt-arxiv-source-v2.tar.gz',
  'memgpt-original-v2.pdf',
  'memgpt-reading-report.pdf',
];
const review = [
  {
    prompt: 'MemGPT 的 Core memory 如何被模型看见？',
    answer: '全文被放进每次调用的系统提示词',
  },
  {
    prompt: '哪一种记忆由程序自动保存对话消息？',
    answer: 'Recall memory',
  },
  {
    prompt: 'request_heartbeat=true 的主要作用是什么？',
    answer: '请求工具结束后立即再运行一次模型',
  },
  {
    prompt: '在核对的 0.3.1 中，75% 预警意味着什么？',
    answer: '提醒模型保存要点；摘要处理另由溢出错误触发',
  },
  {
    prompt: 'GPT-4 准确率 32.1%→92.5% 应如何解读？',
    answer: 'DMR 任务上，同底模下摘要基线与 MemGPT 的比较',
  },
];

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }));
  expect(
    dimensions.content,
    `论文学习页面不应出现横向溢出：${page.url()}`,
  ).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('open MemGPT from the paper library and navigate the three learning tabs', async ({
  page,
}) => {
  const response = await page.goto(libraryPath);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const card = page.locator('[data-paper-card][data-paper-id="memgpt"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-card-progress]')).toHaveText('尚未开始');
  await expect(
    card.getByRole('link', { name: 'MemGPT', exact: true }),
  ).toHaveAttribute('href', memgptPath);
  await card.getByRole('link', { name: 'MemGPT', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === memgptPath);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('MemGPT');

  const reportTab = page.getByRole('tab', { name: '阅读报告', exact: true });
  const translationTab = page.getByRole('tab', {
    name: '中文译稿',
    exact: true,
  });
  const reviewTab = page.getByRole('tab', { name: '快速复习', exact: true });
  const reportPanel = page.locator('[data-paper-panel="report"]');
  const translationPanel = page.locator('[data-paper-panel="translation"]');
  const reviewPanel = page.locator('[data-paper-panel="review"]');
  await expect(reportTab).toHaveAttribute('aria-selected', 'true');
  await expect(reportPanel).toBeVisible();
  await expect(reportPanel.locator('.report-sheet')).toHaveCount(3);
  for (const sheet of await reportPanel.locator('.report-sheet').all()) {
    await expect(sheet.getByRole('heading', { level: 2 })).toBeVisible();
  }
  await expect(translationPanel).toBeHidden();
  await expect(reviewPanel).toBeHidden();

  await translationTab.click();
  await expect(translationTab).toHaveAttribute('aria-selected', 'true');
  await expect(translationPanel).toBeVisible();
  await expect(reportPanel).toBeHidden();
  await expect(page.locator('[data-translation-open]')).toHaveAttribute(
    'href',
    `${assetPath}memgpt-zh.pdf`,
  );
  await expect(translationPanel.locator('object')).toHaveAttribute(
    'data',
    `${assetPath}memgpt-zh.pdf`,
  );
  await expect(page).toHaveURL((url) => url.hash === '#translation');

  await reviewTab.click();
  await expect(reviewTab).toHaveAttribute('aria-selected', 'true');
  await expect(reviewPanel).toBeVisible();
  await expect(translationPanel).toBeHidden();
  await expect(page.locator('[data-quiz-prompt]')).toHaveText(review[0].prompt);
  await expect(reviewPanel.getByRole('radio')).toHaveCount(3);

  // Keyboard users can return to the first tab and move forward again.
  await reviewTab.press('Home');
  await expect(reportTab).toBeFocused();
  await expect(reportPanel).toBeVisible();
  await reportTab.press('ArrowRight');
  await expect(translationTab).toBeFocused();
  await expect(translationPanel).toBeVisible();
  await page.reload();
  await expect(translationTab).toHaveAttribute('aria-selected', 'true');
  await expect(translationPanel).toBeVisible();
});

test('retry a wrong answer, retain reading and quiz progress, and complete a review', async ({
  page,
}) => {
  await page.goto(memgptPath);
  const reportRead = page.locator('[data-mark-read="report"]');
  const translationRead = page.locator('[data-mark-read="translation"]');
  await reportRead.click();
  await expect(reportRead).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: '中文译稿', exact: true }).click();
  await translationRead.click();
  await expect(translationRead).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: '快速复习', exact: true }).click();

  const check = page.locator('[data-quiz-check]');
  const next = page.locator('[data-quiz-next]');
  const feedback = page.locator('[data-quiz-feedback]');
  const progress = page.getByRole('progressbar', { name: '复习进度' });
  await expect(check).toBeDisabled();
  await page
    .getByRole('radio', { name: '写入模型权重，之后无需输入', exact: true })
    .check();
  await check.click();
  await expect(feedback).toBeVisible();
  await expect(feedback).toHaveAttribute('data-result', 'incorrect');
  await expect(feedback).toContainText('再想一想');
  await expect(feedback).toContainText('系统消息');
  await expect(next).toBeHidden();
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('[data-quiz-prompt]')).toHaveText(review[0].prompt);

  await page.reload();
  await expect(reportRead).toHaveAttribute('aria-pressed', 'true');
  await expect(translationRead).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-quiz-prompt]')).toHaveText(review[0].prompt);
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await page
    .getByRole('radio', { name: review[0].answer, exact: true })
    .check();
  await check.click();
  await expect(feedback).toHaveAttribute('data-result', 'correct');
  await expect(feedback).toContainText('答对了');
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(next).toBeVisible();

  // Reloading after a correct answer resumes at the next unanswered question.
  await page.reload();
  await expect(reportRead).toHaveAttribute('aria-pressed', 'true');
  await expect(translationRead).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-quiz-prompt]')).toHaveText(review[1].prompt);
  await expect(page.locator('[data-quiz-counter]')).toHaveText('第 2 / 5 题');
  await expect(progress).toHaveAttribute('aria-valuenow', '1');

  for (let index = 1; index < review.length; index++) {
    await expect(page.locator('[data-quiz-prompt]')).toHaveText(
      review[index].prompt,
    );
    await page
      .getByRole('radio', { name: review[index].answer, exact: true })
      .check();
    await check.click();
    await expect(feedback).toHaveAttribute('data-result', 'correct');
    await expect(progress).toHaveAttribute('aria-valuenow', String(index + 1));
    await next.click();
  }
  await expect(page.locator('[data-quiz-complete]')).toBeVisible();
  await expect(page.locator('[data-quiz-question-area]')).toBeHidden();
  await expect(page.locator('[data-quiz-counter]')).toHaveText(
    '5 / 5 题已完成',
  );
  await expect(page.locator('[data-step-label="review"]')).toHaveText(
    '5 / 5 题已掌握',
  );

  await page.getByRole('link', { name: '返回论文库', exact: true }).click();
  const card = page.locator('[data-paper-card][data-paper-id="memgpt"]');
  await expect(card.locator('[data-card-progress]')).toHaveText(
    '已完成一轮学习 ✓',
  );
  const resume = card.locator('[data-card-resume]');
  await expect(resume).toContainText('再复习一次');
  const resumeUrl = new URL((await resume.getAttribute('href'))!, page.url());
  expect(resumeUrl.pathname).toBe(memgptPath);
  expect(resumeUrl.hash).toBe('#review');
  await resume.click();
  await expect(page.locator('[data-quiz-complete]')).toBeVisible();
  await page.locator('[data-quiz-restart]').click();
  await expect(page.locator('[data-quiz-prompt]')).toHaveText(review[0].prompt);
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await page.reload();
  await expect(page.locator('[data-quiz-prompt]')).toHaveText(review[0].prompt);
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(reportRead).toHaveAttribute('aria-pressed', 'true');
  await expect(translationRead).toHaveAttribute('aria-pressed', 'true');
});

test('a changed question revision resets completed answers while preserving reading marks', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const key = 'clearer.papers.v1.memgpt';
    if (!localStorage.getItem(key)) {
      localStorage.setItem(
        key,
        JSON.stringify({
          reportRead: true,
          translationRead: true,
          answers: [0, 1, 2, 1, 0],
          questionRevision: 'old-version',
          reviewedAt: '2026-10-04T04:00:00.000Z',
        }),
      );
    }
  });
  await page.goto(libraryPath);
  const card = page.locator('[data-paper-card][data-paper-id="memgpt"]');
  await expect(card.locator('[data-card-progress]')).toHaveText(
    '已掌握 0 / 5 题',
  );
  await expect(card.locator('[data-card-resume]')).toContainText('继续学习');
  await card.locator('[data-card-resume]').click();
  await expect(page).toHaveURL(
    (url) => url.pathname === memgptPath && url.hash === '#review',
  );
  await expect(page.locator('[data-paper-panel="review"]')).toBeVisible();
  await expect(page.locator('[data-quiz-complete]')).toBeHidden();
  await expect(page.locator('[data-quiz-prompt]')).toHaveText(review[0].prompt);
  await expect(page.locator('[data-quiz-counter]')).toHaveText('第 1 / 5 题');
  await expect(
    page.getByRole('progressbar', { name: '复习进度' }),
  ).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('[data-mark-read="report"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-mark-read="translation"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('learning remains usable when browser storage throws a SecurityError', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage access is blocked.', 'SecurityError');
      },
    });
  });
  await page.goto(memgptPath);
  await expect(page.locator('[data-storage-notice]')).toContainText(
    '当前浏览器无法保存进度',
  );
  await expect(page.locator('[data-paper-panel="report"]')).toBeVisible();
  const reportRead = page.locator('[data-mark-read="report"]');
  const translationRead = page.locator('[data-mark-read="translation"]');
  await reportRead.click();
  await expect(reportRead).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: '中文译稿', exact: true }).click();
  await expect(page.locator('[data-paper-panel="translation"]')).toBeVisible();
  await translationRead.click();
  await expect(translationRead).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: '快速复习', exact: true }).click();
  await expect(page.locator('[data-paper-panel="review"]')).toBeVisible();
  const progress = page.getByRole('progressbar', { name: '复习进度' });

  for (let index = 0; index < 2; index++) {
    await expect(page.locator('[data-quiz-prompt]')).toHaveText(
      review[index].prompt,
    );
    await page
      .getByRole('radio', { name: review[index].answer, exact: true })
      .check();
    await page.locator('[data-quiz-check]').click();
    await expect(page.locator('[data-quiz-feedback]')).toHaveAttribute(
      'data-result',
      'correct',
    );
    await expect(progress).toHaveAttribute('aria-valuenow', String(index + 1));
    await page.locator('[data-quiz-next]').click();
  }
  await expect(page.locator('[data-quiz-prompt]')).toHaveText(review[2].prompt);
  await expect(page.locator('[data-storage-notice]')).toContainText(
    '关闭页面后进度不会保留',
  );

  // The warning describes a real limitation: a reload cannot recover unsaved progress.
  await page.reload();
  await expect(page.locator('[data-quiz-prompt]')).toHaveText(review[0].prompt);
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(reportRead).toHaveAttribute('aria-pressed', 'false');
  await expect(translationRead).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-storage-notice]')).toContainText(
    '当前浏览器无法保存进度',
  );
});

test('all six paper resources are linked under BASE_PATH and return real files', async ({
  page,
  request,
}) => {
  await page.goto(memgptPath);
  const resourcePaths = await page
    .locator('[data-paper-detail] a[href]')
    .evaluateAll(
      (links, expectedPath) =>
        Array.from(
          new Set(
            links
              .map((link) => new URL((link as HTMLAnchorElement).href))
              .filter(
                (url) =>
                  url.origin === location.origin &&
                  url.pathname.startsWith(expectedPath),
              )
              .map((url) => url.pathname),
          ),
        ).sort(),
      assetPath,
    );
  expect(resourcePaths).toEqual(
    expectedFiles.map((file) => `${assetPath}${file}`).sort(),
  );
  for (const resource of resourcePaths) {
    // HEAD validates downloadable assets without repeatedly transferring the full source bundle.
    const response = await request.head(resource);
    expect(response.status(), `论文资源应返回 200：${resource}`).toBe(200);
    expect(response.headers()['content-type'], resource).not.toContain(
      'text/html',
    );
    expect(
      Number(response.headers()['content-length']),
      resource,
    ).toBeGreaterThan(0);
  }
});

test('paper library, reading panels and quiz feedback fit a mobile viewport', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '仅检查手机布局。');
  await page.goto(libraryPath);
  await expectNoHorizontalOverflow(page);
  await page
    .locator('[data-paper-card][data-paper-id="memgpt"]')
    .getByRole('link', { name: 'MemGPT', exact: true })
    .click();
  await expectNoHorizontalOverflow(page);
  for (const name of ['中文译稿', '快速复习', '阅读报告']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expectNoHorizontalOverflow(page);
  }
  await page.getByRole('tab', { name: '快速复习', exact: true }).click();
  await page
    .getByRole('radio', { name: '写入模型权重，之后无需输入', exact: true })
    .check();
  await page.locator('[data-quiz-check]').click();
  await expect(page.locator('[data-quiz-feedback]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page
    .getByRole('radio', { name: review[0].answer, exact: true })
    .check();
  await page.locator('[data-quiz-check]').click();
  await expect(page.locator('[data-quiz-feedback]')).toHaveAttribute(
    'data-result',
    'correct',
  );
  await expectNoHorizontalOverflow(page);
});
