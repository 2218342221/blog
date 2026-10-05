---
title: 'MemGPT：让大语言模型管理自己的记忆'
description: '三页复习卡：30秒重建 MemGPT 的记忆框架，跟一次检索理解控制流，再用实验与自测校准判断。'
destination: 'papers/memgpt/'
published: 2026-10-05
updated: 2026-10-05
category: 'AI 工程'
tags: ['论文精读', 'MemGPT', 'Agent', 'Memory']
cover: 'memory'
featured: false
draft: false
paper:
  shortTitle: 'MemGPT'
  originalTitle: 'MemGPT: Towards LLMs as Operating Systems'
  authors:
    - Charles Packer
    - Sarah Wooders
    - Kevin Lin
    - Vivian Fang
    - Shishir G. Patil
    - Ion Stoica
    - Joseph E. Gonzalez
  year: 2023
  version: 'arXiv v2 · 2024-02-12'
  sourceUrl: 'https://arxiv.org/abs/2310.08560v2'
  codeUrl: 'https://github.com/letta-ai/letta/tree/a1140032929ebbc33772d8fb67ea86d259d540e4'
  codeVersion: '0.3.1 · 2024-02-09'
  license: 'CC BY 4.0'
  reportPages: 3
  readingMinutes: 6
  takeaway: '模型决定记什么、查什么；程序负责保存与取回。外部记忆进入有限上下文后，模型才能用它回答。'
  assets:
    translationPdf: 'papers/memgpt/files/memgpt-zh.pdf'
    translationTex: 'papers/memgpt/files/memgpt-zh.tex'
    sourceBundle: 'papers/memgpt/files/memgpt-source.zip'
    originalSource: 'papers/memgpt/files/memgpt-arxiv-source-v2.tar.gz'
    originalPdf: 'papers/memgpt/files/memgpt-original-v2.pdf'
    reportPdf: 'papers/memgpt/files/memgpt-reading-report.pdf'
  questions:
    - prompt: 'MemGPT 的 Core memory 如何被模型看见？'
      options:
        - '全文被放进每次调用的系统提示词'
        - '写入模型权重，之后无需输入'
        - '必须先做向量检索才能看见'
      correct: 0
      explanation: 'Core 对应可编辑的 working context；persona 和 human 文本会被拼进系统消息。'
    - prompt: '哪一种记忆由程序自动保存对话消息？'
      options:
        - 'Archival memory'
        - 'Recall memory'
        - '只有 Core memory'
      correct: 1
      explanation: 'Recall 是自动保存的消息历史；Archival 通常由主动写入或文档导入填充。'
    - prompt: 'request_heartbeat=true 的主要作用是什么？'
      options:
        - '提高归档检索的相似度阈值'
        - '把消息复制到所有记忆层'
        - '请求工具结束后立即再运行一次模型'
      correct: 2
      explanation: '程序先把工具结果放回上下文，再通过下一轮推理让模型继续搜索、整理或回答。'
    - prompt: '在核对的 0.3.1 中，75% 预警意味着什么？'
      options:
        - '立即清空 75% 的全部记忆'
        - '提醒模型保存要点；摘要处理另由溢出错误触发'
        - '摘要必须保留原文 75% 的长度'
      correct: 1
      explanation: '预警与摘要是不同路径；75% 预警不等于删除比例，也不等于摘要压缩率。'
    - prompt: 'GPT-4 准确率 32.1%→92.5% 应如何解读？'
      options:
        - 'DMR 任务上，同底模下摘要基线与 MemGPT 的比较'
        - '所有长文档任务的通用准确率提升'
        - '这份读书报告独立复现得到的结果'
      correct: 0
      explanation: '这是论文 DMR 表的报告值：基线看有损历史摘要，MemGPT 可搜索完整历史，不能泛化为所有任务。'
---

<section class="report-sheet" id="report-1">

## 概念：30秒重建记忆框架

<div class="report-recap">

**30秒速记：一个问题，一套方法，一条边界。**

- **问题：** 对话持续增长，模型窗口有限；只保留摘要，可能丢掉以后才需要的细节。
- **方法：** 把信息分层保存，模型通过工具选择记什么、查什么，程序执行读写。
- **边界：** 外部存储可以很大，但单次推理仍受上下文窗口限制。**存着，不等于此刻看得见。**

