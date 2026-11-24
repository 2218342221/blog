---
title: '图像生成模型：架构、采样与训练'
description: '以 FLUX 3 Image Klein 与 H3-Image 为例，通过完整 VAE / DiT 架构图、LaTeX 公式和 PyTorch 源码，理解条件输入、采样循环与训练目标。'
destination: 'lab/image-models/'
published: 2026-11-24
category: 'AI 工程'
tags: ['文生图', 'FLUX', 'H3', 'DiT', 'Flow Matching']
cover: 'architecture'
featured: false
draft: false
---

这份技术报告以 **FLUX 3 Image Klein 与 H3-Image** 为实例，按 **模型架构 → 采样方法 → 训练算法** 展开。19 张架构与流程图、3 份完整 PyTorch 源码文件，将图像表示、模型的一次前向和完整生成过程连接起来。

**[打开完整交互报告 →](/blog/lab/image-models/)**

## 从图像表示到完整生成

- [模型架构](/blog/lab/image-models/#part-architecture)：展开两个 VAE 的 CNN / ViT 结构，以及 DiT 的输入投影、条件精炼、多流与单流、归一化、AdaLN、SwiGLU 和多维 RoPE。
- [采样方法](/blog/lab/image-models/#part-sampling)：区分两种时间方向、CFG、双时间 flow-map、H3 的六个步骤输出头，以及真实采样网格和精度处理。
- [训练算法](/blog/lab/image-models/#part-training)：连接表示学习、基础 Flow Matching、条件编辑、引导与少步蒸馏；分别说明公开实现、数学模板和未披露的训练配方。

报告提供目录检索、阅读进度、图表放大、模块定位、源码复制与下载，以及 RoPE、token 预算和采样时间的交互工具。公式、脚本和资源均嵌入单文件，支持手机阅读、深浅主题与打印。

## 源码对照与验证

完整代码定义 VAE、DiT 及其底层模块的构造器和前向，仅依赖 Python 标准库与 PyTorch。对照脚本使用缓存的官方实现、相同随机参数和缩小配置，检查输出、中间张量、输入及参数梯度；验证记录和来源哈希保存在报告附录中。

数值对照与桌面、手机、离线交互检查已经通过。验证使用 CPU 随机小模型，未加载发布权重，不能据此判断生成质量或完整训练的收敛表现。源码许可与模型权重许可分别列出。

## 下载与原始资料

- <a href="/blog/lab/image-models/index.html" download="image-models-technical-report.html">下载完整 HTML，离线阅读</a>
- [完整 Python 与源码验证](/blog/lab/image-models/#architecture-validation)
- [原始源码与许可证](/blog/lab/image-models/#source-excerpts)
- [模型谱系、榜单快照与来源](/blog/lab/image-models/#evidence)
