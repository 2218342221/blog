import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { site } from '../src/config/site';

const prefix = (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '');
const basePath = prefix ? `/${prefix}/` : '/';
const pathTo = (path = '') => `${basePath}${path.replace(/^\/+/, '')}`;
type PublishedNote = {
  title: string;
  category: string;
  url: string;
  body: string;
};
const isArticle = (note: PublishedNote) =>
  note.url.startsWith(pathTo('notes/'));

async function selectChineseHome(page: Page) {
  if (
    (await page.locator('html').getAttribute('data-home-language')) !== 'zh'
  ) {
    await page.locator('button[data-home-language-toggle]').click();
  }
  await expect(page.locator('html')).toHaveAttribute(
    'data-home-language',
    'zh',
  );
}

async function getPublishedNotes(
  request: APIRequestContext,
): Promise<PublishedNote[]> {
  const response = await request.get(pathTo('search-index.json'));
  expect(response.ok()).toBe(true);
  const notes = (await response.json()) as PublishedNote[];
  expect(Array.isArray(notes)).toBe(true);
  for (const note of notes) {
    expect(note.title.trim()).not.toBe('');
    expect(note.category.trim()).not.toBe('');
    expect(note.url.startsWith(basePath)).toBe(true);
    expect(note.url).toMatch(/^\/(?!\/)/);
  }
  expect(new Set(notes.map((note) => note.url)).size).toBe(notes.length);
  return notes;
}

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
    `页面不应出现横向溢出：${page.url()}`,
  ).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function parseXml(page: Page, source: string, selector: string) {
  return page.evaluate(
    ({ xml, selector }) => {
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      if (document.querySelector('parsererror'))
        throw new Error('The response is not valid XML');
      return Array.from(
        document.querySelectorAll(selector),
        (node) => node.textContent?.trim() || '',
      );
    },
    { xml: source, selector },
  );
}

test('read published notes and filter by learning topic', async ({
  page,
  request,
}) => {
  const notes = await getPublishedNotes(request);
  await page.goto(pathTo());
  await selectChineseHome(page);
  await expect(page).toHaveTitle(site.title);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const visibleCards = page.locator('#latest [data-note-card]:visible');
  await expect(visibleCards).toHaveCount(notes.length);
  await expect(visibleCards.locator('h3')).toHaveText(
    notes.map((note) => note.title),
  );
  for (const [index, note] of notes.entries()) {
    const card = visibleCards.nth(index);
    await expect(card.locator('a.note-cover')).toHaveAttribute(
      'href',
      note.url,
    );
    await expect(card.locator('h3 a')).toHaveAttribute('href', note.url);
  }

  const filters = page.locator('.filters');
  if (notes.length === 0) {
    await expect(page.locator('.empty-journal')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        level: 3,
        name: '一页空白，也是一种开始。',
        exact: true,
      }),
    ).toBeVisible();
    return;
  }
  await expect(filters).toBeVisible();

  for (const filter of await filters.getByRole('button').all()) {
    const label = (await filter.innerText()).trim();
    if (label.startsWith('全部笔记')) continue;
    const titles = notes
      .filter((note) => note.category === label)
      .map((note) => note.title);
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(visibleCards.locator('h3')).toHaveText(titles);
    await expect(page.locator('#filter-count')).toHaveText(
      `共 ${titles.length} 篇笔记`,
    );
  }

  await page.getByRole('button', { name: /^全部笔记/ }).click();
  await expect(visibleCards).toHaveCount(notes.length);
  await expect(page.locator('#filter-count')).toHaveText(
    `共 ${notes.length} 篇笔记`,
  );
});

