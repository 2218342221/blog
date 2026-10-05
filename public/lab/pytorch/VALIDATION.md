# TorchQuest 内容与图解核对记录

这是课程开发阶段的验证记录。下文测试命令用于开发源码；博客仅发布课程运行资源，不包含测试环境。每课的独立 Python 示例仍可在课程页下载并运行。

## 2026-10-05：讲解深化

保留 12 单元、48 课、144 道计分题和 48 张交互图解。所有课程新增具体问题、前置知识、术语解释、图解观察任务、分步代码推导、易错点、开放自测与迁移说明。共 48 个独立 CPU 示例、156 个代码步骤、96 个误区分析和 48 道开放自测。

默认「跟着学」直接显示讲解与完整讲义；步骤切换同步高亮对应代码。代码可以原样下载，浏览器展示的是预期输出，不在浏览器中执行 Python。完整讲解模式可同时展开全部步骤。所有原有用户进度字段和存储键保持兼容。

张量存储、自动微分、多头注意力、DDP 四课扩为 7–8 节完整讲义，新增 13 个排版公式、14 张结构化教学表。当前完整讲义共有 205 节、108 段 Python，另有上述 48 个独立补充示例。

交叉核对修正：

- 注意力权重用分段公式明确禁用位置概率为 0。
- 区分冻结 BatchNorm 参数、train 模式的批统计和 eval 使用的运行统计量；相同完整 batch 的 train 输出不会仅因 running buffer 更新改变。
- 明确矩阵乘法计时包含输出分配，排除的是输入构造等外围工作。
- 自定义算子的 fake 实现按真实规则传播 dtype；补充 bool→int64 类型提升验证与 opcheck。
- `torch.export` 的图约束不能替代业务输入校验。本地 2.14.1 的 `Dim(min=2)` 仍允许 0/1；示例增加显式入口校验与拒绝路径测试。

复现命令：

```bash
python tests/verify_guides.py
python tests/verify_guide_boundaries.py
python tests/verify_guides_projects.py deployment-2
npm test
```

最终版本的全部 48 个独立示例通过 `tests/verify_guides.py` 实际执行与 stdout 逐字对照。fake dtype / opcheck、冻结 BN、相容形状下的错误广播和导出业务边界另有针对性验证。

最终版本的 23 项 Playwright 浏览器测试全部通过，覆盖全部课程的手机布局、分步代码、高亮范围、公式排版、自测、下载，以及原有学习进度与动画功能。

基础审计已适配扩写后的小节，通过 12 课、51 个载入片段和 36 个题目契约；四课新增的 15 个独立 CPU 片段以及真实双进程 DDP 梯度/更新对照已通过。48 课前置依赖没有循环，108 段完整讲义 Python 通过 AST 检查。单进程通信数学模型与真实 Gloo 示例在正文中明确区分，未新增任何 GPU/多机或性能实测的宣称。

以下保留上一轮核对记录，原有数量与环境描述对应 2026-10-01 的版本。

核对日期：2026-10-01（UTC+8）。范围：12 单元、48 课、144 道题、100 段 Python 示例，以及 48 张交互图解的 385 个模式/步骤状态。

## 核对方法

逐课检查公式、轴与形状、梯度流、归约分母、API 前提、代码和题目解析。可执行的 CPU 示例直接从课程内容提取并运行，再与独立的数学或行为参考比较。分布式使用真实本机进程组，不以伪造的通信结果代替验证。

题目答案经过人工逐项推导。自动化答案登记和选项唯一性检查仅保证内容结构与审阅结果一致，不将字符串匹配当作数学证明。

## 已修复的重要细节

| 范围 | 修正 |
| --- | --- |
| 广播与索引 | 修正 `[B,T,D]` 上 `[B]` 在 `B=D` 时误对齐特征轴的解释；明确 storage 索引从 0 开始。 |
| 自回归 loss | 模型内部已移位时不要再次外部移位；PAD/EOS 共用 ID 时使用独立 mask。 |
| 归一化与评估 | 标准化使用 `correction=0` 并拒绝空训练集，避免单行数据 std 为 NaN。评估拒绝空验证集。 |
| Checkpoint | 从保存空优化器状态再原对象加载，改为更新后保存、重建对象、恢复并比较下一步。 |
| SDPA 与 GQA | 加入矩形 `is_causal` 左上对齐的实际反例、正确绝对位置 mask、GQA 整除约束与显式 K/V 重复参考。 |
| DDP | 明确不等 token 全局分母与默认梯度平均；各 rank 使用独立数据，涵盖零 token 场景。 |
| 通信示例 | 等长索引改用 tensor all_gather，去掉不必要的对象序列化与隐式 NumPy 依赖。 |
| FSDP | 前向后保留完整参数时，反向复用它；只有已重新分片时才再次 all-gather。 |
| 推理批处理 | 拒绝负数、零、非整数 batch size，以及重复或非字符串请求 ID。 |
| 自定义算子 | 分开说明 fake 元信息与 schema 的 mutation/alias 契约，补直接官方引用和必要 import。 |
| 图解 | 修正 RNN 结束后仍高亮 PAD、非法 export 输入仍执行、LoRA 省略偏置、卷积感受野术语、DDP 对常数求导和时间轴/等待区间不一致等问题。 |

