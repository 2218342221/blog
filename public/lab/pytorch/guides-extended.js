/* Extra teaching for the data, performance and practice units. */
window.GUIDES_EXTENDED = (()=>{
const step=(title,lines,explanation,state)=>({title,lines,explanation,state});
const pit=(wrong,why,fix)=>({wrong,why,fix});
return {
'data-1':{
scenario:'假设模型要根据两项体检数值预测类别。上线时只能拿到新患者的数据，因此训练时也不能提前看验证患者的统计信息。数据管线的第一件事，是确定“模型在什么时间能知道什么”，然后才是把表格转成张量。下面用两个训练样本和一个验证样本，亲手算一次没有信息泄漏的标准化。',
prerequisites:['tensor-3','nn-3'],terms:[{name:'样本契约',meaning:'一条输入的 shape、dtype、单位和标签含义。例如 x 是两项实数特征，y 是整数类别索引；形状正确不代表单位和含义正确。'},{name:'拟合 / 应用',meaning:'拟合从训练数据估计统计量；应用只使用已经固定的统计量变换输入。验证与部署只能执行后者。'},{name:'数据泄漏',meaning:'训练流程利用了真实预测时无法获得的信息。即使没读取验证标签，使用验证特征拟合均值也越过了评估边界。'}],
observe:'沿图中“先划分 → 训练统计量 → 应用变换”的箭头观察：训练集决定均值和方差，验证集只能接收它们。想一想，如果验证分布改变，训练侧的统计量是否也会改变？正确管线中不会。',
walkthrough:{title:'一组固定统计量，怎样处理新样本？',intro:'这里不训练模型，只验证数据边界。每列是一个特征，所以沿 dim=0 计算统计量；标准差使用 correction=0，把当前训练集当作待标准化的总体。',code:`import torch
train = torch.tensor([[1., 3.], [3., 7.]])
valid = torch.tensor([[9., 13.]])
mean = train.mean(dim=0)
std = train.std(dim=0, correction=0).clamp_min(1e-6)
train_z = (train - mean) / std
valid_z = (valid - mean) / std
print("mean:", mean.tolist(), "std:", std.tolist())
print("train:", train_z.tolist())
print("valid:", valid_z.tolist())
assert torch.allclose(train_z.mean(0), torch.zeros(2))`,output:'mean: [2.0, 5.0] std: [1.0, 2.0]\ntrain: [[-1.0, -1.0], [1.0, 1.0]]\nvalid: [[7.0, 4.0]]',steps:[
step('先固定划分',[1,3],'训练集第一列为 [1,3]，第二列为 [3,7]。验证样本 [9,13] 故意放得较远，方便观察分布变化。在真实任务中，这个划分应该按患者、用户或时间等业务边界决定，不能为了让验证值看起来更正常而重新划分。','train.shape = [2,2]\nvalid.shape = [1,2]'),
step('只从训练集学习尺度',[4,5],'均值分别是 (1+3)/2=2、(3+7)/2=5。减去均值后的偏差为 ±1 和 ±2，总体方差分别是 1 和 4，开方得到标准差 1 和 2。clamp_min 给常量列一个有限的除数；它并不解决异常数据，只避免除以零。','mean = [2,5]\nstd = [1,2]'),
step('同一坐标系下比较',[6,11],'训练值变为 [-1,-1] 和 [1,1]，验证值变为 [(9−2)/1,(13−5)/2]=[7,4]。验证均值不为零是正常的：它体现了新数据相对于训练分布的位置。如果对验证集单独居中，只有一个验证样本时它会直接变成零，原来的距离信息反而消失。','训练均值 = [0,0]\n验证位置 = [7,4]，不是异常计算') ]},
pitfalls:[pit('“各集合自己标准化，才能公平比较”','这样每个集合使用了不同的坐标系，而且预测单个样本时可能没有一个完整的新集合可供估计。','在训练集拟合一次，把统计量、特征顺序和单位一起保存；训练、验证、部署使用同一份变换。'),pit('“Dataset 能返回 tensor，数据就验收完成了”','错位标签、摄氏与华氏单位混用、同一患者跨集合，都可以通过 shape 和 dtype 检查。','同时验证数值契约和语义契约：抽样回看原始记录；按组检查交集；训练前排查 NaN、重复记录与非法标签。')],
check:{prompt:'若把验证样本改为 [19,23]，哪些张量应该改变？可以通过重新拟合均值把验证值拉回 0 附近吗？',hint:'把管线拆成“训练拟合”和“对新输入应用”，逐个查看谁依赖 valid。',answer:'mean、std、train_z 都不变，只有 valid_z 变成 [17,9]。不能为了改善验证数值而改拟合边界；应调查单位、数据分布或异常输入。若确需适应新分布，要定义新的训练与评估协议。'},transfer:'实现 Dataset 时先写一个样本契约，再测试 collate 后的 batch 契约。把预处理统计量放入模型 buffer 或 checkpoint，并把“训练集非空”和“特征列顺序一致”写成明确校验。'},
'data-2':{
scenario:'两条文本分别包含 2 个和 1 个 token，模型需要一个矩形 batch。补齐很容易，真正的问题是：补出的格子会不会被当成内容参与平均或 loss？下面故意让有效文本也包含 token 0，说明有效位置必须由长度或独立 mask 表示，不能只靠 token 数值推断。',prerequisites:['data-1','tensor-2'],terms:[{name:'collate_fn',meaning:'输入是若干独立样本组成的列表，输出是模型消费的一整个 batch。这里定义补齐、长度、mask 与标签如何对应。'},{name:'padding / mask',meaning:'padding 提供占位格；mask 标注哪些格子有效。token ID 与位置有效性是两个不同的信息。'},{name:'batch 内最大长度',meaning:'本例把每条序列补到当前 batch 的最长长度，而不是整个数据集的最大长度；这样通常能减少无效计算。'}],observe:'沿样本到 batch 的五步图观察 collate 所处的位置：worker 读取和变换样本之后，多个样本才组合为矩形。注意设备传输在后面；增加 worker 不会自动解决变长序列的堆叠规则。',
walkthrough:{title:'把 [4,0] 与 [9] 变成一个可正确求平均的 batch',intro:'用 token ID 的浮点值代替 embedding 向量，只为了让每个中间结果可手算。真实模型对每个 token 的向量沿序列维做同样的加权归约。',code:`import torch
from torch.nn.utils.rnn import pad_sequence
seqs = [torch.tensor([4, 0]), torch.tensor([9])]
lengths = torch.tensor([len(s) for s in seqs])
tokens = pad_sequence(seqs, batch_first=True, padding_value=0)
valid = torch.arange(tokens.size(1))[None, :] < lengths[:, None]
values = tokens.float()
pooled = (values * valid).sum(1) / lengths
print("tokens:", tokens.tolist())
print("mask:", valid.tolist())
print("masked mean:", pooled.tolist())
print("naive mean:", values.mean(1).tolist())`,output:'tokens: [[4, 0], [9, 0]]\nmask: [[True, True], [True, False]]\nmasked mean: [2.0, 9.0]\nnaive mean: [2.0, 4.5]',steps:[step('先保存真实长度',[1,4],'样本一的长度为 2，其中 token 0 是有效内容；样本二的长度为 1。长度来自原序列，因此不会把有效 token 0 误认为补齐。若任务约定独立 PAD ID，也可以用该 ID 生成 mask，但共享 PAD/EOS 的 tokenizer 不能直接这样判断。','lengths = [2,1]'),step('生成矩形和位置掩码',[5,6],'pad_sequence 生成 [B,T]=[2,2]。arange(T) 是位置 [0,1]，与 lengths[:,None] 的 [2,1] 广播比较：第一行两个位置都小于 2；第二行只有位置 0 小于 1。由此得到布尔 mask，而不是检查 tokens!=0。','tokens = [[4,0],[9,0]]\nvalid = [[真,真],[真,假]]'),step('让分子分母都尊重有效位置',[7,12],'第一条的平均为 (4+0)/2=2，第二条为 9/1=9。直接 mean 把第二条分母变成矩形宽度 2，得到 4.5。即使 padding 数值为零，它仍然影响未修正的分母。对 [B,T,D] 的 embedding，需要 valid.unsqueeze(-1) 才能沿特征维广播。','有效分母 = [2,1]\n错误的统一分母 = 2')]},
pitfalls:[pit('“把 PAD embedding 设为零，直接 mean 就够了”','零向量消除了分子中的贡献，却没有把 PAD 从分母中移除。不同长度的文本会被不同程度地缩小。','分子按 mask 求和，分母使用有效长度。对空序列定义明确策略，例如拒绝、填入专门 token 或显式返回零表示。'),pit('“worker 越多，batch 一定来得越快”','进程通信、序列化和内存复制也需要成本。轻量内存数据可能在 num_workers=0 时更快。','先用单进程确认契约，再测等待数据的时间和端到端吞吐；按证据调 worker、预取和锁页内存。')],check:{prompt:'如果第二条后面再补三个 0，正确平均应该变化吗？如果用 tokens!=0 生成 mask，第一条平均会是多少？',hint:'分别检查有效长度是否变化，以及第一条中的 0 是数据还是 padding。',answer:'正确平均仍为 9，新增 PAD 不改变分子与有效分母。若用 tokens!=0，第一条有效 0 被误删，分母从 2 变为 1，平均错误地变为 4。'},transfer:'为 collate 写“多补几个 PAD，模型有效输出应不变”的检查，再核对注意力、池化、loss 三处使用的 mask。mask 的布尔方向也要按具体 API 确认，不能把一个 mask 不加转换地传给所有模块。'},
'data-3':{
scenario:'验证集被分成大小不一的 batch。第一个 batch 有 4 个样本、答对 3 个，最后一个 batch 只有 1 个样本且答对了。把两次准确率取平均会得到 87.5%，但模型实际上只答对 5 题中的 4 题。指标必须保留“总贡献和总分母”，否则切 batch 的方式都能改变结果。',prerequisites:['nn-3','data-2'],terms:[{name:'micro / 全局累计',meaning:'先汇总所有样本的计数，再计算比例。全局 accuracy 是总正确数除以总样本数。'},{name:'混淆矩阵',meaning:'本例行表示真实类、列表示预测类。第 [i,j] 格表示真实为 i 却预测为 j 的样本数。'},{name:'recall / 召回率',meaning:'某个真实类别中有多少被找出来：该类真阳性除以该行总数。分母为空时必须另定报告规则。'}],observe:'图中把 60/64 与 1/4 合并为 61/68。注意两条柱子的长度代表不同样本数，不能让一个 4 人小组和一个 64 人大组在最终平均中拥有相同权重。下面再用 5 个样本构造混淆矩阵。',
walkthrough:{title:'从 batch 指标走到全局指标与每类召回',intro:'只使用固定标签和预测，排除模型随机性。这样能独立验证评估代码，而不会让模型变化掩盖统计错误。',code:`import torch
correct = torch.tensor([3., 1.])
counts = torch.tensor([4., 1.])
global_acc = correct.sum() / counts.sum()
batch_average = (correct / counts).mean()
target = torch.tensor([0, 0, 0, 1, 1])
pred = torch.tensor([0, 0, 0, 0, 1])
cm = torch.bincount(target * 2 + pred, minlength=4).reshape(2, 2)
recall = cm.diag().float() / cm.sum(1)
print(f"global={global_acc:.3f}, batch_average={batch_average:.3f}")
print("confusion:", cm.tolist())
print("recall:", recall.tolist())`,output:'global=0.800, batch_average=0.875\nconfusion: [[3, 0], [1, 1]]\nrecall: [1.0, 0.5]',steps:[step('保留可合并的统计量',[1,5],'两个 batch 对全局 accuracy 的贡献是 3 和 1，总分母为 4+1=5，因此结果为 4/5=0.8。先求各 batch 比例再平均会得到 (0.75+1)/2=0.875，相当于让最后一个样本拥有第一个 batch 单个样本的四倍权重。','正确计数 4 / 样本总数 5 = 0.8'),step('把二维类别对编码成格子编号',[6,8],'类别数 C=2 时，target*C+pred 把 (0,0)、(0,1)、(1,0)、(1,1) 映射为 0、1、2、3。bincount 计数后 reshape 回 [C,C]。这种实现要求 target 和 pred 均已验证为合法的 0 到 C−1 类别。','格子编号 = [0,0,0,2,3]\n行是真实类，列是预测类'),step('看见总分数掩盖的差异',[9,12],'类别 0 的三个样本全部找到，召回为 3/3=1。类别 1 只找回两个中的一个，召回为 1/2=0.5。总 accuracy 80% 并不能说明少数类表现足够好；要根据漏检或误报代价选择重点指标。','recall_0 = 100%\nrecall_1 = 50%')]},
pitfalls:[pit('“验证时也做类别平衡采样，指标会更可靠”','采样改变了被评估的分布，所得 accuracy 不再对应原始业务分布；replacement 还会带来重复与遗漏。','业务验证保留目标分布，另报每类指标；如果要评估均衡分布，明确其独立目的和口径。'),pit('“分布式时平均各 rank 的 accuracy 就行”','rank 的样本数或有效 token 数可能不同，这与平均大小不同的 batch 是同一个错误。','all-reduce 可加的分子和分母，再相除；还要处理 DistributedSampler 为补齐而重复的验证样本。')],check:{prompt:'把这 5 个样本拆成 5 个大小为 1 的 batch，全局 accuracy 应是多少？这能说明原来的 batch 平均法是正确的吗？',hint:'正确指标应对 batch 划分保持不变；错误方法有时会因分母恰好相同而碰巧得到正确值。',answer:'仍然是 4/5=0.8。5 个 batch 等大时，平均各 batch accuracy 恰好也为 0.8，但不能推广到不等大小的情况。应始终累计正确数与样本数。'},transfer:'把指标聚合器设计成可合并的状态：例如 correct/count、loss_sum/有效分母、混淆矩阵。这种状态能同时用于单进程、流式数据和分布式归约，计算口径不会随执行方式改变。'},
'data-4':{
scenario:'训练中断后，你恢复了模型权重、优化器和最初的 seed，却发现后续 batch 顺序变了。原因是 seed 只描述随机序列的起点，训练已走到序列中间。恢复训练需要接回当时的位置；否则 dropout、增强或采样会换成另一条后续轨迹。',prerequisites:['nn-4','data-2'],terms:[{name:'seed',meaning:'初始化伪随机数发生器的输入。在相同实现与调用顺序下，可复现从起点出发的一串数。'},{name:'RNG state',meaning:'随机数发生器此刻的内部状态，包含继续产生后续数字所需的信息，比记下初始 seed 更具体。'},{name:'独立 Generator',meaning:'单独管理一条随机流。例如让 DataLoader 的打乱不受模型初始化额外消耗随机数的影响。'}],observe:'切换图解里的“恢复 RNG 状态”和“重新设 seed”，看游标是接在中断位置还是退回起点。要比较的是接下来的随机数，而不是两条序列是否来自同一个 seed。',
walkthrough:{title:'保存当前位置，而不是返回起点',intro:'本例使用 CPU 独立 Generator，避免干扰全局随机状态。只比较张量相等性，因此预期输出不依赖把随机值逐位写进教程。',code:`import torch
g = torch.Generator().manual_seed(2026)
prefix = torch.rand(4, generator=g)
saved = g.get_state().clone()
expected = torch.rand(3, generator=g)
g.set_state(saved)
resumed = torch.rand(3, generator=g)
g.manual_seed(2026)
restarted = torch.rand(3, generator=g)
print("resume matches:", torch.equal(expected, resumed))
print("reseed matches:", torch.equal(expected, restarted))
assert torch.equal(expected, resumed)`,output:'resume matches: True\nreseed matches: False',steps:[step('让随机流向前走',[1,4],'初始化后先消耗 4 个数，模拟已完成训练消耗的随机操作。此时保存状态。prefix 的具体值不重要，关键是发生器的位置已经发生变化；真实任务中，模型初始化、dropout 和采样也在推进各自使用的随机流。','已消耗 4 个数\nsaved 指向接下来的一段序列'),step('恢复后接上后续轨迹',[5,7],'先继续抽取 3 个数作为连续运行的参考 expected，再把状态设回 saved，重新抽取 3 个数。两次从相同位置执行相同调用，所以 expected 与 resumed 完全相同。这是验证恢复功能的最小对照实验。','expected == resumed → True'),step('重新播种回到序列开头',[8,12],'manual_seed(2026) 重建起点，所以 restarted 对应开头的 3 个数，并不是中断后需要的 3 个数。恢复真实训练时，应先构造并加载模型等对象，最后恢复 RNG；否则对象初始化可能再次消耗你刚恢复的全局随机状态。','restarted 来自起点\n恢复操作的顺序也是契约')]},
pitfalls:[pit('“只要 torch RNG 恢复了，所有增强都能复现”','Python random、NumPy、CUDA 各设备、独立 Generator 和 worker 内随机源可能拥有不同状态。','清点代码实际使用的随机源，逐项保存和恢复。先在 num_workers=0、同环境、epoch 边界上建立可靠对照。'),pit('“固定 seed 能保证换硬件后逐位一致”','浮点归约顺序、内核和依赖版本也会改变结果，seed 不控制这些因素。','记录代码、数据和软件环境；明确目标是数值逐位复现还是统计趋势复现。确定性算法模式也不能替代完整实验记录。')],check:{prompt:'保存 RNG 后又额外调用一次 torch.rand，再读取下一批。即使 seed 没变，还能与原路径保持一致吗？',hint:'把随机流想成有游标的序列，额外调用会推进哪个位置？',answer:'通常不能，额外调用会消耗随机数，后续随机流的位置发生偏移。如果使用的是独立 Generator，只会影响那条流；若它与采样或 dropout 共用全局发生器，就可能影响后续训练。'},transfer:'验证恢复时同时跑“连续 K 轮”和“先 M 轮、保存、恢复到 K 轮”，比较参数、优化器状态和下一批数据。仅看到 checkpoint 成功加载，不能证明训练轨迹接续正确。'},
'performance-1':{
scenario:'给一行 CUDA 运算套上 perf_counter，结果只有几微秒，你可能只是测到了 CPU 把任务交给 GPU 的时间。先明确想测单次延迟、稳定吞吐还是端到端耗时，再决定计时区间。否则优化前后比较的可能是两个不同问题。',prerequisites:['tensor-3','nn-4'],terms:[{name:'异步提交',meaning:'CPU 提交设备工作后可以继续执行 Python；函数返回不代表设备已完成。CPU 与设备是两条相关但不同的时间线。'},{name:'warmup',meaning:'正式测量前运行若干次，让初始化、缓存和编译等一次性成本稳定下来。是否排除这些成本取决于测量目标。'},{name:'latency / throughput',meaning:'延迟是单个请求完成用时；吞吐是单位时间完成的工作量。批处理可增加吞吐，同时让单请求等待更久。'}],observe:'跟随图中的两个时间轴，观察“CPU 已返回”与“GPU 执行结束”不是同一时刻。同步必须放在计时区间的正确边界；图示长度用于说明先后关系，不代表这台机器的性能数据。',
walkthrough:{title:'先建立可重复的 CPU 基准骨架',intro:'运行本例只需要 CPU。我们实际测量矩阵乘法，但不写死耗时，也不把 CPU 结果当成 CUDA 结果。固定输入先验证计算，再让 benchmark 工具重复采样。',code:`import torch
from torch.utils.benchmark import Timer
x = torch.ones(16, 16)
y = x @ x
assert y.shape == (16, 16)
assert torch.all(y == 16)
timer = Timer(stmt="x @ x", globals={"x": x}, num_threads=1)
measurement = timer.blocked_autorange(min_run_time=0.05)
assert measurement.median > 0
print("shape:", list(y.shape))
print("checksum:", int(y.sum()))
print("positive median:", measurement.median > 0)`,output:'shape: [16, 16]\nchecksum: 4096\npositive median: True',steps:[step('正确性必须先于速度',[1,6],'全 1 的 [16,16] 矩阵相乘，每个输出是 16 次 1×1 的和，所以所有元素为 16，总和是 256×16=4096。先固定这个不变量，防止所谓优化偷偷减少了工作量或改变了输出。','输出 [16,16]\n每格 16，总和 4096'),step('限定测量范围',[7,8],'stmt 包括 x@x 的执行与输出分配，但不包括输入构造和数据读取。num_threads=1 固定 CPU 线程数，让对比条件更明确。blocked_autorange 选择重复次数并采样；这里 min_run_time 仅让短教学示例快速完成，正式比较应增加采样并报告波动。','计时范围：矩阵乘法\n未计入：输入构造 / 数据读取 / 请求等待'),step('解释结果的适用范围',[9,12],'median 是多次测量得到的中位时间，会随机器负载变化，因此教程只验证它为正，不声称某个固定加速比。CUDA 手工计时需要同步边界或正确使用 CUDA Events；端到端测试还应包含数据等待、传输和输出消费。','通过：计算不变量与基准能运行\n未证明：CUDA 延迟或端到端加速')]},
pitfalls:[pit('“每个算子后 synchronize，时间最准确”','逐算子同步破坏了本来可能存在的重叠，也改变了流水线行为；结果不再代表真实吞吐。','为整体区间设置边界同步，或用正确的 Events 测量目标设备流，再用端到端实验确认收益。'),pit('“第一次运行更慢，删掉就行”','首次初始化和编译成本对冷启动请求可能非常重要，不能无条件忽略。','分别报告冷启动与稳态；若排除 warmup，写清排除方式，并保持输入形状、dtype、设备一致。')],check:{prompt:'优化把每批 64 个样本改成 128 个，batch 延迟从 10 ms 变成 16 ms。吞吐提升了吗？能据此断言单请求延迟下降吗？',hint:'用样本数除以秒数算吞吐，再把批内执行与排队等待分开。',answer:'吞吐从 6400 样本/秒变为 8000 样本/秒，提升 25%。不能断言单请求延迟下降：batch 执行更久，凑批还可能增加排队等待。'},transfer:'每张基准表附上输入形状、dtype、设备、线程数、warmup、重复次数与计时边界。把数值正确性、内核耗时、端到端指标分别记录，避免某个局部改善掩盖整体退化。'},
'performance-2':{
scenario:'训练慢，可能是数据来不及，也可能是模型计算占满设备。仅看一个“GPU 利用率”无法知道应该改 DataLoader、减少算子还是改善通信。Profiler 把时间与阶段、算子连接起来，帮助找到值得优化的具体边界。',prerequisites:['performance-1','data-2'],terms:[{name:'record_function',meaning:'给一段程序打上自定义阶段名称。它帮助把大量底层算子关联回业务步骤，本身不改变计算结果。'},{name:'self time / total time',meaning:'self time 不包含子操作；total time 包含嵌套调用。父子层级时间不能无条件相加，否则会重复计数。'},{name:'trace / 时间线',meaning:'展示事件发生的位置和重叠关系；聚合表给出总量，但不能独自说明某个设备空闲区间由谁造成。'}],observe:'切换“等待数据”和“计算密集”两种图示，寻找最长的空隙与任务块。先提出“哪段是瓶颈”的假设，再说明哪种改动能缩短它；图示轨迹是教学案例，真实结论来自自己的 trace。',
walkthrough:{title:'用阶段标记把 CPU 算子关联回训练流程',intro:'这里分析一次小型前向与损失计算。我们验证自定义阶段确实被记录，不比较 profiler 下的耗时，也不从 CPU 轨迹推断 GPU 行为。',code:`import torch
from torch.profiler import profile, record_function, ProfilerActivity
x = torch.ones(2, 3)
w = torch.ones(3, 2)
with profile(activities=[ProfilerActivity.CPU], record_shapes=True) as prof:
    with record_function("prepare_batch"):
        batch = x.clone()
    with record_function("model_forward"):
        prediction = batch @ w
    with record_function("compute_loss"):
        loss = prediction.square().mean()
events = {event.key: event.count for event in prof.key_averages()}
print("phases:", [events[name] for name in
      ["prepare_batch", "model_forward", "compute_loss"]])
print("prediction shape:", list(prediction.shape))
print("loss:", float(loss))`,output:'phases: [1, 1, 1]\nprediction shape: [2, 2]\nloss: 9.0',steps:[step('把输入与分析范围分开',[1,5],'张量在 profile 之前创建，因此分配 x 和 w 的成本不在本次区间中。activities 仅选择 CPU，record_shapes 帮助关联输入形状。一次小迭代适合检查标记，不能代表长期稳态性能，也没有覆盖真实磁盘读取。','记录范围：with profile 内\n设备活动：CPU'),step('使用能回答问题的阶段名',[6,11],'prepare_batch 包含 clone，model_forward 包含矩阵乘法，compute_loss 包含平方和求平均。每个输出元素为 3，平方后为 9，因此 loss=9。阶段划分应与可采取的优化措施对应，而不是给每一行都加一个难以理解的标签。','prepare → forward → loss\nprediction 的四格全为 3'),step('聚合表与时间线各司其职',[12,16],'key_averages 按事件名称聚合。本例每个阶段执行一次，所以计数为 [1,1,1]。实际诊断时先看热点，再打开 trace 看空闲与重叠关系；大量时间花在 next(loader) 与大量时间花在 matmul，所需的改进方向完全不同。','标记计数 = [1,1,1]\n数值不变量：loss = 9')]},
pitfalls:[pit('“CPU 总时间加 CUDA 总时间就是总耗时”','CPU 与 CUDA 工作可以重叠，嵌套算子也有包含关系，简单求和会重复计算。','用墙钟时间衡量端到端耗时，用时间线解释关键路径；表中指标用于定位候选热点。'),pit('“一直开最详细 profile，数据最全面”','记录 shape、调用栈和内存会带来开销，长期采集还可能生成巨大文件，改变被观察的程序。','选择代表性窗口和 schedule，先轻量定位再针对性打开详细选项；最终关闭 profiler 测量优化收益。')],check:{prompt:'前向只占整体 20%，数据等待占 80%。如果前向理想加速到零耗时，总体最多加速多少？',hint:'把原总时间设为 100，优化不能改变的部分还剩多少？',answer:'仍需 80 个时间单位，因此最多是 100/80=1.25 倍。现实中前向不可能零耗时，所以收益更低。优先改善数据供给更有潜力，但仍要用时间线确认哪些等待在关键路径上。'},transfer:'为数据读取、设备拷贝、前向、反向、更新和通信加稳定阶段名。每次只改一个瓶颈因素，保留数值对照，并在关闭 profiler 后重新测端到端指标。'},
'performance-3':{
scenario:'torch.compile 并不是给所有 Python 代码按下一个永久加速开关。它会为捕获到的程序建立条件；输入违反这些条件时，可能重新编译或退回其他路径。理解“捕获了什么”和“为什么重新编译”，比只看一次调用快不快更有帮助。',prerequisites:['autograd-1','performance-1'],terms:[{name:'graph capture',meaning:'把一段张量计算表示成图，让后端能分析或生成实现。捕获成功与性能提升是两件需要分别验证的事。'},{name:'guard',meaning:'缓存图复用所依赖的条件，例如形状、dtype 或 Python 对象状态；条件变化可能触发新的编译。'},{name:'backend',meaning:'接收捕获图并返回可执行函数的组件。本例后端直接返回图的 forward，只观察捕获次数，不生成优化内核。'}],observe:'沿图看“捕获 → 编译 → 复用 → guard 失效”的顺序。注意第二次调用不一定重编译，而改变输入也不总是重编译：结果取决于动态形状策略与被建立的条件。',
walkthrough:{title:'用一个计数后端看见图的复用边界',intro:'下面明确指定 dynamic=False，使形状特化行为便于观察。教学后端只是执行捕获图，因此这段验证不证明 Inductor 性能。需要支持 torch.compile 的本地 PyTorch 环境。',code:`import torch
graphs = []
def backend(graph_module, example_inputs):
    graphs.append(graph_module)
    return graph_module.forward
def fn(x):
    return (x + 1).square()
compiled = torch.compile(fn, backend=backend, dynamic=False)
a = compiled(torch.ones(2))
b = compiled(torch.ones(2) * 2)
c = compiled(torch.ones(3))
assert torch.equal(a, fn(torch.ones(2)))
print("results:", a.tolist(), b.tolist(), c.tolist())
print("captured graphs:", len(graphs))`,output:'results: [4.0, 4.0] [9.0, 9.0] [4.0, 4.0, 4.0]\ncaptured graphs: 2',steps:[step('让后端负责记录捕获',[1,7],'每当框架把一张新图交给 backend，便在 graphs 里记录它。返回 graph_module.forward 表示直接执行这张图；这已经能检查捕获和复用机制，却没有实现算子融合或设备代码生成。fn 的计算为先加 1，再平方。','backend 被调用一次 → 记录一张图'),step('相同形状，更换数据值',[8,10],'第一次 [2] 输入触发捕获，输出 [4,4]。第二次仍是 [2] 浮点张量，只把值从 1 改为 2，输出变成 [9,9]；张量数值作为图输入，通常不因普通数据内容改变就编译一张新图。','shape=[2] 的两个调用复用图\n输入值仍会影响输出'),step('主动改变形状条件',[11,14],'第三次输入为 [3]。本例 dynamic=False，因此建立另一张形状特化图，最后捕获计数是 2。不要推广成“换形状永远新编译”：动态维度可以覆盖多个尺寸，而 Python 数据依赖控制流也可能引起 graph break。','捕获图数 = 2\n验证了机制，未测量加速')]},
pitfalls:[pit('“compile 没报错，就一定是整图优化”','默认配置可能允许 graph break，程序由多个捕获段与 Python 执行交替完成。','检查 graph break 与重编译日志；需要严格整图捕获时使用适当的 fullgraph 设置，并处理不支持的路径。'),pit('“编译后端的首次耗时可以代表推理延迟”','首次调用可能包含捕获、编译和初始化，后续复用成本不同；输入频繁变化还可能不断支付编译成本。','分开测首次调用、稳态和多形状工作负载；先验证输出与梯度，再报告真实后端的速度和内存。')],check:{prompt:'把第二次输入的值改成 5、形状仍是 [2]，本例输出是什么？仅凭输出正确，能否判断生成了高效机器码？',hint:'先按 (x+1)² 计算，再回看 backend 返回了什么。',answer:'输出为 [36,36]，通常仍复用已有 [2] 图。本例 backend 返回图的 forward，正确输出只能证明这条执行路径保持了计算语义，不能证明 Inductor 生成代码或性能收益。'},transfer:'先为一个稳定计算块建立 eager 数值基线，再启用 compile。记录实际输入形状分布、重编译原因和内存变化；不要为了减少图中断而把真实的数据分支静默删掉。'},
'performance-4':{
scenario:'把一个外部实现包装成 PyTorch 算子，不仅要“能算出值”。训练需要梯度，编译需要在不计算真实数据时推断元信息，框架还必须知道算子是否修改输入。下面把这些契约拆开，让一个简单的 2x+1 算子同时支持前向、fake 和一阶梯度。',prerequisites:['autograd-4','performance-3'],terms:[{name:'schema / mutation',meaning:'算子的输入输出和副作用约定。mutates_args=() 声明不修改输入；实现必须兑现声明。'},{name:'fake implementation',meaning:'不用真实数据计算，仅传播 shape、dtype、device 等元信息，供编译分析使用。它不会自动定义梯度。'},{name:'autograd registration',meaning:'告诉自动求导引擎如何把上游梯度传回输入。前向内部恰好用了 PyTorch 运算，也不能替代自定义算子的显式反向契约。'}],observe:'观察图中“前向、fake、autograd”各自服务的需求。缺少一块时，可能出现 eager 推理能跑、训练或编译却失败的情况；不能把前向运行成功当作完整集成成功。',
walkthrough:{title:'为 y=2x+1 明确三个不同的实现职责',intro:'本例使用 PyTorch 自定义算子注册接口，没有 CUDA 内核。它适合学习契约，实际项目若只是组合现成运算，通常先用普通 PyTorch 函数。',code:`import torch
@torch.library.custom_op("torchquest_guides::affine", mutates_args=())
def affine(x: torch.Tensor) -> torch.Tensor:
    return x * 2 + 1
@affine.register_fake
def fake_affine(x):
    return x * 2 + 1
def backward(ctx, grad):
    return grad * 2
affine.register_autograd(backward)
x = torch.tensor([1., 3.], dtype=torch.double, requires_grad=True)
y = affine(x)
y.sum().backward()
print("forward:", y.tolist())
print("gradient:", x.grad.tolist())
print("gradcheck:", torch.autograd.gradcheck(affine, (x,)))`,output:'forward: [3.0, 7.0]\ngradient: [2.0, 2.0]\ngradcheck: True',steps:[step('前向兑现无修改约定',[1,4],'affine 计算新张量 y=2x+1，不修改 x，也不返回 x 的别名，所以 mutates_args=() 与实现一致。若实现悄悄对 x 原地写入，编译器依赖的副作用假设就会失效，结果可能比直接报错更难排查。','x=[1,3] → y=[3,7]\nx 的内容保持不变'),step('元信息与反向分别定义',[5,10],'fake 通过相同运算规则传播输出元信息，在 FakeTensor 上不计算真实数据。本例 float64 输入保持原 dtype；bool 输入的真实前向会提升为 int64，因此不能无条件用 empty_like(x) 假定输出 dtype 与输入相同。反向则应用链式法则：dy/dx=2，所以传入梯度 grad 被乘以 2。此公式不需要保存前向张量；更复杂公式才需要 setup_context 保存必要信息。','fake 描述输出结构\nbackward 计算 2 × 上游梯度'),step('用解析梯度和数值检查交叉验证',[11,16],'对 y.sum() 反传，上游每个位置的梯度都是 1，因此 x.grad=[2,2]。gradcheck 使用 double 做有限差分比较，检查登记的反向是否匹配前向。它与检查 schema、fake 和编译兼容性的 opcheck 用途不同，不能互相替代。','解析梯度 = [2,2]\n有限差分 gradcheck = True')]},
pitfalls:[pit('“fake 返回的数值必须与真实前向相同”','fake 运行时可能没有可读取的真实数据，它的任务是提供正确元信息；试图调用 item 等读取值会破坏该用途。','用输入元信息推导输出。数据依赖输出形状需要遵循符号尺寸接口的要求，不能猜一个固定长度。'),pit('“注册成功就表示梯度一定正确”','接口接收一个 backward，并不会证明其数学公式正确；错误梯度仍可能让训练缓慢下降。','小输入 double gradcheck，加上手算和边界测试；另外用 opcheck 验证框架注册契约。')],check:{prompt:'若错误地把 backward 写成 return grad，前向输出会变吗？sum 的输入梯度又会是多少？',hint:'把前向数值和反向 VJP 当成两条独立执行路径检查。',answer:'前向仍是 [3,7]，但 x.grad 会错误地成为 [1,1]。有限差分应检测出与真实导数 2 不一致。这说明只有前向测试不足以证明训练可用。'},transfer:'先列出算子服务的模式：推理、训练、fake、编译、批处理与设备后端。逐项建立契约和验证，再决定是否值得引入维护成本更高的自定义实现。'},
'practical-1':{
scenario:'一段训练代码能跑完并不意味着能可靠续训。优化器的动量、随机流和数据位置都会影响下一步。本课把大训练脚本缩成两次确定性更新，用“连续训练”和“中断恢复”得到同一参数来检验保存协议。',prerequisites:['nn-4','training-3','data-4'],terms:[{name:'训练状态',meaning:'除权重外还包括优化器、调度器、AMP scaler、随机源和数据进度等。具体保存哪些取决于训练实际使用了哪些状态。'},{name:'state_dict',meaning:'模块或优化器的状态映射。直接把映射存在 Python 变量中不一定产生独立快照，需要 deepcopy 或序列化。'},{name:'恢复边界',meaning:'定义中断发生在一次更新前还是更新后、epoch 中间还是边界。边界不清可能重复更新或漏掉一个 batch。'}],observe:'沿完整训练生命周期图观察更新和保存的相对位置。checkpoint 表示的是哪一次 optimizer.step 之后？下一次循环应该从哪个 batch 开始？把这两个问题说清楚再写恢复代码。',
walkthrough:{title:'为什么只恢复权重，第二步就可能走偏？',intro:'模型是单个标量 w，目标为 2，loss=(w−2)²。SGD 带 momentum=0.9。没有数据采样或 dropout，因此这个最小例子只需保存参数和优化器；完整实践脚本还保存 RNG。',code:`import copy
import torch
def make():
    w = torch.nn.Parameter(torch.tensor(0.))
    return w, torch.optim.SGD([w], lr=0.1, momentum=0.9)
def update(w, opt):
    opt.zero_grad(set_to_none=True)
    (w - 2).square().backward()
    opt.step()
w, opt = make()
update(w, opt)
saved = copy.deepcopy({"weight": w.detach(), "optimizer": opt.state_dict()})
update(w, opt)
resumed, resumed_opt = make()
with torch.no_grad():
    resumed.copy_(saved["weight"])
resumed_opt.load_state_dict(saved["optimizer"])
update(resumed, resumed_opt)
print(f"continuous={w.item():.3f}, resumed={resumed.item():.3f}")
print("equal:", torch.equal(w, resumed))`,output:'continuous=1.080, resumed=1.080\nequal: True',steps:[step('第一步建立动量状态',[1,11],'w=0 时梯度为 2(w−2)=−4。SGD 首次动量缓冲为 −4，参数更新成 0−0.1×(−4)=0.4。模型只有一个数，优化器却已多了一份会影响未来的状态。zero_grad 放在每次更新前，确保没有意外累积。','第一步：gradient=-4\nw=0.4，momentum buffer=-4'),step('独立保存并继续参考路径',[12,13],'deepcopy 让 saved 真正冻结在第一步之后，否则共享张量可能随后续更新变化。第二步梯度为 2(0.4−2)=−3.2，动量变成 0.9×(−4)+(−3.2)=−6.8，因此新参数为 0.4+0.68=1.08。','第二步：buffer=-6.8\n连续路径 w=1.08'),step('恢复同一边界上的全部状态',[14,20],'新参数对象先复制保存的权重，再给绑定它的新优化器加载状态。恢复后执行相同的一步，应得到完全相同参数。若省略优化器状态，动量从新开始，第二步只加 0.32，参数会是 0.72。','正确恢复 w=1.08\n只恢复权重会得到 0.72')]},
pitfalls:[pit('“best_model = model.state_dict() 已是永久快照”','state_dict 中的张量可能引用当前模块存储，后续训练会继续改变它们。','立即序列化或 deepcopy；真正加载时明确 map_location 和可信 checkpoint 的边界。'),pit('“恢复成功打印出来就算验收”','加载接口成功不证明数据顺序、调度器步数和 RNG 都已接续；某些遗漏只在几步之后显现。','用连续训练作参考，同时比较参数、优化器和下一批数据；先验收 epoch 边界，再处理更复杂的中途恢复。')],check:{prompt:'本例省略 momentum，两个路径只恢复权重还会不同吗？这是否意味着所有优化器都只需保存权重？',hint:'考虑无动量 SGD 是否存在每个参数的历史状态，再比较 Adam 的一、二阶矩。',answer:'本例若 momentum=0，其他条件相同，仅恢复权重即可接续这两步；但不能推广到带动量 SGD 或 Adam。Adam 还依赖步数、一阶矩和二阶矩，调度器和 AMP 也可能有独立状态。'},transfer:'在动手实验下载完整 training_recipe.py，先跑 8 轮，再对照 5 轮保存后恢复到 8 轮。把可恢复性当成训练功能的一部分，而不是跑完之后才补上的文件保存。'},
'practical-2':{
scenario:'做迁移学习时，你把主干参数 requires_grad 设为 False，却发现持久状态仍在变化，之后切回 eval 时同一固定样本的输出也可能与先前不同。冻结梯度只禁止参数通过反向更新；BatchNorm 的运行均值是 buffer，会在 train 模式下继续更新。视觉迁移需要把参数、模块模式和预处理三个问题分别处理。',prerequisites:['models-1','models-4','nn-1'],terms:[{name:'参数冻结',meaning:'requires_grad_(False) 禁止为该参数记录梯度。它不自动调用 eval，也不冻结所有非参数状态。'},{name:'运行统计量',meaning:'BatchNorm 在训练中更新的 running_mean 和 running_var，属于持久 buffer；它们被保存进 state_dict。'},{name:'模块模式',meaning:'train()/eval() 改变 Dropout、BatchNorm 等层的行为，与 no_grad/inference_mode 控制是否记录梯度相互独立。'}],observe:'先看冻结主干图：更新箭头只进入分类头。再追问一个图中未直接画出的边界——主干的 buffer 是否也固定？下面用 BatchNorm 把这个差别变成能观察的数值。',
walkthrough:{title:'参数全被冻结，为什么 BatchNorm 仍然变化？',intro:'这不是训练真实视觉模型，而是复现迁移学习中常见的模式错误。BatchNorm 的 momentum=0.5 让更新量易于手算；它与优化器 momentum 不是同一个概念。',code:`import torch
bn = torch.nn.BatchNorm1d(2, momentum=0.5)
bn.requires_grad_(False)
x = torch.tensor([[2., 4.], [4., 8.]])
bn.train()
before = bn.running_mean.clone()
bn(x)
after_train = bn.running_mean.clone()
bn.eval()
bn(x + 100)
after_eval = bn.running_mean.clone()
print("before:", before.tolist())
print("after train:", after_train.tolist())
print("after eval:", after_eval.tolist())
print("any trainable parameter:", any(p.requires_grad for p in bn.parameters()))`,output:'before: [0.0, 0.0]\nafter train: [1.5, 3.0]\nafter eval: [1.5, 3.0]\nany trainable parameter: False',steps:[step('区分参数和 buffer',[1,4],'BatchNorm 默认有可学习仿射参数 weight、bias，还有 running_mean、running_var 等 buffer。requires_grad_(False) 影响参数，但运行统计量本来就不靠梯度更新。输入两列均值分别为 3 和 6。','所有参数 requires_grad=False\nbatch mean=[3,6]'),step('train 模式继续学习统计量',[5,8],'初始 running_mean=[0,0]。更新公式是 new=(1−m)×old+m×batch_mean，m=0.5，所以结果为 [1.5,3]。虽然没有一个参数需要梯度，前向仍然改变了模块持久状态。train 模式用当前 batch 的统计量归一化，所以相同完整 batch 的 train 输出不会仅因 running buffer 更新而变化。','0.5×[0,0]+0.5×[3,6]\n= [1.5,3]'),step('eval 模式固定运行统计量',[9,15],'调用 eval 后再输入整体加 100 的数据，running_mean 仍为 [1.5,3]。这不意味着 eval 保证输出相同：输入改变，输出当然可以改变；它表示 BN 使用已有统计量归一化，不再在这次前向中更新它们。','after_eval == after_train\n模式与梯度开关独立')]},
pitfalls:[pit('“在 epoch 开头 model.train()，主干仍会保持 eval”','train() 默认递归作用于子模块，会把之前设置为 eval 的主干重新切回训练模式。','每次调用全模型 train 后，按迁移策略再次设置 backbone.eval()；如果要适应新域 BN，明确记录这个选择。'),pit('“换成预训练模型就无需核对输入”','预训练权重依赖通道顺序、归一化、尺寸和任务语义；输入不匹配会让迁移效果大幅降低。','使用与权重匹配的预处理契约，并检查分类头维度和标签映射；先建立只训头的基线再逐层解冻。')],check:{prompt:'如果在 train 模式下用 with torch.no_grad(): bn(x)，running_mean 还会更新吗？',hint:'no_grad 管的是计算图，BatchNorm 的训练模式决定是否更新运行统计量。',answer:'会更新。no_grad 不把模块切换到 eval。若希望固定 BN 统计量，要设置 eval；若还希望冻结仿射参数，则另设 requires_grad=False。'},transfer:'为迁移实验记录“哪些参数训练、哪些模块处于 train、哪些统计量更新”。分阶段解冻时同步检查优化器参数组与学习率，避免解冻了参数却没有把它交给优化器。'},
'practical-3':{
scenario:'文本分类器一换 batch 组合，预测竟然变了。常见原因是同一文本被补到不同长度，padding 进入了平均池化。一个可靠的变长文本模型应该对额外补齐保持不变，前提是 mask、位置规则和运算都正确处理了无效位置。',prerequisites:['models-3','data-2','nn-3'],terms:[{name:'masked pooling',meaning:'只聚合有效 token 的表示，并使用有效 token 数归一化。注意分子和分母都要一致地排除无效位置。'},{name:'Embedding.padding_idx',meaning:'指定行在标准 embedding 查表反向中不累积梯度。它不会自动生成注意力 mask，也不会自动修正后续平均的分母。'},{name:'不变量测试',meaning:'对不应影响结果的变化进行扰动，例如追加 PAD，再验证输出不变；这种测试比只检查 shape 更接近语义。'}],observe:'切换有效序列和增加 PAD 的图解，观察正确分母保持为有效长度。图解用一维数值示意，下面把同样规则应用到二维 embedding，并比较补齐前后的完整句子表示。',
walkthrough:{title:'追加 PAD，句子表示应该保持不变',intro:'固定 embedding 权重以便手算。这里的 PAD ID 为独立的 0，且有效文本不含 0，因此 tokens.ne(0) 能正确生成 mask；共享 PAD/EOS 的任务需要另外传入 mask。',code:`import torch
embedding = torch.nn.Embedding(4, 2, padding_idx=0)
with torch.no_grad():
    embedding.weight.copy_(torch.tensor([[0., 0.], [2., 0.], [0., 4.], [6., 6.]]))
def encode(tokens):
    valid = tokens.ne(0)
    assert valid.any(1).all(), "empty sequence"
    values = embedding(tokens)
    total = (values * valid.unsqueeze(-1)).sum(1)
    return total / valid.sum(1, keepdim=True)
short = torch.tensor([[1, 2], [3, 0]])
padded = torch.nn.functional.pad(short, (0, 3), value=0)
a, b = encode(short), encode(padded)
print("representation:", a.tolist())
print("padding invariant:", torch.equal(a, b))
print("naive padded mean:", [[round(v, 2) for v in row] for row in embedding(padded).mean(1).tolist()])`,output:'representation: [[1.0, 2.0], [6.0, 6.0]]\npadding invariant: True\nnaive padded mean: [[0.4, 0.8], [1.2, 1.2]]',steps:[step('为词向量设置可解释的坐标',[1,4],'token 1 对应 [2,0]，token 2 对应 [0,4]，token 3 对应 [6,6]。PAD 行为零只是本例的数值安排；核心契约仍然是 mask。我们在 no_grad 内复制权重，避免把教学初始化操作记录进计算图。','E[1]=[2,0]\nE[2]=[0,4]\nE[3]=[6,6]'),step('沿序列维归约，保留特征维',[5,10],'tokens 形状为 [B,T]，查表后为 [B,T,2]。valid.unsqueeze(-1) 变成 [B,T,1]，沿最后一维广播到每个特征。sum(1) 得到 [B,2]，分母 keepdim=True 得到 [B,1]，使每个句子的特征共享自己的有效长度。','[B,T,2] → masked sum → [B,2]\n分母 [B,1]'),step('使用扰动来验证语义',[11,16],'第一句表示为 ([2,0]+[0,4])/2=[1,2]，第二句只有 token 3，因此为 [6,6]。追加 3 个 PAD 后，masked 结果保持一致；直接 mean 却按宽度 5 相除，把第一句变为 [0.4,0.8]。打印时保留两位小数，便于比较。','正确结果与 padding 长度无关\n未掩码 mean 会随 batch 宽度改变')]},
pitfalls:[pit('“注意力用了 mask，池化就不会出问题”','注意力 mask 限制信息交互，但输出仍含每个位置的表示；后续池化与 token loss 需要各自处理无效位置。','从 collate 到注意力、池化、loss、指标逐段追踪同一份有效位置信息。'),pit('“长度为零时分母 clamp 到 1 就完成设计了”','clamp 避免数值除零，却没有回答空文本应该对应什么业务含义，也可能掩盖数据损坏。','明确拒绝、加入专用 token 或定义空表示；本例直接拒绝全 PAD 样本，并把异常放在进入模型的边界。')],check:{prompt:'为什么分母使用 keepdim=True？如果 B 恰好等于特征维 D，不保留维度会有什么隐蔽风险？',hint:'广播从右侧对齐。[B,D] 除以 [B] 时，这个一维张量与哪一维对齐？',answer:'keepdim=True 得到 [B,1]，每行除以该句长度。若分母是 [B] 且 B=D，它会对齐特征维 D，静默按列缩放；B≠D 时则通常报形状错误。形状碰巧兼容不能证明语义正确。'},transfer:'在正式训练前验证同一文本独立成 batch、与更长文本混合、追加 PAD 时输出符合预期。若使用位置编码或左填充，还需明确有效 token 的位置编号规则。'},
'practical-4':{
scenario:'loss 变成 NaN 后，一味降低学习率很难知道是否真的修好了。更有效的路线是找出第一个非有限值：输入、前向中间结果、loss、梯度，还是更新后的参数？这能把“训练坏了”缩小成一个具体运算及其输入条件。',prerequisites:['training-4','autograd-3','performance-2'],terms:[{name:'finite / 非有限值',meaning:'有限值不包含 NaN 和正负无穷。isfinite 能在边界快速检查，但应进一步追问第一个异常由哪个运算产生。'},{name:'数值稳定的等价式',meaning:'数学等价的公式在浮点实现中可能完全不同。例如直接 exp 后取 log 会溢出，而 logsumexp 先做缩放。'},{name:'最小复现',meaning:'保留导致问题的最少输入、参数和操作。缩小规模不是删掉触发条件，而是去除不相关复杂度。'}],observe:'沿诊断图依次检查数据、前向、loss、梯度和更新，停在第一个异常边界。若 rank 0 只看到超时，还要查其他 rank 的最早异常；最后一个报错往往是后果。',
walkthrough:{title:'不是梯度先坏了：定位 exp 溢出的第一步',intro:'输入为两个很大的有限 logits。比较直接计算 log(sum(exp(x))) 与 torch.logsumexp，先检查前向，再检查稳定路径的梯度。',code:`import torch
x = torch.tensor([1000., 1001.], requires_grad=True)
naive_exp = x.exp()
naive = naive_exp.sum().log()
stable = torch.logsumexp(x, dim=0)
stable.backward()
print("input finite:", bool(torch.isfinite(x).all()))
print("exp finite:", bool(torch.isfinite(naive_exp).all()))
print("naive finite:", bool(torch.isfinite(naive)))
print(f"stable={stable.item():.3f}")
print("gradient:", [round(v, 3) for v in x.grad.tolist()])
assert torch.isfinite(x.grad).all()`,output:'input finite: True\nexp finite: False\nnaive finite: False\nstable=1001.313\ngradient: [0.269, 0.731]',steps:[step('从输入逐边界向后检查',[1,4],'1000 和 1001 都是有限 float32 值，但 e¹⁰⁰⁰ 远超其范围，因此第一处异常是 exp 输出正无穷。再求和、取 log 已经无法恢复丢失的信息。只检查最终 loss，会漏掉最有用的定位线索。','input：有限\nexp：首次溢出\nlog(sum)：继承无穷'),step('改写计算过程，保留数学目标',[5,6],'取 m=max(x)=1001，则 logsumexp(x)=m+log(exp(x₁−m)+exp(x₂−m))。指数输入变为 [−1,0]，两项都在安全范围，总结果为 1001+log(e⁻¹+1)≈1001.313。稳定实现保留了原目标，而不是截断结果。','平移后指数输入=[-1,0]\n稳定输出≈1001.313'),step('确认反向也保持有限',[7,12],'logsumexp 对每个输入的导数是 softmax(x)。平移后得到 [e⁻¹/(e⁻¹+1),1/(e⁻¹+1)]≈[0.269,0.731]，两者之和为 1。我们只对 stable 反传，不让已经无效的 naive 路径污染梯度。','gradient≈[0.269,0.731]\n梯度和≈1')]},
pitfalls:[pit('“对 NaN 做 nan_to_num 就等于修好训练”','替换坏值可能让程序继续，却没有恢复原来的数学目标，错误梯度或数据问题仍可能隐藏在上游。','先保存最小异常 batch，定位第一次非有限值；优先采用稳定算子、修正输入范围或目标定义，再验证前向和梯度。'),pit('“empty_cache 可以解决每步增长的显存”','缓存释放不等于释放仍被引用的张量。把带图 loss 或输出放进列表，可能保留旧图或持续占据设备内存。','检查引用链与统计代码，必要时保存标量或 detach 后移到 CPU；再区分活跃张量、保留缓存和峰值工作区。')],check:{prompt:'如果只把 x 从 float32 改为 float64，exp(1000) 就一定安全了吗？降低学习率能修复这个独立前向例子吗？',hint:'float64 范围更大但仍有限；此例尚未执行任何优化器更新。',answer:'仍不安全，float64 的最大有限值约为 1.8×10³⁰⁸，而 exp(1000) 更大。这个前向例子不涉及学习率，正确方向是稳定的 logsumexp，而不是寄希望于优化器设置。'},transfer:'建立最小诊断顺序：保存异常输入和状态，单设备 FP32 复现，逐边界检查，再逐项重新开启 AMP、compile 与分布式。每次修复都保留一个能触发旧问题的回归案例。'}
};
})();
