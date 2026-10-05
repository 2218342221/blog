# Extended 课程可复现正确性审计

日期：2026-10-01（UTC+8）。范围：`content-extended.js` 的 data、performance、practical 共 12 课、36 题。测试文件为 `tests/audit_extended.py`；本次仅新增该测试与本报告，不修改课程、页面或其他审计文件。

最终结果：**13 组全部通过，260 次已执行断言/预期异常检查，0 失败**。其中 139 次覆盖实际 CPU 数值、状态、边界与框架行为，121 次检查 36 题的人工答案登记、题数与唯一选项。原课中的 assert 和 assert_close 只增加计数包装，计算仍在真实 PyTorch 上执行。

## 运行与环境

```bash
.venv/bin/python tests/audit_extended.py
```

- Python 3.13.5，PyTorch 2.14.1+cpu，CPU 线程数固定为 1。
- 测试启动时通过 Node 执行原 `content-extended.js` 并导出其数据，动态提取示例及题目，不在测试中复制一份课程实现。
- CUDA 不可用；NumPy 与 torchvision 未安装。没有自动下载依赖、数据集或预训练权重。
- 缺少 NumPy 的导入警告已知；所有声明完成的测试均不需要 NumPy 互操作。
- CPU profiler 提示采集开始前分配的某些内存没有对应释放事件；本次只核对采样阶段、CPU 算子与标记，不据此声称准确覆盖完整进程内存峰值。
- 检查点通过 BytesIO 实际 `torch.save` / `torch.load(weights_only=True)` 往返，无持久 checkpoint 文件。

最终计数：

| 分组 | 断言/预期异常次数 |
|---|---:|
| data-1 | 22 |
| data-2 | 10 |
| data-3 | 12 |
| data-4 | 5 |
| performance-1 | 4 |
| performance-2 | 5 |
| performance-3 | 16 |
| performance-4 | 14 |
| practical-1 | 19 |
| practical-2 | 11 |
| practical-3 | 8 |
| practical-4 | 13 |
| questions-36 | 121 |
| 合计 | **260** |

## 逐课执行证据与边界

