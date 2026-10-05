# PyTorch 模型、分片与部署课程正确性审计

审计日期：2026-10-01（UTC+8）。范围：`content-projects.js` 中的 12 课、48 个章节、36 道单选题。未修改页面、样式或其他课程文件。

结论：完成逐课正文、公式、形状、代码前提与逐题语义核对；修正 3 个实质细节，并补充 2 处版本/运行范围说明。最终审计脚本 **13 组全部通过、311 次已执行断言、0 失败**。其中 202 次覆盖数值、状态、异常边界、分布式行为与官方源码，109 次覆盖 36 题的答案与唯一性登记。断言计数包含课程原有断言和 4 个子进程中的断言，不把手工阅读或未执行的后端算作测试通过。

## 实际执行环境与复现

```bash
.venv/bin/python tests/audit_projects.py
node --check content-projects.js
```

- Python：3.13.5。
- PyTorch：2.14.1+cpu；构建 Git 版本 `5c4886908584029761b579af026dcfb627c84070`。
- GPU：不可用。Gloo：可用，实际启动 4 个本地进程，组成 `(dp=2,tp=2)` CPU DeviceMesh。
- 模型和 export 保存/加载使用内存 `BytesIO`；分布式使用本机 TCP rendezvous，不下载数据集或模型权重。
- 未安装 ONNX、onnxscript、TorchAO，未自动安装这些依赖。未执行 ONNX Runtime 或量化后端。
- 导入 PyTorch 出现“缺少 NumPy”的警告；本次测试不使用 NumPy 互操作，所有列出的测试确实完成。
- 课程的固定源码参考为 PyTorch `0506d907c966a291c92994be69894545d5b8ca2a`，与本地安装构建不同；报告没有将固定引用等同于本地构建版本。

最终输出摘要：

```text
models-1       14      models-2       17
models-3        8      models-4       10
scaling-1       5      scaling-2      36
scaling-3      11      scaling-4      29
deployment-1   11      deployment-2   10
deployment-3    7      deployment-4   44
questions-36  109
TOTAL         311     FAILURES        0
```

`scaling-2` 的 36 次包含 4 次源码/API 检查及 4 个 rank 各 8 次真实 FSDP 断言；它们在 distributed 测试执行后计入最终总数，所以该课即时日志先打印 4，最终 SUMMARY 为 36。

## 发现与修正

| 问题 | 原行为或表达 | 修正及证据 |
|---|---|---|
| FSDP 反向重复聚合 | 生命周期伪代码即使 `reshard_after_forward=False` 也无条件第二次 all-gather | 参数仍保留时直接复用；只有前向释放后才再次聚合。实际 CPU FSDP2 的 True/False 路径分别观察到 **2/1 次** all-gather，输出及 SGD 更新后参数均与非分片基线一致。 |
| 负批大小丢失结果 | `infer_batches(requests, -1)` 的 range 不执行，静默返回空字典 | 入口要求正整数；对 0、-1、1.5 都明确抛出 ValueError。 |
| 重复请求 ID 覆盖 | 用字典保存结果时，重复 ID 覆盖已有响应，与课程要求的请求关联不符 | 要求请求 ID 为唯一字符串；重复 ID 和非字符串 ID 被拒绝。正常尾批、空请求和多种 batch 大小仍通过。 |
| TorchScript 版本边界不够明确 | 原文只说常见于遗留系统 | 明确当前固定源码对 trace/script 的弃用提示，区分“弃用”和“已移除”。本地 trace 实际发出弃用警告，模型仍可执行。 |
| CPU DeviceMesh 的本地形状 | 原示例仅八 GPU `(2,4)`，本地 `[2,8]` | 新增四 CPU `(2,2)` 改写说明：本地为 `[4,8]`，不可沿用八卡形状。四进程 Gloo 实测该布局及通信。 |

另有两个审计器自身预期在首轮校准：官方文档字符串跨行导致一次纯字符串匹配失败；PyTorch 2.14 的导出 guard 抛出 `AssertionError` 而不是某些旧路径的 `RuntimeError`。两者不属于课程原始算法错误，最终检查接受实际接口行为，没有削弱输入边界检查。

## 逐课核验记录

