---
title: 'ClickHouse 深度教程：从 Part、Granule 到查询与集群'
description: '一套面向新手、深入工程原理的 ClickHouse 交互课程，系统讲解列式存储、Part、Granule、MergeTree、查询流水线、分片副本与性能诊断。'
destination: 'lab/clickhouse-internals/'
published: 2026-10-25
category: '后端开发'
tags: ['ClickHouse', 'OLAP', '列式存储', '数据库', '分布式系统']
cover: 'database'
featured: false
draft: false
---

这套教程从一个多租户事件分析平台出发，沿着同一条数据旅程解释 ClickHouse：一批事件怎样写成 Part，查询怎样借助稀疏索引减少读取，Processor Pipeline 怎样完成并行聚合，以及 Shard、Replica、Distributed 与 Keeper 怎样组成生产集群。

**[打开完整交互课程 →](/blog/lab/clickhouse-internals/)**

## 从业务问题建立底层模型

课程不是术语列表，而是一条连续的因果链。前半部分依次解释 OLTP 与 OLAP 的工作负载差异、列式存储、INSERT 落盘、Part、Granule、Mark、Compression Block、排序键、主键索引、Merge、Mutation 与 TTL。

其中专门区分两个常见误解：不同 Part 的 `ORDER BY` 键值范围可以重叠；Granule 只属于一个 Part，永远不会跨 Part，后台 Merge 生成新 Part 时会重新划分 Granule 与 Marks。

## 查询引擎、存储语义与集群

后半部分从 SQL 的解析与分析进入 Query Plan 和 Processor Pipeline，继续展开 PREWHERE、局部聚合状态、状态合并与 finalize、JOIN 语义和算法、分布式查询的远端局部计算与 Initiator 最终汇总。

存储引擎章节对照 MergeTree、ReplacingMergeTree、SummingMergeTree 与 AggregatingMergeTree，并解释 Materialized View 和 Projection 的适用边界。集群章节则把 Shard、Replica、Distributed、Keeper、Quorum、备份和 SharedMergeTree 分开说明，避免把高可用误解成备份或跨 Shard 事务。

## 实验与验证方式

全课程包含 12 课、12 个交互实验和 36 道分层练习。实验覆盖写入批次与 Part 债务、Granule 和压缩块边界、排序键裁剪、查询 Pipeline、聚合与 JOIN 成本、引擎选择、集群故障和综合架构诊断。

实验数字均明确标记为教学示意，不伪装成真实性能基准。课程最后使用 `EXPLAIN`、`system.query_log`、`system.parts`、`system.merges`、`system.mutations` 和复制队列建立证据化诊断顺序。

学习进度与答题记录保存在当前浏览器中；页面不依赖外部字体、图片或 CDN，可以独立阅读。