| 课程 | 真实执行及结果 | 源码/人工核对及未执行范围 |
|---|---|---|
| data-1 Dataset | 动态执行 Rows 类、样本检查和标准化片段。验证 float32/long 转换、形状匹配；训练均值 `[2,4]`、标准差 `[1,1e-6]`，验证样本按训练统计变成 `[3,0]`；单行训练集采用 correction=0 后标准化为零且无 NaN；空训练集明确拒绝；样本 NaN 被检查捕获。 | 未执行远程流或多 worker 分片。标签语义与按患者/用户划分属于数据契约，不能仅靠 shape 测试证明无泄漏。 |
| data-2 DataLoader | 动态执行 collate：`[[8,12,9],[5,6,0]]`、正确 mask、长度和 labels；用真实 DataLoader、num_workers=0 组 batch；默认 collate 对长度 5/9 的张量报错；空序列可表示为全 false mask、长度 0；persistent_workers=True 且 num_workers=0 明确报错。 | 空序列表示不等于 LSTM pack 接受长度 0。未执行 GPU pinned-memory/H2D 拷贝、persistent worker 的第三方随机增强。 |
| data-3 Sampling/metrics | 原始代码计算类别计数 `[3,1]`、样本权重 `[1/3,1/3,1/3,1]`，两类总权重相同；真实 WeightedRandomSampler 生成合法索引，replacement 允许重复；指标循环实际累计 61/68，结果不是两个 batch accuracy 的平均；空验证集拒绝。 | 类别权重和过采样是否适合某真实业务仍需验证集衡量；没有从几次采样推断精确频率或泛化提升。 |
| data-4 RNG | 从原始 seed 片段中仅剔除 NumPy import/seed，执行 Python 与 PyTorch 部分；动态执行课程的 torch RNG 与 loader Generator 保存/恢复；恢复后接下来的两个随机序列完全相同；重新 manual_seed 回到起点而不匹配中断序列；Python random 状态往返一致。 | 完整 NumPy seed、worker_init_fn 原例未运行。已读取本地 DataLoader.__iter__ 与 worker._worker_loop：persistent iterator 用 `_reset` 复用；init_fn 位于 worker 初始启动路径，ResumeIteration 不重新调用它。没有宣称所有 persistent worker 增强状态都可恢复。 |
| performance-1 Timing | 使用真实 CPU `torch.utils.benchmark.Timer` 计时 10 次矩阵乘法，检查有限正数与重复数；将原 loss 累加片段唯一的 `device="cuda"` 改成 `cpu` 运行，验证数值和及没有 grad_fn。 | 原 CUDA Event/synchronize 片段未执行；CPU Timer 不冒充 GPU 延迟或吞吐。不报告没有代表性工作负载支持的加速比。 |
| performance-2 Profiler | 动态执行原始 schedule(wait=1,warmup=1,active=3)、record_function、prof.step 逻辑，跑 5 个真实 CPU 前向/反向/SGD 更新；on_trace_ready 调用一次，采集到 3 个 train_step 和真实 aten 算子。 | 仅将 `export_chrome_trace` 的磁盘输出端替换为保留真实 events 的回调；profiler 自身没有被模拟。未生成 trace.json 文件，未采集 CUDA 活动或证明性能优化。 |
| performance-3 Compile | 原 torch.compile 示例只增加 `backend="eager"`；原前向断言通过，并比较输出、loss、输入梯度、4 个参数梯度及 SGD 后参数；动态提取两个分支函数，正/负/零输入输出相同；fullgraph 数据依赖分支确实拒绝捕获。 | backend=eager 验证 Dynamo 捕获与数值/梯度，不是 Inductor 内核优化。本地 2.14 对数据依赖条件抛 UserError，测试也接受其他兼容路径的 Unsupported；没有误把特定异常类写成所有版本保证。 |
| performance-4 custom_op | 原 `lesson::square` 注册及前向运行；空张量、float64、非连续输入均匹配 x*x 且不修改输入；FakeTensorMode 调用真实 fake handler，shape/dtype 正确；原 opcheck 的 schema、autograd_registration、faketensor、aot_dispatch_dynamic 四项成功；requires_grad=True 的实际 backward 明确报缺少 autograd formula。 | opcheck 用的是不需要梯度的输入，成功不证明反向已实现。没有注册反向规则，未宣称 gradcheck 成功，也未执行 GPU kernel。 |
| practical-1 Training/resume | 动态运行原 200 步单批训练，loss **0.658033967 → 0.0000513775**，32 个合成样本全部拟合；独立的可恢复 CPU 夹具包含 Dropout、Adam、打乱 Generator，用真实保存/加载比较连续 8 轮与 5+3 轮：参数、Adam step/一二阶矩、最终 logits 逐位一致。 | 该拟合仅验证训练链路，不代表真实任务泛化。恢复夹具是按正文约定构造的独立实验；未冒充 training_recipe.py 的端到端执行。原临时文件 + replace 的文件系统片段未实跑，不能据此认证文件系统原子性或故障耐受性。 |
| practical-2 Transfer | 动态抽取原文的“冻结参数→替换 fc→优化器只管理 fc→model.eval/fc.train”片段，在 tiny CPU Conv-BN 模型上执行；主干参数和 BN running_mean 不变、分类头确实更新；解冻参数不会自动进入原优化器；重新 model.train 后冻结参数的 BN buffers 仍更新。 | torchvision、ResNet18、预训练下载与 weights.transforms 未执行；替代模型只验证同一 PyTorch 冻结与模式语义，不声称完成真实图像迁移学习。 |
| practical-3 Text | 动态执行原 TextClassifier 和 padding 不变性片段；输出 `[2,3]`；增加 4 个 PAD 输出不变；与手工有效 token 均值一致；PAD embedding 梯度为零，有效词梯度非零；全 PAD 输出等于 head bias。 | 全 PAD 的 clamp 只防止除零，报告保留这一行为，不说它自动完成业务数据校验。未下载 tokenizer 或训练真实中文模型。 |
| practical-4 Debug | 原诊断片段在正常 CPU 模型上得到有限梯度；输入 NaN 在最早检查被拒绝；人为构造前向有限、反向返回 NaN 的算子，被原 detect_anomaly 流程捕获；验证 detach 不保留 grad_fn、空均值为 NaN、稳定交叉熵避免原始 exp 溢出。 | 未制造 CUDA OOM、NCCL 超时或多节点故障，相关部分为明确的机制/诊断顺序核验。 |

