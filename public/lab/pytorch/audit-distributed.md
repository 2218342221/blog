# PyTorch 课程正确性审计：训练、Transformer、分布式

审计日期：2026-10-01。范围为 content-distributed.js 的 12 课、36 道题，以及对 content-extended.js 中 performance 4 课的只读复核。

## 结论与验证环境

12 课的核心公式和 36 道题的正确选项逐项核对后均成立。修复了一个实际多进程运行失败，并增强了 checkpoint、矩形因果 mask、GQA 和 DDP 数据/归一化前提的演示。最终自动审计命令退出码为 0。

验证环境为 Python 3.13、PyTorch 2.14.1+cpu、Linux、CUDA 不可用、Gloo 可用。测试使用一个 CPU 线程，并由真正的 torchrun 启动两个独立工作进程。未安装 NumPy；修正后的本组课程示例不依赖 NumPy。

复现（以下命令用于开发源码，静态课程站点不包含测试环境）：

~~~bash
cd /path/to/torchquest-source
.venv/bin/python tests/audit_distributed.py
~~~

仅重新运行分布式部分：

~~~bash
.venv/bin/python -m torch.distributed.run --standalone --nnodes=1 --nproc-per-node=2 tests/audit_distributed.py --worker
~~~

最终输出：

~~~text
Environment: torch=2.14.1+cpu, CUDA=False
PASS test_quiz_contract
PASS test_amp_numeric_and_scaler
PASS test_accumulation
PASS test_optimizer_restore_and_modes
PASS test_attention_masks_and_gradients
PASS test_kv_cache_and_gqa
PASS test_sampling_logprob
PASS Gloo: lesson snippets; all_reduce/all_gather/reduce_scatter/all_to_all; autograd gather; DDP mean; no_sync; uneven/zero tokens; sampler
PASS CPU audit; CUDA, NCCL and GPU performance were not executed.
~~~

测试直接读取并执行课程中的 CPU 示例，而非仅复制另一份实现。分布式示例主体在同一个真正的 Gloo 进程组中执行，初始化与销毁由测试外壳统一负责；各示例的计算、通信与训练主体保持原样。另有独立数学参考检查输出和梯度，避免“能运行”被当作“结果正确”。

## 已完成的修正

| 位置 | 原状与风险 | 修正 | 证据 |
| --- | --- | --- | --- |
| training-3 / 保存与恢复 | 示例在任何更新前保存，AdamW 状态为空；再加载到原对象，无法展示真实恢复 | 先完成更新，保存到 BytesIO；继续训练形成参考；重建模型/优化器/scheduler，恢复随机状态后执行下一步 | 下一步 loss、所有参数、学习率一致；优化器历史非空，恢复后 step=2 |
| transformer-2 / 矩形因果 | 文本要求核对对齐，但没有直接展示错误输出 | 明确 is_causal=True 对矩形使用左上对齐，增加 L=2、S=5、绝对 query 位置 3/4 的反例 | 左上对齐输出 [0,0.5]，正确绝对位置 mask 输出 [1.5,2] |
| transformer-3 / GQA | 只有共享概念，没有明确整除条件与实际 enable_gqa 示例 | 补 Hq 可被 Hkv 整除、K/V head 数相等，并加入 CPU math GQA 与 repeat_interleave 的参考比较 | 4 个 Q head、2 个 KV head 的输出一致；逐 token 缓存与完整因果前向一致 |
| distributed-3 / 数据 | 模型初始化和后续数据都用相同种子，各 rank 的随机输入重复 | 模型经 DDP 对齐后，以 100+rank 生成各 rank 的输入 | 原课程主体在两进程执行通过；独立全局参考使用不同 rank 数据 |
| distributed-3 / 损失系数 | W/N 正确，但容易被无条件套到类别加权或正则项 | 补充未归约 token 总损失的前提；其他目标项单独推导分母与系数 | 不等 token、单 rank 零 token 均与全局参考梯度一致 |
| distributed-4 / sampler 收集 | all_gather_object 在本环境通过 tensor.numpy() 反序列化，实际报 RuntimeError: Numpy is not available | 等长整数索引改用 LongTensor + all_gather，避免不必要的对象序列化和 NumPy 隐式依赖；补不等长时需另行处理的说明 | 原版两个 rank 均失败；修正版实际两进程通过，12 个分配索引包含 11 个唯一样本 |

没有修改 36 道题的答案，因为逐项推导和相关实测未发现错误答案。

## 逐课证据与边界

