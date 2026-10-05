window.COURSE_DISTRIBUTED = [
  {
    "id": "training",
    "number": 6,
    "title": "可靠训练工程",
    "subtitle": "数值、批量与训练状态",
    "description": "建立数值稳定、归一化正确、可恢复且能够诊断泛化问题的训练循环。",
    "level": "进阶",
    "color": "#6654d9",
    "icon": "train",
    "lessons": [
      {
        "id": "training-1",
        "title": "数值稳定与混合精度",
        "description": "区分计算范围、有效精度和梯度缩放，写出正确的 AMP 训练循环。",
        "duration": 25,
        "difficulty": "进阶",
        "objectives": [
          "区分 FP16、BF16 和 FP32 的数值特点",
          "理解 autocast 与 GradScaler 的职责",
          "掌握缩放、反向传播、裁剪和更新的顺序"
        ],
        "sections": [
          {
            "heading": "范围与精度是两件事",
            "body": "FP16 的指数位较少，最大有限值约为 65504；BF16 与 FP32 都有 8 位指数，动态范围更接近，但 BF16 只有 7 位显式尾数，细节精度更低。范围大不代表所有运算都准确：小梯度可能因舍入消失，大量累加也会放大误差。\n\n阅读模型代码时，要分别问参数、输入、归约和优化器状态使用什么 dtype。常见 AMP 训练保留 FP32 参数，由 autocast 为合适的算子选择低精度；这与对整个模型调用 half() 不同。BF16 通常不需要针对 FP16 范围问题的梯度缩放，但仍可能因为异常输入、学习率或错误公式产生 NaN。"
          },
          {
            "heading": "先保证公式稳定",
            "body": "直接计算 exp(logits) 再归一化，即使 FP32 也可能溢出。稳定 softmax 利用平移不变性先减去每行最大值；对数归一化使用 logsumexp。分类训练应直接把未归一化 logits 交给 cross_entropy，不要先做 softmax 再传入，后者会改变损失语义。\n\nTransformer 中的缩放、mask 和归约精度共同影响稳定性。出现非有限值时，检查输入、logits、loss、梯度中第一个异常的位置。普通 softmax 遇到全部被屏蔽的行可能得到无定义结果；融合算子对边界条件的处理应单独验证，不能从一个后端的行为推断所有实现。",
            "code": "# CPU 可运行。\nimport torch\nimport torch.nn.functional as F\nlogits = torch.tensor([[1000., 999., 998.]])\nprint(torch.softmax(logits, dim=-1))\nprint(torch.logsumexp(logits, dim=-1))\nprint(F.cross_entropy(logits, torch.tensor([0])))",
            "language": "python"
          },
          {
            "heading": "autocast 与 GradScaler",
            "body": "autocast 按算子策略选择计算类型，不会自动把所有张量改成同一种类型。反向通常放在 autocast 上下文外，让梯度沿前向选择的计算图传播。GradScaler 放大损失来减轻 FP16 梯度下溢，再在优化器更新前还原梯度；检测到非有限梯度时，它可以跳过更新并调整缩放比例。\n\n梯度裁剪必须在 unscale_(optimizer) 之后进行，否则阈值会作用于人为放大的梯度。多个微批次属于一次更新时，应保持同一缩放比例，把 step 和 update 放到累积窗口末尾。缩放器状态也需要写入训练检查点；调度器按实际更新计数时，还要处理被跳过的更新。",
            "code": "# 前提：CUDA GPU；BF16 需要硬件支持。\nimport torch\nmodel = torch.nn.Linear(128, 10).cuda()\nopt = torch.optim.AdamW(model.parameters(), lr=1e-3)\ndtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16\nscaler = torch.amp.GradScaler('cuda', enabled=(dtype == torch.float16))\nx = torch.randn(32, 128, device='cuda')\ny = torch.randint(0, 10, (32,), device='cuda')\nopt.zero_grad(set_to_none=True)\nwith torch.autocast('cuda', dtype=dtype):\n    loss = torch.nn.functional.cross_entropy(model(x), y)\nscaler.scale(loss).backward()\nscaler.unscale_(opt)\ntorch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)\nscaler.step(opt)\nscaler.update()",
            "language": "python"
          },
          {
            "heading": "以证据验证训练配置",
            "body": "排查不稳定时同时记录损失、梯度范数、学习率与有效 token 数。只看损失曲线，无法区分真实收敛、梯度更新反复被跳过、mask 错误或分母变化。先为小模型建立 FP32 基线，再比较 AMP 的一步损失和梯度方向，通常比直接在大集群尝试更容易定位问题。\n\n实际训练中，精度可能由配置、模型封装和分布式策略共同决定；部署推理时，权重类型、KV cache 类型和量化计算又是不同路径。读代码时分别标记这些路径，不要从“模型是 BF16”推断所有缓存和归约也采用 BF16。性能比较必须建立在数值目标一致的基础上。"
          }
        ],
        "takeaways": [
          "autocast 负责算子精度选择，GradScaler 负责缩放与非有限梯度处理。",
          "先 unscale 再裁剪，最后执行 scaler.step 和 update。",
          "BF16 范围更大但尾数更短，不能替代稳定公式。"
        ],
        "references": [
          {
            "label": "PyTorch：AMP examples",
            "url": "https://docs.pytorch.org/docs/stable/notes/amp_examples.html"
          },
          {
            "label": "PyTorch：Numerical accuracy",
            "url": "https://docs.pytorch.org/docs/stable/notes/numerical_accuracy.html"
          }
        ],
        "quiz": [
          {
            "id": "training-1-q1",
            "type": "single",
            "prompt": "BF16 相比 FP16 的主要范围优势是什么？",
            "options": [
              "尾数更长，所有数都更准确",
              "指数范围接近 FP32，较不容易因范围不足溢出",
              "所有运算自动变成 FP32",
              "不会产生 NaN"
            ],
            "answer": 1,
            "explanation": "BF16 的指数位数与 FP32 相同，但尾数比 FP16 更短；更大范围并不排除 NaN。",
            "topic": "混合精度"
          },
          {
            "id": "training-1-q2",
            "type": "single",
            "prompt": "AMP 下裁剪梯度的正确顺序是什么？",
            "options": [
              "clip → backward → step",
              "backward → clip → unscale → step",
              "scaled backward → unscale → clip → scaler.step",
              "scaler.update → backward → clip"
            ],
            "answer": 2,
            "explanation": "先反向得到缩放梯度，再还原真实尺度，最后按真实范数裁剪；直接裁剪缩放梯度会改变有效阈值。",
            "topic": "梯度裁剪"
          },
          {
            "id": "training-1-q3",
            "type": "single",
            "prompt": "分类训练中如何正确使用 cross_entropy？",
            "options": [
              "先 exp 再手动归一化",
              "先 softmax 再传概率",
              "直接传未归一化 logits",
              "把 logits 全部截断为 1"
            ],
            "answer": 2,
            "explanation": "cross_entropy 接收 logits 并使用稳定的对数归一化。重复 softmax 改变目标，直接 exp 易溢出，截断破坏分数关系。",
            "topic": "数值稳定"
          }
        ]
      },
      {
        "id": "training-2",
        "title": "梯度累积与有效批量",
        "description": "从 global batch 公式走到可变长度训练的严格 token 归一化。",
        "duration": 25,
        "difficulty": "进阶",
        "objectives": [
          "推导数据并行下的全局批量",
          "区分微批均值与整个窗口的 token 均值",
          "正确处理更新边界和不足整窗的尾批"
        ],
        "sections": [
          {
            "heading": "一次更新覆盖多少数据",
            "body": "若每个数据并行副本的 micro batch 为 B，累积 K 次，数据并行度为 D，且副本数据互不重复，则一次更新包含 B×K×D 个样本。D 是数据并行组的大小，不是整个集群进程数；张量并行和流水线并行共同计算同一批数据，不会自动增加独立样本。\n\n语言模型还要记录有效 token 数。相同样本数可能对应不同长度，padding、prompt mask、截断和 packing 都改变损失覆盖的数据。读配置时把 global batch、micro batch、累积步数和序列长度放在一起，明确按样本还是按 token 计量。变量名叫 batch_size 并不能证明它的计量单位。"
          },
          {
            "heading": "均值的均值为何可能错误",
            "body": "第 i 个微批次有 n_i 个有效 token，损失总和为 s_i。整个窗口的 token 均值应为所有 s_i 之和除以所有 n_i 之和。若每个微批先求均值再除以 K，每个微批权重相同；当有效长度不同，短微批会得到过大的 token 权重。\n\n窗口总 token 数已知时，对每个微批的损失总和除以同一个总数再反向即可。可以提前从 labels 或 mask 计算计数，不需要保留所有前向图。尾部不足 K 步的窗口也使用真实计数。分布式情况下还要补偿 DDP 默认的梯度平均，后续单元将推导这个系数。",
            "code": "# CPU 可运行；单进程、不同有效 token 数的微批。\nimport torch\nimport torch.nn.functional as F\nmodel = torch.nn.Linear(8, 5)\nopt = torch.optim.SGD(model.parameters(), lr=0.05)\nwindow = [(torch.randn(4, 8), torch.tensor([1, 2, -100, -100])),\n          (torch.randn(4, 8), torch.tensor([0, 1, 2, 3]))]\ntotal = sum(int((y != -100).sum()) for _, y in window)\nassert total > 0\nopt.zero_grad(set_to_none=True)\nfor x, y in window:\n    loss_sum = F.cross_entropy(model(x), y, ignore_index=-100, reduction='sum')\n    (loss_sum / total).backward()\nopt.step()",
            "language": "python"
          },
          {
            "heading": "更新边界决定训练语义",
            "body": "zero_grad 放在累积窗口开始；梯度裁剪、optimizer.step 和通常按更新计数的 scheduler.step 放在窗口末尾。每个微批都 step 会多次改变 AdamW 动量、二阶矩和权重衰减，已经不再是对累积梯度的一次更新。PyTorch 默认将多次 backward 的梯度相加到 parameter.grad，这就是累积成立的基础。\n\n每次微批前向后立即反向，可释放其计算图中的中间激活，不必设置 retain_graph=True。AMP 累积期间保持同一缩放系数，最后统一 unscale。若整个窗口没有有效 token，应采用一致的跳过策略；多进程中尤其要避免部分 rank 更新、部分 rank 不进入通信。"
          },
          {
            "heading": "数学等价也需要条件",
            "body": "独立样本损失可加、归一化正确、模型行为一致时，累积得到目标大批量的梯度。但 Dropout 的随机数消费顺序、BatchNorm 的批统计和浮点累加次序可能使结果无法逐位相同。应先判断目标函数是否一致，再使用合理容差比较梯度，不要把数值舍入差异误判为归一化错误。\n\n减小 micro batch 降低激活显存，却可能降低 GPU 利用率并增加 kernel launch 和通信次数。累积解决的是目标批量装不进显存的问题，不保证训练更快。阅读具有多层 batch 循环的训练代码时，明确每一层是在改变优化器更新次数，还是仅把同一次更新切成更小的内存块。"
          }
        ],
        "takeaways": [
          "global batch 使用数据并行度计算，不能再乘 TP 或 PP。",
          "可变长度应按整个窗口的真实 token 数归一化。",
          "累积窗口内多次 backward，窗口末尾仅更新一次参数。"
        ],
        "references": [
          {
            "label": "PyTorch：Gradient accumulation",
            "url": "https://docs.pytorch.org/docs/stable/notes/amp_examples.html#gradient-accumulation"
          },
          {
            "label": "PyTorch：CrossEntropyLoss",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html"
          }
        ],
        "quiz": [
          {
            "id": "training-2-q1",
            "type": "single",
            "prompt": "micro batch=2，累积 4 次，DP=8，TP=2。一次更新有多少独立样本？",
            "options": [
              "16",
              "32",
              "64",
              "128"
            ],
            "answer": 2,
            "explanation": "2×4×8=64；TP 的两个 rank 合作处理相同数据，不能作为独立样本倍数。",
            "topic": "有效批量"
          },
          {
            "id": "training-2-q2",
            "type": "single",
            "prompt": "两个微批有效 token 数为 2、6，损失总和为 8、12。正确总 token 均值是多少？",
            "options": [
              "3",
              "2.5",
              "4",
              "10"
            ],
            "answer": 1,
            "explanation": "(8+12)/(2+6)=2.5；先取微批均值再平均得到 3，会过度加权短微批。",
            "topic": "token 归一化"
          },
          {
            "id": "training-2-q3",
            "type": "single",
            "prompt": "哪项会破坏“累积四次后进行一次 AdamW 更新”的语义？",
            "options": [
              "每个微批都 backward",
              "每个微批都 optimizer.step",
              "窗口开头清梯度",
              "反向后释放该微批计算图"
            ],
            "answer": 1,
            "explanation": "每个微批都 step 会四次更新参数与优化器状态；累积依赖多次反向，不依赖保留旧图。",
            "topic": "更新边界"
          }
        ]
      },
      {
        "id": "training-3",
        "title": "优化器、调度与断点恢复",
        "description": "从模型权重扩展到动量、学习率、随机源和数据进度的完整训练状态。",
        "duration": 25,
        "difficulty": "进阶",
        "objectives": [
          "解释 AdamW 状态与参数分组",
          "分清微步、更新步和调度步",
          "设计并验证完整训练检查点"
        ],
        "sections": [
          {
            "heading": "优化器是一台有状态的机器",
            "body": "SGD 动量、Adam 的一阶矩和二阶矩依赖历史梯度。AdamW 在自适应梯度更新之外执行解耦权重衰减，不能简单等同于给损失添加 L2 正则后使用任意优化器。同样的权重配上不同历史状态，即使下一批数据相同，也可能得到不同更新。\n\n大型模型常使用多个 parameter group，分别指定学习率或衰减。偏置与归一化参数经常被排除衰减，但这是训练方案，需要核对项目约定。参数组顺序、组内参数对应和模型结构都会影响 optimizer.state_dict 的恢复。读封装代码时追踪优化器最终拿到的是原参数还是分片参数。"
          },
          {
            "heading": "调度器应该跟随什么时间",
            "body": "warmup 和余弦衰减通常以 optimizer update 为横轴。若每个微批都 scheduler.step，而每 K 个微批才更新参数，调度速度会变成原来的 K 倍。多数常见调度器在 optimizer.step 之后推进；ReduceLROnPlateau 则由验证指标驱动，不宜套用相同循环。\n\n日志应区分 micro_step、update_step 和累计 token 数。GradScaler 可能因溢出跳过更新，是否推进调度器必须符合训练方案的计步约定。检查点最好放在完成更新的边界；只记录 epoch 无法表达中途的采样位置，也无法知道是否还有未提交的累积梯度。"
          },
          {
            "heading": "保存与恢复构成一个闭环",
            "body": "模型权重只描述当前函数；恢复优化过程还需要 optimizer、scheduler、必要时的 scaler、更新次数、随机状态与数据进度。如果数据增强使用 Python 或 NumPy 随机源，也需要保存相应状态。下面示例只覆盖 CPU 和 PyTorch 随机源，数据加载器游标由实际数据管线提供。示例先完成一次更新，使 AdamW 的矩和步数非空，再在内存中序列化、重建对象、恢复，并比较下一次随机数据上的更新；真实保存时可把内存缓冲区替换为文件路径。\n\n恢复时先构建模型、优化器和调度器对象，再恢复状态。调度器应在加载优化器状态之前完成初始化，避免初始化覆盖已恢复的学习率。参数组必须与检查点匹配。分布式分片检查点还需要相应保存加载接口，不能假设一个 rank 的普通状态字典覆盖所有训练状态。",
            "code": "# CPU 可运行：比较连续训练与完整中断恢复的下一步。\nimport io\nimport torch\ntorch.manual_seed(7)\ndef make_training():\n    model = torch.nn.Linear(8, 2)\n    opt = torch.optim.AdamW(model.parameters(), lr=1e-3)\n    sched = torch.optim.lr_scheduler.StepLR(opt, step_size=1, gamma=0.5)\n    return model, opt, sched\n\ndef update(model, opt, sched):\n    x = torch.randn(4, 8)\n    y = torch.randint(0, 2, (4,))\n    opt.zero_grad(set_to_none=True)\n    loss = torch.nn.functional.cross_entropy(model(x), y)\n    loss.backward()\n    opt.step()\n    sched.step()\n    return loss.detach()\n\nmodel, opt, sched = make_training()\nupdate(model, opt, sched)  # AdamW 已有非空历史状态。\nbuffer = io.BytesIO()\ntorch.save({'model': model.state_dict(), 'optimizer': opt.state_dict(),\n            'scheduler': sched.state_dict(), 'update_step': 1,\n            'torch_rng': torch.get_rng_state()}, buffer)\nexpected_loss = update(model, opt, sched)\nexpected_params = [p.detach().clone() for p in model.parameters()]\n\nbuffer.seek(0)\nstate = torch.load(buffer, map_location='cpu', weights_only=True)\nresumed, resumed_opt, resumed_sched = make_training()\nresumed.load_state_dict(state['model'])\nresumed_sched.load_state_dict(state['scheduler'])\nresumed_opt.load_state_dict(state['optimizer'])\ntorch.set_rng_state(state['torch_rng'])  # 放在随机初始化之后。\nactual_loss = update(resumed, resumed_opt, resumed_sched)\ntorch.testing.assert_close(actual_loss, expected_loss)\nfor actual, expected in zip(resumed.parameters(), expected_params):\n    torch.testing.assert_close(actual, expected)\nassert resumed_sched.get_last_lr() == sched.get_last_lr()\nprint('恢复后的下一步 loss、参数和学习率一致')",
            "language": "python"
          },
          {
            "heading": "恢复不是文件存在就算成功",
            "body": "可在小模型上做对照：固定输入和随机源，一条路径连续训练；另一条在更新边界保存、重建对象并恢复，再继续相同数据。比较后续学习率、损失、参数和优化器计数，可以暴露遗漏调度器、采样器重新洗牌或状态映射错误。之后在实际精度和并行策略下再验证。\n\n跨硬件、跨软件版本和非确定性算子可能导致差异，记录环境、配置和代码版本比承诺跨环境逐位一致更实用。多模型联合训练时，各个模型可能使用独立的优化器和调度器，需要分别追踪与恢复。仅加载模型权重属于从已有参数重新优化，不能声称完整断点续训。"
          }
        ],
        "takeaways": [
          "参数、动量、二阶矩和优化器步数共同决定下一次更新。",
          "学习率时间单位必须与真实更新边界一致。",
          "通过连续训练与中断恢复的后续更新对照验证检查点。"
        ],
        "references": [
          {
            "label": "PyTorch：General checkpoint",
            "url": "https://docs.pytorch.org/tutorials/recipes/recipes/saving_and_loading_a_general_checkpoint.html"
          },
          {
            "label": "PyTorch：AdamW",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.optim.AdamW.html"
          },
          {
            "label": "PyTorch：Optimizer.load_state_dict",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.optim.Optimizer.load_state_dict.html"
          }
        ],
        "quiz": [
          {
            "id": "training-3-q1",
            "type": "single",
            "prompt": "只恢复模型权重、重新创建 AdamW，意味着什么？",
            "options": [
              "训练轨迹一定完全一致",
              "历史矩与步数丢失，后续更新通常不同",
              "模型无法前向",
              "学习率自动恢复"
            ],
            "answer": 1,
            "explanation": "权重可用于前向，但 AdamW 更新依赖历史一阶矩、二阶矩与计数；仅恢复权重不能恢复优化轨迹。",
            "topic": "检查点"
          },
          {
            "id": "training-3-q2",
            "type": "single",
            "prompt": "累积八个微批更新一次，调度器约定按参数更新计步，应何时推进？",
            "options": [
              "每个 token 后",
              "每个微批后",
              "每个成功参数更新后",
              "只在结束时"
            ],
            "answer": 2,
            "explanation": "调度器以更新为时间单位；每个微批推进会让调度速度增加八倍。",
            "topic": "学习率调度"
          },
          {
            "id": "training-3-q3",
            "type": "single",
            "prompt": "验证完整恢复最有力的做法是什么？",
            "options": [
              "检查文件大小",
              "只看 load_state_dict 是否报错",
              "对照连续训练和中断恢复后相同数据的后续更新",
              "恢复后更换数据集"
            ],
            "answer": 2,
            "explanation": "后续更新对照覆盖权重、优化器、调度器与随机状态。文件可读仅证明序列化成功。",
            "topic": "恢复验证"
          }
        ]
      },
      {
        "id": "training-4",
        "title": "泛化、正则化与训练诊断",
        "description": "从训练曲线找到过拟合、欠拟合、数据泄漏和梯度问题，而不是盲目增加训练时间。",
        "duration": 30,
        "difficulty": "进阶",
        "objectives": [
          "从训练与验证指标区分容量、优化与泛化问题",
          "正确使用 Dropout、BatchNorm 及 train/eval",
          "建立数据隔离和梯度诊断的最小实验"
        ],
        "sections": [
          {
            "heading": "先问模型是否学会，再问是否泛化",
            "body": "训练损失与验证损失同时偏高，可能是容量不足、训练不充分、优化器配置错误或数据目标有问题；不能只凭曲线就断言欠拟合。训练损失持续下降而验证指标恶化，通常提示泛化差距，但也要排除数据分布变化和评估协议错误。观察曲线时保持指标定义与有效样本分母一致。\n\n一个实用诊断是让小模型拟合极小、固定的数据子集。适当关闭数据增强与强正则后仍无法降低损失，应优先检查输入、标签、梯度和更新链路。如果能快速拟合小集合，再逐步扩大数据与恢复正则。这个实验验证基本训练能力，不代表模型已经学到可泛化的规律。"
          },
          {
            "heading": "正则化与模式切换各有职责",
            "body": "权重衰减、Dropout、数据增强和早停从不同角度限制过拟合。AdamW 的解耦衰减影响参数更新；Dropout 在训练时随机屏蔽部分激活并调整尺度；早停根据验证表现选择更新边界，并恢复该边界的最佳检查点，而不是默认使用最后一步。验证集用于选择超参数，最终测试集应留作独立评估。\n\nmodel.train() 和 model.eval() 控制模块行为，不控制是否记录梯度。Dropout 在 eval 下关闭随机丢弃；默认跟踪统计量的 BatchNorm 在 train 下更新运行均值与方差，在 eval 下使用保存的统计量。no_grad 或 inference_mode 减少求导开销，却不会自动调用 eval。BatchNorm 的 track_running_stats=False 是例外，此时评估仍使用批统计，需查清具体配置。"
          },
          {
            "heading": "数据隔离比漂亮曲线更重要",
            "body": "先划分训练和验证数据，再仅使用训练集估计标准化参数。若在全量数据上拟合均值、词表统计或特征选择，验证信息可能提前进入训练。属于同一用户、文档或时间序列的强相关样本，还需要按组或时间划分，随机按行切分可能给出虚高结果。标签泄漏更隐蔽，例如把结果发生后才知道的字段当成输入。\n\n下面用独立训练索引估计标准化参数，训练时切到 train，评估时切到 eval 并关闭求导，同时报告训练与验证损失。它是 CPU 可运行的最小流程，八轮训练只用于演示模式切换和数据边界，不代表任何固定任务的最佳配置。真正诊断还应记录类别分布、样本量与任务指标。",
            "code": "# CPU 可运行；标准化参数仅由训练集估计。\nimport torch\nfrom torch import nn\ntorch.manual_seed(3)\nx = torch.randn(160, 8)\ny = (x[:, 0] + 0.3 * x[:, 1] > 0).float().unsqueeze(1)\nidx = torch.randperm(len(x))\ntr, va = idx[:128], idx[128:]\nmean, std = x[tr].mean(0), x[tr].std(0).clamp_min(1e-6)\nx = (x - mean) / std\nmodel = nn.Sequential(nn.Linear(8, 16), nn.BatchNorm1d(16),\n                      nn.ReLU(), nn.Dropout(0.2), nn.Linear(16, 1))\nopt = torch.optim.AdamW(model.parameters(), lr=0.01, weight_decay=0.01)\nloss_fn = nn.BCEWithLogitsLoss()\nfor epoch in range(8):\n    model.train()\n    for ids in tr[torch.randperm(len(tr))].split(32):\n        opt.zero_grad(set_to_none=True)\n        loss_fn(model(x[ids]), y[ids]).backward()\n        opt.step()\n    model.eval()\n    with torch.inference_mode():\n        train_loss = loss_fn(model(x[tr]), y[tr]).item()\n        val_loss = loss_fn(model(x[va]), y[va]).item()\n    print(epoch, train_loss, val_loss)",
            "language": "python"
          },
          {
            "heading": "把异常定位到具体训练环节",
            "body": "损失不下降时，先检查标签范围、输入尺度、mask 与 loss 分母，再检查 parameter.requires_grad、梯度是否为 None、范数是否有限以及 optimizer 是否持有正在训练的参数。错误 detach、对张量重新构造而断开计算图、意外在 no_grad 中前向，都会使某些模块无法学习。零梯度与 None 梯度也有不同含义，不能只看打印值为零。\n\n突然发散时，结合学习率、梯度范数、有效 token 数和 AMP 跳过更新次数寻找触发点。训练损失正常而验证异常时，检查 eval 是否设置、预处理是否一致、BatchNorm 统计是否匹配数据分布。每次只改变少量因素，并保留可复现的小样本，能把“调整超参数”变成可检验的诊断过程。"
          }
        ],
        "takeaways": [
          "先用固定小数据验证训练链路，再分析容量、正则化与泛化。",
          "eval 控制 Dropout/BatchNorm 等模块行为，inference_mode 控制求导记录。",
          "划分数据后只在训练集拟合预处理；检查梯度与指标分母定位异常。"
        ],
        "references": [
          {
            "label": "PyTorch：Module train/eval",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.Module.html"
          },
          {
            "label": "PyTorch：Dropout",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.Dropout.html"
          },
          {
            "label": "PyTorch：BatchNorm1d",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.BatchNorm1d.html"
          },
          {
            "label": "PyTorch：Autograd notes",
            "url": "https://docs.pytorch.org/docs/stable/notes/autograd.html"
          }
        ],
        "quiz": [
          {
            "id": "training-4-q1",
            "type": "single",
            "prompt": "只使用 torch.no_grad()，但没有 model.eval()，会怎样？",
            "options": [
              "Dropout 和 BatchNorm 自动进入评估行为",
              "停止求导记录，但模块仍保持原 training 状态",
              "自动冻结所有参数永久不可训练",
              "自动划分验证集"
            ],
            "answer": 1,
            "explanation": "no_grad 控制求导记录，不改变模块 training 状态；Dropout 和默认 BatchNorm 的模式由 train/eval 控制。",
            "topic": "训练与评估"
          },
          {
            "id": "training-4-q2",
            "type": "single",
            "prompt": "哪种标准化流程更能避免验证信息泄漏？",
            "options": [
              "全量数据求均值后划分",
              "先划分，仅用训练集拟合均值方差，再应用到两组",
              "每次用测试集更新 BatchNorm 统计",
              "按验证标签调输入特征"
            ],
            "answer": 1,
            "explanation": "验证数据不能参与拟合训练预处理。先划分再拟合训练统计能保持边界；相关样本还可能需要按组或时间划分。",
            "topic": "数据泄漏"
          },
          {
            "id": "training-4-q3",
            "type": "single",
            "prompt": "关闭强正则后，模型连极小固定训练集都无法拟合，应优先做什么？",
            "options": [
              "直接收集十倍数据",
              "只增加 Dropout",
              "检查标签、loss、梯度与参数更新链路",
              "立即宣布模型已过拟合"
            ],
            "answer": 2,
            "explanation": "极小数据拟合失败首先提示训练链路或容量/优化问题，应查目标、梯度、更新是否正常；更多数据和更强正则通常无助于定位。",
            "topic": "训练诊断"
          }
        ]
      }
    ]
  },
  {
    "id": "transformer",
    "number": 7,
    "title": "Transformer 与生成",
    "subtitle": "从注意力到自回归推理",
    "description": "推导注意力的张量计算，掌握融合算子、缓存与生成策略。",
    "level": "高阶",
    "color": "#6654d9",
    "icon": "attention",
    "lessons": [
      {
        "id": "transformer-1",
        "title": "从形状推导多头注意力",
        "description": "逐步拆解 Q、K、V、因果 mask 和 padding mask，理解每一条张量轴。",
        "duration": 30,
        "difficulty": "进阶",
        "objectives": [
          "推导多头注意力的输入、中间量和输出形状",
          "区分 token 位置、head 维与特征维",
          "正确组合因果可见性和有效 token mask"
        ],
        "sections": [
          {
            "heading": "注意力解决的问题：让当前位置按内容读取上下文",
            "body": "普通逐位置 MLP 对每个 token 使用相同函数，却不会主动混合其他位置的信息。自注意力让一个位置根据当前内容，为可见上下文中的各个位置分配权重，再汇总它们携带的信息。Q 是查询表示，K 用于计算匹配分数，V 是实际被加权汇总的内容；三者都由可训练投影产生，并非人工设定的固定数据库键值。\n\n把注意力理解为“有约束的加权读取”更容易区分两层问题：分数决定读多少，mask 决定能不能读。因果语言模型必须禁止读取未来 token，否则训练时可能直接利用目标信息，得到很低的 loss 却无法正确逐步生成。padding 则不是未来位置，而是无效数据，需要另一种屏蔽条件。\n\n本课先研究没有 dropout、采用普通多头布局的精确注意力。输入为 X∈[B,T,C]，B 是 batch，T 是序列位置，C 是隐藏维。暂不混入缓存和分组查询，先把这条最基本的前向与梯度路径推导清楚。",
            "figure": {
              "type": "table",
              "caption": "沿一条 query 的信息流阅读注意力。",
              "columns": [
                "阶段",
                "输入",
                "输出或约束"
              ],
              "rows": [
                [
                  "投影",
                  "每个 token 的隐藏表示 X",
                  "Q、K、V"
                ],
                [
                  "匹配",
                  "一个 Q 与所有可见 K",
                  "每个 key 一个分数"
                ],
                [
                  "归一化",
                  "分数与可见性 mask",
                  "沿 key 轴的概率权重"
                ],
                [
                  "汇总",
                  "权重与 V",
                  "当前 query 的上下文表示"
                ]
              ]
            },
            "bodyAfter": "自注意力通常让 Q/K/V 来自同一序列；交叉注意力可以让 Q 来自目标序列，K/V 来自另一序列，因此查询长度 L 与键值长度 S 不必相等。"
          },
          {
            "heading": "投影与拆头：先保存轴语义，再改变形状",
            "body": "设有 H 个 head，每个 head 维度 d，普通多头注意力取 C=H×d。三个投影分别把 [B,T,C] 映射到 [B,T,C]；工程上常用一个 Linear(C,3C) 合并投影，再把最后一维切为 Q、K、V。nn.Linear 的权重实际存储为 [out_features,in_features]，数学记号 XW 与代码中的 x @ weight.T 不应混淆。\n\n每个投影先 reshape 为 [B,T,H,d]，只是把隐藏维拆成 head 与 head 内特征；再 transpose 得到 [B,H,T,d]，让各 head 独立执行矩阵乘法。形状变化必须保留原来的索引语义：仅因为元素总数一致，不代表任意 reshape 都能正确交换 token 与 head。\n\n下面固定 B=2、T=6、C=32、H=4，所以 d=8。批次轴与 head 轴共同成为矩阵乘法的前导批处理维度；真正参与每个点积的是最后一个特征轴。读代码时逐次写出形状，比只记住“四维 QKV”可靠。",
            "formula": "Q=XW_Q,\\ K=XW_K,\\ V=XW_V,\\qquad [B,T,C]\\to[B,T,H,d]\\to[B,H,T,d]",
            "code": "import torch\ntorch.manual_seed(7)\nB, T, C, H = 2, 6, 32, 4\nD = C // H\nx = torch.randn(B, T, C)\nq, k, v = torch.nn.Linear(C, 3 * C)(x).chunk(3, dim=-1)\nq, k, v = [a.reshape(B, T, H, D).transpose(1, 2) for a in (q, k, v)]\nassert q.shape == k.shape == v.shape == (2, 4, 6, 8)\nprint(\"Q/K/V:\", tuple(q.shape))",
            "language": "python"
          },
          {
            "heading": "点积分数、缩放与 softmax 的方向",
            "body": "对于 Q∈[B,H,L,d]、K∈[B,H,S,d]，最后两维相乘为 [L,d]×[d,S]，得到分数矩阵 [B,H,L,S]。每一行对应一个 query，每一列对应一个 key。softmax 必须沿最后的键位置轴 S 计算，让一个 query 对所有允许 key 的权重和为一；沿查询轴归一化则改变了算法。\n\n为什么除以 √d？在简化假设下，Q 与 K 各分量独立、均值为零、方差为一，d 项乘积之和的方差随 d 增大。除以 √d 让点积尺度不随 head 维度直接增长，降低 softmax 过早饱和的倾向。真实网络不必满足这些统计假设，但这给出标准缩放的动机，不是对任何输入都稳定的保证。\n\n归一化后权重 A 为 [B,H,L,S]，再乘 V∈[B,H,S,dv] 得到 [B,H,L,dv]。查询长度决定输出位置数量，value 的最后一维决定每个 head 输出特征数。普通 MHA 常取 dv=d，其他实现可以不同。",
            "formula": "E=\\frac{QK^\\top}{\\sqrt d},\\qquad A_{ij}=\\begin{cases}\\dfrac{\\exp(E_{ij})}{\\sum_{k\\in\\mathcal V_i}\\exp(E_{ik})},&j\\in\\mathcal V_i\\\\0,&j\\notin\\mathcal V_i\\end{cases},\\qquad O=AV",
            "figure": {
              "type": "table",
              "caption": "最后两维决定每一步矩阵乘法的契约。",
              "columns": [
                "张量",
                "形状",
                "最后两个轴"
              ],
              "rows": [
                [
                  "Q",
                  "[B,H,L,d]",
                  "query 位置、特征"
                ],
                [
                  "Kᵀ",
                  "[B,H,d,S]",
                  "特征、key 位置"
                ],
                [
                  "分数/权重",
                  "[B,H,L,S]",
                  "query 位置、key 位置"
                ],
                [
                  "V",
                  "[B,H,S,dv]",
                  "key 位置、value 特征"
                ],
                [
                  "输出",
                  "[B,H,L,dv]",
                  "query 位置、输出特征"
                ]
              ]
            },
            "bodyAfter": "公式中的可见集合必须非空，普通 softmax 才能定义有效归一化。高效融合实现可能对全屏蔽行采取特定处理，但手写实现不应靠未核实的边界行为工作。"
          },
          {
            "heading": "手算一次读取：分数如何变成上下文",
            "body": "取单个 query q=[1,0]，两个 key 分别为 [1,0] 与 [0,1]，head 维度为 2。缩放后分数是 [1/√2,0]，softmax 权重约为 [0.6698,0.3302]。若 value 为 [10,0] 和 [0,20]，输出就是两个 value 的加权和，约为 [6.6976,6.6048]。\n\n这个例子说明 K 与 V 的职责不同：匹配第一把 key 的程度更高，不代表直接输出 key，也不代表把第一个 value 完整复制出来。没有额外硬选择时，两者按概率权重混合。若只允许第一个 key，第二项分数被置为负无穷，权重变为 [1,0]，输出才变成 [10,0]。\n\n减去每行最大分数不会改变 softmax，却有助于防止 exp 溢出。训练时优先使用实现稳定归一化的库算子。不要把 masked 分数乘零当作屏蔽：分数零对应 exp(0)=1，仍然会得到非零概率。",
            "formula": "p=\\operatorname{softmax}([1/\\sqrt2,0])\\approx[0.6698,0.3302],\\qquad o=p_0[10,0]+p_1[0,20]",
            "code": "import math\nimport torch\nq = torch.tensor([[1., 0.]], dtype=torch.float64)\nk = torch.eye(2, dtype=torch.float64)\nv = torch.tensor([[10., 0.], [0., 20.]], dtype=torch.float64)\nscores = q @ k.T / math.sqrt(2)\nweights = scores.softmax(-1)\nout = weights @ v\ntorch.testing.assert_close(weights.sum(-1), torch.ones(1, dtype=torch.float64))\nmasked = scores.masked_fill(torch.tensor([[False, True]]), -torch.inf)\ntorch.testing.assert_close(masked.softmax(-1) @ v, v[:1])\nprint(\"weights:\", [round(a, 4) for a in weights[0].tolist()])\nprint(\"output:\", [round(a, 4) for a in out[0].tolist()])",
            "language": "python"
          },
          {
            "heading": "因果 mask、padding mask 与 loss mask 分工不同",
            "body": "因果 mask 限制 query 位置 i 只能读取 key 位置 j≤i。key padding mask 排除无效键列，例如右侧补齐的 token。二者组合时，对每个 batch 样本使用 causal[i,j] 与 key_valid[b,j] 的逻辑与，并增加 head 广播轴。这约束的是信息流，不会自动把无效 query 从训练目标中移除。\n\n以长度 3 的序列补到 4 为例，最后一列不可读，但第 4 行这个 padding query 仍可能读到前三个有效 key。可以按模型契约把该行输出清零，同时通过 labels 的 ignore_index 或 loss mask 排除它。注意输出投影含 bias 时，必须在合适位置应用 query mask，不能以为注意力前清零就保证最终输出为零。\n\nAPI 的布尔约定尤其需要核对：SDPA 的 True 表示允许，MultiheadAttention 的 key_padding_mask=True 表示忽略。左 padding、全空序列或把无效 query 整行置 False，可能造成全屏蔽行；实现应明确处理。以下完整层限定非空、右 padding，因此每个 query 至少能读到首个有效 key。",
            "figure": {
              "type": "table",
              "caption": "右 padding 到 4：表内是允许读取的关系，最后一行不应计入 loss。",
              "columns": [
                "query / key",
                "K0",
                "K1",
                "K2",
                "K3(PAD)"
              ],
              "rows": [
                [
                  "Q0",
                  "允许",
                  "屏蔽",
                  "屏蔽",
                  "屏蔽"
                ],
                [
                  "Q1",
                  "允许",
                  "允许",
                  "屏蔽",
                  "屏蔽"
                ],
                [
                  "Q2",
                  "允许",
                  "允许",
                  "允许",
                  "屏蔽"
                ],
                [
                  "Q3(PAD)",
                  "允许",
                  "允许",
                  "允许",
                  "屏蔽"
                ]
              ]
            },
            "code": "import torch\nkey_valid = torch.tensor([[True, True, True, False]])\ncausal = torch.ones(4, 4, dtype=torch.bool).tril()\nallowed = causal[None, None, :, :] & key_valid[:, None, None, :]\nassert allowed.shape == (1, 1, 4, 4)\nassert allowed[0, 0, 3].tolist() == [True, True, True, False]\nassert not allowed[..., 3].any()\nassert allowed.any(-1).all()\nprint(allowed[0, 0].to(torch.int).tolist())",
            "language": "python"
          },
          {
            "heading": "把推导落成一个完整、可验证的多头层",
            "body": "下面的层把投影、拆头、缩放、mask、softmax、汇总、合头和输出投影放在同一段代码中。输入 valid 明确表示每个 token 是否有效，并检查它满足非空右 padding。我们不加入 dropout，便于先验证确定性的数学关系；支持其他 padding 形式时，应重新设计全屏蔽行与位置编号的处理。\n\n合头必须先从 [B,H,T,d] 转回 [B,T,H,d]，再合并最后两维。直接把 [B,H,T,d] reshape 为 [B,T,C] 会错排 head 与 token。输出投影会混合各 head 特征，最后根据 query 的有效性清零 padding 行。返回权重仅用于教学与诊断，生产中保存完整权重矩阵可能抵消融合注意力的内存收益。\n\n示例除了检查形状，还验证两项不变性：修改未来位置不改变过去输出；修改 padding 内容不改变有效 token 输出。这些性质直接检查 mask 语义，比只看网络能够运行更有意义。所有断言均可在 CPU 执行。",
            "code": "import torch\nfrom torch import nn\ntorch.manual_seed(7)\ntorch.set_num_threads(1)\n\nclass CausalMHA(nn.Module):\n    def __init__(self, width, heads):\n        super().__init__()\n        assert width % heads == 0\n        self.heads, self.dim = heads, width // heads\n        self.qkv = nn.Linear(width, 3 * width)\n        self.proj = nn.Linear(width, width)\n\n    def forward(self, x, valid):\n        batch, length, width = x.shape\n        assert valid.dtype == torch.bool and valid.shape == (batch, length)\n        assert valid[:, 0].all(), \"nonempty right-padded sequences required\"\n        assert not ((~valid[:, :-1]) & valid[:, 1:]).any()\n        chunks = self.qkv(x).chunk(3, dim=-1)\n        q, k, v = [t.reshape(batch, length, self.heads, self.dim)\n                    .transpose(1, 2) for t in chunks]\n        causal = torch.ones(length, length, dtype=torch.bool, device=x.device).tril()\n        allowed = causal[None, None] & valid[:, None, None, :]\n        scores = q @ k.transpose(-2, -1) / self.dim**0.5\n        weights = scores.masked_fill(~allowed, -torch.inf).softmax(-1)\n        merged = (weights @ v).transpose(1, 2).reshape(batch, length, width)\n        out = self.proj(merged).masked_fill(~valid[..., None], 0)\n        return out, weights\n\nmodel = CausalMHA(32, 4).eval()\nx = torch.randn(2, 6, 32)\nvalid = torch.tensor([[1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 0, 0]], dtype=torch.bool)\nout, weights = model(x, valid)\nassert out.shape == (2, 6, 32) and weights.shape == (2, 4, 6, 6)\ntorch.testing.assert_close(weights.sum(-1), torch.ones_like(weights.sum(-1)))\nchanged = x.clone()\nchanged[:, 4:] += 100\nchanged_out, _ = model(changed, valid)\ntorch.testing.assert_close(changed_out[:, :4], out[:, :4])\nassert out[1, 4:].eq(0).all()\nout.square().sum().backward()\nassert model.qkv.weight.grad is not None\nassert torch.isfinite(model.qkv.weight.grad).all()\nprint(\"shape, causal/padding invariance and backward: PASS\")",
            "language": "python"
          },
          {
            "heading": "验证注意力时，要测性质与梯度",
            "body": "形状检查只是第一层。第二层是归一化：在没有 dropout 时，每个有效 query 的权重行和应为一，禁止连接的概率应为零。第三层是信息隔离：扰动未来 token 或 padding 内容，不应改变被保护位置的输出。测试 padding 时还要保持有效 token 的位置编号不变，否则位置编码变化本来就可能改变结果。\n\n第四层比较独立实现。固定小张量，把手写公式与 scaled_dot_product_attention 在相同 mask、scale 和 dropout 条件下对照；训练场景再比较 Q/K/V 的梯度，而不仅是前向结果。使用 double 或合理误差容限有助于分辨算法错误和浮点归约顺序差异。换成融合后端不意味着梯度被切断，但每种后端仍应验证其边界行为。\n\n最小测试最好能定位错误，而不是只运行一次随机大模型。若把 softmax 轴故意改错、去掉 causal mask 或直接错误合头，测试应确实失败。这种针对具体性质设计的检查，才能长期保护实现。",
            "figure": {
              "type": "table",
              "caption": "从便宜检查逐步走向训练语义。",
              "columns": [
                "检查层次",
                "输入设计",
                "必须满足的性质"
              ],
              "rows": [
                [
                  "形状与范围",
                  "小 B/H/T/d",
                  "输出轴正确，值有限"
                ],
                [
                  "概率",
                  "dropout=0",
                  "行和为 1，禁用边为 0"
                ],
                [
                  "可见性",
                  "只扰动未来或 padding",
                  "受保护输出不变"
                ],
                [
                  "独立参考",
                  "手写与 SDPA 同输入",
                  "输出在容差内一致"
                ],
                [
                  "反向",
                  "固定同一上游梯度",
                  "Q/K/V 梯度在容差内一致"
                ]
              ]
            }
          },
          {
            "heading": "多头注意力如何进入完整 Transformer",
            "body": "完整 Transformer block 还需要残差、归一化、前馈网络和位置机制。一个常见的 pre-norm 结构先对 X 归一化后做注意力，再加回 X；随后对中间结果归一化、经过逐位置 MLP，再做第二次残差。post-norm 则把归一化放在残差之后，两种顺序对梯度传播与训练行为有不同影响。\n\n没有位置机制时，注意力主要根据内容匹配；实际模型可使用绝对位置 embedding、相对位置偏置或 RoPE 等方案。RoPE 通常对 Q/K 按位置旋转，使点积带有位置信息，不是直接把 V 旋转成另一份内容。缓存解码还必须让新 token 使用正确的绝对位置。\n\n读到一种新变体时，先映射回本课的轴与信息流：哪些投影共享，Q 与 K/V 有多少 head，查询与键的长度分别是多少，哪些连接被允许，合头后怎么投影。这样能逐项理解变化，也能明确哪些原来的正确性测试仍适用。",
            "formula": "U=X+\\operatorname{Attention}(\\operatorname{Norm}(X)),\\qquad Y=U+\\operatorname{MLP}(\\operatorname{Norm}(U))",
            "callout": "注意力 mask 管信息能否流动，loss mask 管哪些预测参与优化。二者必须分别正确；任何一方都不能自动替代另一方。"
          }
        ],
        "takeaways": [
          "QKᵀ 的最后两维是查询位置与键位置，softmax 沿键轴归一化。",
          "注意力 mask 和损失 mask 分别约束信息流与训练目标。",
          "不同 PyTorch 接口的布尔 mask 语义不同，必须查清 True 的含义。"
        ],
        "references": [
          {
            "label": "PyTorch：MultiheadAttention",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.MultiheadAttention.html"
          },
          {
            "label": "PyTorch：Scaled dot product attention",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html"
          },
          {
            "label": "PyTorch：TransformerEncoderLayer",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.TransformerEncoderLayer.html"
          }
        ],
        "quiz": [
          {
            "id": "transformer-1-q1",
            "type": "single",
            "prompt": "Q 为 [2,8,5,64]，K 为 [2,8,9,64]，QKᵀ 的形状是？",
            "options": [
              "[2,8,64,64]",
              "[2,8,5,9]",
              "[2,8,9,5]",
              "[2,5,8,64]"
            ],
            "answer": 1,
            "explanation": "最后两维做 [5,64]×[64,9]，得到 [5,9]；前面的 batch 与 head 轴保留。",
            "topic": "注意力形状"
          },
          {
            "id": "transformer-1-q2",
            "type": "single",
            "prompt": "注意力 softmax 应沿哪条轴进行？",
            "options": [
              "batch 轴",
              "head 轴",
              "键位置轴",
              "查询位置轴"
            ],
            "answer": 2,
            "explanation": "每个查询对所有可见键的权重进行归一化，因此沿键位置轴；沿查询轴会改变注意力定义。",
            "topic": "注意力归一化"
          },
          {
            "id": "transformer-1-q3",
            "type": "single",
            "prompt": "SDPA 的布尔 attn_mask 中 True 表示什么？",
            "options": [
              "屏蔽该键",
              "允许该查询键配对参与注意力",
              "自动从 loss 中排除 token",
              "该位置一定来自 padding"
            ],
            "answer": 1,
            "explanation": "SDPA 的 True 表示参与；这与 MultiheadAttention 的 key_padding_mask=True 表示忽略不同，也不会自动改变损失 mask。",
            "topic": "注意力掩码"
          }
        ]
      },
      {
        "id": "transformer-2",
        "title": "SDPA 与 Flash Attention",
        "description": "理解精确注意力如何通过分块和在线 softmax 减少显存访问。",
        "duration": 30,
        "difficulty": "高阶",
        "objectives": [
          "使用 scaled_dot_product_attention 并处理 dropout",
          "解释 Flash Attention 的内存与计算复杂度",
          "识别融合后端限制和非方形因果 mask 问题"
        ],
        "sections": [
          {
            "heading": "一个接口与多个执行后端",
            "body": "torch.nn.functional.scaled_dot_product_attention 简称 SDPA，统一表达缩放点积注意力。它可能根据设备、dtype、shape、mask 和运行环境选择不同实现，包括融合实现和数学参考路径。调用 SDPA 不意味着一定使用 Flash Attention，也不保证所有输入布局都能获得相同加速。\n\n输入常为 [B,H,L,D]，键和值的长度为 S，输出长度跟随查询 L。默认缩放是 1/sqrt(D)，可显式设置 scale。GQA 需要查询 head 数与键值 head 数满足分组关系，并受后端支持限制。评估性能时记录真实输入配置与选中后端，而不是仅凭函数名推断执行路径。"
          },
          {
            "heading": "Flash Attention 不近似 softmax",
            "body": "朴素实现把完整 [L,S] 分数与概率矩阵写入显存；长序列时，这些中间量占据大量带宽与存储。Flash Attention 将 Q、K、V 分块，在片上存储处理一部分分数，并用在线 softmax 合并各块，从而避免把完整注意力矩阵物化到高带宽显存。\n\n在线归一化维护当前最大值、指数和与加权值累积。遇到更大最大值时，旧累积按新的尺度重新缩放，再加入当前块，因此保持同一个 softmax 数学目标。它属于精确注意力算法，但浮点运算顺序改变可产生舍入差异，不能要求逐位一致。它主要改善内存访问与中间存储，密集注意力的算术规模仍随 L×S 增长。"
          },
          {
            "heading": "函数式 dropout 必须显式控制",
            "body": "SDPA 是函数接口，不会自动根据外部模型的 eval 状态把 dropout 关掉。训练时可传模型设定的概率，推理时必须传 dropout_p=0.0。否则同样输入在推理中也可能随机变化。这和 nn.Dropout 模块通过 train/eval 切换行为不同。\n\n下面示例在 dropout 为零时，把 SDPA 与手写结果比较。CPU 可以运行数学路径，支持的 GPU 环境可能选中融合实现，误差容差需要结合精度与设备调整。验证不仅看输出 shape，还应在实际训练中比较梯度；融合算子可以保留自动求导，不应把融合与停止梯度混为一谈。",
            "code": "# CPU 可运行；GPU 环境可将 q/k/v 移到 CUDA。\nimport torch\nimport torch.nn.functional as F\nB, H, L, D = 2, 4, 6, 16\nq = torch.randn(B, H, L, D, requires_grad=True)\nk = torch.randn(B, H, L, D, requires_grad=True)\nv = torch.randn(B, H, L, D, requires_grad=True)\nallowed = torch.ones(L, L, dtype=torch.bool).tril()\nactual = F.scaled_dot_product_attention(q, k, v, attn_mask=allowed, dropout_p=0.0)\nscores = (q @ k.transpose(-2, -1)) / D**0.5\nexpected = scores.masked_fill(~allowed, float('-inf')).softmax(-1) @ v\ntorch.testing.assert_close(actual, expected, rtol=1e-4, atol=1e-5)\nactual.square().mean().backward()\nprint(q.grad.norm())",
            "language": "python"
          },
          {
            "heading": "矩形因果关系需要位置坐标",
            "body": "自注意力预填充常有 L=S，简单下三角 mask 能表达因果性；使用缓存解码时，查询可能只有一个新 token，而键包含整个历史，L 与 S 不相等。这时不能机械地把方形三角模式套到矩形。SDPA 的 is_causal=True 对非方形输入采用左上对齐的因果关系。例如 L=1、S=5 时，它只允许键位置 0，而不是自动把查询当成绝对位置 4。因此缓存解码不能假设它自动对齐到最新位置。\n\n最清晰的方法是基于绝对位置构造 allowed=query_position>=key_position。若单步解码的缓存只包含历史与当前 token，则所有缓存键都可见，可以不设因果限制。若一批追加多个 token，则需要对新块内部的未来 token 继续屏蔽。mask 的数学正确性优先于是否能启用某个更快的内核。",
            "code": "# CPU 可运行：两个新查询的位置为 3、4，缓存键位置为 0..4。\nimport torch\nimport torch.nn.functional as F\nq = torch.zeros(1, 1, 2, 1)\nk = torch.zeros(1, 1, 5, 1)\nv = torch.arange(5, dtype=torch.float32).reshape(1, 1, 5, 1)\nupper_left = F.scaled_dot_product_attention(q, k, v, is_causal=True)\nquery_pos = torch.tensor([3, 4])\nkey_pos = torch.arange(5)\nallowed = query_pos[:, None] >= key_pos[None, :]\ncorrect = F.scaled_dot_product_attention(\n    q, k, v, attn_mask=allowed, dropout_p=0.0)\nprint(upper_left.flatten())  # [0.0, 0.5]: 只读最前面的 1、2 个键。\nprint(correct.flatten())     # [1.5, 2.0]: 分别读 4、5 个键。\n"
          }
        ],
        "takeaways": [
          "SDPA 是统一接口，Flash Attention 是可能被选择的执行后端之一。",
          "Flash Attention 保持密集注意力目标，减少中间矩阵物化与显存访问。",
          "推理时显式传 dropout_p=0；缓存解码用真实位置定义因果关系。"
        ],
        "references": [
          {
            "label": "PyTorch：SDPA API and backend notes",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html"
          },
          {
            "label": "PyTorch：SDPA tutorial",
            "url": "https://docs.pytorch.org/tutorials/intermediate/scaled_dot_product_attention_tutorial.html"
          },
          {
            "label": "PyTorch：SDPBackend",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.attention.SDPBackend.html"
          }
        ],
        "quiz": [
          {
            "id": "transformer-2-q1",
            "type": "single",
            "prompt": "Flash Attention 的核心收益是什么？",
            "options": [
              "删除一半 token 的注意力",
              "把密集注意力计算量变成严格线性",
              "分块和在线 softmax，避免物化完整注意力矩阵",
              "禁止反向传播"
            ],
            "answer": 2,
            "explanation": "它通过 IO 优化与分块减少显存访问，保持相同注意力目标；密集注意力算术规模仍为二次序列相关，并非稀疏近似。",
            "topic": "Flash Attention"
          },
          {
            "id": "transformer-2-q2",
            "type": "single",
            "prompt": "模型已 eval()，直接调用 SDPA 时传 dropout_p=0.2，会怎样？",
            "options": [
              "自动变为 0",
              "仍会按传入概率施加 dropout",
              "自动报错",
              "仅影响 LayerNorm"
            ],
            "answer": 1,
            "explanation": "函数式 SDPA 根据 dropout_p 执行，不读取外部模块的 training 状态；推理应显式传 0.0。",
            "topic": "推理 Dropout"
          },
          {
            "id": "transformer-2-q3",
            "type": "single",
            "prompt": "单步解码：一个最新 query，缓存中只有历史和当前 K/V。正确可见性是什么？",
            "options": [
              "只允许第一个键",
              "只允许最后一个键",
              "允许缓存中所有键",
              "全部屏蔽"
            ],
            "answer": 2,
            "explanation": "最新 token 可以读取全部历史和自身；缓存没有未来 token，因此所有现有键可见。不能误用左上对齐的矩形三角模式。",
            "topic": "缓存因果关系"
          }
        ]
      },
      {
        "id": "transformer-3",
        "title": "KV cache、Prefill 与 GQA",
        "description": "理解缓存为什么减少重复计算，如何增长，以及如何估算真实占用。",
        "duration": 30,
        "difficulty": "高阶",
        "objectives": [
          "区分 prefill 与逐 token decode 的计算模式",
          "推导 KV cache 的内存公式",
          "解释 MHA、GQA、MQA 与缓存 head 数的关系"
        ],
        "sections": [
          {
            "heading": "缓存保存历史键和值",
            "body": "自回归生成中，第 t 步只需要为新 token 计算各层的 Q、K、V。过去 token 的 K/V 可以复用，不必每次把整个前缀重新前向。每一层都有自己的缓存，因为各层隐藏表示不同。缓存不是训练数据集，也不是存储注意力概率；通常保存已经完成对应位置变换、可直接参与后续注意力的 K 和 V。\n\nPrefill 一次处理多个输入 token，矩阵运算较大；decode 通常每条序列只增加一个查询，但仍要读取越来越长的历史缓存。缓存避免重复计算历史 token 的投影和网络层，却没有让新 token 对历史的注意力读取变为常数。因此上下文越长，解码时的内存读流量通常越大。"
          },
          {
            "heading": "按键值 head 数估算内存",
            "body": "逻辑完整模型的 KV 字节数近似为 2×层数×batch×缓存长度×KV head 数×head 维度×每元素字节数。系数 2 对应 K 与 V。例：32 层、batch=4、长度 4096、8 个 KV head、每 head 128、FP16，每个元素 2 字节，总计约 2 GiB；若 KV head 数变为 32，则约 8 GiB。\n\n这只是有效缓存张量的估算，不含模型权重、激活、索引元数据、内存碎片和预留容量。多设备分片后每卡占用取决于实际切分或复制方案，不能无条件除以设备数。动态 batch 中各序列长度不同，应对每条序列实际占用求和；块式缓存还会受到块大小和尾块浪费影响。"
          },
          {
            "heading": "GQA 与 MQA 减少缓存维度",
            "body": "MHA 通常每个查询 head 对应自己的 K/V head。GQA 让一组查询 head 共享一个 K/V head，因此 Hq 大于 Hkv，通常要求 Hq 能被 Hkv 整除，且 K 与 V 的 head 数相等；MQA 是只保留一个 K/V head 的特例。输出仍由多个查询 head 产生，减少的是键值投影与缓存 head 数，不是把所有 query 合并成一个。\n\n概念参考实现可以把 K/V repeat 到查询 head 数再调用普通注意力，但物化重复张量可能抵消内存和带宽收益。高效实现应在计算中直接利用共享关系。GQA 通常属于模型架构与训练设计，不是任意已训练 MHA 模型可以无损开启的运行时开关；改变投影结构可能需要训练或转换方案。",
            "code": "# 在 PyTorch 2.14.1 CPU 数学后端验证；其他后端支持需核对。\nimport torch\nimport torch.nn.functional as F\nfrom torch.nn.attention import SDPBackend, sdpa_kernel\nq = torch.randn(1, 4, 3, 8)\nk = torch.randn(1, 2, 5, 8)\nv = torch.randn_like(k)\nassert q.shape[1] % k.shape[1] == 0\nwith sdpa_kernel(SDPBackend.MATH):\n    shared = F.scaled_dot_product_attention(q, k, v, enable_gqa=True)\n    repeated = F.scaled_dot_product_attention(\n        q, k.repeat_interleave(2, dim=1), v.repeat_interleave(2, dim=1))\ntorch.testing.assert_close(shared, repeated, rtol=1e-4, atol=1e-5)\nprint(shared.shape)  # [1, 4, 3, 8]：输出仍保留 4 个 query head。"
          },
          {
            "heading": "最小单步缓存示例",
            "body": "下面使用预分配缓存展示核心操作：写入当前 token 的 K/V，切出有效前缀，用当前 Q 读取全部前缀。它仅演示单层注意力，不是完整语言模型；真实模型还要处理各层状态、位置编码、结束标记和批内不同长度。预分配容量需要显式边界检查，避免越界或把未初始化区域当成有效内容。\n\n生产实现常用页或块管理缓存，使不同长度序列共享内存池，并在请求完成后回收。简单每步 torch.cat 会反复分配和拷贝旧缓存，理解起来方便但性能较差。若一次追加多个 token，需要构造基于绝对位置的矩形因果 mask；单步缓存中没有未来位置时可直接允许全部有效键。",
            "code": "# CPU 可运行；单层、单 batch、预分配 KV 缓存示意。\nimport torch\nimport torch.nn.functional as F\nB, H, D, capacity = 1, 4, 16, 8\nk_cache = torch.empty(B, H, capacity, D)\nv_cache = torch.empty_like(k_cache)\nwith torch.inference_mode():\n    for pos in range(5):\n        q = torch.randn(B, H, 1, D)\n        k = torch.randn(B, H, 1, D)\n        v = torch.randn(B, H, 1, D)\n        assert pos < capacity\n        k_cache[:, :, pos:pos+1].copy_(k)\n        v_cache[:, :, pos:pos+1].copy_(v)\n        out = F.scaled_dot_product_attention(\n            q, k_cache[:, :, :pos+1], v_cache[:, :, :pos+1],\n            dropout_p=0.0, is_causal=False)\n        print(pos + 1, tuple(out.shape))",
            "language": "python"
          }
        ],
        "takeaways": [
          "KV cache 避免重算历史 token 的各层 K/V，但 decode 仍读取历史缓存。",
          "缓存大小按 KV head 数计算，GQA 的 query head 数不是缓存 head 数。",
          "精确容量还需考虑分片、复制、块浪费、元数据与预留空间。"
        ],
        "references": [
          {
            "label": "PyTorch：Scaled dot product attention and GQA",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html"
          },
          {
            "label": "PyTorch：Inference mode",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.inference_mode.html"
          }
        ],
        "quiz": [
          {
            "id": "transformer-3-q1",
            "type": "single",
            "prompt": "KV cache 在自回归解码中主要避免什么？",
            "options": [
              "任何历史 token 的注意力读取",
              "重复计算历史 token 在各层的 K/V",
              "所有模型权重加载",
              "生成当前 token 的 Q"
            ],
            "answer": 1,
            "explanation": "历史 K/V 可复用，但新 query 仍读取历史缓存；当前 token 的 Q/K/V 和后续网络计算仍需要执行。",
            "topic": "KV cache"
          },
          {
            "id": "transformer-3-q2",
            "type": "single",
            "prompt": "32 层、B=4、T=4096、Hkv=8、D=128、FP16 的逻辑 KV 张量大小约为？",
            "options": [
              "256 MiB",
              "1 GiB",
              "2 GiB",
              "8 GiB"
            ],
            "answer": 2,
            "explanation": "2×32×4×4096×8×128×2=2147483648 字节，即 2 GiB；不含元数据和预留空间。",
            "topic": "缓存内存"
          },
          {
            "id": "transformer-3-q3",
            "type": "single",
            "prompt": "GQA 中 Hq=32、Hkv=8，估算 KV cache 应使用哪个 head 数？",
            "options": [
              "32",
              "8",
              "40",
              "256"
            ],
            "answer": 1,
            "explanation": "缓存保存 K/V，所以使用 Hkv=8；查询 head 仍为 32，但不是缓存的 head 维。",
            "topic": "GQA"
          }
        ]
      },
      {
        "id": "transformer-4",
        "title": "生成、采样与 Logprob",
        "description": "从 next-token logits 到温度、top-k、top-p、序列概率与策略分布。",
        "duration": 30,
        "difficulty": "高阶",
        "objectives": [
          "区分原始模型分布与采样变换后的分布",
          "理解 logits 与下一 token 标签的时间对齐",
          "稳定计算 token logprob 与序列分数"
        ],
        "sections": [
          {
            "heading": "下一 token 预测的时间偏移",
            "body": "因果语言模型对位置 t 的输出 logits 描述在已经看到不晚于 t 的输入后，下一个 token 的分布。训练时通常用 logits[:, :-1] 对齐 input_ids[:, 1:]。如果模型接口内部已根据 labels 完成移位，就不能在外部再重复移位，否则会训练成预测更远的位置。\n\npadding、prompt 和 response 的 loss mask 决定哪些预测位置被纳入目标。mask 同样需要按预测目标对齐，而不是机械沿用原始输入位置。计算 token logprob 时，先对词表轴执行 log_softmax，再用目标 token ID gather；直接 log(softmax()) 可能丢失极小概率的数值稳定性。"
          },
          {
            "heading": "温度与候选集合改变分布",
            "body": "温度 T>0 通过 logits/T 改变概率的尖锐程度。T 较低通常更集中，较高更平坦；贪心解码应直接 argmax，而不是把 T 设置为零后做除法。top-k 只保留分数最高的 k 个 token；top-p 按概率从大到小累加，保留达到阈值所需的最小前缀，通常包含跨过阈值的那个 token。\n\n过滤后需要重新归一化，再采样。温度、top-k、top-p 的应用顺序会影响最终分布，尤其不能把不同实现产生的 logprob 当成同一策略概率。只要修改了 logits、屏蔽候选或施加重复惩罚，采样策略就可能不同于原始模型 softmax。训练或评估使用哪种概率，必须在接口契约中说明。"
          },
          {
            "heading": "稳定地采样并记录两类概率",
            "body": "下面演示温度加 top-k，分别记录原始模型分布和实际采样分布下同一个 token 的 logprob。词表被截断之后，保留 token 的概率重新分配，二者通常不同。强化学习、重要性比率和策略评估尤其需要明确分母分子来自什么分布；仅保存一个没有定义的 logprob 字段很容易造成隐蔽错误。\n\ntorch.multinomial 需要非负且总和为正的权重。全部候选被屏蔽或 logits 已含 NaN 时，采样会失败，应从约束组合和模型输出排查。复现实验可固定随机种子，但跨设备或不同采样实现不一定逐位一致。固定候选与固定策略定义比只固定 seed 更基础。",
            "code": "# CPU 可运行：单步采样，明确记录分布来源。\nimport torch\nimport torch.nn.functional as F\ntorch.manual_seed(7)\nlogits = torch.tensor([[3.0, 2.0, 0.5, -1.0, -2.0]])\nraw_logp = F.log_softmax(logits.float(), dim=-1)\ntemperature, top_k = 0.8, 3\nscaled = logits.float() / temperature\nvalues, indices = torch.topk(scaled, k=top_k, dim=-1)\nfiltered = torch.full_like(scaled, float('-inf'))\nfiltered.scatter_(-1, indices, values)\nsampling_logp = F.log_softmax(filtered, dim=-1)\ntoken = torch.multinomial(sampling_logp.exp(), num_samples=1)\nprint('token:', token.item())\nprint('model logprob:', raw_logp.gather(-1, token).item())\nprint('sampling logprob:', sampling_logp.gather(-1, token).item())",
            "language": "python"
          },
          {
            "heading": "序列分数与停止条件",
            "body": "在给定上下文条件下，一条生成序列的概率是每步条件概率的乘积，logprob 则是各步条件 logprob 的和。长度不同的序列用总和比较时通常偏向更短序列；平均 token logprob、长度惩罚和任务评分表达不同目标，不能混为同一个“置信度”。模型高概率也不代表事实正确。\n\n生成循环还需要管理 EOS、最大生成长度、批内已结束样本和缓存位置。某些序列提前结束时，不能让它们继续贡献训练 token 计数；为保持批形状而填充的 token 应被 mask。推理可用 inference_mode 避免构建梯度图，但需要梯度的策略训练或可微目标计算应使用合适的训练路径，不能把推理张量直接当成保留了图的结果。"
          }
        ],
        "takeaways": [
          "next-token logits 与目标存在一位偏移，检查模型是否内部已移位。",
          "温度与 top-k/top-p 修改采样策略，原始模型 logprob 和采样 logprob 不同。",
          "序列 logprob 是条件 logprob 的和；长度归一化与置信度有不同含义。"
        ],
        "references": [
          {
            "label": "PyTorch：log_softmax",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.log_softmax.html"
          },
          {
            "label": "PyTorch：multinomial",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.multinomial.html"
          },
          {
            "label": "PyTorch：topk",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.topk.html"
          }
        ],
        "quiz": [
          {
            "id": "transformer-4-q1",
            "type": "single",
            "prompt": "手动计算因果语言模型 next-token loss，通常怎样对齐？",
            "options": [
              "logits[:,:-1] 对 input_ids[:,1:]",
              "logits[:,1:] 对 input_ids[:,:-1]",
              "每个 logits 对同位置输入且无需移位",
              "把词表轴反转"
            ],
            "answer": 0,
            "explanation": "位置 t 的 logits 预测下一个 token，所以目标来自 t+1；如果模型内部已移位，则外部不能重复操作。",
            "topic": "标签对齐"
          },
          {
            "id": "transformer-4-q2",
            "type": "single",
            "prompt": "top-k 过滤后选中 token 的采样 logprob 与原始模型 logprob 一定相同吗？",
            "options": [
              "一定相同",
              "通常不同，因为候选集合变化后重新归一化",
              "前者一定为零",
              "只有 FP16 才不同"
            ],
            "answer": 1,
            "explanation": "过滤移除一部分概率质量，保留候选重新归一化，因此采样策略与原分布通常不同，与是否 FP16 无直接关系。",
            "topic": "采样分布"
          },
          {
            "id": "transformer-4-q3",
            "type": "single",
            "prompt": "一条序列在给定上下文下的 logprob 如何计算？",
            "options": [
              "各 token 条件 logprob 相乘",
              "各 token 条件 logprob 相加",
              "取最大的一个",
              "除以词表大小"
            ],
            "answer": 1,
            "explanation": "联合概率按链式法则相乘，取对数后相加。平均 logprob 是另外一种长度归一化分数。",
            "topic": "序列概率"
          }
        ]
      }
    ]
  },
  {
    "id": "distributed",
    "number": 9,
    "title": "分布式训练基础",
    "subtitle": "多进程、通信与全局训练语义",
    "description": "掌握通信组与 DDP，把数据采样、梯度归一化和检查点连接起来。",
    "level": "高阶",
    "color": "#6654d9",
    "icon": "network",
    "lessons": [
      {
        "id": "distributed-1",
        "title": "进程、Rank 与通信组",
        "description": "用 torchrun 建立分布式执行，区分全局身份、本机设备和逻辑通信组。",
        "duration": 30,
        "difficulty": "高阶",
        "objectives": [
          "区分 RANK、LOCAL_RANK 与 WORLD_SIZE",
          "选择 CPU/GPU 通信后端并正确绑定设备",
          "理解 rendezvous、process group 与多种并行维度"
        ],
        "sections": [
          {
            "heading": "分布式首先是多个进程",
            "body": "典型 GPU 训练采用每张 GPU 一个进程，各进程有独立 Python 解释器、模型副本和内存空间。RANK 是作业中的全局进程编号，LOCAL_RANK 是当前机器内的编号，WORLD_SIZE 是整个默认通信组的进程数。多机时，每台机器都可能有 LOCAL_RANK=0，但全局 RANK 只有一个 0。\n\n绑定 CUDA 设备时通常使用 LOCAL_RANK，并注意 CUDA_VISIBLE_DEVICES 已经定义了进程看到的逻辑设备编号。不能直接把全局 RANK 当成本机设备索引。启动多个进程也不自动构成 DDP：还需要初始化通信组、放置模型、包装并行策略，并让数据管线按设计分片。"
          },
          {
            "heading": "torchrun 负责启动与环境信息",
            "body": "torchrun 为工作进程设置 rank、world size 和 rendezvous 所需环境。单机实验可以用 --standalone；多机需要所有节点连接到同一个 rendezvous 配置，并保证网络地址和端口可达。初始化进程组是建立通信关系，不是把模型权重自动加载或把数据自动分发。\n\nCPU 教学通常使用 Gloo，CUDA 张量通信通常使用 NCCL。不同后端对设备和算子的支持不同，不能假设 CPU 张量能直接交给 NCCL。GPU 程序应在初始化使用设备的通信前正确 set_device，并按本地 rank 绑定模型和输入。下面刻意使用 CPU/Gloo，使两进程示例不依赖多张 GPU。",
            "code": "# 保存为 rank_demo.py。CPU 两进程运行：\n# torchrun --standalone --nproc_per_node=2 rank_demo.py\nimport os\nfrom datetime import timedelta\nimport torch\nimport torch.distributed as dist\ndist.init_process_group('gloo', timeout=timedelta(seconds=120))\ntry:\n    rank = dist.get_rank()\n    world = dist.get_world_size()\n    local = int(os.environ['LOCAL_RANK'])\n    value = torch.tensor(float(rank + 1))\n    dist.all_reduce(value, op=dist.ReduceOp.SUM)\n    print(f'rank={rank}, local={local}, world={world}, sum={value.item()}')\nfinally:\n    dist.destroy_process_group()",
            "language": "python"
          },
          {
            "heading": "Process group 定义谁一起通信",
            "body": "默认组包含整个作业；还可以建立子组，让不同成员执行数据并行、张量并行或流水线通信。一个模型可能同时使用多个并行维度，因此 WORLD_SIZE 不总等于数据并行度。计算全局独立样本数和 DDP 归一化时，应使用对应的数据并行组大小。\n\n组的创建及 collective 调用有一致性要求。默认 new_group 用法通常要求默认组的所有进程以一致顺序参与创建，即使部分进程不是该子组成员；具体例外应依据接口选项处理。多通信组操作顺序也需要协调，不能让不同 rank 在不同组上形成相互等待。先把每个 rank 的组成员关系列成表，比只看总 GPU 数更有效。"
          },
          {
            "heading": "初始化失败与执行死锁分开查",
            "body": "初始化卡住往往涉及 rendezvous、网络、进程未启动、rank 配置或设备映射；已经训练若干步后才卡住，则更应检查是否有进程异常退出、输入步数不一致或 collective 顺序分叉。超时是发现问题的边界，不是修复不匹配通信的方式。\n\n诊断日志应带全局 rank、local rank、步骤号和通信阶段。每个进程都要保存自己的异常，rank 0 的错误可能只是其他进程失败后的连带症状。先用最小 all_reduce 测试环境，再逐层加入模型和数据加载；这样能区分通信环境故障与训练逻辑错误。退出时按所有进程一致的正常路径清理进程组。"
          }
        ],
        "takeaways": [
          "RANK 是全局身份，LOCAL_RANK 通常用于本机设备绑定。",
          "torchrun 启动进程，init_process_group 建立通信，DDP 包装训练同步。",
          "全局进程数不必等于数据并行度；每个通信组都有成员和调用顺序。"
        ],
        "references": [
          {
            "label": "PyTorch：torchrun elastic launch",
            "url": "https://docs.pytorch.org/docs/stable/elastic/run.html"
          },
          {
            "label": "PyTorch：Distributed communication package",
            "url": "https://docs.pytorch.org/docs/stable/distributed.html"
          }
        ],
        "quiz": [
          {
            "id": "distributed-1-q1",
            "type": "single",
            "prompt": "两台机器各四张 GPU，全局 rank=5 的进程通常该用什么来选择本机 GPU？",
            "options": [
              "WORLD_SIZE",
              "LOCAL_RANK",
              "始终选设备 5",
              "MASTER_PORT"
            ],
            "answer": 1,
            "explanation": "本机设备编号由 LOCAL_RANK 及可见设备映射决定；全局 rank=5 不代表本机存在第六张可见 GPU。",
            "topic": "进程身份"
          },
          {
            "id": "distributed-1-q2",
            "type": "single",
            "prompt": "只用 torchrun 启动两个进程，是否自动同步模型梯度？",
            "options": [
              "会，torchrun 默认包装 DDP",
              "不会，还需要模型并行封装和对应训练逻辑",
              "会，只同步 bias",
              "取决于文件名"
            ],
            "answer": 1,
            "explanation": "torchrun 主要负责启动、环境和故障管理，不会自动包装模型或分片数据。",
            "topic": "分布式启动"
          },
          {
            "id": "distributed-1-q3",
            "type": "single",
            "prompt": "WORLD_SIZE=16，DP=4、TP=4，计算独立样本批量应乘哪个并行度？",
            "options": [
              "16",
              "4，即 DP",
              "64",
              "只看 TP"
            ],
            "answer": 1,
            "explanation": "数据并行副本处理独立样本，张量并行组协作计算相同样本，所以应乘 DP=4。",
            "topic": "通信组"
          }
        ]
      },
      {
        "id": "distributed-2",
        "title": "Collectives 与自动求导",
        "description": "把 all-reduce、all-gather、reduce-scatter 和 all-to-all 与数据布局对应起来。",
        "duration": 30,
        "difficulty": "高阶",
        "objectives": [
          "解释常见 collective 的输入输出关系",
          "识别操作顺序、shape 和异步依赖要求",
          "区分通信操作与支持自动求导的通信路径"
        ],
        "sections": [
          {
            "heading": "根据布局选择通信原语",
            "body": "all_reduce 对组内同位置元素进行归约，并把结果送到所有成员；常见 SUM 用于梯度或统计量求和。all_gather 把每个成员持有的分片收集到所有成员。reduce_scatter 先归约，再把不同结果片段分发给不同成员，常用于分片梯度。all_to_all 则让每个成员给每个其他成员发送指定片段，适合数据重新分布。\n\n这些名字描述通信语义，不直接说明模型并行方案。选择操作前，先标记每个 rank 当前持有哪些轴、目标布局是什么、是否需要求和。例如张量切分后的局部结果可能需要求和，也可能需要拼接，使用错原语会得到 shape 合法但数值错误的结果。"
          },
          {
            "heading": "所有成员必须遵守同一个协议",
            "body": "同一通信组中的进程需要以一致顺序调用匹配 collective，输入设备、dtype、shape 或分片大小须满足对应接口约束。一个 rank 做 all_reduce、另一个做 all_gather，不会自动根据数据含义配对。只有 rank 0 进入 collective 而其他成员跳过，也会导致等待或报错。\n\n下面示例先归约标量，再收集各 rank 的标量，全部进程按相同顺序执行。异步调用可返回 Work 对象，为重叠计算提供机会；消费结果前必须正确建立完成依赖，尤其要考虑 CUDA 流。async_op=True 不意味着可以立即读取结果，也不意味着任何后续工作都会自然与通信重叠。",
            "code": "# 保存为 collectives.py；CPU 两进程运行：\n# torchrun --standalone --nproc_per_node=2 collectives.py\nimport torch\nimport torch.distributed as dist\ndist.init_process_group('gloo')\ntry:\n    rank, world = dist.get_rank(), dist.get_world_size()\n    local = torch.tensor([float(rank + 1)])\n    total = local.clone()\n    work = dist.all_reduce(total, op=dist.ReduceOp.SUM, async_op=True)\n    # 此处可以做不依赖 total 的计算。\n    work.wait()\n    gathered = [torch.empty_like(local) for _ in range(world)]\n    dist.all_gather(gathered, local)\n    assert total.item() == world * (world + 1) / 2\n    if rank == 0:\n        print('sum:', total.item(), 'shards:', torch.cat(gathered))\nfinally:\n    dist.destroy_process_group()",
            "language": "python"
          },
          {
            "heading": "通信可见不等于梯度可追踪",
            "body": "普通 torch.distributed imperative 通信接口不能一概当作支持 autograd 的张量函数。把 requires_grad=True 的张量原地 all_reduce，不能据此推断跨 rank 的梯度依赖自动正确建立；有些路径可能给出警告、缺少反向定义或产生不符合预期的结果。需要使用文档明确支持自动求导的封装、分布式张量抽象或自行定义并验证反向。\n\n从数学上看，all_gather 将输入复制到多个输出使用位置，其反向需要把来自所有使用位置的梯度累加并返回对应分片，因此与 reduce_scatter 关系密切。SUM all_reduce 的线性映射反向仍需要相应求和。反向通信取决于前向分布式计算图，不能只在每个 rank 本地随意切一片梯度。"
          },
          {
            "heading": "从原语推导性能和正确性",
            "body": "通信时间不仅由数据字节数决定，还受到延迟、拓扑、网络带宽、协议和参与进程数量影响。许多小 collective 可能被启动延迟主导，合并 bucket 能改善效率；太大的 bucket 又可能延迟开始通信，减少与反向计算的重叠。最佳选择要通过真实模型时间线判断。\n\n验证分布式算子时，可以将小规模输入拼到单进程参考计算中，比较前向结果和反向梯度。只验证前向不够，尤其是 all_gather 后损失在多个 rank 上重复计算时，梯度倍数容易出错。先明确全局目标由哪些样本构成、每个样本在哪些 rank 使用，再推导通信与归一化，能避免多数隐蔽缩放错误。"
          }
        ],
        "takeaways": [
          "all_reduce 是归约，all_gather 是收集，reduce_scatter 是归约后分片。",
          "collective 需要所有成员以一致协议参与，异步结果必须建立完成依赖。",
          "普通通信调用不自动保证跨 rank autograd 正确；前向和反向都要验证。"
        ],
        "references": [
          {
            "label": "PyTorch：Distributed collectives",
            "url": "https://docs.pytorch.org/docs/stable/distributed.html"
          },
          {
            "label": "PyTorch：DTensor",
            "url": "https://docs.pytorch.org/docs/stable/distributed.tensor.html"
          }
        ],
        "quiz": [
          {
            "id": "distributed-2-q1",
            "type": "single",
            "prompt": "希望所有 rank 都获得各 rank 标量的总和，应使用什么？",
            "options": [
              "all_gather 后不处理",
              "all_reduce(SUM)",
              "只在 rank 0 相加本地值",
              "广播任意一个 rank 的值"
            ],
            "answer": 1,
            "explanation": "all_reduce(SUM) 对对应元素求和并使所有成员得到结果；all_gather 只收集，不自动求和。",
            "topic": "Collectives"
          },
          {
            "id": "distributed-2-q2",
            "type": "single",
            "prompt": "async_op=True 后，马上读取并依赖归约结果总是安全吗？",
            "options": [
              "是，异步仅影响日志",
              "否，需要根据后端和设备建立完成依赖",
              "是，Python 自动 await",
              "只要张量小就安全"
            ],
            "answer": 1,
            "explanation": "异步操作返回时通信可能尚未完成。需使用 Work.wait 等正确同步方式，并处理设备流依赖。",
            "topic": "异步通信"
          },
          {
            "id": "distributed-2-q3",
            "type": "single",
            "prompt": "对 requires_grad=True 张量调用普通 dist.all_gather，能否直接认定跨 rank 反向正确？",
            "options": [
              "可以，所有通信自动有 autograd",
              "不可以，需要明确支持 autograd 的路径并验证反向",
              "只有 rank 0 需要梯度",
              "前向 shape 对了就可以"
            ],
            "answer": 1,
            "explanation": "imperative 通信 API 不能笼统视作可微函数；跨 rank 梯度必须由支持的机制定义，且需要检查复制和求和带来的倍数。",
            "topic": "分布式自动求导"
          }
        ]
      },
      {
        "id": "distributed-3",
        "title": "DDP、no_sync 与 Token 归一化",
        "description": "推导分布式梯度平均，让变长序列和梯度累积对应正确的全局目标。",
        "duration": 35,
        "difficulty": "高阶",
        "objectives": [
          "解释 DDP 默认梯度平均与 bucket 同步",
          "正确使用 no_sync 包住前向和反向",
          "推导不同 rank token 数下的精确缩放系数"
        ],
        "sections": [
          {
            "heading": "先分清数据并行的责任边界",
            "body": "DistributedDataParallel 让多个进程各持有一个模型副本，对各自数据执行前向和反向，并同步对应参数的梯度。默认归约效果是对数据并行组内梯度取平均。每个 rank 仍然拥有自己的优化器并执行更新；在起始参数、梯度与更新规则一致时，各副本能保持一致。\n\nDDP 不负责自动切分输入，也不自动把你打印的本地 loss 变成全局指标。数据通常由 DistributedSampler 或其他分片管线分配；日志还需要单独汇总损失总和与有效计数。BatchNorm 的批统计、模型 buffer 同步和参数梯度平均也不是同一机制，不能用一句“DDP 会同步”替代具体接口说明。\n\n下面用 W 表示当前数据并行组大小，不是包含张量并行或流水线并行的全部进程数。推导假设采用默认平均语义、固定参与成员和一致的更新窗口。自定义 communication hook、join 的除数选项或其他分片包装器可能改变归约方式，需要重新核对缩放系数。",
            "figure": {
              "type": "table",
              "caption": "同一训练步骤中，哪些工作由谁完成。",
              "columns": [
                "环节",
                "负责方",
                "DDP 不自动保证的内容"
              ],
              "rows": [
                [
                  "数据分片",
                  "Sampler / 数据管线",
                  "独立样本与相同步数"
                ],
                [
                  "本地前向",
                  "每个 rank 的模型",
                  "全局 loss 指标"
                ],
                [
                  "参数梯度归约",
                  "DDP reducer",
                  "任务特定的 token 分母"
                ],
                [
                  "参数更新",
                  "各 rank 的 optimizer",
                  "不同超参数仍得到相同轨迹"
                ],
                [
                  "报告指标",
                  "显式统计归约",
                  "本地均值能代表全局均值"
                ]
              ]
            }
          },
          {
            "heading": "局部均值的平均，为什么可能优化了另一个目标",
            "body": "设 rank r 在整个更新窗口内有 nᵣ 个有效 token，未归约损失总和为 Sᵣ(θ)。若任务要求所有有效 token 等权，目标应是所有损失总和除以全部有效 token 数 N。只有各 rank 的有效计数相同，平均各自局部均值才与全局 token 均值等价。\n\n看一个可手算例子：rank 0 有两个 token，总损失为 2θ²；rank 1 有六个 token，总损失为 18θ²。在 θ=1 时，本地平均 loss 分别是 1 和 3，平均后是 2；真正的全局均值是 20/8=2.5。更重要的是梯度也不同：错误目标的梯度为 4θ，正确目标为 5θ。所有 rank 最终拿到相同梯度，也可能共同拿到了错误的倍数或权重。\n\n这里把损失写成 θ 的函数，是为了区分“示例数值”和“可求导目标”。不能对常数 0.5、4.5 直接写梯度，再声称完成了反向推导。训练关注的是参数变化时目标如何变化。",
            "formula": "L(\\theta)=\\frac{\\sum_r S_r(\\theta)}{\\sum_r n_r},\\qquad L_{\\mathrm{local}}(\\theta)=\\frac1W\\sum_r\\frac{S_r(\\theta)}{n_r}",
            "figure": {
              "type": "table",
              "caption": "θ=1 时的数值与梯度：计数不同使局部均值等权产生偏差。",
              "columns": [
                "量",
                "rank 0",
                "rank 1",
                "全局结果"
              ],
              "rows": [
                [
                  "有效 token 数",
                  "2",
                  "6",
                  "N=8"
                ],
                [
                  "损失总和 Sᵣ",
                  "2",
                  "18",
                  "20"
                ],
                [
                  "局部平均 loss",
                  "1",
                  "3",
                  "均值的均值=2"
                ],
                [
                  "∂Sᵣ/∂θ",
                  "4",
                  "36",
                  "正确梯度=(4+36)/8=5"
                ]
              ]
            },
            "code": "import torch\ntheta = torch.tensor(1., requires_grad=True)\ns0, s1 = 2 * theta.square(), 18 * theta.square()\nwrong = (s0 / 2 + s1 / 6) / 2\ncorrect = (s0 + s1) / 8\n(g_wrong,) = torch.autograd.grad(wrong, theta, retain_graph=True)\n(g_correct,) = torch.autograd.grad(correct, theta)\nassert wrong.item() == 2 and correct.item() == 2.5\nassert g_wrong.item() == 4 and g_correct.item() == 5\nprint(\"local-mean average:\", wrong.item(), \"gradient:\", g_wrong.item())\nprint(\"global token mean:\", correct.item(), \"gradient:\", g_correct.item())",
            "language": "python"
          },
          {
            "heading": "推导 W/N：抵消 DDP 自带的平均",
            "body": "DDP 默认将各 rank 提交的参数梯度求和后除以 W。我们希望最终得到 (Σ∇Sᵣ)/N，因此让每个 rank 对本地损失总和乘上 W/N 再 backward。DDP 随后除以 W，两个系数抵消，恰好得到全局 token 均值的梯度。若仅乘 1/N，最终会额外小 W 倍；若先除本地 nᵣ，则不同 token 的权重不再相同。\n\nN 由固定 labels 或 mask 的有效计数得到，不参与参数求导。每个 rank 先统计本地整个窗口的有效数，再在同一个数据并行组中 all_reduce(SUM)。这一统计不需要保留模型前向图，可以在计算 loss 前完成。所有成员必须参与这个计数归约，不能只在 rank 0 计算后让其他进程猜测。\n\n缩放公式针对未归约 token 损失总和。如果使用类别权重、每序列等权或额外正则项，目标的分母和系数可能不同。尤其全局正则 R(θ) 若每 rank 都重复计算，默认 DDP 平均已经会保留一份它的梯度，不应无差别再乘 token 系数。",
            "formula": "\\widetilde L_r=\\frac WN S_r,\\qquad \\frac1W\\sum_r\\nabla_\\theta\\widetilde L_r=\\frac1N\\sum_r\\nabla_\\theta S_r=\\nabla_\\theta L",
            "bodyAfter": "训练反向使用的局部缩放 loss 不是全局可直接报告的指标。日志应归约 detached 的 Sᵣ 与 nᵣ，最后以总和相除。"
          },
          {
            "heading": "累积窗口与 no_sync：同步的是所有已积累的梯度",
            "body": "显存不足时，一次参数更新可以拆成 K 个 microbatch。设 Sᵣ是本 rank 在这 K 次前向中的损失总和，N 是所有 rank、所有 microbatch 的有效 token 总数。每个 microbatch 都用同一个 W/N 系数反向即可，不要再额外除以 K，否则会重复缩放。窗口开始清梯度，窗口结束才裁剪和更新参数。\n\n前 K−1 个 microbatch 可放在 ddp.no_sync() 中，先只累积本地梯度；最后一个 microbatch 使用正常 DDP 前向与反向，触发对累计梯度的同步。no_sync 必须覆盖前向和对应 backward，因为 DDP 在前向也会准备同步状态。仅在 backward 外套上下文不满足接口要求。\n\n各 rank 要使用一致的同步边界与相容的调用顺序。正常反向会释放该 microbatch 的保存激活，无需 retain_graph=True。AMP 情况下还必须保持整个窗口同一个缩放系数，并在窗口末尾 unscale 后再裁剪；scheduler 若按更新计步，也应与真正参数更新对齐。",
            "figure": {
              "type": "table",
              "caption": "一次包含 K 个 microbatch 的更新窗口。",
              "columns": [
                "阶段",
                "梯度行为",
                "通信/更新"
              ],
              "rows": [
                [
                  "窗口开始",
                  "zero_grad；统计全部有效计数",
                  "all_reduce 计数得到 N"
                ],
                [
                  "microbatch 0..K−2",
                  "loss_sum × W/N 后反向",
                  "no_sync 同时覆盖前向/反向"
                ],
                [
                  "microbatch K−1",
                  "继续累积本窗口梯度",
                  "正常 DDP，同步累计结果"
                ],
                [
                  "窗口末尾",
                  "必要时 unscale / clip",
                  "optimizer.step；按约定推进 scheduler"
                ]
              ]
            }
          },
          {
            "heading": "零有效 token 与不等长循环不能随意跳过",
            "body": "某 rank 的本地计数为零、但全局 N>0 时，该 rank 仍要参加与其他成员匹配的前向、反向和通信。对全为 ignore_index 的分类目标，reduction='sum' 可以产生有图的零损失与零梯度；reduction='mean' 则可能因分母为零得到 NaN。不能因为本地“没有有效样本”就直接 continue，导致其他 rank 永远等不到它的 collective。\n\n若全局 N=0，所有 rank 从同一次计数归约得到相同结论，可以一致跳过本次更新。零梯度更新与跳过更新不是同一语义：AdamW 的状态、动量或权重衰减仍可能发生变化，因此是否 step 必须明确定义。零计数也不代表模型输入一定安全；输入形状和数值仍须满足前向契约。\n\n如果不同 rank 的 microbatch 数量不同，问题已经不只是 loss 分母。同步序列可能失配，需要设计均衡采样、显式空批次协议或受支持的 join 方案，并核对其梯度除数。新增 barrier 无法修复某个成员永远不会到达的通信。",
            "code": "import torch\nfrom torch import nn\nimport torch.nn.functional as F\nmodel = nn.Linear(3, 2)\nx = torch.randn(4, 3)\nlabels = torch.full((4,), -100, dtype=torch.long)\nloss_sum = F.cross_entropy(model(x), labels, ignore_index=-100, reduction=\"sum\")\nloss_sum.backward()\nassert loss_sum.item() == 0\nassert all(p.grad is not None and p.grad.eq(0).all() for p in model.parameters())\nprint(\"all ignored: finite zero loss and zero gradients\")",
            "language": "python",
            "callout": "这里展示单机的零损失机制。分布式程序仍必须让全部成员执行一致的通信协议；本地零计数并不构成单独退出的理由。"
          },
          {
            "heading": "完整两进程示例：同时验证同步与目标梯度",
            "body": "下面脚本只需要 CPU/Gloo。保存为 ddp_tokens.py，使用 torchrun --standalone --nproc-per-node=2 ddp_tokens.py 启动。两个 rank 使用不同随机数据，分别在两个 microbatch 中保留 1/2 和 3/4 个有效 token，因此窗口全局 N=10。模型初始化由 DDP 对齐，数据则使用各自独立的确定性 Generator。\n\n脚本使用一次 no_sync 和一次正常同步，然后在每个 rank 额外构造同一份单进程参考：拼接全部数据，计算真正的全局 token 均值并反向。逐参数比较 DDP 梯度与参考，随后执行相同 SGD 更新并再次比较参数。这个参考只适合教学的小模型；真实大训练不能为了验证每步都复制全部数据。\n\n示例还把本地 detached 损失总和单独归约，验证报告的全局 loss 与参考一致。它没有把 W/N 缩放后的局部数值直接当作日志，也没有仅凭两个 rank 参数一致就声称归一化正确。",
            "code": "# 保存为 ddp_tokens.py；启动：\n# torchrun --standalone --nproc-per-node=2 ddp_tokens.py\nimport copy\nfrom contextlib import nullcontext\nfrom datetime import timedelta\nimport torch\nimport torch.distributed as dist\nimport torch.nn.functional as F\nfrom torch import nn\nfrom torch.nn.parallel import DistributedDataParallel as DDP\n\ntorch.set_num_threads(1)\ndist.init_process_group(\"gloo\", timeout=timedelta(seconds=60))\ntry:\n    rank, world = dist.get_rank(), dist.get_world_size()\n    assert world == 2, \"this teaching example requires two ranks\"\n    torch.manual_seed(11)\n    ddp = DDP(nn.Linear(3, 2, dtype=torch.float64))\n    reference = copy.deepcopy(ddp.module)\n    opt = torch.optim.SGD(ddp.parameters(), lr=0.05)\n    reference_opt = torch.optim.SGD(reference.parameters(), lr=0.05)\n\n    def make_window(r):\n        counts = [[1, 2], [3, 4]][r]\n        batches = []\n        generator = torch.Generator().manual_seed(100 + r)\n        for count in counts:\n            x = torch.randn(4, 3, generator=generator, dtype=torch.float64)\n            y = torch.tensor([0, 1, 0, 1])\n            y[count:] = -100\n            batches.append((x, y))\n        return batches\n\n    window = make_window(rank)\n    total = torch.tensor(sum(int(y.ne(-100).sum()) for _, y in window))\n    dist.all_reduce(total, op=dist.ReduceOp.SUM)\n    assert total.item() == 10\n    opt.zero_grad(set_to_none=True)\n    local_report = torch.zeros((), dtype=torch.float64)\n    for i, (x, y) in enumerate(window):\n        context = ddp.no_sync() if i < len(window) - 1 else nullcontext()\n        with context:\n            loss_sum = F.cross_entropy(ddp(x), y, ignore_index=-100, reduction=\"sum\")\n            local_report += loss_sum.detach()\n            (loss_sum * world / total.item()).backward()\n\n    global_batches = make_window(0) + make_window(1)\n    all_x = torch.cat([x for x, _ in global_batches])\n    all_y = torch.cat([y for _, y in global_batches])\n    reference_loss = F.cross_entropy(reference(all_x), all_y, ignore_index=-100)\n    reference_loss.backward()\n    for actual, expected in zip(ddp.module.parameters(), reference.parameters()):\n        torch.testing.assert_close(actual.grad, expected.grad, rtol=1e-9, atol=1e-10)\n\n    dist.all_reduce(local_report, op=dist.ReduceOp.SUM)\n    torch.testing.assert_close(local_report / total, reference_loss.detach())\n    opt.step()\n    reference_opt.step()\n    for actual, expected in zip(ddp.module.parameters(), reference.parameters()):\n        torch.testing.assert_close(actual, expected, rtol=1e-9, atol=1e-10)\n    if rank == 0:\n        print(\"N=10; global loss, gradients and SGD update: PASS\")\nfinally:\n    dist.destroy_process_group()",
            "language": "python"
          },
          {
            "heading": "验收与迁移：始终先写全局目标，再决定通信系数",
            "body": "把此模式迁移到实际训练时，先写出优化目标：每 token 等权、每序列等权，还是带样本权重的平均。然后明确每条数据在哪些 rank 被计算、是否重复、在哪个维度分片，最后才推导归约与缩放。数据并行组大小、累积窗口与有效计数缺一不可；变量名叫 global_batch 并不能代替这一步分析。\n\n验证至少包含四种输入：所有 rank 计数相等、计数不同、某 rank 为零、全局为零。对非零情况比较与单进程参考的梯度；对全局零情况确认所有 rank 一致跳过。关闭随机层或控制随机状态，使用合理容差，再逐步恢复 AMP、梯度裁剪和真实模型。否则多个变化混在一起，很难分辨数值差异来自何处。\n\n运行日志应区分 microstep、optimizer update、全局有效 token 数、真实全局 loss 与梯度范数。发生卡住时，查看所有 rank 最早的异常与通信阶段；发生收敛差异时，优先检查样本权重和分母，而不是只调整学习率来掩盖倍数错误。",
            "figure": {
              "type": "table",
              "caption": "验证矩阵：一致性与正确目标需要分别证明。",
              "columns": [
                "测试输入",
                "检查",
                "可能暴露的问题"
              ],
              "rows": [
                [
                  "各 rank 计数相等",
                  "DDP 与参考梯度",
                  "基础通信或更新错误"
                ],
                [
                  "有效 token 数不同",
                  "真实全局均值梯度",
                  "局部均值等权错误"
                ],
                [
                  "某 rank 零 token",
                  "不挂起、梯度正确",
                  "本地跳过或 NaN"
                ],
                [
                  "全局零 token",
                  "全体一致跳过更新",
                  "除零、状态意外推进"
                ],
                [
                  "多 microbatch",
                  "一次更新对应完整窗口",
                  "重复除 K、同步边界错误"
                ]
              ]
            },
            "callout": "各 rank 的参数相等只证明副本一致，不证明优化目标正确。与明确全局目标的单进程参考比较，才验证了数学意义。"
          }
        ],
        "takeaways": [
          "默认 DDP 平均 rank 梯度，不自动实现不等长度的全局 token 平均。",
          "loss_sum 乘 DP 组大小/窗口全局 token 数，可抵消默认 DDP 平均。",
          "no_sync 覆盖前向和反向；最后一次同步处理累积梯度。"
        ],
        "references": [
          {
            "label": "PyTorch：DistributedDataParallel",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.parallel.DistributedDataParallel.html"
          },
          {
            "label": "PyTorch：DDP tutorial",
            "url": "https://docs.pytorch.org/tutorials/intermediate/ddp_tutorial.html"
          }
        ],
        "quiz": [
          {
            "id": "distributed-3-q1",
            "type": "single",
            "prompt": "DDP 默认平均两个 rank 的梯度，全局窗口 N=100。各 rank 的 loss_sum 应乘什么以得到全局 token 均值梯度？",
            "options": [
              "1/100",
              "2/100",
              "100/2",
              "各自本地 token 数"
            ],
            "answer": 1,
            "explanation": "每个 rank 乘 W/N=2/100，DDP 再除以 W，最终得到全局损失总和梯度除以 N。",
            "topic": "分布式归一化"
          },
          {
            "id": "distributed-3-q2",
            "type": "single",
            "prompt": "梯度累积时 no_sync 应覆盖什么？",
            "options": [
              "只覆盖 optimizer.step",
              "只覆盖 backward",
              "前向和对应 backward",
              "只覆盖 zero_grad"
            ],
            "answer": 2,
            "explanation": "DDP 前向也会准备同步状态，因此接口要求把前向与反向放在同一 no_sync 上下文中。",
            "topic": "DDP 累积"
          },
          {
            "id": "distributed-3-q3",
            "type": "single",
            "prompt": "所有 rank 的最终梯度完全一致，能否证明 token 归一化正确？",
            "options": [
              "能，一致即正确",
              "不能，所有 rank 可能拥有同一个缩放错误",
              "只要 world size 为 2 就能",
              "取决于日志颜色"
            ],
            "answer": 1,
            "explanation": "DDP 可让错误倍数的梯度也保持一致。应与明确全局目标的单进程参考梯度比较。",
            "topic": "梯度验证"
          }
        ]
      },
      {
        "id": "distributed-4",
        "title": "采样、检查点与死锁诊断",
        "description": "把数据分片、训练状态和一致控制流连接成可恢复的分布式训练。",
        "duration": 30,
        "difficulty": "高阶",
        "objectives": [
          "正确使用 DistributedSampler 和 set_epoch",
          "区分普通 DDP 检查点与分片状态保存",
          "从最早异常和通信序列定位分布式卡住"
        ],
        "sections": [
          {
            "heading": "采样器负责切分数据索引",
            "body": "DistributedSampler 为每个 rank 生成数据集索引分片，DDP 自身不会完成这一步。每个 epoch 开始调用 sampler.set_epoch(epoch)，让确定性的全局洗牌随 epoch 变化；只设置一次随机种子而忘记 set_epoch，可能每个 epoch 都重复同样顺序。各 rank 使用一致数据集长度和采样配置也很重要。\n\n当数据集长度不能被副本数整除时，sampler 的 drop_last=False 会补齐索引，使各 rank 数量一致，因而可能出现重复样本；drop_last=True 会截去尾部。DataLoader 的 drop_last 则控制每个 rank 本地不完整 batch，这两个参数作用层级不同，不能相互替代。"
          },
          {
            "heading": "训练均衡与评估不重复有不同目标",
            "body": "训练通常希望各 rank 有相同更新次数，减少通信步数不匹配。评估则可能要求每个样本恰好计分一次；如果直接沿用补齐的 sampler，重复样本会给总体指标带来偏差。可以选择不补齐的评估分片，或按样本身份去重，并让最终指标按真实样本数正确归约。\n\n下面用 11 个样本和两个 rank 展示补齐现象。此处各 rank 的整数索引数量相同，直接使用张量 all_gather，无需 Python 对象序列化或额外的 NumPy 依赖。实际分片若长度不同，应先交换长度，再按所选接口的大小约束收集，而不是假设所有后端都接受任意形状。若评估前向仍有同步操作，不等长度循环也要考虑所有 rank 的通信协议，不能简单让提前完成的 rank 退出所有 collective。",
            "code": "# 保存为 sampler_demo.py；CPU 两进程：\n# torchrun --standalone --nproc_per_node=2 sampler_demo.py\nimport torch\nimport torch.distributed as dist\nfrom torch.utils.data import TensorDataset, DataLoader, DistributedSampler\ndist.init_process_group('gloo')\ntry:\n    dataset = TensorDataset(torch.arange(11))\n    sampler = DistributedSampler(dataset, shuffle=True, drop_last=False, seed=17)\n    loader = DataLoader(dataset, batch_size=3, sampler=sampler, drop_last=False)\n    for epoch in range(2):\n        sampler.set_epoch(epoch)\n        seen = [int(i) for (batch,) in loader for i in batch]\n        local_indices = torch.tensor(seen, dtype=torch.long)\n        gathered = [torch.empty_like(local_indices) for _ in range(dist.get_world_size())]\n        dist.all_gather(gathered, local_indices)\n        if dist.get_rank() == 0:\n            flat = torch.cat(gathered).tolist()\n            print(epoch, [t.tolist() for t in gathered],\n                  'total=', len(flat), 'unique=', len(set(flat)))\nfinally:\n    dist.destroy_process_group()",
            "language": "python"
          },
          {
            "heading": "检查点需要知道状态在哪里",
            "body": "普通 DDP 参数在各副本上通常相同，可以由指定 rank 保存共享模型权重和一致的优化器状态，其他 rank 仍需按协议继续执行。各 rank 的随机状态、数据进度或其他本地状态可能不同，不能只保存 rank 0 的一份就宣称所有训练轨迹都可恢复。保存后读取共享文件时，应确认文件写入完成并避免并发覆盖。\n\nFSDP、张量并行或分片优化器中，状态可能分散在多 rank；相应 distributed checkpoint 接口可能要求所有成员参与，即使最终只出现少量文件。不能机械把整个保存调用包在 if rank==0 中。是否支持改变 world size 恢复、是否重分片以及保存格式，都需要核对具体接口，而不是只看文件后缀。"
          },
          {
            "heading": "死锁通常表现为协议不一致",
            "body": "卡在 all_reduce 或 barrier 的进程，不一定是最早出错的进程。其他 rank 可能先遇到数据异常、显存不足或条件分支跳过了反向。按照 rank、step、microstep 和 collective 顺序记录时间线，寻找最早偏离的位置，比只增加超时或不断添加 barrier 更有效。\n\n可启用 TORCH_DISTRIBUTED_DEBUG=DETAIL 辅助查看分布式一致性问题，NCCL 场景用 NCCL_DEBUG=INFO 辅助观察通信。先复现最小多进程例子，再加入真实数据与模型。barrier 只能等待所有成员到达，无法修复成员永远不来的错误；临时加入太多 barrier 还可能掩盖原有时序并降低吞吐。"
          }
        ],
        "takeaways": [
          "sampler.set_epoch 改变各 epoch 洗牌；sampler 和 DataLoader 的 drop_last 作用不同。",
          "补齐采样可能重复样本，评估必须按真实样本范围处理。",
          "检查点与通信都受参与组协议约束；从所有 rank 的最早异常排查卡住。"
        ],
        "references": [
          {
            "label": "PyTorch：DistributedSampler",
            "url": "https://docs.pytorch.org/docs/stable/data.html#torch.utils.data.distributed.DistributedSampler"
          },
          {
            "label": "PyTorch：Distributed checkpoint",
            "url": "https://docs.pytorch.org/docs/stable/distributed.checkpoint.html"
          },
          {
            "label": "PyTorch：Distributed debugging",
            "url": "https://docs.pytorch.org/docs/stable/distributed.html"
          }
        ],
        "quiz": [
          {
            "id": "distributed-4-q1",
            "type": "single",
            "prompt": "使用 DistributedSampler(shuffle=True)，每个 epoch 需要做什么以改变洗牌顺序？",
            "options": [
              "只调用 model.train()",
              "调用 sampler.set_epoch(epoch)",
              "重新初始化整个集群",
              "增加 DataLoader 的 batch_size"
            ],
            "answer": 1,
            "explanation": "set_epoch 将 epoch 纳入采样器的确定性洗牌状态；model.train 不控制采样顺序。",
            "topic": "分布式采样"
          },
          {
            "id": "distributed-4-q2",
            "type": "single",
            "prompt": "11 个样本、2 个副本，DistributedSampler(drop_last=False) 通常总共分配多少个索引？",
            "options": [
              "10，自动丢弃一个",
              "11，各 rank 总数不同",
              "12，补齐一个索引",
              "22，完整复制数据集"
            ],
            "answer": 2,
            "explanation": "采样器补齐到可被副本数整除的数量，各 rank 获得 6 个索引；评估要注意重复样本。",
            "topic": "评估计数"
          },
          {
            "id": "distributed-4-q3",
            "type": "single",
            "prompt": "某 rank 卡在 barrier，最合理的下一步是什么？",
            "options": [
              "持续添加更多 barrier",
              "只把超时调到无限",
              "检查所有 rank 的最早异常和是否走到相同通信阶段",
              "直接假设网络坏了"
            ],
            "answer": 2,
            "explanation": "等待者可能只是受害者，其他 rank 可能提前异常或走了不同分支。barrier 不能修复缺失参与者。",
            "topic": "死锁诊断"
          }
        ]
      }
    ]
  }
];