| 课程 | 正文/公式检查 | 实际执行的主要核验 | 限制与结论 |
|---|---|---|---|
| models-1 CNN | NCHW、卷积权重 `[Cout,Cin/groups,Kh,Kw]`、输出 floor 公式、感受野递推、残差投影、BN/GN 统计轴 | 原始残差块输出与反向；普通/带 dilation/带 stride 的三组输出尺寸；groups=2 与手工分组卷积一致；depthwise multiplier=2 参数数；两层 3×3 的梯度支持区域为 5×5 共 25 点；冻结 BN 参数仍更新 buffers，eval 不更新；GroupNorm 不受另一条样本影响 | 理论感受野不等于有效贡献强度；无模型准确率或 GPU 性能结论。 |
| models-2 循环网络 | RNN/LSTM/GRU 状态语义、batch_first 边界、双向终态与逐时刻输出、pack 有效长度、detach | 原始两层双向 LSTM pack/pad；h `[4,3,11]`、输出 `[3,5,22]`、表示 `[3,22]`；未排序长度恢复原顺序；前向终态等于最后有效步前向半部，反向终态等于首步反向半部；增加 4 步值为 1000 的尾部填充不改变 h/c；参数反向有限；RNN/GRU shape；detach 值不变且断图 | 没有声称 pack 自动屏蔽所有下游 loss；零长度样本仍须数据管线处理。 |
| models-3 Embedding | token ID 契约、PAD/UNK、padding_idx 与 mask 的边界、masked mean、交叉熵 logits | 原始分类器训练；追加 PAD 输出不变；PAD 行梯度为零、有效词有梯度；token 顺序打乱不改变均值分类结果；交叉熵等于 log_softmax+NLL；越界 ID 抛异常 | 全 PAD 的基线输出是分类头 bias，不是有效语义；正文明确由数据校验拒绝或制定策略，测试记录这一实际行为。 |
| models-4 迁移与 LoRA | 参数冻结与模块模式区别、`ΔW=(alpha/r)BA`、矩阵方向、参数量、B=0 初始行为 | 原始 LoRA 类；基础 weight/bias 冻结；初始输出相同；首步 A 梯度为 0、B 非零；一次 SGD 后 base 不变；合并权重与未合并输出一致；B 更新后 A 获得梯度；固定 backbone BN 而训练 head | 首步梯度测试用无 weight decay 的 SGD 隔离链式求导；正文已区分 weight decay 对参数的额外影响。 |
| scaling-1 并行轴 | DP/TP/PP/SP 切分对象、W1/W2 数学轴与 nn.Linear 存储轴、部分和、流水线公式前提、SP 与 context parallel 区别 | float64 两层 MLP 四路 TP 的局部乘法求和与完整计算一致；各 rank 结果同形但单 rank 不完整；16 rank 乘积；理想流水线利用率随微批增加 | TP 数学在本进程验证；不把流水线理想公式当成真实吞吐预测。 |
| scaling-2 FSDP/ZeRO | ZeRO 1/2/3 分片对象、完整参数工作集、root 默认、reshard、预取峰值、恢复状态 | 读取本地 fully_shard 官方源码；四个 Gloo rank 上运行两组真实 FSDP2，True/False 分别 2/1 次 all-gather；前向与更新后全部参数匹配 eager | spy 仅计数并继续调用真实 foreach_all_gather，没有替换通信返回值。未运行 DeepSpeed/ZeRO；ZeRO 分类为概念核验。GPU 预取/峰值未测。 |
| scaling-3 显存账本 | 参数/梯度/master/moments 的假设、GB/GiB、重计算与状态保存区别、RNG、offload 带宽下界 | 原始 checkpoint 示例反向；含 Dropout 的 eager 与非重入 checkpoint 在相同 RNG 下输出、输入梯度、所有参数梯度一致；前向次数 1 vs 2；16 B/参数、7B→112 GB、8GB/16GB/s=0.5s | 16 B 是明确列出的配置示例，不宣称所有 BF16/Adam 实现如此。没有 CUDA 显存、PCIe 带宽或 offload 实测。 |
| scaling-4 DeviceMesh | process group 坐标、全局/本地 shape、Replicate/Shard/Partial、重分布语义、collective 一致性 | 实际四 CPU `(2,2)` mesh；DP/TP 成员；全局 `[8,8]`、本地 `[4,8]`；Shard→Replicate 还原完整矩阵；Partial→Replicate 得到各 TP 成员之和 | 八 GPU `(2,4)` 脚本没有实跑；CPU 拓扑差异已明确。未故意制造 collective 死锁。 |
| deployment-1 可靠推理 | eval 与 inference_mode、不变输入契约、输入范围、置信度边界、恢复一致性 | 原始 predict；重复结果；概率和为 1；错误 shape/NaN 被拒绝；eval 仍记录梯度；inference tensor 进入需要保存它的 Linear 反向路径被拒绝；no_grad 特征可训练 head；state_dict 内存保存/安全加载一致 | 不声称随机权重分类器已有任务质量；无设备间精度比较。 |
| deployment-2 export | 动态轴与固定轴、Dim 范围、数据依赖分支、图与运行时边界 | 原始动态 batch 1/4/32 与 eager 一致；batch=33 与 features=7 被拒绝；export.save/load 后 batch 1/7/32 一致；`.item()` 数据分支不能按该严格导出路径捕获 | `Dim` 在本地 2.14.1 仍受支持。未声称所有新旧版本、所有目标运行时均相同；guard 异常类有版本差异。 |
| deployment-3 ONNX/量化 | modern/legacy exporter、dynamic_shapes/dynamic_axes、opset/运行时兼容、量化粒度、静态校准、TorchAO config v2 | 本地 ONNX 签名与源码的 dynamo 默认、2.9 边界；实际 TorchScript trace 的弃用警告与运行；一个浮点量化/反量化舍入误差演示 | ONNX/onnxscript/TorchAO 未装，ONNX 文件、Runtime 输出、量化 kernel 均未执行。舍入演示不冒充 TorchAO 后端验证。 |
| deployment-4 批处理 | 排队/预处理/传输/计算的边界、吞吐分母与分位数、等待窗口、背压、请求关联 | 原始批处理代码；9 条请求含尾批；batch=1/3/20 与逐条输出一致；空请求；0/-1/小数 batch、非字符串/重复 ID 拒绝 | 这是同步计算核心，不是完整 HTTP/动态排队服务。无生产压测、延迟或吞吐声明。 |