| 课程 | 已验证内容 | 验证边界 |
| --- | --- | --- |
| training-1 | FP16 max=65504；1e-8 在 FP16 下溢而 BF16 非零；大 logits 直接 exp 溢出；稳定 CE/logsumexp 有限；CPU autocast 输出 BF16、参数仍 FP32；CPU GradScaler 正确放大/还原、裁剪、非有限时跳过更新并降低 scale | CUDA AMP 示例未执行；未评估 GPU Tensor Core、CUDA scaler 路径或加速比 |
| training-2 | 有效计数 2+6 的累积梯度与完整 token 均值参考一致；错误的微批均值再平均确实不同；全部 ignore 的 sum loss=0，保留可反向的零梯度 | 等价性测试使用无 Dropout/BatchNorm 的可加损失；不能据此保证任意网络逐位等价 |
| training-3 | 实际 AdamW 更新后保存，重新建对象恢复，再比较下一步随机数据、loss、参数、scheduler 和 optimizer step | 仅 CPU/PyTorch RNG；不覆盖 CUDA RNG、NumPy/Python random、DataLoader 游标或分片检查点 |
| training-4 | 课程训练代码实跑；仅训练集标准化后均值约 0、标准差约 1；BatchNorm train 更新统计，eval 不更新；no_grad 不改变 training；Dropout eval 为恒等 | 不声称合成数据证明真实任务泛化能力，也未将 8 轮训练作为推荐超参数 |
| transformer-1 | MHA 形状；每行权重和为 1；SDPA 布尔 True 为允许；nn.MultiheadAttention 的 key_padding_mask=True 实测为忽略 | 不覆盖 RoPE/RMSNorm 的完整实现；相关文字为数学/接口审查 |
| transformer-2 | SDPA 与手写注意力前向及 Q/K/V 梯度一致；非方形左上因果反例；绝对位置 mask；单步缓存全部可见；dropout_p 非零仍随机；本 CPU 后端全屏蔽行输出 0，手写 softmax(-inf) 为 NaN | 全屏蔽行行为只报告当前 CPU 后端；未执行 Flash GPU kernel，也未把 CPU 默认后端一概声称为 math |
| transformer-3 | Hq=4/Hkv=2 的显式 math GQA 与复制 K/V 参考一致；逐步写缓存输出与完整因果前向一致；32 层例子按整数计算为 2 GiB，Hkv=32 为 8 GiB | 2 GiB/8 GiB 是公式校验，没有实际分配大缓存；不覆盖页分配、量化 KV、跨设备复制策略 |
| transformer-4 | 实际温度+top-k 采样输出属于候选集；采样分布归一化为 1；原模型与采样 logprob 不同；top-p 最小前缀推导；序列 logprob 之和等于条件概率乘积的对数 | 不保证跨设备/版本固定种子产生同一 token；没有执行完整语言模型生成服务 |
| distributed-1 | 真正 torchrun 两进程的 LOCAL_RANK/RANK/WORLD_SIZE、初始化、SUM=3 和清理；课程主体运行 | 单机 CPU/Gloo；未测多机 rendezvous、防火墙、CUDA 绑定或 NCCL |
| distributed-2 | async all_reduce + wait；all_gather；reduce_scatter；all_to_all；普通 gather 输出没有梯度连接；明确可微 gather 返回跨 rank 累加梯度 6x | 可微辅助封装在当前版本仍能运行但带弃用提示；未测试通信重叠收益、网络带宽或 NCCL stream |
| distributed-3 | 默认 DDP 对本地导数 1/2 取平均得到 1.5；W/N 与全局参考逐参数一致；单 bucket 模型 no_sync 窗口只归约一次；某 rank 两个 microbatch 都零 token 仍参与；全局零 token 全体跳过 | 只覆盖默认平均语义及等价的默认 allreduce hook；join、自定义 hook、复杂参数未使用路径需要独立验证 |
| distributed-4 | sampler 两轮 set_epoch 产生不同顺序；11 个样本补成 12 个索引/11 个唯一值；drop_last=True 共 10 个且唯一；张量 gather 示例成功 | 未故意制造长时间死锁；FSDP/TP 检查点、world-size 改变恢复为接口边界说明 |

## 36 道题逐项核对

选项字母按 A=0、B=1、C=2、D=3。

