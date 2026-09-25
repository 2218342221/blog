---
title: '推理引擎学院：从 nano-vLLM 到 vLLM 前沿'
description: '一套循序渐进的中文推理引擎课程：用 28 个模块串起最小引擎、生产级 vLLM、关键源码与 2024–2026 前沿专题。'
destination: 'lab/inference-engine-academy/'
published: 2026-09-25
category: 'AI 工程'
tags: ['LLM', '推理引擎', 'vLLM', 'CUDA', '分布式系统']
cover: 'transformer'
featured: false
draft: false
---

这套中文网页课程从可完整追踪的 nano-vLLM 出发，再进入 vLLM 的生产级多进程架构，最后把论文中的前沿机制映射回真实源码、系统约束与实验方法。全站包含 **28 个课程模块、244 小时学习路径、50 段结构化代码导读和 20 类图示**。

**[打开推理引擎学院 →](/blog/lab/inference-engine-academy/)**

## 从最小闭环走到生产架构

nano-vLLM 路线 N0–N8 用一个较小而完整的实现建立心智模型：从请求、Sequence 和 Scheduler 一路追踪到 ModelRunner、Attention 与采样，逐步理解 continuous batching、chunked prefill、Paged KV Cache、prefix cache、Tensor Parallel 和 CUDA Graph。

vLLM 核心路线 V0–V11 转向生产系统，覆盖 OpenAI-compatible API、AsyncLLM 与 EngineCore、多进程数据面、token-budget scheduling、KVCacheManager、V2 Model Runner、编译与图捕获、TP/PP/DP/EP、量化、speculative decoding、P/D 解耦、可观测性和 SLO。课程不只展示类名，还沿关键调用链解释输入输出、状态变化、重要分支和下一跳。

## V12–V18 前沿专题

完成核心路线后，可以继续学习七个高阶模块：

- 分层 Roofline、真实 backend/kernel dispatch 与低精度执行边界；
- speculative decoding、EAGLE/MTP 与 adaptive verification；
- 长上下文状态、hybrid model、PCP/DCP 与 exact attention；
- KV tiering、远端 connector、KV fabric 与 disaggregated serving；
- MoE token dispatch、All-to-All、EPLB 与 Elastic EP；
- SLO-aware routing、autoscaling、sleep/weight transfer 与版本化上线；
- 从论文 claim 到 RFC、最小实现、消融、故障注入和生产决策的综合项目。

[从课程首页选择学习路线](/blog/lab/inference-engine-academy/)；已有推理系统经验的读者可以直接进入 vLLM，但建议先完成 nano-vLLM 与 vLLM 的抽象映射，避免把相似名称误认为相同实现。

## 实验、图示与能力验收

每个模块把讲解与测验、实验、面试题和源码证据连接起来。实验要求记录环境、模型、dtype、输入分布、并发、配置、原始输出与重复次数；综合项目还需要提交设计说明、trace/metrics、失败分析、正确性验证和回滚方案。

网页中的完成状态只是本地学习进度，不代表能力认证。岗位级成果以可复现实验和项目答辩为准：学习者应能从数据契约、调度、内存、执行、分布式和服务 SLO 六个层面解释系统取舍，并能为性能问题提出可证伪的诊断顺序。

## 证据与版本边界

课程的实现讲解固定到 nano-vLLM 与 vLLM 的具体源码快照；代码导读会区分逐字源码、节选改写与等价伪代码。前沿章节则把论文结论、官方项目记录和当前 vLLM 实现分别标注：论文中的加速比只属于原模型、硬件、流量、SLO 与 baseline，源码中存在某项能力也不等于所有配置组合都已生产可用。

静态检查、构建和界面测试同样不等于在指定 GPU 上复现性能结果。课程因此把“源码确认”“论文报告”“工程推演”和“实验实测”分开呈现，便于继续审计和复现。
