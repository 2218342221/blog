# PyTorch 基础课程内容与执行审计

审计日期：2026-10-01。范围：`content-foundations.js` 的 12 课、48 段 Python、36 道单选题；附带只读核查 `content-extended.js` 的 data/practical 8 课与 24 题。

## 结论与验证环境

- 基础课的全部 48 段代码均从当前课程源文件提取、编译并逐段执行；47 段在 CPU 发生实际计算，`tensor-3` 第 4 段的 CUDA BF16 分支因没有 GPU 未进入。为这段另运行了 CPU BF16 autocast 对照，但这不替代 GPU 验证。
- 每段都配有独立的结果或行为断言，不以“没报错”作为验收。数值题与正文中的关键公式通过张量计算验证；36 题的选项、答案和解释逐题人工核对，并在脚本保留稳定答案索引检查。
- 实际环境：Python 3.13、PyTorch `2.14.1+cpu`，单 CPU 线程。没有 CUDA、NumPy、torchvision。未新增或安装依赖。
- 最终测试命令：`.venv/bin/python tests/audit_foundations.py`，12/12 课通过，48 段载入，36 个答案契约通过。
- checkpoint 采用真实 `torch.save` / `torch.load(weights_only=True)` 序列化到 `BytesIO`；用内存文件映射模拟 `Path.replace`。验证了恢复后继续一轮训练时数据顺序、全部参数、AdamW 的 step/一阶矩/二阶矩、scheduler 状态及 RNG 逐位一致；没有验证磁盘文件系统的原子替换或持久化保证。

## 已修正的课程问题

| 位置 | 原问题 | 修正与验证 |
| --- | --- | --- |
| `tensor-1` / 切片带着偏移继续解释存储 | “第 11 个元素”与从零开始的位置 11 容易混淆 | 改为“从零开始的元素索引 11，即第 12 个元素”；执行验证 `5 + 1×4 + 1×2 = 11`。 |
| `tensor-2` / 广播从右边对齐 | 在 `[B,T,D]` 上误称 `[B]` 在 `B=T` 时对齐 token 轴 | 改为 `B=D` 时从右侧对齐特征轴 D。用 `[2,3,2] * [2]` 实测，它按特征加权，与 `w[:,None,None]` 按样本加权不同。 |
| `nn-3` / 自回归训练还需要正确错位 | 缺少“模型内部已移位”及 PAD/EOS 共 ID 的使用前提 | 增加提示：内部已处理 labels 移位的模型不能再次外部移位；本例 0 专作 PAD，共用 PAD/EOS ID 时要使用独立 mask。正文手工移位代码及原题答案本来正确。 |

没有改动 36 题的答案：人工与数值核查均未发现答案错误。

## 基础 12 课逐课核对

