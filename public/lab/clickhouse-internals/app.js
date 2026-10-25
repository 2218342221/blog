(function () {
  "use strict";

  var STORAGE_KEY = "column-quest:v2";
  var DATA = window.CQ_DATA || { units: [], glossary: {}, lessons: [] };
  var lessons = Array.isArray(DATA.lessons) ? DATA.lessons.slice().sort(function (a, b) { return a.id - b.id; }) : [];
  var lessonById = new Map(lessons.map(function (lesson) { return [lesson.id, lesson]; }));
  var currentLessonId = lessons.length ? lessons[0].id : 0;
  var mobileMenuOpen = false;
  var toastTimer = null;
  var dom = {};
  var state = loadState();

  function defaultState() {
    return { version: 2, currentLesson: currentLessonId, completed: [], quizAnswers: {}, theme: "light" };
  }

  function loadState() {
    var fallback = defaultState();
    try {
      var parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || parsed.version !== 2) return fallback;
      parsed.completed = Array.isArray(parsed.completed) ? parsed.completed.map(Number).filter(function (id, index, list) {
        return lessonById.has(id) && list.indexOf(id) === index;
      }) : [];
      parsed.quizAnswers = parsed.quizAnswers && typeof parsed.quizAnswers === "object" ? parsed.quizAnswers : {};
      parsed.currentLesson = lessonById.has(Number(parsed.currentLesson)) ? Number(parsed.currentLesson) : fallback.currentLesson;
      parsed.theme = parsed.theme === "dark" ? "dark" : "light";
      return Object.assign(fallback, parsed);
    } catch (error) {
      return fallback;
    }
  }

  function saveState() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* Session still works. */ }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i += 1) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }

  function attr(node, values) {
    Object.keys(values || {}).forEach(function (name) {
      var value = values[name];
      if (value === false || value === null || value === undefined) return;
      node.setAttribute(name, value === true ? "" : String(value));
    });
    return node;
  }

  function button(text, className, handler) {
    var node = el("button", className, text);
    node.type = "button";
    if (handler) node.addEventListener("click", handler);
    return node;
  }

  function selectControl(label, choices, value) {
    var wrapper = el("label", "lab-control");
    var input = el("select", "lab-select");
    wrapper.appendChild(el("span", "lab-control-label", label));
    choices.forEach(function (choice) {
      var option = el("option", "", choice.label);
      option.value = choice.value;
      option.selected = choice.value === value;
      input.appendChild(option);
    });
    wrapper.appendChild(input);
    return { wrapper: wrapper, input: input };
  }

  function rangeControl(label, min, max, step, value, suffix) {
    var wrapper = el("label", "lab-control range-control");
    var row = el("span", "lab-control-row");
    var output = el("output", "lab-control-value", value + (suffix || ""));
    var input = attr(el("input", "lab-range"), { type: "range", min: min, max: max, step: step, value: value });
    append(row, el("span", "lab-control-label", label), output);
    append(wrapper, row, input);
    input.addEventListener("input", function () { output.value = input.value + (suffix || ""); });
    return { wrapper: wrapper, input: input, output: output };
  }

  function metric(label, value, note) {
    var card = el("div", "metric-card");
    append(card, el("span", "metric-label", label), el("strong", "metric-value", value));
    if (note) card.appendChild(el("small", "metric-note", note));
    return card;
  }

  function schematic(text) { return el("p", "schematic-note", "教学示意：" + text); }

  function segmented(choices, active, onChange, label) {
    var group = attr(el("div", "segmented-control"), { role: "group", "aria-label": label || "选项" });
    var buttons = [];
    choices.forEach(function (choice) {
      var item = button(choice.label, "segment-button", function () {
        buttons.forEach(function (candidate) { candidate.setAttribute("aria-pressed", String(candidate === item)); });
        onChange(choice.value);
      });
      item.setAttribute("aria-pressed", String(choice.value === active));
      buttons.push(item);
      group.appendChild(item);
    });
    return group;
  }

  function showToast(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { dom.toast.classList.remove("is-visible"); }, 2600);
  }

  function reducedMotion() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var area = el("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); resolve(); } catch (error) { reject(error); } finally { area.remove(); }
    });
  }

  function lessonIndex(id) { return lessons.findIndex(function (lesson) { return lesson.id === id; }); }

  function currentUnit(id) {
    var units = Array.isArray(DATA.units) ? DATA.units : [];
    for (var i = 0; i < units.length; i += 1) if ((units[i].lessons || []).indexOf(id) >= 0) return units[i];
    return { title: (lessonById.get(id) || {}).unit || "课程" };
  }

  function renderNavigation() {
    dom.lessonNav.replaceChildren();
    (DATA.units || []).forEach(function (unit) {
      var section = el("section", "lesson-nav-unit");
      section.appendChild(el("h2", "unit-title", unit.title));
      (unit.lessons || []).forEach(function (id) {
        var lesson = lessonById.get(id);
        if (!lesson) return;
        var item = button("", "lesson-nav-button", function () { navigate(id, { focus: true }); });
        item.dataset.lesson = id;
        item.dataset.nav = "lesson-" + id;
        var copy = el("span", "lesson-nav-copy");
        append(copy, el("strong", "", lesson.shortTitle || lesson.title), el("small", "", lesson.duration || ""));
        append(item, el("span", "lesson-node"), copy, el("span", "lesson-status", "›"));
        section.appendChild(item);
      });
      dom.lessonNav.appendChild(section);
    });
    updateNavState();
  }

  function updateNavState() {
    document.querySelectorAll(".lesson-nav-button").forEach(function (item) {
      var id = Number(item.dataset.lesson);
      var active = id === currentLessonId;
      var done = state.completed.indexOf(id) >= 0;
      item.classList.toggle("is-active", active);
      item.classList.toggle("is-complete", done);
      if (active) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
      item.querySelector(".lesson-node").textContent = done ? "✓" : String(lessonIndex(id) + 1);
      item.querySelector(".lesson-status").textContent = done ? "已完成" : "›";
      item.setAttribute("aria-label", "第 " + (lessonIndex(id) + 1) + " 课：" + (lessonById.get(id).shortTitle || lessonById.get(id).title) + (done ? "，已完成" : ""));
    });
  }

  function navigate(id, options) {
    options = options || {};
    id = lessonById.has(Number(id)) ? Number(id) : (lessons[0] || { id: 0 }).id;
    currentLessonId = id;
    state.currentLesson = id;
    saveState();
    renderLesson(id);
    updateNavState();
    updateProgress();
    closeMobileMenu();
    if (options.updateHash !== false && window.location.hash !== "#lesson-" + id) history.replaceState(null, "", "#lesson-" + id);
    if (options.scroll !== false) window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
    if (options.focus) {
      var title = document.getElementById("lesson-" + id + "-title");
      if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
    }
  }

  function renderLesson(id) {
    var lesson = lessonById.get(id);
    if (!lesson) { dom.lessonView.replaceChildren(el("p", "callout tone-warning", "课程数据尚未加载完整，请刷新页面。")); return; }
    var fragment = document.createDocumentFragment();
    var header = el("header", "lesson-header");
    header.appendChild(el("p", "lesson-kicker", "第 " + (lessonIndex(id) + 1) + " 课 · " + currentUnit(id).title));
    var title = el("h1", "", lesson.title);
    title.id = "lesson-" + id + "-title";
    header.appendChild(title);
    var meta = el("div", "lesson-meta");
    append(meta, el("span", "", lesson.duration || "深度阅读"), el("span", "", (lesson.sections || []).length + " 个知识段"), el("span", "", (lesson.quiz || []).length + " 道检查题"));
    header.appendChild(meta);
    if (lesson.thesis) header.appendChild(el("p", "lesson-lead", lesson.thesis));
    if ((lesson.goals || []).length) {
      var goals = el("section", "learning-goals");
      goals.appendChild(el("h3", "", "学完本课，你应该能够"));
      var goalList = el("ul");
      lesson.goals.forEach(function (goal) { goalList.appendChild(el("li", "", goal)); });
      goals.appendChild(goalList);
      header.appendChild(goals);
    }
    fragment.appendChild(header);
    (lesson.sections || []).forEach(function (section, index) { fragment.appendChild(renderSection(section, id, index)); });
    if ((lesson.recap || []).length) fragment.appendChild(renderRecap(lesson.recap));
    fragment.appendChild(renderQuiz(lesson));
    fragment.appendChild(renderFooter(id));
    dom.lessonView.replaceChildren(fragment);
    dom.lessonView.className = "lesson-view lesson";
    dom.lessonView.dataset.lesson = id;
    dom.prerequisite.textContent = lesson.prerequisite || "按课程顺序学习即可。";
    dom.mobileCurrentTitle.textContent = "第 " + (lessonIndex(id) + 1) + " 课 · " + (lesson.shortTitle || lesson.title);
    renderLessonGlossary(lesson.terms || []);
  }

  function shell(section, className) {
    var node = el("section", "lesson-section" + (className ? " " + className : ""));
    if (section.title) node.appendChild(el("h3", "section-heading", section.title));
    return node;
  }

  function paragraphs(parent, values) {
    (Array.isArray(values) ? values : values ? [values] : []).forEach(function (value) { parent.appendChild(el("p", "", value)); });
  }

  function renderSection(section, lessonId, index) {
    var renderers = { case: renderCase, prose: renderProse, steps: renderSteps, table: renderTable, code: renderCode, callout: renderCallout, details: renderDetails, distinction: renderDistinction, diagram: renderDiagram };
    if (section.type === "lab") return renderLab(section, lessonId, index);
    return (renderers[section.type] || renderProse)(section);
  }

  function renderCase(section) {
    var node = shell(section, "case-study");
    var body = el("div", "section-body content-prose");
    paragraphs(body, section.paragraphs || section.body);
    if (Array.isArray(section.bullets)) {
      var list = el("ul");
      section.bullets.forEach(function (item) { list.appendChild(el("li", "", item)); });
      body.appendChild(list);
    }
    node.appendChild(body);
    if (section.query) node.appendChild(codeBlock(section.query, "案例 SQL / 条件"));
    return node;
  }

  function renderProse(section) {
    var node = shell(section, "content-prose unknown-section");
    var body = el("div", "section-body");
    paragraphs(body, section.paragraphs || section.body || section.text || section.caption);
    if (Array.isArray(section.bullets)) {
      var list = el("ul");
      section.bullets.forEach(function (item) { list.appendChild(el("li", "", item)); });
      body.appendChild(list);
    }
    if (!body.childNodes.length) body.appendChild(el("p", "", "这一节的数据结构暂未识别，请继续阅读下一节。"));
    node.appendChild(body);
    return node;
  }

  function renderSteps(section) {
    var node = shell(section, "steps");
    var list = el("ol", "step-list");
    (section.steps || []).forEach(function (step, index) {
      var item = el("li", "step-item");
      var copy = el("div", "step-copy");
      append(copy, el("h4", "", step.title), el("p", "", step.body));
      append(item, el("span", "step-number", index + 1), copy);
      list.appendChild(item);
    });
    node.appendChild(list);
    return node;
  }

  function renderTable(section) {
    var node = shell(section, "table-section");
    var wrap = el("div", "table-wrap");
    var table = el("table", "content-table");
    var thead = el("thead");
    var header = el("tr");
    (section.headers || []).forEach(function (value) { header.appendChild(el("th", "", value)); });
    thead.appendChild(header);
    var tbody = el("tbody");
    (section.rows || []).forEach(function (row) {
      var tr = el("tr");
      row.forEach(function (value) { tr.appendChild(el("td", "", value)); });
      tbody.appendChild(tr);
    });
    append(table, thead, tbody);
    wrap.appendChild(table);
    node.appendChild(wrap);
    if (section.caption) node.appendChild(el("p", "table-caption", section.caption));
    return node;
  }

  function codeBlock(source, title) {
    var text = Array.isArray(source) ? source.join("\n") : String(source || "");
    var block = el("div", "code-block");
    var header = el("div", "code-header");
    var copy = button("复制", "copy-button", function () {
      copyText(text).then(function () {
        copy.textContent = "已复制";
        window.setTimeout(function () { copy.textContent = "复制"; }, 1400);
      }).catch(function () { showToast("复制失败，请手动选择代码。" ); });
    });
    append(header, el("span", "", title || "SQL"), copy);
    var pre = el("pre");
    pre.appendChild(el("code", "", text));
    append(block, header, pre);
    return block;
  }

  function renderCode(section) {
    var node = shell(section, "code-section");
    node.appendChild(codeBlock(section.code, section.label || "可运行示例"));
    if (section.explanation) node.appendChild(el("p", "code-explanation", section.explanation));
    return node;
  }

  function renderCallout(section) {
    var tone = ["key", "warning", "note"].indexOf(section.tone) >= 0 ? section.tone : "note";
    var node = el("aside", "callout tone-" + tone);
    if (section.title) node.appendChild(el("h3", "section-heading", section.title));
    paragraphs(node, section.body || section.paragraphs);
    return node;
  }

  function renderDetails(section) {
    var node = el("details", "deep-dive");
    var summary = attr(el("summary", "", section.title || "进一步理解"), { "aria-expanded": "false" });
    var body = el("div", "section-body content-prose");
    paragraphs(body, section.paragraphs || section.body);
    append(node, summary, body);
    node.addEventListener("toggle", function () { summary.setAttribute("aria-expanded", String(node.open)); });
    return node;
  }

  function renderDistinction(section) {
    var node = shell(section, "distinction");
    var grid = el("div", "distinction-grid");
    (section.items || []).forEach(function (item) {
      var card = el("article", "distinction-item");
      append(card, el("h4", "", item.name || item.title), el("p", "", item.definition || item.body));
      grid.appendChild(card);
    });
    node.appendChild(grid);
    return node;
  }

  function renderDiagram(section) {
    var node = shell(section, "diagram-section");
    var figure = el("figure", "concept-map diagram-" + (section.kind || "generic"));
    if (section.kind === "storage-hierarchy") diagramStorage(figure);
    else if (section.kind === "query-lifecycle") diagramQuery(figure);
    else if (section.kind === "cluster-topology") diagramCluster(figure);
    else diagramGeneric(figure, section);
    if (section.caption) figure.appendChild(el("figcaption", "diagram-caption", section.caption));
    node.appendChild(figure);
    return node;
  }

  function diagramStorage(figure) {
    var partition = el("div", "diagram-container diagram-partition");
    partition.appendChild(el("span", "diagram-label", "Partition 202610"));
    ["Part A", "Part B"].forEach(function (name, partIndex) {
      var part = el("div", "diagram-container diagram-part");
      part.appendChild(el("strong", "", name + "（独立有序）"));
      var row = el("div", "diagram-row");
      for (var i = 0; i < 4; i += 1) row.appendChild(el("span", "diagram-granule", "G" + (partIndex * 4 + i + 1)));
      part.appendChild(row);
      partition.appendChild(part);
    });
    figure.appendChild(partition);
    var legend = el("div", "diagram-legend");
    ["Granule：Part 内逻辑行组", "Mark：每列定位记录", "Compression Block：物理解压边界"].forEach(function (text) { legend.appendChild(el("span", "", text)); });
    figure.appendChild(legend);
  }

  function diagramQuery(figure) {
    var row = el("div", "diagram-flow");
    ["SQL", "解析与分析", "Query Plan", "Mark Ranges", "Processor Pipeline", "结果"].forEach(function (name, index, values) {
      row.appendChild(el("span", "diagram-node", name));
      if (index < values.length - 1) row.appendChild(el("span", "diagram-arrow", "→"));
    });
    append(figure, row, el("p", "diagram-note", "Plan 描述算子关系；运行时实例化 Processor 并通过端口传递 Chunk。Processor 不等于固定 OS 线程。"));
  }

  function diagramCluster(figure) {
    figure.appendChild(el("div", "diagram-node", "Client / Initiator"));
    figure.appendChild(el("div", "diagram-arrow", "↓ fan-out / ↑ merge"));
    var shards = el("div", "diagram-shards");
    for (var s = 1; s <= 2; s += 1) {
      var shard = el("div", "diagram-container diagram-shard");
      var row = el("div", "diagram-row");
      append(row, el("span", "diagram-node", "Replica 1"), el("span", "diagram-node", "Replica 2"));
      append(shard, el("strong", "", "Shard " + s), row);
      shards.appendChild(shard);
    }
    append(figure, shards, el("div", "diagram-node diagram-keeper", "Keeper：协调元数据，不保存业务 Part"));
  }

  function diagramGeneric(figure, section) {
    var values = section.items || section.nodes || ["输入", "处理", "输出"];
    var row = el("div", "diagram-flow");
    values.forEach(function (item, index) {
      row.appendChild(el("span", "diagram-node", typeof item === "string" ? item : item.name || item.title || "节点"));
      if (index < values.length - 1) row.appendChild(el("span", "diagram-arrow", "→"));
    });
    figure.appendChild(row);
  }

  function renderRecap(items) {
    var node = el("section", "lesson-section recap-section callout tone-key");
    node.appendChild(el("h3", "section-heading", "本课结论"));
    var list = el("ul", "recap-list");
    items.forEach(function (item) { list.appendChild(el("li", "", item)); });
    node.appendChild(list);
    return node;
  }

  function lessonAnswers(id) {
    var key = String(id);
    if (!state.quizAnswers[key] || typeof state.quizAnswers[key] !== "object") state.quizAnswers[key] = {};
    return state.quizAnswers[key];
  }

  function renderQuiz(lesson) {
    var node = el("section", "quiz-section");
    append(node, el("p", "lesson-kicker", "理解检查"), el("h3", "section-heading", "用 3 道题闭合本课模型"), el("p", "quiz-intro", "三题全部答对后，本课才会记为完成。答错不会扣分，可以根据解释重新选择。"));
    var answers = lessonAnswers(lesson.id);
    var entries = [];
    (lesson.quiz || []).forEach(function (quiz, quizIndex) {
      var fieldset = el("fieldset", "quiz-question");
      var legend = el("legend");
      append(legend, el("span", "quiz-level", quiz.level || "检查"), document.createTextNode(" " + (quizIndex + 1) + ". " + quiz.question));
      fieldset.appendChild(legend);
      var options = el("div", "quiz-options");
      (quiz.options || []).forEach(function (option, optionIndex) {
        var label = el("label", "quiz-option");
        var input = attr(el("input"), { type: "radio", name: "lesson-" + lesson.id + "-quiz-" + quizIndex, value: optionIndex });
        input.checked = Number(answers[quizIndex]) === optionIndex;
        input.addEventListener("change", function () {
          answers[quizIndex] = optionIndex;
          saveState();
          fieldset.classList.remove("is-checked");
          fieldset.querySelectorAll(".quiz-option").forEach(function (candidate) { candidate.classList.remove("is-correct", "is-wrong"); });
          feedback.className = "quiz-feedback";
          feedback.textContent = "";
        });
        append(label, input, el("span", "option-marker", String.fromCharCode(65 + optionIndex)), el("span", "option-text", option));
        options.appendChild(label);
      });
      var feedback = attr(el("div", "quiz-feedback"), { "aria-live": "polite" });
      append(fieldset, options, feedback);
      entries.push({ fieldset: fieldset, feedback: feedback, quiz: quiz, index: quizIndex });
      node.appendChild(fieldset);
    });
    var actions = el("div", "quiz-actions");
    var status = el("p", "quiz-status", state.completed.indexOf(lesson.id) >= 0 ? "本课已完成。你仍可重新检查答案。" : "尚未完成：需要全部答对。" );
    append(actions, status, button("检查全部答案", "primary-button quiz-submit", function () { checkQuiz(lesson, entries, status); }));
    node.appendChild(actions);
    return node;
  }

  function checkQuiz(lesson, entries, status) {
    var answers = lessonAnswers(lesson.id);
    var answered = 0;
    var correct = 0;
    entries.forEach(function (entry) {
      var selected = Number(answers[entry.index]);
      var hasAnswer = Number.isInteger(selected);
      var isCorrect = hasAnswer && selected === Number(entry.quiz.answer);
      if (hasAnswer) answered += 1;
      if (isCorrect) correct += 1;
      entry.fieldset.classList.add("is-checked");
      entry.fieldset.querySelectorAll(".quiz-option").forEach(function (option, optionIndex) {
        option.classList.toggle("is-correct", optionIndex === Number(entry.quiz.answer));
        option.classList.toggle("is-wrong", hasAnswer && optionIndex === selected && !isCorrect);
      });
      if (!hasAnswer) {
        entry.feedback.className = "quiz-feedback is-wrong";
        entry.feedback.textContent = "请先选择一个答案。";
      } else if (isCorrect) {
        entry.feedback.className = "quiz-feedback is-correct";
        entry.feedback.textContent = "正确。" + entry.quiz.explanation;
      } else {
        entry.feedback.className = "quiz-feedback is-wrong";
        entry.feedback.textContent = "还差一步。" + (entry.quiz.misconception ? "易错点：" + entry.quiz.misconception + " " : "") + entry.quiz.explanation;
      }
    });
    saveState();
    if (answered < entries.length) { status.textContent = "还有 " + (entries.length - answered) + " 题未作答。"; return; }
    if (correct < entries.length) { status.textContent = "本次答对 " + correct + " / " + entries.length + "。根据解释调整后再检查。"; return; }
    var fresh = state.completed.indexOf(lesson.id) < 0;
    if (fresh) {
      state.completed.push(lesson.id);
      state.completed.sort(function (a, b) { return a - b; });
      saveState();
      updateNavState();
      updateProgress();
    }
    status.textContent = entries.length + " / " + entries.length + " 全部正确，本课已完成。";
    showToast(fresh ? "本课完成：理解已记录。" : "答案仍然全部正确。" );
  }

  function renderFooter(id) {
    var footer = el("footer", "lesson-footer");
    var nav = attr(el("nav", "lesson-pagination"), { "aria-label": "课程翻页" });
    var index = lessonIndex(id);
    if (index > 0) {
      var previous = lessons[index - 1];
      nav.appendChild(button("← 上一课 · " + (previous.shortTitle || previous.title), "secondary-button", function () { navigate(previous.id, { focus: true }); }));
    } else nav.appendChild(el("span"));
    if (index < lessons.length - 1) {
      var next = lessons[index + 1];
      nav.appendChild(button("下一课 · " + (next.shortTitle || next.title) + " →", "primary-button", function () { navigate(next.id, { focus: true }); }));
    } else nav.appendChild(el("strong", "course-finish", "你已到达课程终点"));
    footer.appendChild(nav);
    return footer;
  }

  function renderLessonGlossary(terms) {
    dom.lessonGlossary.replaceChildren();
    terms.forEach(function (term) {
      var value = (DATA.glossary || {})[term] || {};
      var card = el("article", "glossary-mini-entry");
      append(card, el("strong", "", term), el("p", "", value.definition || "可在完整术语表中查阅。"));
      dom.lessonGlossary.appendChild(card);
    });
  }

  function renderGlossary(query) {
    var search = String(query || "").trim().toLocaleLowerCase("zh-CN");
    dom.glossaryList.replaceChildren();
    var terms = Object.keys(DATA.glossary || {}).filter(function (term) {
      var value = DATA.glossary[term] || {};
      return !search || [term, value.definition, value.role, value.contrast, value.example, value.misconception].join(" ").toLocaleLowerCase("zh-CN").indexOf(search) >= 0;
    }).sort(function (a, b) { return a.localeCompare(b, "zh-CN"); });
    if (!terms.length) { dom.glossaryList.appendChild(el("p", "empty-state", "没有找到匹配术语，请换一个关键词。")); return; }
    terms.forEach(function (term) {
      var value = DATA.glossary[term] || {};
      var details = el("details", "glossary-entry");
      details.appendChild(el("summary", "", term));
      var list = el("dl");
      [["定义", value.definition], ["系统角色", value.role], ["与相近概念的区别", value.contrast], ["例子", value.example], ["常见误区", value.misconception]].forEach(function (row) {
        if (row[1]) append(list, el("dt", "", row[0]), el("dd", "", row[1]));
      });
      details.appendChild(list);
      dom.glossaryList.appendChild(details);
    });
  }

  function updateProgress() {
    var done = state.completed.filter(function (id) { return lessonById.has(id); }).length;
    var total = lessons.length || 1;
    var percent = Math.round(done / total * 100);
    dom.progressFill.style.width = percent + "%";
    dom.progressLabel.textContent = done + " / " + lessons.length;
    dom.courseProgress.setAttribute("aria-valuenow", String(percent));
    dom.completedCount.textContent = done + " / " + lessons.length + " 课";
    dom.masteryLabel.textContent = done === lessons.length && lessons.length ? "课程已完成" : done ? "已掌握 " + percent + "%" : "尚未完成课程";
    dom.completedSummary.textContent = done === lessons.length && lessons.length ? "你已通过全部理解检查。建议回到实验中改变参数，验证边界。" : "完成每课的 3 道检查题，建立连续的系统模型。";
    dom.unitLabel.textContent = currentUnit(currentLessonId).title || "课程";
  }

  function setupTheme() {
    function apply() {
      var dark = state.theme === "dark";
      document.documentElement.dataset.theme = state.theme;
      dom.themeToggle.textContent = dark ? "☀" : "☾";
      dom.themeToggle.setAttribute("aria-pressed", String(dark));
      dom.themeToggle.setAttribute("aria-label", dark ? "切换浅色主题" : "切换深色主题");
    }
    dom.themeToggle.addEventListener("click", function () {
      state.theme = state.theme === "dark" ? "light" : "dark";
      saveState();
      apply();
    });
    apply();
  }

  function openMobileMenu() {
    mobileMenuOpen = true;
    dom.sidebar.classList.add("is-open");
    dom.mobileMenuToggle.setAttribute("aria-expanded", "true");
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
    if (!dom.sidebar) return;
    dom.sidebar.classList.remove("is-open");
    dom.mobileMenuToggle.setAttribute("aria-expanded", "false");
  }

  function setupChrome() {
    dom.mobileMenuToggle.addEventListener("click", function () { if (mobileMenuOpen) closeMobileMenu(); else openMobileMenu(); });
    dom.glossaryToggle.addEventListener("click", function () {
      renderGlossary(dom.glossarySearch.value);
      if (typeof dom.glossaryDialog.showModal === "function") dom.glossaryDialog.showModal(); else dom.glossaryDialog.setAttribute("open", "");
      window.setTimeout(function () { dom.glossarySearch.focus(); }, 0);
    });
    dom.glossaryClose.addEventListener("click", function () {
      if (typeof dom.glossaryDialog.close === "function") dom.glossaryDialog.close(); else dom.glossaryDialog.removeAttribute("open");
    });
    dom.glossaryDialog.addEventListener("click", function (event) { if (event.target === dom.glossaryDialog && typeof dom.glossaryDialog.close === "function") dom.glossaryDialog.close(); });
    dom.glossarySearch.addEventListener("input", function () { renderGlossary(dom.glossarySearch.value); });
    dom.resetProgress.addEventListener("click", function () {
      if (!window.confirm("确定重置全部课程进度与答题记录吗？主题设置会保留。")) return;
      var theme = state.theme;
      state = defaultState();
      state.theme = theme;
      saveState();
      renderNavigation();
      navigate((lessons[0] || { id: 0 }).id, { focus: true });
      showToast("课程进度已重置。" );
    });
    window.addEventListener("hashchange", function () {
      var match = window.location.hash.match(/^#lesson-(\d+)$/);
      if (match && lessonById.has(Number(match[1]))) navigate(Number(match[1]), { updateHash: false, focus: true });
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape" && mobileMenuOpen) closeMobileMenu(); });
  }

  function renderLab(section, lessonId, index) {
    var node = el("section", "lesson-section lab");
    node.dataset.labKind = section.kind || "";
    var header = el("div", "lab-header");
    append(header, el("span", "lab-badge", "交互实验"), el("h3", "section-heading", section.title || "动手验证"));
    node.appendChild(header);
    if (section.prompt) node.appendChild(el("p", "lab-prompt", section.prompt));
    var mount = el("div", "lab-mount");
    node.appendChild(mount);
    var renderers = {
      "workload-fit": labWorkloadFit,
      "column-scan": labColumnScan,
      "write-parts": labWriteParts,
      "storage-anatomy": labStorageAnatomy,
      "order-key": labOrderKey,
      "merge-lab": labMerge,
      "query-pipeline": labQueryPipeline,
      "operator-cost": labAggregationJoin,
      "aggregation-join": labAggregationJoin,
      "engine-selector": labEngineSemantics,
      "engine-semantics": labEngineSemantics,
      "cluster-simulator": labCluster,
      "cluster": labCluster,
      "consistency-failover": labConsistency,
      "consistency": labConsistency,
      "architecture-clinic": labDiagnosisDesign,
      "diagnosis-design": labDiagnosisDesign
    };
    if (renderers[section.kind]) renderers[section.kind](mount, lessonId, index);
    else {
      var fallback = el("div", "lab-result result-medium");
      append(fallback, el("strong", "result-title", "实验结构暂未识别"), el("p", "", section.prompt || "请结合本节正文进行纸上推演。"));
      append(mount, fallback, schematic("未知实验不会阻断正文与检查题。"));
    }
    return node;
  }

  function labWorkloadFit(mount) {
    var cases = {
      analytics: { title: "多租户事件趋势分析", facts: ["持续追加", "扫描数百万行", "聚合少量列", "秒级可见即可"], score: "高度匹配", tone: "good", reason: "列裁剪、压缩、稀疏索引和并行聚合都能发挥作用。MergeTree 是合理起点。", boundary: "仍需设计写入批次与 ORDER BY；ClickHouse 不会自动修复不匹配的数据布局。" },
      transaction: { title: "支付账户余额扣减", facts: ["单行点查", "高频原地更新", "跨表事务约束", "强一致提交"], score: "不适合作为主库", tone: "risk", reason: "核心是短事务和行级约束，不是大范围扫描与聚合。", boundary: "可把变更流水同步到 ClickHouse 分析，但账本事实仍应由 OLTP 系统承载。" },
      observability: { title: "日志与 Trace 检索", facts: ["高吞吐追加", "按服务和时间过滤", "偶尔搜索文本", "保留期明确"], score: "匹配，但要验证查询", tone: "medium", reason: "时间裁剪和列式聚合很合适；高选择性文本检索还需要合适排序、跳数索引或专用搜索系统。", boundary: "不要因为存在 Bloom Filter 就假设任意全文查询都会低延迟。" }
    };
    var controls = el("div", "lab-controls");
    var stage = el("div", "lab-stage");
    var result = el("div", "lab-result");
    controls.appendChild(segmented([{ value: "analytics", label: "事件分析" }, { value: "transaction", label: "余额扣减" }, { value: "observability", label: "日志 / Trace" }], "analytics", render, "选择工作负载"));
    append(mount, controls, stage, result, schematic("匹配判断是架构推理练习，不是跑分结论。"));
    function render(name) {
      var selected = cases[name];
      stage.replaceChildren(el("h4", "", selected.title));
      var list = el("ul", "workload-facts");
      selected.facts.forEach(function (fact) { list.appendChild(el("li", "", fact)); });
      stage.appendChild(list);
      result.className = "lab-result result-" + selected.tone;
      result.replaceChildren(el("strong", "result-title", selected.score), el("p", "", selected.reason), el("p", "lab-boundary", "边界：" + selected.boundary));
    }
    render("analytics");
  }

  function labColumnScan(mount) {
    var controls = el("div", "lab-controls");
    var total = rangeControl("表的总列数", 10, 100, 10, 100, " 列");
    var selected = rangeControl("查询实际使用", 1, 20, 1, 3, " 列");
    append(controls, total.wrapper, selected.wrapper);
    var stage = el("div", "lab-stage column-scan-stage");
    var rowBar = el("div", "scan-bar row-scan");
    var columnBar = el("div", "scan-bar column-scan");
    append(stage, el("h4", "", "读取字节比例对比"), rowBar, columnBar);
    var metrics = el("div", "metric-grid");
    var result = el("div", "lab-result");
    append(mount, controls, stage, metrics, result, schematic("假设各列等宽且压缩比相同；真实字节由类型、压缩、Mark Range 与 PREWHERE 决定。"));
    function render() {
      var totalColumns = Number(total.input.value);
      var selectedColumns = Math.min(Number(selected.input.value), totalColumns);
      if (Number(selected.input.value) > totalColumns) { selected.input.value = totalColumns; selected.output.value = totalColumns + " 列"; }
      var ratio = selectedColumns / totalColumns;
      rowBar.replaceChildren(el("span", "scan-bar-label", "行式：搬运完整记录"), el("span", "scan-bar-fill", "100%"));
      rowBar.querySelector(".scan-bar-fill").style.width = "100%";
      columnBar.replaceChildren(el("span", "scan-bar-label", "列式：仅读所需列"), el("span", "scan-bar-fill", (ratio * 100).toFixed(1).replace(".0", "") + "%"));
      columnBar.querySelector(".scan-bar-fill").style.width = Math.max(3, ratio * 100) + "%";
      metrics.replaceChildren(metric("行式相对读取", "100%", "整行布局示意"), metric("列式相对读取", (ratio * 100).toFixed(1).replace(".0", "") + "%", selectedColumns + " / " + totalColumns + " 列"), metric("理论减少", (1 / ratio).toFixed(1) + "×", "只比较列数"));
      result.textContent = "列式收益不只来自少读列：同类型值连续存放通常也更易压缩，并能批量执行。若 SELECT * 或命中大量 Granule，收益会缩小。";
    }
    total.input.addEventListener("input", render);
    selected.input.addEventListener("input", render);
    render();
  }

  function labWriteParts(mount) {
    var controls = el("div", "lab-controls");
    var inserts = rangeControl("INSERT 请求数", 1, 100, 1, 20, " 次");
    var rows = rangeControl("每次写入行数", 100, 100000, 100, 1000, " 行");
    var partitions = rangeControl("每次触及分区", 1, 6, 1, 1, " 个");
    append(controls, inserts.wrapper, rows.wrapper, partitions.wrapper);
    var stage = el("div", "lab-stage part-factory");
    var metrics = el("div", "metric-grid");
    var result = el("div", "lab-result");
    append(mount, controls, stage, metrics, result, schematic("按“每个 INSERT × 涉及 Partition”估算初始 Part，不计 Async Insert 合批、限制和重试。"));
    function render() {
      var requestCount = Number(inserts.input.value);
      var rowCount = Number(rows.input.value);
      var partitionCount = Number(partitions.input.value);
      var parts = requestCount * partitionCount;
      var rowsPerPart = Math.max(1, Math.round(rowCount / partitionCount));
      stage.replaceChildren();
      for (var i = 0; i < Math.min(parts, 48); i += 1) stage.appendChild(el("span", "part-chip", "P" + (i + 1)));
      if (parts > 48) stage.appendChild(el("span", "part-chip part-more", "+" + (parts - 48)));
      metrics.replaceChildren(metric("初始 Part", parts, requestCount + " × " + partitionCount), metric("每 Part 平均", rowsPerPart.toLocaleString("zh-CN") + " 行", "均匀分区示意"), metric("总写入", (requestCount * rowCount).toLocaleString("zh-CN") + " 行", "单次行数 × 请求数"));
      var severity = parts > 200 || rowsPerPart < 1000 ? "高" : parts > 50 || rowsPerPart < 10000 ? "中" : "低";
      result.className = "lab-result " + (severity === "高" ? "result-risk" : severity === "中" ? "result-medium" : "result-good");
      result.textContent = "小 Part 压力：" + severity + "。一次 INSERT 跨多个 Partition 会分别生成 Part；批次过小会放大 Merge、文件与元数据开销。";
    }
    [inserts.input, rows.input, partitions.input].forEach(function (input) { input.addEventListener("input", render); });
    render();
  }

  function labStorageAnatomy(mount) {
    var streams = {
      event_time: { label: "event_time", blocks: [[1, 2, 3], [4, 5, 6], [7, 8]], bytes: 256 },
      revenue: { label: "revenue", blocks: [[1, 2], [3, 4], [5, 6], [7, 8]], bytes: 320 },
      payload: { label: "payload", blocks: [[1], [2, 3], [4], [5, 6, 7], [8]], bytes: 1024 }
    };
    var controls = el("div", "lab-controls");
    var column = selectControl("观察列数据流", Object.keys(streams).map(function (key) { return { value: key, label: streams[key].label }; }), "event_time");
    var granule = rangeControl("选择 Granule", 1, 8, 1, 3, "");
    append(controls, column.wrapper, granule.wrapper);
    var stage = el("div", "lab-stage storage-anatomy-stage");
    var granuleRow = el("div", "granule-row");
    var blockRow = el("div", "compression-row");
    append(stage, el("h4", "", "逻辑 Granule 边界（列共享行坐标）"), granuleRow, el("h4", "", "所选列的 Compression Block 边界"), blockRow);
    var result = el("div", "lab-result");
    append(mount, controls, stage, result, schematic("8 个 Granule、块划分和偏移值是缩小示例；真实 Part 的自适应粒度、子流和编码会更复杂。"));
    function render() {
      var stream = streams[column.input.value];
      var selected = Number(granule.input.value);
      granuleRow.replaceChildren();
      for (var i = 1; i <= 8; i += 1) granuleRow.appendChild(el("span", "granule-cell" + (i === selected ? " is-selected" : ""), "G" + i));
      blockRow.replaceChildren();
      var found = 0;
      var within = 0;
      stream.blocks.forEach(function (members, blockIndex) {
        var block = el("span", "compression-block", "Block " + (blockIndex + 1) + " · " + members.map(function (id) { return "G" + id; }).join("/"));
        block.style.flexGrow = members.length;
        if (members.indexOf(selected) >= 0) { block.classList.add("is-selected"); found = blockIndex; within = members.indexOf(selected); }
        blockRow.appendChild(block);
      });
      result.replaceChildren(el("strong", "result-title", stream.label + " 列的 G" + selected + " Mark"), el("p", "", "示意记录：(压缩文件偏移 " + (found * stream.bytes) + " KiB，解压块内偏移 " + (within * 64) + " KiB)。读取器定位 Block " + (found + 1) + "，解压后再跳到 G" + selected + " 对应字节位置。"), el("p", "lab-boundary", "Granule 不跨 Part；Compression Block 可以覆盖一个或多个 Granule，边界不必一一对齐。Mark 偏移是数据流位置，不是行号。"));
    }
    column.input.addEventListener("change", render);
    granule.input.addEventListener("input", render);
    render();
  }

  function labOrderKey(mount) {
    var controls = el("div", "lab-controls");
    var key = selectControl("ORDER BY", [{ value: "tenant", label: "(tenant_id, event_type, event_time)" }, { value: "time", label: "(event_time, tenant_id)" }, { value: "id", label: "(event_id)" }], "tenant");
    var query = selectControl("查询条件", [{ value: "full", label: "tenant + type + time range" }, { value: "tenant_time", label: "tenant + time range" }, { value: "time", label: "time range only" }, { value: "id", label: "event_id = ?" }], "full");
    append(controls, key.wrapper, query.wrapper);
    var stage = el("div", "lab-stage granule-grid");
    var metrics = el("div", "metric-grid");
    var result = el("div", "lab-result");
    append(mount, controls, stage, metrics, result, schematic("固定 64 个均匀 Granule 的概念模型；真实裁剪以目标版本 EXPLAIN indexes = 1 为准。"));
    var matrix = {
      tenant: { full: [4, "完整匹配左前缀，形成窄键范围。"], tenant_time: [16, "第一列可用；缺少中间列时，时间范围难以形成单一紧凑区间。"], time: [64, "只约束后部列，通常难以排除大范围。"], id: [64, "event_id 不在该索引前缀中。"] },
      time: { full: [8, "时间范围在第一列，可以裁剪；后续租户条件通常不能继续形成同样紧凑边界。"], tenant_time: [8, "时间第一列主导裁剪。"], time: [8, "第一列范围条件形成候选区间。"], id: [64, "event_id 不在排序键中。"] },
      id: { full: [64, "查询不约束 event_id，唯一键放首位没有帮助。"], tenant_time: [64, "过滤列均不在排序键中。"], time: [64, "时间不在排序键中。"], id: [1, "点查匹配排序键第一列。"] }
    };
    function render() {
      var config = matrix[key.input.value][query.input.value];
      var read = config[0];
      var start = Math.floor((64 - read) / 2);
      stage.replaceChildren();
      for (var i = 0; i < 64; i += 1) {
        var candidate = i >= start && i < start + read;
        stage.appendChild(attr(el("span", "granule-cell " + (candidate ? "is-read" : "is-skipped"), i + 1), { "aria-label": "Granule " + (i + 1) + (candidate ? "，候选" : "，排除") }));
      }
      metrics.replaceChildren(metric("候选 Granule", read + " / 64", "仍需读取复核"), metric("排除比例", Math.round((64 - read) / 64 * 100) + "%", "保守裁剪示意"), metric("索引角色", read === 64 ? "几乎无裁剪" : "缩小 Mark Range", "不保证唯一"));
      result.textContent = config[1] + " 稀疏主键只排除确定不可能命中的范围，边界 Granule 内仍执行原始谓词。";
    }
    key.input.addEventListener("change", render);
    query.input.addEventListener("change", render);
    render();
  }

  function labMerge(mount) {
    var seed = 0;
    var parts = [];
    var controls = el("div", "lab-controls button-controls");
    var stage = el("div", "lab-stage merge-stage");
    var metrics = el("div", "metric-grid");
    var result = el("div", "lab-result");
    append(controls,
      button("模拟一次小 INSERT", "secondary-button", function () {
        var presets = [{ rows: 6, min: 18, max: 55 }, { rows: 9, min: 1, max: 28 }, { rows: 5, min: 48, max: 81 }, { rows: 8, min: 22, max: 67 }];
        var value = presets[seed % presets.length]; seed += 1;
        parts.push({ id: seed + 3, rows: value.rows, min: value.min, max: value.max, generation: 0 });
        render("新写入生成独立 Active Part；键值域允许与已有 Part 重叠。" );
      }),
      button("合并两个最小 Part", "primary-button", function () {
        if (parts.length < 2) return;
        var sorted = parts.slice().sort(function (a, b) { return a.rows - b.rows; });
        var a = sorted[0]; var b = sorted[1];
        parts = parts.filter(function (part) { return part !== a && part !== b; });
        parts.push({ id: Math.max(a.id, b.id) + 10, rows: a.rows + b.rows, min: Math.min(a.min, b.min), max: Math.max(a.max, b.max), generation: Math.max(a.generation, b.generation) + 1 });
        render("读取旧 Part、归并排序、写出新 Part，并重新生成 Granule 与 Marks；不是原地拼接。", a.rows + b.rows);
      }),
      button("模拟 UPDATE Mutation", "secondary-button", function () {
        var touched = parts.reduce(function (sum, part) { return sum + part.rows; }, 0);
        parts = parts.map(function (part) { return Object.assign({}, part, { id: part.id + 20, generation: part.generation + 1 }); });
        render("Mutation 为受影响数据生成替代 Part。只改少量行，也可能重写覆盖它们的整个 Part。", touched);
      }),
      button("重置", "text-button", reset)
    );
    append(mount, controls, stage, metrics, result, schematic("行数单位为 K；“合并两个最小 Part”是观察策略，不代表后台真实选择算法。"));
    function reset() {
      seed = 0;
      parts = [{ id: 1, rows: 12, min: 1, max: 40, generation: 0 }, { id: 2, rows: 18, min: 20, max: 70, generation: 0 }, { id: 3, rows: 9, min: 55, max: 92, generation: 0 }];
      render("三个 Part 各自内部有序，但排序键值域互相重叠。" );
    }
    function render(message, touched) {
      stage.replaceChildren();
      parts.slice().sort(function (a, b) { return a.min - b.min; }).forEach(function (part) {
        var card = el("article", "part-card");
        append(card, el("strong", "", "Part " + part.id), el("span", "", part.rows + "K rows"), el("small", "", "key [" + part.min + ", " + part.max + "] · generation " + part.generation));
        stage.appendChild(card);
      });
      var total = parts.reduce(function (sum, part) { return sum + part.rows; }, 0);
      metrics.replaceChildren(metric("Active Part", parts.length, "查询逐 Part 裁剪"), metric("Active rows", total + "K", "普通合并前后守恒"), metric("本次重写范围", touched ? touched + "K rows" : "0", "读旧 + 写新"));
      result.textContent = message;
    }
    reset();
  }

  function labQueryPipeline(mount) {
    var stages = [
      { name: "Parse", detail: "SQL 文本解析为语法结构；尚未读取数据。", rows: "—" },
      { name: "Analyze / Plan", detail: "解析名称与类型，做列裁剪和安全表达式优化，形成 Query Plan。", rows: "—" },
      { name: "Index pruning", detail: "针对每个 Part 计算候选 Mark Ranges；主键索引只做保守排除。", rows: "80M → 6M" },
      { name: "Read ranges", detail: "读取 Processor 并行打开不同 Part / Mark Range；如果存在 PREWHERE，此时先调度过滤列，而不是先搬完所有列。", rows: "6M candidate rows" },
      { name: "PREWHERE / WHERE", detail: "先读取 PREWHERE 列形成行掩码，再为仍有候选行的范围读取后续列并执行完整条件。它发生在 Mark Range 选择之后。", rows: "6M → 0.8M" },
      { name: "Local aggregate", detail: "每条 Lane 构建局部聚合状态；状态不是最终展示值。", rows: "0.8M → N × states" },
      { name: "Merge + finalize", detail: "合并局部状态，再 finalize 得到 count、avg 等最终值。", rows: "N × states → 24 rows" }
    ];
    var current = 0;
    var controls = el("div", "lab-controls");
    var lanes = rangeControl("读取并行 Lane", 1, 8, 1, 4, "");
    var actions = el("div", "button-controls");
    var previous = button("← 上一步", "secondary-button", function () { current = Math.max(0, current - 1); render(); });
    var next = button("下一步 →", "primary-button", function () { current = Math.min(stages.length - 1, current + 1); render(); });
    append(actions, previous, next, button("重放", "text-button", function () { current = 0; render(); }));
    append(controls, lanes.wrapper, actions);
    var stage = el("div", "lab-stage pipeline-stage");
    var result = el("div", "lab-result");
    append(mount, controls, stage, result, schematic("行数和 Lane 是缩小案例；Processor 由执行器调度，不与固定 OS 线程一一绑定。"));
    function render() {
      stage.replaceChildren();
      stages.forEach(function (item, index) {
        var node = el("div", "pipeline-node" + (index === current ? " is-active" : index < current ? " is-done" : ""));
        append(node, el("span", "pipeline-index", index + 1), el("strong", "", item.name));
        stage.appendChild(node);
      });
      var item = stages[current];
      var laneCount = current >= 3 && current <= 5 ? Number(lanes.input.value) : 1;
      result.replaceChildren(el("strong", "result-title", item.name), el("p", "", item.detail), el("p", "", "示意数据量：" + item.rows + "；当前并行 Lane：" + laneCount + "。"));
      previous.disabled = current === 0;
      next.disabled = current === stages.length - 1;
    }
    lanes.input.addEventListener("input", render);
    render();
  }

  function labAggregationJoin(mount) {
    var mode = "aggregate";
    var controls = el("div", "lab-controls");
    var dynamic = el("div", "lab-controls dynamic-controls");
    var stage = el("div", "lab-stage operator-stage");
    var result = el("div", "lab-result");
    controls.appendChild(segmented([{ value: "aggregate", label: "聚合状态" }, { value: "join", label: "JOIN 语义与算法" }], mode, function (value) { mode = value; renderControls(); }, "选择算子实验"));
    append(mount, controls, dynamic, stage, result, schematic("内存与行数仅比较趋势；实际算法选择受版本、类型、设置、语义和数据分布影响。"));

    function renderControls() {
      dynamic.replaceChildren();
      if (mode === "aggregate") aggregateControls(); else joinControls();
    }

    function aggregateControls() {
      var cardinality = selectControl("GROUP BY 基数", [{ value: "low", label: "10K groups" }, { value: "medium", label: "1M groups" }, { value: "high", label: "50M groups" }], "medium");
      var lanes = rangeControl("并行 Lane", 1, 8, 1, 4, "");
      append(dynamic, cardinality.wrapper, lanes.wrapper);
      function render() {
        var groups = { low: 10000, medium: 1000000, high: 50000000 }[cardinality.input.value];
        var laneCount = Number(lanes.input.value);
        var flow = el("div", "operator-flow");
        for (var i = 0; i < laneCount; i += 1) flow.appendChild(el("span", "operator-node", "Lane " + (i + 1) + "\n局部 state"));
        append(flow, el("span", "diagram-arrow", "→ merge →"), el("span", "operator-node is-final", "全局 state\n→ finalize"));
        stage.replaceChildren(flow);
        var memory = groups * 48 / 1024 / 1024;
        result.replaceChildren(el("strong", "result-title", groups.toLocaleString("zh-CN") + " 个分组"), el("p", "", "每条 Lane 先构建局部状态，再合并同键状态，最后 finalize；不能把局部 avg 直接再做 avg。"), el("p", "lab-boundary", "按 48 B/group 假设，状态内存示意约 " + memory.toFixed(0) + " MiB。高基数时可能切换 two-level、外部聚合或超内存。"));
      }
      cardinality.input.addEventListener("change", render);
      lanes.input.addEventListener("input", render);
      render();
    }

    function joinControls() {
      var scenario = selectControl("数据与语义", [
        { value: "small", label: "INNER JOIN：一侧较小且可放内存" },
        { value: "large", label: "LEFT ALL JOIN：两侧都很大" },
        { value: "sorted", label: "等值 JOIN：两侧已有兼容排序" },
        { value: "dictionary", label: "按唯一键查询 Dictionary" },
        { value: "existence", label: "只判断是否存在匹配" }
      ], "small");
      dynamic.appendChild(scenario.wrapper);
      var cases = {
        small: ["Hash Join（常见候选）", "把适合的一侧构建为哈希表，另一侧探测。构建侧取决于 JOIN 类型、优化器、设置和版本，不能背成‘永远右表’。"],
        large: ["Grace Hash / 可落盘算法", "两侧都大且内存不足时，分区并落盘能换取可控内存；代价是额外 I/O。先确认 LEFT ALL 的多匹配语义不能被 ANY 偷换。"],
        sorted: ["Full Sorting Merge（候选）", "若输入排序可复用或排序成本可接受，归并路径可以减少哈希表压力；必须核对键、类型和实际计划。"],
        dictionary: ["Direct Join（条件满足时）", "右侧是可直接按键查询的 Dictionary/Join/KV 数据源且语义受支持时，可避免构建普通哈希表。"],
        existence: ["SEMI JOIN / IN", "若业务只关心是否存在，就不要请求 ALL 的结果乘法。先表达正确语义，再选择算法。"]
      };
      function render() {
        var value = cases[scenario.input.value];
        stage.replaceChildren(el("div", "operator-flow", "左输入 → JOIN → 输出\n             ↑\n         匹配数据源"));
        result.replaceChildren(el("strong", "result-title", value[0]), el("p", "", value[1]), el("p", "lab-boundary", "算法建议不是强制计划；请用 EXPLAIN PIPELINE、query_log 和内存指标验证。"));
      }
      scenario.input.addEventListener("change", render);
      render();
    }
    renderControls();
  }

  function labEngineSemantics(mount) {
    var cases = {
      detail: ["MergeTree", "保存每条事实明细", "没有业务级折叠", "默认起点；重点仍是分区、排序键和写入批次。"],
      latest: ["ReplacingMergeTree(version)", "同 ORDER BY 键的多个版本", "后台 Merge 时最终收敛", "写入后不会立即全局唯一；查询正确性可能需要 FINAL 或 argMax。"],
      sum: ["SummingMergeTree", "可加数值的明细行", "后台 Merge 时对同键数值求和", "只适合可加语义；未合并前查询仍需 GROUP BY。"],
      states: ["AggregatingMergeTree", "AggregateFunction 状态", "合并 state，不直接存最终展示值", "写入 xxxState，查询 xxxMerge；常由物化视图维护。"],
      mv: ["Materialized View + target", "源表新到达的 Block 经转换写入目标表", "INSERT 触发，不等于自动回填历史", "目标表承担持久化；上线前设计重放、去重和失败恢复。"],
      projection: ["Projection", "同一表 Part 内的另一种布局或预聚合", "随 Part 生命周期维护", "优化器决定是否使用；不是可独立写入的业务表。"]
    };
    var controls = el("div", "lab-controls");
    var choice = selectControl("业务意图", [{ value: "detail", label: "保留完整事件明细" }, { value: "latest", label: "按业务键保留最新版本" }, { value: "sum", label: "可加指标最终汇总" }, { value: "states", label: "保存聚合中间状态" }, { value: "mv", label: "写入时派生另一张表" }, { value: "projection", label: "同表维护另一种查询布局" }], "detail");
    controls.appendChild(choice.wrapper);
    var stage = el("div", "lab-stage engine-stage");
    var result = el("div", "lab-result");
    append(mount, controls, stage, result, schematic("引擎选择由数据语义决定；Replicated 前缀解决同 Shard 复制，SharedMergeTree 是托管共享存储架构，应另行讨论。"));
    function render() {
      var value = cases[choice.input.value];
      stage.replaceChildren(el("span", "engine-node", "INSERT Blocks"), el("span", "diagram-arrow", "→"), el("strong", "engine-node is-selected", value[0]), el("span", "diagram-arrow", "→"), el("span", "engine-node", "查询语义"));
      result.replaceChildren(el("strong", "result-title", value[0]), el("p", "", "存储对象：" + value[1] + "。合并语义：" + value[2] + "。"), el("p", "lab-boundary", "边界：" + value[3]));
    }
    choice.input.addEventListener("change", render);
    render();
  }

  function labCluster(mount) {
    var action = "query";
    var failed = false;
    var controls = el("div", "lab-controls");
    var shards = rangeControl("Shard 数", 1, 4, 1, 2, "");
    var replicas = rangeControl("每 Shard Replica", 1, 3, 1, 2, "");
    var actions = segmented([{ value: "query", label: "分布式查询" }, { value: "write", label: "写入事件" }, { value: "fail", label: "Replica 故障" }], action, function (value) { action = value; failed = value === "fail"; render(); }, "选择集群动作");
    append(controls, shards.wrapper, replicas.wrapper, actions);
    var stage = el("div", "lab-stage cluster-stage");
    var metrics = el("div", "metric-grid");
    var result = el("div", "lab-result");
    append(mount, controls, stage, metrics, result, schematic("拓扑与数据路径是逻辑示意；负载均衡策略、internal_replication 和一致性设置会改变细节。"));

    function render() {
      var shardCount = Number(shards.input.value);
      var replicaCount = Number(replicas.input.value);
      stage.replaceChildren(el("div", "cluster-client", "Client / Initiator"), el("div", "diagram-arrow", "↓"));
      var shardRow = el("div", "diagram-shards");
      for (var s = 1; s <= shardCount; s += 1) {
        var shard = el("section", "shard-column");
        shard.appendChild(el("strong", "", "Shard " + s));
        var replicaRow = el("div", "replica-row");
        for (var r = 1; r <= replicaCount; r += 1) {
          var classes = "replica-node";
          var detail = "standby / 可读";
          if (action === "query" && r === 1) { classes += " is-active"; detail = "局部过滤 + 聚合"; }
          if (action === "write" && s === Math.min(2, shardCount)) {
            if (r === 1) { classes += " is-active"; detail = "接收 INSERT"; }
            else { classes += " is-active"; detail = "复制 Part"; }
          }
          if (failed && s === 1 && r === 1) { classes += " is-failed"; detail = "故障"; }
          else if (failed && s === 1 && r === 2) { classes += " is-active"; detail = "接管请求"; }
          var replica = el("div", classes);
          append(replica, el("strong", "", "Replica " + r), el("small", "", detail));
          replicaRow.appendChild(replica);
        }
        shard.appendChild(replicaRow);
        shardRow.appendChild(shard);
      }
      stage.appendChild(shardRow);
      if (replicaCount > 1) append(stage, el("div", "diagram-arrow", "↕"), el("div", "keeper-node", "Keeper quorum：复制日志与协调元数据，不保存业务 Part"));
      metrics.replaceChildren(metric("数据容量单元", shardCount + " Shard", "水平拆分数据"), metric("节点副本", shardCount * replicaCount, shardCount + " × " + replicaCount), metric("单 Replica 故障容忍", replicaCount > 1 ? "可以接管" : "该 Shard 不可用", "不等于备份"));
      if (action === "query") result.textContent = "普通 Distributed 查询通常从每个 Shard 选择一个健康 Replica；远端先过滤和局部聚合，Initiator 再合并状态并 finalize。";
      else if (action === "write") result.textContent = "Sharding key 先选择一个目标 Shard。ReplicatedMergeTree 在该 Shard 内复制 Part；副本数不会把一行分发到更多 Shard。";
      else result.textContent = replicaCount > 1 ? "同 Shard 另一 Replica 可接管流量；恢复节点再补齐缺失 Part。错误删除也可能复制传播，所以 Replica 不是独立备份。" : "Shard 只有一个 Replica，节点故障会使该数据子集不可用。增加 Shard 提升容量，不自动提供同 Shard 高可用。";
    }
    shards.input.addEventListener("input", render);
    replicas.input.addEventListener("input", render);
    render();
  }

  function labConsistency(mount) {
    var mode = "default";
    var event = "normal";
    var controls = el("div", "lab-controls");
    var modeControl = segmented([{ value: "default", label: "默认确认（1 个副本）" }, { value: "quorum", label: "insert_quorum = 2" }], mode, function (value) { mode = value; render(); }, "选择写入确认策略");
    var eventControl = segmented([{ value: "normal", label: "正常复制" }, { value: "after-ack", label: "ACK 后源副本故障" }, { value: "retry", label: "客户端超时重试" }], event, function (value) { event = value; render(); }, "选择故障时机");
    append(controls, modeControl, eventControl);
    var stage = el("div", "lab-stage consistency-stage");
    var timeline = el("ol", "timeline-list");
    var metrics = el("div", "metric-grid");
    var result = el("div", "lab-result");
    append(mount, controls, stage, timeline, metrics, result, schematic("固定为单 Shard、3 Replica。数字用于解释确认门槛，不代表跨 Shard 事务。"));

    function render() {
      var required = mode === "quorum" ? 2 : 1;
      var durable = event === "normal" ? 3 : required;
      stage.replaceChildren();
      for (var r = 1; r <= 3; r += 1) {
        var copy = el("div", "replica-copy" + (r <= durable ? " is-durable" : "") + (event === "after-ack" && r === 1 ? " is-failed" : ""));
        append(copy, el("strong", "", "Replica " + r), el("small", "", event === "after-ack" && r === 1 ? "ACK 后故障" : r <= durable ? "已有 Part" : "尚未复制"));
        stage.appendChild(copy);
      }
      timeline.replaceChildren();
      var steps = ["目标 Replica 本地写成 Active Part", "复制日志协调其他 Replica 拉取 Part", "达到 " + required + " 个 Replica 后向客户端确认"];
      if (event === "after-ack") steps.push("源 Replica 在 ACK 后故障；检查其他副本是否已有该 Part");
      if (event === "retry") steps.push("客户端携带相同 insert_deduplication_token 重试，避免不确定 ACK 造成重复 Block");
      steps.forEach(function (step) { timeline.appendChild(el("li", "", step)); });
      metrics.replaceChildren(metric("确认门槛", required + " / 3", "同一 Shard 内"), metric("故障前示意副本", durable + " / 3", "最终可继续补齐"), metric("跨 Shard 原子性", "不提供", "Quorum 不是分布式事务"));
      if (event === "normal") result.textContent = mode === "quorum" ? "客户端等待两个副本确认，降低单个已确认副本立即丢失时的风险；其余副本仍可异步追赶。" : "默认写入通常在首个副本本地成功后确认，其他副本随后异步复制；‘成功’不等于所有副本已有数据。";
      else if (event === "after-ack") result.textContent = mode === "quorum" ? "第二个副本已有 Part，单副本故障后仍有已确认副本可用。但这不是备份，也不覆盖同一错误传播。" : "若 Part 尚未复制，最新写入可能暂时只能在故障源副本恢复后取回。默认确认优先低延迟，不保证 ACK 时已有多份。";
      else result.textContent = "超时表示客户端不知道最终结果，并不等于服务端一定失败。使用稳定去重 token 和可验证的重试流程；不要依赖随机新 token 盲目重发。";
    }
    render();
  }

  function labDiagnosisDesign(mount) {
    var controls = el("div", "lab-controls clinic-grid");
    var partition = selectControl("PARTITION BY", [{ value: "month", label: "toYYYYMM(event_time)" }, { value: "day", label: "toDate(event_time)" }, { value: "user", label: "user_id" }], "month");
    var order = selectControl("ORDER BY", [{ value: "tenant", label: "(tenant_id, event_type, event_time)" }, { value: "time", label: "(event_time, tenant_id)" }, { value: "id", label: "(event_id)" }], "tenant");
    var batch = selectControl("单批写入", [{ value: "tiny", label: "1 行" }, { value: "medium", label: "10K 行" }, { value: "large", label: "100K 行" }], "large");
    var topology = selectControl("部署拓扑", [{ value: "1x1", label: "1 Shard × 1 Replica" }, { value: "2x1", label: "2 Shard × 1 Replica" }, { value: "2x2", label: "2 Shard × 2 Replica" }], "2x2");
    append(controls, partition.wrapper, order.wrapper, batch.wrapper, topology.wrapper);
    var stage = el("div", "lab-stage clinic-checks");
    var metrics = el("div", "metric-grid");
    var result = el("div", "lab-result");
    append(mount, controls, stage, metrics, result, schematic("工作负载固定为：按 tenant + event_type 查询近 24 小时、月级保留、持续追加；数值是方向性诊断，不是容量规划。"));

    function addCheck(label, pass, detail) {
      var card = el("article", "clinic-check " + (pass ? "is-pass" : "is-warning"));
      append(card, el("strong", "", (pass ? "✓ " : "! ") + label), el("p", "", detail));
      stage.appendChild(card);
    }

    function render() {
      stage.replaceChildren();
      var partitionPass = partition.input.value === "month";
      var orderPass = order.input.value === "tenant";
      var batchPass = batch.input.value !== "tiny";
      var replicaPass = topology.input.value === "2x2";
      addCheck("分区生命周期", partitionPass, partitionPass ? "月分区匹配月级删除与粗裁剪。" : partition.input.value === "user" ? "user_id 高基数分区会制造海量分区和小 Part。" : "日分区可用但元数据更多；先证明日级生命周期确有必要。" );
      addCheck("排序键与主查询", orderPass, orderPass ? "过滤条件形成有效左前缀。" : order.input.value === "id" ? "业务唯一 ID 不等于分析查询的最佳物理布局。" : "时间优先会削弱按单租户收窄范围的能力。" );
      addCheck("写入合批", batchPass, batchPass ? "批量 INSERT 控制初始 Part 数。" : "逐行 INSERT 会导致小 Part、Merge 积压和文件开销。" );
      addCheck("容量与可用性", replicaPass, replicaPass ? "Shard 扩容量，Replica 提供同 Shard 接管。" : "当前拓扑至少缺少容量扩展或同 Shard 冗余之一。" );
      var passed = [partitionPass, orderPass, batchPass, replicaPass].filter(Boolean).length;
      var selectedMarks = orderPass ? 5 : order.input.value === "time" ? 18 : 30;
      var partPressure = batch.input.value === "tiny" ? "极高" : batch.input.value === "medium" ? "中" : "低";
      metrics.replaceChildren(metric("设计检查", passed + " / 4", "针对固定案例"), metric("候选 Marks", selectedMarks + " / 32", "24h 查询示意"), metric("小 Part 压力", partPressure, "由批次主导"));
      result.className = "lab-result " + (passed === 4 ? "result-good" : passed >= 2 ? "result-medium" : "result-risk");
      result.textContent = passed === 4 ? "这是一套与当前案例一致的起始架构。上线前继续用真实分布、并发、压缩率、故障演练和备份恢复验证。" : "先修复红黄项，再考虑增加跳数索引或调线程。诊断顺序应从数据布局、Selected Parts/Marks、写入 Part 和算子成本开始。";
    }
    [partition.input, order.input, batch.input, topology.input].forEach(function (input) { input.addEventListener("change", render); });
    render();
  }

  function collectDom() {
    dom.lessonNav = document.getElementById("lesson-nav");
    dom.lessonView = document.getElementById("lesson-view");
    dom.prerequisite = document.getElementById("prerequisite-text");
    dom.lessonGlossary = document.getElementById("lesson-glossary");
    dom.glossaryDialog = document.getElementById("glossary-dialog");
    dom.glossaryToggle = document.getElementById("glossary-toggle");
    dom.glossaryClose = document.getElementById("glossary-close");
    dom.glossarySearch = document.getElementById("glossary-search");
    dom.glossaryList = document.getElementById("glossary-list");
    dom.mobileMenuToggle = document.getElementById("mobile-menu-toggle");
    dom.mobileCurrentTitle = document.getElementById("mobile-current-title");
    dom.sidebar = document.getElementById("course-sidebar");
    dom.resetProgress = document.getElementById("reset-progress");
    dom.themeToggle = document.getElementById("theme-toggle");
    dom.progressFill = document.getElementById("course-progress-fill");
    dom.progressLabel = document.getElementById("progress-label");
    dom.courseProgress = document.getElementById("course-progress");
    dom.completedCount = document.getElementById("completed-count");
    dom.completedSummary = document.getElementById("completed-summary");
    dom.masteryLabel = document.getElementById("mastery-label");
    dom.unitLabel = document.getElementById("unit-label");
    dom.toast = document.getElementById("toast");
  }

  function init() {
    collectDom();
    if (!dom.lessonView || !lessons.length) {
      if (dom.lessonView) dom.lessonView.replaceChildren(el("p", "callout tone-warning", "课程内容没有正确加载，请检查 course-content.js。"));
      return;
    }
    setupTheme();
    setupChrome();
    renderNavigation();
    renderGlossary("");
    var match = window.location.hash.match(/^#lesson-(\d+)$/);
    var initial = match && lessonById.has(Number(match[1])) ? Number(match[1]) : state.currentLesson;
    navigate(initial, { updateHash: true, scroll: false });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
}());