| 题目 | 正确选项 | 核对依据 |
| --- | --- | --- |
| training-1-q1 | B | BF16/FP32 指数位均 8，BF16 尾数更短；finfo 与下溢例子已跑 |
| training-1-q2 | C | scaled backward → unscale → clip → step；CPU scaler 梯度 [768,1024] 还原为 [6,8] |
| training-1-q3 | C | CE 的输入是 logits；稳定 CE 在大 logits 上有限 |
| training-2-q1 | C | 2×4×8=64；TP 不增加独立样本数 |
| training-2-q2 | B | (8+12)/(2+6)=2.5；均值再平均得到 3 |
| training-2-q3 | B | 每微批 step 会执行四次 AdamW 状态与参数更新 |
| training-3-q1 | B | 权重相同不恢复 AdamW 一阶矩、二阶矩与步数 |
| training-3-q2 | C | 约定按更新计步时只在成功参数更新后推进 |
| training-3-q3 | C | 重建恢复后的后续 loss/参数/LR 对照已执行 |
| training-4-q1 | B | no_grad 下 Dropout 与 BatchNorm 仍保持 train，已验证 |
| training-4-q2 | B | 先划分，再只从训练集拟合预处理参数 |
| training-4-q3 | C | 极小固定集合无法拟合，应先核对训练链路 |
| transformer-1-q1 | B | [5,64]×[64,9]→[5,9]，保留 B/H |
| transformer-1-q2 | C | 每个查询沿键轴归一化，行和为 1 |
| transformer-1-q3 | B | SDPA True 为允许，已对照手写与 MHA 相反约定 |
| transformer-2-q1 | C | Flash 的分块/在线 softmax 避免完整矩阵落入 HBM，不是稀疏近似 |
| transformer-2-q2 | B | 函数直接使用 dropout_p；不同随机种子得到不同结果 |
| transformer-2-q3 | C | 单个最新 query 的有效缓存没有未来位置，全部现有键可见 |
| transformer-3-q1 | B | 复用历史各层 K/V，但当前 query 仍读取历史缓存 |
| transformer-3-q2 | C | 2×32×4×4096×8×128×2=2147483648 bytes=2 GiB |
| transformer-3-q3 | B | 缓存的 head 维使用 Hkv=8，而非 Hq=32 |
| transformer-4-q1 | A | 位置 t 输出预测 t+1；接口内部移位时不能重复做 |
| transformer-4-q2 | B | top-k 改变支持集并重新归一化；两个 logprob 实测不同 |
| transformer-4-q3 | B | 条件概率乘积取 log 后成为条件 logprob 之和 |
| distributed-1-q1 | B | 本机 CUDA 索引应来自 LOCAL_RANK 与可见设备映射 |
| distributed-1-q2 | B | torchrun 只启动/管理进程，不自动为模型包装 DDP |
| distributed-1-q3 | B | 全局独立样本量乘 DP=4，不乘总进程数 16 |
| distributed-2-q1 | B | all_reduce(SUM) 在两个真实 rank 上得到 3 |
| distributed-2-q2 | B | 异步 Work 必须按后端/流语义建立完成依赖 |
| distributed-2-q3 | B | 普通 gather 的输出实际不具有跨 rank 梯度连接 |
| distributed-3-q1 | B | 本地乘 W/N=2/100，DDP 除 W 后得到全局 1/N |
| distributed-3-q2 | C | no_sync 覆盖前向和反向；实际单 bucket 窗口只通信一次 |
| distributed-3-q3 | B | 各 rank 相等不能排除共同的缩放错误；已额外比较全局参考 |
| distributed-4-q1 | B | set_epoch 改变确定性洗牌，实测两轮顺序不同 |
| distributed-4-q2 | C | ceil(11/2)×2=12，唯一元素仍 11 |
| distributed-4-q3 | C | barrier 等待者可能是受害者，应寻找最早异常/协议分叉 |

## performance 四课只读审查

12 道题正确选项均为各课 B、C、D，逐题语义成立。没有修改 content-extended.js。

随后修正的问题：

1. performance-2 原 profiler 示例缺少 import torch，但使用 torch.profiler.schedule。脱离其他隐式全局变量执行时已实际得到 NameError: name 'torch' is not defined。loader/train_step 在正文明确声明由使用者提供，属于已说明的上下文，不应混同为额外 bug。
2. performance-3 的独立 compile 示例同样使用 torch 却没有 import torch，建议补足入口依赖；performance-1 的独立代码块也宜统一标明 torch/闭包/loader 前提。
3. performance-4 建议更明确区分 fake 的 shape/dtype/device/layout 元数据职责与 operator schema/custom_op 的 mutation/alias 契约；不能让读者以为单靠 fake 输出即可声明输入原地写入或别名行为。
4. performance-4 的引用目前只有 profiler/compile，应增加 torch.library、custom_op、register_fake、register_autograd、opcheck 的直接官方来源。

后续核对：上述入口导入与职责表述已修复，并补充 library.html 和 Python custom operators 教程引用。经回查 content-extended.js，确认这些修改已经生效。

实际执行的性能相关语义检查：

