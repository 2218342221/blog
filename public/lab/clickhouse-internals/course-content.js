(function () {
  "use strict";

  window.CQ_DATA = {
    units: [
      { title: "单元 1 · 建立心智模型", lessons: [0, 1] },
      { title: "单元 2 · 数据如何落盘", lessons: [2, 3, 4, 5] },
      { title: "单元 3 · 查询如何执行", lessons: [6, 7] },
      { title: "单元 4 · 引擎与预计算", lessons: [8] },
      { title: "单元 5 · 集群与一致性", lessons: [9, 10] },
      { title: "单元 6 · 设计与诊断", lessons: [11] }
    ],

    glossary: {
      "OLTP": {
        definition: "面向短事务、少量行读写和强业务约束的工作负载。",
        role: "承载订单创建、余额扣减、库存变更等在线业务状态。",
        contrast: "OLAP 关注大范围扫描和聚合；OLTP 关注单次事务的低延迟与一致性。",
        example: "根据 order_id 更新一笔订单，同时写入支付状态。",
        misconception: "ClickHouse 支持 SQL，并不意味着它适合替代所有 OLTP 数据库。"
      },

      "OLAP": {
        definition: "面向大量数据扫描、过滤、聚合和探索分析的工作负载。",
        role: "承载日志、指标、事件流、报表与交互分析。",
        contrast: "OLAP 通常接受追加写入与批量处理，换取大规模分析吞吐。",
        example: "统计最近 30 天各国家的购买金额和活跃用户。",
        misconception: "OLAP 查询也可能很慢；列存不能自动解决错误的数据布局和大型 JOIN。"
      },
      "Block": {
        definition: "ClickHouse 在写入或执行过程中处理的一批列数据；具体语境很重要。",
        role: "让表达式、过滤和聚合以批次而不是逐行方式运行。",
        contrast: "INSERT Block、执行 Block/Chunk、Compression Block 是三个不同概念。",
        example: "物化视图通常对新写入的 INSERT Block 执行转换。",
        misconception: "看到 Block 不能直接理解成磁盘压缩块。"
      },
      "Partition": {
        definition: "具有相同分区表达式值的一组 Part。",
        role: "服务于生命周期管理、整分区操作和粗粒度查询裁剪。",
        contrast: "Partition 是单表内部结构；Shard 是跨服务器的数据水平拆分。",
        example: "PARTITION BY toYYYYMM(event_time) 产生按月分区。",
        misconception: "分区越细不一定越快；高基数分区会制造大量 Part。"
      },
      "Part": {
        definition: "一次写入或后台合并产生的、不可变且已排序的物理数据单元。",
        role: "承载列数据、稀疏索引、Marks、校验和及其他元数据。",
        contrast: "Partition 包含多个 Part；Part 内部再划分 Granule。",
        example: "一次 INSERT 跨两个月，通常至少生成两个 Part。",
        misconception: "不同 Part 的 ORDER BY 键值区间可以重叠；Part 名称中的 block-number 区间是另一回事。"
      },
      "Granule": {
        definition: "Part 内主键稀疏索引与读取调度的基本逻辑行组。",
        role: "把数十亿行压缩成数量可控的索引边界和读取范围。",
        contrast: "Granule 属于一个 Part，永远不会跨 Part；它与 Compression Block 边界不要求对齐。",
        example: "默认 index_granularity 常为 8192，但自适应粒度还受字节阈值影响。",
        misconception: "Granule 不保证永远恰好 8192 行，也不是独立文件。"
      },
      "Mark": {
        definition: "记录 Granule 边界在某个列数据流中位置的定位信息。",
        role: "让读取器从候选 Granule 对应的列数据附近开始读取。",
        contrast: "主键索引回答读取哪些 Granule；Mark 回答相关列数据在文件什么位置。",
        example: "Mark 通常包含压缩文件偏移和解压后块内偏移。",
        misconception: "Mark 不是单行地址，命中 Mark 后仍要读取并过滤候选数据。"
      },
      "Compression Block": {
        definition: "列数据真正执行压缩和解压的物理块。",
        role: "降低磁盘与网络字节数，并在读取时按块解压。",
        contrast: "它不是 Granule，也不是查询执行中的 Block/Chunk；三者边界可能不同。",
        example: "多个 Granule 的起点可能位于同一压缩块中，一个 Granule 也可能涉及多个压缩块。",
        misconception: "通过索引命中少量行，仍可能需要解压覆盖它们的完整压缩块。"
      },
      "ORDER BY": {
        definition: "MergeTree 中决定每个 Part 内物理排序的表达式。",
        role: "决定数据局部性、稀疏索引能力、压缩效果及部分引擎的合并语义。",
        contrast: "表的 ORDER BY 不等于 SELECT 的输出排序，也不保证唯一。",
        example: "ORDER BY (tenant_id, event_type, event_time, event_id)。",
        misconception: "把业务唯一 ID 放第一位，若查询从不按它过滤，通常无法有效裁剪。"
      },
      "PRIMARY KEY": {
        definition: "MergeTree 用于构建稀疏主键索引的表达式，默认等于 ORDER BY。",
        role: "通过 Granule 边界键值缩小候选 Mark Range。",
        contrast: "它不是唯一约束；单独定义时通常应是排序键前缀。",
        example: "PRIMARY KEY (tenant_id, event_type, event_time)。",
        misconception: "ClickHouse 主键不是逐行 B-Tree，也不会拒绝重复值。"
      },
      "Merge": {
        definition: "后台把同一 Partition 中若干 Part 重写成更大 Part 的过程。",
        role: "减少 Part、改善压缩，并执行 Replacing、Summing、TTL 等语义。",
        contrast: "Merge 是后台存储维护；Mutation 是针对已有数据的显式变更。",
        example: "三个小 Part 经多路归并生成一个新 Part，随后旧 Part 失活。",
        misconception: "Merge 异步且受策略限制，不保证马上发生，也不保证最终只剩一个 Part。"
      },
      "Mutation": {
        definition: "通过重写受影响 Part 来执行 UPDATE、DELETE 等既有数据变更。",
        role: "在列式不可变 Part 模型上实现数据修正。",
        contrast: "它不是行存数据库中的原地单行更新。",
        example: "ALTER TABLE events UPDATE country='CN' WHERE event_id=1002。",
        misconception: "大范围 Mutation 可能消耗大量 I/O、CPU 和临时磁盘。"
      },
      "PREWHERE": {
        definition: "先读取部分过滤列形成行掩码，再按 Granule、Mark 与 Compression Block 边界读取后续列的优化阶段。",
        role: "让已被完全淘汰的 Granule 或读取范围不再读取宽列；候选范围内部仍不是逐行物理 I/O。",
        contrast: "它发生在 Part/Granule 已经通过索引裁剪之后，不能替代正确的排序键。",
        example: "先读 tenant_id、event_type、event_time，再按掩码读取 revenue。",
        misconception: "手写 PREWHERE 不保证更快，优化器通常也可自动选择。"
      },
      "Query Plan": {
        definition: "描述查询需要执行哪些读取、过滤、聚合、排序和 JOIN 操作的计划。",
        role: "连接 SQL 语义与运行时 Pipeline。",
        contrast: "Plan 描述做什么；Pipeline 展开实际并行通道和 Processor 连接。",
        example: "Read → Filter → Aggregating → Sorting。",
        misconception: "计划中一个读取节点不代表运行时只有一个线程。"
      },
      "Processor": {
        definition: "查询 Pipeline 中负责读取、转换、过滤、聚合或合并 Chunk 的执行组件。",
        role: "通过输入输出端口组成有向执行图。",
        contrast: "Processor 是运行时组件；Query Plan Step 是计划层描述。",
        example: "多个读取 Processor 分别扫描不同 Mark Range，再汇入聚合 Processor。",
        misconception: "增加 max_threads 不会自动让所有 Processor 等比例并行。"
      },
      "MergeTree": {
        definition: "以不可变排序 Part、稀疏索引和后台合并为核心的表引擎家族。",
        role: "作为 ClickHouse 绝大多数生产分析表的基础。",
        contrast: "MergeTree 是引擎家族，不是一棵传统 B-Tree，也不能简单等同于标准 LSM Tree。",
        example: "普通明细表使用 MergeTree，高可用版本使用 ReplicatedMergeTree。",
        misconception: "名字中的 Tree 不代表查询依赖传统树形逐行索引。"
      },
      "Shard": {
        definition: "保存整体数据不同子集的水平分片。",
        role: "扩展总容量、写入吞吐和并行计算能力。",
        contrast: "Replica 保存同一 Shard 的副本；Partition 是表内生命周期单位。",
        example: "Shard 1 保存一部分租户，Shard 2 保存另一部分租户。",
        misconception: "新增 Shard 不会自动重新均衡已有历史数据。"
      },
      "Replica": {
        definition: "同一 Shard 数据的一份在线副本。",
        role: "提高节点故障下的可用性和总体读取服务能力。",
        contrast: "Replica 不是 Backup；错误删除和 Mutation 也可能复制传播。",
        example: "2 Shard × 2 Replica 共四个 Shard 副本。",
        misconception: "增加 Replica 不等于扩大逻辑数据容量，也不会默认让单条查询快一倍。"
      },
      "Distributed": {
        definition: "负责向多个 Shard 路由写入、下发查询并汇总结果的逻辑表引擎。",
        role: "为客户端提供统一的集群访问入口。",
        contrast: "最终业务明细通常位于各节点本地 MergeTree 表。",
        example: "events_all 路由到各 Shard 的 events_local。",
        misconception: "Distributed 不负责 ReplicatedMergeTree 的副本复制。"
      },
      "Keeper": {
        definition: "基于共识协议提供复制日志、选举和协调元数据的服务。",
        role: "协调 ReplicatedMergeTree、副本注册和分布式 DDL 等操作。",
        contrast: "Keeper 不保存业务 Data Part，也不参与普通数据扫描。",
        example: "生产环境通常部署奇数个 Keeper 节点形成法定多数。",
        misconception: "Keeper 不是查询路由器，也不能代替数据副本。"
      },
      "Quorum": {
        definition: "一项操作必须获得指定数量参与者确认后才视为成功。",
        role: "增强部分故障场景下的写入确认与持久性保证。",
        contrast: "Quorum 不等于通用跨 Shard ACID，也不等于线性一致读。",
        example: "两副本要求 insert_quorum=2，会等待两个副本确认。",
        misconception: "更高 Quorum 会牺牲部分故障时的写可用性。"
      },
      "Materialized View": {
        definition: "在新 INSERT Block 到达时执行转换并把结果写入目标表的数据管道。",
        role: "维护稳定、高频的预计算或数据格式转换。",
        contrast: "它不是表引擎，也不是自动响应源表任意历史变更的完整派生表系统。",
        example: "把原始购买事件聚合为每日租户 GMV 状态。",
        misconception: "创建后不会自动完整回填历史数据，也不会自动重放源表 Mutation。"
      }
    },

    lessons: [
      {
        id: 0,
        unit: "单元 1 · 建立心智模型",
        title: "ClickHouse 为什么存在，而不是先问它为什么快？",
        shortTitle: "为什么需要 ClickHouse",
        duration: "约 14 分钟",
        prerequisite: "不要求数据库内核知识；只需理解表、行、列和 SQL 查询。",
        terms: ["OLTP", "OLAP"],
        goals: [
          "区分 OLTP 与 OLAP 工作负载，而不是只比较产品名称。",
          "判断一个业务问题是否适合 ClickHouse。",
          "理解高吞吐分析背后必然存在的设计取舍。"
        ],
        thesis: "ClickHouse 首先是一套面向 OLAP 的取舍：它优先优化批量追加、海量扫描和聚合，而不是高频单行事务。",
        sections: [
          {
            type: "case",
            title: "先从一个真实问题开始",
            paragraphs: [
              "我们经营一个多租户事件分析平台。每天持续接收 page_view、click、purchase 等事件。产品经理提出问题：租户 42 昨天在不同国家产生了多少购买金额？",
              "这条问题不是在找某一条事件，而是要扫描大量候选事件、过滤租户和时间，再按国家分组求和。它天然更接近 OLAP，而不是 OLTP。"
            ],
            query: [
              "SELECT country, sum(revenue) AS gmv",
              "FROM events",
              "WHERE tenant_id = 42",
              "  AND event_type = 'purchase'",
              "  AND event_time >= '2026-10-01 00:00:00'",
              "  AND event_time <  '2026-10-02 00:00:00'",
              "GROUP BY country",
              "ORDER BY gmv DESC;"
            ]
          },
          {
            type: "table",
            title: "不要把数据库分成“快”和“慢”，先看工作负载",
            headers: ["维度", "典型 OLTP", "典型 OLAP / ClickHouse"],
            rows: [
              ["一次操作", "少量行、完整记录", "大量行、少量列"],
              ["写入形态", "频繁小事务、原地更新", "批量追加为主"],
              ["核心约束", "唯一键、事务、一致性", "吞吐、扫描量、聚合延迟"],
              ["常见问题", "这笔订单现在是什么状态？", "过去 30 天各地区 GMV 是多少？"],
              ["主要代价", "维护索引和事务日志", "提前设计数据布局，更新通常更重"]
            ]
          },
          {
            type: "steps",
            title: "为什么分析系统要做不同的取舍",
            steps: [
              { title: "查询会触碰很多行", body: "如果一条报表要观察十亿行，逐行随机访问会产生巨大的调度和 I/O 成本。" },
              { title: "但通常只需要少量列", body: "贯穿查询只需要 tenant_id、event_type、event_time、country、revenue，不需要 payload 等宽列。" },
              { title: "结果来自批量计算", body: "过滤、分组和聚合天然适合把同类型值放在一起批量处理。" },
              { title: "因此写入和更新模型也会改变", body: "ClickHouse 倾向于批量生成新的不可变数据，而不是围绕每一行做高频原地修改。" }
            ]
          },
          {
            type: "lab",
            kind: "workload-fit",
            title: "实验：这项需求应该交给谁？",
            prompt: "选择业务场景，先预测适合 OLTP 还是 ClickHouse，再查看原因。"
          },
          {
            type: "callout",
            tone: "warning",
            title: "不能从“支持 SQL”推出“适合所有数据库工作”",
            body: "ClickHouse 的事务能力和更新能力在演进，但它仍不适合作为通用跨 Shard ACID 交易数据库。核心账本、余额扣减、强唯一约束和高频单行更新应先考虑 OLTP 系统。"
          },
          {
            type: "details",
            title: "继续深入：ClickHouse 的速度由哪些层次共同决定？",
            paragraphs: [
              "存储层通过列裁剪、压缩、排序和稀疏索引减少必须读取的字节。",
              "执行层通过按批处理、类型特化、并行读取和局部聚合降低 CPU 与调度成本。",
              "集群层通过 Shard 水平拆分数据，并尽量在远端先过滤和局部聚合，减少网络回传。",
              "任何一层设计错误都会抵消其他层优势。例如 ORDER BY 与查询完全不匹配时，即使列存和 SIMD 仍然存在，扫描放大也可能让查询很慢。"
            ]
          }
        ],
        recap: [
          "先判断问题是短事务还是大规模分析。",
          "ClickHouse 的优势来自一组协同取舍，不是某个神奇参数。",
          "后续所有设计都围绕一个目标：少读、批量算、并行算。"
        ],
        quiz: [
          {
            level: "识别",
            question: "以下哪项最适合 ClickHouse？",
            options: ["根据主键读取用户并立即修改地址", "统计最近 30 天各国家购买金额", "原子修改两个账户余额", "每秒更新同一行库存一万次"],
            answer: 1,
            explanation: "它需要扫描并聚合大量事件，是典型 OLAP。其他选项更强调短事务、原地更新或强一致性。",
            misconception: "不要仅根据数据量判断；访问模式和一致性要求更关键。"
          },
          {
            level: "应用",
            question: "一张 80 列事件表的查询只使用 4 列，列式布局首先减少什么？",
            options: ["SQL 解析步骤", "无关列的读取、解压和传输", "所有网络请求", "主键重复值"],
            answer: 1,
            explanation: "列式布局使存储层只读取参与过滤、分组和聚合的列，并提升相似值的压缩效果。",
            misconception: "列裁剪不会消除查询计划、网络和聚合本身。"
          },
          {
            level: "推理",
            question: "为什么“ClickHouse 是列存”不能推出“任何 SQL 都很快”？",
            options: ["列存只支持字符串", "大型 JOIN、高基数聚合和错误排序键仍可能产生高成本", "列存不能压缩", "ClickHouse 只能单线程"],
            answer: 1,
            explanation: "列存主要减少无关列 I/O。读取范围、哈希表规模、排序、网络和并行汇合仍决定整体成本。",
            misconception: "把一种优化机制当成完整性能模型，是后续最常见的误区。"
          }
        ]
      },

      {
        id: 1,
        unit: "单元 1 · 建立心智模型",
        title: "列式存储到底少读了什么，又付出了什么代价？",
        shortTitle: "列式存储与批量执行",
        duration: "约 16 分钟",
        prerequisite: "理解上一课的 OLTP 与 OLAP 区别。",
        terms: ["Block", "Compression Block"],
        goals: [
          "从磁盘读取、压缩和 CPU 执行三个角度解释列存优势。",
          "区分列式布局、Compression Block 与执行 Block/Chunk。",
          "理解宽表、SELECT * 和单行点查为何削弱列存收益。"
        ],
        thesis: "列式存储的核心价值不是“换一种文件格式”，而是让查询只搬运需要的列，并让同类型数据更容易压缩和批量计算。",
        sections: [
          {
            type: "case",
            title: "贯穿查询真正需要哪些数据",
            paragraphs: [
              "events 表除了 tenant_id、event_time、event_type、country、revenue，还包含 user_id、session_id、payload、user_agent 等字段。payload 可能是一段很大的 JSON。",
              "贯穿查询不需要 user_id、session_id 和 payload。理想情况是这些列连磁盘都不读取，更不用解压和进入 CPU Cache。"
            ],
            query: [
              "SELECT country, sum(revenue)",
              "FROM events",
              "WHERE tenant_id = 42",
              "  AND event_type = 'purchase'",
              "  AND event_time >= '2026-10-01'",
              "  AND event_time <  '2026-10-02'",
              "GROUP BY country;"
            ]
          },
          {
            type: "lab",
            kind: "column-scan",
            title: "实验：同一条查询在行式与列式布局下搬运什么",
            prompt: "切换布局，观察参与读取的列、示意字节数和执行批次。所有数字仅用于解释关系，不是 Benchmark。"
          },
          {
            type: "steps",
            title: "速度提升来自三个连续阶段",
            steps: [
              { title: "磁盘少读", body: "只读取过滤、分组和聚合需要的列，宽 payload 不会自动进入读取路径。" },
              { title: "压缩后更小", body: "同一列类型相同、值域相近。重复租户、枚举事件类型和递增时间戳通常比混合整行更容易编码。" },
              { title: "CPU 批量算", body: "执行器传递一批列数组，让比较、过滤和聚合减少逐行对象构造、类型判断和函数调度。" }
            ]
          },
          {
            type: "distinction",
            title: "三个经常混淆的“块”",
            items: [
              { name: "INSERT Block", definition: "客户端或写入管道交给 ClickHouse 的一批列数据；它可能被按 Partition 拆开并产生多个 Part。" },
              { name: "执行 Block / Chunk", definition: "Processor 之间传递的一批列数据，属于查询运行时结构。" },
              { name: "Compression Block", definition: "磁盘列数据执行压缩和解压的物理块，大小由压缩设置和数据决定。" }
            ]
          },
          {
            type: "callout",
            tone: "key",
            title: "向量化友好，不等于所有函数都一定使用 SIMD",
            body: "更准确的表述是：ClickHouse 一次处理一批同类型值，这种模型利于编译器自动向量化和手写 SIMD 内核。但复杂字符串函数、分支密集逻辑或用户自定义表达式未必能获得同样收益。"
          },
          {
            type: "table",
            title: "哪些查询会削弱列存优势",
            headers: ["查询形态", "为什么收益下降", "应考虑什么"],
            rows: [
              ["SELECT * 点查一行", "必须读取大量列，且 Granule/压缩块仍可能带来读取放大", "若高频发生，评估 OLTP、Dictionary 或专用 KV"],
              ["高基数 GROUP BY", "哈希表键和聚合状态可能远大于压缩输入", "预聚合、顺序聚合、外部聚合"],
              ["大表对大表 JOIN", "构建侧内存和网络可能成为主成本", "共置数据、换算法、Dictionary 或数据建模"],
              ["全局排序无 LIMIT", "必须保留和比较大量中间数据", "排序键、LIMIT、外部排序与需求重构"]
            ]
          },
          {
            type: "details",
            title: "继续深入：压缩为什么还能提高查询速度？",
            paragraphs: [
              "压缩增加了解压 CPU，但显著减少磁盘和远端对象存储需要传输的字节。在分析系统中，I/O 节省通常足以覆盖高效解压成本。",
              "不同列可以选择不同 Codec。例如递增时间戳适合 Delta 或 DoubleDelta 思路，浮点时序可评估 Gorilla，通用压缩常用 ZSTD。Codec 选择必须用真实数据与查询验证。",
              "压缩比并不是唯一目标。过重压缩可能降低实时查询速度；热数据、冷数据和对象存储可以采用不同策略。"
            ]
          }
        ],
        recap: [
          "列存先减少无关列 I/O，再利用同类型数据压缩和批量执行。",
          "磁盘 Compression Block 与查询执行 Block/Chunk 不是同一个结构。",
          "读取少不等于计算少；聚合、JOIN、排序仍可能成为主要成本。"
        ],
        quiz: [
          {
            level: "识别",
            question: "贯穿查询没有使用 payload，列式布局的理想行为是什么？",
            options: ["读取后立刻丢弃 payload", "完全不读取和解压 payload 列", "把 payload 转成主键", "先复制到 Keeper"],
            answer: 1,
            explanation: "列裁剪应尽量让无关列不进入磁盘读取、解压和内存传输路径。",
            misconception: "读取后丢弃仍然支付了主要 I/O 成本。"
          },
          {
            level: "应用",
            question: "下列哪一组概念处于不同层次，不能混为一谈？",
            options: ["列式布局、Compression Block、执行 Chunk", "tenant_id、UInt32、42", "SQL、SELECT、WHERE", "CPU、内存、磁盘"],
            answer: 0,
            explanation: "它们分别描述磁盘逻辑布局、物理压缩边界和执行器批次。",
            misconception: "ClickHouse 文档和日志中多处出现 Block，必须结合语境判断。"
          },
          {
            level: "推理",
            question: "为什么读取 20 MB 的查询仍可能消耗数十 GB 内存？",
            options: ["压缩文件会自动放大一千倍", "高基数 GROUP BY 或 JOIN 哈希表可能保存大量键与状态", "列存不能释放内存", "所有列都会被隐式读取"],
            answer: 1,
            explanation: "执行状态的大小由键数量、状态结构和算法决定，不等于压缩输入字节数。",
            misconception: "I/O 成本与内存状态成本必须分别建模。"
          }
        ]
      },

      {
        id: 2,
        unit: "单元 2 · 数据如何落盘",
        title: "一批 INSERT 如何被拆分、排序并变成不可变 Part？",
        shortTitle: "从 INSERT 到 Part",
        duration: "约 18 分钟",
        prerequisite: "理解列式布局和批量写入的价值。",
        terms: ["Block", "Partition", "Part", "ORDER BY", "MergeTree"],
        goals: [
          "描述一批 INSERT 从内存数据到 Active Part 的完整路径。",
          "理解一次 INSERT 为什么可能生成多个 Part。",
          "区分 Partition、Part 与 Shard。"
        ],
        thesis: "MergeTree 的写入不是不断修改旧文件，而是把每批数据按 Partition 拆分、按 ORDER BY 排序，并生成新的不可变 Part。",
        sections: [
          {
            type: "case",
            title: "逐步建立贯穿表，而不是背一份 DDL",
            paragraphs: [
              "我们的主查询总是先限定 tenant_id，再限定 event_type 和时间范围。原始事件主要追加写入，历史数据按月管理。",
              "因此先得到一个候选结构。它不是普适最佳实践，而是当前工作负载假设的结果。"
            ],
            query: [
              "CREATE TABLE events",
              "(",
              "    event_id UInt64,",
              "    event_time DateTime64(3),",
              "    tenant_id UInt32,",
              "    user_id UInt64,",
              "    event_type LowCardinality(String),",
              "    country LowCardinality(String),",
              "    revenue Decimal(12, 2),",
              "    payload String,",
              "    version UInt64 DEFAULT 1",
              ")",
              "ENGINE = MergeTree",
              "PARTITION BY toYYYYMM(event_time)",
              "ORDER BY (tenant_id, event_type, event_time, event_id)",
              "PRIMARY KEY (tenant_id, event_type, event_time);"
            ]
          },
          {
            type: "steps",
            title: "一次 INSERT 的落盘过程",
            steps: [
              { title: "接收一批列数据", body: "客户端最好提交足够大的批次，而不是每行一次 INSERT。服务端也可使用 Async Insert 聚合小请求。" },
              { title: "按 Partition 表达式拆分", body: "同一批中 9 月和 10 月的数据会被拆到不同分区；一个 Part 只能属于一个 Partition。" },
              { title: "分区内按 ORDER BY 排序", body: "tenant_id 相同的数据聚在一起，同租户内再按事件类型、时间和 event_id 排列。" },
              { title: "编码、压缩并写临时 Part", body: "生成列数据、主键索引、Marks、校验和等文件或数据流。" },
              { title: "校验并原子激活", body: "完整 Part 成功后变为 Active；查询不会看到半写入的 Part。" }
            ]
          },
          {
            type: "lab",
            kind: "write-parts",
            title: "实验：批次大小、跨分区与 Part 数量",
            prompt: "调节每批行数、写入次数和跨月比例，观察示意 Part 数量与后台压力。"
          },
          {
            type: "distinction",
            title: "三个看似相似、实际不同的层级",
            items: [
              { name: "Partition", definition: "一张表内部按表达式分组的一批 Part，主要用于生命周期管理和粗粒度裁剪。" },
              { name: "Part", definition: "一次写入或 Merge 生成的不可变物理数据单元，内部已按 ORDER BY 排序。" },
              { name: "Shard", definition: "跨服务器保存不同数据子集的水平分片，属于部署层概念。" }
            ]
          },
          {
            type: "table",
            title: "DDL 每一项解决什么，又没有解决什么",
            headers: ["定义", "当前案例中的目的", "不能误解为"],
            rows: [
              ["PARTITION BY toYYYYMM(event_time)", "按月管理、删除、移动与粗裁剪", "按月分配服务器"],
              ["ORDER BY (tenant_id, event_type, event_time, event_id)", "让常用过滤形成连续键范围", "保证查询输出顺序或全局唯一"],
              ["PRIMARY KEY (tenant_id, event_type, event_time)", "构建更短的稀疏索引", "传统唯一主键"],
              ["LowCardinality(String)", "为低基数字符串采用字典式表示", "所有 String 都应无条件使用"]
            ]
          },
          {
            type: "callout",
            tone: "warning",
            title: "一次 INSERT 不一定只产生一个 Part",
            body: "如果写入数据跨越多个 Partition，通常会为每个涉及的分区分别生成 Part。若一次小 INSERT 同时触及许多高基数分区，Part 数量会被进一步放大。"
          },
          {
            type: "details",
            title: "继续深入：为什么说 Part 是不可变的？",
            paragraphs: [
              "不可变意味着 Part 一旦完成，普通写入不会在原文件中插入新行。新数据生成新 Part，后台 Merge 或 Mutation 再生成替代 Part。",
              "这种模型让查询可以安全读取旧 Part，同时后台构建新 Part；只有新 Part 完整校验后，元数据可见性才切换。",
              "不可变不代表磁盘永远不变。Merge、Mutation、TTL 和复制都会创建、下载或删除 Part，但方式是生成新版本并切换，而不是随意原地修改。"
            ]
          }
        ],
        recap: [
          "一批 INSERT 先按 Partition 拆分，再按 ORDER BY 排序并生成 Part。",
          "Part 是不可变物理单元；Partition 是包含多个 Part 的逻辑生命周期单位。",
          "一次小写入跨多个分区，会同时制造多个小 Part。"
        ],
        quiz: [
          {
            level: "识别",
            question: "一次 INSERT 同时包含 9 月与 10 月数据，表按月分区。最少通常生成多少个 Part？",
            options: ["1 个", "2 个", "取决于 Replica 数量", "一定是 8192 个"],
            answer: 1,
            explanation: "一个 Part 只能属于一个 Partition，所以至少要为两个分区分别生成 Part。",
            misconception: "INSERT 请求边界与 Part 边界不是一一对应。"
          },
          {
            level: "应用",
            question: "为什么当前 ORDER BY 比 ORDER BY event_id 更匹配贯穿查询？",
            options: ["event_id 不能存储", "常用过滤条件从 tenant_id、event_type、event_time 开始", "唯一值不能排序", "ORDER BY 只影响写入速度"],
            answer: 1,
            explanation: "排序键前缀与过滤模式一致，相关数据聚集并能被稀疏索引有效裁剪。",
            misconception: "业务唯一性并不自动等于最有价值的数据布局。"
          },
          {
            level: "推理",
            question: "为什么不可变 Part 有利于读写并发？",
            options: ["查询只需等待全表锁", "后台可构建完整新 Part，查询继续读取旧 Part，最后原子切换", "所有数据只在内存", "Part 不需要校验"],
            answer: 1,
            explanation: "旧 Part 在替代 Part 完整可用前保持稳定，避免查询读取半完成文件。",
            misconception: "不可变模型不是不做重写，而是通过新 Part 完成重写。"
          }
        ]
      },

      {
        id: 3,
        unit: "单元 2 · 数据如何落盘",
        title: "Part、Granule、Mark 与压缩块究竟是什么关系？",
        shortTitle: "拆开一个 Part",
        duration: "约 24 分钟",
        prerequisite: "理解 INSERT 会生成不可变 Part，并知道 ORDER BY 决定 Part 内排序。",
        terms: ["Partition", "Part", "Granule", "Mark", "Compression Block"],
        goals: [
          "建立 Partition → Part → Granule 的包含关系。",
          "区分 Granule、主键索引项、Column Mark 与 Compression Block。",
          "准确解释 Part 的两种“区间”，以及 Granule 为什么不会跨 Part。"
        ],
        thesis: "Part 是独立排序的不可变数据集合；Granule 是 Part 内的逻辑行组；Mark 是列数据位置；Compression Block 是物理压缩边界，四者不能互换。",
        sections: [
          {
            type: "diagram",
            kind: "storage-hierarchy",
            title: "先把层级关系钉牢",
            caption: "包含关系只有 Partition → Part → Granule。Mark 是定位信息，Compression Block 是列数据的物理压缩边界。"
          },
          {
            type: "table",
            title: "四个概念分别回答四个问题",
            headers: ["概念", "它回答的问题", "关键边界"],
            rows: [
              ["Part", "这一批不可变、已排序的数据和元数据在哪里？", "只属于一个 Partition；不同 Part 独立排序"],
              ["Granule", "主键索引和读取调度最小选择到哪一组逻辑行？", "只属于一个 Part，绝不跨 Part"],
              ["Primary-index entry", "这个 Granule 起点附近的排序键是什么？", "稀疏保存，不为每一行建索引"],
              ["Column Mark", "该 Granule 在某列数据流的什么位置？", "通常含压缩文件偏移与解压块内偏移"],
              ["Compression Block", "列数据以什么物理块压缩、读取和解压？", "边界与 Granule 不要求一一对应"]
            ]
          },
          {
            type: "lab",
            kind: "storage-anatomy",
            title: "实验：沿着一条行坐标观察 Granule、Marks 与压缩块",
            prompt: "切换列并点击 Granule。注意竖直 Granule 边界对所有列逻辑对齐，但各列压缩块边界可以不同。"
          },
          {
            type: "steps",
            title: "查询如何从键值走到磁盘字节",
            steps: [
              { title: "每个候选 Part 独立检查", body: "整个表不是一个全局有序文件。存储层会针对每个 Part 的稀疏索引分别计算候选范围。" },
              { title: "主键条件选择 Granule", body: "索引项保存 Granule 起始处的主键元组。系统只排除确定不可能匹配的范围，边界 Granule 仍需读取复核。" },
              { title: "Mark 定位需要的列", body: "对 tenant_id、event_time、revenue 等列分别找到压缩文件偏移和块内偏移。" },
              { title: "读取并解压覆盖范围", body: "物理 I/O 与解压以 Compression Block 为单位，所以可能额外解压一些相邻数据。" },
              { title: "在候选行上执行原始条件", body: "稀疏索引不会漏行，但它可能多读。精确布尔判断仍发生在读取之后。" }
            ]
          },
          {
            type: "distinction",
            title: "Part 的“区间重叠”必须分成两种含义",
            items: [
              { name: "排序键值域", definition: "不同 Active Part 的 ORDER BY 键值范围可以重叠。例如 Part A 的 key 为 10、20、30，Part B 为 15、25、35。查询 key=25 时两个 Part 都可能是候选。" },
              { name: "Part 名称的 block-number 区间", definition: "Part 名称中的 min_block、max_block 表示写入与合并谱系，不是时间或主键范围。同一 Replica、同一 Partition 的一个已提交快照中，Active Part 的谱系区间通常不重叠。" }
            ]
          },
          {
            type: "callout",
            tone: "key",
            title: "Granule 永远不会跨 Part",
            body: "每个 Part 都有自己的排序、主键索引、Marks 和 Granule 边界。Merge 也不是把旧 Granule 原样拼接，而是读取旧 Part、重新归并排序、生成新 Part，并重新划分 Granule 与 Marks。"
          },
          {
            type: "code",
            title: "用小粒度实验观察 Granule 与 Marks",
            code: [
              "CREATE TABLE ch_lab.granule_demo",
              "(",
              "    k UInt32,",
              "    payload String",
              ")",
              "ENGINE = MergeTree",
              "ORDER BY k",
              "SETTINGS",
              "    index_granularity = 4,",
              "    index_granularity_bytes = 0;",
              "",
              "INSERT INTO ch_lab.granule_demo",
              "SELECT number, repeat(toString(number), 4)",
              "FROM numbers(20);",
              "",
              "SELECT name, rows, marks, part_type",
              "FROM system.parts",
              "WHERE database = 'ch_lab'",
              "  AND table = 'granule_demo'",
              "  AND active;"
            ],
            explanation: "这里故意把 Granule 设为 4 行便于观察。生产环境不要因为教学示例而随意调整默认粒度；marks 数也不能用来反推出压缩块数量。"
          },
          {
            type: "details",
            title: "内核深入：为什么 Mark 需要两个偏移？",
            paragraphs: [
              "列数据先写入压缩块。某个 Granule 的起点可能落在一个已解压块的中间，因此只知道压缩文件位置还不够。",
              "Mark 通常需要记录压缩文件中的偏移，以及解压后块内部的偏移。读取器先定位并解压对应块，再跳到块内位置。",
              "复杂类型可能拥有多个子流，Wide Part 也不意味着每个 SQL 列严格只有一个文件。教程中的“一列一条流”只是帮助建立第一层模型。"
            ]
          }
        ],
        recap: [
          "Part 内独立排序，Part 之间的排序键值域可以重叠。",
          "Granule 是 Part 内逻辑行组，永远不跨 Part；Merge 后会重新划分。",
          "Mark 定位列数据，Compression Block 决定物理 I/O 与解压，两者边界不必对齐。"
        ],
        quiz: [
          {
            level: "识别",
            question: "以下哪条包含关系正确？",
            options: ["Partition → Part → Granule", "Part → Partition → Mark", "Granule → Part → Shard", "Compression Block → Partition → Row"],
            answer: 0,
            explanation: "Partition 包含 Part，Part 内划分 Granule。Mark 是位置记录，不是包含关系中的下一层数据。",
            misconception: "不要把物理定位信息当成独立的数据容器。"
          },
          {
            level: "应用",
            question: "两个 Active Part 的 ORDER BY 键值范围是否可以重叠？",
            options: ["绝对不可以", "可以；每个 Part 只保证内部有序", "只有 Keeper 故障时可以", "只有 Granule 跨 Part 时可以"],
            answer: 1,
            explanation: "不同写入批次会分别排序并生成 Part，键值范围重叠完全合法。",
            misconception: "不要把 Active Part 的 block-number 谱系区间与排序键值域混为一谈。"
          },
          {
            level: "推理",
            question: "通过 Mark 定位到一个 Granule 后，为什么仍可能解压额外数据？",
            options: ["Mark 总是错误", "Compression Block 边界与 Granule 不一一对应", "Granule 会跨 Shard", "主键保证唯一"],
            answer: 1,
            explanation: "物理读取和解压按 Compression Block 进行；Granule 是逻辑索引范围，因此边界附近可能产生额外解压。",
            misconception: "逻辑裁剪粒度与物理 I/O 粒度必须分开理解。"
          }
        ]
      },

      {
        id: 4,
        unit: "单元 2 · 数据如何落盘",
        title: "稀疏主键如何排除 Granule，为什么左前缀如此重要？",
        shortTitle: "排序键与索引裁剪",
        duration: "约 23 分钟",
        prerequisite: "理解 Part、Granule、Mark 以及每个 Part 独立排序。",
        terms: ["ORDER BY", "PRIMARY KEY", "Granule", "Mark", "PREWHERE"],
        goals: [
          "理解复合排序键的字典序和左前缀。",
          "沿着 Partition、主键、跳数索引、PREWHERE 解释完整裁剪链路。",
          "能用 EXPLAIN indexes 验证索引是否真的生效。"
        ],
        thesis: "ClickHouse 主键索引不直接找到行，而是保守地证明哪些 Granule 一定不可能命中；排序键与查询模式越匹配，能排除的范围越大。",
        sections: [
          {
            type: "case",
            title: "从贯穿排序键推导，而不是背“低基数放前面”",
            paragraphs: [
              "表按 (tenant_id, event_type, event_time, event_id) 排序。它的含义是：先按租户分段；同一租户内按事件类型分段；同一事件类型内时间连续。",
              "贯穿查询正好给出 tenant_id 等值、event_type 等值和 event_time 范围，因此可以形成狭窄的字典序区间。"
            ],
            query: [
              "WHERE tenant_id = 42",
              "  AND event_type = 'purchase'",
              "  AND event_time >= '2026-10-01'",
              "  AND event_time <  '2026-10-02'"
            ]
          },
          {
            type: "lab",
            kind: "order-key",
            title: "实验：更换 ORDER BY 与过滤条件",
            prompt: "先选择排序键，再选择查询。观察 64 个示意 Granule 中哪些被排除，并阅读等价 EXPLAIN 说明。"
          },
          {
            type: "steps",
            title: "完整的数据裁剪链路",
            steps: [
              { title: "Partition pruning", body: "时间范围对应 202610，其他月份的 Part 先被粗粒度排除。" },
              { title: "Part 元数据", body: "分区、MinMax 和其他 Part 级统计继续判断整个 Part 是否可能命中。" },
              { title: "Primary key / KeyCondition", body: "可利用的 WHERE 或 PREWHERE 条件被转换为键范围，对每个 Part 的 mark 区间做保守排除。" },
              { title: "Data-skipping index", body: "MinMax、Set、Bloom 等索引可按若干主键 Granule 的摘要继续排除数据。" },
              { title: "PREWHERE 分阶段读列", body: "先读较小或过滤性较强的列形成行掩码；完全淘汰的 Granule/范围可跳过后续列，只要范围仍有候选行，country、revenue 或 payload 仍按 Mark 与 Compression Block 边界读取。" },
              { title: "WHERE 与后续算子", body: "在实际行上执行完整条件，再进入聚合、JOIN 或排序。" }
            ]
          },
          {
            type: "distinction",
            title: "ORDER BY 与 PRIMARY KEY 的职责",
            items: [
              { name: "ORDER BY", definition: "决定 Part 内完整物理排序，也决定 Replacing 等引擎判断“相同键”的语义基础。" },
              { name: "PRIMARY KEY", definition: "决定稀疏主键索引保存哪些前缀列。省略时默认等于 ORDER BY；单独定义通常应是排序键前缀。" }
            ]
          },
          {
            type: "callout",
            tone: "warning",
            title: "只过滤排序键第二列，不等于“完全不能用索引”",
            body: "更准确的说法是：由于第二列会在每个第一列取值范围内重新展开，通常只能排除较少范围。ClickHouse 还可能利用单调函数或通用排除搜索，但必须以 EXPLAIN indexes = 1 的真实结果为准。"
          },
          {
            type: "table",
            title: "跳数索引不是传统二级索引",
            headers: ["类型", "保存什么", "适合什么局部性", "常见误用"],
            rows: [
              ["minmax", "范围最小值与最大值", "值在 Granule 中具有范围聚集", "对完全随机分布列期待精准点查"],
              ["set(N)", "有限去重值集合", "每块不同值较少", "高基数且每块几乎都不同"],
              ["Bloom Filter", "概率型成员摘要", "等值、IN、Token 等判断", "范围查询或希望零假阳性"],
              ["token/ngram Bloom", "字符串 Token 或 n-gram 摘要", "文本包含类条件", "所有字符串查询无条件添加"]
            ]
          },
          {
            type: "code",
            title: "用 EXPLAIN 比较前缀条件与后部列条件",
            code: [
              "EXPLAIN PLAN indexes = 1",
              "SELECT count()",
              "FROM ch_lab.pk_demo",
              "WHERE tenant = 2",
              "  AND ts >= 40",
              "  AND ts < 50;",
              "",
              "EXPLAIN PLAN indexes = 1",
              "SELECT count()",
              "FROM ch_lab.pk_demo",
              "WHERE ts >= 40",
              "  AND ts < 50;"
            ],
            explanation: "重点比较 PrimaryKey 下 Granules 的 before/after，而不是预先背固定数值。不同版本、Part 划分和数据分布都会影响结果。"
          },
          {
            type: "details",
            title: "内核深入：保守排除为什么不会漏行？",
            paragraphs: [
              "索引条件只会排除能证明“不可能满足原始谓词”的 mark 区间。无法证明时就保留候选范围，因此可能多读，但不能因为稀疏索引而漏掉真实匹配行。",
              "AND 中可以提取可索引的子条件；OR 如果包含无法约束主键的分支，整体裁剪通常会明显变差。",
              "单调函数、可求原像的表达式和部分类型转换可能参与范围推导。教程图是逻辑模型，实际能力应由目标版本的 EXPLAIN 验证。"
            ]
          }
        ],
        recap: [
          "复合排序键是字典序；有效前缀让查询形成狭窄连续范围。",
          "主键索引做保守 Granule 排除，不提供唯一性和单行定位。",
          "跳数索引与 PREWHERE 是后续减法，不能补救完全错误的 ORDER BY。"
        ],
        quiz: [
          {
            level: "识别",
            question: "对于 ORDER BY (tenant_id, event_type, event_time)，哪个条件通常最匹配？",
            options: ["country='CN'", "event_time>=today()", "tenant_id=42 AND event_type='purchase' AND event_time 范围", "revenue>100"],
            answer: 2,
            explanation: "它从排序键左侧开始给出等值前缀，再给出时间范围。",
            misconception: "高选择性列不一定放在首位；必须结合查询模式和字典序。"
          },
          {
            level: "应用",
            question: "为什么缺少 event_type 条件时，event_time 范围裁剪可能变差？",
            options: ["时间不能排序", "同一 tenant 内先按 event_type 分段，时间在各段内分别展开", "PRIMARY KEY 会失效", "Partition 会自动删除"],
            answer: 1,
            explanation: "缺失中间键时，时间范围可能对应多个不连续段，难以形成一个很窄的字典序区间。",
            misconception: "左前缀不是简单的“只要包含某列就生效”。"
          },
          {
            level: "推理",
            question: "跳数索引文件很小，但查询略慢，最可能的解释是什么？",
            options: ["索引一定损坏", "数据缺少局部相关性，几乎没有 Granule 被排除，却增加了判断成本", "ClickHouse 不支持索引", "Replica 数太少"],
            answer: 1,
            explanation: "跳数索引只有在摘要能经常证明某块不命中时才有收益。",
            misconception: "索引越多不等于越快；每个二级结构都增加写入与维护成本。"
          }
        ]
      },

      {
        id: 5,
        unit: "单元 2 · 数据如何落盘",
        title: "后台 Merge 如何整理 Part，更新、删除与 TTL 又发生在哪里？",
        shortTitle: "Merge、Mutation 与 TTL",
        duration: "约 21 分钟",
        prerequisite: "理解 Part 不可变、不同 Partition 不会相互 Merge。",
        terms: ["Part", "Merge", "Mutation", "Partition"],
        goals: [
          "描述后台 Merge 的选择、归并、原子切换过程。",
          "解释小 Part 为什么会演化为系统性存储债务。",
          "区分 Merge、Mutation、轻量删除、TTL 与 FINAL。"
        ],
        thesis: "MergeTree 把前台写入变成新 Part，把整理、去重、TTL 和部分删除成本推迟到后台；因此后台资源同样属于查询性能模型。",
        sections: [
          {
            type: "steps",
            title: "一次后台 Merge 的完整过程",
            steps: [
              { title: "选择同一 Partition 的候选 Part", body: "调度器根据大小、级别、磁盘空间和后台池资源选择可合并集合；不会跨 Partition 合并。" },
              { title: "多路归并已排序数据", body: "读取输入 Part 的有序流，按 ORDER BY 归并，同时重新编码列、主键索引和 Marks。" },
              { title: "执行引擎特定语义", body: "Replacing、Summing、Aggregating、TTL 和轻量删除清理可能在这一阶段发生。" },
              { title: "生成并校验新 Part", body: "新 Part 完整落盘前，旧 Part 仍可被并发查询读取。" },
              { title: "原子激活并淘汰旧 Part", body: "新 Part 进入 Active 集合，输入 Part 变为 inactive 并在安全时清理。" }
            ]
          },
          {
            type: "lab",
            kind: "merge-lab",
            title: "实验：写入批次如何制造或偿还 Part 债务",
            prompt: "连续制造小 Part，再运行概念 Merge。模拟只表达趋势，不代表真实 Merge 调度时间。"
          },
          {
            type: "table",
            title: "几个容易混在一起的后台机制",
            headers: ["机制", "做什么", "可见性与代价"],
            rows: [
              ["普通 Merge", "多个 Part 重写为更大 Part", "异步；减少碎片、改善压缩，也消耗 I/O 和临时磁盘"],
              ["经典 Mutation", "重写受 UPDATE/DELETE 影响的 Part", "通常异步；大范围变更成本高"],
              ["轻量删除", "先写删除掩码，查询忽略对应行", "逻辑效果先可见，物理清理由后续 Merge 完成"],
              ["TTL", "删除、移动、重压缩或聚合过期数据", "通常由后台任务触发，不保证到期瞬间完成"],
              ["SELECT ... FINAL", "查询时应用部分引擎合并语义", "增加查询 CPU、内存与读取成本"],
              ["OPTIMIZE ... FINAL", "强制更彻底地合并 Part", "重型维护操作，不应作为日常保洁"]
            ]
          },
          {
            type: "case",
            title: "为什么每秒写一行会伤害系统",
            paragraphs: [
              "如果每次 INSERT 只产生一个极小 Part，每秒一次就可能在一天制造 86,400 个写入 Part。后台不仅要合并数据，还要处理文件、元数据、复制任务和校验。",
              "当新 Part 生成速度长期大于 Merge 吞吐，Active Part 持续增加，查询要打开和调度更多数据源，复制队列也会被放大，最终可能触发 Too many parts 保护。"
            ]
          },
          {
            type: "callout",
            tone: "warning",
            title: "后台 Merge 不保证“最终马上只剩一个 Part”",
            body: "大 Part 会受到合并大小、磁盘空间和写放大策略限制。即使系统空闲，也不能把业务正确性建立在某两行一定很快相遇并被 Merge 的假设上。"
          },
          {
            type: "code",
            title: "用系统表区分 Part 与后台任务问题",
            code: [
              "SELECT",
              "    partition,",
              "    count() AS active_parts,",
              "    sum(rows) AS rows,",
              "    formatReadableSize(sum(bytes_on_disk)) AS bytes",
              "FROM system.parts",
              "WHERE active",
              "  AND database = currentDatabase()",
              "  AND table = 'events'",
              "GROUP BY partition",
              "ORDER BY partition;",
              "",
              "SELECT database, table, elapsed, progress, num_parts",
              "FROM system.merges;",
              "",
              "SELECT database, table, mutation_id, command, is_done",
              "FROM system.mutations;"
            ],
            explanation: "先确认是 Part 生成过快、Merge 吞吐不足、Mutation 堵塞，还是磁盘空间与后台资源问题。不要只看一个总耗时。"
          },
          {
            type: "details",
            title: "继续深入：MergeTree 与标准 LSM Tree 有什么相似和不同？",
            paragraphs: [
              "相似点是都采用不可变有序文件和后台 Compaction/Merge 思想，把随机更新转化为顺序写与后台整理。",
              "但 ClickHouse MergeTree 面向列式 OLAP，Part 内保存列数据、稀疏索引和 Marks；它不应被简单描述成带 MemTable 与逐键查询语义的标准 LSM 实现。",
              "把它称为“列式、Part 化、后台合并的存储模型”更准确，也更能解释查询与 Merge 的实际成本。"
            ]
          }
        ],
        recap: [
          "Merge 通过生成新 Part 并原子替换旧 Part，与查询并发。",
          "小批写入会制造文件、元数据、Merge 和复制的复合债务。",
          "Mutation、TTL、FINAL 和 OPTIMIZE FINAL 的执行位置与成本不同。"
        ],
        quiz: [
          {
            level: "识别",
            question: "哪些 Part 可以被普通 Merge 合并？",
            options: ["任意表中的任意 Part", "同一表、同一 Partition 中被策略选中的 Part", "不同 Shard 的 Part", "只有相同文件大小的 Part"],
            answer: 1,
            explanation: "Merge 不跨 Partition，也不会跨表或跨 Shard 直接合并。",
            misconception: "Partition 选择会直接限制哪些版本最终能在后台相遇。"
          },
          {
            level: "应用",
            question: "Active Part 数持续增长，最先应检查什么？",
            options: ["页面主题", "写入批次、分区基数、system.merges 与磁盘吞吐", "增加 PRIMARY KEY 唯一性", "删除 Keeper"],
            answer: 1,
            explanation: "核心问题是 Part 生成速度是否超过 Merge 处理速度，以及为什么。",
            misconception: "直接执行 OPTIMIZE FINAL 可能暂时减少 Part，却掩盖持续制造债务的根因。"
          },
          {
            level: "推理",
            question: "为什么 TTL 到期不等于数据在那个时刻立即从磁盘消失？",
            options: ["TTL 只修改 SQL 文本", "TTL 通常依赖后台 Merge/任务重写或移动数据", "ClickHouse 不支持时间", "Replica 会阻止删除"],
            answer: 1,
            explanation: "TTL 规则需要后台选择和重写相关 Part，因此完成时间受到调度与资源影响。",
            misconception: "业务合规若要求严格时间点删除，需要额外验证和流程，而不能只声明 TTL。"
          }
        ]
      },

      {
        id: 6,
        unit: "单元 3 · 查询如何执行",
        title: "一条 SQL 如何经过 Analyzer，变成可并行的 Processor Pipeline？",
        shortTitle: "从 SQL 到 Pipeline",
        duration: "约 24 分钟",
        prerequisite: "理解 Part、Granule、索引裁剪以及 PREWHERE 的目的。",
        terms: ["Query Plan", "Processor", "PREWHERE", "Block"],
        goals: [
          "按 Parser、Analyzer、Planner、Pipeline、Executor 的顺序解释查询生命周期。",
          "区分 Query Plan、Processor Pipeline 与实际工作线程。",
          "说明 PREWHERE、列裁剪和分阶段读取为什么属于同一条因果链。"
        ],
        thesis: "SQL 不是直接在文件上执行：Analyzer 先把语义变得明确，Planner 组织算子，Pipeline 再把计划展开为处理列式 Chunk 的并行 Processor 图。",
        sections: [
          {
            type: "case",
            title: "同一条贯穿查询，要先回答哪些问题？",
            paragraphs: [
              "用户写下 SQL 时，只表达了想要的结果，没有指定读取几个 Part、由多少线程扫描、先读哪些列，也没有规定聚合状态如何合并。",
              "查询引擎必须先解析名称与类型，再根据表元数据和条件构造读取范围，最后才把工作拆成可运行的并行通道。"
            ],
            query: [
              "SELECT country, sum(revenue) AS gmv",
              "FROM events",
              "WHERE tenant_id = 42",
              "  AND event_type = 'purchase'",
              "  AND event_time >= '2026-10-01'",
              "  AND event_time <  '2026-10-02'",
              "GROUP BY country",
              "ORDER BY gmv DESC;"
            ]
          },
          {
            type: "steps",
            title: "从文本到结果的五个阶段",
            steps: [
              { title: "Parser：识别 SQL 结构", body: "把文本解析成语法树，知道 SELECT、FROM、WHERE、GROUP BY 与函数调用的嵌套关系。此时还没有真正读取数据。" },
              { title: "Analyzer：绑定名称与类型", body: "解析 events、country、sum 等对象，检查作用域与类型，展开别名，并进行安全的常量折叠、表达式化简、列裁剪和谓词处理。" },
              { title: "Planner：形成 Query Plan", body: "选择读取、过滤、聚合、排序等 Plan Step，并把可用条件传给 MergeTree 读取层计算 Part 和 Mark Range。" },
              { title: "Pipeline Builder：展开 Processor 图", body: "一个 Read Step 可以展开成多个并行 Source Processor；局部过滤和聚合也可复制为多条 lane，最终在 Resize 或合并节点汇合。" },
              { title: "Executor：调度运行", body: "工作线程在 Processor 有输入或输出条件满足时执行它，让列式 Chunk 沿 Pipeline 流动，直到结果返回。" }
            ]
          },
          {
            type: "diagram",
            kind: "query-lifecycle",
            title: "计划树与运行时流水线不是同一张图",
            caption: "Plan 描述要做什么；Pipeline 展示多少条 lane 在哪里并行、重分区和汇合；线程是运行时资源，不与 Processor 一一绑定。"
          },
          {
            type: "lab",
            kind: "query-pipeline",
            title: "实验：让一条查询逐阶段亮起来",
            prompt: "依次执行 Parse、Analyze、Prune、Read、PREWHERE、Aggregate 和 Sort。观察每一步的输入列、行数、并行 lane 与输出状态。"
          },
          {
            type: "distinction",
            title: "三个层次必须分清",
            items: [
              { name: "Query Plan", definition: "由 Plan Step 组成，表达读取、过滤、聚合和排序等操作及其依赖关系。" },
              { name: "Processor Pipeline", definition: "由带输入输出端口的 Processor 组成，表达运行时 Chunk 怎样流动、并行和汇合。" },
              { name: "Thread", definition: "执行就绪 Processor 的运行时资源。一个线程会在不同 Processor 间调度，一个 Processor 也不代表永久占用一个线程。" }
            ]
          },
          {
            type: "steps",
            title: "PREWHERE 为什么能少读宽列",
            steps: [
              { title: "索引先确定候选 Mark Range", body: "Partition 与主键裁剪先决定哪些 Granule 值得访问，PREWHERE 不能把已经错误选中的整个数据布局变正确。" },
              { title: "先读过滤列", body: "读取 tenant_id、event_type、event_time 等较小列，计算仍可能匹配的行掩码。" },
              { title: "按存储边界决定后续列读取", body: "只有被 PREWHERE 完全淘汰的 Granule 或读取范围，才能跳过 country、revenue、payload 等后续列；只要一个 Granule 仍有候选行，相关列仍需按 Mark 与 Compression Block 边界读取和解压，并非逐行磁盘跳跃。" },
              { title: "进入剩余算子", body: "完整 WHERE 语义确认后，Chunk 再进入表达式、聚合和排序阶段。" }
            ]
          },
          {
            type: "code",
            title: "从不同角度观察同一查询",
            code: [
              "EXPLAIN PLAN indexes = 1",
              "SELECT country, sum(revenue) AS gmv",
              "FROM events",
              "WHERE tenant_id = 42",
              "  AND event_type = 'purchase'",
              "  AND event_time >= '2026-10-01'",
              "  AND event_time <  '2026-10-02'",
              "GROUP BY country",
              "ORDER BY gmv DESC;",
              "",
              "EXPLAIN PIPELINE",
              "SELECT country, sum(revenue) AS gmv",
              "FROM events",
              "WHERE tenant_id = 42",
              "GROUP BY country;"
            ],
            explanation: "PLAN indexes 关注读取范围怎样缩小；PIPELINE 关注算子怎样展开为并行通道。两者回答的问题不同，应结合真实 query_log 指标验证。"
          },
          {
            type: "callout",
            tone: "warning",
            title: "max_threads 是上限，不是并行度承诺",
            body: "实际 lane 数受到候选 Mark Range、Part 数、数据规模、最小读取粒度、资源调度和汇合节点限制。把 8 改成 64 可能没有收益，也可能放大磁盘与内存争用。"
          },
          {
            type: "details",
            title: "内核深入：为什么说执行模型是向量化友好，而不是逐行解释？",
            paragraphs: [
              "Processor 传递的是一组具有相同行数的列，而不是反复构造完整行对象。过滤可以生成选择掩码，表达式可以对整列执行，聚合可以批量更新状态。",
              "这种布局减少逐行虚函数、类型判断与对象分配，也利于编译器自动向量化和部分手写 SIMD 内核。复杂字符串、分支密集表达式并不保证获得同样收益。",
              "执行 Block/Chunk 是内存中的批次；它与磁盘 Compression Block 和存储 Part 完全不同。"
            ]
          }
        ],
        recap: [
          "Analyzer 负责把名称、类型和表达式语义变得明确，Planner 再组织执行步骤。",
          "Plan 描述操作，Pipeline 展开并行 Processor，线程负责调度就绪工作。",
          "PREWHERE 通过分阶段读列跳过已完全淘汰的读取范围；后续列仍按 Granule、Mark 与 Compression Block 边界读取。"
        ],
        quiz: [
          {
            level: "识别",
            question: "哪一层最直接展示读取、过滤和聚合会展开成多少条并行 lane？",
            options: ["SQL 文本", "Query Pipeline", "Partition 名称", "Keeper 日志"],
            answer: 1,
            explanation: "Pipeline 展示运行时 Processor 的连接、并行与汇合；Plan 更偏向操作结构。",
            misconception: "计划中一个节点不代表运行时只有一个执行通道。"
          },
          {
            level: "应用",
            question: "查询包含很大的 payload，但大多数行会被 tenant_id 排除。PREWHERE 的理想收益是什么？",
            options: ["让 payload 成为主键", "跳过已完全淘汰的 Granule 或范围，对剩余候选范围仍按存储边界读取 payload", "对每个未命中行执行一次磁盘 seek", "把 payload 复制到 Keeper"],
            answer: 1,
            explanation: "PREWHERE 能避免为已完全淘汰的范围读取宽列，但无法把列文件变成逐行随机访问；候选 Granule 仍会触发相应压缩块读取。",
            misconception: "PREWHERE 优化读取阶段和范围，不提供逐行物理 I/O。"
          },
          {
            level: "推理",
            question: "设置 max_threads=64 后仍只有少量并行读取，最合理的解释是什么？",
            options: ["ClickHouse 忽略所有设置", "候选 Mark Range 或数据规模不足以拆成 64 个有效任务", "主键必须唯一", "Replica 数必须等于线程数"],
            answer: 1,
            explanation: "线程设置只是上限；存储任务粒度和 Pipeline 结构决定可利用的实际并行度。",
            misconception: "更多线程不是独立于数据布局和算子结构的免费加速。"
          }
        ]
      },

      {
        id: 7,
        unit: "单元 3 · 查询如何执行",
        title: "聚合、排序、JOIN 与分布式查询，为什么都要区分局部和最终阶段？",
        shortTitle: "重算子与分布式执行",
        duration: "约 27 分钟",
        prerequisite: "理解 Query Plan、Processor Pipeline、并行 lane 与 Chunk。",
        terms: ["Processor", "Distributed", "Shard", "Replica"],
        goals: [
          "解释局部聚合状态如何在最终阶段合并。",
          "理解排序和 JOIN 的主要内存、磁盘及网络成本。",
          "说明 Distributed 查询如何在 Shard 本地计算，再由 Initiator 汇总。"
        ],
        thesis: "大查询的关键不是把原始行尽快拉到一个节点，而是尽量在每条 lane、每个 Shard 先过滤并生成可合并的中间状态，只把必要信息送往最终阶段。",
        sections: [
          {
            type: "steps",
            title: "GROUP BY 为什么天然分成局部与最终阶段",
            steps: [
              { title: "Source Processor 向多条 lane 供数", body: "不同 Source Processor 读取不同 Part 或 Mark Range，后续过滤与局部聚合 Processor 沿各自 lane 消费 Chunk，不需要逐行争抢一个全局哈希表。" },
              { title: "每条 lane 构建 local state", body: "lane A 可能得到 CN:sumState(99)，lane B 得到 CN:sumState(50)。这些是可合并的中间状态，不是最终显示值。" },
              { title: "汇合后执行 merge state", body: "合并 Processor 按 country 合并来自各 lane 的状态，得到 CN:sumState(149)；分布式查询还会继续合并各 Shard 返回的状态。" },
              { title: "finalize 生成结果值", body: "最终化阶段把聚合状态转换成用户看到的数值 CN:149，之后才进入最终表达式、ORDER BY 与结果编码。普通 sum() 会隐式完成，显式 State/Merge 函数则由 SQL 控制。" },
              { title: "必要时外部化", body: "高基数导致状态超出内存阈值时，可把部分聚合数据写盘，用更高延迟换取内存安全。" }
            ]
          },
          {
            type: "lab",
            kind: "operator-cost",
            title: "实验：改变分组基数、JOIN 匹配基数、构建侧和 Shard 数",
            prompt: "观察 local state、merge state、结果 fanout、排序缓冲、网络回传行数与 Initiator 内存如何变化。模拟值用于说明成本方向，不是性能承诺。"
          },
          {
            type: "table",
            title: "三个重算子分别为什么昂贵",
            headers: ["算子", "核心状态", "何时危险", "常用缓解方向"],
            rows: [
              ["GROUP BY", "分组键哈希表与聚合状态", "键基数高、状态大", "预聚合、顺序聚合、两级哈希、外部聚合"],
              ["ORDER BY", "待排序行、局部有序 run 与归并状态", "全局排序且无有效 LIMIT", "利用物理顺序、Top-N、外部排序"],
              ["JOIN", "匹配语义、构建侧哈希表、分桶或排序 run", "重复键 fanout、构建侧大、分布式不共置", "先选正确 INNER/LEFT 与 ALL/ANY，再用 EXPLAIN 验证构建侧和算法"],
              ["最终汇总", "来自所有 lane 或 Shard 的中间状态", "高基数全局结果或大结果集", "远端先聚合、限制结果、调整数据共置"]
            ]
          },
          {
            type: "table",
            title: "先确定 JOIN 结果语义，再讨论算法",
            headers: ["形式", "未匹配左行", "右侧同键有 3 行时", "适用边界"],
            rows: [
              ["INNER ALL JOIN", "丢弃", "产生 3 个匹配结果", "需要所有匹配组合；两侧重复时同键结果可形成 m×n fanout"],
              ["LEFT ALL JOIN", "保留；右列使用默认值，join_use_nulls=1 时使用 NULL", "产生 3 个匹配结果", "既要保留未匹配左行，又要保留全部匹配"],
              ["LEFT ANY JOIN", "保留", "至多选择 1 个匹配结果", "业务确认任意一个匹配都等价；不能拿它代替“最新版本”选择"],
              ["INNER ANY JOIN", "丢弃", "至多选择 1 个匹配结果", "只关心是否有一个匹配且无需右侧全部重复行"]
            ]
          },
          {
            type: "callout",
            tone: "warning",
            title: "重复键 fanout 是结果语义，不是算法故障",
            body: "若左侧某键有 m 行、右侧同键有 n 行，ALL JOIN 可产生 m×n 行。ANY 能限制右侧匹配数量，但选中的行不天然代表最新、最大或确定版本；需要先在右表用 argMax、排序或唯一维表建立明确语义。"
          },
          {
            type: "distinction",
            title: "常见 JOIN 算法的成本模型",
            items: [
              { name: "hash", definition: "经典二表 Hash JOIN 会先把计划中的构建侧放入内存哈希表，再由另一侧探测；很多常见计划把 SQL 右输入作为构建侧，但新分析器/规划器可能重排 JOIN 或调整输入，必须以目标版本的 EXPLAIN PLAN / PIPELINE 为准。" },
              { name: "parallel_hash", definition: "并行构建分区哈希表，提高构建速度，通常付出更多内存和协调成本。" },
              { name: "grace_hash", definition: "双方按哈希分桶，无法留在内存的桶写盘，再逐桶连接。" },
              { name: "full_sorting_merge", definition: "双方按连接键排序后归并；若数据物理顺序已经匹配，可减少排序工作。" },
              { name: "direct", definition: "通过 Dictionary、Join Engine 等键值接口直接查找，速度快但支持的 JOIN 语义受限。" }
            ]
          },
          {
            type: "case",
            title: "同一聚合如何扩展到多个 Shard",
            paragraphs: [
              "查询 Distributed 表时，接收客户端请求的节点成为 Initiator。它把子查询发送到每个相关 Shard，并通常在每个 Shard 选择一个健康 Replica。",
              "每个 Shard 应先完成 Part 裁剪、读取、过滤和 local aggregate，只把 country 与 sumState(revenue) 等中间状态返回。Initiator 执行 merge state，再 finalize 为普通数值，最后完成 ORDER BY。"
            ],
            query: [
              "SELECT country, sum(revenue) AS gmv",
              "FROM events_all",
              "WHERE tenant_id = 42",
              "  AND event_type = 'purchase'",
              "  AND event_time >= '2026-10-01'",
              "  AND event_time <  '2026-10-02'",
              "GROUP BY country",
              "ORDER BY gmv DESC;"
            ]
          },
          {
            type: "steps",
            title: "分布式执行的理想数据流",
            steps: [
              { title: "Initiator 做 Shard 路由", body: "如果分片键和条件允许，可能只访问相关 Shard；否则向全部 Shard 下发。" },
              { title: "远端节点做存储裁剪", body: "每个 Shard 在本地按 Partition、主键和跳数索引排除数据，而不是把所有原始行发回。" },
              { title: "远端节点生成 local state", body: "过滤、表达式和可合并聚合尽量在数据所在节点完成，返回远小于原始行的中间状态。" },
              { title: "Initiator merge 并 finalize", body: "先合并各 Shard 的聚合状态，再最终化为结果值，随后完成全局排序、LIMIT 和结果编码。" }
            ]
          },
          {
            type: "callout",
            tone: "warning",
            title: "Replica 默认主要解决可用性，不会自动分担一条查询",
            body: "普通 Distributed 查询通常每个 Shard 选择一个 Replica。只有启用并正确配置 Parallel Replicas 等能力时，同一 Shard 的多个副本才可能协同扫描。"
          },
          {
            type: "code",
            title: "为高基数计算设置安全边界",
            code: [
              "SET max_bytes_before_external_group_by = 2000000000;",
              "SET max_bytes_before_external_sort = 2000000000;",
              "SET join_algorithm = 'auto';",
              "",
              "SELECT user_id, sum(revenue) AS revenue",
              "FROM events",
              "WHERE event_time >= now() - INTERVAL 30 DAY",
              "GROUP BY user_id",
              "ORDER BY revenue DESC",
              "LIMIT 100;"
            ],
            explanation: "落盘阈值用于避免内存失控，不是免费加速。具体数值必须结合节点内存、并发查询和目标版本验证，不能照抄教学值。"
          },
          {
            type: "details",
            title: "工程边界：分布式 JOIN 何时会失控？",
            paragraphs: [
              "普通分布式 JOIN/IN 可能在每个 Shard 本地执行。只有两侧数据按 JOIN Key 共置时，局部 JOIN 才天然正确且高效。",
              "GLOBAL JOIN/IN 会在 Initiator 计算右侧集合并广播到远端，可能显著增加网络与内存。大型右侧集合不应因为一个 GLOBAL 关键字就被视为安全。",
              "如果只关心是否存在，IN 往往比返回完整右表列更直接；只需一个匹配时可评估 ANY JOIN，但必须先确认任意匹配在业务上等价。构建侧和实际算法应通过 EXPLAIN 验证，不要仅凭 SQL 左右位置推断。"
            ]
          }
        ],
        recap: [
          "聚合按 local state → merge state → finalize 演进；lane、Shard 与 Initiator 可能分别承担这些阶段。",
          "GROUP BY、ORDER BY 与 JOIN 的主要成本来自中间状态，不只来自读取字节。",
          "分布式查询应让过滤和局部计算靠近数据，避免把原始行集中到 Initiator。"
        ],
        quiz: [
          {
            level: "识别",
            question: "四条 lane 都产生 CN 的 sumState，为什么仍需要最终聚合？",
            options: ["主键不唯一", "同一分组的数据分散在多条 lane，必须合并状态", "Compression Block 太大", "Keeper 要求排序"],
            answer: 1,
            explanation: "局部状态只覆盖各自输入范围，最终合并才能得到全局结果。",
            misconception: "并行聚合不是把每个分组永久绑定到一个 Source Processor 或 lane。"
          },
          {
            level: "应用",
            question: "一条左表记录使用 LEFT ALL JOIN，右表同键有 3 条记录。忽略其他过滤时会产生多少条匹配结果？",
            options: ["0 条", "1 条", "3 条", "由 Replica 数决定"],
            answer: 2,
            explanation: "ALL 保留全部匹配组合，因此这一条左记录会与三条右记录分别组合。LEFT 还规定未匹配左记录也要保留。",
            misconception: "算法只改变执行方式，INNER/LEFT 与 ALL/ANY 才定义结果集合。"
          },
          {
            level: "推理",
            question: "分布式 GROUP BY 为什么应尽量在各 Shard 先聚合？",
            options: ["让每个 Shard 返回更多原始行", "减少网络回传与 Initiator 的中间状态", "跳过主键索引", "让 Replica 自动变成 Shard"],
            answer: 1,
            explanation: "可合并聚合状态通常远小于原始行，远端局部聚合能显著降低网络和中心节点压力。",
            misconception: "横向扩展只有在工作也能被下推时才真正有效。"
          }
        ]
      },

      {
        id: 8,
        unit: "单元 4 · 引擎与预计算",
        title: "MergeTree 家族、物化视图与 Projection，分别在解决什么问题？",
        shortTitle: "引擎选择与预计算",
        duration: "约 28 分钟",
        prerequisite: "理解普通 Merge 的异步过程，以及局部聚合状态可以再次合并。",
        terms: ["MergeTree", "Materialized View", "ORDER BY", "Merge"],
        goals: [
          "根据明细、版本去重和聚合状态需求选择 MergeTree 变体。",
          "理解 Replacing、Summing、Aggregating 的语义何时真正生效。",
          "区分 Materialized View、Projection、Distributed 与最终存储表。"
        ],
        thesis: "表引擎定义数据怎样存储以及 Merge 时执行什么语义；预计算结构则用额外写入与存储成本，换取稳定查询模式的低延迟。",
        sections: [
          {
            type: "case",
            title: "先把三类业务需求分开",
            paragraphs: [
              "原始 events 需要完整保存每条事件；上游偶尔会提交同一 event_id 的修正版；报表又反复查询每日租户 GMV。",
              "这三类需求分别对应明细存储、最终版本语义和聚合状态。试图用一张表、一个 FINAL 同时解决，通常会让读写成本与正确性都变得模糊。"
            ],
            query: [
              "-- 原始明细：普通 MergeTree",
              "SELECT * FROM events WHERE event_id = 1002;",
              "",
              "-- 最终版本：按 version 选择",
              "SELECT argMax(revenue, version)",
              "FROM events_latest",
              "WHERE tenant_id = 42 AND event_id = 1002;",
              "",
              "-- 高频报表：读取预聚合状态",
              "SELECT country, sumMerge(gmv)",
              "FROM tenant_daily_gmv",
              "WHERE tenant_id = 42 AND day = '2026-10-01'",
              "GROUP BY country;"
            ]
          },
          {
            type: "lab",
            kind: "engine-selector",
            title: "实验：从业务语义选择引擎和预计算方式",
            prompt: "选择“保留明细、版本修正、可加指标、uniq 状态、Kafka 接入、高可用”等需求，组合合适的本地表、复制引擎、物化视图或 Projection。"
          },
          {
            type: "table",
            title: "MergeTree 家族的核心差异",
            headers: ["引擎", "Merge 时做什么", "查询仍要做什么", "主要风险"],
            rows: [
              ["MergeTree", "仅归并已排序明细", "按业务 SQL 过滤与聚合", "没有版本去重或预聚合语义"],
              ["ReplacingMergeTree(version)", "相同 ORDER BY 键保留选定版本", "Merge 前用 argMax 或按需 FINAL 保证结果", "不是唯一约束；跨 Partition 不会互相替换"],
              ["SummingMergeTree", "相同排序键的指定数值列求和", "仍按键 SUM/GROUP BY 处理未合并 Part", "非加法指标不适合；Merge 异步"],
              ["AggregatingMergeTree", "合并 AggregateFunction 状态", "使用 sumMerge、uniqMerge 等完成结果", "State/Merge 类型必须匹配，建模复杂"],
              ["Collapsing / VersionedCollapsing", "按 sign 与版本折叠状态变化", "遵守严格查询与数据生成规则", "乱序、缺失取消行会让语义难以解释"]
            ]
          },
          {
            type: "steps",
            title: "ReplacingMergeTree 为什么只是最终去重",
            steps: [
              { title: "每次修正仍生成新 Part", body: "event_id=1002 的 version=1 与 version=2 可以暂时同时可见。引擎不会在 INSERT 时全表查找并原地覆盖。" },
              { title: "只有相同排序键才属于候选版本", body: "Replacing 的业务身份由完整 ORDER BY 键决定，不是由 PRIMARY KEY 或某个想象中的唯一键决定。" },
              { title: "相关 Part 被 Merge 时才收敛", body: "后台合并选择不可预测，不能把业务正确性建立在 Merge 已经完成的假设上。" },
              { title: "查询显式保证正确性", body: "小范围可使用 FINAL；大范围通常用 argMax、分层表或上游幂等设计控制成本。" }
            ]
          },
          {
            type: "code",
            title: "为修正版事件建立独立的最终版本表",
            code: [
              "CREATE TABLE events_latest",
              "(",
              "    event_id UInt64,",
              "    tenant_id UInt32,",
              "    event_time DateTime64(3),",
              "    event_type LowCardinality(String),",
              "    country LowCardinality(String),",
              "    revenue Decimal(12, 2),",
              "    version UInt64",
              ")",
              "ENGINE = ReplacingMergeTree(version)",
              "PARTITION BY toYYYYMM(event_time)",
              "ORDER BY (tenant_id, event_id);",
              "",
              "SELECT",
              "    event_id,",
              "    argMax(revenue, version) AS latest_revenue",
              "FROM events_latest",
              "WHERE tenant_id = 42",
              "GROUP BY event_id;"
            ],
            explanation: "如果修正可能改变 event_time 并跨月，两个版本会进入不同 Partition，后台不会让它们相遇。分区设计必须包含这一业务约束。"
          },
          {
            type: "steps",
            title: "物化视图如何维护每日 GMV",
            steps: [
              { title: "原始 INSERT Block 到达 events", body: "物化视图只观察这批新输入，而不是每次重新扫描整张源表；因此它首先要求输入贡献是不可变且只计算一次，或使用可抵消的补偿 Delta。" },
              { title: "SELECT 生成聚合状态", body: "按 day、tenant_id、country 分组，用 sumState(revenue) 生成可合并状态。" },
              { title: "写入 AggregatingMergeTree", body: "目标表保存状态；不同写入批次的同组状态可在 Merge 或查询时继续合并。" },
              { title: "查询使用 sumMerge", body: "读取时合并所有仍分散的状态，得到最终 GMV。" }
            ]
          },
          {
            type: "code",
            title: "真实的聚合状态表与物化视图",
            code: [
              "CREATE TABLE tenant_daily_gmv",
              "(",
              "    day Date,",
              "    tenant_id UInt32,",
              "    country LowCardinality(String),",
              "    gmv AggregateFunction(sum, Decimal(12, 2))",
              ")",
              "ENGINE = AggregatingMergeTree",
              "ORDER BY (tenant_id, day, country);",
              "",
              "CREATE MATERIALIZED VIEW mv_tenant_daily_gmv",
              "TO tenant_daily_gmv",
              "AS",
              "SELECT",
              "    toDate(event_time) AS day,",
              "    tenant_id,",
              "    country,",
              "    sumState(revenue) AS gmv",
              "FROM events",
              "WHERE event_type = 'purchase'",
              "GROUP BY day, tenant_id, country;"
            ],
            explanation: "这个 sumState 管道适用于不可变、幂等的事件贡献，或把修正表达为正负补偿 Delta。视图默认只处理新的 INSERT Block，不会自动回填历史，也不会因源表后续 Mutation 或 ReplacingMergeTree 合并而撤回旧贡献。"
          },
          {
            type: "callout",
            tone: "warning",
            title: "修正版追加会再次累计，Replacing 不会替目标表撤账",
            body: "若 event_id=1002 的 revenue=99 已进入 sumState，随后向 ReplacingMergeTree 追加 version=2、revenue=80，物化视图会再加 80；源表未来只保留新版本，也不会自动从 tenant_daily_gmv 减去旧的 99。应在上游保证事件幂等，发送 -99 与 +80 的补偿 Delta，或按可重算分区重建聚合结果。"
          },
          {
            type: "distinction",
            title: "Materialized View 与 Projection 的边界",
            items: [
              { name: "Materialized View", definition: "把新写入 Block 的转换结果写入独立目标表。生命周期、TTL、权限和查询入口都可独立设计，但必须处理历史回填与一致性。" },
              { name: "Projection", definition: "同一表内部维护的另一种物理表示，可提供替代排序或预聚合；优化器在语义与成本允许时选择，用户仍查询原表。" },
              { name: "Distributed", definition: "集群路由和结果汇总层，不提供 Replacing 或 Aggregating 的本地存储语义。" }
            ]
          },
          {
            type: "code",
            title: "为另一种过滤顺序增加 Projection",
            code: [
              "ALTER TABLE events ADD PROJECTION p_country_time",
              "(",
              "    SELECT",
              "        tenant_id, country, event_time,",
              "        event_type, revenue, event_id",
              "    ORDER BY (tenant_id, country, event_time)",
              ");",
              "",
              "ALTER TABLE events",
              "MATERIALIZE PROJECTION p_country_time;"
            ],
            explanation: "新增 Projection 后，已有 Part 通常需要显式物化；它会增加存储、写入和 Merge 成本，且优化器是否选用必须通过 EXPLAIN projections 验证。"
          },
          {
            type: "callout",
            tone: "warning",
            title: "不要用 FINAL 掩盖不完整的数据模型",
            body: "SELECT ... FINAL 是查询时应用引擎合并语义，可能增加读取、CPU 与内存；OPTIMIZE TABLE ... FINAL 是强制物理合并的重型操作。两者都不应成为每条查询或定时保洁的默认方案。"
          }
        ],
        recap: [
          "普通明细、最终版本和聚合状态是三种不同语义，应分别建模。",
          "MergeTree 变体的结果通常在后台 Merge 中最终收敛，查询不能假设已经合并。",
          "Materialized View 与 Projection 用额外写入和存储换读取速度；sumState 管道还要求不可变/幂等输入或显式补偿修正。"
        ],
        quiz: [
          {
            level: "识别",
            question: "ReplacingMergeTree 用什么判断两行属于同一个替换组？",
            options: ["完整 ORDER BY 键", "任意名为 id 的列", "Partition 名称", "Replica 名称"],
            answer: 0,
            explanation: "Replacing 的同组语义建立在完整排序键相等上，version 用来选择保留版本。",
            misconception: "PRIMARY KEY 不提供唯一约束，也不是独立的去重身份。"
          },
          {
            level: "应用",
            question: "revenue=99 已被物化视图累计，随后同一 event_id 追加新版本 revenue=80。若没有补偿逻辑，目标表会怎样？",
            options: ["自动把 99 替换成 80", "先前 99 与新 80 都会成为累计贡献", "自动删除整个分区", "等待 Keeper 选择版本"],
            answer: 1,
            explanation: "物化视图按 INSERT Block 处理，新版本是又一次输入；源表 Replacing 合并不会向目标聚合表发出撤回事件。",
            misconception: "修正版事件必须幂等化、发送补偿 Delta 或通过重算修复，不能依赖源表最终去重。"
          },
          {
            level: "推理",
            question: "为什么 SummingMergeTree 查询通常仍要 SUM ... GROUP BY？",
            options: ["引擎不支持加法", "相同键可能仍位于尚未互相 Merge 的多个 Part", "PRIMARY KEY 必须唯一", "Compression Block 无法解压"],
            answer: 1,
            explanation: "后台 Merge 异步，查询必须合并仍分散的部分结果，才能保证正确性。",
            misconception: "引擎的 Merge 语义不能被误当作同步写入约束。"
          }
        ]
      },

      {
        id: 9,
        unit: "单元 5 · 集群与一致性",
        title: "Shard、Replica、Distributed 与 Keeper 怎样组成 2×2 集群？",
        shortTitle: "集群拓扑与数据路径",
        duration: "约 26 分钟",
        prerequisite: "理解本地 MergeTree 表、Part 写入与分布式查询的局部/最终阶段。",
        terms: ["Shard", "Replica", "Distributed", "Keeper"],
        goals: [
          "区分容量扩展、在线冗余、查询路由和协调元数据四种职责。",
          "画出 2 Shard × 2 Replica 的写入、复制和查询路径。",
          "根据查询局部性与数据倾斜选择并验证 Sharding Key。"
        ],
        thesis: "Shard 保存不同数据以扩展容量，Replica 保存同一 Shard 的副本以提高可用性，Distributed 负责路由，Keeper 只协调复制与元数据。",
        sections: [
          {
            type: "diagram",
            kind: "cluster-topology",
            title: "2 Shard × 2 Replica：先看职责，不背节点名字",
            caption: "四个 ClickHouse Server 保存两份不同的逻辑分片，每份有两个在线副本；通常另有三个 Keeper 节点形成协调法定多数。"
          },
          {
            type: "lab",
            kind: "cluster-simulator",
            title: "实验：写入、查询与节点故障分别经过哪些组件",
            prompt: "切换 1×1、2×2 和 3×2 拓扑，执行写入、聚合查询与节点故障。观察 Shard 选择、Replica 拉取、局部聚合和 Initiator 汇总。"
          },
          {
            type: "table",
            title: "四个角色各自负责什么",
            headers: ["角色", "保存什么", "解决什么", "不负责什么"],
            rows: [
              ["Shard", "整体数据的不同子集", "容量、写入吞吐、并行计算", "同一数据的冗余"],
              ["Replica", "同一 Shard 的在线副本", "节点故障下的可用性和总体读吞吐", "扩大逻辑数据容量"],
              ["Distributed", "表元数据中引用 cluster name；异步写入时可在发起节点保存待发送队列", "按服务器配置中的集群拓扑路由写入、下发查询并汇总结果", "定义集群拓扑、保存最终业务明细或执行副本复制"],
              ["Keeper", "复制日志、注册、选举和协调元数据", "ReplicatedMergeTree 与分布式 DDL 协调", "保存 Data Part、查询路由、业务备份"]
            ]
          },
          {
            type: "steps",
            title: "一次写入的三段路径",
            steps: [
              { title: "Distributed 选择 Shard", body: "Distributed 表引用服务器配置中的 analytics_cluster，并用 cityHash64(tenant_id) 等 Sharding Key 选择目标 Shard。internal_replication 是该 cluster 的配置项；启用时通常只向该 Shard 的一个 Replica 写入，再由 ReplicatedMergeTree 复制。" },
              { title: "本地 ReplicatedMergeTree 生成 Part", body: "目标 Replica 按 Partition 与 ORDER BY 写成本地 Part，并向 Keeper 提交复制相关元数据。" },
              { title: "其他 Replica 拉取 Part", body: "同 Shard 的其他副本读取复制队列，从已有副本获取并校验实际 Part；业务列数据不经过 Keeper。" }
            ]
          },
          {
            type: "steps",
            title: "一次查询的四段路径",
            steps: [
              { title: "任意入口成为 Initiator", body: "ClickHouse 不需要固定查询主节点。接受客户端请求的 Server 可向远端节点下发子查询。" },
              { title: "每个相关 Shard 选择 Replica", body: "负载均衡策略从健康副本中选择一个；普通情况下不是同时扫描全部副本。" },
              { title: "Shard 本地计算", body: "本地 MergeTree 完成裁剪、读取、过滤与局部聚合，只返回必要行或聚合状态。" },
              { title: "Initiator 最终合并", body: "合并跨 Shard 状态，完成全局 ORDER BY、LIMIT 和结果返回。" }
            ]
          },
          {
            type: "code",
            title: "本地复制表与统一 Distributed 入口",
            code: [
              "CREATE TABLE events_local ON CLUSTER analytics_cluster",
              "(",
              "    event_id UInt64,",
              "    event_time DateTime64(3),",
              "    tenant_id UInt32,",
              "    event_type LowCardinality(String),",
              "    country LowCardinality(String),",
              "    revenue Decimal(12, 2)",
              ")",
              "ENGINE = ReplicatedMergeTree(",
              "    '/clickhouse/tables/{shard}/events_local',",
              "    '{replica}'",
              ")",
              "PARTITION BY toYYYYMM(event_time)",
              "ORDER BY (tenant_id, event_type, event_time, event_id);",
              "",
              "CREATE TABLE events_all ON CLUSTER analytics_cluster",
              "AS events_local",
              "ENGINE = Distributed(",
              "    analytics_cluster,",
              "    default,",
              "    events_local,",
              "    cityHash64(tenant_id)",
              ");"
            ],
            explanation: "Distributed(analytics_cluster, ...) 只引用已存在的 cluster name；Shard、Replica、地址与 internal_replication 定义在服务器集群配置中。数据库名、Keeper 路径和宏也必须由实际环境决定。"
          },
          {
            type: "case",
            title: "为什么 tenant_id 可能是好分片键，也可能是坏分片键",
            paragraphs: [
              "贯穿查询总是指定 tenant_id。若同一租户的数据被固定映射到一个 Shard，查询和按租户 JOIN 具有良好局部性。",
              "但若一个超级租户占总数据 60%，它会独占一个 Shard 的大部分磁盘与计算。分片键必须同时评估查询局部性、基数、长期均匀性和扩容迁移成本。"
            ],
            query: [
              "SELECT",
              "    _shard_num AS shard,",
              "    sum(rows) AS rows",
              "FROM cluster('analytics_cluster', system.parts)",
              "WHERE active AND table = 'events_local'",
              "GROUP BY _shard_num",
              "ORDER BY _shard_num;"
            ],
            explanation: "cluster() 通常每个 Shard 选择一个 Replica，适合估算逻辑分片规模；clusterAllReplicas() 会查询所有 Replica，直接 sum(rows) 会把同一 Shard 的副本重复累计，除非按 hostName()/replica 分开展示。"
          },
          {
            type: "callout",
            tone: "warning",
            title: "新增 Shard 不会自动搬迁历史 Part",
            body: "经典自建集群加入新 Shard 后，新写入可以采用新路由，但旧数据仍留在原 Shard。重分布需要显式迁移、双写或重灌方案，并处理期间的重复与查询一致性。"
          },
          {
            type: "details",
            title: "工程风险：Initiator 与 Distributed 队列",
            paragraphs: [
              "全局高基数聚合、全局排序、大结果集和非共置 JOIN 会把 Initiator 变成 CPU、内存或网络瓶颈。增加 Shard 不能自动消除最终阶段。",
              "Distributed 异步 INSERT 可能先把待发送数据保存在发起节点队列。客户端收到成功的具体含义受设置影响，必须监控发送失败、队列积压和节点磁盘。",
              "ON CLUSTER DDL 依赖协调和每个节点执行，完成状态与业务数据复制是两条不同链路。"
            ]
          }
        ],
        recap: [
          "Shard 拆分不同数据，Replica 复制相同数据，两者解决的问题不同。",
          "Distributed 引用服务器配置中的 cluster name 并负责路由与汇总；ReplicatedMergeTree 才负责 Shard 内 Part 复制。",
          "Keeper 保存协调元数据，不保存业务 Part，也不参与普通数据扫描。"
        ],
        quiz: [
          {
            level: "识别",
            question: "2 Shard × 2 Replica 中有多少份不同逻辑数据子集？",
            options: ["1 份", "2 份", "4 份", "取决于 Keeper 数"],
            answer: 1,
            explanation: "有两个不同 Shard；每个 Shard 再有两个保存相同内容的 Replica。",
            misconception: "四个 Server 不等于四份不同数据。"
          },
          {
            level: "应用",
            question: "Keeper 在复制路径中保存什么？",
            options: ["完整 revenue 列", "复制日志与协调元数据", "所有查询结果", "解压后的 Granule"],
            answer: 1,
            explanation: "实际 Part 在 ClickHouse Replica 之间传输，Keeper 只维护协调状态。",
            misconception: "不要把协调服务设计成业务数据仓库。"
          },
          {
            level: "推理",
            question: "为什么 tenant_id 分片在超级租户场景下可能失衡？",
            options: ["哈希函数不能计算数字", "一个租户的全部数据会稳定落在同一 Shard，形成热点", "Replica 会删除数据", "Partition 会跨服务器合并"],
            answer: 1,
            explanation: "稳定映射带来局部性的同时，也把租户规模倾斜直接映射为 Shard 倾斜。",
            misconception: "高基数不自动等于均匀，必须观察真实频率分布。"
          }
        ]
      },

      {
        id: 10,
        unit: "单元 5 · 集群与一致性",
        title: "复制、Quorum、故障与备份：一次“写入成功”究竟保证到哪里？",
        shortTitle: "一致性、高可用与恢复",
        duration: "约 27 分钟",
        prerequisite: "理解 Shard、Replica、Distributed、Keeper 以及本地 Part 的复制路径。",
        terms: ["Replica", "Keeper", "Quorum", "Distributed"],
        goals: [
          "区分持久性、读取新鲜度、可用性与可恢复性。",
          "解释普通异步复制和 insert_quorum 的确认边界。",
          "分析 Replica、整个 Shard、Keeper 与误操作故障，并选择恢复手段。"
        ],
        thesis: "副本让同一 Shard 在节点故障时仍有在线数据，但复制确认、立刻可见、跨 Shard 原子性和历史恢复是四个不同问题，不能由“有副本”一句话覆盖。",
        sections: [
          {
            type: "table",
            title: "先把四种保证拆开",
            headers: ["问题", "关注点", "主要机制", "Replica 是否足够"],
            rows: [
              ["持久性", "已确认写入在部分故障后是否仍存在", "本地落盘、复制确认、Quorum", "取决于确认边界"],
              ["读取新鲜度", "立即从另一 Replica 是否能看到", "复制延迟、读路由、一致性设置", "异步复制下不保证立刻"],
              ["可用性", "节点故障时能否继续服务", "同 Shard 多 Replica、负载均衡、Keeper 法定多数", "单节点故障通常可以"],
              ["可恢复性", "误删或污染后能否回到历史状态", "独立 Backup、保留策略、恢复演练", "不够；错误也会复制"]
            ]
          },
          {
            type: "lab",
            kind: "consistency-failover",
            title: "实验：在确认链路的不同位置制造故障",
            prompt: "选择普通写入、Quorum 写入或 Distributed 异步写入，再关闭一个 Replica、一个 Shard 或 Keeper 多数。观察客户端是否成功、数据位于哪里、查询能否读到。"
          },
          {
            type: "steps",
            title: "普通复制为什么会出现短暂旧读",
            steps: [
              { title: "Replica A 本地创建并提交 Part", body: "客户端直接写 A 时，默认成功通常首先说明 A 已接受并提交本地写入。" },
              { title: "复制任务进入协调日志", body: "Keeper 保存复制相关元数据，其他 Replica 的队列随后感知任务。" },
              { title: "Replica B 拉取并校验 Part", body: "网络、磁盘和队列负载都会影响完成时间。" },
              { title: "查询被路由到 B", body: "若 B 尚未追上，立即查询可能暂时看不到刚写入事件。这是读取新鲜度问题，不等同于 A 上写入失败。" }
            ]
          },
          {
            type: "case",
            title: "事件 1006 为什么会“写入成功但查询不到”",
            paragraphs: [
              "客户端把 event_id=1006 写到 Shard 1 的 Replica A，随后负载均衡把 SELECT 发到 Replica B。B 的 replication_queue 尚未处理该 Part，于是短时间返回 0 行。",
              "排障时应同时查看写入目标、查询目标和 Replica 延迟，而不是仅凭一次 SELECT 认定数据丢失。"
            ],
            query: [
              "SELECT count()",
              "FROM events_local",
              "WHERE event_id = 1006;",
              "",
              "SELECT",
              "    database, table, is_readonly,",
              "    queue_size, absolute_delay",
              "FROM system.replicas",
              "WHERE table = 'events_local';"
            ]
          },
          {
            type: "steps",
            title: "insert_quorum 改变了什么",
            steps: [
              { title: "发起 Replica 接收写入", body: "数据仍先在目标 Shard 内处理，而不是建立跨所有 Shard 的全局事务。" },
              { title: "等待指定数量副本确认", body: "例如两副本要求 quorum=2，只有两个副本都满足确认条件后才向客户端报告成功。" },
              { title: "故障时可用性下降", body: "若只剩一个可用副本，Quorum 写入可能等待或失败，即使该副本本地磁盘健康。" },
              { title: "读取语义仍需单独设计", body: "Quorum 提高写入确认，不自动把任意负载均衡读取变成通用线性一致读。" }
            ]
          },
          {
            type: "code",
            title: "明确设置并观察 Quorum 写入",
            code: [
              "SET insert_quorum = 2;",
              "SET insert_quorum_timeout = 10000;",
              "",
              "INSERT INTO events_local",
              "(",
              "    event_id, event_time, tenant_id,",
              "    event_type, country, revenue",
              ")",
              "VALUES",
              "(",
              "    1006, now64(3), 42,",
              "    'purchase', 'CN', 20.00",
              ");",
              "",
              "SELECT database, table, replica_name,",
              "       queue_size, absolute_delay",
              "FROM system.replicas",
              "WHERE table = 'events_local';"
            ],
            explanation: "示例假设目标 Shard 至少有两个 Replica。生产超时与 Quorum 应结合网络延迟、故障域、写入吞吐和可用性目标配置。"
          },
          {
            type: "table",
            title: "故障发生时，哪一层还能工作",
            headers: ["故障", "通常仍可做什么", "受影响的部分", "首先查看"],
            rows: [
              ["一个 Replica 下线", "同 Shard 其他 Replica 可继续服务", "Quorum、容量余量、恢复追赶", "system.replicas、replication_queue"],
              ["一个 Shard 所有 Replica 下线", "其他 Shard 可能仍在线", "完整查询和该 Shard 写入", "节点、网络、磁盘、跳过不可用 Shard 设置"],
              ["Keeper 少数节点下线", "有法定多数时继续协调", "容错余量下降", "Keeper 状态与延迟"],
              ["Keeper 失去法定多数", "已有本地 Part 的部分读取可能继续", "需要协调的复制、DDL、写入操作", "Keeper quorum 与连接错误"],
              ["错误 DELETE / Mutation", "副本可能一致地执行错误", "在线所有副本的数据正确性", "Mutation 状态、审计、Backup"]
            ]
          },
          {
            type: "callout",
            tone: "warning",
            title: "Quorum 不是跨 Shard ACID，也不是业务唯一约束",
            body: "一次 Distributed 写入可能涉及多个 Shard，各 Shard 的副本确认不组成通用全局事务。还要区分两种 quorum：Keeper 的 Raft quorum 是协调服务节点的法定多数；insert_quorum 是目标 Shard 中确认数据写入的 Replica 数量，二者彼此独立。网络超时后的客户端重试仍必须有幂等策略。"
          },
          {
            type: "steps",
            title: "备份必须覆盖复制无法覆盖的故障",
            steps: [
              { title: "定义 RPO 与 RTO", body: "先确定最多可丢多少时间的数据、允许多久恢复，才能决定备份频率与介质。" },
              { title: "定义逻辑范围", body: "在某个节点执行 BACKUP TABLE events_local，只覆盖该节点上的本地表，也就是一个 Replica 所属 Shard 的本地数据；完整集群备份必须覆盖每个逻辑 Shard，可使用 ON CLUSTER 或显式编排每 Shard 的健康 Replica。" },
              { title: "备份到独立故障域", body: "不要把唯一备份放在与集群相同磁盘、账号或删除权限边界中。" },
              { title: "记录元数据和依赖", body: "表 DDL、Dictionary、用户权限、配置与对象存储路径都可能是恢复的一部分。" },
              { title: "定期执行恢复演练", body: "BACKUP 成功日志不能证明 RESTORE 后查询正确；应校验行数、时间范围和关键聚合。" }
            ]
          },
          {
            type: "code",
            title: "明确区分本地表备份与全 Cluster 备份",
            code: [
              "-- 只在当前 Server 执行：覆盖这个本地 Replica 的表数据，",
              "-- 不能据此声称已覆盖所有 Shard",
              "BACKUP TABLE default.events_local",
              "TO Disk('backups', 'events/local-shard-check.zip');",
              "",
              "-- 集群范围：命令需要覆盖 cluster 中的节点，",
              "-- 并验证最终备份包含每个逻辑 Shard",
              "BACKUP TABLE default.events_local",
              "ON CLUSTER analytics_cluster",
              "TO Disk('backups', 'events/cluster-2026-10-25.zip');",
              "",
              "-- 恢复演练放在隔离 recovery_cluster：使用独立 Keeper，",
              "-- 或确保 ReplicatedMergeTree 使用全新的 Keeper 命名空间",
              "RESTORE TABLE default.events_local",
              "ON CLUSTER recovery_cluster",
              "FROM Disk('backups', 'events/cluster-2026-10-25.zip');"
            ],
            explanation: "Disk('backups', ...) 必须在参与节点正确配置，目标存储还要满足集群备份的共享或协调要求。ON CLUSTER 不免除范围验证：应确认备份清单覆盖每个 Shard，而不是把多个相同 Replica 当作多个逻辑分片。这里的 recovery_cluster 必须与在线集群隔离，并使用独立 Keeper 或全新 Keeper 路径；不能在原集群仅用 AS 改表名恢复，因为显式 ReplicatedMergeTree 路径不会随表名自动改写，可能与在线 Replica 注册冲突。恢复后再校验每 Shard 行数、时间范围和关键聚合。"
          },
          {
            type: "details",
            title: "边界说明：ClickHouse Cloud 的 SharedMergeTree",
            paragraphs: [
              "ClickHouse Cloud 可使用 SharedMergeTree，把业务数据放在共享对象存储，并由云端架构协调计算副本与元数据。这与经典自建 ReplicatedMergeTree 的节点间 Part 复制模型不同。",
              "不能因为自建环境给 MergeTree 配置了 S3 Disk，就推导出计算节点完全无状态、复制与故障语义自动等同于 Cloud。两种架构应分别学习和验证。"
            ]
          }
        ],
        recap: [
          "写入持久性、Replica 读取新鲜度、服务可用性和历史恢复是不同保证。",
          "insert_quorum 增强 Shard 内数据副本确认；它与 Keeper Raft quorum 的协调法定多数不是一回事。",
          "Replica 不是 Backup；本地表备份也不等于全 Cluster 备份，恢复方案必须覆盖每个逻辑 Shard。"
        ],
        quiz: [
          {
            level: "识别",
            question: "写入 Replica A 成功后，立即查询 B 没看到新事件，最可能是什么？",
            options: ["主键自动删除了事件", "异步复制尚未完成", "Shard 自动重平衡", "Compression Block 无法创建"],
            answer: 1,
            explanation: "A 的本地提交与 B 的复制完成存在时间窗口，应检查 B 的复制队列与延迟。",
            misconception: "一次旧读不能单独证明原始写入丢失。"
          },
          {
            level: "应用",
            question: "两副本集群设置 insert_quorum=2，B 下线后最可能发生什么？",
            options: ["A 无条件立即成功", "写入因无法获得两个确认而等待或失败", "自动创建第三个 Shard", "Keeper 保存完整业务数据"],
            answer: 1,
            explanation: "更强确认要求足够副本在线，因此会降低故障时的写可用性。",
            misconception: "一致性、持久性和可用性之间存在明确取舍。"
          },
          {
            level: "推理",
            question: "为什么三个 Replica 仍不能替代 Backup？",
            options: ["Replica 不保存数据", "误删和错误 Mutation 可传播到全部 Replica，无法提供历史恢复点", "Backup 只保存 SQL", "Replica 不能查询"],
            answer: 1,
            explanation: "副本维护当前在线状态，备份则应在独立故障域保存可恢复的历史版本。",
            misconception: "高可用与灾难恢复是两套目标。"
          }
        ]
      },

      {
        id: 11,
        unit: "单元 6 · 设计与诊断",
        title: "从 Workload 推导 Schema，并用系统表完成一次证据化诊断",
        shortTitle: "综合设计与性能诊所",
        duration: "约 32 分钟",
        prerequisite: "完成前十一课，能够解释 Part、索引、Pipeline、引擎与集群路径。",
        terms: ["ORDER BY", "Partition", "Part", "Distributed", "Materialized View"],
        goals: [
          "从查询、写入、保留和一致性目标推导表结构，而不是套模板。",
          "按扫描、执行、后台存储与复制四层收集证据。",
          "为贯穿业务设计本地表、预聚合、集群与可验证的运维指标。"
        ],
        thesis: "ClickHouse 设计没有脱离 Workload 的最佳答案；专业调优是在同一工作负载上，用 EXPLAIN 和系统表证明哪一层成本最高，再只改变一个关键变量。",
        sections: [
          {
            type: "case",
            title: "终局需求：先把约束写全",
            paragraphs: [
              "平台每天写入 50 亿条事件，主要按 tenant_id、event_type 和时间范围查询；原始明细保留 90 天，每日 GMV 保留两年。客户端可以批量写入，允许秒级复制延迟，单节点故障时仍要服务。",
              "这些约束分别决定排序键、分区与 TTL、预聚合、批次、Replica 数和一致性承诺。任何只讨论某一条 SQL 的设计都不完整。"
            ],
            query: [
              "SELECT country, sum(revenue) AS gmv",
              "FROM events_all",
              "WHERE tenant_id = 42",
              "  AND event_type = 'purchase'",
              "  AND event_time >= '2026-10-01'",
              "  AND event_time <  '2026-10-02'",
              "GROUP BY country",
              "ORDER BY gmv DESC;"
            ]
          },
          {
            type: "lab",
            kind: "architecture-clinic",
            title: "综合实验：设计、压测症状与诊断闭环",
            prompt: "依次选择查询模式、写入批次、保留期、租户倾斜和故障目标。系统生成候选 DDL 与拓扑，再注入慢查询、Part 爆炸或复制积压，让你选择证据和修复顺序。"
          },
          {
            type: "steps",
            title: "从需求推导 Schema 的正确顺序",
            steps: [
              { title: "列出高频查询模板", body: "记录过滤列、等值与范围关系、分组、排序、JOIN 和可接受延迟。不要只收集零散 SQL。" },
              { title: "决定明细粒度与类型", body: "明确一行代表什么事件，选择能表达业务又避免无意义宽度的类型；低基数字符串可评估 LowCardinality。" },
              { title: "用生命周期决定 Partition", body: "90 天明细按月分区便于 TTL 和整月管理；不能仅为了某个 WHERE 条件制造每日或租户级高基数分区。" },
              { title: "用高频过滤决定 ORDER BY", body: "贯穿查询从 tenant_id、event_type 等值开始，再做 event_time 范围，因此选择相同顺序并用 event_id 收尾。" },
              { title: "把稳定重查询变成预计算", body: "每日 GMV 用 Materialized View 写入 AggregatingMergeTree，并设计两年 TTL；不要让每次报表扫描 90 天原始事件。" },
              { title: "最后决定 Shard 与 Replica", body: "根据容量、单租户倾斜、故障域和查询共置选择分片键与副本数，再明确备份和扩容迁移。" }
            ]
          },
          {
            type: "code",
            title: "由 Workload 推导出的候选本地表",
            code: [
              "CREATE TABLE events_local",
              "(",
              "    event_id UInt64,",
              "    event_time DateTime64(3),",
              "    tenant_id UInt32,",
              "    user_id UInt64,",
              "    event_type LowCardinality(String),",
              "    country LowCardinality(String),",
              "    revenue Decimal(12, 2),",
              "    payload String",
              ")",
              "ENGINE = ReplicatedMergeTree(",
              "    '/clickhouse/tables/{shard}/events_local',",
              "    '{replica}'",
              ")",
              "PARTITION BY toYYYYMM(event_time)",
              "ORDER BY (tenant_id, event_type, event_time, event_id)",
              "TTL event_time + INTERVAL 90 DAY DELETE;"
            ],
            explanation: "这是对当前假设的候选答案，不是通用模板。若查询主要按 user_id、trace_id 或地理位置过滤，排序键必须重新推导。TTL 异步执行，磁盘容量不能按到期瞬间删除来计算。"
          },
          {
            type: "table",
            title: "调优优先级：先改变数量级，再改变常数",
            headers: ["优先级", "检查项", "希望降低什么", "不应先做什么"],
            rows: [
              ["1", "只读必要列、删除无效计算", "读取与执行工作总量", "先加线程"],
              ["2", "Partition / ORDER BY 与过滤是否匹配", "Selected Parts 与 Marks", "为每列建跳数索引"],
              ["3", "批量写入、分区基数、Part 大小", "文件、Merge 与复制债务", "定时 OPTIMIZE FINAL"],
              ["4", "GROUP BY、JOIN、排序与网络", "中间状态和 Initiator 压力", "只看 read_bytes"],
              ["5", "MV、Projection、Dictionary、跳数索引", "稳定热点查询成本", "未经验证复制二级结构"],
              ["6", "线程、内存、Codec、硬件", "剩余常数成本与安全边界", "同时修改多个变量"]
            ]
          },
          {
            type: "steps",
            title: "一条慢查询的证据链",
            steps: [
              { title: "锁定 Query ID 与业务基线", body: "记录 query_duration_ms、read_rows、read_bytes、result_rows、memory_usage 和异常，同时写清谓词本应选择多大时间、租户和事件范围；单个计数脱离预期选择性没有诊断意义。" },
              { title: "检查存储裁剪", body: "用 EXPLAIN indexes = 1 比较 Selected Granules/总 Granules，并结合 ProfileEvents SelectedMarks 与代表性好查询基线，判断布局是否真正排除了预期范围。" },
              { title: "检查 Pipeline 与重算子", body: "观察聚合、JOIN、排序和最终汇合；读取很少但内存很高时，重点不再是索引。" },
              { title: "检查后台存储债务", body: "大量小 Part、持续 Merge、Mutation 和磁盘压力会同时拖慢前台读取。" },
              { title: "检查分布式与复制", body: "确认 Shard 倾斜、远端耗时、Initiator 压力与 replication_queue，避免把集群问题误判为 SQL 问题。" },
              { title: "单变量修改并复测", body: "在同一数据、同一并发和相近缓存条件下对比；记录收益与写入、存储副作用。" }
            ]
          },
          {
            type: "code",
            title: "从 system.query_log 找出真正的扫描和状态成本",
            code: [
              "SELECT",
              "    query_id,",
              "    query_duration_ms,",
              "    read_rows,",
              "    formatReadableSize(read_bytes) AS read_bytes,",
              "    result_rows,",
              "    formatReadableSize(memory_usage) AS memory,",
              "    ProfileEvents['SelectedParts'] AS selected_parts,",
              "    ProfileEvents['SelectedMarks'] AS selected_marks,",
              "    query",
              "FROM system.query_log",
              "WHERE type = 'QueryFinish'",
              "  AND event_time >= now() - INTERVAL 1 HOUR",
              "ORDER BY query_duration_ms DESC",
              "LIMIT 20;"
            ],
            explanation: "query_log 通常异步刷入；字段和 ProfileEvents 会随版本、配置和查询类型变化。生产展示 SQL 时还要考虑敏感信息与权限。"
          },
          {
            type: "code",
            title: "判断是小 Part、Merge 还是 Mutation 在欠债",
            code: [
              "SELECT",
              "    partition,",
              "    count() AS active_parts,",
              "    sum(rows) AS rows,",
              "    formatReadableSize(sum(bytes_on_disk)) AS bytes,",
              "    formatReadableSize(sum(bytes_on_disk) / count()) AS avg_part",
              "FROM system.parts",
              "WHERE active",
              "  AND database = currentDatabase()",
              "  AND table = 'events_local'",
              "GROUP BY partition",
              "ORDER BY partition;",
              "",
              "SELECT database, table, elapsed, progress, num_parts",
              "FROM system.merges;",
              "",
              "SELECT database, table, mutation_id, command, is_done, latest_fail_reason",
              "FROM system.mutations",
              "WHERE NOT is_done;"
            ],
            explanation: "Active Part 持续增加说明生成速度长期超过消化速度。平均 Part 很小通常指向小批写入或过细分区，但仍要结合 Merge 资源和磁盘状态。"
          },
          {
            type: "code",
            title: "定位 Replica 积压而不是只看一个延迟数字",
            code: [
              "SELECT",
              "    database, table, replica_name,",
              "    is_readonly, queue_size, inserts_in_queue,",
              "    merges_in_queue, absolute_delay",
              "FROM system.replicas",
              "WHERE table = 'events_local';",
              "",
              "SELECT",
              "    database, table, type, create_time,",
              "    num_tries, last_exception",
              "FROM system.replication_queue",
              "WHERE table = 'events_local'",
              "ORDER BY create_time",
              "LIMIT 50;"
            ],
            explanation: "整体队列指标告诉你是否积压，replication_queue 的任务类型、重试和异常帮助定位网络、磁盘、缺失 Part 或协调问题。"
          },
          {
            type: "case",
            title: "综合病例：本应高度裁剪的查询却选择了几乎全部 Marks",
            paragraphs: [
              "这条查询限定单个 tenant_id、单个 event_type 和一天时间；在与 (tenant_id, event_type, event_time) 匹配的布局上，本应只选择很窄的 Mark 范围。返回 2 行本身不能证明应少读，真正依据是谓词预期选择性与排序键。",
              "先确认查询是否经过 events_all 下发到哪些 Shard，再用 EXPLAIN 比较 Selected Granules/总 Granules。若生产表实际按 event_id 排序，贯穿过滤无法形成狭窄范围，SelectedMarks 会接近候选分区的总 Marks。",
              "修复应优先改变数据布局或通过新表/Projection 提供匹配布局，再比较 SelectedMarks、Selected Granules/总 Granules、read_bytes 与同一查询基线。提高 max_threads 只会让错误扫描更并行。若裁剪已经符合预期但内存仍高，再转向 GROUP BY 基数、JOIN 和最终排序。"
            ],
            query: [
              "EXPLAIN PLAN indexes = 1",
              "SELECT country, sum(revenue)",
              "FROM events_all",
              "WHERE tenant_id = 42",
              "  AND event_type = 'purchase'",
              "  AND event_time >= '2026-10-01'",
              "  AND event_time <  '2026-10-02'",
              "GROUP BY country;"
            ]
          },
          {
            type: "callout",
            tone: "key",
            title: "四组可复用的健康基线",
            body: "裁剪质量看 EXPLAIN 中 Selected Granules/总 Granules、SelectedMarks，并结合谓词预期选择性与代表性历史基线；不能把 read_rows/result_rows 当作通用扫描放大，因为聚合查询本来就可能读取大量行只返回少量结果。Part 健康看每分区 Part 数与平均大小；Merge 债务比较新 Part 生成率和完成率；Shard 倾斜比较最大 Shard 数据量与平均值。"
          },
          {
            type: "details",
            title: "最终架构答卷应明确写出的边界",
            paragraphs: [
              "明细表按月 Partition、按 tenant/event/time 排序，批量写入并保留 90 天；每日 GMV 通过 Materialized View 写入聚合状态表并保留两年。",
              "集群至少采用跨故障域 Replica，按租户分片前先测量大租户倾斜；复制允许秒级延迟，关键写入是否使用 Quorum由业务持久性与可用性目标决定。",
              "备份独立于 Replica，并有实际恢复演练。监控同时覆盖慢查询扫描量、Active Part、Merge/Mutation、Replica 队列、磁盘与 Initiator 资源。",
              "这份答案只对给定 Workload 成立。业务查询或租户分布改变时，应重新从证据推导，而不是继续叠加补丁。"
            ]
          }
        ],
        recap: [
          "Schema 应从查询模式、写入形态、生命周期和一致性目标依次推导。",
          "诊断要跨越裁剪、执行状态、后台存储和分布式复制四层建立证据链。",
          "先减少数量级成本，再调线程和 Codec；每次只改变一个关键变量并复测。"
        ],
        quiz: [
          {
            level: "识别",
            question: "单租户、单事件类型、一天范围的查询在匹配排序键上本应高度裁剪，却选择了候选分区几乎全部 Marks。第一步最应检查什么？",
            options: ["增加 Replica", "EXPLAIN 的 Selected/Total Granules、SelectedMarks 与实际 ORDER BY", "强制 OPTIMIZE FINAL", "只比较 result_rows"],
            answer: 1,
            explanation: "这里已知谓词预期选择性很高，因此 Selected/Total Granules 与 Marks 接近全量才构成异常证据，应先验证排序键和范围推导。",
            misconception: "read_rows/result_rows 不是通用裁剪指标；大聚合可能合法地多读少返。"
          },
          {
            level: "应用",
            question: "一个月分区出现数万个很小 Active Part，Merge 长期繁忙，应优先做什么？",
            options: ["减小批次", "增大或聚合写入批次，并检查分区基数与 Merge 吞吐", "给每列加 Bloom Filter", "增加 SELECT FINAL"],
            answer: 1,
            explanation: "必须先降低 Part 生成率或恢复消化能力，避免持续制造存储债务。",
            misconception: "一次强制合并无法修复持续的小批写入。"
          },
          {
            level: "推理",
            question: "读取字节已经很低，但查询仍因 GROUP BY user_id 内存超限，下一步应关注什么？",
            options: ["继续增加跳数索引", "分组基数、聚合状态、预聚合与外部聚合边界", "修改 Partition 名称", "增加 Keeper 节点保存哈希表"],
            answer: 1,
            explanation: "此时瓶颈位于执行状态而非存储扫描，应改变聚合模型或设置内存安全边界。",
            misconception: "索引只能减少读取范围，不能缩小已经读取数据产生的高基数状态。"
          }
        ]
      }
    ]
  };

})();