test('search with the keyboard, open matching notes, and dismiss with Escape', async ({
  page,
  request,
}) => {
  const notes = await getPublishedNotes(request);
  await page.goto(pathTo());
  await selectChineseHome(page);
  const dialog = page.getByRole('dialog', { name: '找一篇笔记' });
  const input = page.getByRole('searchbox', { name: '搜索标题、标签或正文' });

  const samples = notes
    .filter(
      (note, index) =>
        notes.findIndex((other) => other.title === note.title) === index,
    )
    .slice(0, 2);
  for (const note of samples) {
    await page.keyboard.press('/');
    await expect(dialog).toBeVisible();
    await expect(input).toBeFocused();
    await input.fill(note.title);
    await dialog
      .getByRole('link')
      .filter({ has: page.getByText(note.title, { exact: true }) })
      .first()
      .click();
    await expect(page).toHaveURL((url) => url.pathname === note.url);
    if (isArticle(note)) {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        note.title,
      );
    } else {
      await expect(
        page.getByRole('heading', { level: 1 }).first(),
      ).toBeVisible();
      await page.goto(pathTo());
      await selectChineseHome(page);
    }
  }

  await page.keyboard.press('/');
  await expect(dialog).toBeVisible();
  let missingQuery = '__no_matching_note__';
  while (JSON.stringify(notes).toLowerCase().includes(missingQuery))
    missingQuery += '_';
  await input.fill(missingQuery);
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await expect(dialog.getByRole('status')).toContainText('暂时没有相关笔记');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('read an article and follow its table of contents', async ({
  page,
  request,
}, testInfo) => {
  const notes = (await getPublishedNotes(request)).filter(isArticle);
  test.skip(notes.length === 0, '没有 Markdown 文章时，无需验证文章与目录。');
  const note = notes[0];
  await page.goto(note.url);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(note.title);
  await expect(page.locator('.article-meta')).toContainText(site.author);
  const headings = await page
    .locator('.prose h2, .prose h3')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.id,
        text: node.textContent?.trim() || '',
      })),
    );
  const toc = page.locator('nav[aria-label="文章目录"]');
  await expect(toc.locator('a')).toHaveText(
    headings.map((heading) => heading.text),
  );
  const anchors = await toc
    .locator('a')
    .evaluateAll((links) =>
      links.map((link) => decodeURIComponent(link.getAttribute('href') || '')),
    );
  expect(anchors).toEqual(headings.map((heading) => `#${heading.id}`));
  expect(headings.every((heading) => heading.id.length > 0)).toBe(true);
  if (testInfo.project.name === 'desktop' && headings.length > 0) {
    await toc.getByRole('link').first().click();
    await expect(page).toHaveURL(
      (url) => decodeURIComponent(url.hash) === `#${headings[0].id}`,
    );
    await expect(page.locator('.prose h2, .prose h3').first()).toBeInViewport();
  }
});

test('published pages, static assets and internal links are reachable', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(60_000);
  const failedRequests: string[] = [];
  let origin = '';
  page.on('response', (response) => {
    if (new URL(response.url()).origin === origin && response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).origin === origin) {
      failedRequests.push(`${request.failure()?.errorText} ${request.url()}`);
    }
  });

  origin = new URL(testInfo.project.use.baseURL as string).origin;
  const notes = await getPublishedNotes(request);
  const routes = [
    { url: new URL(pathTo(), origin).href, title: '', standalone: false },
    {
      url: new URL(pathTo('archive/'), origin).href,
      title: '笔记归档',
      standalone: false,
    },
    {
      url: new URL(pathTo('topics/'), origin).href,
      title: '学习专题',
      standalone: false,
    },
    {
      url: new URL(pathTo('about/'), origin).href,
      title: '关于这里',
      standalone: false,
    },
    ...notes.map((note) => ({
      url: new URL(note.url, origin).href,
      title: note.title,
      standalone: !isArticle(note),
    })),
  ];
  const idsByPath = new Map<string, Set<string>>();
  const internalLinks = new Set<string>();

  for (const route of routes) {
    const response = await page.goto(route.url);
    expect(response?.ok(), route.url).toBe(true);
    await expect(page).toHaveURL(
      (url) => url.pathname === new URL(route.url).pathname,
    );
    const isHome = new URL(route.url).pathname === basePath;
    if (route.standalone) {
      await expect(
        page.getByRole('heading', { level: 1 }).first(),
      ).toBeVisible();
    } else {
      if (route.title)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          route.title,
        );
      if (isHome) await expect(page).toHaveTitle(site.titleEn);
      await expect(page.locator('main')).toBeVisible();
      // The ordinary blog layout owns the author metadata and footer.
      await expect(page.locator('meta[name="author"]')).toHaveCount(1);
      await expect(page.locator('meta[name="author"]')).toHaveAttribute(
        'content',
        site.author,
      );
      await expect(page.locator('.site-footer')).toContainText(
        isHome ? site.nameEn : site.name,
      );
    }
    if (testInfo.project.name === 'mobile')
      await expectNoHorizontalOverflow(page);

    idsByPath.set(
      new URL(page.url()).pathname,
      new Set(
        await page
          .locator('[id]')
          .evaluateAll((nodes) => nodes.map((node) => node.id)),
      ),
    );
    const links = await page
      .locator('a[href]')
      .evaluateAll((anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
      );
    for (const href of links) {
      const url = new URL(href);
      if (url.origin !== origin) continue;
      expect(
        url.pathname.startsWith(basePath),
        `内链应保留 BASE_PATH：${href}`,
      ).toBe(true);
      internalLinks.add(href);
    }
  }

  const checkedPaths = new Set(idsByPath.keys());
  for (const href of internalLinks) {
    const url = new URL(href);
    if (!checkedPaths.has(url.pathname)) {
      const response = await request.get(href);
      expect(response.ok(), `内链应可访问：${href}`).toBe(true);
      checkedPaths.add(url.pathname);
    }
    if (url.hash && idsByPath.has(url.pathname)) {
      expect(
        idsByPath.get(url.pathname)?.has(decodeURIComponent(url.hash.slice(1))),
        `锚点应存在：${href}`,
      ).toBe(true);
    }
  }
  expect(failedRequests, '页面及 CSS、JS、图片等资源请求不应失败').toEqual([]);
});