## 发现及处理

1. **空验证集分母**：最初 `data-3` 指标示例仅有 `accuracy=correct/count`，会在空集时除零。已向主任务报告，课程所有者添加 `assert count > 0, "验证集不能为空"`。最终测试读取更新后的真实课程并确认明确拒绝；本子任务未编辑课程文件。
2. **标准化边界**：当前课文已有 `correction=0` 和非空训练集断言。实测单行/常量列无 NaN、空训练集拒绝，未发现额外问题。
3. **编译异常类型**：首轮审计器只预期 Unsupported，而安装版对 fullgraph 的数据依赖分支抛 UserError。已调整审计器接受这两类具体编译错误；课程并没有错误地承诺异常类，属于测试版本适配。
4. **依赖与验证范围**：未安装 NumPy/torchvision。测试不使用伪造模块让原例“假装运行”；报告逐处说明完整原例、抽取子集及 CPU 替代夹具。

实际 custom_op 训练拒绝信息：

```text
Trying to backward through lesson.square.default but no autograd formula was registered.
Please use register_autograd to add one.
```

## 36 题人工答案登记

下面每一项都核对了题干范围与其他选项。脚本只负责答案文本与索引、四个不同选项及题数的一致性检查，不把镜像答案匹配描述成自动推理证明。

