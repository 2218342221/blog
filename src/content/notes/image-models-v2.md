---
title: '现代图像生成模型导论（v2 教材版）：架构、采样与训练'
description: '以 MiniMax-H3-Image 与 FLUX 3 Image Klein 为一手源码实例，按“动机 → 定义 → 手算例题 → 实验 → 自测”拆解 VAE、DiT、RoPE、6 步 PDD 与 4K 部署系统。'
destination: 'lab/image-models-v2/'
published: 2026-11-27
category: 'AI 工程'
tags: ['文生图', 'MiniMax-H3-Image', 'FLUX', 'DiT', 'Flow Matching']
cover: 'architecture'
featured: false
draft: false
---

这份 **v2 教材版** 讲义以 **MiniMax-H3-Image（33.1B 原生 4K 路线）** 与 **FLUX 3 Image Klein（5.6B 轻量帕累托路线）** 为一手源码对照案例，按照“问题动机 → 形式化定义 → 手算例题 → 交互实验 → 章节自测”的顺序组织全书五章与附录，并与早期版本 [v1 交互报告](/blog/lab/image-models/) 独立并存。

**[打开 v2 完整教材讲义 →](/blog/lab/image-models-v2/)**

## 章节结构

- [序章 · 问题框架与全书符号表](/blog/lab/image-models-v2/#preface)：四阶段解耦框架、两案例总纲表与全书统一符号约定。
- [第 1 章 · 图像表示与视觉 Token 化](/blog/lab/image-models-v2/#ch-1)：有效步长定义、4K（4096²）手算例题、非对称 ViT-VAE vs 对称 CNN-VAE、4K 与多参考预算实验台及自测。
- [第 2 章 · 条件编码、DiT 主干与多维 RoPE](/blog/lab/image-models-v2/#ch-2)：双层提示扩写、单张参考图全程跟踪例题、33.1B DiT 扩展注意力与 ~13B AdaLN 缓存手算、FLUX 3 对照与多维 RoPE 旋转实验台。
- [第 3 章 · 采样方法、6 步 PDD 与复现级精度](/blog/lab/image-models-v2/#ch-3)：相反流路径定义、PDD 首末步手算例题、7 项复现级数值精度契约与真实时间网格步进实验台。
- [第 4 章 · 训练算法、蒸馏体系与证据边界](/blog/lab/image-models-v2/#ch-4)：四阶段训练链、变长混合分辨率归一化手算例题、引导/Flow-Map/PDD 蒸馏对照与公开事实边界。
- [第 5 章 · 4K 10 秒级推理系统与完整 PyTorch 源码](/blog/lab/image-models-v2/#ch-5)：单卡 H200 显存账本手算、四大系统优化、SGLang / vLLM-Omni 实测对照与 3 份可下载自包含 PyTorch 实现。
