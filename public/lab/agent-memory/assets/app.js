(() => {
  'use strict';
  const menu = document.querySelector('[data-menu]');
  const sidebar = document.querySelector('.sidebar');
  const closeMenu = () => {
    if (sidebar) sidebar.classList.remove('open');
    if (menu) menu.setAttribute('aria-expanded', 'false');
  };
  if (menu && sidebar) menu.addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.sidebar a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  document.querySelectorAll('[data-top]').forEach(button => button.addEventListener('click', () => {
    window.scrollTo({top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }));

  // The catalogue runs entirely in the browser. A paper can belong to several schools.
  document.querySelectorAll('[data-filters]').forEach(filters => {
    const search = filters.querySelector('input[type="search"]');
    const rows = Array.from(document.querySelectorAll('[data-paper-row]'));
    const result = document.querySelector('[data-result-count]');
    const empty = document.querySelector('.empty');
    const selects = Array.from(filters.querySelectorAll('select'));
    const run = () => {
      const query = search ? search.value.trim().toLowerCase() : '';
      let count = 0;
      rows.forEach(row => {
        const match = (!query || row.textContent.toLowerCase().includes(query)) && selects.every(select => {
          if (!select.value) return true;
          if (select.name === 'school') return (row.dataset.schools || '').split(/\s+/).includes(select.value);
          return row.dataset[select.name] === select.value;
        });
        row.hidden = !match;
        if (match) count++;
      });
      if (result) result.textContent = '显示 ' + count + ' / ' + rows.length + ' 条来源';
      if (empty) empty.style.display = count ? 'none' : 'block';
    };
    filters.addEventListener('input', run);
    filters.addEventListener('change', run);
    const reset = filters.querySelector('[data-reset]');
    if (reset) reset.addEventListener('click', () => {
      if (search) search.value = '';
      selects.forEach(select => { select.value = ''; });
      run();
    });
    run();
  });

  const chapterLinks = Array.from(document.querySelectorAll('.chapter-nav [data-chapter]'));
  const chapters = chapterLinks.map(link => ({
    slug: link.dataset.chapter,
    title: link.querySelector('.nav-label').textContent,
    href: link.getAttribute('href'),
    link
  }));
  if (!chapters.length) return;
  const storageKey = 'agent-memory-review:2026-09-24:read-v2';
  let saved = [];
  let persistent = true;
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
    saved = Array.isArray(value) ? value.filter(slug => chapters.some(chapter => chapter.slug === slug)) : [];
    localStorage.setItem(storageKey, JSON.stringify(saved));
  } catch (_) { persistent = false; }
  const read = new Set(saved);
  let current = document.body.dataset.currentChapter || chapters[0].slug;
  const refresh = () => {
    const index = Math.max(0, chapters.findIndex(chapter => chapter.slug === current));
    const currentChapter = chapters[index];
    chapterLinks.forEach(link => {
      const active = link.dataset.chapter === current;
      const done = read.has(link.dataset.chapter);
      link.classList.toggle('active', active);
      link.classList.toggle('is-read', done);
      if (active) link.setAttribute('aria-current', document.body.classList.contains('single') ? 'location' : 'page');
      else link.removeAttribute('aria-current');
      link.setAttribute('aria-label', link.querySelector('.nav-label').textContent + (done ? '，已读' : '，未标记'));
    });
    document.querySelectorAll('[data-progress-caption]').forEach(node => { node.textContent = read.size + ' / ' + chapters.length; });
    document.querySelectorAll('[data-progress-number]').forEach(node => { node.textContent = read.size; });
    document.querySelectorAll('[data-progress-fill]').forEach(node => { node.style.width = (read.size / chapters.length * 100) + '%'; });
    document.querySelectorAll('[role="progressbar"]').forEach(node => { node.setAttribute('aria-valuenow', String(read.size)); });
    document.querySelectorAll('[data-current-number]').forEach(node => { node.textContent = String(index + 1).padStart(2, '0'); });
    document.querySelectorAll('[data-current-title]').forEach(node => { node.textContent = currentChapter.title; });
    document.querySelectorAll('[data-mark-read]').forEach(button => {
      const done = read.has(current);
      button.textContent = done ? '已读 ✓ · 撤销' : '标为已读';
      button.classList.toggle('is-complete', done);
      button.setAttribute('aria-pressed', String(done));
      button.setAttribute('aria-label', (done ? '取消已读标记：' : '标为已读：') + currentChapter.title);
    });
    document.querySelectorAll('[data-storage-note]').forEach(node => {
      node.textContent = persistent ? '仅保存在当前浏览器' : '浏览器存储不可用，暂存于本次阅读';
    });
    const next = chapters.slice(index + 1).find(chapter => !read.has(chapter.slug)) || chapters.find(chapter => !read.has(chapter.slug));
    document.querySelectorAll('[data-next-unread]').forEach(link => {
      link.href = next ? next.href : chapters[0].href;
      link.textContent = next ? '接着读 · ' + next.title + ' →' : '全部已读 · 回到导读 →';
    });
  };
  document.querySelectorAll('[data-mark-read]').forEach(button => button.addEventListener('click', () => {
    if (read.has(current)) read.delete(current);
    else read.add(current);
    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(read))); }
    catch (_) { persistent = false; }
    refresh();
  }));
  window.addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    try {
      const value = JSON.parse(event.newValue || '[]');
      if (Array.isArray(value)) {
        read.clear();
        value.filter(slug => chapters.some(chapter => chapter.slug === slug)).forEach(slug => read.add(slug));
        refresh();
      }
    } catch (_) { /* Preserve the current progress if another tab writes invalid data. */ }
  });
  if (document.body.classList.contains('single')) {
    const sections = chapters.map(chapter => ({slug: chapter.slug, node: document.getElementById('chapter-' + chapter.slug)})).filter(item => item.node);
    let scheduled = false;
    const trackChapter = () => {
      scheduled = false;
      let visible = sections[0];
      for (const section of sections) {
        if (section.node.getBoundingClientRect().top <= 180) visible = section;
        else break;
      }
      if (visible && visible.slug !== current) { current = visible.slug; refresh(); }
    };
    window.addEventListener('scroll', () => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(trackChapter); }
    }, {passive: true});
    window.addEventListener('hashchange', () => requestAnimationFrame(trackChapter));
    requestAnimationFrame(trackChapter);
  }
  refresh();
})();

// Include optional source audits in printed copies, then restore reading state.
{
  let printDetails = [];
  window.addEventListener("beforeprint", () => {
    printDetails = Array.from(document.querySelectorAll("details.case-study:not([open])"));
    printDetails.forEach(detail => { detail.open = true; });
  });
  window.addEventListener("afterprint", () => {
    printDetails.forEach(detail => { detail.open = false; });
    printDetails = [];
  });
}