| 课程 | 实际执行与独立核对 | 结果 / 边界 |
| --- | --- | --- |
| tensor-1：Shape、stride 与共享存储 | 四段原代码；转置 stride `(1,4)`；元素 `y[1,2]=9`；切片 offset=5/stride=(4,2)；逻辑 32 bytes 对完整 storage 96 bytes；clone 独立；视图修改原存储；不同 offset 导致不同 data_ptr；expand stride=0。 | 通过。另断言重叠 expand 的原地 `add_` 必须报错；存储术语修正见上。 |
| tensor-2：索引、广播与 einsum | 四段原代码；显式样本权重 `[B,1,1]`；gather 的精确值；高级索引副本与索引赋值区别；einsum 与 matmul/SDPA 对照；mask 广播和概率归一化；全屏蔽普通 softmax 返回 NaN。 | 通过。修正 B/D 轴混淆，并加入能运行但结果错误的广播反例。 |
| tensor-3：Dtype、device 与数值稳定性 | CPU 段验证 BF16/FP16 字节、范围、eps；exp 溢出；logsumexp≈1001.3133；FP16 归约输出溢出与 FP32 归约 120000；new_zeros 继承设备/dtype；无转换的 to 返回自身。 | CPU 通过。CUDA BF16 原分支未运行；CPU BF16 对照验证 FP32 参数、BF16 输出及有限梯度。未验证 GPU 性能、流或传输重叠。 |
| tensor-4：View、reshape 与连续性 | 四段原代码；转置展平 view 的预期错误；reshape 顺序 `[0,3,1,4,2,5]`、独立存储与梯度全 1；contiguous 可返回自身；正确合头与错误直接 reshape 对照；channels_last shape 不变、stride `(105,1,21,3)`。 | 通过。没有把“非连续”概括为“所有 view 失败”，也没有把 reshape 概括为总复制。 |
| autograd-1：动态图与 VJP | 四段原代码；实际分支导数 4；VJP `[10,4]` 与 `torch.func.jacrev` 的 `Jᵀv` 对照；autograd.grad 不写叶子 .grad；汇合导数 7；一阶、二阶导均 12。 | 通过。断言多元素输出省略上游梯度报错，已释放平方图再次 backward 报错。 |
| autograd-2：Leaf、grad 与累积 | 四段原代码；叶子与保留中间梯度 `[18,36]` / `[6,12]`；3+4 累加为 7；SGD 将 2 更新到 1.3；None 与零梯度的 AdamW 衰减行为；等量与不等量微批正确梯度 -5，错误均值再平均为 -4。 | 通过。分别验证目标分母和更新次数，未以“各微批都能运行”替代全局目标核对。 |
| autograd-3：Detach 与梯度模式 | 四段原代码；loss=16 但梯度=4；冻结参数仍传播输入梯度；no_grad 输出不构图；eval 不关闭梯度；inference tensor 的保存反向限制；离开 inference_mode 后 clone 可正常参与训练；教师无梯度、学生有梯度。 | 通过。断言直接将 inference tensor 用于需要保存它的反向路径报错，clone 后梯度正确。 |
| autograd-4：自定义反向 | 四段原代码；上游梯度 2 的 Cube 导数 24；Scale 将广播梯度缩回 `[D]` 得 `[4,6]`；非连续 double 输入的 Scale gradcheck/gradgradcheck；Cube 一阶和二阶检查；FirstOrderSquare 一阶正确、二阶拒绝。 | 通过。定义类的片段也实际调用，不只执行类定义；没有把一阶检查当成高阶检查。 |
| nn-1：注册与状态 | 四段原代码；ModuleList 注册四个参数而普通 list 不注册；model(x) 触发 hook 而直接 forward 不触发；Parameter/buffer/persistent=False 的枚举与 dtype 迁移；普通属性不迁移；state_dict 别名与 clone 快照；strict=False 仍拒绝尺寸错配；共享权重去重；替换 Parameter 后旧 optimizer 不自动接管。 | 通过。CPU dtype 迁移实际执行；没有将此称为 GPU 迁移验证。 |
| nn-2：MLP | 四段原代码；Linear 权重 `[3,4]`、输出 `[2,5,3]`、15 参数，与手写仿射表达式对照；Flatten/MLP 最终 `[4,10]`；初始化偏置为零且权重非退化；残差输入梯度有限；eval Dropout 输出重复一致。 | 通过。初始化是否最优和模型泛化不属于这些结构断言的证明范围。 |
| nn-3：损失、mask 与分母 | 四段原代码；CE=log3、BCE=log2、MSE=2.5；类别轴两种正确处理等价，错误 `[B,T,V]` 调用明确报错；mask 后 CE=log4；被忽略位置梯度为零，所有有效位置梯度与手算一致；class-weight mean 分母为有效目标权重之和；全忽略 mean=NaN、sum=0；next-token 标签及忽略位置梯度。 | 通过。补充内部移位/PAD-EOS 前提。明确 class weight 场景不能套普通 token 计数分母。 |
| nn-4：训练与恢复 | 四段按课内顺序连续执行；80 次 AdamW 更新；epoch scheduler 到 20、lr=0.0025；验证按 32 样本累积且准确率≥0.8；真实 checkpoint 序列化/反序列化；继续一轮共 4 次更新的逐位对照。 | 通过。只模拟路径替换，不宣称测试了文件系统原子性、GPU optimizer 放置、分布式恢复或多 worker 预取。 |

## 题目逐课核对

以下字母为源文件中的答案位置；页面是否打乱选项由交互层负责。

