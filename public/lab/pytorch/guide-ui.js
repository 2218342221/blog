/* Guided lessons: authored explanations paired with locally verified examples. */
'use strict';
const lessonGuides = {...window.GUIDES_FOUNDATIONS, ...window.GUIDES_DISTRIBUTED, ...window.GUIDES_PROJECTS, ...window.GUIDES_EXTENDED};
const guidePositions = {};
function guideLead(id) {
  const g=lessonGuides[id]; if(!g)return '';
  return `<div class="guide-lead guided-content"><div class="guide-eyebrow">从一个具体问题开始</div><p>${esc(g.scenario)}</p>${g.prerequisites.length?`<div class="guide-prereqs"><span>前置知识</span>${g.prerequisites.map(p=>`<button data-action="lesson" data-id="${esc(p)}">${esc(byId(p)?.title||p)} ↗</button>`).join('')}</div>`:'<div class="guide-prereqs">第一课 · 从这里开始，不需要 PyTorch 基础</div>'}</div><nav class="guide-jumps" aria-label="本课目录"><button data-action="guide-jump" data-target="guide-visual">① 观察图解</button><button data-action="guide-jump" data-target="guide-example">② 分步推导</button><button data-action="guide-jump" data-target="guide-sections">③ 完整讲义</button><button data-action="guide-jump" data-target="guide-check">④ 检验理解</button></nav><div class="guide-observe" id="guide-visual"><strong>${icon('target')} 带着问题看图</strong><p>${esc(g.observe)}</p></div>`;
}
function guideExample(id) {
  const g=lessonGuides[id]; if(!g)return '';
  const w=g.walkthrough;
  return `<div class="guide-terms guided-content"><h2>理解图中的关键词</h2><dl>${g.terms.map(t=>`<div><dt>${esc(t.name)}</dt><dd>${esc(t.meaning)}</dd></div>`).join('')}</dl></div><section class="guide-example guided-content" id="guide-example"><div class="guide-eyebrow">把过程算清楚</div><h2>${esc(w.title)}</h2><p class="guide-prose">${esc(w.intro)}</p><div class="guide-step-tabs" role="group" aria-label="推导步骤">${w.steps.map((s,i)=>`<button data-action="guide-step" data-id="${esc(id)}" data-step="${i}" aria-pressed="${i===(guidePositions[id]||0)}"><span>${i+1}</span>${esc(s.title)}</button>`).join('')}</div><div class="guide-workbench"><div class="guide-explanations">${w.steps.map((s,i)=>`<article class="guide-step-explanation" data-guide-step="${i}" ${i===(guidePositions[id]||0)?'':'hidden'}><div class="guide-step-label">STEP ${i+1} / ${w.steps.length} · 第 ${s.lines[0]}–${s.lines[1]} 行</div><h3>${esc(s.title)}</h3><p class="guide-prose">${esc(s.explanation)}</p><div class="guide-state"><span>此时的数据 / 结论</span><pre>${esc(s.state)}</pre></div></article>`).join('')}<div class="guide-step-nav"><button data-action="guide-step-delta" data-id="${esc(id)}" data-delta="-1" aria-label="上一步推导">← 上一步</button><span class="guide-position"></span><button data-action="guide-step-delta" data-id="${esc(id)}" data-delta="1" aria-label="下一步推导">下一步 →</button></div></div><div class="guide-code"><div class="code-box"><div class="code-toolbar"><span>Python · 高亮行对应当前步骤</span><button data-action="copy">复制代码</button></div><pre><code>${w.code.split('\n').map((line,i)=>`<span data-code-line="${i+1}" class="guide-code-line">${esc(line)}</span>`).join('\n')}</code></pre></div><div class="guide-output"><strong>预期输出</strong><pre>${esc(w.output)}</pre></div><div class="guide-runtime">代码在本地 Python + PyTorch 中运行。这里展示已核对的示例输出，切换步骤用于阅读讲解。</div><button class="small-link" data-action="guide-download" data-id="${esc(id)}">${icon('download')} 下载完整示例 .py</button></div></div></section>`;
}
function guideEnd(id) {
  const g=lessonGuides[id]; if(!g)return '';
  return `<section class="guide-pitfalls guided-content"><div class="guide-eyebrow">理解边界，才能举一反三</div><h2>容易想错的地方</h2>${g.pitfalls.map(p=>`<article><h3>${icon('light')} ${esc(p.wrong)}</h3><p><b>为什么有问题</b>${esc(p.why)}</p><p><b>正确的处理</b>${esc(p.fix)}</p></article>`).join('')}</section><section class="guide-check guided-content" id="guide-check"><div class="guide-eyebrow">先想一想，再展开答案</div><h2>能用自己的话解释吗？</h2><p class="guide-prose">${esc(g.check.prompt)}</p><details><summary>给我一点提示</summary><p class="guide-prose">${esc(g.check.hint)}</p></details><details class="guide-answer"><summary>查看推理与答案</summary><p class="guide-prose">${esc(g.check.answer)}</p></details><div class="guide-transfer"><strong>把它用在真实任务里</strong><p>${esc(g.transfer)}</p></div></section>`;
}
function setGuideStep(id,position) {
  const g=lessonGuides[id];if(!g)return;
  const index=Math.max(0,Math.min(g.walkthrough.steps.length-1,position));
  guidePositions[id]=index;
  const root=document.getElementById('guide-example');if(!root)return;
  root.querySelectorAll('[data-guide-step]').forEach(el=>el.hidden=readingMode!=='full'&&Number(el.dataset.guideStep)!==index);
  root.querySelectorAll('[data-action="guide-step"]').forEach(el=>el.setAttribute('aria-pressed',Number(el.dataset.step)===index));
  const [first,last]=g.walkthrough.steps[index].lines;
  root.querySelectorAll('[data-code-line]').forEach(el=>el.classList.toggle('current-line',Number(el.dataset.codeLine)>=first&&Number(el.dataset.codeLine)<=last));
  root.querySelector('.guide-position').textContent=`${index+1} / ${g.walkthrough.steps.length}`;
  root.querySelector('[data-delta="-1"]').disabled=index===0;
  root.querySelector('[data-delta="1"]').disabled=index===g.walkthrough.steps.length-1;
}
function lessonExtras(section) {
  const formula=section.formula?`<div class="lesson-formula">${window.katex?window.katex.renderToString(section.formula,{displayMode:true,throwOnError:false,output:'htmlAndMathml'}):esc(section.formula)}</div>`:'';
  const f=section.figure;
  const figure=f?`<figure class="lesson-figure"><div class="lesson-table-scroll"><table><thead><tr>${f.columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${f.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><figcaption>${esc(f.caption)}</figcaption></figure>`:'';
  return `${formula}${figure}${section.bodyAfter?`<div class="prose">${esc(section.bodyAfter)}</div>`:''}`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  const id=b.dataset.id;
  if(b.dataset.action==='guide-step')setGuideStep(id,Number(b.dataset.step));
  if(b.dataset.action==='guide-step-delta')setGuideStep(id,(guidePositions[id]||0)+Number(b.dataset.delta));
  if(b.dataset.action==='guide-jump'){
    const target=b.dataset.target;
    if(readingMode==='visual'&&target!=='guide-visual')document.querySelector('[data-mode="guided"]').click();
    document.getElementById(target)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  if(b.dataset.action==='guide-download'){
    const g=lessonGuides[id];if(!g)return;
    const url=URL.createObjectURL(new Blob([g.walkthrough.code+'\n'],{type:'text/x-python;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`torchquest-${id}.py`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
});
