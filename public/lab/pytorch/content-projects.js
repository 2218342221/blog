window.COURSE_PROJECTS = [
  {
    "id": "models",
    "number": 5,
    "title": "经典模型与迁移学习",
    "subtitle": "从视觉到序列，从零训练到适配",
    "description": "实现 CNN、循环网络、序列分类与低秩适配，掌握形状、状态和数据契约。",
    "level": "高阶",
    "color": "#ed9321",
    "icon": "rocket",
    "lessons": [
      {
        "id": "models-1",
        "title": "CNN、感受野与残差网络",
        "description": "从卷积尺寸到归一化行为，写出能解释的视觉模型。",
        "duration": 25,
        "difficulty": "高阶",
        "objectives": [
          "计算卷积输出与有效感受野",
          "实现形状匹配的残差块",
          "区分 BatchNorm 与 GroupNorm 的统计范围"
        ],
        "sections": [
          {
            "heading": "卷积是在共享局部计算，而不只是一个层名",
            "body": "PyTorch Conv2d 的常见输入布局为 [N,C,H,W]，卷积核参数通常为 [Cout,Cin/groups,Kh,Kw]。对单个空间轴，输出尺寸为 floor((输入+2×padding−dilation×(kernel−1)−1)/stride+1)。通道维和空间维不能互换：把 [N,H,W,C] 直接传入普通 Conv2d，可能报错，也可能在碰巧维度匹配时悄悄学错含义。\n\n卷积核在不同位置共享参数，适合利用局部相关性。groups=1 是普通卷积，groups=Cin 且 Cout 为 Cin 的整数倍时可构造深度卷积；减少乘加量不保证真实设备更快，还取决于内核、通道规模和内存访问。"
          },
          {
            "heading": "逐层计算感受野，而不是只数卷积层",
            "body": "设某层输入的有效步距为 j、感受野为 r，卷积核大小为 k、步幅为 s、膨胀率为 d，则新步距 j′=j×s，新感受野 r′=r+(k−1)×d×j。从输入 r=1、j=1 出发，两层 3×3、stride=1 的卷积得到 5×5 理论感受野；若第一层 stride=2，第二层会覆盖更稀疏的原图位置。\n\n理论感受野只表示可能依赖的区域，不表示所有像素贡献相等。练习为三层网络列出特征图尺寸、步距和感受野，然后解释为什么早期下采样可以节约计算，却可能丢失小目标或细节。"
          },
          {
            "heading": "残差相加要求形状和语义对齐",
            "body": "残差块输出 y=F(x)+x，为优化提供更直接的信息和梯度路径。当 stride 或通道数变化时，shortcut 必须用投影把形状对齐。下面是可在 CPU 运行的教学残差块，采用两层卷积与 BatchNorm；它不是完整 ResNet 复现，也没有声称达到特定准确率。\n\n构建后先检查前向 shape，再反向一次确认卷积与投影都获得梯度。仅让代码不报错还不够，错误地广播某个维度也可能让相加成功，因此应显式核对 [N,C,H,W] 四个维度。",
            "code": "import torch\nfrom torch import nn\n\nclass ResidualBlock(nn.Module):\n    def __init__(self, cin, cout, stride=1):\n        super().__init__()\n        self.body = nn.Sequential(\n            nn.Conv2d(cin, cout, 3, stride, 1, bias=False),\n            nn.BatchNorm2d(cout), nn.ReLU(),\n            nn.Conv2d(cout, cout, 3, 1, 1, bias=False),\n            nn.BatchNorm2d(cout))\n        self.skip = (nn.Identity() if cin == cout and stride == 1\n                     else nn.Sequential(\n                         nn.Conv2d(cin, cout, 1, stride, bias=False),\n                         nn.BatchNorm2d(cout)))\n    def forward(self, x):\n        return torch.relu(self.body(x) + self.skip(x))\n\nblock = ResidualBlock(3, 16, stride=2)\ny = block(torch.randn(4, 3, 32, 32))\nassert y.shape == (4, 16, 16, 16)\ny.mean().backward()",
            "language": "python"
          },
          {
            "heading": "归一化的统计对象决定训练和推理差异",
            "body": "BatchNorm2d 在训练时对每个通道沿 batch 和空间维估计统计量，并通常更新 running_mean 与 running_var；eval 模式通常使用这些运行统计。小 batch 或明显变化的数据分布可能使统计量不稳定。GroupNorm 对每个样本内部的通道组及空间维归一化，不依赖跨样本 batch 统计，因此常用于小 batch 场景；它也不保证所有任务都优于 BatchNorm。\n\n本课对照 PyTorch 0506d907c966 的 conv.py 与 batchnorm.py。阅读任务：定位 Conv2d 参数形状、BatchNorm 的 running buffers，再在相同输入上比较 train 与 eval 输出。说明冻结参数后，为什么 BatchNorm 的运行统计仍可能发生变化，并写出验证办法。",
            "callout": "model.eval() 改变模块行为，requires_grad_(False) 改变梯度需求；冻结 BatchNorm 时两者不可互相替代。"
          }
        ],
        "takeaways": [
          "卷积尺寸与感受野需要逐层推导",
          "残差连接要求主分支与 shortcut 对齐",
          "归一化选择必须考虑 batch 与部署分布"
        ],
        "references": [
          {
            "label": "Conv2d：参数与输出形状",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/nn/modules/conv.py"
          },
          {
            "label": "BatchNorm：训练与推理行为",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/nn/modules/batchnorm.py"
          }
        ],
        "quiz": [
          {
            "id": "models-1-q1",
            "type": "single",
            "prompt": "32×32 输入经过 kernel=3、stride=2、padding=1、dilation=1 的卷积，空间输出是？",
            "options": [
              "16×16",
              "17×17",
              "32×32",
              "15×15"
            ],
            "answer": 0,
            "explanation": "代入输出公式 floor((32+2−2−1)/2+1)=16。padding 不代表输出尺寸必然不变，stride=2 仍会下采样。",
            "topic": "CNN"
          },
          {
            "id": "models-1-q2",
            "type": "single",
            "prompt": "连续两层 3×3、stride=1、dilation=1 卷积的理论感受野是？",
            "options": [
              "3×3",
              "9×9",
              "4×4",
              "5×5"
            ],
            "answer": 3,
            "explanation": "从 r=1、j=1 开始，每层增加 2，最终 r=5；感受野边长不是把两个卷积核边长相乘。",
            "topic": "感受野"
          },
          {
            "id": "models-1-q3",
            "type": "single",
            "prompt": "只把 BatchNorm 参数 requires_grad 设为 False，但保留 train 模式，哪个状态仍可能改变？",
            "options": [
              "卷积核尺寸",
              "模块名称",
              "running_mean 和 running_var",
              "输入通道数"
            ],
            "answer": 2,
            "explanation": "运行均值和方差是 buffers，不通过梯度更新，而是在训练前向中更新。冻结可学习参数并不关闭这种状态更新。",
            "topic": "归一化"
          }
        ]
      },
      {
        "id": "models-2",
        "title": "RNN、LSTM、GRU 与变长序列",
        "description": "追踪循环隐状态，避免把 padding 当成真实时间步。",
        "duration": 25,
        "difficulty": "高阶",
        "objectives": [
          "理解循环网络的状态与梯度",
          "读取双向多层 LSTM 的张量形状",
          "使用 PackedSequence 处理变长输入"
        ],
        "sections": [
          {
            "heading": "递归状态把序列历史压进一个向量",
            "body": "普通 RNN 每一步根据当前输入 x_t 与前一隐状态 h_{t−1} 计算新状态。长序列反向传播需要跨许多时间步，反复相乘的雅可比可能让梯度消失或爆炸。LSTM 用输入门、遗忘门、输出门以及 cell state 建立更灵活的记忆路径；GRU 用更简洁的门结构折中参数量与表达能力。它们缓解问题，但不保证无限长序列上没有梯度困难。\n\n序列模型适用于文本，也适用于时序传感器、轨迹和音频特征。训练时可做梯度裁剪，但要检查裁剪前梯度范数分布；长期每步被强烈裁剪可能意味着学习率、数据尺度或目标设计有问题。"
          },
          {
            "heading": "batch_first 不改变隐状态的轴顺序",
            "body": "对于 batch_first=True 的 LSTM，输入和逐时间步输出以 [B,T,F] 排列，但 h_n 和 c_n 仍以 [层数×方向数,B,H] 排列。双向 LSTM 的输出特征维通常是 2H。多层双向模型中，最后一层的前向最终隐状态在 h_n[-2]，反向最终隐状态在 h_n[-1]，可拼成 [B,2H] 的序列表示。\n\n不要把 output[:,-1] 无条件当作整条双向序列的最终表示：它既可能指向 padding 位置，也不一定对应反向网络汇总完整序列的终态。阅读 API 时要分别核对逐时刻输出和最终隐状态的语义。"
          },
          {
            "heading": "pack 让循环网络跳过无效时间步",
            "body": "常见 batch 为右侧 padding 的 [B,T,F]，lengths 记录每个样本的有效长度。pack_padded_sequence 把这些序列转换成适合循环层处理的 PackedSequence，长度张量传入该接口时应放在 CPU；enforce_sorted=False 允许输入未按长度排序。长度必须正数且不能超过真实张量长度，pack 不是自动修正坏数据的工具。\n\n下面代码用双向两层 LSTM 处理三条不同长度的序列。pack 与 pad 的 API、隐状态输出均对照 PyTorch 0506d907c966。实际数据还需保证 padding 位于尾部，lengths 不包含填充位置。",
            "code": "import torch\nfrom torch import nn\nfrom torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence\n\nx = torch.randn(3, 5, 7)           # [B, T, features]\nlengths = torch.tensor([5, 3, 4])  # CPU; positive lengths\npacked = pack_padded_sequence(x, lengths, batch_first=True,\n                             enforce_sorted=False)\nrnn = nn.LSTM(7, 11, num_layers=2, batch_first=True,\n              bidirectional=True)\npacked_out, (h, c) = rnn(packed)\nout, restored_lengths = pad_packed_sequence(\n    packed_out, batch_first=True, total_length=5)\nrepresentation = torch.cat([h[-2], h[-1]], dim=-1)\nassert out.shape == (3, 5, 22)\nassert representation.shape == (3, 22)",
            "language": "python"
          },
          {
            "heading": "用 padding 不变性验证序列处理",
            "body": "建立一个很有价值的检查：同一条有效序列在尾部增加若干 padding，长度仍保持不变，模型的序列表示应在合理浮点容差内保持一致。对逐 token 标签任务，loss 也必须屏蔽 padding；pack 只改变 RNN 的执行，不能自动替你完成所有标签处理和指标聚合。\n\n截断反向传播是另一项独立选择：长时间序列按片段训练时，可以在片段边界对传递的 hidden state 做 detach，限制计算图长度，但这样改变了梯度能够回传的历史范围。练习比较每片段重置状态、保留状态但 detach、整段反向三种方案的任务假设、内存和梯度差异。",
            "callout": "训练集、验证集和不同样本之间不应意外共享隐状态；stateful 模型必须明确状态的所属序列和重置边界。"
          }
        ],
        "takeaways": [
          "逐时间步输出与最终 hidden state 语义不同",
          "变长序列同时需要长度信息和正确的 loss mask",
          "detach 状态是梯度截断，不是把状态数值清零"
        ],
        "references": [
          {
            "label": "RNN / LSTM / GRU 的状态约定",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/nn/modules/rnn.py"
          },
          {
            "label": "pack 与 pad 变长序列接口",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/nn/utils/rnn.py"
          }
        ],
        "quiz": [
          {
            "id": "models-2-q1",
            "type": "single",
            "prompt": "两层双向 LSTM，B=3、H=11，h_n 的形状是什么？",
            "options": [
              "[3,4,11]",
              "[4,3,11]",
              "[3,5,22]",
              "[2,3,22]"
            ],
            "answer": 1,
            "explanation": "隐状态形状是 [num_layers×num_directions,B,H]=[4,3,11]。batch_first 只影响输入与时间步输出，不改变这个顺序。",
            "topic": "LSTM"
          },
          {
            "id": "models-2-q2",
            "type": "single",
            "prompt": "使用 pack_padded_sequence 时，lengths 应表示什么？",
            "options": [
              "每条样本真实有效时间步数",
              "隐状态维度",
              "包含 padding 的统一最大长度",
              "每条样本标签类别数"
            ],
            "answer": 0,
            "explanation": "lengths 定义每条序列参与循环计算的有效时间步，不能把尾部 padding 计入。所有样本都写最大长度等于没有正确跳过 padding。",
            "topic": "变长序列"
          },
          {
            "id": "models-2-q3",
            "type": "single",
            "prompt": "对跨片段传递的 hidden state 调用 detach() 会怎样？",
            "options": [
              "删除 LSTM 的权重",
              "把数值全部变成零",
              "自动同步多个样本的状态",
              "保留数值，但切断与之前计算图的梯度连接"
            ],
            "answer": 3,
            "explanation": "detach 保留当前状态值，阻止梯度继续流回此前片段；它不等价于重新初始化或清空 hidden state。",
            "topic": "截断反向传播"
          }
        ]
      },
      {
        "id": "models-3",
        "title": "Embedding、Padding 与序列分类",
        "description": "把离散输入到 logits 的每一步定义成清楚的数据契约。",
        "duration": 25,
        "difficulty": "高阶",
        "objectives": [
          "建立 tokenizer 与模型的输入边界",
          "正确使用 embedding 和 padding mask",
          "实现带有效长度归一化的序列分类器"
        ],
        "sections": [
          {
            "heading": "离散输入首先需要稳定的编号规则",
            "body": "PyTorch 的 Embedding 接收整数索引，不负责决定文本如何分词。字符、词、子词或离散事件都可以映射为 token ID；词表、特殊符号、截断和规范化规则属于数据管线与模型之间的契约。词表应仅用训练资料构建或来自既定预训练资源，不能把测试集统计偷偷用于模型选择。\n\n本课约定 PAD=0、UNK=1，其他符号从 2 开始，input_ids 为 int64 的 [B,T]，标签为 [B]。部署时必须保存同一套映射、最大长度和预处理规则，否则相同数字可能对应不同词，模型即使成功加载权重也会输出无意义的结果。"
          },
          {
            "heading": "padding_idx 不是通用注意力或损失屏蔽器",
            "body": "Embedding(num_embeddings, embedding_dim, padding_idx=0) 管理一个 [V,D] 的权重表，查表后得到 [B,T,D]。padding_idx 会阻止 embedding 查表操作为该行累积普通梯度，并在默认初始化时把该行设为零；它不会自动替后面的池化、循环层、注意力、loss 或准确率生成 mask。\n\n如果对所有 T 个位置直接取平均，同一条序列 padding 越多，表示向量就可能越小。正确的 masked mean 先排除填充，再除以有效 token 数；全是 padding 的样本应在数据校验阶段拒绝或按明确策略处理，clamp 只是防止除零，不能为无内容样本创造语义。"
          },
          {
            "heading": "实现一个可以检查形状的分类器",
            "body": "下面模型不依赖特定 tokenizer，只要求输入遵守编号契约。Embedding 后做 masked mean，再用线性层得到 [B,C] logits。CrossEntropyLoss 直接接收这些未经 softmax 的 logits 和 int64 类别标签，因为内部已采用数值稳定的 log-softmax 计算。训练时提前 softmax 再传入会改变优化目标的数值形式。\n\n这是一种顺序不敏感的基线，同样的一组 token 即使打乱顺序也产生相同池化表示；要建模顺序，可进一步使用循环网络、卷积或注意力及位置表示。选择基线时应知道它无法表达什么。",
            "code": "import torch\nfrom torch import nn\n\nclass MeanClassifier(nn.Module):\n    def __init__(self, vocab_size=100, dim=32, classes=3):\n        super().__init__()\n        self.embedding = nn.Embedding(vocab_size, dim, padding_idx=0)\n        self.head = nn.Linear(dim, classes)\n    def forward(self, input_ids):\n        mask = input_ids.ne(0)\n        x = self.embedding(input_ids)\n        counts = mask.sum(1, keepdim=True).clamp_min(1)\n        pooled = (x * mask.unsqueeze(-1)).sum(1) / counts\n        return self.head(pooled)\n\nmodel = MeanClassifier()\nids = torch.tensor([[2, 8, 3, 0], [4, 5, 0, 0]])\nlabels = torch.tensor([1, 2])\nlogits = model(ids)\nassert logits.shape == (2, 3)\nloss = nn.CrossEntropyLoss()(logits, labels)\nloss.backward()",
            "language": "python"
          },
          {
            "heading": "把数据正确性变成可重复的检查",
            "body": "在模型训练前检查每个 ID 是否落在 [0,V) 范围，标签是否落在 [0,C)，是否存在全 padding 样本，以及有效长度分布是否被截断规则严重改变。对同一条有效序列追加不同数量的 PAD，比较推理 logits；对标签打乱的小数据做训练，观察是否存在异常高验证分数以排查数据泄漏。\n\n本课对照 PyTorch 0506d907c966 的 sparse.py。阅读练习：定位 padding_idx 的初始化和 forward 参数，解释为什么 attention mask 仍需由调用方传入。最终保存训练词表、标签映射、预处理版本和模型权重，并用一条已知输入做加载前后的输出一致性验证。",
            "callout": "“成功 tokenize”不等于数据契约一致；词表版本、大小写、截断方向和特殊符号都可能改变输入含义。"
          }
        ],
        "takeaways": [
          "Tokenizer 输出与 Embedding 输入之间需要固定契约",
          "padding_idx 不会自动屏蔽后续计算",
          "分类训练通常把原始 logits 直接交给交叉熵"
        ],
        "references": [
          {
            "label": "Embedding 与 padding_idx 的实现",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/nn/modules/sparse.py"
          }
        ],
        "quiz": [
          {
            "id": "models-3-q1",
            "type": "single",
            "prompt": "Embedding 输入 [B,T]、词向量维度 D，输出形状是什么？",
            "options": [
              "[V,D]",
              "[T,B,V]",
              "[B,T,D]",
              "[B,D]"
            ],
            "answer": 2,
            "explanation": "每个 token ID 被替换成 D 维向量，前两维保持，因此输出 [B,T,D]。[V,D] 是权重表本身。",
            "topic": "Embedding"
          },
          {
            "id": "models-3-q2",
            "type": "single",
            "prompt": "masked mean 的分母应该是什么？",
            "options": [
              "词表大小 V",
              "每条样本的有效 token 数",
              "类别数 C",
              "统一的 padded 长度 T"
            ],
            "answer": 1,
            "explanation": "必须除以未被 mask 掉的有效 token 数，否则添加 padding 会缩小表示，破坏同一序列的 padding 不变性。",
            "topic": "Padding"
          },
          {
            "id": "models-3-q3",
            "type": "single",
            "prompt": "向 nn.CrossEntropyLoss 提供分类预测时通常应传入什么？",
            "options": [
              "未经 softmax 的 logits",
              "百分比准确率",
              "已经 argmax 的类别 ID",
              "只传最大类别的概率"
            ],
            "answer": 0,
            "explanation": "CrossEntropyLoss 需要每个类别的 logits，并内部进行稳定的 log-softmax；argmax 会丢掉可微的分数信息。",
            "topic": "序列分类"
          }
        ]
      },
      {
        "id": "models-4",
        "title": "迁移学习、冻结策略与 LoRA",
        "description": "从正确冻结 backbone 到实现低秩增量，控制可训练状态。",
        "duration": 25,
        "difficulty": "高阶",
        "objectives": [
          "制定冻结与逐步解冻策略",
          "区分参数冻结和 BatchNorm 状态冻结",
          "实现并核对 LoRA 的参数量与初始化"
        ],
        "sections": [
          {
            "heading": "迁移学习先明确哪些能力可以复用",
            "body": "迁移学习使用已有特征或参数作为新任务起点。常见流程是先冻结 backbone、训练新任务 head，再用更小学习率解冻部分或全部 backbone。预训练输入的归一化、通道顺序、分辨率和词表等仍是模型契约的一部分；权重可以加载不代表预处理可以随意更改。\n\n冻结用 requires_grad_(False) 控制梯度计算，优化器则应明确只接收需要更新的参数。逐步解冻时还需决定如何把新参数加入优化器以及如何初始化其状态和学习率；不能假定修改 requires_grad 后，先前构建的优化器一定自动包含新解冻的参数。"
          },
          {
            "heading": "冻结 BatchNorm 需要单独管理模式",
            "body": "许多视觉 backbone 包含 BatchNorm 的 running_mean 与 running_var，这些 buffers 不属于普通可训练参数。即使整个 backbone 参数都被冻结，调用 model.train() 后再做前向，BatchNorm 运行统计仍可能更新。因此若目标是固定 backbone 的全部行为，需要在进入训练模式后把该 backbone 或指定 BatchNorm 层重新设为 eval。\n\n一种明确策略是每个训练阶段调用 model.train()，随后 backbone.eval()，让新 head 保持训练模式。若希望适配新数据的归一化统计，则可以有意保留 BatchNorm 训练行为，但应写进实验配置，而不是无意发生。Dropout 的 train/eval 行为也应一起检查。"
          },
          {
            "heading": "LoRA 把可训练增量限制为低秩乘积",
            "body": "对基础线性层 W:[out,in]，LoRA 使用 ΔW=(alpha/r)×B@A，其中 A:[r,in]、B:[out,r]。基础权重被冻结，只更新低秩矩阵，可训练权重量为 r×(in+out)，另计任何刻意训练的 bias 或 head。下面示例采用 A 随机初始化、B 全零，因此初始增量为零，初始函数与基础线性层一致；它是原生 PyTorch 教学实现，不依赖外部微调框架。\n\nLoRA 减少可训练参数和相应优化器状态，但基础模型的前向计算和反向所需激活仍可能很大，不能据此宣称训练显存按参数比例等比下降。低秩 r 与 alpha 也会影响容量和更新幅度。",
            "code": "import math\nimport torch\nfrom torch import nn\nfrom torch.nn import functional as F\n\nclass LoRALinear(nn.Module):\n    def __init__(self, base, rank=4, alpha=8):\n        super().__init__()\n        self.base = base.requires_grad_(False)\n        self.scale = alpha / rank\n        opts = {\"device\": base.weight.device, \"dtype\": base.weight.dtype}\n        self.A = nn.Parameter(torch.empty(rank, base.in_features, **opts))\n        self.B = nn.Parameter(torch.zeros(base.out_features, rank, **opts))\n        nn.init.kaiming_uniform_(self.A, a=math.sqrt(5))\n    def forward(self, x):\n        delta = F.linear(F.linear(x, self.A), self.B)\n        return self.base(x) + self.scale * delta\n\nbase = nn.Linear(16, 8)\nlayer = LoRALinear(base, rank=2, alpha=4)\nx = torch.randn(3, 16)\nassert torch.allclose(layer(x), base(x))\ntrainable = [p for p in layer.parameters() if p.requires_grad]\nassert sum(p.numel() for p in trainable) == 2 * (16 + 8)\noptimizer = torch.optim.AdamW(trainable, lr=1e-3)",
            "language": "python"
          },
          {
            "heading": "验证更新范围比只看 loss 更可靠",
            "body": "第一次 optimizer.step 前后分别复制基础权重和适配器权重，确认基础权重没有变化、目标参数按预期变化。由于 B 初始为零，首步 A 的梯度可能为零，而 B 可以收到梯度；这不必然是自动求导故障，应从矩阵链式求导解释。训练若包含 weight decay 等规则，也要区分梯度变化与优化器产生的参数变化。\n\n保存适配器时同时记录基础模型标识、插入模块路径、rank、alpha 和数据预处理。推理时可把增量合并到兼容的基础权重，但要注意精度与重复合并；先比较合并前后输出，再测性能。基础线性与归一化行为依据固定 PyTorch 0506d907c966 版本，LoRA 类本身是课程中显式给出的教学代码。",
            "callout": "只保存 A、B 而丢失对应的基础模型和配置，不能保证未来恢复出同一个模型。"
          }
        ],
        "takeaways": [
          "冻结策略包括梯度、优化器参数集合和模块模式",
          "LoRA 用低秩增量减少可训练状态",
          "通过参数与输出对比验证训练及合并行为"
        ],
        "references": [
          {
            "label": "BatchNorm buffers 与模式行为",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/nn/modules/batchnorm.py"
          },
          {
            "label": "Linear：权重形状与前向语义",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/nn/modules/linear.py"
          }
        ],
        "quiz": [
          {
            "id": "models-4-q1",
            "type": "single",
            "prompt": "基础线性层为 [out=12,in=8]，LoRA rank=2，不训练 bias，A、B 一共多少参数？",
            "options": [
              "192",
              "96",
              "20",
              "40"
            ],
            "answer": 3,
            "explanation": "A 有 2×8=16 个参数，B 有 12×2=24 个参数，总计 40；基础权重的 96 个参数被冻结且不计入新增可训练量。",
            "topic": "LoRA"
          },
          {
            "id": "models-4-q2",
            "type": "single",
            "prompt": "冻结 backbone 后仍调用整个 model.train()，想固定 BatchNorm 运行统计应如何处理？",
            "options": [
              "把 batch 调大就等于冻结",
              "删除所有 buffers",
              "在 train() 之后把 backbone 或其 BatchNorm 设为 eval()",
              "只把学习率设为零"
            ],
            "answer": 2,
            "explanation": "运行统计在前向更新，与优化器学习率无关。显式 eval 才能按常见配置切换为使用固定运行统计的行为。",
            "topic": "迁移学习"
          },
          {
            "id": "models-4-q3",
            "type": "single",
            "prompt": "LoRA 中 A 随机、B 全零初始化的直接好处是什么？",
            "options": [
              "让所有输入获得相同输出",
              "让初始增量为零，初始输出与基础模型一致",
              "让基础模型权重自动消失",
              "让 A、B 永远都没有梯度"
            ],
            "answer": 1,
            "explanation": "因为 B@A=0，初始低秩增量为零。B 仍可接收梯度，后续增量可以学出来；零增量不等于整个网络输出为零。",
            "topic": "LoRA"
          }
        ]
      }
    ]
  },
  {
    "id": "scaling",
    "number": 10,
    "title": "规模化训练",
    "subtitle": "从一张卡到一个集群",
    "description": "建立 DP、TP、PP、SP 的张量视角，读懂 FSDP 生命周期与多维布局。",
    "level": "高阶",
    "color": "#ed9321",
    "icon": "shard",
    "lessons": [
      {
        "id": "scaling-1",
        "title": "把模型切到多张卡：DP / TP / PP / SP",
        "description": "从张量形状、通信时机和互联拓扑选择并行策略。",
        "duration": 25,
        "difficulty": "高阶",
        "objectives": [
          "根据张量维度区分四类并行",
          "推导两层 MLP 的 TP 通信",
          "解释微批与流水线气泡"
        ],
        "sections": [
          {
            "heading": "先问：复制什么，切分什么",
            "body": "数据并行 DP 在每张卡复制同一模型，把全局 batch 切给不同 rank；每个 rank 完成本地前向和反向，随后同步梯度。张量并行 TP 把单层权重或中间结果切开，同一个样本由多个 rank 合作计算。流水线并行 PP 按层把模型划为 stage，中间激活和梯度沿 stage 传递。序列并行 SP 则把部分激活按序列轴切开，具体边界由实现决定。\n\n请先画出输入 X 的 [B, S, H] 三条轴：DP 通常切 B，常见 TP 切 H 或投影输出维，常见 SP 切 S，PP 切网络深度。它们解决的内存项不同，不能把“用了八卡”直接翻译成每卡显存缩小八倍。"
          },
          {
            "heading": "用两个矩阵乘法推导 TP",
            "body": "以 MLP 的 W1:[H,4H]、W2:[4H,H] 为例，四路 TP 可以先沿 W1 输出维切分，再沿 W2 输入维切分。每个 rank 得到第一层的 [B,S,H] 局部激活，第二层产出一个 [B,S,H] 部分和，必须求和后才是完整输出。激活函数夹在两层之间时，仍可在第一层分片上局部执行。\n\n下方采用 X @ W 的数学记法；PyTorch nn.Linear 存储权重为 [out_features,in_features]，阅读源码时不要机械照搬切分轴。真实框架可能用 reduce-scatter 把求和和下一步序列切片结合，因此没有看到 all_reduce 也不代表没有进行跨卡归约。",
            "code": "# 教学伪代码：所有 rank 必须按相同顺序参加 collective\n# X: [B, S, H]; tp = 4\nW1_local = W1[:, rank * H:(rank + 1) * H]\nW2_local = W2[rank * H:(rank + 1) * H, :]\nZ_local = gelu(X @ W1_local)       # [B, S, H]\nY_partial = Z_local @ W2_local    # [B, S, H]\ndist.all_reduce(Y_partial, group=tp_group)\nY = Y_partial",
            "language": "python"
          },
          {
            "heading": "流水线不是简单轮流跑每一层",
            "body": "PP 把一个大 batch 拆成多个 microbatch，让不同 stage 同时处理不同微批。对于各 stage 耗时相等、前后向被简化为同类时间片的填充排空模型，利用率近似 m/(m+p−1)，其中 m 是微批数、p 是 stage 数；真实的 1F1B、交错调度与通信重叠需要单独分析，不能把这个式子当作所有训练的精确预测。\n\n微批变多可以减少气泡，但微批过小会降低 GEMM 效率；过多在途激活又会增加内存。练习把八层模型分成四个 stage，标注每个微批何时释放激活，再说明梯度累积究竟除以 microbatch 数还是按有效 token 数归一化。"
          },
          {
            "heading": "把并行轴放到真实机器上",
            "body": "如果一台机器有八张高速互联 GPU，而跨机器网络明显更慢，频繁通信的 TP 通常优先放在机内，DP 或某些 PP 边界可以跨节点；最终仍要依据模型、拓扑和测量决定。SP 在 Megatron 风格中常指与 TP 配套的部分激活切分，context parallel 则把长上下文注意力计算跨设备划分，两者不能只因都切序列就视为同一算法。\n\n源码阅读任务：对照 PyTorch 0506d907c966 的 DeviceMesh 和 DTensor，记录每个网格维度对应的 process group。给出一个 DP=2、TP=4、PP=2 的十六卡映射，再回答：同一个 TP group 内 rank 是否处理相同样本，DP group 归约的是完整参数还是某一分片，PP 邻居传递张量的形状是什么。",
            "callout": "并行策略的名称不会自动证明通信正确；用张量形状、进程组成员和 collective 顺序核对。"
          }
        ],
        "takeaways": [
          "从被切分的对象识别并行方式",
          "TP 的局部矩阵结果可能只是待归约部分和",
          "流水线调度、微批大小与网络拓扑必须一起评估"
        ],
        "references": [
          {
            "label": "DeviceMesh：进程网格实现",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/distributed/device_mesh.py"
          },
          {
            "label": "DTensor：布局与重分布",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/distributed/tensor/_api.py"
          }
        ],
        "quiz": [
          {
            "id": "scaling-1-q1",
            "type": "single",
            "prompt": "四路 TP 中，行切分的第二个线性层各自产生同形状部分和，下一步通常需要什么？",
            "options": [
              "把四份部分和做归约求和",
              "沿 batch 维随机打乱",
              "直接拼接输出特征",
              "只保留 rank 0 的结果"
            ],
            "answer": 0,
            "explanation": "第二层每卡只计算输入特征的一个子区间，对应同一输出元素的部分和，必须求和。拼接适用于输出维切分，不适用于这里的行切分结果。",
            "topic": "TP"
          },
          {
            "id": "scaling-1-q2",
            "type": "single",
            "prompt": "DP=2、TP=4、PP=2，且各维独立，至少需要多少个 rank？",
            "options": [
              "4",
              "8",
              "32",
              "16"
            ],
            "answer": 3,
            "explanation": "独立并行维度构成笛卡尔积：2×4×2=16。不能只取最大维度，也不能把独立维度简单相加。",
            "topic": "多维并行"
          },
          {
            "id": "scaling-1-q3",
            "type": "single",
            "prompt": "增加流水线微批数最可靠的表述是什么？",
            "options": [
              "一定减少总显存",
              "一定线性提高吞吐",
              "通常减少气泡，但可能降低单个 GEMM 效率并改变激活占用",
              "等价于增加 TP 度"
            ],
            "answer": 2,
            "explanation": "更多微批通常改善流水线填充，但小矩阵可能使算力利用率下降，在途激活也受调度影响。它不改变张量并行维度。",
            "topic": "PP"
          }
        ]
      },
      {
        "id": "scaling-2",
        "title": "FSDP 与 ZeRO：分片只是生命周期的开始",
        "description": "沿参数 all-gather、反向归约和优化器更新追踪显存。",
        "duration": 25,
        "difficulty": "高阶",
        "objectives": [
          "区分 ZeRO 三个阶段的分片对象",
          "读懂 FSDP 参数聚合与释放时机",
          "制定可恢复的分布式 checkpoint 方案"
        ],
        "sections": [
          {
            "heading": "先拆开持久模型状态",
            "body": "训练状态至少包括参数、梯度和优化器状态。ZeRO-1 主要分片优化器状态，ZeRO-2 再分片梯度，ZeRO-3 进一步分片参数。FSDP 的完整参数分片与 ZeRO-3 在节约持久模型状态这一点相近，但通信调度、API、保存格式和功能边界不能混为一谈。\n\n假设某层有 P 个参数，四卡各常驻 P/4 的参数分片。执行该层计算时往往仍需拿到完整参数，所以“常驻四分之一”不等于“峰值四分之一”。大 embedding、单个过大的 wrap 单元、预取和通信缓冲都可能决定真正的峰值。"
          },
          {
            "heading": "按 hook 顺序阅读 FSDP2",
            "body": "本课核对 PyTorch 0506d907c966 的 _fsdp_param_group.py。按层分片时，先阅读 pre_forward → unshard → post_forward，再看 pre_backward → unshard → post_backward。这里的 unshard 可以因为参数已存在而成为无操作，不能把每次进入 hook 都算成一次通信。unshard 发起参数聚合，reshard 根据当前状态和配置决定是否释放完整参数；反向阶段的梯度一般经 reduce-scatter 变为本 rank 负责的梯度分片。\n\n下面是生命周期示意，不是可直接调用的公共 API。源码还有异步事件、预取、混合精度和特殊反向路径；读到一个 all-gather 调用，继续追踪何时等待事件以及哪个张量持有实际存储。\n\n当 reshard_after_forward=False 时，完整参数在前向后保留，反向会复用它们，省去第二次参数 all-gather。在本课所引 FSDP2 版本中，该选项默认 None，由框架为非根模块选择 True、为根模块选择 False；显式配置与预取也会改变实际时序。",
            "code": "# 教学伪代码：一组参数的典型生命周期\nparams = all_gather(param_shard)\nactivation = layer_forward(inputs, params)\nif reshard_after_forward:\n    release_full_params(params)\n    params = None\n# 参数仍然存在时直接复用，不重复 all-gather。\nif params is None:\n    params = all_gather(param_shard)\nfull_grad = layer_backward(activation, params)\ngrad_shard = reduce_scatter(full_grad, op=\"sum\")\nrelease_full_params(params)\n# sum / mean 与框架及 loss 归一化约定一致。\noptimizer_step(param_shard, grad_shard)",
            "language": "python"
          },
          {
            "heading": "通信重叠为什么也会增加峰值",
            "body": "预取下一层参数可以把 all-gather 隐藏在当前层计算后面，但当前层与下一层完整参数会短时间同时驻留。反向预取、梯度累积以及不立即归约的配置还会改变梯度生命周期。因此排查 OOM 时应按时间点记录常驻分片、当前完整参数、预取参数、激活和临时 workspace，而不只算总参数量除以卡数。\n\n训练正确性也需要检查：不同 rank 是否进入同一个层、同顺序执行 collective，空 batch 是否跳过了其他 rank 正在执行的同步，某个分片优化器是否被重复更新。通信超时可能是上游控制流分叉，而不一定是网络故障。"
          },
          {
            "heading": "保存文件不等于可恢复训练",
            "body": "分布式 checkpoint 必须明确是每 rank 分片状态还是集中导出的完整模型。续训通常还要保存优化器、学习率调度、全局 step、随机数和数据采样进度；只保存模型权重适合推理导出，不能证明能无缝续训。改变 world size 时，要验证所用保存与加载方案是否支持重新分片，不能把第零号 rank 的分片当成全量参数。\n\n阅读练习：在已核对文件中定位 reshard_after_forward 的判断，然后画出开启与关闭时的两个时间线。为一个八卡训练写出中途保存、恢复一步、比较 loss 与参数更新的验证计划，标注哪些结果需要真实多卡环境才能确认。",
            "callout": "activation checkpoint 是重算激活；模型 checkpoint 是保存训练状态。二者共享名字，但解决的问题不同。"
          }
        ],
        "takeaways": [
          "分片减少常驻状态，不会消除完整参数工作集",
          "用 hook、事件和存储引用还原真实生命周期",
          "恢复能力必须用加载后继续训练来验证"
        ],
        "references": [
          {
            "label": "FSDP2 参数组与 hook 生命周期",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/distributed/fsdp/_fully_shard/_fsdp_param_group.py"
          },
          {
            "label": "FSDP2 fully_shard：root 默认与 reshard 选项",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/distributed/fsdp/_fully_shard/_fully_shard.py"
          }
        ],
        "quiz": [
          {
            "id": "scaling-2-q1",
            "type": "single",
            "prompt": "ZeRO-2 相比 ZeRO-1 进一步分片的核心对象是什么？",
            "options": [
              "全部参数",
              "梯度",
              "输入 token ID",
              "激活函数代码"
            ],
            "answer": 1,
            "explanation": "经典 ZeRO-1 分片优化器状态，ZeRO-2 进一步分片梯度，ZeRO-3 才进一步分片参数。实际实现可能包含额外优化。",
            "topic": "ZeRO"
          },
          {
            "id": "scaling-2-q2",
            "type": "single",
            "prompt": "开启下一层参数预取后，为什么显存峰值可能升高？",
            "options": [
              "当前层和下一层的完整参数可能同时驻留",
              "梯度不再归约",
              "模型自动变成 FP64",
              "参数数量变多了"
            ],
            "answer": 0,
            "explanation": "预取通过同时保有多个计算阶段的数据来隐藏通信延迟，因此可能增加短时工作集；这与模型参数总量或自动更换数据类型无关。",
            "topic": "FSDP"
          },
          {
            "id": "scaling-2-q3",
            "type": "single",
            "prompt": "只保存 rank 0 的本地分片，最严重的恢复问题是什么？",
            "options": [
              "学习率一定增大",
              "无法在同一台机器读取文件",
              "tokenizer 会自动失效",
              "缺少其他参数分片及完整训练状态"
            ],
            "answer": 3,
            "explanation": "本地分片一般不是完整模型；其他 rank 的分片以及优化器等续训状态可能缺失。问题是状态覆盖不完整，而不是文件物理上不可读取。",
            "topic": "Checkpoint"
          }
        ]
      },
      {
        "id": "scaling-3",
        "title": "显存账本：重计算、Offload 与峰值",
        "description": "用可计算的内存模型解释 OOM，并设计有证据的优化。",
        "duration": 25,
        "difficulty": "高阶",
        "objectives": [
          "为参数与激活分别建立显存预算",
          "安全使用 activation checkpoint",
          "判断 CPU offload 的带宽代价"
        ],
        "sections": [
          {
            "heading": "先把显存分成可核对的账目",
            "body": "训练显存可拆为常驻模型状态、保存的激活、临时算子 workspace、通信缓冲以及分配器保留但暂未使用的空间。以一种常见混合精度 Adam 配置为例，每参数有 2 字节模型权重、2 字节梯度、4 字节主权重和 8 字节一二阶矩，共约 16 字节；但 BF16 训练未必保有主权重，梯度 dtype 和优化器实现也可能不同，所以应以实际张量为准。\n\n七十亿参数乘十六字节约一千一百二十亿字节，尚未包含激活。GB 与 GiB 也要明确换算。推理中的 KV cache 是另一个主要内存项，不要把它和训练时 autograd 保存的激活混称为缓存。"
          },
          {
            "heading": "重计算用额外前向换保存空间",
            "body": "activation checkpoint 在前向减少保存中间张量，反向需要时重新执行部分前向。当前 PyTorch 源码提供不同实现，本课显式使用 use_reentrant=False，避免依赖版本默认值。带 dropout 时，随机状态处理关系到重算与原始前向是否一致；有副作用的函数、读取变化的全局状态或不同分支，可能使重算语义改变。\n\n下面代码需要本地 PyTorch；它展示接口和反向传播，不代表已经在学习网站的浏览器中执行。实际收益取决于块的大小及算子保存策略。应分别比较无 checkpoint 和有 checkpoint 的最大显存、每步耗时，以及固定种子下的梯度误差。",
            "code": "import torch\nfrom torch import nn\nfrom torch.utils.checkpoint import checkpoint\n\nblock = nn.Sequential(nn.Linear(512, 2048), nn.GELU(),\n                      nn.Linear(2048, 512))\nx = torch.randn(2, 128, 512, requires_grad=True)\ny = checkpoint(block, x, use_reentrant=False,\n               preserve_rng_state=True)\ny.square().mean().backward()\nassert x.grad is not None",
            "language": "python"
          },
          {
            "heading": "Offload 会把显存压力变成传输压力",
            "body": "CPU offload 把某些参数、优化器状态或激活放到主存，使用前再送到 GPU。收益取决于被移走的对象、传输频率、PCIe 或其他互联带宽、主存容量以及异步拷贝是否真正重叠。只看到 GPU 显存下降不能断言训练更快；如果每层都等待大块数据回传，GPU 会在时间线上出现空洞。\n\n做一个下界估算：单次需要搬运 D 字节、有效带宽为 B 字节每秒，那么只算这次传输至少需要 D/B 秒。再把双向搬运、并发争用与同步等待加上。pin_memory 与 non_blocking 并不自动保证重叠，还需要合适的流、依赖和可并行计算。"
          },
          {
            "heading": "用测量定位到底是哪一笔超支",
            "body": "先固定模型、输入长度、微批、精度与 seed，预热后记录 torch.cuda.max_memory_allocated、max_memory_reserved 和稳定步耗时。allocated 描述张量实际占用，reserved 描述缓存分配器保留空间，二者差值不是全部都能马上回收的“泄漏”。计时 GPU 工作需要正确同步或使用 CUDA events，CPU 发射指令耗时不能代表 kernel 完成耗时。\n\n源码练习：对照 PyTorch 0506d907c966 的 checkpoint.py，查找 preserve_rng_state 和 use_reentrant 的说明。建立四组对照：基线、减半微批、按 Transformer block checkpoint、CPU offload；每组写出预期改变的账目、测量结果和吞吐代价。一次只改一个变量，才知道是哪项措施产生了收益。",
            "code": "# 在已有 CUDA 训练循环中插入；教学片段\ntorch.cuda.synchronize()\ntorch.cuda.reset_peak_memory_stats()\nloss = train_step(batch)\ntorch.cuda.synchronize()\nprint(\"allocated GiB\", torch.cuda.max_memory_allocated() / 2**30)\nprint(\"reserved GiB\", torch.cuda.max_memory_reserved() / 2**30)",
            "language": "python",
            "callout": "empty_cache() 不会释放仍被活跃张量引用的显存，也不能修复错误的计算图保留。"
          }
        ],
        "takeaways": [
          "优化显存前先说明要减少哪类对象",
          "重计算与 offload 的代价分别是计算和传输",
          "用峰值显存与稳定吞吐同时评估优化"
        ],
        "references": [
          {
            "label": "Activation checkpoint 实现与选项",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/utils/checkpoint.py"
          },
          {
            "label": "FSDP 参数预取与重分片",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/distributed/fsdp/_fully_shard/_fsdp_param_group.py"
          }
        ],
        "quiz": [
          {
            "id": "scaling-3-q1",
            "type": "single",
            "prompt": "activation checkpoint 的主要交换关系是什么？",
            "options": [
              "把所有梯度改成整数",
              "增加模型参数换更高精度",
              "额外重计算换更少保存的激活",
              "减少训练样本换更少网络通信"
            ],
            "answer": 2,
            "explanation": "它主要在反向重新执行部分前向，减少需要一直保存的中间激活；并不直接改变模型参数、样本数或梯度类型。",
            "topic": "Activation checkpoint"
          },
          {
            "id": "scaling-3-q2",
            "type": "single",
            "prompt": "搬运 8 GB 数据，有效单向带宽 16 GB/s，忽略其他开销的单向传输下界约为？",
            "options": [
              "2 秒",
              "0.5 秒",
              "0.05 秒",
              "128 秒"
            ],
            "answer": 1,
            "explanation": "时间下界为数据量除以有效带宽，即 8/16=0.5 秒；双向拷贝、争用和等待会使真实开销进一步增加。",
            "topic": "Offload"
          },
          {
            "id": "scaling-3-q3",
            "type": "single",
            "prompt": "调用 empty_cache() 后 OOM 仍然出现，哪个解释合理？",
            "options": [
              "活跃张量仍占用显存，释放分配器空闲缓存不能降低活跃工作集",
              "reserved 永远等于 allocated",
              "empty_cache 会删除模型参数",
              "CUDA 不支持长序列"
            ],
            "answer": 0,
            "explanation": "empty_cache 只尝试释放分配器未被使用的缓存，不能回收仍被引用的参数、激活和图；因此不能代替缩小真实工作集。",
            "topic": "显存诊断"
          }
        ]
      },
      {
        "id": "scaling-4",
        "title": "DeviceMesh 与 DTensor：把布局写成类型",
        "description": "从二维网格、Shard 与 Partial 读懂并行算子之间的转换。",
        "duration": 25,
        "difficulty": "高阶",
        "objectives": [
          "建立 rank 到二维网格的映射",
          "区分 Shard、Replicate 和 Partial",
          "追踪重分布触发的通信"
        ],
        "sections": [
          {
            "heading": "网格维度就是通信分组的坐标",
            "body": "DeviceMesh 描述设备的逻辑网格，而不是自动替你选择最佳硬件拓扑。八个 rank 可组成 [2,4] 网格，把两维命名为 dp 和 tp。每一个 TP group 包含相同 DP 坐标下的四个 rank；每一个 DP group 包含相同 TP 坐标下的两个 rank。网格名帮助表达意图，底层 collective 仍要求所有参与者按照一致的组和顺序调用。\n\n本课核对 PyTorch 0506d907c966 的 device_mesh.py 和 tensor/_api.py。下面示例要求八进程环境及兼容的 PyTorch 版本，不能在单进程中直接运行；init_device_mesh 会建立用于后续布局通信的进程组。"
          },
          {
            "heading": "同一个全局张量有不同本地表示",
            "body": "DTensor 同时携带全局张量语义、设备网格和每个网格维度上的 placement。Replicate 表示该维各设备持有相同数据；Shard(dim) 表示沿张量某轴切片；Partial 表示本地值是仍需按某种归约合并的部分结果。Partial 不是“缺少几块”的普通切片，也不能当成完整结果直接计算全局指标。\n\n例子中全局 W:[8,8]，在 DP 维复制、TP 维沿第零轴四分，每卡本地形状为 [2,8]。在 TP 维从 Shard(0) 转为 Replicate 通常需要 all-gather；从 Partial 到 Replicate 通常需要归约，具体算子与后端选择还要看执行路径。\n\n没有 GPU 时也可以验证布局语义：使用四个 CPU / Gloo 进程，网格改为 (2,2)，设备改为 cpu，并去掉 set_device；全局 [8,8] 的 Shard(0) 本地形状此时变为 [4,8]。这是另一种拓扑，不能仍把本地 shape 写成八卡示例中的 [2,8]。",
            "code": "# 运行前提：torchrun --nproc_per_node=8 example.py\nimport os\nimport torch\nfrom torch.distributed.device_mesh import init_device_mesh\nfrom torch.distributed.tensor import distribute_tensor, Replicate, Shard\n\ntorch.cuda.set_device(int(os.environ[\"LOCAL_RANK\"]))\nmesh = init_device_mesh(\"cuda\", (2, 4),\n                        mesh_dim_names=(\"dp\", \"tp\"))\nW = torch.arange(64, device=\"cuda\").reshape(8, 8).float()\ndW = distribute_tensor(W, mesh, [Replicate(), Shard(0)])\nassert tuple(dW.to_local().shape) == (2, 8)\nfull = dW.redistribute(placements=[Replicate(), Replicate()])\nassert tuple(full.to_local().shape) == (8, 8)",
            "language": "python"
          },
          {
            "heading": "算子之间的布局转换也是成本",
            "body": "一个并行线性层输出的布局必须适合下一个算子。若频繁在 Shard 与 Replicate 之间转换，就可能反复 all-gather 和再切片，把省下的显存变成通信开销。阅读一个模块时，不只标注输入输出 shape，还要写出每个网格维上的 placement；两个全局 shape 相同的 DTensor 可能需要完全不同的通信。\n\n自动求导也要考虑逆向布局：前向某次重分布可能在反向对应不同的 collective。不能只根据前向通信量推断整个训练步成本。优化器状态、参数导出和 checkpoint 也必须保有足够的全局布局元信息，尤其是将 TP 与 FSDP 或 DP 结合时。"
          },
          {
            "heading": "把“看懂多维并行”变成可提交的任务",
            "body": "选取一个 [B,S,H] → [B,S,4H] → [B,S,H] 的 MLP，为每一条边同时填写全局形状、本地形状、placement、通信组和 dtype。先只用 TP，再加一个 DP 维，说明两者的梯度分别在哪些组上归约。如果输出为 Partial，写出进入残差相加之前需要满足的条件，避免把局部部分和加到完整残差上。\n\n最后做一个八 rank 的故障推演：其中一个 rank 因本地空 batch 提前 return，其余 rank 进入 redistribution。说明为何会挂起、最早应该记录哪一个 collective 序号、如何把数据过滤移到不破坏集体通信一致性的地方。这个练习会帮助你读懂大型 PyTorch 训练系统的进程组划分和二维并行初始化。",
            "callout": "DTensor 的全局 shape 和 to_local() 的 shape 都应记录；只打印一个通常不足以判断布局正确。"
          }
        ],
        "takeaways": [
          "每个网格维有自己的 process group",
          "Partial 代表待归约结果，不能当成 Replicate",
          "全局形状、本地形状和 placement 要一起阅读"
        ],
        "references": [
          {
            "label": "DeviceMesh 初始化与切片",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/distributed/device_mesh.py"
          },
          {
            "label": "DTensor distribute_tensor / redistribute",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/distributed/tensor/_api.py"
          }
        ],
        "quiz": [
          {
            "id": "scaling-4-q1",
            "type": "single",
            "prompt": "全局 [8,8] 张量在四路 TP 上 Shard(0)，假设均匀切分，本地 shape 是？",
            "options": [
              "[8,8]",
              "[4,4]",
              "[8,2]",
              "[2,8]"
            ],
            "answer": 3,
            "explanation": "Shard(0) 沿第零维切分，8/4=2，因此本地是 [2,8]；[8,2] 对应切第二维。",
            "topic": "DTensor"
          },
          {
            "id": "scaling-4-q2",
            "type": "single",
            "prompt": "Partial(sum) 转成 Replicate 的核心语义是什么？",
            "options": [
              "把本地结果直接复制给其他 rank",
              "把张量切得更细",
              "对各 rank 部分结果求和，使每卡拥有完整结果",
              "删除数值为零的元素"
            ],
            "answer": 2,
            "explanation": "Partial(sum) 表示每卡保存的是贡献项，完整值需要求和。简单复制会丢掉其他 rank 的贡献。",
            "topic": "DTensor"
          },
          {
            "id": "scaling-4-q3",
            "type": "single",
            "prompt": "二维 mesh 中，一个 rank 跳过了其他成员正在执行的 collective，最可能发生什么？",
            "options": [
              "自动跳过整个 group",
              "挂起或 collective 超时",
              "自动缩小 world size",
              "其他 rank 仍能得到完整结果"
            ],
            "answer": 1,
            "explanation": "集体通信要求组内成员按兼容顺序参与。单个 rank 提前返回会破坏这一约定，一般不会自动重建进程组。",
            "topic": "分布式故障"
          }
        ]
      }
    ]
  },
  {
    "id": "deployment",
    "number": 11,
    "title": "导出、推理与部署",
    "subtitle": "让正确的模型可靠地运行",
    "description": "覆盖可靠推理、动态形状导出、ONNX、量化与批处理服务的质量和性能验证。",
    "level": "实战",
    "color": "#ed9321",
    "icon": "reward",
    "lessons": [
      {
        "id": "deployment-1",
        "title": "可靠推理：eval、inference_mode 与输入契约",
        "description": "让模型加载后的行为可预测、可验证、可复现。",
        "duration": 25,
        "difficulty": "实战",
        "objectives": [
          "区分模块模式与自动求导模式",
          "建立加载和预处理的一致性检查",
          "为设备、精度与输出制定推理契约"
        ],
        "sections": [
          {
            "heading": "推理首先是一套可复现的约定",
            "body": "一个可部署模型不只是 state_dict，还包括模型结构、输入名称与 shape、dtype、预处理、词表或标签映射以及输出解释。图像模型需要确定通道顺序与归一化，序列模型需要相同的 tokenizer 与 padding 规则，时序模型需要一致的采样频率和缩放统计。部署结果错误时，应先比对输入张量，再判断模型计算。\n\n加载时应明确 map_location 和需要的权重类型，核对 missing_keys 与 unexpected_keys，而不是为了绕过报错就随意使用 strict=False。完整训练 checkpoint 与纯推理权重的内容不同；恢复模型时，先在固定样本上检查参考输出，再启动批量服务。"
          },
          {
            "heading": "eval 与关闭梯度各管一件事",
            "body": "model.eval() 切换模块行为，例如关闭 Dropout 随机丢弃、让常见 BatchNorm 使用运行统计，但不会自动关闭梯度记录。torch.inference_mode() 关闭额外的自动求导相关开销，也不会替你调用 eval；它比 no_grad 更严格，在该模式创建的张量可能无法用于后续需要 autograd 保存这些张量的计算。\n\n本课对照 PyTorch 0506d907c966 的 grad_mode.py。如果冻结 backbone 后仍要把特征输入可训练 head，通常应根据梯度需求考虑 no_grad，而不要无条件把整个训练管线包进 inference_mode。纯推理接口则可同时显式使用 eval 与 inference_mode，并保持调用期间模式不被其他线程修改。"
          },
          {
            "heading": "写一个最小但边界明确的预测函数",
            "body": "以下例子可在装有 PyTorch 的 CPU 环境执行，用随机初始化的小模型示范推理约定，并不代表经过训练的分类器。输入为 [B,8] 的 float32，输出为 [B,3] 的概率及 [B] 的类别 ID。生产代码应检查输入是否有限值、是否满足允许的 batch 范围，并把设备搬运与计算耗时分开记录。\n\nsoftmax 在这里用于展示分类概率；训练交叉熵通常仍接收原始 logits。概率的数值并不自动等于校准良好的置信度，阈值、拒识与业务决策需要用独立验证集评估。",
            "code": "import torch\nfrom torch import nn\n\ntorch.manual_seed(7)\nmodel = nn.Sequential(nn.Linear(8, 16), nn.ReLU(),\n                      nn.Dropout(0.2), nn.Linear(16, 3)).eval()\n\n@torch.inference_mode()\ndef predict(x):\n    if x.ndim != 2 or x.shape[1] != 8:\n        raise ValueError(\"expected [batch, 8]\")\n    if not torch.isfinite(x).all():\n        raise ValueError(\"input must be finite\")\n    device = next(model.parameters()).device\n    logits = model(x.to(device=device, dtype=torch.float32))\n    probabilities = logits.float().softmax(dim=-1)\n    return probabilities.cpu(), logits.argmax(-1).cpu()\n\nx = torch.randn(4, 8)\np1, labels = predict(x)\np2, _ = predict(x)\ntorch.testing.assert_close(p1, p2)\nassert labels.shape == (4,)",
            "language": "python"
          },
          {
            "heading": "一致性验证要覆盖真实边界",
            "body": "建立一小组固定输入，比较保存前、重新加载后、切换设备后和改变精度后的 logits、预测类别及任务指标。浮点计算顺序变化可能造成微小误差，因此应使用明确的绝对与相对容差；若只检查 argmax，相邻类别分数的大幅变化可能被隐藏。反过来，边界样本的 argmax 改变也不必然意味着总体质量不可接受。\n\n测试应覆盖最短、最长、空或非法输入、最大 batch 以及预处理边界。对于 batch 可独立处理的模型，还要比较单样本推理与同批推理结果，排查模式设置、padding 和状态共享错误。最终记录依赖版本、权重标识和验证摘要，保证问题出现后能还原使用的是哪一个模型。",
            "callout": "网页展示的是课程与代码示例；这里的示例需要在本地 PyTorch 环境运行，浏览器不会实际执行模型。"
          }
        ],
        "takeaways": [
          "模型权重与预处理共同定义推理行为",
          "eval 和 inference_mode 通常需要同时显式设置",
          "用固定输入与合理容差验证保存和部署的一致性"
        ],
        "references": [
          {
            "label": "inference_mode 的限制与 eval 边界",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/autograd/grad_mode.py"
          },
          {
            "label": "BatchNorm 的运行统计",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/nn/modules/batchnorm.py"
          }
        ],
        "quiz": [
          {
            "id": "deployment-1-q1",
            "type": "single",
            "prompt": "model.eval() 是否会自动关闭 autograd 梯度记录？",
            "options": [
              "不会，它主要切换模块的训练与推理行为",
              "只在 CPU 会",
              "只在没有 Dropout 时会",
              "会，所有参数梯度被永久删除"
            ],
            "answer": 0,
            "explanation": "eval 控制 Dropout、BatchNorm 等模块行为；是否记录梯度由 grad mode、no_grad、inference_mode 等机制控制。",
            "topic": "推理模式"
          },
          {
            "id": "deployment-1-q2",
            "type": "single",
            "prompt": "为什么不能无条件把冻结 backbone 到可训练 head 的所有计算都放入 inference_mode？",
            "options": [
              "它只能处理图像",
              "它会把学习率改成零",
              "它会自动删除输入",
              "它会关闭所需梯度，且其中创建的张量在 autograd 里有额外使用限制"
            ],
            "answer": 3,
            "explanation": "可训练 head 仍需要梯度；inference_mode 还限制张量之后参与 autograd 的方式。应按训练边界选择 no_grad 或其他适当方案。",
            "topic": "Autograd 边界"
          },
          {
            "id": "deployment-1-q3",
            "type": "single",
            "prompt": "验证部署前后的数值一致性，哪组检查更完整？",
            "options": [
              "只要导入模块没有异常",
              "只看模型文件大小",
              "固定输入，比较 logits 误差、类别和任务指标",
              "只看 HTTP 状态码"
            ],
            "answer": 2,
            "explanation": "模型能加载或接口成功并不能证明数值正确。固定输入的分数误差、输出行为与任务指标能覆盖互补层面。",
            "topic": "推理验证"
          }
        ]
      },
      {
        "id": "deployment-2",
        "title": "torch.export：动态 Shape 与图约束",
        "description": "把可执行 Python 模型转换为带输入约束的计算图。",
        "duration": 25,
        "difficulty": "实战",
        "objectives": [
          "理解 ExportedProgram 的保证范围",
          "声明动态维度并检查边界输入",
          "识别数据依赖分支和导出限制"
        ],
        "sections": [
          {
            "heading": "导出的是满足约束的张量计算",
            "body": "torch.export.export 根据模型和示例输入捕获张量计算，生成 ExportedProgram，并记录使该图有效的 shape 等约束。它不是把任意 Python 应用完整打包成一个永远通用的二进制；文件读取、服务路由、复杂的 Python 副作用和任意数据结构不属于相同的图语义。导出成功也不代表目标运行时支持所有算子。\n\n本课核对 PyTorch 0506d907c966 的 export/__init__.py。示例采用仍受支持的 Dim 与 dynamic_shapes 接口，要求 PyTorch 2.6 或更高兼容版本；不同版本新增的动态 shape API 与默认 strict 行为可能变化，所以示例显式指定需要的选项。"
          },
          {
            "heading": "动态维度应表达真实的输入范围",
            "body": "示例用 [B,8] 输入，其中 batch 可变、特征维固定。Dim(\"batch\", min=1, max=32) 不是允许任何 shape，而是给第零维提供符号范围；第二维仍必须为八。dynamic_shapes 的结构要与模型 forward 输入一致，可以按参数名映射，也可以按位置提供元组，不能把输入名称与张量内部轴名称混淆。\n\n动态范围越宽，图需要证明的条件越多，目标后端也可能面临更多优化折中。请根据服务实际需求确定范围，并分别验证最小、常见和最大输入。声明超大的 max 并不会替你准备足够显存，也不能消除模型内部对尺寸整除或 reshape 的要求。",
            "code": "import torch\nfrom torch import nn\n\nclass Classifier(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.linear = nn.Linear(8, 3)\n    def forward(self, x):\n        return self.linear(x).relu()\n\nmodel = Classifier().eval()\nexample = torch.randn(4, 8)\nbatch = torch.export.Dim(\"batch\", min=1, max=32)\nep = torch.export.export(\n    model, (example,), dynamic_shapes=({0: batch},), strict=True)\nexported = ep.module()\nwith torch.inference_mode():\n    for n in (1, 4, 32):\n        x = torch.randn(n, 8)\n        torch.testing.assert_close(exported(x), model(x))\nprint(ep.range_constraints)",
            "language": "python"
          },
          {
            "heading": "数据依赖分支不能靠一个样本证明",
            "body": "如果 forward 写成 if x.sum().item()>0，再在两个分支执行不同张量计算，某个示例输入只能走到其中一个分支，不能证明未来输入仍走同一路径。导出可能拒绝这种无法证明的数据依赖控制流。根据具体版本和目标后端支持，可以改写为张量表达式或使用合适的结构化控制流，但不能静默删掉一个业务上必需的分支。\n\n同样，reshape 中的符号维约束、Python 列表长度随数据变化、访问外部状态，都可能影响捕获。遇到错误时先保留最小复现，读清要求补充的尺寸约束，确认约束是否真符合业务，再调整模型或输入规格。"
          },
          {
            "heading": "导出验证比一次成功调用更广",
            "body": "对所有支持的 batch 与关键 shape 边界比较 eager 模型和导出图，检查输出数量、顺序、dtype 及数值容差。还应验证超出范围的输入被明确拒绝，而不是依赖偶然广播得到错误结果。保存与重新加载导出产物之后重复关键测试，随后在最终运行时中再做一次相同的验证。\n\n阅读任务：在已固定的 export 源码中定位 dynamic_shapes 与 soundness 的说明，把你自己的 CNN 或序列分类器输入写成一份规格表。列出哪些轴允许变化、哪些必须固定，以及每条范围限制来自模型结构、内存预算还是业务约束。最后记录依赖版本和导出配置，使图捕获结果可以复现。",
            "callout": "torch.export 产生图表示；后续选择运行时、编译后端和部署格式仍是独立工作，不能把导出成功直接等同于上线成功。"
          }
        ],
        "takeaways": [
          "ExportedProgram 的正确性依赖记录的输入约束",
          "动态维度要与真实业务范围一致",
          "需要在 eager、导出图和最终运行时分别核验"
        ],
        "references": [
          {
            "label": "torch.export：接口、约束与动态形状",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/export/__init__.py"
          }
        ],
        "quiz": [
          {
            "id": "deployment-2-q1",
            "type": "single",
            "prompt": "只把 [B,8] 的第零维声明为动态，意味着什么？",
            "options": [
              "所有维度都可任意变化",
              "batch 在声明范围内可变，特征维仍固定为 8",
              "模型权重数随 batch 改变",
              "输出类别数也自动动态"
            ],
            "answer": 1,
            "explanation": "dynamic_shapes 是逐维声明的；未声明的特征维保持静态。动态 batch 不会改变模型参数或类别数。",
            "topic": "torch.export"
          },
          {
            "id": "deployment-2-q2",
            "type": "single",
            "prompt": "为什么 if x.sum().item()>0 可能阻止可靠导出？",
            "options": [
              "分支依赖运行时数据，单个示例无法证明其他输入走同一路径",
              "sum 不能用于 PyTorch",
              "线性层必须移到 CPU",
              "item 总会返回零"
            ],
            "answer": 0,
            "explanation": "问题是 Python 控制流依赖张量值，需要捕获并保留真实分支语义。不能用一个样本走过的路径代替全部输入行为。",
            "topic": "图约束"
          },
          {
            "id": "deployment-2-q3",
            "type": "single",
            "prompt": "模型导出成功后，下一步最合适的验证是什么？",
            "options": [
              "直接删除 eager 模型",
              "只检查文件扩展名",
              "把所有维度都设成无限大",
              "覆盖动态范围边界并比较最终运行时与 eager 输出"
            ],
            "answer": 3,
            "explanation": "导出成功只说明捕获过程完成。边界输入、数值一致性和最终运行时算子支持都需要验证。",
            "topic": "部署验证"
          }
        ]
      },
      {
        "id": "deployment-3",
        "title": "ONNX、遗留 TorchScript 与量化选择",
        "description": "把格式兼容、数值精度和硬件收益分别验证。",
        "duration": 25,
        "difficulty": "实战",
        "objectives": [
          "选择适合目标运行时的导出路线",
          "区分静态、动态和权重量化",
          "理解 torchao 配置的版本与硬件边界"
        ],
        "sections": [
          {
            "heading": "部署格式要从目标运行时倒推",
            "body": "ONNX 描述跨框架的计算图和算子语义，目标运行时可能只支持某些 opset、dtype 和动态 shape。PyTorch 的新 ONNX 导出路线可基于 torch.export；本课固定源码显示，PyTorch 2.9 起该路线已成为默认，示例仍显式写 dynamo=True，避免依赖历史默认值。TorchScript 常见于已有部署系统，读旧代码时仍需理解 tracing 与 scripting。本课固定源码已对 torch.jit.trace / script 发出弃用提示；本地 PyTorch 2.14.1 中它们仍可执行，但不宜作为新部署设计的默认路线。弃用不等于删除：新图导出优先评估 torch.export，运行时加速则按需要评估 torch.compile。\n\n格式转换与量化是不同维度：导出为 ONNX 不会自动得到低比特模型，量化模型也不保证能被每个 ONNX 后端执行。先确定浮点基线能够正确运行，再逐项引入图转换、算子替换与低精度策略。"
          },
          {
            "heading": "用最小模型验证现代 ONNX 导出",
            "body": "以下示例要求安装兼容的 PyTorch 2.6+、onnx 与 onnxscript。执行后会在你运行脚本的目录生成 classifier.onnx；它是浮点导出示例，没有量化。正式验证还需要安装并配置目标运行时，例如 ONNX Runtime，用相同输入比对输出。若启用动态 batch，应按 dynamo=True 路线使用对应 dynamic_shapes 规格，而不是把旧 dynamic_axes 规则不加检查地照搬。\n\n大型模型可能使用 external data 保存权重，部署时必须同时分发相关文件。导出过程发生 unsupported operator 或 shape constraint 错误时，先缩小复现，不要只为生成一个文件就删掉关键计算。",
            "code": "import torch\nfrom torch import nn\n\n# 前提：兼容的 torch >= 2.6、onnx、onnxscript\nmodel = nn.Sequential(nn.Linear(8, 16), nn.ReLU(),\n                      nn.Linear(16, 3)).eval()\nx = torch.randn(4, 8)\nwith torch.inference_mode():\n    reference = model(x)\nprogram = torch.onnx.export(\n    model, (x,), \"classifier.onnx\", dynamo=True,\n    input_names=[\"features\"], output_names=[\"logits\"])\n# 下一步：用目标 runtime 加载文件，比较相同 x 的 logits。",
            "language": "python"
          },
          {
            "heading": "量化误差与性能需要一起讨论",
            "body": "量化用有限的数值集合近似浮点张量，需要考虑 scale、zero point、量化范围以及 per-tensor、per-channel 或分组粒度。动态激活量化在运行时根据激活计算量化参数，静态激活量化通常利用代表性校准数据预先确定范围；weight-only 主要量化权重，激活仍可能使用浮点。QAT 在训练中模拟量化影响，帮助模型适应量化误差，但增加了训练与配置复杂度。\n\n模型文件变小不代表延迟一定下降。反量化、数据重排和小矩阵开销可能抵消低精度收益，目标硬件也必须有相应内核。校准集还应覆盖实际输入分布；只在几条容易样本上观察误差，无法发现尾部激活或少数类别的质量退化。"
          },
          {
            "heading": "torchao 的配置必须和安装版本对应",
            "body": "本课额外核对 TorchAO 3972ed015091 的 quant_api.py：Int8DynamicActivationInt8WeightConfig 描述动态逐 token 激活与逐通道权重的 int8 量化，该快照默认配置版本为 2，并明确拒绝 version=1。这里的“配置版本 2”不是 PyTorch 2，也不是 torchao 包版本号。选用前应匹配 PyTorch、TorchAO、设备和内核要求，不能把不同年份教程里的配置参数混用。\n\n下方是针对已核对 TorchAO API 的调用片段，model 需先构建并放在受支持设备；它需要相容环境，课程未在此运行量化 kernel。量化前保留浮点模型及验证集基线，量化后同时比较任务指标、分数误差、峰值内存和稳定吞吐，再决定是否部署。",
            "code": "# 环境前提：支持该 v2 配置的兼容 torchao / PyTorch / 设备\n# model 是已构建、eval() 且已放到目标设备的模型\nfrom torchao.quantization import (\n    quantize_, Int8DynamicActivationInt8WeightConfig)\n\nconfig = Int8DynamicActivationInt8WeightConfig(version=2)\nquantize_(model, config)  # 原地转换受支持模块；先保留浮点基线\n# 用代表性输入验证质量，再在目标硬件测量性能。",
            "language": "python",
            "callout": "位宽、量化粒度、后端内核和模型质量是不同维度；“int8”三个字不足以定义一个可复现部署配置。"
          }
        ],
        "takeaways": [
          "先跑通目标运行时的浮点基线，再加入量化",
          "低比特节约存储不自动保证低延迟",
          "记录 torchao 配置版本、依赖版本与硬件支持"
        ],
        "references": [
          {
            "label": "ONNX export：现代路线与 legacy 提示",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/onnx/__init__.py"
          },
          {
            "label": "TorchAO 固定版本：量化配置与 quantize_",
            "url": "https://github.com/pytorch/ao/blob/3972ed015091f659418dedf12edb980a8ca56b53/torchao/quantization/quant_api.py"
          },
          {
            "label": "TorchAO 安装与依赖兼容入口",
            "url": "https://github.com/pytorch/ao/blob/3972ed015091f659418dedf12edb980a8ca56b53/README.md"
          },
          {
            "label": "TorchScript trace：弃用提示仍保留接口",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/jit/_trace.py"
          }
        ],
        "quiz": [
          {
            "id": "deployment-3-q1",
            "type": "single",
            "prompt": "ONNX 导出成功能够直接证明哪一项？",
            "options": [
              "每个运行时都支持全部算子",
              "模型已经量化成 int8",
              "转换过程生成了相应图产物",
              "所有硬件上都更快"
            ],
            "answer": 2,
            "explanation": "导出成功说明产生了图产物，并不证明目标后端兼容、数值正确或性能提升，量化也不是自动完成的。",
            "topic": "ONNX"
          },
          {
            "id": "deployment-3-q2",
            "type": "single",
            "prompt": "静态激活量化为什么通常需要代表性校准数据？",
            "options": [
              "为了自动增加精度位数",
              "为了估计实际激活范围和量化参数",
              "为了重新生成标签名称",
              "为了让所有模型层数相同"
            ],
            "answer": 1,
            "explanation": "静态量化需要用代表性激活分布估计范围，避免实际输入落入严重截断或低分辨率区间。校准不会自动增加位宽。",
            "topic": "量化"
          },
          {
            "id": "deployment-3-q3",
            "type": "single",
            "prompt": "课程中 TorchAO 配置 version=2 的准确含义是什么？",
            "options": [
              "该量化配置及表示路径的版本，不等于 PyTorch 或 torchao 包版本",
              "模型只能有两层",
              "必须安装 PyTorch 2.0",
              "只能使用两张 GPU"
            ],
            "answer": 0,
            "explanation": "固定源码中的 version 字段控制该量化配置路径，版本 1 已在该快照被拒绝；它与包主版本、网络层数及 GPU 数量无关。",
            "topic": "torchao"
          }
        ]
      },
      {
        "id": "deployment-4",
        "title": "批处理服务：延迟、吞吐与正确性",
        "description": "把模型包装成可测量的系统，并建立端到端验收标准。",
        "duration": 25,
        "difficulty": "实战",
        "objectives": [
          "分解排队、预处理、计算和传输耗时",
          "设计有边界的动态批处理",
          "验证 batching 与性能优化不改变请求语义"
        ],
        "sections": [
          {
            "heading": "用户等待的不只是一次 forward",
            "body": "端到端延迟包括请求接入、排队、预处理、CPU 到设备传输、模型执行、后处理以及结果返回。单独测 forward 可以帮助定位计算瓶颈，却不能替代服务延迟。吞吐通常按单位时间完成的请求数或样本数计算，必须说明分母与工作负载；不同输入长度和 batch 分布的数字不能直接比较。\n\n报告至少包含稳定阶段的吞吐、延迟分位数以及错误率。平均延迟容易隐藏长尾，应同时观察 P50、P95 或 P99。冷启动、首次编译和内核预热的成本应单独列出，不要悄悄混入或删除而不给解释。"
          },
          {
            "heading": "动态批处理用少量等待换设备效率",
            "body": "动态批处理在短时间窗口聚合兼容请求，以更大矩阵提高设备利用率，但等待拼 batch 也会增加单请求延迟。需要同时设置最大 batch、最大等待时间、队列容量和超时策略。输入 shape 不同的图像或序列可以按兼容形状分桶或 padding；padding 又会增加无效计算，所以 batch 越大并不一定越好。\n\n请求取消、超时、异常和输出顺序必须有明确语义。不能在拼接时改变样本与请求 ID 的对应关系，也不能把一个失败请求的结果发给下一个请求。背压应限制系统接受超过处理能力的工作量，否则队列持续增长会掩盖真正的过载。"
          },
          {
            "heading": "先验证批与逐条计算在语义上一致",
            "body": "下面代码是 CPU 可运行的批处理计算核心，展示请求 ID 关联和数值对照，不是完整 HTTP 服务，也没有实现排队定时器。所有样本具有相同特征维，模型为 eval 状态且各样本独立。对含跨样本统计、随机行为或共享隐状态的模型，需要重新确认是否允许这样批处理。\n\n单条与整批的浮点运算可能采用不同内核，比较应允许合理误差。验证时保留原始请求 ID，不要只排序预测类别后比较；那样即使响应发生错配，汇总分布也可能完全相同。\n\n本例要求 batch_size 为正整数，每个请求 ID 为唯一字符串。负 batch_size 可能让循环直接跳过，重复 ID 又会覆盖字典里的已有结果，所以计算前就应拒绝这两种输入，而不是等用户发现漏掉了响应。",
            "code": "import torch\nfrom torch import nn\n\nmodel = nn.Sequential(nn.Linear(8, 16), nn.ReLU(),\n                      nn.Linear(16, 3)).eval()\nrequests = [(f\"req-{i}\", torch.randn(8)) for i in range(9)]\n\n@torch.inference_mode()\ndef infer_batches(requests, batch_size=4):\n    if type(batch_size) is not int or batch_size <= 0:\n        raise ValueError(\"batch_size must be a positive integer\")\n    ids = [request_id for request_id, _ in requests]\n    if any(not isinstance(request_id, str) for request_id in ids):\n        raise ValueError(\"request IDs must be strings\")\n    if len(set(ids)) != len(ids):\n        raise ValueError(\"request IDs must be unique\")\n    results = {}\n    for start in range(0, len(requests), batch_size):\n        chunk = requests[start:start + batch_size]\n        x = torch.stack([features for _, features in chunk])\n        logits = model(x)\n        for (request_id, _), row in zip(chunk, logits):\n            results[request_id] = row.clone()\n    return results\n\nbatched = infer_batches(requests)\nindividual = infer_batches(requests, batch_size=1)\nfor request_id, _ in requests:\n    torch.testing.assert_close(batched[request_id],\n                               individual[request_id], atol=1e-6, rtol=1e-5)",
            "language": "python"
          },
          {
            "heading": "性能实验必须能解释收益和代价",
            "body": "在代表性流量下预热，然后分别测不同 batch 上限和等待窗口。记录请求到达与完成时间、实际 batch 大小、有效输入长度、设备内存和利用率。使用 CUDA 时，CPU 的函数返回不一定表示 GPU 已执行完毕；内核级测量可用 CUDA events，端到端测量则要覆盖必要同步和数据传输，但不要为了每条请求打点引入不必要的全局同步。\n\n本课推理模式语义对照 PyTorch 0506d907c966。结业练习：为视觉、变长序列或表格模型任选其一，提交输入契约、单条与批处理一致性结果、批大小扫描、P95 延迟和过载拒绝策略。浏览器中的课程练习只检查知识与代码阅读；真实性能数字应来自你实际运行的设备，不能用教学代码推断一组生产吞吐。",
            "callout": "离线吞吐最优 batch 不一定满足在线延迟目标；最终配置要同时通过质量、容量和延迟验收。"
          }
        ],
        "takeaways": [
          "端到端延迟需要覆盖排队与传输",
          "批处理必须保留请求关联并限制等待和队列",
          "性能提升要在真实工作负载与正确性约束下成立"
        ],
        "references": [
          {
            "label": "inference_mode 与线程局部行为",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/autograd/grad_mode.py"
          },
          {
            "label": "Linear 的批维语义",
            "url": "https://github.com/pytorch/pytorch/blob/0506d907c966a291c92994be69894545d5b8ca2a/torch/nn/modules/linear.py"
          }
        ],
        "quiz": [
          {
            "id": "deployment-4-q1",
            "type": "single",
            "prompt": "动态 batching 的主要权衡是什么？",
            "options": [
              "会自动无限扩容",
              "一定同时降低所有请求延迟",
              "只改变模型准确率",
              "等待聚合可能提高设备效率，但增加排队延迟"
            ],
            "answer": 3,
            "explanation": "聚合请求有助于提高硬件利用率，但需要等待形成 batch，因此应在吞吐和延迟目标之间调节窗口与上限。",
            "topic": "动态批处理"
          },
          {
            "id": "deployment-4-q2",
            "type": "single",
            "prompt": "只用 CPU 计时器包住 CUDA forward，且没有处理异步执行，可能漏掉什么？",
            "options": [
              "Python 变量名长度",
              "模型类别数",
              "GPU 尚未完成的实际计算时间",
              "输入 shape 的定义"
            ],
            "answer": 2,
            "explanation": "CUDA 发射通常异步，CPU 调用返回不代表 GPU 计算完成。应使用合适的 CUDA events 或明确同步边界。",
            "topic": "性能测量"
          },
          {
            "id": "deployment-4-q3",
            "type": "single",
            "prompt": "为什么批处理验证应按请求 ID 比较结果？",
            "options": [
              "这样就不用检查数值",
              "否则输出错配可能被相同的汇总预测分布掩盖",
              "ID 会提高矩阵乘法精度",
              "模型必须读取 ID 字符串"
            ],
            "answer": 1,
            "explanation": "请求与结果的对应关系是服务正确性的一部分。只看汇总指标可能无法发现两个请求拿到了彼此的结果。",
            "topic": "服务正确性"
          }
        ]
      }
    ]
  }
];
