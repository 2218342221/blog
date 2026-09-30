---
title: 'MoE 负载均衡：Aux Loss、Loss-Free 与 QB'
description: '用同一个 4×2 路由例子，逐步理解 Aux Loss、DeepSeek signSGD 与 Quantile Balancing，附完整推导、交互实验和实现边界。'
destination: 'lab/moe-load-balancing/'
published: 2026-09-30
category: 'AI 工程'
tags: ['MoE', '负载均衡', 'DeepSeek', 'Aux Loss', 'Loss-Free', 'QB']
cover: 'transformer'
featured: false
draft: false
---

这份中文教程围绕固定 TopK 的 MoE 路由负载均衡，用 **4 个 token、2 位专家**的同一组分数，串起 Aux Loss、DeepSeek 的 signSGD 偏置更新与 Quantile Balancing（QB）。先看直觉和手算，再展开完整证明与工程条件。

**[打开完整交互教程](/blog/lab/moe-load-balancing/)**

## 从路由选择到分位数更新

七节内容依次覆盖路由与负载记号、Aux Loss 与代理梯度、Loss-Free 偏置、约束分配与对偶、QB 的行列分位数、训练实现边界，以及三种方法的对照。

- [Aux Loss](/blog/lab/moe-load-balancing/#lesson-2)：区分实际选择份额 F 与平均软分数 P，理解 STE 等效梯度，以及归一化和 raw Sigmoid 目标的差别。
- [DeepSeek signSGD](/blog/lab/moe-load-balancing/#lesson-3)：写对过载专家的偏置方向，理解为什么偏置已变而 TopK 可能不变。
- [QB](/blog/lab/moe-load-balancing/#lesson-5)：从两次中位数手算出新偏置，再推导一般分位数、阈值最优条件与在线更新顺序。

主线分别说明打分、选择、输出权重与负载的作用，不把均衡损失值、路由分数之和或 MaxVio 当成语言模型质量的直接替代指标。

## 实验与复习

[路由实验室](/blog/lab/moe-load-balancing/#lab) 重复回放相同输入，可以调整激活函数、TopK、初始偏好差异和更新步长，对照无均衡、Aux Loss、signSGD 与 QB 的路由结果。每轮先记录当前负载，再更新状态。

各节配有理解检查；[公式速查](/blog/lab/moe-load-balancing/#reference) 汇总符号、方向、归一化、分位数和常见误读。学习进度仅保存在当前浏览器中。

## 成立条件与验证范围

教程保留整数配额、TopK 边界并列、非光滑对偶、中心化、跨设备统计和自回归因果性的说明。精确块更新的对偶目标不增，不等于有限次 QB 必然得到全局最优或当前批严格均衡；文中给出了可复算的停滞反例。

贯穿例子和公式已进行数值检查，包括有限差分、穷举小规模最优分配与偏置不变性。网页实验不包含语言模型任务训练，也不代表等计算预算下的性能比较。原论文实验、博客观察和本教程的教学构造分别标注。

## 来源与许可

主线基于苏剑林的[《MoE 环游记：6、最优分配促均衡》](https://kexue.fm/archives/11619)，结合系列第 2、3、5、8 篇、[DeepSeek Loss-Free 原论文](https://arxiv.org/html/2408.15664v1)与 [DeepSeek-V3 技术报告](https://arxiv.org/html/2412.19437v2)。[完整来源与阅读路线](/blog/lab/moe-load-balancing/#sources)保留了版本、引用位置和适用范围。

科学空间文章与原图版权归原作者，学习改编遵循原站 CC BY-NC-SA 许可；内嵌字体、公式排版库和图标库的许可证保留在 HTML 中。

<a href="/blog/lab/moe-load-balancing/index.html" download="moe-load-balancing.html">下载 HTML，离线阅读</a>