## 实际验证

### 浏览器与图解

- 18 项 Playwright 测试通过；覆盖学习流程、答题、错题、XP、笔记、备份、阅读模式、全部图解状态及动画控制。
- 每节课都有交互图解；39 类图解合计 385 个模式/步骤状态。
- 每课图解在 390px 手机宽度下不产生页面横向溢出，播放/暂停及步进可操作。
- 核验矩阵乘法、storage 地址/stride、mask、KV 字节数、概率归一化、collective、DDP 分母、量化舍入与批处理延迟。
- 动画默认静止，由用户播放；支持手动步骤和减少动态效果偏好，离开课程会停止旧动画。
- 全部 100 段 Python 通过 AST 语法检查。此项不等于全部示例在原硬件上实跑。

### CPU 与真实多进程

环境：Python 3.13.5、PyTorch 2.14.1+cpu。CUDA 不可用，Gloo 可用。

- 基础 12 课：48 段载入，47 段发生 CPU 计算；唯一 CUDA BF16 分支未进入，另做 CPU 对照。VJP、gradcheck/gradgradcheck、模块注册、loss mask、序列化及恢复通过。
- 训练/Transformer/分布式 12 课：CPU 数值与梯度对照通过；真实 torchrun 两进程验证 SUM/gather/scatter/all-to-all、可微通信、DDP、no_sync、不等/零 token 和采样。
- 模型/规模化/部署 12 课：13 组、311 次断言通过。其中 202 次验证数值、状态、边界、通信或官方源码，109 次检查 36 题的答案登记及选项唯一性。
- 四进程 Gloo 真实执行 DTensor 与 FSDP2；`reshard_after_forward=True/False` 的 all-gather 次数分别为 2/1，输出及更新结果与 eager 一致。
- 数据/性能/实践 12 课：13 组、260 次检查通过（139 次 CPU 数值/状态/边界检查及 121 次题目登记检查）。执行 collate、统计分母、RNG 续接、小批训练、冻结 BN、padding 不变性、NaN 检查、CPU profiler、编译与自定义算子契约，详见扩展审计报告。

### 可下载训练配方

`training_recipe.py` 原实跑记录：训练 loss 从 0.6667 降至 0.1029，合成验证集准确率 95.42%。连续训练 8 轮与训练 5 轮后恢复至第 8 轮的模型、优化器、PyTorch/DataLoader RNG、均值及标准差逐位相同。合成任务验证训练机制，不代表真实数据集效果。

图中真实训练曲线来自上述日志；过拟合对比曲线、性能时间线和激活显存数值均明确标注为示意。

## 未实测范围

GPU、CUDA AMP、Flash Attention kernel、NCCL、多机网络、实际峰值显存和 PCIe/offload 带宽未测。ONNX/onnxscript、TorchAO、torchvision 和 NumPy 未安装，对应完整依赖示例未执行。`torch.compile` 的 CPU eager 后端验证捕获与梯度语义，不证明 Inductor 加速或 GPU 性能。

部分 checkpoint 测试采用真实内存序列化，文件替换动作在测试中模拟；可下载训练配方另有真实磁盘 checkpoint 测试。不同版本、设备、worker 或 world size 仍需在对应环境复验。

## 分项报告与复现

- [基础 12 课与 36 题](audit-foundations.md)
- [训练、Transformer、分布式 12 课与 36 题](audit-distributed.md)
- [模型、规模化、部署 12 课与 36 题](audit-projects.md)
- [数据、性能、实践 12 课与 36 题](audit-extended.md)

```bash
npm test
python tests/audit_foundations.py
python tests/audit_distributed.py
python tests/audit_projects.py
python tests/audit_extended.py
python tests/verify_training.py
```

Python 命令需在已安装 PyTorch 的环境运行；本次使用任务目录下的 `.venv/bin/python`。
