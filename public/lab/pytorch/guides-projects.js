window.GUIDES_PROJECTS = {
  "models-1": {
    "scenario": "你要把 5×5 的小图变成局部特征，但不想为每个位置训练一套独立参数。卷积的关键选择是：同一个核滑到每个位置，重复执行相同的乘加。先把通道和激活函数放到一边，用全 1 核让每个输出都能手算；再加入下采样和残差。这样看到 Conv2d(3,64,3) 时，你能分别解释输入通道、输出通道和空间窗口，而不是只记住调用形式。",
    "prerequisites": [
      "tensor-2",
      "nn-1"
    ],
    "terms": [
      {
        "name": "空间轴与通道轴",
        "meaning": "H、W 指图像位置，C 指每个位置的特征种类。输出通道来自不同卷积核，不是把图像切成不同区域。"
      },
      {
        "name": "感受野 r 与步距 j",
        "meaning": "r 是某个输出理论上覆盖的原输入跨度；j 是相邻输出中心在原输入上的间隔。两者要一起递推。"
      },
      {
        "name": "shortcut 投影",
        "meaning": "用可学习变换把输入变成与主分支完全相同的形状，再逐元素相加。形状一致是必要条件，特征对应关系也须合理。"
      }
    ],
    "observe": "先逐步播放卷积图解：第一个高亮窗口是左上角 3×3，移动一格时参数没有变化，只有被读取的数据变化。把九个输入加起来核对 63；最后一个窗口应为 171。图解没有 padding，下面代码的后半段另加 padding 与 stride，比较它们改变的是哪条尺寸公式。",
    "walkthrough": {
      "title": "从一个窗口，到能够相加的残差分支",
      "intro": "CPU 数值实验；使用人为固定的卷积核，目的是检查索引、尺寸与相加，不代表训练后的视觉特征。",
      "code": "import torch\nimport torch.nn.functional as F\n\nx = torch.arange(1, 26, dtype=torch.float32).reshape(1, 1, 5, 5)\nkernel = torch.ones(1, 1, 3, 3)\ny = F.conv2d(x, kernel)\nprint(f\"first={y[0,0,0,0]:.0f} last={y[0,0,-1,-1]:.0f} shape={tuple(y.shape)}\")\n\nr, jump = 1, 1\nfor kernel_size, stride, dilation in [(3, 1, 1), (3, 1, 1)]:\n    r += (kernel_size - 1) * dilation * jump\n    jump *= stride\nprint(f\"receptive_field={r} jump={jump}\")\n\nbody = F.conv2d(x, torch.ones(2, 1, 3, 3), stride=2, padding=1)\nskip = F.conv2d(x, torch.ones(2, 1, 1, 1), stride=2)\nassert body.shape == skip.shape\nout = body + skip\nprint(f\"body={tuple(body.shape)} skip={tuple(skip.shape)}\")\nprint(f\"residual_first={out[0,0,0,0]:.0f}\")",
      "output": "first=63 last=171 shape=(1, 1, 3, 3)\nreceptive_field=5 jump=1\nbody=(1, 2, 3, 3) skip=(1, 2, 3, 3)\nresidual_first=17\n",
      "steps": [
        {
          "title": "核在移动，参数共享",
          "lines": [
            1,
            7
          ],
          "explanation": "输入的 N=C=1，因此暂时只需看空间轴。第一个窗口包含 1、2、3、6、7、8、11、12、13，和为 63；核右移后读取下一组九个数。可放置的起点只有 0、1、2，所以输出为 3×3。F.conv2d 使用互相关式计算，不会先翻转卷积核；全 1 核恰好无法显示翻转差别，因此不能用这个特殊例子推断一般核的方向。",
          "state": "输入 [1,1,5,5] → 权重 [1,1,3,3] → 输出 [1,1,3,3]。"
        },
        {
          "title": "递推两层能看到多远",
          "lines": [
            9,
            13
          ],
          "explanation": "每层新增的覆盖跨度是 (k−1)×d×旧 j，先计算 r，再更新 j。两层分别让 r 从 1 到 3，再到 5。若第一层 stride 改成 2，第二层的相邻输入中心已相隔两个原像素，因此第二次应增加 4，最终 r=7。这个量描述潜在依赖范围，不等于实际每个位置的梯度强度都相同。",
          "state": "stride=1 的两层 3×3：r 为 1→3→5，j 始终为 1。"
        },
        {
          "title": "让主分支和捷径逐轴对齐",
          "lines": [
            15,
            20
          ],
          "explanation": "3×3 主分支把通道从 1 变为 2，并用 stride=2 下采样；1×1 捷径也做同样两项变换。左上角主分支因补零只读到 1、2、6、7，得到 16，捷径读到 1，合起来为 17。两支空间尺寸都是 3，但不是因为卷积核相同，而是各自的尺寸公式恰好匹配。真实残差块还可含归一化和非线性，必须按实际放置顺序分析。",
          "state": "[N,C,H,W] 四轴均为 [1,2,3,3]，相加没有借助广播。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "两个张量能相加就认为残差正确。",
        "why": "广播可能把 [N,C,1,1] 扩展成整张特征图，代码能运行却没有实现预期的逐位置捷径。",
        "fix": "相加前显式断言 shape 完全一致，并说明每个通道和空间位置的含义。"
      },
      {
        "wrong": "冻结卷积参数后，认为整个残差块不会变。",
        "why": "BatchNorm 的运行均值与方差是 buffers，训练模式的前向仍可更新它们；这不需要参数梯度。",
        "fix": "按任务决定是否同时固定 BatchNorm 的模式；比较 state_dict 中参数和 buffers 的前后值。"
      }
    ],
    "check": {
      "prompt": "输入 9×9，连续两层 k=3、padding=1，第一层 stride=2、第二层 stride=1。最终空间尺寸、步距、理论感受野分别是多少？",
      "hint": "尺寸逐层代入 floor 公式；感受野递推使用更新 stride 之前的 j。",
      "answer": "第一层空间为 floor((9+2−3)/2)+1=5，第二层仍为 5，所以输出 5×5。第一层 r=3、j=2；第二层 r=3+2×2=7、j=2。边界处一部分理论区域落在补零位置，实际读取的原图像素数可能更少。"
    },
    "transfer": "实现新的 CNN 时，先写每层 [N,C,H,W]、r、j 三列，再用小整数图核对一个输出位置。出现 shape 错误查步幅与投影；小目标信息丢失查早期下采样；训练推理不一致再查归一化统计。这样不同问题各有直接证据。"
  },
  "models-2": {
    "scenario": "同一 batch 中，一条序列有四个事件，另一条只有两个。为了装进矩形张量，短序列补了两个零，但“数值为零”并不等于“循环网络不执行”。只要循环状态继续参与递推，短样本的终态就会变化。本例把隐藏维缩成 1，用可手算的 RNN 把这个问题放大，再看 pack 如何让计算在真实结尾停止。",
    "prerequisites": [
      "autograd-1",
      "data-2"
    ],
    "terms": [
      {
        "name": "隐状态 h_t",
        "meaning": "循环网络在 t 时刻保存的摘要；它依赖当前输入与上一状态，同一组权重在所有时间步共享。"
      },
      {
        "name": "有效长度 lengths",
        "meaning": "每条样本真实存在的时间步数，不能计入尾部填充。pack 接受的长度张量应在 CPU，长度为正且不超过 T。"
      },
      {
        "name": "逐时刻输出与终态",
        "meaning": "output 保留各步表示，h_n 则记录每层、每方向的结束状态；batch_first 不改变 h_n 的轴顺序。"
      }
    ],
    "observe": "播放“共享 RNN 单元”图解到第三、第四步：长序列仍在推进，短序列的状态停在第二个有效事件。下面数字例子保持相同的四步与两步长度，对照 packed 的最终值 4 和直接读取 padding 后的最终值 1。",
    "walkthrough": {
      "title": "用 h_t = ReLU(x_t + 0.5 h_{t−1}) 看懂 pack",
      "intro": "CPU 可运行的单层单向 RNN。用固定非负数据使 ReLU 不截断数值，便于手算；LSTM、GRU 的内部递推不同，但有效长度和状态轴的要求相同。",
      "code": "import torch\nfrom torch import nn\nfrom torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence\n\nrnn = nn.RNN(1, 1, nonlinearity=\"relu\", bias=False, batch_first=True)\nwith torch.no_grad():\n    rnn.weight_ih_l0.fill_(1.0)\n    rnn.weight_hh_l0.fill_(0.5)\nx = torch.tensor([[[1.], [2.], [3.], [4.]], [[4.], [2.], [0.], [0.]]])\nlengths = torch.tensor([4, 2])\n\npacked = pack_padded_sequence(x, lengths, batch_first=True, enforce_sorted=False)\npacked_out, h = rnn(packed)\nout, restored = pad_packed_sequence(packed_out, batch_first=True, total_length=4)\nassert restored.tolist() == [4, 2]\nprint(f\"packed_output={out.squeeze(-1).tolist()}\")\nprint(f\"packed_final={h[0,:,0].tolist()} shape={tuple(h.shape)}\")\n\n_, raw_h = rnn(x)\nprint(f\"unpacked_final={raw_h[0,:,0].tolist()}\")\nextra = torch.cat([x, torch.full((2, 3, 1), 999.)], dim=1)\nextra_packed = pack_padded_sequence(extra, lengths, batch_first=True, enforce_sorted=False)\n_, extra_h = rnn(extra_packed)\ntorch.testing.assert_close(extra_h, h)\nprint(\"padding_invariant=True\")",
      "output": "packed_output=[[1.0, 2.5, 4.25, 6.125], [4.0, 4.0, 0.0, 0.0]]\npacked_final=[6.125, 4.0] shape=(1, 2, 1)\nunpacked_final=[6.125, 1.0]\npadding_invariant=True\n",
      "steps": [
        {
          "title": "固定共享权重，明确递推",
          "lines": [
            1,
            10
          ],
          "explanation": "默认初态是零。第一条的状态依次为 1、2+0.5×1=2.5、3+0.5×2.5=4.25、4+0.5×4.25=6.125。第二条前两步为 4、2+0.5×4=4。这里每一步都读取同样的两个权重；RNN 不是为每个时间位置新建一个线性层，序列变长也不会增加这些参数。",
          "state": "x=[B=2,T=4,F=1]；真实长度 [4,2]。"
        },
        {
          "title": "让循环计算跳过无效位置",
          "lines": [
            12,
            17
          ],
          "explanation": "pack 根据长度只保留有效时间步的计算安排。恢复成矩形 output 后，短样本尾部出现的零是 pad_packed_sequence 补回来的占位值，并非 RNN 真算出了零状态。最终 h_n 的第二条为 4，正好停在真实结尾。它的形状仍是 [层数×方向数,B,H]=[1,2,1]，即使输入用了 batch_first=True，也不能把第一维解释成 batch。",
          "state": "短样本 output 后两格是填充值，h_n 仍保存第二步的状态 4。"
        },
        {
          "title": "构造会暴露错误的对照",
          "lines": [
            19,
            25
          ],
          "explanation": "不 pack 时短序列还会走两步：0+0.5×4=2，再到 1，所以 raw_h 已经不是有效序列的终态。追加三个值为 999 的无效位置，是比补零更强的检查：只要长度不变，正确的 packed 表示就完全不受它们影响。这个性质只验证循环计算的边界；下游逐 token loss 若重新使用矩形张量，仍需自己的 mask。",
          "state": "packed 终态 [6.125,4]；未处理 padding 的终态 [6.125,1]。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "把双向 LSTM 的 output[:, -1] 当作整条序列表示。",
        "why": "最后位置可能是 PAD；即使没有 PAD，该位置的反向分量也只处理了序列末端，并不等于反向网络遍历完整序列后的终态。",
        "fix": "用 pack 后的 h_n，按层数与方向轴选最后一层前向、反向状态并拼接。"
      },
      {
        "wrong": "跨 batch 一直复用 hidden，因为这样保留了更多历史。",
        "why": "不同样本可能被混入同一状态，且未截断的图会跨片段累积，改变训练语义与内存需求。",
        "fix": "先定义状态属于哪条序列；边界重置，连续片段按截断反向策略 detach。detach 保留数值，只切断历史梯度。"
      }
    ],
    "check": {
      "prompt": "把本例短序列的两个 PAD 从 0 改成 10，lengths 仍为 2。packed 终态与未 pack 终态分别是什么？",
      "hint": "先算有效前两步得到 4，再决定后两步是否参与递推。",
      "answer": "packed 仍为 4；未 pack 第三步为 10+0.5×4=12，第四步为 10+0.5×12=16。这说明问题不是 PAD 数值选得不够小，而是有效时间边界没有参与模型执行。"
    },
    "transfer": "检查时序模型时，先画“样本身份—有效长度—状态重置边界”。再用追加无效尾部不改变输出、打乱 batch 后按原序恢复结果这类性质定位问题。对 LSTM 同时检查 h 与 c；对双向模型分别说明两个方向何时读完真实序列。"
  },
  "models-3": {
    "scenario": "你正在做一个最小文本分类器，同一句话单独推理时输出正常，和长句拼成 batch 后分数却变了。问题可能不在 Embedding 权重，而在池化分母：多出来的 PAD 让平均值被稀释。本例把词向量表固定成二维小整数，让输入 ID、查表、mask、有效计数和 logits 每一步都可以看见。",
    "prerequisites": [
      "tensor-2",
      "nn-3"
    ],
    "terms": [
      {
        "name": "词表 V 与向量维 D",
        "meaning": "V 是可查的 ID 数量，D 是每个 ID 对应向量的长度。Embedding 权重为 [V,D]，输入 [B,T] 查表后为 [B,T,D]。"
      },
      {
        "name": "mask 与广播",
        "meaning": "这里 mask 为 [B,T] 的布尔张量；补最后一维变为 [B,T,1]，才能对该 token 的 D 个特征一起筛选。"
      },
      {
        "name": "logits",
        "meaning": "模型对各类别给出的未归一化分数。交叉熵内部会进行稳定的 log-softmax，训练前无需先 softmax。"
      }
    ],
    "observe": "在 padding 图解中切换“有效序列”和“加 3 个 PAD”，观察有效计数不变而张量总长度变大。正确分母保持不变。下面例子还打印错误的普通均值，观察它为何随总长度缩小，而不是只记住一行 masked mean 代码。",
    "walkthrough": {
      "title": "把两个词平均起来，为什么不能除以四",
      "intro": "固定 PAD=0、UNK=1；例子没有训练词表或使用外部文本。全 PAD 样本在入口被拒绝，避免用除零保护掩盖数据问题。",
      "code": "import torch\nfrom torch import nn\nimport torch.nn.functional as F\n\nembedding = nn.Embedding(5, 2, padding_idx=0)\nwith torch.no_grad():\n    embedding.weight.copy_(torch.tensor([[0.,0.], [1.,1.], [2.,0.], [0.,4.], [2.,2.]]))\nids = torch.tensor([[2, 3, 0, 0], [4, 0, 0, 0]])\nvectors = embedding(ids)\nprint(f\"naive={vectors.mean(1).tolist()}\")\n\ndef pool(token_ids):\n    mask = token_ids.ne(0)\n    counts = mask.sum(1, keepdim=True)\n    if (counts == 0).any():\n        raise ValueError(\"empty sequence\")\n    values = embedding(token_ids)\n    return (values * mask.unsqueeze(-1)).sum(1) / counts\npooled = pool(ids)\nprint(f\"pooled={pooled.tolist()} counts={ids.ne(0).sum(1).tolist()}\")\n\nhead_weight = torch.tensor([[1., -1.], [-1., 1.]])\nlogits = F.linear(pooled, head_weight)\nloss = F.cross_entropy(logits, torch.tensor([1, 0]))\nloss.backward()\nprint(f\"logits={logits.tolist()} loss={loss.item():.6f}\")\nprint(f\"pad_gradient={embedding.weight.grad[0].tolist()}\")\nlonger = F.pad(ids, (0, 3), value=0)\ntorch.testing.assert_close(pool(longer), pooled)\nprint(\"padding_invariant=True\")",
      "output": "naive=[[0.5, 1.0], [0.5, 0.5]]\npooled=[[1.0, 2.0], [2.0, 2.0]] counts=[2, 1]\nlogits=[[-1.0, 1.0], [0.0, 0.0]] loss=0.410038\npad_gradient=[0.0, 0.0]\npadding_invariant=True\n",
      "steps": [
        {
          "title": "把整数 ID 变成可检查的向量",
          "lines": [
            1,
            10
          ],
          "explanation": "第一条的有效向量为 [2,0] 与 [0,4]，和为 [2,4]。四个位置直接求均值会得到 [0.5,1]；第二条只有 [2,2]，也被除以四，变成 [0.5,0.5]。虽然 PAD 行确实全零，它仍占据普通 mean 的分母。padding_idx 控制该查表行的初始化和梯度贡献，无法替池化决定哪些位置具有语义。",
          "state": "查表结果 [2,4,2]，但两条有效长度分别是 2 和 1。"
        },
        {
          "title": "同时控制分子与分母",
          "lines": [
            12,
            20
          ],
          "explanation": "mask.unsqueeze(-1) 保留 B 和 T 两条轴，把“这个 token 是否有效”同时应用到两个特征。分子只累加有效向量，分母按每条样本单独计数，所以结果为 [1,2] 和 [2,2]。即使加载的 PAD 行不是零，这个 mask 仍能排除它；但 ID 合法范围与空序列仍需显式检查。clamp_min(1) 能防止 NaN，却不能让空序列突然拥有可解释的表示。",
          "state": "第一条 [2,4]/2=[1,2]；第二条 [2,2]/1=[2,2]。"
        },
        {
          "title": "从表示到分类，再验证不变量",
          "lines": [
            22,
            30
          ],
          "explanation": "第一条 logits=[1−2,−1+2]=[−1,1]，正确标签为 1，损失约 0.126928；第二条两个分数都为零，对任一类别的损失为 log(2)，平均为 0.410038。PAD 行梯度为零，说明 Embedding 的设置生效。追加三列 PAD 后 pooled 不变，则进一步验证了后续池化也正确；这两个性质分别检查不同边界，不能互相替代。",
          "state": "[B,D]=[2,2] → logits [B,C]=[2,2] → 标量损失。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "均值分类器在训练集上表现不错，所以已经学会词序。",
        "why": "向量求和与均值对排列不敏感；“我喜欢你”和相同 token 的任意重排在此基线中完全相同。",
        "fix": "明确任务是否依赖顺序；需要顺序时加入 RNN、卷积或带位置表示的注意力，并设计词序对照样本。"
      },
      {
        "wrong": "只保存权重，部署时重新生成 token 到 ID 的映射。",
        "why": "权重第 2 行只对训练时的 ID=2 有意义，映射变化等于把不同词交换向量，模型仍能运行但语义错乱。",
        "fix": "把词表、PAD/UNK 规则、截断长度及标签映射随模型一起版本化，用同一句原始输入比对预处理张量。"
      }
    ],
    "check": {
      "prompt": "本例第一条再追加 4 个 PAD，普通 mean 与 masked mean 分别是多少？若把两个有效 token 调换顺序呢？",
      "hint": "原来有效向量之和始终是 [2,4]；新总长度为 8。",
      "answer": "普通 mean 变为 [0.25,0.5]，masked mean 仍是 [1,2]。交换有效 token 顺序后两者各自都不变，因为求和具有交换性。前者暴露 padding 错误，后者揭示均值模型本身不建模词序的表达能力边界。"
    },
    "transfer": "为序列模型保留三组检查：单条与不同长度 batch 一致、追加 PAD 一致、全 PAD 被明确处理。再从模型假设出发检查顺序敏感性。排查线上漂移时先比较 token IDs 和 mask，再比较中间表示，最后比较 logits。"
  },
  "models-4": {
    "scenario": "一个预训练线性变换已经有用，你只想为新任务调整少量方向。LoRA 不是把原权重删除，而是在原函数旁边增加一个可训练分支。最容易误解的是：B 初始为零时输出没有变化，为什么训练还能开始？本例用一个两维输入和一个秩 1 分支，直接追踪首步梯度、SGD 更新与合并后的输出。",
    "prerequisites": [
      "nn-1",
      "autograd-1"
    ],
    "terms": [
      {
        "name": "基础权重 W₀ 与偏置 b₀",
        "meaning": "保留预训练函数的参数；本例都不求梯度。冻结权重不自动处理模型里 BatchNorm 或 Dropout 的模式。"
      },
      {
        "name": "低秩分解 BA",
        "meaning": "A 先把输入投影到 r 维，B 再把这 r 个数变成输出维。ΔW 的秩至多 r，不代表基础 W₀ 也是低秩。"
      },
      {
        "name": "scale = α/r",
        "meaning": "控制适配器贡献的倍数；改变 r 时也应检查缩放策略，不能只比较参数数目。"
      }
    ],
    "observe": "先在图解选择“冻结主干”，区分无梯度参数与新分类头；再切换 LoRA，沿 x→A→B 阅读增量。把原分支的 b₀ 也保留在公式里。以下代码将 A 设为固定非零数值以便手算，而 B=0，观察“初始零贡献”如何在一次更新后变成非零。",
    "walkthrough": {
      "title": "第一步 A 没有梯度，究竟是不是坏了",
      "intro": "CPU 数学与 autograd 实验。人为使用 loss=y.sum() 和无 weight decay 的 SGD，隔离链式求导；这不是实际分类任务的训练目标。",
      "code": "import torch\nfrom torch import nn\nimport torch.nn.functional as F\n\nx = torch.tensor([[2., 1.]])\nW0 = torch.tensor([[1., 2.], [3., 4.]])\nb0 = torch.tensor([0.5, -0.5])\nA = nn.Parameter(torch.tensor([[1., -1.]]))\nB = nn.Parameter(torch.zeros(2, 1))\nscale = 2.0\noriginal = W0.clone()\ndef forward():\n    return F.linear(x, W0, b0) + scale * F.linear(F.linear(x, A), B)\ny = forward()\nprint(f\"initial={[round(v, 4) for v in y[0].tolist()]}\")\n\noptimizer = torch.optim.SGD([A, B], lr=0.1)\ny.sum().backward()\nprint(f\"grad_A={A.grad.tolist()} grad_B={B.grad.tolist()}\")\noptimizer.step()\nupdated = forward()\nprint(f\"after={[round(v, 4) for v in updated[0].tolist()]}\")\n\nmerged_weight = W0 + scale * (B @ A)\nmerged = F.linear(x, merged_weight, b0)\ntorch.testing.assert_close(merged, updated)\nassert torch.equal(W0, original)\nprint(\"merged_equal=True base_unchanged=True\")",
      "output": "initial=[4.5, 9.5]\ngrad_A=[[0.0, 0.0]] grad_B=[[2.0], [2.0]]\nafter=[4.1, 9.1]\nmerged_equal=True base_unchanged=True\n",
      "steps": [
        {
          "title": "先写清两个分支的形状",
          "lines": [
            1,
            15
          ],
          "explanation": "基础分支给出 [2×1+1×2+0.5,2×3+1×4−0.5]=[4.5,9.5]。适配器先得到 xAᵀ=2−1=1，再乘全零 B 得到零，所以初始输出与基础模型严格一致。PyTorch 的线性权重按 [out,in] 存储，因此合并增量是 B@A；不能把数学课中 x@W 的轴直接照搬到 nn.Linear。",
          "state": "A=[r=1,in=2]；B=[out=2,r=1]；BA 与 W₀ 都是 [2,2]。"
        },
        {
          "title": "沿链式法则看首步梯度",
          "lines": [
            17,
            22
          ],
          "explanation": "每个输出对自身的损失导数是 1。B 的每个元素乘着 scale×xAᵀ=2，因此梯度都是 2；A 的梯度路径上却要乘当前 B=0，所以首步梯度为零。SGD 后 B 变成 −0.2，增量两个分量均为 2×(−0.2)×1=−0.4，输出变为 [4.1,9.1]。下一步 B 已非零，A 的梯度通常也会出现；是否更新还取决于数据与目标，而不是“第二步必然”。",
          "state": "首步更新 B，A 数值不变；基础权重从未交给优化器。"
        },
        {
          "title": "合并时保留基础函数",
          "lines": [
            24,
            28
          ],
          "explanation": "由线性分配律，xW₀ᵀ+s·xAᵀBᵀ=x(W₀+sBA)ᵀ，原偏置仍应保留。本例没有 adapter dropout，所以可直接比较。真实大矩阵里 r(in+out) 可能远小于 out×in，例如 in=8、out=12、r=2 时新增 40 而原权重有 96；本例小到新增量与原矩阵同为 4，只为手算，不能拿它证明节约比例。",
          "state": "合并值与未合并值一致；再次把同一增量加到已合并权重会重复计算。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "把 A、B 都初始化为零，认为这样最稳妥。",
        "why": "两边链式求导分别要乘另一边，初始两者都为零会让这个纯低秩分支的两组梯度同时为零。",
        "fix": "使用明确的非对称初始化，例如 A 非零、B 为零；检查初始输出一致及首步 B 的梯度，而不是要求所有参数首步都改变。"
      },
      {
        "wrong": "可训练参数减到十分之一，就预计总显存也减到十分之一。",
        "why": "基础权重仍要存储与参与计算，中间激活仍可能为适配器梯度而保存，显存还包含工作区和通信缓冲。",
        "fix": "分别统计基础参数、适配器参数、优化器状态与激活，并在相同 batch 和长度下测峰值。"
      }
    ],
    "check": {
      "prompt": "保持 A=[1,−1]、scale=2，将输入改为 [1,1]，并保持 B 初始为零。首步 B 梯度是多少，说明什么？",
      "hint": "B 的梯度含有投影后的输入 xAᵀ。",
      "answer": "xAᵀ=1−1=0，因此该样本的 B 梯度也是零；A 仍因 B=0 而零。非零初始化只提供可学习路径，不保证所有输入和损失都产生非零梯度。要在代表性 batch 上看梯度，再判断实现是否错误。"
    },
    "transfer": "微调前列出“应更新、应冻结、应适配的 buffers”三类状态；更新后逐项比较。保存适配器时附带基础模型版本、插入位置、rank、alpha 和预处理。发布合并模型前，用固定输入验证 logits，并确保加载逻辑不会再次叠加适配器。"
  },
  "scaling-1": {
    "scenario": "模型的一层已经放不进一张卡，增加数据并行副本并不能缩小这一层。需要先回答“这次切的是数据、权重、激活，还是层的顺序”。下面把两层 MLP 分给两个虚拟 rank：输入一样，第一层各算一半特征，第二层各贡献一部分答案。只有知道局部值的数学含义，才能判断通信应当拼接还是求和。",
    "prerequisites": [
      "tensor-2",
      "distributed-2"
    ],
    "terms": [
      {
        "name": "输出维切分与输入维切分",
        "meaning": "前者让各 rank 计算不同的输出坐标；后者让各 rank 为同一个输出坐标计算不同输入区间的乘加贡献。"
      },
      {
        "name": "部分和 Partial",
        "meaning": "张量形状可能已经与完整输出一样，但元素值只包含一部分贡献；还要归约才具有完整语义。"
      },
      {
        "name": "microbatch 与 stage",
        "meaning": "PP 的 stage 持有不同层；microbatch 是在这些层间流动的数据子批，用于填充流水线。它和 TP 切矩阵不是同一维度。"
      }
    ],
    "observe": "切换图解的 DP、TP、PP，先指出每张卡上被重复或切开的对象。TP 模式下四张卡共同完成一个层，下面为便于手算缩成两份；注意这些虚拟 rank 使用同一输入。图中没有 SP 开关，SP 的序列轴切片应结合后续布局课继续分析。",
    "walkthrough": {
      "title": "两份形状相同的输出，为什么必须相加",
      "intro": "单进程 CPU 数学模型：用 Python 列表模拟两个 TP rank，不启动分布式通信，也不测量加速。矩阵采用 X@W 记法，与 nn.Linear 的参数存储方向相反。",
      "code": "import torch\n\nx = torch.tensor([[1., 2.]], requires_grad=True)\nW1 = torch.tensor([[1., 0., 2., -1.], [0., 1., 1., 1.]])\nW2 = torch.tensor([[1., 0.], [0., 1.], [1., 1.], [-1., 2.]])\nbias = torch.tensor([0.5, -0.5])\nhidden = torch.relu(x @ W1)\nfull = hidden @ W2 + bias\nprint(f\"hidden={hidden.tolist()}\")\n\npartials = []\nfor start in (0, 2):\n    stop = start + 2\n    local_hidden = torch.relu(x @ W1[:, start:stop])\n    partials.append(local_hidden @ W2[start:stop, :])\nsplit = torch.stack(partials).sum(0) + bias\nprint(f\"partials={[p.tolist() for p in partials]}\")\ntorch.testing.assert_close(split, full)\n\ng_full, = torch.autograd.grad(full.sum(), x, retain_graph=True)\ng_split, = torch.autograd.grad(split.sum(), x)\ntorch.testing.assert_close(g_split, g_full)\nprint(f\"output={split.tolist()} gradient_equal=True\")\nstages = 4\nu4 = 4 / (4 + stages - 1)\nu16 = 16 / (16 + stages - 1)\nprint(f\"ideal_utilization={u4:.3f},{u16:.3f}\")",
      "output": "hidden=[[1.0, 2.0, 4.0, 1.0]]\npartials=[[[1.0, 2.0]], [[3.0, 6.0]]]\noutput=[[4.5, 7.5]] gradient_equal=True\nideal_utilization=0.571,0.842\n",
      "steps": [
        {
          "title": "建立没有切分的基线",
          "lines": [
            1,
            9
          ],
          "explanation": "第一层把两维输入扩成四维：[1,2] 乘四个列向量得到 [1,2,4,1]。ReLU 逐元素作用，因此切开四个特征后仍能各自独立执行。第二层输出第一个坐标为 1+0+4−1=4，第二个为 0+2+4+2=8，最后加 bias 得到 [4.5,7.5]。先保留这个基线，才能检查分片是否保留了原函数。",
          "state": "X:[1,2] → 隐层 [1,4] → 输出 [1,2]。"
        },
        {
          "title": "按对应区间切两层权重",
          "lines": [
            11,
            18
          ],
          "explanation": "rank 0 持有第一层前两个输出特征 [1,2]，接上第二层对应的前两行，得到 [1,2]；rank 1 持有 [4,1]，得到 [3,6]。两份都是 [1,2] 形状，却各自缺一部分乘加项，所以必须求和成 [4,8]。若拼接，会得到四个错误的输出特征；若只取 rank 0，会丢失后半输入贡献。最终 bias 只加一次，不能在每份部分和里完整加入后再求和。",
          "state": "输出维切 W1 → 局部激活；输入维切 W2 → 同形部分和；SUM → 完整输出。"
        },
        {
          "title": "检查反向，再区分调度公式",
          "lines": [
            20,
            27
          ],
          "explanation": "前向相同不够，训练还要求梯度重组正确。本例比较输入梯度，验证所写代数分解保留了这条反向路径；它没有验证任何真实通信的 autograd 实现。最后另算均衡 stage 的理想填充排空模型：四个 stage、四个微批是 4/7，十六个微批是 16/19。该比值只说明气泡比例，不能直接乘 GPU 峰值算出实际训练吞吐。",
          "state": "数值与输入梯度等价；PP 利用率数字属于理想调度模型。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "第二层的本地输出 shape 完整，就认为可以立刻和残差相加。",
        "why": "它可能仍是部分和。如果各 rank 都先加一份完整残差再求和，残差会被重复计算 TP 次。",
        "fix": "先明确输出 placement；归约后再加残差，或使用经过证明的分布式布局规则。"
      },
      {
        "wrong": "DP=2、TP=4、PP=2 需要 2+4+2 张卡。",
        "why": "三个独立坐标共同标识一个 rank，组合数是笛卡尔积；各维也对应不同的通信组。",
        "fix": "画出十六个坐标，用 2×4×2=16 核对规模，再决定哪些组放在高速机内互联。"
      }
    ],
    "check": {
      "prompt": "如果本例两个 partial 都先加 bias，再求和，错误输出是多少？与正确答案差多少？",
      "hint": "分布式求和会把每张卡加入的 bias 一起加起来。",
      "answer": "两个 partial 的总和为 [4,8]，两次 bias 为 [1,−1]，错误输出 [5,7]。正确值是 [4.5,7.5]，差恰好为一份 bias=[0.5,−0.5]。这类错误不改变 shape，却系统性改变函数。"
    },
    "transfer": "阅读任何并行模块时，为每条边写全局 shape、本地 shape、是切片还是部分和、通信 group。优先用小整数张量重组输出并对比梯度，再进入真实多进程测试。最后才讨论拓扑和通信重叠，因为错误的切分即使更快也不能使用。"
  },
  "scaling-2": {
    "scenario": "四个参数看似很少，却足够解释 FSDP 的整个生命周期：平时每个 rank 只保存两项，计算层时把四项拼回，反向结束后再把梯度归约并分给负责的 rank。关键问题不是“参数有没有分片”，而是“此刻谁持有完整副本，何时释放，哪个优化器负责更新哪一段”。",
    "prerequisites": [
      "distributed-2",
      "training-3"
    ],
    "terms": [
      {
        "name": "持久分片与完整工作集",
        "meaning": "持久分片跨训练步骤保留；完整工作集是某个层计算时临时需要的参数。分片比例不能直接代替峰值比例。"
      },
      {
        "name": "all-gather 与 reduce-scatter",
        "meaning": "前者收集各段得到完整值；后者先归约每个元素的贡献，再把结果分段交给各 rank。SUM 与最终是否平均是两个要分别说明的约定。"
      },
      {
        "name": "reshard_after_forward",
        "meaning": "控制前向后是否再次释放完整参数、回到分片状态。若保留完整参数，反向通常可复用，不必为同一组再聚合一次。"
      }
    ],
    "observe": "图解展示“前向后释放”的五阶段：持久分片→前向聚合→再次分片→反向聚合→梯度分片。注意这条时间线对应释放完整参数的策略；下面同时模拟保留策略，检查它少的是第二次聚合，换来的是更长的完整参数驻留时间。",
    "walkthrough": {
      "title": "用四个参数追踪两种释放策略",
      "intro": "单进程 CPU 语义模型。cat、mean、chunk 分别模拟收集、平均与切分；没有调用 FSDP、没有网络通信，也不把 Python 张量占用当作真实显存。两份局部梯度假设来自等权样本集合的局部平均 loss。",
      "code": "import torch\n\ninitial = torch.tensor([1., 2., 3., 4.], dtype=torch.float64)\nlocal_gradients = [torch.tensor([2., 4., 6., 8.], dtype=torch.float64),\n                   torch.tensor([4., 6., 8., 10.], dtype=torch.float64)]\nmean_gradient = torch.stack(local_gradients).sum(0) / 2\nexpected = initial - 0.1 * mean_gradient\nprint(f\"mean_gradient={mean_gradient.tolist()}\")\n\nfor reshard in (True, False):\n    shards = [part.clone() for part in initial.chunk(2)]\n    full_params = torch.cat(shards)\n    gathers = 1\n    assert torch.equal(full_params, initial)\n    if reshard:\n        full_params = None\n    if full_params is None:\n        full_params = torch.cat(shards)\n        gathers += 1\n\n    grad_shards = mean_gradient.chunk(2)\n    updated = [p - 0.1 * g for p, g in zip(shards, grad_shards)]\n    restored = torch.cat(updated)\n    torch.testing.assert_close(restored, expected)\n    values = [round(v, 4) for v in restored.tolist()]\n    print(f\"reshard={reshard} gathers={gathers} updated={values}\")",
      "output": "mean_gradient=[3.0, 5.0, 7.0, 9.0]\nreshard=True gathers=2 updated=[0.7, 1.5, 2.3, 3.1]\nreshard=False gathers=1 updated=[0.7, 1.5, 2.3, 3.1]\n",
      "steps": [
        {
          "title": "明确每个 rank 最终应负责什么",
          "lines": [
            1,
            8
          ],
          "explanation": "rank 0 对完整四项贡献 [2,4,6,8]，rank 1 贡献 [4,6,8,10]；在本例等权平均约定下，正确梯度是 [3,5,7,9]。分片改变存放位置，不应该改变目标函数。真实 reduce-scatter 常以 SUM 表达通信，除以 world size 可能由框架在其他位置完成；如果各 rank 有效 token 数不同，直接除二可能已不符合全局 token 平均目标。",
          "state": "完整参考更新：[1,2,3,4] − 0.1×[3,5,7,9]。"
        },
        {
          "title": "分别模拟释放与保留",
          "lines": [
            10,
            19
          ],
          "explanation": "两种策略一开始都需要把 [1,2] 和 [3,4] 收集成完整参数。释放策略在前向后丢弃完整参数引用，反向需要时再聚合，因此总共两次；保留策略的 full_params 仍存在，反向直接用它，因此只有一次。进入 pre_backward hook 不等于必然发起通信，要看参数状态。这个模型没有下一层、预取或异步事件，真实峰值还要把那些同时存活的对象一起计入。",
          "state": "释放：聚合→释放→再聚合；保留：聚合→保留→直接复用。"
        },
        {
          "title": "梯度归约后，只更新自己的分片",
          "lines": [
            21,
            26
          ],
          "explanation": "rank 0 收到梯度 [3,5]，更新 [1,2]→[0.7,1.5]；rank 1 收到 [7,9]，更新 [3,4]→[2.3,3.1]。两种生命周期最终还原出同样的完整模型，证明释放策略不该改变这次数学更新。真实 FSDP 还需检查优化器状态是否与参数分片对应，以及混合精度、累积或多次反向是否改变状态转换；示例的计数只验证所写条件分支。",
          "state": "相同目标、相同完整更新；通信次数与驻留时间不同。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "N 卡分片后，显存峰值必然只剩单卡的 1/N。",
        "why": "执行一个参数组时可能仍需完整权重；激活、预取参数和通信临时区也不会都按同一比例缩小。",
        "fix": "按时刻列出常驻分片、当前完整参数、下一组预取、激活与 workspace，并检查 wrap 单元是否过大。"
      },
      {
        "wrong": "只存 rank 0 的本地 state 就能恢复完整训练。",
        "why": "示例中 rank 0 只有更新后的前两项，缺少另一半；真实续训还缺优化器、调度器、RNG 与采样位置。",
        "fix": "选择明确的完整或分片 checkpoint 方案，保存所需元信息，加载后再训练一步与未中断分支比较。"
      }
    ],
    "check": {
      "prompt": "若去掉代码中的除以 2，保持学习率 0.1 不变，新的第一项参数是多少？这只是通信策略变化吗？",
      "hint": "第一项梯度贡献之和是 2+4，而平均是 3。",
      "answer": "第一项变成 1−0.1×6=0.4，而不是 0.7。更新幅度翻倍，已经改变了优化语义；除非有其他位置补偿相同缩放，否则不能把 SUM 与 MEAN 随意互换。"
    },
    "transfer": "排查 FSDP 时同时记录参数组名、分片/完整状态、collective 次序与优化器 step。先核对重组后的参数更新，再看释放和预取的性能。ZeRO-1/2/3 的分类帮助理解被分片的状态，但不能代替某个实现具体的 hook 与保存协议。"
  },
  "scaling-3": {
    "scenario": "模型参数明明能够装进设备，反向时却 OOM。原因常在参数以外：为了求导，前向留下了中间激活；有时两层完整参数、通信缓冲和临时算子工作区还会重叠。先用账本区分“持久状态”和“为反向暂存的量”，再通过实际 autograd 实验理解 checkpoint 为什么用额外计算换空间。",
    "prerequisites": [
      "autograd-1",
      "performance-2"
    ],
    "terms": [
      {
        "name": "saved tensors",
        "meaning": "某个 backward 为计算导数需要的前向值，不等于所有变量都会被保存；具体内容取决于算子求导公式。"
      },
      {
        "name": "activation checkpoint",
        "meaning": "减少前向保存，在反向需要时重算部分中间结果。与保存模型文件的 checkpoint 是两件事。"
      },
      {
        "name": "allocated 与 reserved",
        "meaning": "设备分配器已分给活跃张量的空间与它保留管理的空间；reserved 更大不代表差值都是模型仍在使用的激活。"
      }
    ],
    "observe": "图解在“保存全部激活”和“激活重计算”之间切换时，变化的是激活条，参数、梯度和两个 Adam 动量保持不变。图里的激活 12 GB→3 GB 是假设；下面只在 CPU 验证重算次数及梯度一致性，不能从该实验读出 CUDA 省了多少显存。",
    "walkthrough": {
      "title": "亲眼确认：前向多执行一次，梯度仍然相同",
      "intro": "CPU 可运行示例，显式使用非重入 checkpoint。函数入口的计数器仅用于观察调用次数，不参与输出计算；实际被 checkpoint 的函数应避免影响语义的副作用。",
      "code": "import torch\nfrom torch.utils.checkpoint import checkpoint\n\nparameter_count = 1000\nparameter_bytes = parameter_count * 4\ngradient_bytes = parameter_count * 4\nadam_moment_bytes = parameter_count * 8\nprint(f\"persistent_bytes={parameter_bytes + gradient_bytes + adam_moment_bytes}\")\n\ndef run(use_checkpoint):\n    calls = [0]\n    def block(x):\n        calls[0] += 1\n        return x.sin().square()\n    x = torch.tensor([0., 0.5, 1.], dtype=torch.float64, requires_grad=True)\n    if use_checkpoint:\n        y = checkpoint(block, x, use_reentrant=False, preserve_rng_state=True)\n    else:\n        y = block(x)\n    y.sum().backward()\n    return y.detach(), x.grad.clone(), calls[0]\nplain_y, plain_g, plain_calls = run(False)\ncheck_y, check_g, check_calls = run(True)\n\ntorch.testing.assert_close(check_y, plain_y)\ntorch.testing.assert_close(check_g, plain_g)\ntorch.testing.assert_close(check_g, torch.sin(torch.tensor([0., 1., 2.], dtype=torch.float64)))\nassert (plain_calls, check_calls) == (1, 2)\nprint(f\"forward_calls={plain_calls},{check_calls}\")\nprint(f\"gradient={[round(v, 6) for v in check_g.tolist()]}\")\nbytes_to_move = 8 * 10**9\nbytes_per_second = 16 * 10**9\nprint(f\"one_way_lower_bound_seconds={bytes_to_move / bytes_per_second:.1f}\")",
      "output": "persistent_bytes=16000\nforward_calls=1,2\ngradient=[0.0, 0.841471, 0.909297]\none_way_lower_bound_seconds=0.5\n",
      "steps": [
        {
          "title": "先列一个明确配置的账本",
          "lines": [
            1,
            8
          ],
          "explanation": "这里假设参数、梯度均为 FP32，每项 4 字节；Adam 的一阶与二阶矩各 4 字节，所以 1000 个参数对应 4000+4000+8000=16000 字节。这张账没有额外主权重，没有激活，没有优化器临时张量；不能机械套到任意 BF16 或其他优化器配置。实际统计时还要避免把共享 storage 的视图重复计数，并注明 GB 使用 10⁹、GiB 使用 2³⁰。",
          "state": "持久状态按 dtype 与实现逐项计数，尚不是运行峰值。"
        },
        {
          "title": "对照普通前向与重算前向",
          "lines": [
            10,
            23
          ],
          "explanation": "对 y=sin²(x)，反向需要知道与 sin、cos 有关的中间值。普通路径保存其求导所需状态；checkpoint 路径会在反向重新进入 block 来恢复需要的数据。非重入实现可能在所需值已恢复后提前停止重算，所以这里计的是“进入函数次数”，不声称所有函数都完整执行两遍。输入 0、0.5、1 的精确导数为 sin(2x)，可独立于程序推导。",
          "state": "普通路径入口 1 次；本例 checkpoint 路径入口 2 次。"
        },
        {
          "title": "验证等价，再计算传输下界",
          "lines": [
            25,
            33
          ],
          "explanation": "比较输出和输入梯度，且把梯度与解析导数交叉核验，避免两个分支以同一种方式算错。含 Dropout 的块还需要随机数状态一致；读取可变全局变量的块可能无法靠保存 RNG 修复。最后 8 GB÷16 GB/s=0.5 秒只是理想单向传输下界，真实 offload 还可能有往返、多次加载、竞争与同步，因此不能据此承诺实际耗时。",
          "state": "梯度 [0,sin(1),sin(2)]；额外计算和传输是不同成本。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "每步调用 empty_cache 就能释放计算图引用的激活。",
        "why": "仍被 autograd 或 Python 容器引用的张量属于活跃数据，清理分配器缓存不会让它们失去引用。",
        "fix": "检查是否把带图的 loss/output 长期放入列表、是否保留了不必要的图，并定位真实峰值阶段。"
      },
      {
        "wrong": "checkpoint 后 loss 一样就足以证明训练没有变化。",
        "why": "前向输出相同并不保证重算时读取同样的状态；梯度可能因随机行为或副作用不同而变化。",
        "fix": "固定输入和 RNG，比较输出、输入梯度与参数梯度；再单独测目标设备的峰值和步耗时。"
      }
    ],
    "check": {
      "prompt": "若某模型总峰值 24 GB，其中只有 8 GB 是可重算激活，理想情况下把这部分减半，总量会降到多少？能承诺真实峰值吗？",
      "hint": "只对被优化的那一项做减法，其他项不能一起除二。",
      "answer": "按这个静态账本是 24−8+4=20 GB，不是 12 GB。真实峰值仍取决于不同数据的生命周期及重算时临时工作区，所以 20 GB 是该假设下的估计，需要设备测量确认。"
    },
    "transfer": "OOM 先定位发生于前向、反向、step 还是保存阶段；再用 profiler 和内存快照确定增长项。激活大考虑 batch、长度与重算；持久优化器状态大考虑分片；offload 前核算带宽。每项优化都同时交付梯度一致性与实际资源测量。"
  },
  "scaling-4": {
    "scenario": "两个 rank 的本地张量形状完全相同，甚至数值完全相同，它们就一定是复制关系吗？不一定：它们可能各自只保存了一半贡献，必须相加才得到全局值。DTensor 的 placement 正是为了给本地值附上这种语义。先用二维网格画清谁和谁通信，再判断一份本地数据究竟该拼接、保留还是归约。",
    "prerequisites": [
      "distributed-1",
      "scaling-1"
    ],
    "terms": [
      {
        "name": "DeviceMesh 坐标",
        "meaning": "逻辑网格中的多维坐标，用来组织 process group；网格本身不自动保证物理链路高速。"
      },
      {
        "name": "Shard 与 Replicate",
        "meaning": "Shard 保存全局张量某个轴的一段，Replicate 保存相同完整值。相同全局 shape 不代表本地 shape 或通信代价相同。"
      },
      {
        "name": "Partial(SUM)",
        "meaning": "本地是同一个全局结果的未归约贡献；它不是普通切片，即使与完整张量同形也不能直接当完整答案。"
      }
    ],
    "observe": "在图解依次切换 Shard(0)、Replicate、Partial(SUM)，先忽略颜色，比较每个 rank 的数值和合成规则。Partial 的两份本地数组虽然相同，却是全局值的一半。下例增加一个 DP 维，展示同一 TP 分片在另一行复制；使用单进程张量说明布局，不冒充 DTensor 通信实测。",
    "walkthrough": {
      "title": "给每份本地值写上布局标签",
      "intro": "单进程 CPU 布局模型。实际 DeviceMesh/DTensor 多进程接口见本课完整章节；这里 cat 与 sum 只用于验证数学语义，不创建 process group。",
      "code": "import torch\n\nmesh = [[0, 1], [2, 3]]\ntp_groups = mesh\ndp_groups = [list(group) for group in zip(*mesh)]\nprint(f\"tp_groups={tp_groups} dp_groups={dp_groups}\")\nfull = torch.arange(1, 9, dtype=torch.float64).reshape(4, 2)\n\nshards = list(full.chunk(2, dim=0))\nlocal = {mesh[dp][tp]: shards[tp].clone() for dp in range(2) for tp in range(2)}\nprint(f\"local_shapes={[tuple(local[r].shape) for r in range(4)]}\")\nrestored = torch.cat([local[0], local[1]], dim=0)\ntorch.testing.assert_close(restored, full)\ntorch.testing.assert_close(local[0], local[2])\n\npartial = [full * 0.25, full * 0.75]\nreduced = torch.stack(partial).sum(0)\ntorch.testing.assert_close(reduced, full)\nprint(f\"restored_sum={restored.sum():.0f} partial_sum={reduced.sum():.0f}\")\nresidual = torch.ones_like(full)\ncorrect = reduced + residual\nwrong = torch.stack([piece + residual for piece in partial]).sum(0)\nassert torch.equal(wrong - correct, residual)\nprint(f\"wrong_residual_delta={(wrong - correct).max():.0f}\")",
      "output": "tp_groups=[[0, 1], [2, 3]] dp_groups=[[0, 2], [1, 3]]\nlocal_shapes=[(2, 2), (2, 2), (2, 2), (2, 2)]\nrestored_sum=36 partial_sum=36\nwrong_residual_delta=1\n",
      "steps": [
        {
          "title": "先列通信组，避免按 rank 大小猜",
          "lines": [
            1,
            7
          ],
          "explanation": "把第一维称为 DP、第二维称为 TP，则固定 DP 坐标沿第二维变化得到 TP 组 [0,1] 和 [2,3]；固定 TP 坐标沿第一维变化得到 DP 组 [0,2] 和 [1,3]。例如 rank 0 与 rank 2 负责相同 TP 分片但不同数据副本，它们的梯度同步范围与 rank 0、1 的层内协作不同。名字只表达组织意图，真正需要核对的是组成员。",
          "state": "逻辑 mesh=(2,2)，共四个坐标，每个 rank 同时属于一个 DP 组和一个 TP 组。"
        },
        {
          "title": "在 DP 复制，在 TP 按第零轴切片",
          "lines": [
            9,
            14
          ],
          "explanation": "全局张量 [4,2] 在 TP 维沿轴 0 两分，本地为 [2,2]。rank 0、2 保存前两行，rank 1、3 保存后两行。恢复全局时取一个 TP 组按分片顺序拼接，而不是把四个 rank 全部拼起来；后者会把 DP 副本重复计算。真实 DTensor 会同时携带全局 shape、mesh 与两个 placement，这些元信息决定 redistribute 的通信组。",
          "state": "placement=[Replicate(),Shard(0)]；全局 [4,2]，每个本地 [2,2]。"
        },
        {
          "title": "部分和必须先完成语义再用",
          "lines": [
            16,
            24
          ],
          "explanation": "现在两份本地张量都为 [4,2]，分别包含全局的 1/4 与 3/4，所以应求和，不能沿轴拼接。若每份都先加全 1 残差再归约，结果是 full+2×residual；正确的是 full+residual，每个元素多了 1。这个错误不需要任何 shape 异常就能发生，正说明 Partial 不是普通完整 Tensor。真实重分布反向还可能需要另一种 collective，训练成本不能只数前向。",
          "state": "Shard 用按轴拼接恢复；Partial 用归约恢复；Replicate 不重复求和。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "本地数组一样，就把 Partial 标成 Replicate。",
        "why": "Partial 的每份可能只是同样大小的一半贡献；布局说明数值如何组成全局结果，不是用相等测试自动推断的标签。",
        "fix": "沿产生该张量的运算推导是否缺少归约，并明确 reduction 类型和参与组。"
      },
      {
        "wrong": "一个 rank 没有样本，就跳过后续 redistribution。",
        "why": "同组其他 rank 仍可能进入 collective，参与序列不一致会挂起或超时，和张量数学本身无关。",
        "fix": "让所有组成员遵守一致的 collective 顺序；用 rank、group、序号及 shape 日志定位最早分叉。"
      }
    ],
    "check": {
      "prompt": "本例沿 TP 从 Shard(0) 转成 Replicate 后，每个本地 shape 是多少？此时把 rank 0 与 rank 1 的本地值相加会得到什么？",
      "hint": "复制布局表示每个 rank 已持有同一完整值，不再是切片或部分和。",
      "answer": "每个本地 shape 变为 [4,2]；两个本地值都等于 full，直接相加得到 2×full。这说明布局转换后，后续代码的归约习惯也必须随语义调整，不能继续按原来的部分和处理。"
    },
    "transfer": "给复杂模型画张量流图时，每条边同时标 global shape、local shape、placement、dtype 与通信组。先用一维 TP 走通，再增加 DP 或 FSDP 维。保存、重分片恢复和残差连接都以全局语义为标准，不以本地张量“看起来差不多”为标准。"
  },
  "deployment-1": {
    "scenario": "训练结束后，把权重加载到服务里，预测却与离线结果不同。先别立刻归因于设备精度：预处理、模块模式和输出解释都可能变了。一个可靠的推理入口应明确接收什么、拒绝什么，以及如何验证加载前后同一输入仍得到同一函数。本例用固定权重让你能手算参考 logits，再把这些约定变成执行检查。",
    "prerequisites": [
      "nn-4",
      "autograd-3"
    ],
    "terms": [
      {
        "name": "推理输入契约",
        "meaning": "包含名称、shape、dtype、允许范围、预处理和标签含义。模型文件不自动记录完整业务契约。"
      },
      {
        "name": "eval 与 grad mode",
        "meaning": "eval 改变 Dropout/BatchNorm 等模块行为；grad mode 决定是否记录可微运算。二者独立，需要分别设定。"
      },
      {
        "name": "state_dict",
        "meaning": "保存参数与持久 buffers 的映射，不等于完整 Python 程序，也不自动保存预处理或模块的 train/eval 状态。"
      }
    ],
    "observe": "在模式图解依次切换 eval、eval + no_grad、eval + inference_mode：关注“模块行为”和“是否记录梯度”两条独立线。下面先展示 eval 的结果仍需要梯度，再进入纯推理接口。不能只看到预测稳定，就断言 autograd 开销已经关闭。",
    "walkthrough": {
      "title": "建立固定 logits，再验证保存与输入边界",
      "intro": "CPU 可运行的未训练小模型，仅用于推理契约检查。使用内存 BytesIO 保存权重，不创建或下载模型文件；概率只演示 softmax，不代表经过置信度校准。",
      "code": "import io\nimport torch\nfrom torch import nn\n\nmodel = nn.Sequential(nn.Linear(2, 2), nn.Dropout(0.5)).eval()\nwith torch.no_grad():\n    model[0].weight.copy_(torch.tensor([[1., 0.], [0., 2.]]))\n    model[0].bias.copy_(torch.tensor([0.5, -0.5]))\nx = torch.tensor([[1., 2.]])\nprint(f\"eval_requires_grad={model(x).requires_grad}\")\n\n@torch.inference_mode()\ndef predict(net, features):\n    if features.dtype != torch.float32:\n        raise ValueError(\"expected float32\")\n    if features.ndim != 2 or features.shape[1] != 2 or not 1 <= features.shape[0] <= 8:\n        raise ValueError(\"expected [B,2], 1 <= B <= 8\")\n    if not torch.isfinite(features).all():\n        raise ValueError(\"input must be finite\")\n    return net(features)\nlogits = predict(model, x)\nprobs = logits.softmax(-1)\nprint(f\"logits={logits.tolist()} probabilities={[round(v, 6) for v in probs[0].tolist()]}\")\n\nbuffer = io.BytesIO()\ntorch.save(model.state_dict(), buffer)\nbuffer.seek(0)\nloaded = nn.Sequential(nn.Linear(2, 2), nn.Dropout(0.5))\nloaded.load_state_dict(torch.load(buffer, map_location=\"cpu\", weights_only=True), strict=True)\nloaded.eval()\ntorch.testing.assert_close(predict(loaded, x), logits)\nprint(f\"inference_requires_grad={logits.requires_grad} loaded_equal=True\")\nrejected = 0\nfor bad in (torch.ones(1, 3), torch.tensor([[float(\"nan\"), 0.]])):\n    try:\n        predict(loaded, bad)\n    except ValueError:\n        rejected += 1\nassert rejected == 2\nprint(f\"rejected_inputs={rejected}\")",
      "output": "eval_requires_grad=True\nlogits=[[1.5, 3.5]] probabilities=[0.119203, 0.880797]\ninference_requires_grad=False loaded_equal=True\nrejected_inputs=2\n",
      "steps": [
        {
          "title": "先固定模型与参考输入",
          "lines": [
            1,
            10
          ],
          "explanation": "eval 关闭这里 Dropout 的随机丢弃，因此线性输出可手算为 [1×1+0.5,2×2−0.5]=[1.5,3.5]。但是线性层参数仍默认 requires_grad=True，普通 forward 仍产生计算图，所以打印 True。x 自己不需要梯度不代表参数也不需要梯度；判断是否追踪运算要看整条求导路径，而不是只看输入。",
          "state": "模块处于 eval；当前普通 forward 仍记录参数求导路径。"
        },
        {
          "title": "把约定放在模型调用之前",
          "lines": [
            12,
            23
          ],
          "explanation": "入口要求二维、特征数 2、batch 在 1 到 8、float32 且全部有限值。这里只接收 CPU Tensor，没有隐式设备迁移或 dtype 修正，方便错误直接暴露。inference_mode 关闭本调用的梯度记录，但不会替 net 调用 eval，模式已由构造时设好。softmax 的比值由 logits 差 2 决定，得到约 [0.119203,0.880797]；这只是数值归一化，不证明后一个类别有 88% 的现实正确率。",
          "state": "输入契约通过 → logits [B,2] → 按最后一维解释类别。"
        },
        {
          "title": "重新加载后比较相同函数",
          "lines": [
            25,
            40
          ],
          "explanation": "重建相同结构、严格匹配权重键、显式使用 CPU，再单独调用 eval。若省掉 eval，新模块的 Dropout 默认处于训练行为，权重即使完全相同也可能给出不同输出。最后用错误特征数与 NaN 检验拒绝路径，而不只验证正常样本。真实部署还要在预处理后、加载后、转换精度后逐段比较同一组固定样本，定位第一次发生偏差的边界。",
          "state": "state_dict 恢复参数；eval 恢复推理行为；一致性检查恢复函数证据。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "为了让加载成功，看到键不匹配就一律 strict=False。",
        "why": "缺少的层可能保留随机参数，额外键也可能说明结构或版本不匹配，文件能读不代表模型恢复正确。",
        "fix": "解释每一个 missing/unexpected key，只对有意替换的模块制定规则，并比较固定输入 logits。"
      },
      {
        "wrong": "冻结特征提取器后，把训练新 head 的整个过程也放进 inference_mode。",
        "why": "head 的训练仍需 autograd；inference tensor 在后续需要被保存以反向求导时也存在限制。",
        "fix": "按梯度边界使用 no_grad 提取固定特征，再在正常 grad mode 训练 head；纯推理入口再使用 inference_mode。"
      }
    ],
    "check": {
      "prompt": "如果去掉 loaded.eval()，但保留 predict 上的 inference_mode，能保证输出等于原模型吗？",
      "hint": "查看新建 Dropout 默认的 training 状态，与是否记录梯度分开判断。",
      "answer": "不能。inference_mode 只控制自动求导相关行为，Dropout 仍可能随机丢弃并缩放激活。新加载的参数相同，但执行模式不同，因此必须显式切到 eval，再做固定输入一致性比较。"
    },
    "transfer": "为每个模型保存一小组原始输入、预处理张量与参考 logits。上线验收逐层比较，而不是只看 HTTP 200 或最终 argmax。单条与批处理也应在合理浮点容差内一致；对边界分数变化，再结合验证集指标决定是否接受。"
  },
  "deployment-2": {
    "scenario": "你希望一个导出图接收不同 batch，却始终要求每条样本有同样的特征数。“动态”不是取消约束，而是用符号表达被允许变化的轴。但图成立的条件与服务愿意接收的输入范围并非同一件事。下面把模型简化为二维仿射变换，在入口明确要求 batch 为 2 到 8，验证保存重载后的图在合法形状上与 eager 一致，同时拒绝过小、过大和错误特征数的输入。",
    "prerequisites": [
      "deployment-1",
      "performance-3"
    ],
    "terms": [
      {
        "name": "ExportedProgram",
        "meaning": "捕获的张量计算图及其状态、输入输出结构和有效性约束；它不是完整 HTTP 服务或任意 Python 程序包。"
      },
      {
        "name": "符号维 Dim",
        "meaning": "用一个符号表示可变化的维度，并附加允许范围或关系；没有声明动态的维度仍受示例输入和图约束限制。"
      },
      {
        "name": "guard / 约束检查",
        "meaning": "图的 guard 检查用于保护捕获时的有效性假设，不能当作完整业务输入验证器。服务要求的最小 batch、非空条件等应在入口显式校验。"
      }
    ],
    "observe": "导出图解展示 batch 可变而特征维固定。下面缩小到 2 个特征、batch 最大 8 方便手算；第零轴动态不意味着第一轴也动态。图上标出的范围是预期输入契约，实际接口应主动执行它，不能仅凭 Dim 声明就认为每个越界输入都会被导出模块拒绝。",
    "walkthrough": {
      "title": "让合法范围成为可运行的合同",
      "intro": "真实 CPU torch.export 示例，显式 strict=True，在内存中保存并加载 ExportedProgram。本地 PyTorch 2.14.1 的导出模块仍接受 batch=0 或 1，即使 Dim(min=2)；因此用独立入口执行业务范围检查。该检查不依赖版本内部 guard 是否额外拒绝某个尺寸。",
      "code": "import io\nimport torch\nfrom torch import nn\n\nclass Affine(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.register_buffer(\"weight\", torch.tensor([[1., 0.], [0., 2.]]))\n        self.register_buffer(\"bias\", torch.tensor([0.5, -0.5]))\n    def forward(self, x):\n        return torch.relu(x @ self.weight.T + self.bias)\nmodel = Affine().eval()\nexample = torch.ones(4, 2)\n\nbatch = torch.export.Dim(\"batch\", min=2, max=8)\nep = torch.export.export(model, (example,), dynamic_shapes=({0: batch},), strict=True)\nbuffer = io.BytesIO()\ntorch.export.save(ep, buffer)\nbuffer.seek(0)\nrestored = torch.export.load(buffer).module()\n\ndef run_checked(x):\n    if x.ndim != 2 or x.shape[1] != 2:\n        raise ValueError(\"expected rank-2 tensor with 2 features\")\n    if not 2 <= x.shape[0] <= 8:\n        raise ValueError(\"expected batch in [2,8]\")\n    return restored(x)\n\nwith torch.inference_mode():\n    for n in (2, 4, 8):\n        x = torch.ones(n, 2)\n        y = run_checked(x)\n        torch.testing.assert_close(y, model(x))\n        print(f\"batch={n} shape={tuple(y.shape)} sum={y.sum():.0f}\")\n    rejected = 0\n    for bad in (torch.ones(0, 2), torch.ones(1, 2), torch.ones(9, 2), torch.ones(4, 3)):\n        try:\n            run_checked(bad)\n        except ValueError:\n            rejected += 1\n    assert rejected == 4\n    print(f\"rejected_shapes={rejected}\")",
      "output": "batch=2 shape=(2, 2) sum=6\nbatch=4 shape=(4, 2) sum=12\nbatch=8 shape=(8, 2) sum=24\nrejected_shapes=4\n",
      "steps": [
        {
          "title": "使函数和示例都可解释",
          "lines": [
            1,
            13
          ],
          "explanation": "每行输入 [1,1] 产生 [1.5,1.5]，ReLU 不改变它，因此每行总和是 3。weight 与 bias 注册为 buffers，导出会把模型状态纳入程序；本例不进行训练，所以无需可训练 Parameter。输入名称 x、位置参数元组及张量两条轴各有不同含义，dynamic_shapes 必须对应 forward 的输入结构，而不是任意给图起几个名字。",
          "state": "示例输入 [4,2]；输出 [4,2]；每行输出之和 3。"
        },
        {
          "title": "声明动态图，再落实入口范围",
          "lines": [
            15,
            27
          ],
          "explanation": "字典键 0 指张量的第零轴；外层元组对应 forward 的第一个位置输入。第二轴没有声明动态，仍为 2。strict=True 约束捕获过程，并不保证所有业务边界都自动成为运行时拒绝规则；本地版本对最小值 2 的范围没有据此拒绝 batch=0/1。run_checked 因而在执行导出图前主动检查 rank、特征数和 2≤B≤8。保存后再加载保证后续计算经过真实产物路径，最终部署运行时仍需另一次同输入验证。",
          "state": "Dim 描述图的动态假设；run_checked 强制执行接口契约：2≤B≤8、特征维=2。"
        },
        {
          "title": "合法样本与拒绝路径一起检查",
          "lines": [
            29,
            42
          ],
          "explanation": "最小、常见、最大 batch 的输出总和分别为 6、12、24，且逐元素与 eager 对照。batch=0/1 低于业务下限，9 超出上限，特征=3 改变了固定维；四种输入都由入口以 ValueError 拒绝。这样不会把“某版本的图碰巧拒绝输入”误当成自己的校验功能。图约束仍负责计算成立的条件，入口则提供稳定、可解释的拒绝语义；有限样本对照也不等于所有输入数值的形式证明。",
          "state": "合法 batch=2/4/8 通过；0/1/9 与错误特征数在执行图之前被拒绝。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "只写 Dim(min=2,max=8)，就认为导出模块一定严格拒绝所有范围外输入。",
        "why": "图的符号推导和运行时检查有特殊规则；本地 PyTorch 2.14.1 的重载模块仍接受 batch=0/1。strict=True 也不能替代接口验证。",
        "fix": "在入口显式检查业务范围、非空条件与输入结构；同时验证合法边界及每一种拒绝路径。"
      },
      {
        "wrong": "导出文件成功生成，就说明目标运行时兼容且更快。",
        "why": "图产物只是一个边界；目标后端还可能不支持算子、dtype 或动态形状，运行速度也取决于编译和设备。",
        "fix": "先在最终运行时比较相同输入的输出，再测冷启动、预热后性能与允许 shape 的覆盖。"
      }
    ],
    "check": {
      "prompt": "如果删除 run_checked，仅调用声明了 Dim(min=2,max=8) 的导出模块，能保证 batch=1 被拒绝吗？把 max 改为 16，又能接收 [8,3] 吗？",
      "hint": "分别检查图的有效性条件、业务 batch 范围和固定特征维，三者不能相互代替。",
      "answer": "不能保证 batch=1 被拒绝；本地 PyTorch 2.14.1 的导出模块就会接受它，所以业务下限必须显式校验。max 改为 16 只调整 batch 轴的声明，不改变固定特征维 2，[8,3] 仍不符合输入契约。若模型还有 reshape 整除关系，也必须单独满足。"
    },
    "transfer": "为导出建立规格表：输入名、dtype、每条轴的固定值或范围、额外整除关系。区分图成立的约束与业务接口的拒绝规则，不把 Dim 当完整输入校验器。模型、导出重载产物和最终 runtime 使用同一套固定输入，并在服务入口测试空、过小、过大及错误结构。遇到约束错误先判断真实需求，避免为导出成功而删掉必要的数据分支。"
  },
  "deployment-3": {
    "scenario": "把浮点权重压成 int8 后文件可能变小，但预测误差从哪里来？不能只说“位数少所以不准”。量化先选择一把刻度尺，再把每个值映射到整数格点；误差既来自舍入，也可能来自范围外的截断。本例逐步算出这两类误差，再用量级差很多的两行权重解释为什么 per-channel scale 有时更合适。",
    "prerequisites": [
      "tensor-3",
      "deployment-2"
    ],
    "terms": [
      {
        "name": "scale 与 zero_point",
        "meaning": "常用仿射量化 x̂=(q−z)×s 中的步长 s 和零点 z；本例对称量化 z=0，整数范围选 [−127,127]。"
      },
      {
        "name": "舍入与饱和截断",
        "meaning": "舍入把范围内值挪到最近格点；clamp 把超范围值压到边界。前者通常与步长相关，后者可能产生大得多的误差。"
      },
      {
        "name": "per-tensor / per-channel",
        "meaning": "整张权重共用一个 scale，或按输出通道分别选 scale。更细粒度常能降低量级差异造成的误差，但增加元信息和内核要求。"
      }
    ],
    "observe": "沿量化图解观察 x→整数 q→反量化 x̂，特别检查 ±0.5：scale=1/127 时落在 ±63.5，示例按半整数向偶数舍入到 ±64。下面再加入 1.5，观察超出校准范围时的截断误差；图中的 [-1,1] 不能代表所有未来激活。",
    "walkthrough": {
      "title": "同样是 int8，刻度选择会改变什么",
      "intro": "CPU 浮点模拟量化公式，不调用 TorchAO 或 int8 推理内核，也不导出 ONNX；用于数值语义验证。没有由此宣称压缩文件、真实内存或推理速度已经改善。",
      "code": "import torch\n\nx = torch.tensor([-1., -0.5, 0., 0.5, 1.], dtype=torch.float64)\nscale = 1.0 / 127\nq = torch.round(x / scale).clamp(-127, 127).to(torch.int8)\nrestored = q.to(torch.float64) * scale\nerror = (restored - x).abs()\nprint(f\"q={q.tolist()}\")\nprint(f\"restored={[round(v, 6) for v in restored.tolist()]} max_error={error.max():.6f}\")\n\noutside = torch.tensor([1.5], dtype=torch.float64)\noutside_q = torch.round(outside / scale).clamp(-127, 127)\noutside_restored = outside_q * scale\nprint(f\"clipped={outside_restored.item():.3f} error={(outside_restored - outside).abs().item():.3f}\")\n\nweights = torch.tensor([[0.01, 0.02], [10., 20.]], dtype=torch.float64)\ntensor_scale = weights.abs().max() / 127\nchannel_scale = weights.abs().amax(dim=1, keepdim=True) / 127\nqt = torch.round(weights / tensor_scale).clamp(-127, 127) * tensor_scale\nqc = torch.round(weights / channel_scale).clamp(-127, 127) * channel_scale\nprint(f\"per_tensor_first={[round(v, 6) for v in qt[0].tolist()]}\")\nprint(f\"per_channel_first={[round(v, 6) for v in qc[0].tolist()]}\")\nassert (qc[0] - weights[0]).abs().max() < (qt[0] - weights[0]).abs().max()",
      "output": "q=[-127, -64, 0, 64, 127]\nrestored=[-1.0, -0.503937, 0.0, 0.503937, 1.0] max_error=0.003937\nclipped=1.000 error=0.500\nper_tensor_first=[0.0, 0.0]\nper_channel_first=[0.010079, 0.02]\n",
      "steps": [
        {
          "title": "先定义量化网格",
          "lines": [
            1,
            9
          ],
          "explanation": "两端 ±1 映射到 ±127，可精确还原；0 映射为 0。±0.5 除以 scale 得到 ±63.5，torch.round 的半整数规则得到 ±64，因此反量化约为 ±0.503937，误差约 0.003937。对不发生截断的最近舍入，误差不超过半个步长 s/2；这句话需要“未饱和”前提，不能推广到任意越界值。",
          "state": "离散整数范围 255 个格点；有效步长 1/127，非所有实数都能精确表示。"
        },
        {
          "title": "区分舍入误差与范围错误",
          "lines": [
            11,
            14
          ],
          "explanation": "输入 1.5 理想上需要 190.5 号格点，但整数范围最多到 127，因此 clamp 后只能还原为 1，误差变成 0.5，远大于 s/2。静态激活量化的校准集需要覆盖真实幅度和长尾；若未来数据分布变化，仅观察少量常见值上的舍入误差会漏掉严重饱和。动态量化在运行时估计尺度也有额外代价与设计选择。",
          "state": "范围内误差主要来自格点；范围外误差由边界截断主导。"
        },
        {
          "title": "按通道选刻度，保护小量级权重",
          "lines": [
            16,
            23
          ],
          "explanation": "整体最大值是 20，所以共享步长约 0.15748；第一行的 0.01、0.02 都不到半格，被舍入成零。逐行尺度为 0.02/127 与 20/127，第一行可恢复约 [0.010079,0.02]，保留了它的相对结构。对线性层，行对应输出通道，因此这里的维度选择有明确含义。真实全零通道还需避免 scale=0，本例每行非零以隔离主要现象。",
          "state": "per-tensor 小行归零；per-channel 用各行自己的动态范围。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "导出 ONNX 会自动把模型量化，或 int8 模型必然更快。",
        "why": "格式转换与数值表示是两条独立路径；速度还取决于目标算子支持、布局转换、反量化与矩阵尺寸。",
        "fix": "先建立最终 runtime 的浮点基线，再逐项引入量化，比较质量、实际存储、峰值和稳定吞吐。"
      },
      {
        "wrong": "只比较平均权重误差，就能断言业务质量不变。",
        "why": "误差会经过后续层放大或抵消，不同通道重要性也不同；少量决策边界样本可能受到较大影响。",
        "fix": "同时测代表性输入的 logits 误差、任务指标与关键子集，必要时评估更细粒度、混合精度或 QAT。"
      }
    ],
    "check": {
      "prompt": "如果继续使用 scale=1/127，输入值为 2，反量化结果和误差是多少？把 scale 改成 2/127 又有什么代价？",
      "hint": "先看旧整数上界，再比较新旧两把刻度尺的间距。",
      "answer": "旧范围会把 2 截断到 1，绝对误差为 1。改成 2/127 后可以覆盖 ±2，但格点间距翻倍，范围内的最坏舍入误差上界也从 1/254 变为 1/127。扩大范围与保留细节之间存在明确权衡。"
    },
    "transfer": "选择量化方案时，先明确权重与激活分别如何量化、按什么轴或组共享尺度、何时估计范围，以及目标后端是否有对应内核。TorchAO 配置版本、PyTorch 包版本和 ONNX opset 是不同概念，应分别记录并在目标环境验证。"
  },
  "deployment-4": {
    "scenario": "把三个请求一次送入模型，矩阵计算可能更有效率，但等待成批也会让最早到达的人更慢。与此同时，服务还可能发生一种更隐蔽的错误：每个输出数值都正确，却发给了错误的请求。先验证单条与批处理按请求 ID 一致，再用明确的假想时间线分解等待和执行，才能同时讨论正确性与延迟。",
    "prerequisites": [
      "deployment-1",
      "performance-1"
    ],
    "terms": [
      {
        "name": "请求 ID 与 batch 行号",
        "meaning": "ID 是端到端关联键，行号只是当前计算批次里的临时位置；排序、分桶或重试后必须重新映射。"
      },
      {
        "name": "排队时间与端到端延迟",
        "meaning": "排队时间从到达直到开始服务；端到端延迟从到达直到结果完成，还包括执行及必要的前后处理。"
      },
      {
        "name": "背压",
        "meaning": "处理能力不足时限制接入、排队或明确拒绝，防止无上限积压让延迟持续增长。"
      }
    ],
    "observe": "切换图解“逐请求执行”和“等待后批处理”，读 A 的延迟为何从 4 变为 7 ms，再读 C 为什么从 10 变为 5 ms。空白是请求尚未到达，不应计为等待。所有时间都来自图中的假设，下面代码复算同一组数字，实际服务需重新测量。",
    "walkthrough": {
      "title": "先证明结果没有错配，再讨论批处理收益",
      "intro": "CPU 同步批处理计算核心，不是 HTTP 服务或动态队列实现。固定线性模型保证样本之间独立；计时部分仅复现给定时间线，不进行性能压测。",
      "code": "import torch\nfrom torch import nn\n\nmodel = nn.Linear(2, 2, bias=False).eval()\nwith torch.no_grad():\n    model.weight.copy_(torch.tensor([[1., 1.], [-1., 1.]]))\nrequests = [(\"r2\", torch.tensor([1., 2.])),\n            (\"r0\", torch.tensor([3., 4.])),\n            (\"r1\", torch.tensor([5., 6.]))]\n\n@torch.inference_mode()\ndef infer(items, size):\n    if type(size) is not int or size <= 0:\n        raise ValueError(\"batch size must be a positive integer\")\n    ids = [key for key, _ in items]\n    if any(not isinstance(key, str) for key in ids) or len(set(ids)) != len(ids):\n        raise ValueError(\"request IDs must be unique strings\")\n    result, sizes = {}, []\n    for start in range(0, len(items), size):\n        chunk = items[start:start + size]\n        features = torch.stack([value for _, value in chunk])\n        rows = model(features)\n        sizes.append(len(chunk))\n        for (key, _), row in zip(chunk, rows):\n            result[key] = row.clone()\n    return result, sizes\nbatched, sizes = infer(requests, 2)\nsingle, _ = infer(requests, 1)\nfor key, _ in requests:\n    torch.testing.assert_close(batched[key], single[key])\nprint(f\"batch_sizes={sizes}\")\nprint(f\"by_id={ {key: value.tolist() for key, value in batched.items()} }\")\nprint(\"individual_equal=True\")\n\narrivals = [0, 1, 2]\nsingle_ends = [4, 8, 12]\nbatch_ends = [7, 7, 7]\nsingle_latency = [end - start for end, start in zip(single_ends, arrivals)]\nbatch_latency = [end - start for end, start in zip(batch_ends, arrivals)]\nprint(f\"single_latency_ms={single_latency} batch_latency_ms={batch_latency}\")\nassert single_latency == [4, 7, 10] and batch_latency == [7, 6, 5]",
      "output": "batch_sizes=[2, 1]\nby_id={'r2': [3.0, 1.0], 'r0': [7.0, 1.0], 'r1': [11.0, 1.0]}\nindividual_equal=True\nsingle_latency_ms=[4, 7, 10] batch_latency_ms=[7, 6, 5]\n",
      "steps": [
        {
          "title": "让输入与请求身份保持绑定",
          "lines": [
            1,
            9
          ],
          "explanation": "模型对 [a,b] 输出 [a+b,b−a]，所以三个请求各自是 [3,1]、[7,1]、[11,1]。请求 ID 故意不按字典序排列，防止代码误把排序后的 ID 与原行顺序配对。实际服务即使按长度排序以减少 padding，也应连同 ID 一起移动，并在输出时恢复映射；只比较预测类别分布可能完全发现不了这种错配。",
          "state": "三条独立样本，每行两个特征；身份与特征作为一对传递。"
        },
        {
          "title": "处理尾批，逐 ID 对照结果",
          "lines": [
            11,
            33
          ],
          "explanation": "batch 上限为 2，所以实际大小是 [2,1]，尾部请求不能丢弃。输入先检查 batch_size 和 ID，避免负步长导致静默空结果、重复 ID 导致字典覆盖。每个输出 row 重新绑定同一 chunk 中的 key，再按 ID 与逐条结果对照。示例假设特征均合法且同维，真实入口还需检查 dtype、shape 和有限值；含跨样本统计或共享状态的模型也不能直接套用独立性假设。",
          "state": "计算可重排，响应身份不变；尾批仍有一次明确执行。"
        },
        {
          "title": "把完成时间减去各自到达时间",
          "lines": [
            35,
            41
          ],
          "explanation": "逐条串行时三个请求在 4、8、12 ms 完成，各自到达于 0、1、2，所以延迟是 4、7、10 ms。批处理在 2 ms 开始，假设计算 5 ms，三者都在 7 ms 完成，因此延迟为 7、6、5 ms。A 因等其他请求而慢了，B、C 因少排队而快了。这个小样本均值下降不能替代真实 P95、错误率或稳定吞吐测量，也没有把传输和前处理纳入假设。",
          "state": "延迟分母是每条请求自己的到达时刻；完成时刻不是延迟。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "为了等到最大 batch，低流量时也一直等待。",
        "why": "最大 batch 只是容量上限；没有最大等待时间时，少量请求可能永远凑不齐，造成无界延迟。",
        "fix": "同时设置最大 batch、最大等待时间、队列容量、请求截止时间与取消策略，并记录实际 batch 分布。"
      },
      {
        "wrong": "把 CPU forward 返回时刻当作 GPU 完成时刻。",
        "why": "CUDA 通常异步发射，返回可能只表示任务已经排入队列，不包含真实设备完成时间。",
        "fix": "内核实验用适当 CUDA events；端到端实验按结果可交付的边界计时，避免为打点引入不必要的全局同步。"
      }
    ],
    "check": {
      "prompt": "本例批次在 7 ms 完成，是否能说三个请求延迟都是 7 ms？若只看排序后的输出集合，能发现 r2 与 r1 的响应交换吗？",
      "hint": "分别检查时间的起点，以及输出正确性是否包含请求关联。",
      "answer": "不能，三个到达时刻不同，所以延迟是 7、6、5 ms。只比较排序后的输出集合也发现不了交换，因为数值集合没变；必须按原请求 ID 比较对应输出。这两点分别防止计时口径错误和响应错配。"
    },
    "transfer": "优化在线推理时先固定输入契约与 ID 一致性，再扫描 batch 上限和等待窗口。报告代表性流量下的实际 batch、排队占比、端到端 P50/P95、吞吐与错误率。过载时检查队列是否有界；离线吞吐最优值不应直接当作在线延迟配置。"
  }
};
