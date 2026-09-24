/* One intentional, finite playback at a time. No network or animation dependency. */
(() => {
  'use strict';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controllers = [];
  let active = null;
  const svgNS = 'http://www.w3.org/2000/svg';

  document.querySelectorAll('.animated-diagram').forEach(figure => {
    const source = figure.querySelector('.diagram-story');
    const player = figure.querySelector('.diagram-player');
    const svg = figure.querySelector('svg');
    if (!source || !player || !svg) return;
    let story;
    try { story = JSON.parse(source.textContent); } catch (_) { return; }
    if (!Array.isArray(story.steps) || !story.steps.length) return;
    const viewport = figure.querySelector('.diagram-viewport');
    const parts = Array.from(svg.querySelectorAll('[data-part]'));
    const byKey = new Map(parts.map(node => [node.dataset.part, node]));
    const buttons = Array.from(player.querySelectorAll('[data-diagram-step]'));
    const toolbar = figure.querySelector('.diagram-toolbar');
    const button = action => figure.querySelector('[data-diagram-action="' + action + '"]');
    const play = button('play'), previous = button('previous'), next = button('next');
    const title = player.querySelector('[data-step-title]');
    const description = player.querySelector('[data-step-description]');
    const badge = player.querySelector('[data-step-badge]');
    const count = figure.querySelector('[data-step-count]');
    const progress = player.querySelector('.diagram-progress>span');
    const speed = figure.querySelector('.diagram-speed select');
    let index = -1, elapsed = 0, running = false, frameId = 0, lastTick = null;
    let packets = [];
    const duration = () => Math.max(4000, Math.min(7000, story.steps[Math.max(0, index)].text.length * 72));
    const updateControls = () => {
      play.textContent = motion.matches ? '逐步查看 →' : running ? 'Ⅱ 暂停' : index === story.steps.length - 1 && elapsed >= duration() ? '↻ 重新播放' : index < 0 ? '▶ 播放演示' : '▶ 继续播放';
      play.setAttribute('aria-label', play.textContent.replace(/^[▶Ⅱ↻]\s*/, '') + '：' + story.label);
      previous.disabled = index <= 0;
      next.disabled = index === story.steps.length - 1;
      count.textContent = index < 0 ? '全图' : (index + 1) + ' / ' + story.steps.length;
      figure.classList.toggle('is-playing', running);
      figure.classList.toggle('reduced-motion', motion.matches);
      figure.dataset.playing = String(running);
      figure.dataset.activeStep = index < 0 ? 'overview' : String(index);
    };
    const removePackets = () => { packets.forEach(item => item.dot.remove()); packets = []; };
    const buildPackets = () => {
      removePackets();
      if (!running || motion.matches || index < 0) return;
      (story.steps[index].trace || []).forEach(key => {
        const group = byKey.get(key);
        if (!group) return;
        group.querySelectorAll('path,line,polyline').forEach(path => {
          if (typeof path.getTotalLength !== 'function') return;
          const length = path.getTotalLength();
          if (!Number.isFinite(length) || length <= 0) return;
          const dot = document.createElementNS(svgNS, 'circle');
          dot.setAttribute('r', '5.5');
          dot.setAttribute('class', 'diagram-packet');
          dot.setAttribute('aria-hidden', 'true');
          group.append(dot);
          packets.push({dot, path, length});
        });
      });
    };
    const panToFocus = () => {
      if (index < 0) { viewport.scrollTo({left: 0, behavior: 'auto'}); return; }
      if (viewport.scrollWidth <= viewport.clientWidth + 1) return;
      const focusKeys = story.steps[index].focus.filter(key => byKey.has(key) && !byKey.get(key).classList.contains('diagram-edge'));
      const prior = index > 0 ? story.steps[index - 1].focus : [];
      const newKeys = index > 0 ? focusKeys.filter(key => !prior.includes(key)) : [];
      const key = story.steps[index].pan || newKeys[0] || focusKeys[focusKeys.length - 1];
      if (!key) return;
      const rect = byKey.get(key).getBoundingClientRect(), visible = viewport.getBoundingClientRect();
      viewport.scrollTo({left: viewport.scrollLeft + rect.x + rect.width / 2 - visible.x - visible.width / 2, behavior: motion.matches ? 'auto' : 'smooth'});
    };
    const render = (pan = true) => {
      const step = story.steps[index];
      const selected = step ? new Set([...step.focus, ...(step.trace || [])]) : null;
      const selectedNodes = selected ? parts.filter(node => selected.has(node.dataset.part)) : [];
      parts.forEach(node => {
        const focused = selected && (selected.has(node.dataset.part) || selectedNodes.some(child => node.contains(child)));
        node.classList.toggle('is-active', Boolean(focused));
        node.classList.toggle('is-muted', Boolean(selected && !focused));
      });
      buttons.forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)));
      if (index >= 0) {
        const strip = player.querySelector('.diagram-steps');
        if (strip.scrollWidth > strip.clientWidth + 1) {
          const item = buttons[index].getBoundingClientRect(), rail = strip.getBoundingClientRect();
          strip.scrollTo({left: strip.scrollLeft + item.x - rail.x - 6, behavior: motion.matches ? 'auto' : 'smooth'});
        }
      }
      badge.textContent = step ? String(index + 1).padStart(2, '0') : '全图';
      title.textContent = step ? step.title : '先看全貌，再跟随讲解';
      description.textContent = step ? step.text : story.intro;
      progress.style.transform = 'scaleX(' + (step ? Math.min(1, elapsed / duration()) : 0) + ')';
      updateControls();
      buildPackets();
      if (pan) panToFocus();
    };
    const pause = () => {
      running = false;
      cancelAnimationFrame(frameId);
      lastTick = null;
      removePackets();
      if (active === controller) active = null;
      updateControls();
    };
    const select = (value, keepPlaying = false) => {
      if (!keepPlaying) pause();
      index = value;
      elapsed = 0;
      render();
      if (!keepPlaying) frameDiagram();
    };
    const frameDiagram = () => {
      const rect = viewport.getBoundingClientRect();
      const margin = innerWidth <= 760 ? 83 : 30;
      if (rect.top < margin || rect.bottom > innerHeight - 120) {
        figure.scrollIntoView({block: 'start', behavior: motion.matches ? 'auto' : 'smooth'});
      }
    };
    const frame = timestamp => {
      if (!running) return;
      if (lastTick !== null) elapsed += Math.min(timestamp - lastTick, 150) * Number(speed.value);
      lastTick = timestamp;
      if (elapsed >= duration()) {
        if (index === story.steps.length - 1) {
          elapsed = duration();
          progress.style.transform = 'scaleX(1)';
          pause();
          return;
        }
        select(index + 1, true);
      }
      progress.style.transform = 'scaleX(' + Math.min(1, elapsed / duration()) + ')';
      packets.forEach(({dot, path, length}, i) => {
        const position = path.getPointAtLength(((elapsed / 1500 + i * .24) % 1) * length);
        dot.setAttribute('cx', position.x);
        dot.setAttribute('cy', position.y);
      });
      frameId = requestAnimationFrame(frame);
    };
    const start = () => {
      if (motion.matches) { select(index >= story.steps.length - 1 ? 0 : index + 1); return; }
      if (running) { pause(); return; }
      if (active && active !== controller) active.pause();
      if (index < 0 || index === story.steps.length - 1 && elapsed >= duration()) select(0);
      active = controller;
      running = true;
      lastTick = null;
      updateControls();
      buildPackets();
      frameDiagram();
      frameId = requestAnimationFrame(frame);
    };
    const controller = {figure, pause, render, updateControls};
    controllers.push(controller);
    play.addEventListener('click', start);
    previous.addEventListener('click', () => select(Math.max(0, index - 1)));
    next.addEventListener('click', () => select(Math.min(story.steps.length - 1, index + 1)));
    button('overview').addEventListener('click', () => select(-1));
    buttons.forEach((item, i) => item.addEventListener('click', () => select(i)));
    const details = figure.closest('details');
    if (details) details.addEventListener('toggle', () => { if (!details.open) pause(); });
    player.hidden = false;
    toolbar.hidden = false;
    render(false);
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) controllers.find(item => item.figure === entry.target)?.pause();
      });
    }, {threshold: 0});
    controllers.forEach(item => observer.observe(item.figure));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) controllers.forEach(item => item.pause()); });
  window.addEventListener('pagehide', () => controllers.forEach(item => item.pause()));
  motion.addEventListener('change', () => controllers.forEach(item => { item.pause(); item.updateControls(); }));
  window.addEventListener('beforeprint', () => controllers.forEach(item => {
    item.pause();
    item.figure.classList.add('diagram-printing');
  }));
  window.addEventListener('afterprint', () => controllers.forEach(item => item.figure.classList.remove('diagram-printing')));
})();
