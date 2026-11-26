---
title: '图像生成模型：架构、采样与训练'
description: '以 FLUX 3 Image Klein 与 H3-Image 为例，逐模块展开 VAE / DiT 的结构、张量形状、参数与 Python，并用交互示例理解 RoPE、采样与训练。'
destination: 'lab/image-models/'
published: 2026-11-24
updated: 2026-11-26
category: 'AI 工程'
tags: ['文生图', 'FLUX', 'H3', 'DiT', 'Flow Matching']
cover: 'architecture'
featured: false
draft: false
---

这份技术报告以 **FLUX 3 Image Klein 与 H3-Image** 为实例，按 **模型架构 → 采样方法 → 训练算法** 展开。19 张架构与流程图中的 288 个图块可以点击查看详情；3 份完整 PyTorch 源码将图像表示、模型的一次前向和完整生成过程连接起来。

**[打开完整交互报告 →](/blog/lab/image-models/)**

## 从图像表示到完整生成

- [模型架构](/blog/lab/image-models/#part-architecture)：展开两个 VAE 的 CNN / ViT 结构，以及 DiT 的输入投影、条件精炼、多流与单流、归一化、AdaLN、SwiGLU 和多维 RoPE。
- [采样方法](/blog/lab/image-models/#part-sampling)：区分两种时间方向、CFG、双时间 flow-map、H3 的六个步骤输出头，以及真实采样网格和精度处理。
- [训练算法](/blog/lab/image-models/#part-training)：连接表示学习、基础 Flow Matching、条件编辑、引导与少步蒸馏；分别说明公开实现、数学模板和未披露的训练配方。

每个图块可展开内部结构、输入输出形状、对应 Python 和按需播放的逐步讲解。VAE Stage 的详情按具体实例说明首块与后续块的通道、残差与独立采样模块；关键层另列参数矩阵及共享关系。讲解步骤与源码语句联动，支持跳步、暂停、返回和本图模块切换。

2×2 打包示例支持输入元素与输出 token 双向定位。RoPE 示例分别展示 FLUX 3、H3 DiT 和 H3 VAE 的维度配对，调整位置与频率即可查看旋转结果和范数变化。示例使用小张量解释真实排列与旋转规则。

报告还提供目录检索、阅读进度、图表放大、源码复制与下载，以及 token 预算和采样时间工具。公式、脚本和资源均嵌入单文件，支持手机阅读、深浅主题与打印。

## 源码对照与验证

完整代码定义 VAE、DiT 及其底层模块的构造器和前向，仅依赖 Python 标准库与 PyTorch。对照脚本使用缓存的官方实现、相同随机参数和缩小配置，检查输出、中间张量、输入及参数梯度；验证记录和来源哈希保存在报告附录中。

数值对照与桌面、手机、离线交互检查已经通过。验证使用 CPU 随机小模型，未加载发布权重，不能据此判断生成质量或完整训练的收敛表现。源码许可与模型权重许可分别列出。

## 下载与原始资料

- <a href="/blog/lab/image-models/index.html" download="image-models-technical-report.html">下载完整 HTML，离线阅读</a>
- [完整 Python 与源码验证](/blog/lab/image-models/#architecture-validation)
- [原始源码与许可证](/blog/lab/image-models/#source-excerpts)
- [模型谱系、榜单快照与来源](/blog/lab/image-models/#evidence)
