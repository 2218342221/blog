---
title: 'LLM 架构图鉴：从基础到前沿'
description: '用 10 个独立章节读懂 LLM 的核心架构：交互图解、LaTeX 公式、原始论文与可运行的 PyTorch 教学实现。'
destination: 'lab/llm-architecture-atlas/'
published: 2026-09-25
category: 'AI 工程'
tags: ['LLM', '模型架构', 'PyTorch', 'Transformer', '线性注意力']
cover: 'architecture'
featured: false
draft: false
---

从历史信息如何保存、token 之间如何混合，到专家路由、掩码扩散与深度残差，这份综述按核心计算机制选择代表工作，用 **10 个独立章节**串起基础与前沿。资料核实至 **2026 年 9 月 25 日**。

**[打开完整交互图鉴 →](/blog/lab/llm-architecture-atlas/)**

## 从结构图到可运行代码

基础篇介绍 Llama 3、DeepSeek-V3 和 Mamba-2；前沿篇独立展开 Kimi Linear、iLLaDA、Engram、mHC、Attention Residuals、Kimi K3 与 DeepSeek-V4.1。每章结合原始论文、官方配置与代码，给出整体结构、张量形状、核心公式和实现边界。

- [从基础结构开始](/blog/lab/llm-architecture-atlas/#basics)：理解残差、RMSNorm、SwiGLU，再比较 GQA、MLA 与 SSD。
- [进入前沿七章](/blog/lab/llm-architecture-atlas/#frontier)：查看线性注意力、双向扩散、条件记忆、深度混合，以及新模型中的集成方式。
- [打开 PyTorch 实验室](/blog/lab/llm-architecture-atlas/#lab)：阅读模型源码、下载代码包，运行前向、反向与小规模训练示例。

图解支持放大，关键机制提供可调参数与逐步动画；正文、图示和交互中的数学表达使用 LaTeX 渲染。页面内嵌字体、脚本与代码，下载后可以离线阅读。

## 实现与验证范围

代码包包含六套缩小的模型主干、三项研究模块、Block AttnRes 网络示例，以及 DeepSeek-V4.1 的 CED/CSA2 核心参考。已完成 55 项 PyTorch 测试和 CPU 训练链路检查；页面另经桌面、手机、离线显示与导航验证。

模型均从随机权重开始，示例用于验证计算机制。Kimi K3 实现覆盖文本主干；DeepSeek-V4.1 参考使用 dense FFN，未复现旗舰模型的全部组件。这些实现不提供预训练能力，也不能用于比较原模型的性能。

## 下载与原始资料

- <a href="/blog/lab/llm-architecture-atlas/index.html" download="llm-architecture-atlas.html">下载完整 HTML，离线阅读</a>
- [下载 PyTorch 代码与测试](/blog/lab/llm-architecture-atlas/llm-pytorch-lab.zip)
- [查看原始论文、官方实现与配置](/blog/lab/llm-architecture-atlas/#sources)

选型参考 [Sebastian Raschka 的 LLM Architecture Gallery](https://sebastianraschka.com/llm-architecture-gallery/)，各章在具体结论旁标注原文定位。
