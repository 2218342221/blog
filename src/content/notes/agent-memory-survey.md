---
title: 'Agent Memory 综述：从历史到未来决策'
description: '沿任务状态、事实证据与经验迁移三类需求，深入比较 Agent Memory 的主要研究路线、前沿论文与生产系统，配有 19 幅可交互动画。'
destination: 'lab/agent-memory/'
published: 2026-09-25
category: 'AI 工程'
tags: ['Agent', 'Memory', 'LLM', '综述', '持续学习']
cover: 'learning'
featured: false
draft: false
---

过去的信息，怎样持续改变 Agent 的后续决策？这份综述沿三个问题展开：当前任务做到哪一步、跨会话应当相信什么、过去的经历怎样帮助新的任务。

**[打开完整交互式综述 →](/blog/lab/agent-memory/)**

资料检索截至 **2026 年 9 月 24 日**，收录 64 项研究工作与 7 份官方工程资料。全文共 12 章、19 幅可播放示意图，重点关注 2025—2026 年的研究进展，并结合早期代表工作解释主要路线的形成。

## 沿三类需求理解主要研究路线

- [维持任务状态](/blog/lab/agent-memory/working.html)：从 MemGPT、ReadAgent、HiAgent 的上下文分层与回读，到 MEM1、MemAgent 的状态管理学习。
- [保存事实与证据](/blog/lab/agent-memory/knowledge.html)：比较主题、原子事实、图与层级摘要，解释访问表示与原始证据的分工，以及时间、更新和读取预算的影响。
- [积累经验与技能](/blog/lab/agent-memory/evolution.html)：区分同题重试与跨任务迁移，比较案例、规则、工作流和可执行程序的复用方式，以及验证、维护与回滚机制。

在这些用途之外，[管理学习](/blog/lab/agent-memory/learning.html)讨论排序、写入、操作库和架构分别怎样改进；[模型内部记忆](/blog/lab/agent-memory/substrates.html)区分持久隐状态、测试时快权重更新与生成式辅助表示。

## 从机制比较走向证据与应用

各章围绕问题、机制差异和原始实验证据展开，并将重要消融与版本说明保留在可展开区域。[评测章](/blog/lab/agent-memory/evaluation.html)把不同需求与测试协议对应，[生产章](/blog/lab/agent-memory/production.html)讨论更新可见性、来源、纠错、删除和发布，[前沿章](/blog/lab/agent-memory/frontiers.html)进一步提出未知未来需求、长期信用分配、协作、多模态和持续效用等研究问题。

图解支持播放、暂停、逐步跳转、调速与全图概览；手机端可跟随当前步骤查看，打印时保留完整静态图。动画用于解释机制与信息流，不表示实测性能或已证明的因果关系。

## 来源与离线阅读

[文献库](/blog/lab/agent-memory/atlas.html)支持按研究标签、来源类型和年份筛选；[参考文献与研究方法](/blog/lab/agent-memory/references.html)保留原始链接、发表状态、阅读深度及关键证据位置。本综述未独立复现论文实验，也未实测厂商生产负载。

<a href="/blog/lab/agent-memory/report.html" download="agent-memory-survey-2026-09.html">下载单文件 HTML，离线阅读</a>。单文件内嵌样式与动画脚本，查阅原始文献链接需要联网。
