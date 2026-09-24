import { expect, test, type Page } from '@playwright/test';
import { site } from '../src/config/site';

const prefix = (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '');
const basePath = prefix ? `/${prefix}/` : '/';
const pathTo = (path = '') => `${basePath}${path.replace(/^\/+/, '')}`;
const preferenceKey = 'pagewise.home.language';
type Language = 'en' | 'zh';

const copy = {
  en: {
    brand: 'Pagewise',
    heading: 'Let knowledge grow.',
    empty: 'Every idea starts with a blank page.',
    navigation: ['Home', 'Topics', 'Archive', 'About'],
    search: 'Search notes',
    dialog: 'Find a note',
    input: 'Search titles, tags, or content',
    noResults: 'No notes found. Try another keyword.',
    archive: 'Archive',
  },
  zh: {
    brand: site.name,
    heading: '让知识，生长。',
    empty: '一页空白，也是一种开始。',
    navigation: ['首页', '学习专题', '归档', '关于'],
    search: '搜索笔记',
    dialog: '找一篇笔记',
    input: '搜索标题、标签或正文',
    noResults: '暂时没有相关笔记，换个关键词试试。',
    archive: '归档',
  },
};

// A browser configured in Chinese must still receive the English default.
test.use({ locale: 'zh-CN', storageState: { cookies: [], origins: [] } });

async function expectLanguage(page: Page, language: Language) {
  const expected = copy[language];
  await expect(page.locator('html')).toHaveAttribute(
    'lang',
    language === 'en' ? 'en' : 'zh-CN',
  );
  await expect(page.locator('html')).toHaveAttribute(
    'data-home-language',
    language,
  );
  await expect(page).toHaveTitle(language === 'en' ? site.titleEn : site.title);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    expected.heading,
  );
  await expect(page.locator('.brand')).toContainText(expected.brand);
  await expect(page.locator('.footer-brand')).toHaveText(expected.brand);
  await expect(page.locator('.desktop-nav a')).toHaveText(expected.navigation);
  await expect(page.locator('#mobile-nav a')).toHaveText(expected.navigation);
  await expect(page.locator('[data-search-open]')).toHaveAccessibleName(
    expected.search,
  );
  const toggle = page.locator('button[data-home-language-toggle]');
  await expect(toggle).toHaveCount(1);
  await expect(toggle).toHaveText(language === 'en' ? '中文' : 'EN');
  await expect(toggle).toHaveAccessibleName(
    language === 'en' ? 'Switch to Chinese' : '切换为英文',
  );
  expect(await toggle.getAttribute('aria-pressed')).toBeNull();
  if (await page.locator('.empty-journal').count()) {
    await expect(page.locator('.empty-journal h3')).toHaveText(expected.empty);
  }
}

async function selectLanguage(page: Page, language: Language) {
  if (
    (await page.locator('html').getAttribute('data-home-language')) !== language
  ) {
    await page.locator('button[data-home-language-toggle]').click();
  }
  await expectLanguage(page, language);
}

async function expectNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }));
  expect(size.content, `页面不应横向溢出：${page.url()}`).toBeLessThanOrEqual(
    size.viewport + 1,
  );
}

test('defaults to English, remembers the chosen language, and keeps other pages Chinese', async ({
  page,
}) => {
  await page.goto(pathTo());
  expect(await page.evaluate(() => navigator.language)).toBe('zh-CN');
  await expectLanguage(page, 'en');

  await selectLanguage(page, 'zh');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
  ).toBe('zh');
  await page.reload();
  await expectLanguage(page, 'zh');

  await page.locator('button[data-home-language-toggle]').focus();
  await page.keyboard.press('Enter');
  await expectLanguage(page, 'en');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), preferenceKey),
  ).toBe('en');
  await page.reload();
  await expectLanguage(page, 'en');
  await page.locator('.hero-secondary').click();
  await expect(page).toHaveURL((url) => url.pathname === pathTo('about/'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('关于这里');
  await expect(page.locator('[data-search-open]')).toHaveAccessibleName(
    '搜索笔记',
  );
  await page.locator('.brand').click();
  await expectLanguage(page, 'en');
});

test('language switching works when localStorage is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage is disabled', 'SecurityError');
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathTo());
  await expectLanguage(page, 'en');
  await selectLanguage(page, 'zh');
  await selectLanguage(page, 'en');
  expect(errors).toEqual([]);
});

test('both languages work in navigation and empty search without horizontal overflow', async ({
  page,
  request,
}, testInfo) => {
  const indexResponse = await request.get(pathTo('search-index.json'));
  expect(indexResponse.ok()).toBe(true);
  const searchableContent = (await indexResponse.text()).toLowerCase();
  let missingQuery = '__no_matching_note__';
  while (searchableContent.includes(missingQuery)) missingQuery += '_';

  await page.goto(pathTo());
  for (const language of ['en', 'zh'] as const) {
    await selectLanguage(page, language);
    if (testInfo.project.name === 'mobile') {
      await expectNoHorizontalOverflow(page);
      const menu = page.locator('.menu-trigger');
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      const navigation = page.locator('#mobile-nav');
      await expect(navigation).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await navigation
        .getByRole('link', { name: copy[language].archive, exact: true })
        .click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        '笔记归档',
      );
      await page.locator('.brand').click();
      await expectLanguage(page, language);
    }

    await page
      .getByRole('button', { name: copy[language].search, exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: copy[language].dialog });
    await expect(dialog).toBeVisible();
    const input = dialog.getByRole('searchbox', {
      name: copy[language].input,
      exact: true,
    });
    await expect(input).toBeFocused();
    await input.fill(missingQuery);
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await expect(dialog.getByRole('status')).toHaveText(
      copy[language].noResults,
    );
    if (testInfo.project.name === 'mobile')
      await expectNoHorizontalOverflow(page);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the English homepage and ordinary page links remain usable', async ({
    page,
  }) => {
    await page.goto(pathTo());
    await expectLanguage(page, 'en');
    await page.locator('.hero-secondary').click();
    await expect(page).toHaveURL((url) => url.pathname === pathTo('about/'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '关于这里',
    );
  });
});