| 课程 | 三题答案 | 主要核对依据 |
| --- | --- | --- |
| tensor-1 | A / C / D | 转置 stride；detach+clone；零起始存储索引 11。 |
| tensor-2 | C / D / A | 样本广播维；einsum 消去 d；masked_fill 屏蔽无效键。 |
| tensor-3 | B / C / D | BF16 范围/精度；稳定 logsumexp；先 unscale 再 clip。 |
| tensor-4 | C / B / D | 非固定步长展平；reshape 别名边界；transpose 后合头。 |
| autograd-1 | B / D / A | VJP=[10,4]；向量上游；create_graph。 |
| autograd-2 | B / C / A | retain_grad；梯度=7；总 token 数=4。 |
| autograd-3 | C / B / D | detach 导数=4；eval 与 autograd 独立；教师/学生边界。 |
| autograd-4 | B / C / D | 上游链式法则；广播梯度归约；double gradcheck 条件。 |
| nn-1 | B / C / A | ModuleList；buffer；独立最佳快照。 |
| nn-2 | A / B / D | 输出/参数量；仿射复合；初始化匹配激活。 |
| nn-3 | B / C / D | logits+long id；有效均值=2；正确移位目标。 |
| nn-4 | B / C / A | 更新顺序；总损失 16/12；优化器历史不可丢失。 |

## data/practical 八课只读复核

data-3 的 eval 调用与 persistent worker 恢复前提已补充。

| 课程 | 本轮实际检查 | 结论 |
| --- | --- | --- |
| data-1 | 执行 Rows Dataset、训练集拟合标准化、样本契约；额外验证单行训练集。 | 正常多行输入通过；单行 `std(0)` 默认 correction=1 产生 NaN，clamp_min 不修复。课程已改用 correction=0，并校验训练集非空。 |
| data-2 | 执行实际 collate，长度 3/1 的序列得到 tokens/mask，计数为 3/1。 | 通过。CUDA 锁页传输示例未运行。 |
| data-3 | 执行样本权重映射，核对两类总采样质量；执行实际评估循环，正确数 61、分母 68。 | 通过，accuracy=61/68。未发现题目分母错误。 |
| data-4 | 使用真实 DataLoader(num_workers=0) 验证保存/恢复独立 Generator 后下一 epoch 索引完全相同；人工检查 worker 初始化与预取边界。 | Torch RNG 路径通过。没有 NumPy，未执行原 NumPy/多 worker 随机增强代码。当前正文已有 persistent worker 状态恢复限制。 |
| practical-1 | 执行 200 步固定小 batch 训练，loss 0.6409→0.0675；核对 epoch 边界检查点/恢复方案。 | 通过。建议将“验证不更新 Dropout 状态”改成“关闭 Dropout 随机丢弃，并停止更新 BatchNorm 运行统计”，避免混淆两类模块。 |
| practical-2 | 原生 Linear+BatchNorm 对照验证 requires_grad=False 与 eval 的不同职责，冻结主干统计不变且新 head 有梯度。 | 语义通过。未安装 torchvision、未下载 ResNet 权重，原 torchvision 示例未运行。 |
| practical-3 | 执行原 TextClassifier 和 padding 测试，额外将同一文本加入更长 batch 比较输出，反向确认 PAD embedding 梯度为零。 | 通过。空长度业务语义已由正文明确保留，不将 clamp 当作业务处理。 |
| practical-4 | 执行原 anomaly/有限值检查，再注入 NaN，断言输入检查失败。 | 通过。没有实际 GPU OOM/NCCL 环境，不宣称验证设备故障恢复。 |

24 道 data/practical 题逐题核对后答案和解析一致。原文件每课答案位置均为 B/C/D；交互层应负责洗牌选项，避免固定模式成为通过捷径，本审计不修改交互代码。

## 图与动画的准确性约束

图解遵循下列规则，避免图形化之后丢失语义：

1. 存储图应同时显示逻辑坐标、stride、storage_offset 和零起始元素索引；转置只换元数据，clone 才创建第二份存储。
2. 广播动画从右向左对齐，必须保留 `[B,T,D]` 中 `[B]` 在 B=D 时误对齐特征轴的“合法但错误”反例。
3. VJP 动画标注上游向量 `[1,2]`，两条到 x₀ 的路径累加为 10，不能把它画成完整雅可比或逐元素导数。
4. 累积动画同时画 loss_sum 和 valid_count；1/3 token 两批对应分母 4，错误的两个均值平均会得到不同梯度。
5. detach 动画只切梯度边，保留共享存储连线；clone 才分离数据，eval 切模块行为而非切梯度边。
6. Module 树应区分 Parameter、持久 buffer、非持久 buffer、未注册属性四种对象，以及 optimizer 持有的参数身份。
7. loss 动画分开展示被忽略位置、有效计数、class-weight 分母与 next-token 位移；不可让“乘零”暗示能修复 NaN。
8. checkpoint 动画应包含权重、优化器矩、scheduler、RNG 与数据位置；相同前向不等于相同续训，需展示下一次更新对照。