## 36 道题逐项审阅

答案按文本登记，不依赖 A/B/C/D 位置。`questions-36` 测试检查四个不同选项、登记答案与实际 answer 索引一致、正确文本仅出现一次；以下理由为人工语义复核，不把文本匹配测试冒充知识推理。

| 题目 | 唯一正确答案 | 核验要点 / 其他选项为何不成立 |
|---|---|---|
| models-1-q1 | 16×16 | 按给定 k=3,s=2,p=1,d=1 代入 floor 公式，实际卷积核验。 |
| models-1-q2 | 5×5 | 两层 3×3 步幅 1 每层增加 2；不是核边长相乘，梯度支持验证。 |
| models-1-q3 | running_mean / running_var | buffers 更新不依赖参数 requires_grad；通道数、模块名等不会因此改变。 |
| models-2-q1 | [4,3,11] | 层数×方向数=4；batch_first 不改变 h_n 轴。 |
| models-2-q2 | 真实有效时间步数 | padding、类别数、隐状态宽度都不是序列长度。 |
| models-2-q3 | 值不变、切断历史图 | detach 不是清零或改权重。 |
| models-3-q1 | [B,T,D] | 查表保留索引张量的 B、T，再增加向量维；[V,D] 是权重表。 |
| models-3-q2 | 有效 token 数 | 分母不能含 padding，追加 PAD 测试支持。 |
| models-3-q3 | 原始 logits | 交叉熵内部做稳定 log-softmax；argmax 不可替代可微分数。 |
| models-4-q1 | 40 | 2×8+12×2，基础参数未计入新增量。 |
| models-4-q2 | train 后将 backbone/BN eval | 学习率不控制前向的运行统计更新。 |
| models-4-q3 | 初始增量为零 | B@A=0，但 B 可获梯度，后续模型能学习。 |
| scaling-1-q1 | 归约求和 | 行切 W2 后各 rank 贡献同一输出的部分和，拼接不对。 |
| scaling-1-q2 | 16 | 独立维度 2×4×2，非加法或最大值。 |
| scaling-1-q3 | 减气泡但有算子效率/激活代价 | “一定线性更快/一定省内存”均过强；不改变 TP 度。 |
| scaling-2-q1 | 梯度 | 经典 ZeRO-1 优化器状态、ZeRO-2 再加梯度、ZeRO-3 再加参数。 |
| scaling-2-q2 | 多层完整参数同时驻留 | 预取扩展瞬时工作集，不增加逻辑参数数目或自动变精度。 |
| scaling-2-q3 | 缺其他分片及训练状态 | 局部分片不能当完整模型；非文件读写位置问题。 |
| scaling-3-q1 | 额外计算换少存激活 | 实际前向次数和梯度等价验证；不是参数或标签改变。 |
| scaling-3-q2 | 0.5 秒 | 给定单位一致，D/B 是单向理论下界。 |
| scaling-3-q3 | 活跃工作集仍在 | empty_cache 不能回收仍被引用的张量。 |
| scaling-4-q1 | [2,8] | 四路 Shard(0) 沿第零轴均分；题目明确八卡示例的 TP=4，不能混用 CPU TP=2。 |
| scaling-4-q2 | 部分结果求和 | Partial(sum) 是未完成归约的贡献，不是普通复制。 |
| scaling-4-q3 | 挂起或超时 | collective 要求成员一致参与；一般不自动缩小 world size。 |
| deployment-1-q1 | 不关闭 autograd | eval 模式与 grad mode 独立，实际检查输出 requires_grad。 |
| deployment-1-q2 | 所需梯度被关闭且 inference tensor 有限制 | 不能把整个训练 head 放进纯推理上下文。 |
| deployment-1-q3 | 固定输入比 logits/类别/指标 | 文件/HTTP/导入成功均不足以证明数值正确。 |
| deployment-2-q1 | 只有 batch 在范围内可变 | 未声明的特征维固定，模型参数/类别不随 batch 改变。 |
| deployment-2-q2 | 分支依赖运行时值 | 一个示例不足以证明未来数据分支，实际严格导出拒绝。 |
| deployment-2-q3 | 边界与最终运行时对照 | 生成产物不代表部署正确，不能省略 eager 基线。 |
| deployment-3-q1 | 生成相应图产物 | 不保证兼容、加速或自动量化。 |
| deployment-3-q2 | 估计激活范围及量化参数 | 校准不改变类别名、层数或自动加位宽。 |
| deployment-3-q3 | 量化配置路径版本 | config version=2 不等于 PyTorch 2.0、包主版本、层数或 GPU 数。 |
| deployment-4-q1 | 效率与排队延迟权衡 | 更大 batch 不保证每条请求更快。 |
| deployment-4-q2 | 尚未完成的 GPU 计算 | CPU 发射耗时不是异步设备完成时间。 |
| deployment-4-q3 | 防止响应错配被汇总掩盖 | 请求 ID 是关联键，不是增加数值精度的输入。 |