</div>

### 先分清三种记忆

| 记忆                    | 放什么                   | 谁写入                 | 本轮是否直接可见           |
| ----------------------- | ------------------------ | ---------------------- | -------------------------- |
| **Core · 便签**         | 角色、用户偏好、关键事实 | 模型通过工具编辑       | **是**，全文在系统提示词中 |
| **Recall · 聊天记录库** | 交互消息原文             | 程序自动记录           | 窗口外记录需搜索取回       |
| **Archival · 资料柜**   | 笔记、导入文档           | 模型主动写入或文档导入 | 需要语义检索取回           |

Core 对应论文的 working context；0.3.1 用 `persona`、`human` 两块文本保存它。它只是主上下文的一部分：模型还会看到固定系统规则、历史摘要、近期消息和工具结果。

**从工具反推分工：** Core 无需查询工具；Recall 无需让模型逐条写消息；Archival 则分别提供写入与检索。

### 再看信息怎么流动

<div class="memory-map" role="img" aria-label="主上下文是模型本轮可见的工作台；LLM选择工具，程序执行读写；Recall自动保存消息，Archival保存笔记与文档。外部查询结果回到主上下文后，才能参与下一轮推理。">
  <div class="memory-map-context"><strong>主上下文 · 本轮可见</strong><span>系统规则 ＋ Core 便签 ＋ 摘要、近期消息与工具结果</span></div>
  <div class="memory-map-flow">输入模型 · 结果回窗</div>
  <div class="memory-map-engine"><strong>LLM 选择读写</strong><span>→ 工具调用 →</span><strong>程序执行与调度</strong></div>
  <div class="memory-map-flow">查询 / 写入 · 按需取回</div>
  <div class="memory-map-stores"><div><strong>Recall · 聊天记录库</strong><span>自动记录消息<br>按文本或日期搜索</span></div><div><strong>Archival · 资料柜</strong><span>主动写入笔记 / 导入文档<br>embedding 语义搜索</span></div></div>
</div>

**读图抓两点：** 模型负责选择，程序负责执行；外部记录被取回后，也会消耗上下文 token。旧消息离开窗口时，Recall 中的原文仍然保留，Archival 则不会自动接收每一条被移出的消息。

**论文的核心贡献：** 把分层存储、自主记忆读写和连续工具调用组合成运行时架构。一条用户消息可以触发多轮“取资料—读结果—再行动”，持续利用跨出窗口的历史。

</section>

<section class="report-sheet" id="report-2">

## 流程：跟着一次回忆走

### 用户问：“我上次说想去哪里旅行？”

下面是教学用流程，假设历史原文“下次旅行我想去京都。”只留在历史库中，当前上下文没有这条信息。它不是实测记录；工具调用仅示意关键参数，不是可直接复制的完整请求。

<ol class="report-steps" role="list">
  <li><strong>发现缺口。</strong>模型看到问题，但当前窗口中没有答案，需要查询过去的消息。</li>
  <li><strong>发起检索。</strong>模型生成工具调用：<code>conversation_search(query="旅行", request_heartbeat=true)</code>。</li>
  <li><strong>执行并回填。</strong>程序按文本匹配搜索 Recall，把含“旅行”的记录放回消息窗口；heartbeat 请求立即继续一轮推理。</li>
  <li><strong>阅读证据。</strong>下一轮模型读到“下次旅行我想去京都。”，提取目的地“京都”。若信息仍不足，可以调整查询或继续取结果。</li>
  <li><strong>发送回答。</strong>模型调用 <code>send_message</code> 展示“你提过想去京都”。没有预警、错误或 heartbeat 等续跑事件时，程序等待下一次输入。</li>
</ol>

**关键连接：** 工具结果先进入上下文，下一轮模型才读到它。`request_heartbeat=true` 请求这次续跑；`send_message` 负责显示答案，本身不强制终止循环。

### 8个默认工具速查

以下来自 0.3.1 默认聊天与文档预设；六个记忆工具都带有 heartbeat 控制参数。