| ID | 唯一正确答案文本 | 人工核对理由 |
|---|---|---|
| data-1-q1 | 只在训练集上拟合，再用于验证与测试 | 预处理统计也是拟合信息；全量拟合泄漏验证信息，验证独立重估又改变输入变换。 |
| data-1-q2 | 不同 worker 重复遍历同一数据流 | 任意 IterableDataset 的副本不会自动知道业务分区；应按 worker/rank 或源分区处理。 |
| data-1-q3 | 抽样展示图像与对应标签并核对原始记录 | shape 和利用率不能证明语义关联正确；人工核查可发现标签错位。 |
| data-2-q1 | 尝试 stack 时因长度不同报错 | 默认 collate 不自动 padding；真实长度 5/9 的 DataLoader 已验证报错。 |
| data-2-q2 | 使用锁页主机内存辅助 CPU 到 CUDA 的传输 | pinned memory 是主存，不是常驻显存，也不保证完全重叠或确定性。 |
| data-2-q3 | 测量数据等待、进程开销、CPU 竞争和内存占用 | worker 增多有调度和复制成本，数量不是普遍单调优化。 |
| data-3-q1 | 61/68 | 总计 61 次正确、68 个样本；实际指标循环验证，不能平均两个 batch accuracy。 |
| data-3-q2 | 每个可采样样本一个权重 | 采样器选样本索引，类别权重必须经标签映射成样本权重。 |
| data-3-q3 | 相同患者的信息跨集合造成泄漏 | 按行随机切分不能消除同一实体内的相关性。 |
| data-4-q1 | 不能，需要恢复中断时 RNG 状态 | 相同 seed 重启序列；保存的状态才包含已消耗位置，已实测。 |
| data-4-q2 | worker 启动时，跨 epoch 不自动重新初始化 | persistent worker 复用进程；已核对本地 iterator reset 和 worker 初始化源码。 |
| data-4-q3 | 固定 seed 不保证跨平台跨版本逐位一致 | 硬件、实现与归约顺序等仍可能不同，不能推断标签错误。 |
| performance-1-q1 | 可能只测到 CPU 提交时间 | CUDA 异步，CPU 返回不等于设备完成；此机制未用 CPU benchmark 冒充 GPU 实测。 |
| performance-1-q2 | 分别报告首次编译/启动与预热后的稳态性能 | 两种成本适用于不同部署寿命，不能只取其一或每次重启混淆。 |
| performance-1-q3 | 使用更大的 batch 提高了设备利用率，但增加等待 | 吞吐与请求延迟并非同一指标，更大 batch 可以改变两者权衡。 |
| performance-2-q1 | 不可以，父操作已包含子操作 | inclusive total time 重复包含子调用，直接相加重复计数。 |
| performance-2-q2 | 采集调度无法按训练步骤正常推进 | prof.step 明确通知步骤边界；真实 wait/warmup/active 测试覆盖此路径。 |
| performance-2-q3 | 对应检查 CPU 数据读取、拷贝和同步依赖 | GPU 空洞可能是供给/依赖问题，不能直接推断需要减少精度或加层。 |
| performance-3-q1 | 首次捕获和编译的成本被后续调用复用 | 首次慢不代表漏算或参数丢失，也不证明稳态一定加速。 |
| performance-3-q2 | 输入 shape、dtype 或被守卫的 Python 值变化 | 这些是执行适用条件；文档标题和注释通常不是计算 guard。 |
| performance-3-q3 | 相同条件下的输出、loss、梯度与参数更新 | 训练语义覆盖完整更新，实际 eager 后端对照已逐项验证。 |
| performance-4-q1 | 普通函数或 Module | 现有算子组合可保留 autograd 和编译能力；无明确收益不需定制 kernel。 |
| performance-4-q2 | fake 执行只有元信息，没有真实数据 | fake shape 推导不能依赖真实值；已在 FakeTensorMode 调用注册 handler。 |
| performance-4-q3 | 不能，还需要参考计算与 gradcheck 等验证 | 本例 opcheck 成功但 backward 拒绝，直接证明两种保证不同。 |
| practical-1-q1 | 标签对齐、梯度链路、参数注册与学习率 | 扩大设备规模不会修复单批训练链路错误。 |
| practical-1-q2 | 比较连续 8 轮与 5 轮后恢复到第 8 轮的结果 | 文件存在不等于状态完整；本次实际比较模型、优化器和输出。 |
| practical-1-q3 | 减少写入中断导致正式 checkpoint 损坏的风险 | 先完整写临时文件再替换可以改善更新边界，但依赖文件系统语义，不提升模型 accuracy。 |
| practical-2-q1 | 不一定，train 模式仍可能更新运行统计 | buffers 不靠参数梯度更新；真实 tiny Conv-BN 实验覆盖。 |
| practical-2-q2 | 该层参数是否被加入优化器的参数组 | 修改 requires_grad 不改变优化器持有的参数集合，已核对对象 ID。 |
| practical-2-q3 | 权重、模型配置、类别映射与匹配的预处理 | 参数与输入/输出契约共同决定推理含义。 |
| practical-3-q1 | 不正确，padding 仍改变平均值的分母 | 加零不改变分子，但增加 Lmax 使表示缩小。 |
| practical-3-q2 | padding、mask 与 pooling 处理是否一致 | 在关闭随机层和规定模型下，无效 PAD 不应改变有效表示。 |
| practical-3-q3 | 分别由有效样本或有效 token 等任务单位决定 | 分母来自任务统计单位，不是统一等于 B、Lmax 或词表大小。 |
| practical-4-q1 | 保存 loss.detach() 或在合适边界记录标量，避免保留计算图 | 实测 detached loss 没有 grad_fn；仍需选择保存设备和统计边界。 |
| practical-4-q2 | 检查其他 rank 是否先发生异常或进入了不同 collective | 等待 rank 的超时可能是另一 rank 最初故障的后果。 |
| practical-4-q3 | 先建立单设备正确基线，再逐项开启优化与并行 | 每次增加一种复杂度保留可对照基线，才可定位差异来源。 |

## 真实执行 / 源码阅读 / 未测的界线

- **真实执行**：当前表格标出的 CPU 张量计算、DataLoader、采样、标准化、RNG、200 步训练、8 vs 5+3 恢复、冻结与 BN、padding、异常反向、CPU Timer、CPU profiler、Dynamo eager 后端、custom_op/fake/opcheck。
- **本地官方源码核对**：`torch.utils.data.DataLoader.__iter__`（persistent iterator 的 `_reset`）、`torch.utils.data._utils.worker._worker_loop`（init_fn 与 ResumeIteration 的位置关系）。文件来自当前安装版 torch；没有冒充另一个固定 commit 的实现。
- **未执行**：NumPy 与 torchvision 原例、预训练权重与 transforms、CUDA events、GPU/NCCL、多进程随机增强完整恢复、Inductor 性能优化、自定义 GPU kernel、真实业务数据指标、Chrome trace 磁盘导出、原子文件替换的故障恢复验证。

报告所有数值都是上述本地教学测试的结果；没有把 CPU 案例、eager 编译后端或替代 backbone 的结果推广为 GPU 性能或生产质量保证。