- CPU torch.utils.benchmark.Timer 可运行；不把这个小矩阵计时用于性能结论。
- CPU profiler 的 wait=1、warmup=1、active=3，在 5 次 prof.step 后触发一次有效采集回调（165 个事件）。使用内存回调，未生成额外 trace 文件。
- torch.compile(..., backend="eager", fullgraph=True) 的输出和参数/输入梯度与 eager 一致。这验证 Dynamo 捕获与训练语义，不验证默认 Inductor 生成代码或加速。
- 原课程 custom_op、register_fake 和 opcheck 示例在 CPU 实际通过；对 requires_grad=True 输入反向确实因缺少 autograd formula 报错，与课程说明一致。

## 未覆盖的范围与环境提示

- 没有 GPU，因此 CUDA events 的时间、NCCL、Flash Attention GPU kernel、GPU 混合精度吞吐、Tensor Core 和显存峰值均未实测。
- 程序启动时仍会出现可选 NumPy 未安装的 PyTorch 提示；修正后的课程与审计已经不再调用依赖 NumPy 的对象 gather。
- 当前 PyTorch 会提示 reduce_scatter_tensor 和 torch.distributed.nn.functional.all_gather 被弃用。审计使用它们验证原语与显式可微封装的数学语义，并未把它们添加为课程推荐生产接口；新项目应核对当前受支持的接口/DTensor 路径。
- CPU 与特定软件版本上通过的浮点容差不能直接推广为跨硬件逐位一致；Flash 的在线 softmax 数学分析也不能替代实际 GPU 后端正确性与性能测试。

## 新图解的只读语义复核

对 visuals.js 使用 Node VM 和最小 document 替身调用 TorchVisuals.inspect，覆盖 transformer-1～4、distributed-1～4、performance-1～2，共 10 个课图、90 个 mode/step 状态。全部返回有效 HTML 与 caption，没有 undefined/NaN；逐步核对 KV 字节公式、采样概率和为 1、top-2 支持集及各通信输出的语义。

| 图解 | 核对结论 |
| --- | --- |
| Attention | prefill 下三角正确；decode 的绝对 query=3、四个历史/当前 key 全可见；明确说明矩形 is_causal=True 左上对齐只留首列；padding 模式明确未叠加因果约束，SDPA/MHA 布尔含义区分正确 |
| KV cache | 2 层、B=1、d=4、FP16 时，MHA Hkv=8 为 256×T bytes，GQA Hkv=2 为 64×T bytes；两行代表层而非 head，caption 已说明隐藏轴，比例 1/4 正确 |
| Sampling | T=0.5/1/2 的 softmax 趋势正确；top-2 只保留 A/B 并重新归一化；屏蔽 token 的 logprob 显示负无穷；没有伪称真实模型生成 |
| Ranks | 两台主机的 LOCAL_RANK 分别从 0 开始，全球 RANK 唯一；示意图限定每 GPU 一个进程，没有把 torchrun 等同于 DDP |
| Collectives | all-reduce SUM 得到每 rank 10；all-gather 拼成 [1,2,3,4] 而非求和；reduce-scatter 先逐位置归约再分片；明确标为语义示意，不冒充后端拓扑 |
| DDP | n₀=2/n₁=6，S₀=2/S₁=18，总均值 2.5，错误局部均值平均为 2；修正后使用符号梯度公式，避免对数值常量求导 |
| Sampler | 5 样本/2 rank 时补齐索引 0，分片 [0,2,4] 与 [1,3,0]；丢尾只覆盖 [0,1,2,3]；明确两者都不能不加处理地代表完整无重复评估 |
| Timing | 修正后 CPU 提交 0～1ms、同步 4～5ms，GPU 工作持续至 5ms；第 4 步游标在 85%，确实位于 CPU 等待和 GPU 工作重叠区域；图中时间明确为假想值 |
| Profiler | 数据供给不足与计算主导的区间布局自洽；CPU/GPU 轨迹使用同一墙钟轴；父子 total time 与重叠 CPU/GPU 时间不能直接相加的说明正确 |

两项问题修正后已重新核对：

1. DDP 原图出现 ∇(0.5+4.5)/2，对常数求导会造成误导。现已改为 [∇(2S₀/N)+∇(2S₁/N)]/2 = ∇[(S₀+S₁)/N]。
2. Timing 原 GPU kernel 在 CPU 同步开始前已经结束，且步骤游标与同步说明不一致。现已修正 GPU 终点与第 4 步游标，使等待关系可见。

非阻断教学建议：reduce-scatter 当前各位置归约结果相同，虽然数值正确，但使用 [10,20,30,40] 等不同分量更容易看出各 rank 持有不同位置的分片。

这部分验证覆盖生成 HTML 与数学/教学语义，没有替代真实浏览器中的动画控制、布局、可访问性或渲染测试；这些另由网站的浏览器测试覆盖。