| 要做什么                 | 工具                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| 给用户回答；暂停定时唤醒 | `send_message`；`pause_heartbeats`（最长360分钟）                 |
| 修改 Core                | `core_memory_append`；`core_memory_replace`                       |
| 搜索 Recall              | `conversation_search`（文本）；`conversation_search_date`（日期） |
| 写入／检索 Archival      | `archival_memory_insert`；`archival_memory_search`（语义）        |

### 窗口快满：分开记住两个动作

<div class="report-split">
  <div><strong>① 75%：预警，提醒保存要点</strong><p>0.3.1 在调用返回的 <code>usage.total_tokens</code> 超过窗口75%时告警。模型可选择更新 Core 或写入 Archival；告警不会自动执行存档。</p></div>
  <div><strong>② 上下文溢出：摘要，然后重试</strong><p>程序识别溢出错误后，另调模型把一段旧消息替换为摘要，再重试。Core 与近期消息保留，Recall 中的原文仍在。</p></div>
</div>

论文中的70%预警、满载刷新、约50%驱逐是示例。所查版本的 **75%是预警阈值，不是摘要压缩率**；主动存档与程序生成摘要也不是同一个动作。

</section>

<section class="report-sheet" id="report-3">

## 判断：证据、选型与自测

### 实验证明了什么？先记住DMR

**任务：** 深度记忆检索（DMR）要求回答先前聊天中的具体细节。MSC 每组含五个会话，作者再构造第六个会话中的单个问答；问答由另一 LLM 生成，Accuracy 由 LLM judge 对照标准答案判定。

**比较条件：** 下表均为同底模比较。基线读取有损历史摘要，MemGPT 可以搜索完整历史。

| 底层模型      | 摘要基线 | 加入 MemGPT |
| ------------- | -------: | ----------: |
| GPT-3.5 Turbo |    38.7% |       66.9% |
| GPT-4         |    32.1% |       92.5% |
| GPT-4 Turbo   |    35.3% |       93.4% |

**读数边界：** 这支持“保留原文并按需找回”在 DMR 中的价值。两组可访问的信息量与访问方式不同，不能仅凭该表拆出各组件贡献，也不能把92.5%推广到其他任务。论文中的 GPT-4／Turbo 分别指 `gpt-4-0613`／`gpt-4-1106-preview`。

### 我的选型判断：有长期信息需求，还要付得起调用成本

- **适合尝试：** 长期个性化助手、项目助理、需反复查证的资料分析。前提是重要事实经常跨出窗口，任务允许额外检索与推理。
- **重点验证：** 是否漏存或写错事实、旧偏好是否更新、查询是否命中、是否过早停止。论文文档问答仅采样50题，也观察到模型常提前停止翻页。
- **验收方法：** 用自己的任务，对齐数据范围与调用预算；分别记录回答正确率、检索次数、token和延迟。记忆做大，不能自动解决推理错误。

### 五个易混淆点

<ul class="report-checks" role="list">
  <li><strong>Core改在哪里？</strong>系统提示词中的工作记忆文本。</li>
  <li><strong>谁自动保存对话？</strong>程序写 Recall；Archival 保存主动写入或导入的知识。</li>
  <li><strong>heartbeat连接哪两步？</strong>工具结果回窗后，请求下一轮模型推理。</li>
  <li><strong>75%会触发摘要吗？</strong>它触发预警；摘要走另一个溢出处理路径。</li>
  <li><strong>92.5%适用于哪里？</strong>论文中 GPT-4＋MemGPT 的 DMR 评估。</li>
</ul>

<div class="report-sources">

**来源与边界：** [Packer 等，MemGPT，arXiv v2](https://arxiv.org/abs/2310.08560v2)，方法、实验与DMR表；原文 CC BY 4.0。中文翻译、报告与图由 **Clearer Notes** 整理。

代码为[官方0.3.1固定提交](https://github.com/letta-ai/letta/tree/a1140032929ebbc33772d8fb67ea86d259d540e4)的静态核对，涵盖 `agent.py`、`memory.py`、`constants.py`、`main.py`、`functions/`。历史分页接口存在兼容性瑕疵；本报告未运行模型 API，未独立复现实验。

</div>

</section>