## 官方源码依据与版本边界

本次新增核对的固定源码：

- [FSDP2 fully_shard 的 reshard 与 root 默认](https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/distributed/fsdp/_fully_shard/_fully_shard.py)：行 188、191–192 明确保留参数时不重复 all-gather，以及 None 对 root/non-root 的选择。
- [torch.jit.trace 的弃用提示](https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/jit/_trace.py)：行 1007。
- [torch.jit.script 的弃用提示](https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/jit/_script.py)：行 1492。

沿用并复核本地对应接口的课程依据：`conv.py`、`batchnorm.py`、`rnn.py`、`nn/utils/rnn.py`、`sparse.py`、`linear.py`、`utils/checkpoint.py`、`device_mesh.py`、`tensor/_api.py`、`fsdp/_fully_shard/_fsdp_param_group.py`、`autograd/grad_mode.py`、`export/__init__.py`、`onnx/__init__.py`。各课保留已核对的固定 SHA 链接。

[TorchAO quant_api.py 固定版本](https://github.com/pytorch/ao/blob/3972ed015091f659418dedf12edb980a8ca56b53/torchao/quantization/quant_api.py) 的 `Int8DynamicActivationInt8WeightConfig` 默认 `version=2`，该快照显式拒绝 version=1；它仍不构成本地 PyTorch/TorchAO/硬件组合的运行认证。课程保留兼容依赖与设备前提。

## 未执行范围

未运行 CUDA、NCCL、GPU 显存峰值、通信重叠、CPU↔GPU offload、真实流水线调度、DeepSpeed/ZeRO、ONNX 导出或 ONNX Runtime、TorchAO 内核及生产压测。相关内容已经以数学、官方接口或概念边界核对，没有编造性能数字。下一步可在具备相应设备与依赖的环境复用相同的 eager 对照原则进行后端验证。
