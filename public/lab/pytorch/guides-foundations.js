window.GUIDES_FOUNDATIONS = {
  "tensor-1": {
    "scenario": "你从一个批次张量切出左右两组特征，准备分别缓存和修改。它们的 data_ptr 不同，看起来像独立数组，但一次写入却影响了原始批次。这个实验专门区分三个问题：两个对象是否共用一块存储、它们访问的位置是否重叠、后续修改是否应该被另一份结果看到。把这些问题分开，才能决定哪里需要复制，哪里保留视图即可。",
    "prerequisites": [],
    "terms": [
      {
        "name": "别名",
        "meaning": "多个张量对象引用同一底层存储，名称不同不能证明所有权独立。"
      },
      {
        "name": "首元素指针",
        "meaning": "data_ptr 指向当前张量的第一个元素，会受到 storage_offset 影响。"
      },
      {
        "name": "访问集合",
        "meaning": "一个视图实际会读写哪些存储位置；同一存储中的两个集合可以不相交。"
      },
      {
        "name": "快照",
        "meaning": "需要在未来保持当前值的独立副本，通常要求明确复制数据。"
      }
    ],
    "observe": "在存储图中先切换到“切片偏移”，观察高亮的逻辑首元素如何对应存储位置。接着想象把两条切片叠在同一条存储带上：是否共用底座和高亮格子是否重叠是两项独立判断。不要用两张看起来分开的矩阵图推断底层一定分配了两份内存。",
    "walkthrough": {
      "title": "两块不重叠的视图，仍然可以共用存储",
      "intro": "代码只使用固定整数，输出不依赖随机数或机器地址。我们不打印真实指针，而只比较它们的关系。先证明左右切片拥有共同存储，再在左侧写入一个位置，观察右侧与原矩阵的变化，最后用 clone 建立真正独立的历史快照。",
      "code": "import torch\nbase = torch.arange(12).reshape(3, 4)\nleft, right = base[:, :2], base[:, 2:]\nshared = left.untyped_storage().data_ptr() == right.untyped_storage().data_ptr()\nprint(\"offsets:\", left.storage_offset(), right.storage_offset())\nprint(\"same storage:\", shared)\nprint(\"same first pointer:\", left.data_ptr() == right.data_ptr())\n\nleft[1, 1] = -99\nprint(\"base row 1:\", base[1].tolist())\nprint(\"right row 1:\", right[1].tolist())\nassert base[1, 1].item() == -99\nassert right[1].tolist() == [6, 7]\n\nsnapshot = left.clone()\nleft[0, 0] = 77\nprint(\"current first:\", left[0, 0].item())\nprint(\"snapshot first:\", snapshot[0, 0].item())\nprint(\"snapshot middle:\", snapshot[1, 1].item())\nassert snapshot.untyped_storage().data_ptr() != base.untyped_storage().data_ptr()",
      "output": "offsets: 0 2\nsame storage: True\nsame first pointer: False\nbase row 1: [4, -99, 6, 7]\nright row 1: [6, 7]\ncurrent first: 77\nsnapshot first: 0\nsnapshot middle: -99\n",
      "steps": [
        {
          "title": "建立切片并辨认指针",
          "lines": [
            1,
            7
          ],
          "explanation": "左右切片 shape 都是三行两列，stride 都是四和一，但起点分别在存储位置零与二。首元素不同，所以 data_ptr 不同；底层存储起点相同，所以 storage 指针相同。这样的组合并不矛盾，它表示同一批数据的不同窗口。比较的是关系而非地址数值，因而结果可复现。",
          "state": "base 仍有十二个元素；left 和 right 各解释六个逻辑位置，没有新复制。"
        },
        {
          "title": "修改一个视图，检查受影响范围",
          "lines": [
            9,
            13
          ],
          "explanation": "left 的第二行第二列对应原矩阵同一位置，写入立即反映在 base。right 访问的是每行第三、第四列，与此次写入不重叠，所以它的值保持不变。共享存储意味着可能互相影响，而不是所有操作都会影响对方；必须继续检查具体地址集合。",
          "state": "原存储位置五改为负九十九，右侧窗口访问的位置六、七不变。"
        },
        {
          "title": "为跨阶段保存建立副本",
          "lines": [
            15,
            20
          ],
          "explanation": "clone 在当前时间点复制 left 的值，因此快照包含刚才写入的负九十九，却不包含稍后写入的七十七。快照的含义与复制发生的时间紧密相关。这里输入是整数、没有梯度图；可训练浮点张量若还要切断历史反向关系，则需要额外使用 detach。",
          "state": "新存储保存复制时的六个值，后续对 left 的原地写入不再改变 snapshot。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "首元素地址不同就当作独立副本",
        "why": "切片偏移可以让共享存储的张量拥有不同 data_ptr；这个检查遗漏了存储基址。后续缓存修改可能污染原输入。",
        "fix": "同时看 storage_offset、stride 和底层存储关系；必须隔离修改时显式 clone。"
      },
      {
        "wrong": "看到共享存储就认定两个切片一定重叠",
        "why": "左右窗口虽然属于同一存储，却访问不相交的位置。过度推断可能带来不必要的大块复制。",
        "fix": "根据偏移和步长列出少量代表坐标，区分同一存储、实际重叠和写入生命周期。"
      }
    ],
    "check": {
      "prompt": "若把 snapshot = left.clone() 改成 snapshot = left，最后两次读取会发生什么？",
      "hint": "赋值只引入新名称，并没有把六个值复制到新存储。",
      "answer": "snapshot 与 left 是同一对象，因此 first 会变成 77；middle 仍为此前写入的 -99。它不再表示复制时刻的历史状态。即使改成 left.detach()，在这里也仍然共享数据。"
    },
    "transfer": "将同样的方法用在缓存、数据增强和模型权重快照中：先明确是否需要保留旧值，再决定复制位置。小切片可能保留大存储；复制有带宽成本，但可能缩短大分配的生命周期。性能选择应建立在正确的所有权需求之上，而不是一律使用视图或一律复制。"
  },
  "tensor-2": {
    "scenario": "回归模型输出为 [B,1]，数据集标签为 [B]。两者相减没有报错，训练也产生有限 loss，但损失比较的是每个预测与全部标签，而不是逐样本配对。这个例子展示形状合法却语义错误的典型情形：广播从右对齐，它不了解哪一条轴代表样本，也不会替你判断任务目标。",
    "prerequisites": [
      "tensor-1"
    ],
    "terms": [
      {
        "name": "广播",
        "meaning": "从右侧对齐维度，长度相等或其中一个为一时允许扩展。"
      },
      {
        "name": "单例轴",
        "meaning": "长度为一的维度，用来显式定位需要复用的轴，而不是随便补形状。"
      },
      {
        "name": "配对误差",
        "meaning": "第 i 个预测只与第 i 个标签比较；这是当前回归任务的统计单位。"
      },
      {
        "name": "交叉误差",
        "meaning": "每个预测与所有标签比较，会生成额外的二维组合并改变损失。"
      }
    ],
    "observe": "切到广播图，先看每个轴的标签，再看重复发生在哪个方向。把 [3,1] 与 [3] 按右侧对齐，会得到 [3,1] 与 [1,3]，所以结果是三乘三。观察矩阵的对角线虽然正确为零，其他位置仍然参与了错误的平均。",
    "walkthrough": {
      "title": "一个不报错的广播，怎样把逐样本误差变成配对矩阵",
      "intro": "三个预测恰好等于三个标签，因此正确损失必须为零。这个人工构造给出明确的判定依据，无需训练曲线。先计算错误广播结果，再显式增加标签的最后一维，最后以断言保护输出和目标的形状契约。",
      "code": "import torch\nprediction = torch.tensor([[1.], [2.], [3.]])\ntarget = torch.tensor([1., 2., 3.])\nwrong_error = prediction - target\nprint(\"input shapes:\", tuple(prediction.shape), tuple(target.shape))\nprint(\"broadcast shape:\", tuple(wrong_error.shape))\nprint(\"broadcast errors:\", wrong_error.tolist())\n\npaired_target = target.unsqueeze(-1)\ncorrect_error = prediction - paired_target\nprint(\"paired shape:\", tuple(correct_error.shape))\nprint(\"wrong mse:\", round(wrong_error.square().mean().item(), 6))\nprint(\"correct mse:\", correct_error.square().mean().item())\n\ndef paired_mse(pred, labels):\n    labels = labels.reshape(-1, 1)\n    assert pred.shape == labels.shape\n    return (pred - labels).square().mean()\n\nassert paired_mse(prediction, target).item() == 0\nprint(\"paired invariant:\", bool(correct_error.eq(0).all()))",
      "output": "input shapes: (3, 1) (3,)\nbroadcast shape: (3, 3)\nbroadcast errors: [[0.0, -1.0, -2.0], [1.0, 0.0, -1.0], [2.0, 1.0, 0.0]]\npaired shape: (3, 1)\nwrong mse: 1.333333\ncorrect mse: 0.0\npaired invariant: True\n",
      "steps": [
        {
          "title": "建立确定性的预测与标签",
          "lines": [
            1,
            7
          ],
          "explanation": "两个张量右对齐时，prediction 的最后一维一扩成三，target 缺少的首维一也扩成三。得到的每行对应一个预测，每列对应一个标签，而不是每行一个误差。广播完全满足库规则，错误来自调用方对样本轴含义的假设。",
          "state": "误差矩阵为三行三列，对角线零不代表全部配对都正确。"
        },
        {
          "title": "让标签轴与预测语义一致",
          "lines": [
            9,
            13
          ],
          "explanation": "unsqueeze(-1) 把标签变成 [B,1]，每行对应同一个样本，减法不再产生交叉样本组合。错误损失为所有九项平方的均值，即十二除以九；正确损失只有三项，全部为零。目标不同无法通过最后调整学习率修复，必须从轴对齐处纠正。",
          "state": "标签与预测现在拥有相同形状和相同的样本配对含义。"
        },
        {
          "title": "把语义要求写成边界断言",
          "lines": [
            15,
            21
          ],
          "explanation": "边界函数明确当前只支持每个样本一个标量的任务，因此把标签规范成单列，并检查整体形状。这不是任意张量通用的修复工具：多输出回归不能盲目 reshape 标签。断言应该表达你真正支持的数据契约，使错误尽量在进入损失之前暴露。",
          "state": "未来标签批量或输出维度改变时，接口会检查任务规定的配对形状。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "把能广播等同于能正确训练",
        "why": "算子只检查维度规则，不知道样本一对一关系。即使损失有限且可以反向，也可能优化完全不同的目标。",
        "fix": "写下每个轴含义，用能手算的相等预测/标签验证正确 loss 应为零。"
      },
      {
        "wrong": "看到维度不匹配就随意 squeeze 或 reshape",
        "why": "去掉 batch=1 的维度或摊平多输出标签，可能在某些批量上碰巧运行，换形状后失效。",
        "fix": "指定需要增加或去掉的轴，并在任务边界检查完整形状；避免无参数 squeeze 改变语义。"
      }
    ],
    "check": {
      "prompt": "若 B=1，错误写法暂时也得到零损失，能否证明它适用于更大 batch？",
      "hint": "当样本数为一时，交叉配对矩阵也只有一个元素。",
      "answer": "不能。B=1 隐藏了错误的额外样本轴。应至少用两个取值不同的样本测试，确保没有把每个预测和其他样本标签一起比较。"
    },
    "transfer": "同样的形状审查适用于 [B,T,D] 的样本权重、[B,T,V] 的 token 选择和注意力 mask。先标记哪个轴独立、哪个轴复用，再写 unsqueeze 或 gather。很多静默训练错误不是公式难，而是一个合法广播把统计单位悄悄改了。"
  },
  "tensor-3": {
    "scenario": "你把低精度张量求和，结果为无穷，再把结果转成 FP32 却仍然是无穷。另一处 log(softmax(x)) 出现负无穷，明明输入只差两千。这两个现象都说明数据类型转换的时机和数值公式一样重要。把已经丢失的信息转换到更宽类型，只能保存错误结果，不能重建原来的有限数。",
    "prerequisites": [
      "tensor-1",
      "tensor-2"
    ],
    "terms": [
      {
        "name": "表示范围",
        "meaning": "某种浮点类型能保存的有限最大与最小尺度，与有效数字位数不同。"
      },
      {
        "name": "累计类型",
        "meaning": "归约过程中使用的数值类型，与输入存储类型和最后结果类型需要分别检查。"
      },
      {
        "name": "下溢",
        "meaning": "极小非零数被舍入到零；随后取对数会得到负无穷。"
      },
      {
        "name": "稳定组合算子",
        "meaning": "直接实现组合数学目标，避免先产生容易溢出或下溢的中间结果。"
      }
    ],
    "observe": "在精度图中分别切换 FP16 与 BF16，先看可表示范围，再看有效精度。这里的求和失败来自结果超出 FP16 范围，而不是元素本身不能保存。观察 softmax 后的概率时，也要想到图上看起来为零的小柱子，取 log 后可能已经无法恢复。",
    "walkthrough": {
      "title": "在损失发生之前选择精度，而不是事后修补",
      "intro": "我们只用两个 FP16 数和两个明显分离的 logits。输出采用有限性判断和固定整数，避免依赖格式化差异。对照同一求和在不同阶段转换，以及同一对数概率使用两种公式计算的结果，从而定位真正丢失信息的位置。",
      "code": "import torch\nvalues = torch.tensor([60000., 60000.], dtype=torch.float16)\nlow_sum = values.sum()\nlate_cast = low_sum.float()\nprint(\"inputs finite:\", bool(torch.isfinite(values).all()))\nprint(\"low sum finite:\", bool(torch.isfinite(low_sum)))\nprint(\"late cast finite:\", bool(torch.isfinite(late_cast)))\n\nwide_sum = values.sum(dtype=torch.float32)\nearly_cast = values.float().sum()\nprint(\"wide sum:\", int(wide_sum.item()))\nprint(\"early cast equal:\", bool(wide_sum == early_cast))\nassert torch.isfinite(wide_sum)\n\nlogits = torch.tensor([1000., -1000.])\ntwo_stage = logits.softmax(-1).log()\nstable = logits.log_softmax(-1)\nprint(\"two-stage finite:\", torch.isfinite(two_stage).tolist())\nprint(\"stable logprob:\", stable.tolist())\nassert stable.tolist() == [0.0, -2000.0]",
      "output": "inputs finite: True\nlow sum finite: False\nlate cast finite: False\nwide sum: 120000\nearly cast equal: True\ntwo-stage finite: [True, False]\nstable logprob: [0.0, -2000.0]\n",
      "steps": [
        {
          "title": "先验证元素有限，但求和结果不可表示",
          "lines": [
            1,
            7
          ],
          "explanation": "每个六万都能由 FP16 表示，两者之和十二万超过其有限范围。即使底层可能使用更宽的内部计算，默认返回 FP16 的结果仍无法保存这个数。之后调用 float 只把无穷转成 FP32 的无穷，不会重新执行求和，也不会找回原始结果。",
          "state": "数值问题已经发生在低精度结果物化时，事后扩大 dtype 无法修复。"
        },
        {
          "title": "在归约前指定足够的类型",
          "lines": [
            9,
            13
          ],
          "explanation": "sum 的 dtype 参数让归约使用指定类型，先把输入转成 FP32 再求和也得到有限结果。两种写法在本例数学上相同，分配和性能未必相同。实际长序列损失还应验证累计误差与目标容差，而不仅检查是否出现无穷；范围够大也不保证舍入可以忽略。",
          "state": "同一输入得到十二万的有限 FP32 结果，原始 FP16 存储不必永久改变。"
        },
        {
          "title": "避免先把极小概率算成零",
          "lines": [
            15,
            20
          ],
          "explanation": "softmax 会把第二个极小概率舍入为零，再取 log 得到负无穷。log_softmax 直接计算稳定的对数概率，不需要先物化那个极小正数，因此能保留负两千。对分类损失应直接使用接收 logits 的交叉熵；对 token logprob 应优先 log_softmax，而不是事后修补非有限输出。",
          "state": "概率空间已经丢失的极小量，在对数空间可以保留有意义的有限尺度。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "发现 inf 后直接对结果 float",
        "why": "类型转换不重算过去的运算，有限范围溢出已经把不同大数都折叠成无穷。",
        "fix": "定位第一个非有限中间量，在敏感运算前或归约接口里选取合适类型。"
      },
      {
        "wrong": "把 softmax 再 log 当作永远等价的实现",
        "why": "数学等价不等于有限精度下等价；概率下溢到零后对数结果不可恢复。",
        "fix": "使用 log_softmax、logsumexp 或 CrossEntropyLoss 等稳定组合，并保留数值边界测试。"
      }
    ],
    "check": {
      "prompt": "把 values.sum().float() 改成 values.sum(dtype=torch.float32)，为什么不是单纯的写法偏好？",
      "hint": "比较转换发生在求和之前还是结果已经产生之后。",
      "answer": "后者让计算及输出在足够宽的类型中形成有限结果，前者只能转换已经溢出的结果。两者在本例分别得到十二万和无穷，直接改变正确性。"
    },
    "transfer": "阅读 AMP 或低精度训练代码时，分别标出参数存储、算子计算、归约和输出 dtype。autocast 不保证所有自写表达式都稳定，BF16 的大范围也不能替代合理的数学公式。先用小而极端的输入验证目标，再在真实设备上评估性能。"
  },
  "tensor-4": {
    "scenario": "一个注意力算子输出 [B,H,T,D]，下游要求 [B,T,H×D]。直接 reshape 可以运行，元素数量也正确，但不同 head 和 token 的值被错误地拼到一起。这种错误不会被形状检查发现。我们给每个位置填不同整数，沿着语义坐标追踪合头，展示布局转换应先处理轴顺序，再讨论复制成本。",
    "prerequisites": [
      "tensor-1",
      "tensor-2"
    ],
    "terms": [
      {
        "name": "轴置换",
        "meaning": "改变逻辑轴顺序，例如把 head 和 token 互换，不等同于只修改各轴长度。"
      },
      {
        "name": "合头",
        "meaning": "在同一个 token 内把多个 head 的特征拼接到最后一维。"
      },
      {
        "name": "连续化",
        "meaning": "把当前逻辑顺序按指定内存格式复制或规范化；已满足格式时可能无需复制。"
      },
      {
        "name": "布局兼容",
        "meaning": "原 stride 是否允许新 shape 以视图方式解释；与元素总数相同不是一回事。"
      }
    ],
    "observe": "在 view/reshape 图中先选择转置视图，观察逻辑格子如何重排，但存储带不变；再选择连续化，观察新存储按新的逻辑顺序排列。不要把“图中矩阵变了形状”理解为数据已经按目标轴重新排序。请用每个 token 的两个 head 应该相邻这一要求检查结果。",
    "walkthrough": {
      "title": "合并 heads 之前，先把 token 放回正确的轴",
      "intro": "例子使用 B=1、H=2、T=3、D=2，共十二个整数。正确结果的第一个 token 应拼接第零个 head 的 [0,1] 与第一个 head 的 [6,7]。只要先手写这一行，就能判断后面两条看似合法的 reshape 路径哪一条保持了语义。",
      "code": "import torch\nhead_output = torch.arange(12).reshape(1, 2, 3, 2)\nwrong = head_output.reshape(1, 3, 4)\nprint(\"head 0:\", head_output[0, 0].tolist())\nprint(\"head 1:\", head_output[0, 1].tolist())\nprint(\"direct reshape:\", wrong[0].tolist())\n\ntoken_major = head_output.transpose(1, 2)\ncorrect = token_major.reshape(1, 3, 4)\nprint(\"transposed stride:\", token_major.stride())\nprint(\"merged correctly:\", correct[0].tolist())\nprint(\"same values by position:\", torch.equal(correct, wrong))\n\nexplicit = token_major.contiguous().view(1, 3, 4)\ntorch.testing.assert_close(explicit, correct)\nassert correct[0, 0].tolist() == [0, 1, 6, 7]\nassert correct[0, 2].tolist() == [4, 5, 10, 11]\nprint(\"explicit path agrees:\", torch.equal(explicit, correct))",
      "output": "head 0: [[0, 1], [2, 3], [4, 5]]\nhead 1: [[6, 7], [8, 9], [10, 11]]\ndirect reshape: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]]\ntransposed stride: (12, 2, 6, 1)\nmerged correctly: [[0, 1, 6, 7], [2, 3, 8, 9], [4, 5, 10, 11]]\nsame values by position: False\nexplicit path agrees: True\n",
      "steps": [
        {
          "title": "制造能看出错排的 head 输出",
          "lines": [
            1,
            6
          ],
          "explanation": "连续存储先放完 head 零的全部 token，再放 head 一。直接 reshape 把每四个连续元素凑成一行，因此第一行得到两个来自 head 零的不同 token。元素没有丢失、shape 也合法，但这里的行已不再代表同一个 token 的全部 head，这正是需要被测试发现的错误。",
          "state": "wrong 的第一行是 [0,1,2,3]，其中后两项属于下一个 token。"
        },
        {
          "title": "先交换 token/head，再合并特征",
          "lines": [
            8,
            12
          ],
          "explanation": "transpose 把逻辑顺序改为 batch、token、head、特征。此时 reshape 才是在同一个 token 内合并 head 与特征；原布局不支持时它会复制。正确性来自轴置换，复制只是实现形状要求可能需要的机制。不能通过给错误路径加 contiguous 来修复语义错排。",
          "state": "正确三行分别对应 token 零、一、二，各包含两个 head 的特征。"
        },
        {
          "title": "用可审查的另一条路径验证",
          "lines": [
            14,
            18
          ],
          "explanation": "显式 contiguous 再 view 与这里的 reshape 得到相同逻辑结果。这个断言验证输出值而不是依赖某次 reshape 是否共享存储。检查首尾 token 的具体位置还可以防止把错误参考也写成相同错排公式。性能优化之前，应保留这种小型索引语义测试。",
          "state": "两种正确实现都满足同一 token 内按 head 顺序拼接，具体复制行为仍由布局决定。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "元素总数相等就认为任意 reshape 都正确",
        "why": "reshape 不知道 head 或 token 的语义，它只按当前逻辑顺序重新组织元素。不同轴的值可能被合法地混到同一输出行。",
        "fix": "先画出轴置换，再合并相邻语义维度；用递增整数检查每个输出位置。"
      },
      {
        "wrong": "所有 view 失败都用 contiguous 无条件修复",
        "why": "复制可能消除布局异常，却不会自动修复先前的轴语义错误，也可能引入大块数据搬运。",
        "fix": "先确定目标索引对应关系，再决定 view、reshape 或显式连续化，最后测整体性能。"
      }
    ],
    "check": {
      "prompt": "若直接写 head_output.contiguous().view(1,3,4)，会得到正确合头结果吗？",
      "hint": "原 head_output 已经连续，调用 contiguous 不会交换 token 与 head。",
      "answer": "不会，它仍得到 direct reshape 的错误排列。缺少的是 transpose(1,2) 这一步语义轴置换，而不是某种能把内存变连续的操作。"
    },
    "transfer": "同类问题出现在图像通道布局、序列 batch 轴转换和分片张量拼接。为轴写出名字，并选择包含不同整数标记的输入，比只用全零或随机输出形状更容易定位错误。确认语义后，再衡量连续化是否值得。"
  },
  "autograd-1": {
    "scenario": "两个损失项共享同一输入，其中一项带正权重，另一项带负权重。你希望理解一次 backward 到底把哪些贡献相加，而不是背诵一个导数公式。这个例子选择一个会发生精确抵消的输入：最终某个梯度为零，但这不表示该输入没有参与计算。通过 VJP 与显式标量目标对照，可以区分零导数和断图。",
    "prerequisites": [
      "tensor-1",
      "tensor-2"
    ],
    "terms": [
      {
        "name": "雅可比",
        "meaning": "输出分量对输入分量的偏导矩阵，行对应输出、列对应输入。"
      },
      {
        "name": "上游梯度",
        "meaning": "后续标量目标对当前输出的导数，指定本次反向如何加权各输出。"
      },
      {
        "name": "VJP",
        "meaning": "按上游向量汇总各输出对输入的贡献；列向量约定下为 J 的转置乘 v。"
      },
      {
        "name": "导数抵消",
        "meaning": "多条有效路径贡献相加为零，不能据此认定输入未参与图。"
      }
    ],
    "observe": "在自动微分图中沿着从输出返回输入的箭头走，注意同一节点收到多条箭头时必须相加。把上游权重想成每条返回路径的倍率，而不是输出值。下面的第一个输入收到正二与负二，恰好抵消；图上仍然存在两条依赖。",
    "walkthrough": {
      "title": "零梯度也可能来自两条真实路径的抵消",
      "intro": "函数 y=[x₀+x₁,x₀x₁]，输入 x=[1,2]，上游 v=[2,-1]。雅可比为 [[1,1],[2,1]]，所以输入梯度为 [0,1]。再显式计算 L=2y₀−y₁，会得到同一结果。所有值都很小，手算与代码可以逐项对应。",
      "code": "import torch\nx = torch.tensor([1., 2.], requires_grad=True)\ny = torch.stack((x[0] + x[1], x[0] * x[1]))\nv = torch.tensor([2., -1.])\nprint(\"outputs:\", y.tolist())\nprint(\"upstream:\", v.tolist())\n\n(g,) = torch.autograd.grad(y, x, grad_outputs=v)\njacobian = torch.tensor([[1., 1.], [2., 1.]])\nmanual = jacobian.T @ v\ntorch.testing.assert_close(g, manual)\nprint(\"VJP:\", g.tolist())\nprint(\"leaf grad buffer:\", x.grad)\n\nz = torch.tensor([1., 2.], requires_grad=True)\nloss = 2 * (z[0] + z[1]) - z[0] * z[1]\nloss.backward()\nprint(\"scalar loss:\", loss.item())\nprint(\"backward:\", z.grad.tolist())\ntorch.testing.assert_close(z.grad, g)",
      "output": "outputs: [3.0, 2.0]\nupstream: [2.0, -1.0]\nVJP: [0.0, 1.0]\nleaf grad buffer: None\nscalar loss: 4.0\nbackward: [0.0, 1.0]\n",
      "steps": [
        {
          "title": "建立输出与上游权重",
          "lines": [
            1,
            6
          ],
          "explanation": "y 的两个分量分别是三与二，但上游梯度并不等于这两个值。v 表示我们随后把第一个输出乘二、第二个输出乘负一。把输出值与权重明确分开，可以避免在自定义 backward 中错误地乘上前向结果，或对向量输出默认一个并不存在的标量目标。",
          "state": "输入长度二、输出长度二、上游长度二，尚未把任何梯度写入 x.grad。"
        },
        {
          "title": "逐条汇总 VJP 并检查抵消",
          "lines": [
            8,
            13
          ],
          "explanation": "第一个输入的贡献是二乘一加负一乘二，等于零；第二个输入是二乘一加负一乘一，等于一。autograd.grad 返回这个向量而不填入 x.grad，所以 None 表示该缓冲区没有被累积，并非没有计算导数。数值零与缓冲区 None 的区别在这里同时出现。",
          "state": "g=[0,1] 是真实导数；x.grad 为 None 是当前调用接口的行为。"
        },
        {
          "title": "用显式标量目标独立复核",
          "lines": [
            15,
            20
          ],
          "explanation": "新的叶子 z 建立一张独立图，目标明确写为二倍加法减乘法。这次使用 backward，会把结果存入 z.grad。两条不同求导入口得到相同向量，证明向量反向对应的是所定义的加权标量目标，而不是完整雅可比或每个输出分别的一套梯度。",
          "state": "标量目标值四，参数梯度仍为 [0,1]；两个入口计算同一个数学目标。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "把零梯度当作输入完全未使用",
        "why": "有效路径的贡献可能精确抵消，也可能在当前点导数为零。真正未使用输入属于不同的图依赖情况。",
        "fix": "手算各路径贡献，并查看返回梯度与 .grad 缓冲区的区别，必要时扰动输入再比较。"
      },
      {
        "wrong": "非标量输出直接 backward，却没定义上游权重",
        "why": "向量包含多个可能的标量目标，库无法猜测你需要加和、平均还是带权组合。",
        "fix": "先写出目标权重，传 grad_outputs，或把向量明确归约为一个标量。"
      }
    ],
    "check": {
      "prompt": "保持 x=[1,2]，把上游权重改成 [1,1]，输入梯度应是多少？",
      "hint": "用同一个雅可比转置乘新的向量，或者对两个输出之和求导。",
      "answer": "结果是 [3,2]：第一个输入贡献一加二，第二个输入贡献一加一。改变上游权重改变标量目标，即使前向输出完全没有变化。"
    },
    "transfer": "多任务损失、辅助损失与正则项都可以按这样的加权路径理解。先确认每项的系数和归约分母，再讨论梯度大小。对训练异常进行诊断时，单看某个参数梯度为零不足以判定断图，需要结合依赖结构与目标定义。"
  },
  "autograd-2": {
    "scenario": "为了节省内存，你把三个训练目标拆成一个单元素 microbatch 和一个双元素 microbatch。每批都先求 mean 再除二，看起来符合“累积两次”，却改变了三个样本的权重。这个指南把参数缩减成一个标量，直接比较三种梯度：完整大批次、按总有效数累积和错误的微批均值平均。",
    "prerequisites": [
      "autograd-1",
      "tensor-2"
    ],
    "terms": [
      {
        "name": "叶子梯度",
        "meaning": "backward 默认把贡献累加到叶子 .grad，后续反向会继续相加。"
      },
      {
        "name": "累积窗口",
        "meaning": "一次 optimizer.step 覆盖的多个前向与反向，不等于多个独立更新。"
      },
      {
        "name": "有效计数",
        "meaning": "真正参与当前目标的样本或 token 数，决定平均损失的分母。"
      },
      {
        "name": "等权目标",
        "meaning": "每个有效元素具有相同系数，不能被所在 microbatch 的长度重新加权。"
      }
    ],
    "observe": "把梯度累积图切到“不等 token 数”，观察两批权重应随有效数量变化，而不是永远各占一半。图中的均值差异不只是日志现象，它会沿 backward 变成不同梯度。下面用一维参数让这件事可以精确手算，不依赖神经网络的随机性。",
    "walkthrough": {
      "title": "累积两个 microbatch，并不总是把每批 loss 除二",
      "intro": "初始参数 w=0，目标为 [1,4,6]，平方误差的总体平均导数是 −2×(1+4+6)/3，即 −22/3。将目标拆为 [1] 与 [4,6] 后，只要每批损失和都除以总数三，累积结果应该保持不变。我们用双精度并输出六位小数。",
      "code": "import torch\ntargets = [torch.tensor([1.], dtype=torch.float64),\n           torch.tensor([4., 6.], dtype=torch.float64)]\nreference = torch.tensor(0., dtype=torch.float64, requires_grad=True)\nall_targets = torch.cat(targets)\n(reference - all_targets).square().mean().backward()\nprint(\"global count:\", all_targets.numel())\nprint(\"reference gradient:\", round(reference.grad.item(), 6))\n\naccumulated = torch.tensor(0., dtype=torch.float64, requires_grad=True)\ntotal = sum(t.numel() for t in targets)\nfor target in targets:\n    ((accumulated - target).square().sum() / total).backward()\nprint(\"accumulated gradient:\", round(accumulated.grad.item(), 6))\ntorch.testing.assert_close(accumulated.grad, reference.grad)\n\nwrong = torch.tensor(0., dtype=torch.float64, requires_grad=True)\nfor target in targets:\n    ((wrong - target).square().mean() / len(targets)).backward()\nprint(\"micro-mean average:\", round(wrong.grad.item(), 6))\nprint(\"same objective:\", bool(torch.isclose(wrong.grad, reference.grad)))\naccumulated.grad = None\nprint(\"after reset:\", accumulated.grad)",
      "output": "global count: 3\nreference gradient: -7.333333\naccumulated gradient: -7.333333\nmicro-mean average: -6.0\nsame objective: False\nafter reset: None\n",
      "steps": [
        {
          "title": "先建立独立的大批次参考",
          "lines": [
            1,
            8
          ],
          "explanation": "参考直接包含全部三个元素，因此其 mean 分母明确为三。它不依赖任何 microbatch 实现，可以用来检查后续拆分是否保持同一目标。每个目标对梯度的贡献分别为负二、负八、负十二，再共同除三。参数只有一个，避免模型状态和随机层干扰归一化分析。",
          "state": "reference.grad 等于负二十二除以三，是后续比较的数学基准。"
        },
        {
          "title": "每批总和除共同分母，再累加",
          "lines": [
            10,
            15
          ],
          "explanation": "每次前向产生新图，反向后贡献累加到同一个叶子。共同分母在窗口开始就能由目标长度得到，不必保存所有前向图，也不需要 retain_graph。这里不调用 optimizer.step，因为我们先验证最终提交给优化器的梯度；真实循环应在窗口完成后再更新一次。",
          "state": "两个图的激活可以各自释放，叶子梯度保留两批合计的正确贡献。"
        },
        {
          "title": "观察均值的均值怎样改变权重",
          "lines": [
            17,
            23
          ],
          "explanation": "错误路径把第一个单元素 batch 分到一半权重，第二批两个元素共享另一半，因此三个目标权重是二分之一、四分之一、四分之一，而不是各三分之一。得到梯度负六。最后显式清空正确参数的梯度，表示下一次更新窗口不能继续混入上一个窗口的结果。",
          "state": "错误梯度虽然有限而且可用，优化目标已经改变；清梯度与是否保留计算图是不同机制。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "一律用每批平均 loss 除累积次数",
        "why": "只有每批平均使用相同有效数量，才等价于所有元素平均。可变长度和尾部不足整窗会破坏这个前提。",
        "fix": "对窗口内损失总和使用共同有效计数；分布式时还要计入 reducer 的平均系数。"
      },
      {
        "wrong": "每个 microbatch 清梯度或更新参数",
        "why": "清梯度丢掉前面的贡献，每批 step 则多次改变参数和优化器历史，两者都不再是一次大批量更新。",
        "fix": "窗口开头清梯度，逐批新前向并反向，窗口末尾统一裁剪和 step。"
      }
    ],
    "check": {
      "prompt": "若两个 microbatch 恰好各有两个有效元素，均值再平均是否与总体均值一致？",
      "hint": "写出每个元素最终系数，比较是否都等于四分之一。",
      "answer": "对可加且行为一致的损失，归一化在这种情况下相同。但 BatchNorm 的批统计、随机层和浮点顺序仍可能使整段训练不逐位一致，不能把分母相同推广为任何模型都完全等价。"
    },
    "transfer": "用同样的独立参考方法检查 token mask、变长样本和多 rank 训练。日志中的平均值也需要正确分母；然而日志误差和梯度误差应分别验证。先固定数据与参数检查梯度，再加入优化器，能更快定位倍数问题。"
  },
  "autograd-3": {
    "scenario": "你要冻结一个特征变换的权重，但仍训练它前面的网络。有人建议把冻结模块包在 no_grad 里，运行更省内存；结果前面可训练部分也收不到梯度。问题在于冻结参数和停止整个区域的求导不同。这个实验让模块权重固定为 [2,3]，直接观察损失能否继续对输入求导。",
    "prerequisites": [
      "autograd-1",
      "nn-1"
    ],
    "terms": [
      {
        "name": "冻结参数",
        "meaning": "设置参数 requires_grad=False，不再为其累积梯度，但输入依赖仍可能构图。"
      },
      {
        "name": "停止记录",
        "meaning": "no_grad 让区域中的普通操作不建立反向依赖，会影响梯度穿过该区域。"
      },
      {
        "name": "评估模式",
        "meaning": "eval 修改 Dropout、BatchNorm 等模块行为，本身不关闭自动微分。"
      },
      {
        "name": "训练边界",
        "meaning": "算法规定哪些变量应被优化、哪些是固定常量，而不只是代码性能开关。"
      }
    ],
    "observe": "在梯度模式图中依次选择 train、eval 和关闭梯度的场景，分别观察“模块行为”和“反向记录”两条信息。它们可以独立组合。随后把固定权重想成一条仍然可微的函数边：不更新这条边的参数，并不意味着不能沿它把导数传回输入。",
    "walkthrough": {
      "title": "冻结一个模块，也可以让梯度继续穿过它",
      "intro": "Linear 的权重设为 [2,3]，输入 [1,1]，输出五，平方损失二十五。对输入的导数应为二乘五再乘权重，即 [20,30]。我们先冻结参数但正常前向，再比较 no_grad 和 eval 的效果，所有权重均显式赋值，输出完全确定。",
      "code": "import torch\nfrom torch import nn\nlayer = nn.Linear(2, 1, bias=False)\nwith torch.no_grad():\n    layer.weight.copy_(torch.tensor([[2., 3.]]))\nlayer.requires_grad_(False)\nx = torch.tensor([[1., 1.]], requires_grad=True)\nloss = layer(x).square().sum()\nloss.backward()\nprint(\"input gradient:\", x.grad.tolist())\nprint(\"parameter gradient:\", layer.weight.grad)\n\nwith torch.no_grad():\n    detached_output = layer(x)\nprint(\"no_grad output requires_grad:\", detached_output.requires_grad)\nprint(\"input still requires_grad:\", x.requires_grad)\n\nlayer.eval()\nz = torch.tensor([[1., 1.]], requires_grad=True)\nevaluation_output = layer(z)\nevaluation_output.sum().backward()\nprint(\"eval output requires_grad:\", evaluation_output.requires_grad)\nprint(\"eval input gradient:\", z.grad.tolist())\nassert layer.weight.grad is None",
      "output": "input gradient: [[20.0, 30.0]]\nparameter gradient: None\nno_grad output requires_grad: False\ninput still requires_grad: True\neval output requires_grad: True\neval input gradient: [[2.0, 3.0]]\n",
      "steps": [
        {
          "title": "冻结权重并保留输入求导",
          "lines": [
            1,
            11
          ],
          "explanation": "权重是固定常量，但输出仍是输入的可微线性函数。因为 x 需要梯度，正常前向记录了足够的计算关系，backward 得到 [20,30]。layer.weight.grad 保持 None，说明参数未参与优化，并不妨碍输入导数。这正是训练冻结模块之前的适配器或输入扰动时所需行为。",
          "state": "参数没有梯度，输入获得非零梯度；冻结没有切断整条计算路径。"
        },
        {
          "title": "关闭区域记录会改变梯度路径",
          "lines": [
            13,
            16
          ],
          "explanation": "no_grad 作用于此次区域计算，不会永久修改 x 的 requires_grad 标志，也不会把参数变成另一组对象。但这次输出不再携带来自输入的反向关系，不能通过它把损失导数传回 x。离开作用域后梯度模式恢复，下一次正常前向仍可记录。",
          "state": "输入属性没有改变，特定前向产生的输出却失去了求导路径。"
        },
        {
          "title": "评估模式不等于停止求导",
          "lines": [
            18,
            24
          ],
          "explanation": "这个 Linear 本身没有训练/评估行为差异，但 eval 也不阻止它对输入构图。对输出求和时，上游梯度为一，所以输入导数直接是 [2,3]。更复杂模型中，eval 可能关闭 Dropout 或切换 BatchNorm 统计，而反向记录仍然由梯度模式和输入依赖决定。",
          "state": "模块处于评估模式，但当前输出和输入之间保持完整可微关系。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "冻结参数后顺手用 no_grad 包住整个模块",
        "why": "若前面的可训练输入还需要梯度，这会切断穿过冻结模块的路径，改变优化问题。",
        "fix": "根据算法分别设置参数可训练性和区域梯度模式，用输入梯度断言验证边界。"
      },
      {
        "wrong": "调用 eval 就认为不会占用反向图内存",
        "why": "eval 控制模块行为，输入或参数需要梯度时仍可能记录运算。验证代码因此可能意外保留图。",
        "fix": "纯验证同时选择合适的 no_grad 或 inference_mode；需要输入导数时保留构图。"
      }
    ],
    "check": {
      "prompt": "若在 layer 前添加一个可训练适配器，应该怎样冻结 layer 又能更新适配器？",
      "hint": "适配器输出是 layer 的输入，它对损失的影响需要穿过 layer 才能返回。",
      "answer": "对 layer 参数设置 requires_grad_(False)，按任务需要选择 train/eval，但让前向保持正常梯度记录。不要用 no_grad 包住这段需要传递输入梯度的计算。"
    },
    "transfer": "将这条规则用于冻结 backbone、知识蒸馏、输入优化和对抗扰动。教师输出作为固定目标时可以不构图；若需要对输入求导，边界就不同。不要把所有“冻结模型”套用同一段模板，应先写清需要的导数终点。"
  },
  "autograd-4": {
    "scenario": "你为立方函数写了自定义 backward，返回三倍输入平方。在最简单的 loss=output.sum() 上看似正确，接到两倍 loss 后却错了。局部导数只是链式法则的一部分，还必须乘传入的上游梯度。这个指南让错误实现与正确实现并排接受数值检查，再通过一个可手算的复合目标解释失败原因。",
    "prerequisites": [
      "autograd-1",
      "autograd-3"
    ],
    "terms": [
      {
        "name": "局部导数",
        "meaning": "当前操作输出对输入的导数，不包含后续目标的权重。"
      },
      {
        "name": "上游梯度",
        "meaning": "backward 收到的 grad_output，来自更后面的计算路径。"
      },
      {
        "name": "有限差分",
        "meaning": "通过输入小扰动近似导数，用来对照解析反向实现。"
      },
      {
        "name": "二阶检查",
        "meaning": "检查一阶反向本身能否继续求导，不能由一次前向正确性推断。"
      }
    ],
    "observe": "在 gradcheck 图中观察解析曲线与小扰动估计如何对照。再注意图上的导数只是局部函数关系：当外层把结果乘二，整条返回路径也应乘二。错误实现可能在上游恰为一的单个例子上蒙混过关，因此测试要包含不同上游权重。",
    "walkthrough": {
      "title": "漏乘 grad_output 的反向，为什么不能通过组合测试",
      "intro": "使用 double 精度固定输入，避开数值差分的低精度误差。BadCube 与 Cube 的 forward 完全相同，区别只有 backward 是否乘上游。gradcheck 检查导数及反向对上游的线性关系；最后直接计算两倍立方，在 x=2 时应得到梯度二十四。",
      "code": "import torch\nclass BadCube(torch.autograd.Function):\n    @staticmethod\n    def forward(ctx, x):\n        ctx.save_for_backward(x)\n        return x ** 3\n    @staticmethod\n    def backward(ctx, grad_output):\n        (x,) = ctx.saved_tensors\n        return 3 * x.square()\n\nprobe = torch.tensor([0.5, 1.5], dtype=torch.double, requires_grad=True)\nbad_ok = torch.autograd.gradcheck(BadCube.apply, (probe,), raise_exception=False)\nprint(\"bad backward passes:\", bad_ok)\n\nclass Cube(torch.autograd.Function):\n    @staticmethod\n    def forward(ctx, x):\n        ctx.save_for_backward(x)\n        return x ** 3\n    @staticmethod\n    def backward(ctx, grad_output):\n        (x,) = ctx.saved_tensors\n        return grad_output * 3 * x.square()\n\nprint(\"correct backward passes:\", torch.autograd.gradcheck(Cube.apply, (probe,)))\nprint(\"second derivative passes:\", torch.autograd.gradgradcheck(Cube.apply, (probe,)))\n\nx = torch.tensor(2., requires_grad=True)\n(2 * Cube.apply(x)).backward()\nprint(\"gradient of twice the cube:\", x.grad.item())\nassert x.grad.item() == 24",
      "output": "bad backward passes: False\ncorrect backward passes: True\nsecond derivative passes: True\ngradient of twice the cube: 24.0\n",
      "steps": [
        {
          "title": "写出缺失链式权重的错误反向",
          "lines": [
            1,
            14
          ],
          "explanation": "这段代码有正确的立方前向，也返回正确形式的局部导数，却完全忽略外部传入的权重。对零上游仍会返回非零梯度，已经违反反向传播的线性要求。使用 raise_exception=False 让检查失败以布尔值展示，不代表忽略错误；相反，我们明确要求错误实现被识别出来。",
          "state": "错误函数可以运行，但数值/反向契约检查返回 False。"
        },
        {
          "title": "补上上游，并验证高阶路径",
          "lines": [
            16,
            27
          ],
          "explanation": "保存输入而不是脱离图的中间导数，让 backward 中的 x.square 仍可在需要时参与高阶求导。正确实现先计算局部导数，再乘 grad_output，既能组合到任意后续目标，也能在本例通过二阶检查。高阶支持来自具体实现，不是自定义 Function 自动保证的属性。",
          "state": "相同 forward 配上完整链式法则，一阶和二阶检查都通过。"
        },
        {
          "title": "用带倍率的目标给出直观证据",
          "lines": [
            29,
            32
          ],
          "explanation": "外层乘二使上游梯度为二，局部立方导数在输入二处为十二，相乘得到二十四。若使用错误版本则仍返回十二。这个极小反例让失败具有可解释性：不是把 gradcheck 当作黑箱裁判，而是能说出少了哪条数学因素。",
          "state": "复合目标的导数包含外层权重，自定义算子已经能正确嵌入更大的图。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "只用 output.sum() 检查自定义反向",
        "why": "这种目标的上游通常全是一，可能掩盖忘乘 grad_output 的错误。",
        "fix": "加入零、非单位和不同分量的上游，并与普通 PyTorch 参考实现比较。"
      },
      {
        "wrong": "一次 gradcheck 通过就宣称所有形状和二阶导正确",
        "why": "检查只覆盖给定输入附近，一阶一致不保证广播、非连续布局或二阶路径正确。",
        "fix": "增加不同形状、广播和非连续输入；需要高阶导时单独运行 gradgradcheck。"
      }
    ],
    "check": {
      "prompt": "如果输出又乘以常数五，backward 应怎样接收这个变化？",
      "hint": "局部立方公式不变，外部倍率应沿图作为 grad_output 到达。",
      "answer": "无需为常数五重写立方算子。autograd 会把上游梯度乘五传入，正确 backward 再乘三倍输入平方即可。忽略 grad_output 的实现无法正确组合。"
    },
    "transfer": "自定义融合损失、外部库算子和特殊反向规则都需要遵守同样的 VJP 契约。能由普通可微算子组合时优先使用普通函数；只有确有边界或性能需求才承担自定义反向的验证责任。"
  },
  "nn-1": {
    "scenario": "你把几个 Linear 放进普通 Python 列表，前向能够计算，但优化器发现的参数数量为零；另一边保存 best_state 后继续更新，所谓最佳权重也跟着变了。这两个问题都与 nn.Module 的状态管理有关。指南用同一份小模型检查注册树、buffer 与 state_dict 的浅引用，避免把“能前向”和“能正确管理训练状态”混为一谈。",
    "prerequisites": [
      "tensor-1",
      "autograd-2"
    ],
    "terms": [
      {
        "name": "注册树",
        "meaning": "Module 递归维护的子模块、参数与缓冲区集合，驱动设备迁移和状态枚举。"
      },
      {
        "name": "ModuleList",
        "meaning": "注册内部模块的容器，不会像普通列表一样把层隐藏在递归管理之外。"
      },
      {
        "name": "Buffer",
        "meaning": "属于模型状态但不是优化器参数的张量，默认随设备迁移并进入 state_dict。"
      },
      {
        "name": "浅状态映射",
        "meaning": "state_dict 中的张量通常仍引用模型存储，保存字典变量不等于冻结值。"
      }
    ],
    "observe": "在模块注册图中区分 Parameter、buffer 与普通属性，沿着注册路径寻找谁会被 parameters 和 state_dict 看见。再把权重快照放回共享存储图理解：键名和字典对象是新的，不保证里面的张量数据也独立。对象组织与数据所有权需要同时检查。",
    "walkthrough": {
      "title": "前向可调用的层，未必已经注册到模型中",
      "intro": "错误容器和正确容器都包含一个无 bias 的二乘二 Linear。我们只比较参数枚举与状态，不依赖随机初值。正确模型还注册一个固定偏移 buffer，随后显式设置单位权重，再观察浅 state_dict 和独立快照面对原地修改的区别。",
      "code": "import torch\nfrom torch import nn\nbad = nn.Module()\nbad.layers = [nn.Linear(2, 2, bias=False)]\n\nclass Good(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.layers = nn.ModuleList([nn.Linear(2, 2, bias=False)])\n        self.register_buffer(\"offset\", torch.ones(2))\n    def forward(self, x):\n        return self.layers[0](x) + self.offset\n\ngood = Good()\nprint(\"bad parameter count:\", sum(p.numel() for p in bad.parameters()))\nprint(\"good parameter count:\", sum(p.numel() for p in good.parameters()))\n\nwith torch.no_grad():\n    good.layers[0].weight.copy_(torch.eye(2))\nprint(\"state keys:\", sorted(good.state_dict()))\nprint(\"parameter keys:\", sorted(dict(good.named_parameters())))\nprint(\"forward:\", good(torch.tensor([[2., 3.]])).tolist())\n\nstate = good.state_dict()\nsnapshot = {key: value.detach().clone() for key, value in state.items()}\nwith torch.no_grad():\n    good.layers[0].weight.add_(1)\nprint(\"shallow state follows:\", torch.equal(state[\"layers.0.weight\"], good.layers[0].weight))\nprint(\"snapshot follows:\", torch.equal(snapshot[\"layers.0.weight\"], good.layers[0].weight))",
      "output": "bad parameter count: 0\ngood parameter count: 4\nstate keys: ['layers.0.weight', 'offset']\nparameter keys: ['layers.0.weight']\nforward: [[3.0, 4.0]]\nshallow state follows: True\nsnapshot follows: False\n",
      "steps": [
        {
          "title": "比较普通列表与注册容器",
          "lines": [
            1,
            16
          ],
          "explanation": "普通列表里的层仍是合法 Python 对象，可以手工调用，但父 Module 不会把列表内容自动纳入注册树。ModuleList 则让内部权重被递归发现。这里正确参数数为四，offset 虽然也是张量却不是 Parameter，不应被算成训练参数。",
          "state": "两个容器表面相似，递归参数枚举结果却分别为零与四。"
        },
        {
          "title": "检查模型状态与计算值",
          "lines": [
            18,
            22
          ],
          "explanation": "state_dict 同时包含注册权重和持久 buffer，named_parameters 只包含权重。单位矩阵把输入原样传递，再加固定偏移得到 [3,4]。这样的确定性输入输出证明 buffer 真正参与模型行为，因而需要随模型保存；它不需要梯度并不意味着可以忽略状态管理。",
          "state": "offset 进入 checkpoint，但没有进入优化器参数；计算结果符合明确设置的状态。"
        },
        {
          "title": "浅映射与独立快照面对更新的区别",
          "lines": [
            24,
            29
          ],
          "explanation": "state 中的权重引用当前模型存储，因此原地增加一后它也变化。snapshot 逐个 clone 了值，保留修改前的单位矩阵。这个实验发生在同一进程内，没有文件序列化；若立即 torch.save，序列化会写出当时状态，但只把 state_dict 变量留在内存不是同一回事。",
          "state": "模型和浅状态仍同步变化，快照已经拥有独立的数据存储。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "普通列表能前向，就认为 optimizer 会自动发现",
        "why": "优化器通常来自 model.parameters，普通容器里的未注册层可能不在结果中，导致看似训练却没有更新这些权重。",
        "fix": "动态层使用 ModuleList/ModuleDict；构建优化器前检查参数名与数量。"
      },
      {
        "wrong": "best = model.state_dict() 就当成内存中的最佳权重",
        "why": "字典中的张量仍可能跟随模型修改，使最佳记录悄悄变成最新状态。",
        "fix": "需要长期独立快照时深拷贝或逐项 clone，并验证后续更新不会改变它。"
      }
    ],
    "check": {
      "prompt": "offset 需要跟随模型迁移设备，但每次加载后可重建、不必保存，应怎样注册？",
      "hint": "设备迁移与持久化是 buffer 的两个不同能力。",
      "answer": "使用 register_buffer('offset', tensor, persistent=False)。它仍由模块管理并随设备迁移，但不会进入 state_dict；恢复时需由构造或重建逻辑生成正确值。"
    },
    "transfer": "阅读模型封装、适配器和共享权重代码时，先核对注册路径和参数身份。替换 Parameter 对象不等于修改其数值，既有优化器可能仍指向旧对象。状态完整性应通过参数名、buffer 与恢复行为共同验证。"
  },
  "nn-2": {
    "scenario": "你叠了很多 Linear，却不理解为什么没有非线性时表达能力仍受限制。与其先训练一个随机网络，不如构造一个可以手算的 XOR：输入两位零一，恰好一位为一时输出一，否则零。我们直接指定两层权重，观察 ReLU 怎样改变函数，再去掉它作为反例，区分网络深度与真正的非线性表达。",
    "prerequisites": [
      "nn-1",
      "tensor-2"
    ],
    "terms": [
      {
        "name": "仿射映射",
        "meaning": "矩阵乘法加偏置，多个仿射映射复合仍是一个仿射映射。"
      },
      {
        "name": "激活函数",
        "meaning": "在层之间引入非线性，使不同输入区域能够采用不同的响应关系。"
      },
      {
        "name": "隐藏特征",
        "meaning": "中间层构造的表示，本例是输入和与超过一的部分。"
      },
      {
        "name": "构造性验证",
        "meaning": "直接设定已知权重验证模型能表示某个函数，不等同于证明优化器一定能学到它。"
      }
    ],
    "observe": "在 MLP 图中逐层追踪形状，尤其注意 Linear 与非线性之间的边界。这个例子所有层的形状都很简单，关键在于 ReLU 把负的隐藏值截成零，使零输入不再被第二个隐藏单元抵消。只看参数数量或层数无法发现这种函数性质变化。",
    "walkthrough": {
      "title": "用确定性权重构造 XOR，看到非线性真正做了什么",
      "intro": "令 s=x₀+x₁，隐藏层构造 [ReLU(s),ReLU(s−1)]，输出取第一项减第二项的两倍。对于 s=0、1、2，结果分别为零、一、零。下面不用任何训练循环，因此输出不是随机优化的偶然结果；它只证明这套带非线性的结构具备所需表达能力。",
      "code": "import torch\nfrom torch import nn\nfirst = nn.Linear(2, 2)\nsecond = nn.Linear(2, 1)\nwith torch.no_grad():\n    first.weight.copy_(torch.tensor([[1., 1.], [1., 1.]]))\n    first.bias.copy_(torch.tensor([0., -1.]))\n    second.weight.copy_(torch.tensor([[1., -2.]]))\n    second.bias.zero_()\ninputs = torch.tensor([[0., 0.], [0., 1.], [1., 0.], [1., 1.]])\npreactivation = first(inputs)\nprint(\"before ReLU:\", preactivation.tolist())\n\nhidden = torch.relu(preactivation)\nscores = second(hidden).squeeze(-1)\npredictions = (scores > 0.5).to(torch.int)\nprint(\"hidden:\", hidden.tolist())\nprint(\"scores:\", scores.tolist())\nprint(\"predictions:\", predictions.tolist())\nassert predictions.tolist() == [0, 1, 1, 0]\n\nlinear_only = second(preactivation).squeeze(-1)\nprint(\"without activation:\", linear_only.tolist())\nassert linear_only.tolist() == [2., 1., 1., 0.]\nprint(\"zero input still correct:\", bool(linear_only[0] == scores[0]))",
      "output": "before ReLU: [[0.0, -1.0], [1.0, 0.0], [1.0, 0.0], [2.0, 1.0]]\nhidden: [[0.0, 0.0], [1.0, 0.0], [1.0, 0.0], [2.0, 1.0]]\nscores: [0.0, 1.0, 1.0, 0.0]\npredictions: [0, 1, 1, 0]\nwithout activation: [2.0, 1.0, 1.0, 0.0]\nzero input still correct: False\n",
      "steps": [
        {
          "title": "设置能手算的两层权重",
          "lines": [
            1,
            12
          ],
          "explanation": "第一个隐藏单元计算输入和，第二个计算输入和减一。所有权重显式写入，模型初始化的随机结果被覆盖。输入四行对应 XOR 的全部情况，能完整列出中间值。此处权重设计是为了说明表达式，不是推荐把一般任务的参数都初始化成这些数字。",
          "state": "第零行第二个隐藏值为负一，其他行逐渐变成零或一。"
        },
        {
          "title": "加入 ReLU 后组合隐藏特征",
          "lines": [
            14,
            20
          ],
          "explanation": "ReLU 把负一截成零，输出因此在输入和为零时保持零；输入和为一时第二个特征仍为零，输出一；输入和为二时减去两倍的一，输出回到零。这是分段线性的非线性函数。scores 只是构造出的标量分数，本例没有把它当作经过校准的概率。",
          "state": "四个输入全部得到 XOR 目标，非线性改变的是函数形状而不是张量维度。"
        },
        {
          "title": "去掉激活，观察结构退化",
          "lines": [
            22,
            25
          ],
          "explanation": "不经过 ReLU 时，两层合成为二减输入和。它在零输入处输出二，无法表达 XOR 所需的两端低、中间高关系。这里保持同一组权重，只改变激活，能清楚看到差异来源；一般地，任意多层纯仿射复合仍是仿射函数，而不只限于这组参数。",
          "state": "层数仍为二、参数数量未变，但去掉非线性后目标函数关系不再成立。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "把堆叠更多 Linear 等同于任意非线性表达",
        "why": "没有激活时，矩阵与偏置可以合并为一个仿射映射。参数更多不代表能表示 XOR 这样的关系。",
        "fix": "检查层间是否存在非线性，并用小函数构造或明确输入输出性质验证表达能力。"
      },
      {
        "wrong": "手动设定权重得到正确结果，就宣称训练必然成功",
        "why": "表达能力只说明存在一组参数，实际优化还受初始化、损失、学习率和数据影响。",
        "fix": "把结构验证与学习过程分开；训练实验另看梯度、收敛与泛化，避免混淆结论。"
      }
    ],
    "check": {
      "prompt": "为什么这个例子不需要在输出后先加 softmax？",
      "hint": "当前目标是检查一个标量函数，不是把多个类别 logits 转成概率。",
      "answer": "scores 直接表达手工构造的 XOR 数值关系，用阈值判定即可。若改为二分类训练，可以输出一个 logit 配合 BCEWithLogitsLoss；不能因为是神经网络就无条件追加 softmax。"
    },
    "transfer": "搭建实际 MLP 时，先确认每层轴与参数量，再分析激活、归一化和残差怎样改变函数及梯度。小型构造性例子能验证结构，但训练质量还需要真实数据上的独立评估。不要把某次前向形状正确当作整个模型设计已经验证。"
  },
  "nn-3": {
    "scenario": "两个序列都补齐到长度三，但一个有两个有效 token，另一个只有一个。你把 padding loss 乘零后对全部位置 mean，得到的 loss 看起来更小，却只是多除了一倍分母。这个指南让所有 logits 为零，使每个有效 token 的交叉熵都是 log(4)，从而把 mask 与分母问题变成可以精确检查的实验。",
    "prerequisites": [
      "tensor-2",
      "autograd-2"
    ],
    "terms": [
      {
        "name": "未归约损失",
        "meaning": "保留每个样本或 token 的损失，便于按任务规则选择分子与分母。"
      },
      {
        "name": "ignore_index",
        "meaning": "标签中的特殊值，指示该位置不参与类别索引损失。"
      },
      {
        "name": "Token 平均",
        "meaning": "全部有效 token 的损失和除以有效 token 数，每个有效元素同权。"
      },
      {
        "name": "Loss mask",
        "meaning": "控制哪些预测计入训练目标，不自动限制模型前向的注意力可见性。"
      }
    ],
    "observe": "在损失 mask 图中先数有效格子，而不是直接数整个矩形。把每个有效格子看成相同的 log(4)，padding 格子没有损失贡献。再观察分母是否仍然用了矩形面积：如果把无效位置清零却保留六作分母，指标就会随补齐数量改变。",
    "walkthrough": {
      "title": "屏蔽 padding 后，分母也必须使用有效计数",
      "intro": "输出 logits 为 [B,T,V]=[2,3,4]，交叉熵需要把类别轴 V 放到第一个非 batch 轴。labels 中三个位置为合法类别，其余为 −100。我们先查看每个位置的损失，再比较两个均值，最后验证被忽略位置确实没有梯度，分别检查统计与反向两层语义。",
      "code": "import torch\nimport torch.nn.functional as F\nlogits = torch.zeros(2, 3, 4, requires_grad=True)\nlabels = torch.tensor([[0, 1, -100], [2, -100, -100]])\nper_token = F.cross_entropy(logits.transpose(1, 2), labels,\n                            ignore_index=-100, reduction=\"none\")\nvalid = labels.ne(-100)\nprint(\"valid mask:\", valid.to(torch.int).tolist())\nprint(\"per-token loss:\", [[round(v, 6) for v in row] for row in per_token.tolist()])\n\ncount = valid.sum()\ncorrect = per_token.sum() / count\nwrong = per_token.mean()\nprint(\"valid count:\", count.item())\nprint(\"token mean:\", round(correct.item(), 6))\nprint(\"padded mean:\", round(wrong.item(), 6))\nassert count.item() == 3\n\ncorrect.backward()\nignored_grad = logits.grad[~valid]\nassert ignored_grad.eq(0).all()\nassert torch.isfinite(logits.grad).all()\nprint(\"ignored gradient sum:\", ignored_grad.abs().sum().item())\nprint(\"all gradients finite:\", bool(torch.isfinite(logits.grad).all()))",
      "output": "valid mask: [[1, 1, 0], [1, 0, 0]]\nper-token loss: [[1.386294, 1.386294, 0.0], [1.386294, 0.0, 0.0]]\nvalid count: 3\ntoken mean: 1.386294\npadded mean: 0.693147\nignored gradient sum: 0.0\nall gradients finite: True\n",
      "steps": [
        {
          "title": "保留逐 token 损失并明确类别轴",
          "lines": [
            1,
            9
          ],
          "explanation": "四个类别分数相同，所以每个有效目标的概率都是四分之一，损失为 log(4)。transpose 只把 V 放到接口要求的类别轴位置，不改变 token 配对关系。ignore_index 位置的未归约损失为零，这让分子方便计算，但还没有决定平均值应除以多少。",
          "state": "损失矩阵仍为两行三列，其中只有三个非零、有效的贡献。"
        },
        {
          "title": "对照正确与错误分母",
          "lines": [
            11,
            17
          ],
          "explanation": "正确目标对三个有效位置平均，所以仍然是 log(4)。直接 mean 除以六，得到它的一半。增加 padding 会进一步降低这个错误指标，即使模型预测完全没变。这样的数值变化不能被解释为收敛，也会使梯度尺度依赖批次中无效位置的比例。",
          "state": "正确均值约一点三八六，错误矩形均值约零点六九三，目标权重不同。"
        },
        {
          "title": "同时检查 ignored 位置的反向行为",
          "lines": [
            19,
            24
          ],
          "explanation": "这一步验证被忽略目标没有梯度贡献，但不意味着模型前向没有读取这些位置。若注意力 mask 错误，有效 query 仍可能从 padding 内容取信息，并通过其他路径影响梯度。因此 loss mask 和注意力可见性要分别测试；当前检查只证明这个交叉熵分支忽略了指定预测位置。",
          "state": "ignored 输出行的损失梯度严格为零，所有有效计算的梯度仍有限。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "把无效位置清零后直接对全部元素 mean",
        "why": "分子虽然排除了 padding，分母仍包含它，造成不同长度批次拥有不同梯度尺度。",
        "fix": "显式统计有效元素，使用 loss_sum/valid_count；引入类别权重时重新核对加权分母。"
      },
      {
        "wrong": "把 loss mask 当作前向注意力 mask",
        "why": "不计分只影响目标，不能阻止有效位置读取本应不可见的键，也不能阻止未来信息泄漏。",
        "fix": "分别构造信息流 mask 与训练目标 mask，并用扰动不变性和梯度测试检查两者。"
      }
    ],
    "check": {
      "prompt": "若 labels 全为 −100，是否可以直接执行 per_token.sum()/valid.sum()？",
      "hint": "分子与分母都变成零，数学上的平均目标不再定义。",
      "answer": "不能，应按训练协议处理没有有效元素的窗口，常见方式是一致跳过更新。分布式中某个 rank 本地为零不代表全局为零，必须先确定全局计数并保持通信一致。"
    },
    "transfer": "把分子、分母与统计单位写在日志和实现旁边，有助于比较不同 batch、序列长度及分布式规模。若任务要求每条序列等权，需要先按序列归约再定义全局平均；不能不加分析地复用 token 平均公式。"
  },
  "nn-4": {
    "scenario": "训练中断后模型权重成功加载，但下一步 loss 与参数更新和连续训练不同。文件能读取只证明序列化成功，不能证明训练轨迹恢复。这个实验在 AdamW 已经产生历史状态后保存，重建模型、优化器和调度器，再对同一下一批数据执行更新，直接验证真正关心的续训行为。",
    "prerequisites": [
      "nn-1",
      "autograd-2"
    ],
    "terms": [
      {
        "name": "优化器历史",
        "meaning": "AdamW 的步数、一阶矩与二阶矩，参与决定下一次参数更新。"
      },
      {
        "name": "调度器状态",
        "meaning": "学习率进度和相关参数，必须按原来的更新时间单位继续。"
      },
      {
        "name": "更新边界",
        "meaning": "完整反向与 step 完成的位置，便于明确哪些梯度已提交。"
      },
      {
        "name": "恢复对照",
        "meaning": "连续训练与重建恢复后，在相同数据和随机条件下比较后续行为。"
      }
    ],
    "observe": "在 checkpoint 图中逐项查看模型、优化器、scheduler 和数据/随机状态。权重只是其中一块。下面固定数据，不引入 Dropout，因此重点检查历史状态；若换成随机采样或数据增强，还需要把对应随机源和读取位置一起加入恢复协议。",
    "walkthrough": {
      "title": "通过下一次真实 AdamW 更新，检验 checkpoint 是否完整",
      "intro": "一个无 bias 的 Linear 权重固定为二，输入一、目标一，使用 AdamW 和每步减半的 StepLR。先完成一次更新并保存到内存字节流，再建立连续训练参考。恢复时重新创建全部对象、按顺序加载，再执行同一更新；输出比较布尔结果与步数，避免浮点打印噪声。",
      "code": "import io\nimport torch\nfrom torch import nn\n\ndef build():\n    model = nn.Linear(1, 1, bias=False)\n    with torch.no_grad():\n        model.weight.fill_(2)\n    opt = torch.optim.AdamW(model.parameters(), lr=0.1, weight_decay=0.0)\n    sched = torch.optim.lr_scheduler.StepLR(opt, step_size=1, gamma=0.5)\n    return model, opt, sched\n\ndef step(model, opt, sched):\n    opt.zero_grad(set_to_none=True)\n    loss = (model(torch.ones(1, 1)) - 1).square().mean()\n    loss.backward()\n    opt.step()\n    sched.step()\n    return loss.detach()\n\nmodel, opt, sched = build()\nstep(model, opt, sched)\n\nbuffer = io.BytesIO()\ntorch.save({\"model\": model.state_dict(), \"optimizer\": opt.state_dict(),\n            \"scheduler\": sched.state_dict(), \"update\": 1}, buffer)\nexpected_loss = step(model, opt, sched)\nexpected_weight = model.weight.detach().clone()\nbuffer.seek(0)\nstate = torch.load(buffer, map_location=\"cpu\", weights_only=True)\nprint(\"snapshot step:\", state[\"update\"])\n\nresumed, resumed_opt, resumed_sched = build()\nresumed.load_state_dict(state[\"model\"])\nresumed_sched.load_state_dict(state[\"scheduler\"])\nresumed_opt.load_state_dict(state[\"optimizer\"])\nactual_loss = step(resumed, resumed_opt, resumed_sched)\nprint(\"next loss equal:\", bool(torch.equal(actual_loss, expected_loss)))\nprint(\"next parameters equal:\", bool(torch.equal(resumed.weight, expected_weight)))\nprint(\"optimizer steps:\", [int(s[\"step\"].item()) for s in resumed_opt.state.values()])\nprint(\"next lr:\", resumed_sched.get_last_lr()[0])\ntorch.testing.assert_close(resumed.weight, expected_weight, rtol=0, atol=0)",
      "output": "snapshot step: 1\nnext loss equal: True\nnext parameters equal: True\noptimizer steps: [2]\nnext lr: 0.025\n",
      "steps": [
        {
          "title": "构建确定性训练对象与一步更新",
          "lines": [
            1,
            22
          ],
          "explanation": "构建函数总是返回相同初始权重和配置，step 明确先清梯度、前向、反向、优化器更新，再推进学习率。保存前已经执行一次更新，所以 AdamW 历史非空。若一创建模型就保存，空状态回读虽然可能成功，却无法证明动量等历史真的被恢复。",
          "state": "模型已走完第一步，下一步学习率为零点零五，优化器内部计数为一。"
        },
        {
          "title": "保存完整状态，并继续形成参考",
          "lines": [
            24,
            31
          ],
          "explanation": "序列化写入当时的状态，随后连续路径又更新一次。expected_weight 显式 clone，避免后续操作改变参考。这里使用内存字节流验证真实 torch.save/load，而不涉及文件原子替换或共享文件系统；存储可靠性与训练状态恢复是两个需要分别验证的问题。",
          "state": "字节流保留第一步结束的状态，参考对象已完成第二步。"
        },
        {
          "title": "重建、恢复并比较下一步结果",
          "lines": [
            33,
            42
          ],
          "explanation": "先创建 scheduler，再恢复 optimizer，避免构造阶段覆盖已恢复的学习率。新对象加载权重、调度进度和优化器历史后，下一步 loss 与参数都等于连续参考，内部步数变成二。此例固定 CPU 数据和确定性运算，所以能要求逐位一致；跨硬件和软件版本需要重新选择可复现目标与容差。",
          "state": "重建后的对象不是原对象，却在相同下一批数据上复现同一更新。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "只检查 load_state_dict 没报错",
        "why": "键和尺寸匹配不证明优化器、scheduler 或数据位置已经恢复。下一步更新仍可能使用错误历史。",
        "fix": "实际比较中断恢复与连续路径的下一步 loss、参数、学习率和优化器步数。"
      },
      {
        "wrong": "恢复随机数后又创建随机初始化对象",
        "why": "初始化可能继续消耗随机状态，使后续 Dropout、打乱或采样偏离原轨迹。",
        "fix": "通常先重建和加载全部对象，再恢复需要的随机源；同时保存数据游标与采样器状态。"
      }
    ],
    "check": {
      "prompt": "如果仅加载 model，再新建 AdamW 和 StepLR，哪一项最先能暴露不完整恢复？",
      "hint": "前向只依赖权重，但参数更新还使用优化器历史和学习率进度。",
      "answer": "同一输入的前向 loss 可能仍一致，但下一次更新后的参数或学习率会不同。应比较更新后的结果，而不能仅以恢复后一次 forward 相等作为验收。"
    },
    "transfer": "把恢复测试扩展到真实训练时，继续加入 AMP scaler、所有随机源、数据进度以及分布式本地/分片状态。优先在完整更新边界保存，减少未提交累积梯度的歧义。声明验证范围时区分 CPU 续训、文件持久性与跨设备恢复。"
  }
};