test('RSS, search index and sitemap preserve the deployment base path', async ({
  page,
  request,
}) => {
  const notes = await getPublishedNotes(request);
  const notePaths = notes.map((note) => note.url).sort();

  const rssResponse = await request.get(pathTo('rss.xml'));
  expect(rssResponse.ok()).toBe(true);
  const rss = await rssResponse.text();
  expect(await parseXml(page, rss, 'channel > title')).toEqual([site.title]);
  const channelLinks = await parseXml(page, rss, 'channel > link');
  expect(channelLinks).toHaveLength(1);
  expect(new URL(channelLinks[0]).pathname).toBe(basePath);
  const feedLinks = await parseXml(page, rss, 'item > link');
  expect(feedLinks).toHaveLength(notes.length);
  expect(feedLinks.map((link) => new URL(link).pathname).sort()).toEqual(
    notePaths,
  );

  const sitemapIndex = await request.get(pathTo('sitemap-index.xml'));
  expect(sitemapIndex.ok()).toBe(true);
  const sitemapUrls = await parseXml(
    page,
    await sitemapIndex.text(),
    'sitemap > loc',
  );
  expect(sitemapUrls.length).toBeGreaterThan(0);
  const sitemapPaths: string[] = [];
  for (const sitemapUrl of sitemapUrls) {
    const url = new URL(sitemapUrl);
    expect(url.pathname.startsWith(basePath)).toBe(true);
    // The feed uses the canonical public origin; validate its paths on this local build.
    const sitemap = await request.get(url.pathname);
    expect(sitemap.ok(), url.pathname).toBe(true);
    const locations = await parseXml(page, await sitemap.text(), 'url > loc');
    sitemapPaths.push(
      ...locations.map((location) => new URL(location).pathname),
    );
  }
  expect(sitemapPaths.every((path) => path.startsWith(basePath))).toBe(true);
  expect(sitemapPaths).toEqual(
    expect.arrayContaining([
      pathTo(),
      pathTo('archive/'),
      pathTo('topics/'),
      pathTo('about/'),
      ...notes.filter(isArticle).map((note) => note.url),
    ]),
  );
});

test('mobile navigation expands and reaches another page', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '移动菜单仅在手机布局中显示。');
  await page.goto(pathTo());
  await selectChineseHome(page);
  await expectNoHorizontalOverflow(page);
  const menu = page.locator('.menu-trigger');
  const navigation = page.getByRole('navigation', { name: '移动端导航' });
  await expect(navigation).not.toBeVisible();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await navigation.getByRole('link', { name: '归档', exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === pathTo('archive/'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('笔记归档');
  await expectNoHorizontalOverflow(page);
});
