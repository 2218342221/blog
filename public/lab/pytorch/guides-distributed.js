window.GUIDES_DISTRIBUTED = {
  "training-1": {
    "scenario": "你把训练从 FP32 改成 FP16，显存下降了，loss 却突然变成 inf。现在有两个候选原因：某个前向结果已经超过表示范围，或者很小的梯度在反向中丢失。两者发生在不同阶段，不能靠同一个“开启混合精度”开关一起解决。本例先定位数值问题，再手动展示梯度缩放和裁剪的顺序。",
    "prerequisites": [
      "tensor-3",
      "autograd-2",
      "nn-3"
    ],
    "terms": [
      {
        "name": "表示范围",
        "meaning": "格式能容纳的最大、最小量级；超出上限会得到无穷，增加尾数精度不能扩大指数范围。"
      },
      {
        "name": "缩放梯度",
        "meaning": "把损失乘常数后，链式法则让全部梯度也乘同一常数；更新前需要还原。"
      },
      {
        "name": "梯度范数",
        "meaning": "多个参数梯度共同构成向量，其长度用于整体裁剪；不是分别把每个元素截断。"
      }
    ],
    "observe": "切换本课图解的 FP16、BF16、FP32，比较最大有限正数和 1 附近的间距；再步进阅读 GradScaler 的作用。位数图解释格式，本例解释为什么稳定公式和还原梯度仍不可省。",
    "walkthrough": {
      "title": "先找前向溢出，再沿缩放梯度走到一次更新",
      "intro": "全部在 CPU 上运行。这里手动乘除缩放系数，是为了观察数学过程，不是 CPU GradScaler 或完整 AMP 的替代实现。最后比较同一梯度在正确、错误裁剪顺序下的实际大小。",
      "code": "import torch\ntorch.set_num_threads(1)\nx = torch.tensor([60000., 60000.], dtype=torch.float16)\nprint(f'fp16_sum_is_inf={bool(x.sum().isinf())}')\nprint(f'fp32_sum={x.sum(dtype=torch.float32).item():.0f}')\nlogits = torch.tensor([[1000., 999., 998.]], dtype=torch.float64)\nnaive = logits.exp().sum().log()\nloss = torch.nn.functional.cross_entropy(logits, torch.tensor([0]))\nprint(f'naive_logsumexp_is_inf={bool(naive.isinf())}')\nprint(f'stable_cross_entropy={loss.item():.6f}')\nw = torch.nn.Parameter(torch.tensor(2., dtype=torch.float64))\noptimizer = torch.optim.SGD([w], lr=0.1)\nscale = 128.\noptimizer.zero_grad(set_to_none=True)\n(((w - 5) ** 2) * scale).backward()\nprint(f'scaled_grad={w.grad.item():.0f}')\nw.grad.div_(scale)\nprint(f'unscaled_grad={w.grad.item():.0f}')\nnorm = torch.nn.utils.clip_grad_norm_([w], max_norm=1.)\noptimizer.step()\nprint(f'norm_before_clip={norm.item():.0f}; updated_w={w.item():.6f}')\nscaled_grad = torch.tensor(-768., dtype=torch.float64)\nwrong_final_grad = scaled_grad.clamp(-1., 1.) / scale\nprint(f'wrong_clip_then_unscale={wrong_final_grad.item():.8f}')\nassert abs(w.item() - 2.1) < 1e-6\nassert wrong_final_grad.abs().item() == 1 / 128\n",
      "output": "fp16_sum_is_inf=True\nfp32_sum=120000\nnaive_logsumexp_is_inf=True\nstable_cross_entropy=0.407606\nscaled_grad=-768\nunscaled_grad=-6\nnorm_before_clip=6; updated_w=2.100000\nwrong_clip_then_unscale=-0.00781250\n",
      "steps": [
        {
          "title": "归约输出也要装得下",
          "lines": [
            1,
            5
          ],
          "explanation": "两个输入都小于 FP16 上限，因此创建张量没有出错；但它们的和是十二万，结果无法保存在 FP16。即使某个内核内部以更高精度累加，最后写回低精度仍会溢出。指定归约输出为 FP32 后，结果才完整保留下来。若先得到 inf 再调用 float，转换只会把无穷搬到更宽的格式，已经丢失的值不能回来。这个例子让你把“输入有限”与“运算结果有限”分开检查。",
          "state": "x 的两个元素有限；FP16 结果为 inf，FP32 结果为 120000。"
        },
        {
          "title": "稳定公式改变计算路径",
          "lines": [
            6,
            10
          ],
          "explanation": "双精度也会在直接计算 exp(1000) 时溢出，说明问题不只是选错 dtype。减去行最大值后，三个指数的输入变成零、负一、负二，指数和有限；交叉熵内部采用稳定的等价计算。目标类别是最大 logit，所以损失约零点四零七六，而不是无穷。损失函数接收 logits，可以在内部一起处理对数与归一化；先在外部做 softmax 会改变传入函数的对象。",
          "state": "原始指数路径为 inf；稳定交叉熵为 0.407606。"
        },
        {
          "title": "缩放后先恢复真实梯度",
          "lines": [
            11,
            21
          ],
          "explanation": "原目标是平方误差，w 为二时导数是负六。乘一百二十八后，反向得到负七百六十八，这个数适合观察，但不是优化器该接收的真实尺度。除回系数后再按范数一裁剪，方向仍为负，长度变成约一；学习率零点一于是让参数增加约零点一。裁剪函数为数值稳定加了极小量，因此内部值不必逐位等于负一，输出按六位小数展示。",
          "state": "梯度经历 -768 → -6 → 约 -1，参数由 2 更新到约 2.1。"
        },
        {
          "title": "错误顺序改变了有效阈值",
          "lines": [
            22,
            26
          ],
          "explanation": "这里用单参数的截断模拟“先限制缩放梯度，再还原”。负七百六十八先变成负一，再除以一百二十八，只剩负零点零零七八。你以为设置的裁剪阈值是一，实际允许的真实梯度上限却只有一百二十八分之一。多参数范数裁剪有同样的尺度问题。实际 AMP 中应交给 scaler.unscale_ 还原，并仅在累积窗口末尾进行裁剪、step 和 update；前向溢出依然需要单独排查。",
          "state": "错误顺序使真实阈值缩小 128 倍，更新幅度随之显著缩小。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "出现 inf 就加大 GradScaler 系数",
        "why": "缩放器放大的是反向使用的 loss，不能恢复已经溢出的前向值；更大的系数还可能加重溢出。",
        "fix": "先确定第一个非有限张量的位置，检查稳定公式与归约输出类型，再处理梯度缩放。"
      },
      {
        "wrong": "BF16 范围大，所以所有状态都改成 BF16",
        "why": "范围与有效精度不同；参数、优化器统计、缓存和算子计算各有精度需求。",
        "fix": "分别记录每类状态的 dtype，以小规模 FP32 基线比较损失和梯度。"
      }
    ],
    "check": {
      "prompt": "若 loss 缩放 64 倍，先把缩放后的梯度裁剪到范数 2，再还原，真实有效阈值是多少？",
      "hint": "裁剪完的梯度还要除以缩放系数。",
      "answer": "是 2/64=0.03125。想让真实阈值为 2，应先 unscale，再按 2 裁剪。"
    },
    "transfer": "迁移到训练循环时，给前向、loss、反向、还原梯度、裁剪和更新各标一个边界。异常发生在哪个边界，就检查进入该边界的值及 dtype；不要仅凭最终 NaN 推断全部计算都需要更高精度。"
  },
  "training-2": {
    "scenario": "两条训练样本长度相差很大，你为了节省显存把它们拆成两个微批。两个微批都使用 mean loss，代码也把 loss 除以二，可是结果和拼成一个大批不同。问题在于平均值隐藏了各自的分母。本例从一个标量参数出发，把每个微批贡献的梯度都打印出来。",
    "prerequisites": [
      "autograd-2",
      "nn-3"
    ],
    "terms": [
      {
        "name": "微批",
        "meaning": "同一次参数更新中的一小块数据，前向和反向可以分次进行，优化器仍只更新一次。"
      },
      {
        "name": "有效 token",
        "meaning": "真正纳入训练目标的位置；padding 或被任务排除的位置不计入分母。"
      },
      {
        "name": "损失总和",
        "meaning": "先不取平均的可加目标，便于在不同长度、设备和累积窗口之间正确合并。"
      }
    ],
    "observe": "在图解中切到“不等 token 数”，看两个微批的权重由各一半变成 2/8 与 6/8。本例使用 1/4 与 3/4，数值不同但分母原则完全相同；步进比较总体均值与均值的均值。",
    "walkthrough": {
      "title": "从 -0.5 到 -5：看清两个微批怎样贡献同一更新",
      "intro": "把预测简化成一个共享参数 w。目标值分别是单元素 [1] 和三元素 [2,3,4]。使用平方误差，所有导数都可以手算；模型没有 Dropout 或 BatchNorm，因此能够隔离归一化这一因素。",
      "code": "import torch\ntorch.set_num_threads(1)\ntargets = [torch.tensor([1.], dtype=torch.float64),\n           torch.tensor([2., 3., 4.], dtype=torch.float64)]\ntotal_tokens = sum(t.numel() for t in targets)\nprint(f'counts={[t.numel() for t in targets]}; total={total_tokens}')\nw = torch.nn.Parameter(torch.tensor(0., dtype=torch.float64))\noptimizer = torch.optim.SGD([w], lr=0.1)\noptimizer.zero_grad(set_to_none=True)\nfor i, target in enumerate(targets, 1):\n    loss_sum = (w - target).square().sum()\n    (loss_sum / total_tokens).backward()\n    print(f'after_micro_{i}: grad={w.grad.item():.1f}')\noptimizer.step()\nprint(f'one_update_w={w.item():.1f}')\nreference = torch.tensor(0., dtype=torch.float64, requires_grad=True)\nfull_target = torch.cat(targets)\n(reference - full_target).square().mean().backward()\nprint(f'full_batch_grad={reference.grad.item():.1f}')\ntorch.testing.assert_close(w.grad, reference.grad)\nwrong = torch.tensor(0., dtype=torch.float64, requires_grad=True)\nfor target in targets:\n    ((wrong - target).square().mean() / len(targets)).backward()\nprint(f'mean_of_means_grad={wrong.grad.item():.1f}')\nassert wrong.grad.item() == -4.\nassert w.grad.item() == -5.\n",
      "output": "counts=[1, 3]; total=4\nafter_micro_1: grad=-0.5\nafter_micro_2: grad=-5.0\none_update_w=0.5\nfull_batch_grad=-5.0\nmean_of_means_grad=-4.0\n",
      "steps": [
        {
          "title": "先明确整个窗口的目标",
          "lines": [
            1,
            6
          ],
          "explanation": "一次更新对应四个有效目标，因此总体损失是四项平方误差之和除以四。这个分母在整个窗口里固定，不随当前微批的长度变化。可以先从标签或 mask 得到计数，不需要先运行全部前向，更不需要保存全部计算图。若尾部窗口少于预设累积步数，也应按它实际覆盖的数据计数；否则尾部更新会被人为缩小。这里所有目标都有效，所以 numel 就等于有效计数。",
          "state": "全局窗口有 4 个有效元素，两个微批权重分别为 1/4 和 3/4。"
        },
        {
          "title": "反向完成后梯度留在叶子上",
          "lines": [
            7,
            15
          ],
          "explanation": "第一个目标为一，w 为零时平方误差导数是负二，除以四贡献负零点五。第二个微批的三个导数为负四、负六、负八，总和负十八，除以四贡献负四点五。backward 把新贡献加到已有梯度，最终为负五。两个微批之间没有 step，因此前向都使用同一个 w=0；最后一次 SGD 更新才把参数变成零点五。若中间更新过参数，第二个微批的导数就已属于另一个位置。",
          "state": "第一个微批后 grad=-0.5；第二个后 grad=-5；唯一一次更新得到 w=0.5。"
        },
        {
          "title": "与真正的大批目标对照",
          "lines": [
            16,
            20
          ],
          "explanation": "参考路径直接拼接全部四个目标，平均损失的导数为负二乘以目标均值。目标均值是二点五，所以导数为负五。比较的是更新前梯度，避免优化器状态或多次更新混入结论。断言验证分块执行保留了同一目标。真实模型有随机层或批统计时，前向行为本身可能改变，即使归一化正确也未必逐位相同；那需要另外控制随机性与批依赖操作。",
          "state": "参考大批梯度与累积梯度相同，均为 -5。"
        },
        {
          "title": "把错误的权重显式算出来",
          "lines": [
            21,
            26
          ],
          "explanation": "错误路径把第一批的均值导数负二和第二批的均值导数负六各乘二分之一，结果是负四。单个短样本占了整个目标一半，长微批的三个样本合计也只占一半。它并非一个近似相同的计算，而是定义了不同的优化目标。只看 loss 大致下降无法识别这种改变；最有力的验收是用不等长度的固定小数据，比较明确参考目标的梯度。",
          "state": "均值的均值产生 -4，和真正 token 平均的 -5 不一致。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "每个微批都 zero_grad，再最后 step",
        "why": "清零会抹掉之前微批的贡献，最终只有最后一批参与更新。",
        "fix": "在窗口开始清零，在窗口内部只反向，结束时统一裁剪和更新。"
      },
      {
        "wrong": "所有 loss 都除以配置中的累积次数",
        "why": "只有每个微批的分母相同且窗口完整时才等价；可变长度与尾部窗口会打破条件。",
        "fix": "使用窗口实际 loss sum 与有效计数，先写出目标函数再决定缩放。"
      }
    ],
    "check": {
      "prompt": "把四个目标改成 [1,2] 与 [3,4]，均值的均值是否仍有偏差？",
      "hint": "两批各自的分母是否相同？",
      "answer": "此时两批都含两个元素，各占一半等于每个元素占四分之一，两种归约一致；它不能证明不等长度情形也正确。"
    },
    "transfer": "阅读多层 batch 循环时，把“何时算 loss”“何时 backward”“何时 step”分开标记，再列出每层的分母。分布式还会引入通信组默认平均，需要在相同全局目标上再推导一层系数。"
  },
  "training-3": {
    "scenario": "训练中断后，你加载了权重，下一步 loss 却与未中断的实验分开了。文件没有损坏，前向也一致，原因可能是优化器的历史被清空。本例让历史梯度先为正、再为负，观察 AdamW 的动量如何使完整恢复与“只加载权重”得到不同下一步。",
    "prerequisites": [
      "nn-1",
      "nn-4",
      "autograd-2"
    ],
    "terms": [
      {
        "name": "一阶矩",
        "meaning": "过去梯度的指数加权统计，反映更新方向的历史，不等同于当前梯度。"
      },
      {
        "name": "二阶矩",
        "meaning": "过去梯度平方的指数加权统计，用于调节更新尺度；不是梯度本身的方差。"
      },
      {
        "name": "更新步数",
        "meaning": "参与偏差修正与学习率调度的计数，必须与优化器实际更新保持约定一致。"
      }
    ],
    "observe": "沿图解从参数 θ 步进到动量、下一步更新和 Checkpoint。注意图中 θ 与 m/v 是不同状态：本例三条路径在恢复点有相同 θ，但只有两条保留相同历史。",
    "walkthrough": {
      "title": "相同权重 0.9，为什么下一步会走向不同位置",
      "intro": "使用 CPU double、固定手工梯度，并把 AdamW 的两个 beta 都设成 0.5，方便核算。权重衰减和 epsilon 设零，仅用于非零二阶矩的教学例子；不要据此复制生产超参数。检查点保存在内存字节流中。",
      "code": "import io\nimport torch\ntorch.set_num_threads(1)\ndef make():\n    w = torch.nn.Parameter(torch.tensor(1., dtype=torch.float64))\n    opt = torch.optim.AdamW([w], lr=0.1, betas=(0.5, 0.5), eps=0., weight_decay=0.)\n    sched = torch.optim.lr_scheduler.StepLR(opt, step_size=2, gamma=0.5)\n    return w, opt, sched\ndef update(w, opt, sched, gradient):\n    w.grad = torch.tensor(gradient, dtype=torch.float64)\n    opt.step()\n    sched.step()\nw, opt, sched = make()\nupdate(w, opt, sched, 1.)\nprint(f'after_first_w={w.item():.6f}')\nprint(f'm={opt.state[w][\"exp_avg\"].item():.2f}; v={opt.state[w][\"exp_avg_sq\"].item():.2f}')\nbuffer = io.BytesIO()\ntorch.save({'weight': w.detach().clone(), 'optimizer': opt.state_dict(),\n            'scheduler': sched.state_dict(), 'rng': torch.get_rng_state()}, buffer)\nupdate(w, opt, sched, -1.)\nprint(f'uninterrupted_w={w.item():.6f}; next_lr={opt.param_groups[0][\"lr\"]:.2f}')\nbuffer.seek(0)\nsaved = torch.load(buffer, weights_only=True)\nrw, ropt, rsched = make()\nwith torch.no_grad():\n    rw.copy_(saved['weight'])\nrsched.load_state_dict(saved['scheduler'])\nropt.load_state_dict(saved['optimizer'])\ntorch.set_rng_state(saved['rng'])\nupdate(rw, ropt, rsched, -1.)\nprint(f'fully_restored_w={rw.item():.6f}; next_lr={ropt.param_groups[0][\"lr\"]:.2f}')\ntorch.testing.assert_close(rw, w, rtol=0, atol=0)\nfw, fopt, fsched = make()\nwith torch.no_grad():\n    fw.copy_(saved['weight'])\nupdate(fw, fopt, fsched, -1.)\nprint(f'weights_only_w={fw.item():.6f}; next_lr={fopt.param_groups[0][\"lr\"]:.2f}')\nassert abs(fw.item() - rw.item()) > 0.01\n",
      "output": "after_first_w=0.900000\nm=0.50; v=0.50\nuninterrupted_w=0.933333; next_lr=0.05\nfully_restored_w=0.933333; next_lr=0.05\nweights_only_w=1.000000; next_lr=0.10\n",
      "steps": [
        {
          "title": "制造可计算的优化历史",
          "lines": [
            1,
            16
          ],
          "explanation": "起点 w 为一，第一次梯度为正一。两个指数统计从零变成零点五；除以一步偏差修正因子零点五后，校正统计都是一，因此更新量是学习率零点一，参数降到零点九。调度器在更新之后推进，目前只完成一步，还没有触发两步一次的衰减。这里直接指定梯度，让你看到变化完全来自优化器规则，不受数据和模型前向影响。",
          "state": "w=0.9，m=0.5，v=0.5，已完成一次更新，下一步学习率仍为 0.1。"
        },
        {
          "title": "在更新边界保存完整状态",
          "lines": [
            17,
            21
          ],
          "explanation": "保存发生在第一步参数更新和调度之后，所以检查点表达清晰的下一步起点。连续训练的第二个梯度变成负一，一阶矩为零点五乘旧值再加负零点五，得到负零点二五；二阶矩为零点七五。两步偏差修正后，一阶矩是负三分之一，二阶矩是一，更新把参数增加约零点零三三三。随后调度器才把下一步学习率改为零点零五。",
          "state": "连续路径第二步 w≈0.933333，后续学习率变为 0.05。"
        },
        {
          "title": "恢复对象，再恢复它们的时间线",
          "lines": [
            22,
            32
          ],
          "explanation": "先重建参数、优化器和调度器，保证对象结构与参数身份对应，再把状态装回各自对象。调度器的初始化先完成，避免它干扰已恢复的学习率；参数用 copy_ 写入，不替换优化器持有的对象。随机状态最后恢复，因为构造真实模型也可能消耗随机数。第二步使用同样负梯度，参数与连续路径逐位一致，调度器也处于相同位置。",
          "state": "完整恢复路径与连续训练一致：权重、优化器历史和调度进度共同接续。"
        },
        {
          "title": "只恢复权重会启动新的优化历史",
          "lines": [
            33,
            38
          ],
          "explanation": "新优化器把负一视为它看到的第一个梯度，偏差修正后的方向就是负一，参数从零点九增加零点一，得到一。它没有旧的正梯度来抵消方向，也只认为完成了一步，调度器不会衰减。由此可见，前向输出相同只能证明权重恢复正确，不能证明训练轨迹恢复正确。实际检查还需要比较采样进度、scaler 和各个随机源，不能只保存 epoch 名字。",
          "state": "仅权重路径得到 w=1.0、学习率 0.1，两个维度都与完整恢复不同。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "看到 load_state_dict 成功就结束验证",
        "why": "状态键可读取不等于后续更新一致；参数组映射、调度进度和数据顺序都可能出错。",
        "fix": "固定下一批数据，比较恢复前后更新后的参数及优化器统计。"
      },
      {
        "wrong": "更换 Parameter 后继续用旧优化器",
        "why": "优化器保存的是对象引用，新的同名参数不会自动替换旧引用。",
        "fix": "先完成模型结构和参数放置再创建优化器，改数值优先在 no_grad 中 copy_。"
      }
    ],
    "check": {
      "prompt": "这个例子若只比较恢复点的模型前向，能区分完整恢复和仅权重恢复吗？",
      "hint": "两条路径的参数在第二次更新前都是 0.9。",
      "answer": "不能。差异隐藏在动量、二阶矩和计数里，必须执行后续更新才能显现。"
    },
    "transfer": "为真实实验建立“两段运行等于连续运行”的验收。先在更新边界完成，再考虑复杂的窗口中途恢复；不要把文件保存成功、预测一致和训练可续接当成同一个证明。"
  },
  "training-4": {
    "scenario": "训练损失很低，验证损失却很高，你打算继续增加训练轮数。先停下来检查数据到底约束了哪些参数：如果训练输入从未激活某个特征，训练误差再低也无法判断它的系数。下面构造一个完全可解释的模型，让正则化如何改变未被数据确定的部分直接显现。",
    "prerequisites": [
      "nn-2",
      "nn-3",
      "autograd-3"
    ],
    "terms": [
      {
        "name": "泛化",
        "meaning": "模型在未参与拟合的数据上表现如何，不由训练误差单独决定。"
      },
      {
        "name": "正则项",
        "meaning": "添加到训练目标的偏好，例如限制某个系数的幅度；它改变优化目标而非增加数据。"
      },
      {
        "name": "运行统计",
        "meaning": "BatchNorm 等模块持有的均值方差 buffer，可在无梯度模式下继续被更新。"
      }
    ],
    "observe": "先看图解的真实训练记录，再切换“过拟合示意”。两条曲线分开时应寻找原因，而不是从形状直接断言。本例用已知函数解释一种原因，不声称图中真实实验使用了同样模型。",
    "walkthrough": {
      "title": "训练集看不见的方向，正则化怎样约束它",
      "intro": "模型是 f(x)=w·x+a·(x³−x)。训练输入只有 −1、0、1，所以第二项恒为零；验证使用 −0.5、0.5。我们比较相同初始参数下是否惩罚 a²，再独立检查 eval 与 no_grad 的区别。",
      "code": "import torch\nfrom torch import nn\ntorch.set_num_threads(1)\ntrain_x = torch.tensor([-1., 0., 1.], dtype=torch.float64)\nvalid_x = torch.tensor([-0.5, 0.5], dtype=torch.float64)\nclass Curve(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.w = nn.Parameter(torch.tensor(0., dtype=torch.float64))\n        self.a = nn.Parameter(torch.tensor(4., dtype=torch.float64))\n    def forward(self, x):\n        return self.w * x + self.a * (x**3 - x)\nprint(f'train_extra_feature={(train_x**3-train_x).tolist()}')\ndef fit(penalty):\n    model = Curve()\n    opt = torch.optim.SGD(model.parameters(), lr=0.1)\n    for _ in range(60):\n        opt.zero_grad(set_to_none=True)\n        error = (model(train_x) - train_x).square().mean()\n        (error + penalty * model.a.square()).backward()\n        opt.step()\n    return model\nplain, regularized = fit(0.), fit(0.1)\nfor name, model in [('plain', plain), ('regularized', regularized)]:\n    model.eval()\n    with torch.no_grad():\n        train_loss = (model(train_x)-train_x).square().mean().item()\n        valid_loss = (model(valid_x)-valid_x).square().mean().item()\n    print(f'{name}: a={model.a.item():.6f}; train={train_loss:.6f}; valid={valid_loss:.6f}')\nbn = nn.BatchNorm1d(2, momentum=1.)\nbatch = torch.tensor([[1., 3.], [3., 5.]])\nbn.train()\nwith torch.no_grad():\n    bn(batch)\nprint(f'bn_mean_after_no_grad={bn.running_mean.tolist()}')\nbn.eval()\nwith torch.no_grad():\n    bn(batch + 10.)\nprint(f'bn_mean_after_eval={bn.running_mean.tolist()}')\ndropout = nn.Dropout(p=1.)\nones = torch.ones(3)\ndropout.train()\nprint(f'dropout_train={dropout(ones).tolist()}')\ndropout.eval()\nprint(f'dropout_eval={dropout(ones).tolist()}')\nassert regularized.a.abs() < plain.a.abs()\n",
      "output": "train_extra_feature=[0.0, 0.0, 0.0]\nplain: a=4.000000; train=0.000000; valid=2.250280\nregularized: a=1.190213; train=0.000000; valid=0.199294\nbn_mean_after_no_grad=[2.0, 4.0]\nbn_mean_after_eval=[2.0, 4.0]\ndropout_train=[0.0, 0.0, 0.0]\ndropout_eval=[1.0, 1.0, 1.0]\n",
      "steps": [
        {
          "title": "数据没有约束全部函数行为",
          "lines": [
            1,
            13
          ],
          "explanation": "三个训练输入的 x³−x 都为零，所以无论 a 是零、四还是更大的数，它都不会改变训练预测。这不是反向传播出错，而是数据本身没有提供识别该系数的信息。在验证输入零点五处，这个特征为负零点三七五，a=4 会带来负一点五的额外偏移。相同训练结果可以对应截然不同的未见位置预测，模型复杂度与数据覆盖必须一起分析。",
          "state": "训练集上的额外特征全为零，验证集上的额外特征并不为零。"
        },
        {
          "title": "只改变一个因素：对 a 施加惩罚",
          "lines": [
            14,
            29
          ],
          "explanation": "两个模型从相同 w=0、a=4 出发，用完全相同训练数据更新六十次。没有惩罚时，数据项对 a 的导数始终为零，所以它一直停在四。加入零点一乘 a² 后，a 的导数多了零点二 a，每步会乘约零点九八，因此逐渐缩小；w 的学习过程相同。训练误差几乎一样，验证误差却明显不同。正则项是在表达较小系数的偏好，不是从验证标签偷学答案。",
          "state": "两条路径训练误差都很小；正则化路径的 a 更小，验证偏移随之减弱。"
        },
        {
          "title": "无梯度不代表统计量停止变化",
          "lines": [
            30,
            39
          ],
          "explanation": "这段把模型的另一个评估风险单独拿出来。BatchNorm 在训练模式下即使位于 no_grad 中，也会把当前批次统计写入 buffer；本例动量为一，因此运行均值直接变成二和四。切到 eval 后再输入整体加十的数据，均值保持不变。no_grad 控制计算图记录，eval 控制模块行为，两个开关互相不能代替。否则验证可能悄悄修改模型状态，下一轮训练起点也受影响。",
          "state": "no_grad 内的 train BatchNorm 更新均值；eval 后均值保持 [2,4]。"
        },
        {
          "title": "用确定性例子隔离 Dropout 模式",
          "lines": [
            40,
            46
          ],
          "explanation": "为了不打印随机输出，教学例子使用 p=1，训练时所有位置都丢弃，评估时全部原样保留。普通训练会用较小概率并进行适当缩放，但 train/eval 的职责相同。Dropout 没有像 BatchNorm 那样需要冻结的运行均值，应说“关闭随机丢弃”，而不是笼统说“不更新 Dropout 统计”。诊断泛化差距之前，先保证训练与验证都遵守各自模式和数据边界。",
          "state": "Dropout 的训练输出全零，评估输出全一；模式变化与是否求导无关。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "验证变差就只增加训练轮数",
        "why": "若模型在未被训练数据约束的方向偏离，更多重复训练不一定增加信息，甚至扩大过拟合。",
        "fix": "先检查数据覆盖、标签质量和评估模式，再用验证集选择容量与正则。"
      },
      {
        "wrong": "把验证误差也加入 backward 帮助模型",
        "why": "验证集一旦参与更新，就不再是独立的泛化证据，曲线会产生乐观偏差。",
        "fix": "只用训练目标更新；验证用于选择方案，最终测试集保留独立评估。"
      }
    ],
    "check": {
      "prompt": "若把 a 的初值改为 0，不加正则时它在这三个训练点上会变化吗？",
      "hint": "数据损失对 a 的导数包含 x³−x。",
      "answer": "不会，特征在所有训练点都为零，数据梯度恒为零。初值为零恰好选择了更简单的函数，但这来自初始化而非训练数据的辨识。"
    },
    "transfer": "真实任务无法总把误差写成这样的多项式，但可以保留同样诊断习惯：做小数据拟合、检查梯度、独立切换正则、核对评估模式，并用未参与更新的数据验证每个假设。"
  },
  "transformer-1": {
    "scenario": "你看到注意力代码里连续出现 transpose、matmul、mask 和 softmax，形状都能对上，却不确定某个位置究竟读到了什么信息。先不要加完整模型。本例让所有 query/key 分数相同，使输出退化为“可见 value 的平均”，这样每一个数字都能说明 mask 是否生效。",
    "prerequisites": [
      "tensor-2",
      "tensor-4",
      "nn-3"
    ],
    "terms": [
      {
        "name": "查询与键",
        "meaning": "查询决定当前要取什么信息，键参与匹配；二者点积产生某个查询对某个键的分数。"
      },
      {
        "name": "值向量",
        "meaning": "根据注意力权重被加权聚合的内容，与用于匹配的键承担不同角色。"
      },
      {
        "name": "因果可见性",
        "meaning": "查询只能使用自身及更早位置的信息；它约束前向信息流，不等于选择哪些位置计算损失。"
      }
    ],
    "observe": "图解的“完整因果注意力”按步高亮不同 query 行，每行允许连接数递增；切到“屏蔽 padding”会屏蔽最后一列，且该模式明确没有叠加因果条件。本例展示两种条件真正组合后的矩阵。",
    "walkthrough": {
      "title": "用均匀分数手算每个 query 的输出",
      "intro": "使用 [B,H,T,D]=[1,1,3,2] 的最小自注意力。Q/K 都是零，所以 softmax 只由可见集合决定；V 的三个向量不同，让每次聚合结果可以直接验算。这里不含投影、残差与归一化层。",
      "code": "import torch\nfrom torch.nn import functional as F\ntorch.set_num_threads(1)\nq = torch.zeros(1, 1, 3, 2, dtype=torch.float64)\nk = torch.zeros_like(q)\nv = torch.tensor([[[[2., 4.], [6., 8.], [10., 12.]]]], dtype=torch.float64)\nscores = q @ k.transpose(-1, -2) / (2**0.5)\nprint(f'scores_shape={tuple(scores.shape)}')\ncausal = torch.ones(3, 3, dtype=torch.bool).tril()\nweights = scores.masked_fill(~causal, float('-inf')).softmax(-1)\nout = weights @ v\nprint(f'causal_allowed={causal.int().tolist()}')\nprint(f'weight_sums={weights.sum(-1).flatten().tolist()}')\nprint(f'causal_output={out[0, 0].tolist()}')\nkey_valid = torch.tensor([True, True, False])\nallowed = causal & key_valid[None, :]\npadded = F.scaled_dot_product_attention(q, k, v, attn_mask=allowed, dropout_p=0.)\nprint(f'combined_allowed={allowed.int().tolist()}')\nprint(f'combined_output={padded[0, 0].tolist()}')\nexpected = torch.tensor([[[[2., 4.], [4., 6.], [4., 6.]]]], dtype=torch.float64)\ntorch.testing.assert_close(padded, expected)\nquery_valid = key_valid\nkept = padded[0, 0][query_valid]\nprint(f'padded_query_still_exists={padded[0, 0, 2].tolist()}')\nprint(f'valid_query_count={kept.size(0)}')\nassert kept.size(0) == 2\nassert torch.isfinite(padded).all()\n",
      "output": "scores_shape=(1, 1, 3, 3)\ncausal_allowed=[[1, 0, 0], [1, 1, 0], [1, 1, 1]]\nweight_sums=[1.0, 1.0, 1.0]\ncausal_output=[[2.0, 4.0], [4.0, 6.0], [6.0, 8.0]]\ncombined_allowed=[[1, 0, 0], [1, 1, 0], [1, 1, 0]]\ncombined_output=[[2.0, 4.0], [4.0, 6.0], [4.0, 6.0]]\npadded_query_still_exists=[4.0, 6.0]\nvalid_query_count=2\n",
      "steps": [
        {
          "title": "先把矩阵乘法的两条位置轴找出来",
          "lines": [
            1,
            8
          ],
          "explanation": "Q 的最后两维是查询长度三和每个 head 的特征宽度二；K 转置后最后两维变成二乘三。收缩特征轴后得到三乘三，行代表 query，列代表 key。batch 和 head 是前导轴，当前都为一，不参与这次收缩。所有分数为零不是“没有注意力”，而是所有可见键获得相同原始分数；只有 softmax 后才会变成归一化的权重。",
          "state": "scores 为 [1,1,3,3]，最后两维分别为查询位置与键位置。"
        },
        {
          "title": "先屏蔽，再沿键轴归一化",
          "lines": [
            9,
            14
          ],
          "explanation": "第一行只能看第零个键，权重为一，输出直接等于第一个 V。第二行能看两个键，所以各占一半，输出为 [4,6]。第三行能看全部三个键，各占三分之一，输出为 [6,8]。被屏蔽分数填负无穷后，指数权重成为零；若仅把分数乘零，零的指数仍为一，并不会移除该键。最后一维 softmax 让每个查询分别在自己的可见键集合中分配总和为一的权重。",
          "state": "因果输出依次为 [2,4]、[4,6]、[6,8]，每个 query 的权重和为 1。"
        },
        {
          "title": "Padding 与因果条件是逻辑与",
          "lines": [
            15,
            21
          ],
          "explanation": "把最后一个键标为无效后，前两行没有变化，因为它们原本就不能看到未来的第三个键。第三行原先读三个 V，现在只能读前两个，所以变成 [4,6]。这里传入 SDPA 的 True 代表允许配对，因此直接用 allowed；手写 masked_fill 的 True 代表执行替换，才需要取反。两处变量的数学集合相同，接口语义却相反，复制布尔 mask 时最容易把方向颠倒。",
          "state": "组合 mask 的第三行变成 [True,True,False]，第三个输出随之改变。"
        },
        {
          "title": "屏蔽键不等于删除查询",
          "lines": [
            22,
            27
          ],
          "explanation": "尽管第三个位置作为键被屏蔽，它作为 query 的那一行依然存在，并且可以从前两个有效键聚合出非零结果。注意力算子不知道这个位置是否应纳入训练目标；需要在后续 loss 中另用标签 mask 排除。代码用布尔选择仅演示有效查询集合，实际模型可以保留固定形状再在损失阶段忽略。还要避免某一行所有键都被屏蔽：普通 softmax 的零分母或无穷运算无法靠事后乘 mask 修复。",
          "state": "注意力仍返回 3 行；真正有效的 query 只有 2 行，loss 分母应另行决定。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "输出 shape 正确，所以 mask 一定正确",
        "why": "反向的 mask、错轴广播或看见未来都能产生合法的形状，错误隐藏在信息流里。",
        "fix": "构造本例这种同分数、不同 V 的小张量，检查可见集合对应的均值。"
      },
      {
        "wrong": "有 key padding mask 就不用 loss mask",
        "why": "键 mask 排除被读取的位置，没有自动删除查询输出或改变标签分母。",
        "fix": "分别记录 key 可见性和目标有效性，并在 next-token 位移后再次对齐。"
      }
    ],
    "check": {
      "prompt": "若只把中间的 key 屏蔽，最后一个 query 能看第一个和第三个 V，它的输出是多少？",
      "hint": "两个可见键分数相同，各占一半。",
      "answer": "[(2+10)/2,(4+12)/2]=[6,8]。结果恰好与原三键平均相同，说明只检查一个输出值还不足以证明 mask 正确，应同时检查允许矩阵。"
    },
    "transfer": "读真实注意力时先写 [B,H,L,S]，逐项列出因果、padding、窗口或分组条件。对有位置编码的模型，比较 padding 不变性还需保持有效 token 的位置编号一致。"
  },
  "transformer-2": {
    "scenario": "长序列注意力的显存很高，你听说 Flash Attention 不保存完整注意力矩阵，却不理解没有整行分数怎么完成 softmax。本例用两块数据演示在线归一化：遇到更大的最大值，旧累积必须换到新尺度，再与新块合并。它解释算法等价性，不把 CPU 运行误称为 Flash 内核。",
    "prerequisites": [
      "transformer-1",
      "tensor-3"
    ],
    "terms": [
      {
        "name": "分块",
        "meaning": "把键和值沿序列轴分成小片，逐片计算，减少必须同时物化的中间数据。"
      },
      {
        "name": "在线 softmax",
        "meaning": "边读分数边维护当前最大值、指数和与加权和值，最终得到整行归一化结果。"
      },
      {
        "name": "重缩放",
        "meaning": "参考最大值变大时，将旧累积乘 exp(旧最大值−新最大值)，统一两部分的指数坐标。"
      }
    ],
    "observe": "先用图解的完整因果模式确认每行可见范围，再切到“带缓存的 decode”：一个 query 可以看四个历史键。本例正对这一整行做分块计算，之后用错误矩形因果限制展示“算法算对了，但可见集合错了”的区别。",
    "walkthrough": {
      "title": "不保存完整概率矩阵，也能得到同一个加权平均",
      "intro": "一行分数为 [1000,1001,999,1002]，值为 [2,4,8,16]。数值很大但相对差距很小。我们先算稳定参考，再每次处理两个键，最后与 CPU SDPA 对照；实际融合内核还有设备布局和反向等复杂实现。",
      "code": "import torch\nfrom torch.nn import functional as F\ntorch.set_num_threads(1)\nscores = torch.tensor([1000., 1001., 999., 1002.], dtype=torch.float64)\nvalues = torch.tensor([2., 4., 8., 16.], dtype=torch.float64)\nreference = scores.softmax(0) @ values\nprint(f'reference={reference.item():.6f}')\nm = torch.tensor(float('-inf'), dtype=torch.float64)\nnormalizer = torch.tensor(0., dtype=torch.float64)\nweighted_sum = torch.tensor(0., dtype=torch.float64)\nfor block in range(2):\n    s = scores[2*block:2*block+2]\n    v = values[2*block:2*block+2]\n    new_m = torch.maximum(m, s.max())\n    old_scale = (m-new_m).exp()\n    weights = (s-new_m).exp()\n    normalizer = normalizer*old_scale + weights.sum()\n    weighted_sum = weighted_sum*old_scale + weights @ v\n    m = new_m\n    print(f'block={block+1}; max={m.item():.0f}; denominator={normalizer.item():.6f}; numerator={weighted_sum.item():.6f}')\nonline = weighted_sum / normalizer\nprint(f'online={online.item():.6f}')\ntorch.testing.assert_close(online, reference)\nq = torch.ones(1, 1, 1, 1, dtype=torch.float64)\nk = scores.reshape(1, 1, 4, 1)\nv = values.reshape(1, 1, 4, 1)\nactual = F.scaled_dot_product_attention(q, k, v, dropout_p=0.)\nprint(f'sdpa_all_keys={actual.item():.6f}')\ntorch.testing.assert_close(actual.flatten()[0], reference)\nwrong = F.scaled_dot_product_attention(q, k, v, dropout_p=0., is_causal=True)\nprint(f'upper_left_causal={wrong.item():.6f}')\nassert wrong.item() == values[0].item()\nassert not torch.isclose(wrong.flatten()[0], reference)\n",
      "output": "reference=11.680917\nblock=1; max=1001; denominator=1.367879; numerator=4.735759\nblock=2; max=1002; denominator=1.553002; numerator=18.140485\nonline=11.680917\nsdpa_all_keys=11.680917\nupper_left_causal=2.000000\n",
      "steps": [
        {
          "title": "建立不会溢出的整行参考",
          "lines": [
            1,
            7
          ],
          "explanation": "注意力输出是指数分数加权的 V 总和除以指数和。给所有分数减去同一个常数，分子和分母同时乘相同因子，商不变，所以可以用最大值一千零二作为参考避免溢出。这个平移不改变模型定义；它只是更稳健的计算方式。参考路径一次看到全部分数，接下来要求分块路径在不知道后续最大值时也保留同一数学目标。",
          "state": "整行 softmax 有稳定有限的输出，作为分块结果的对照。"
        },
        {
          "title": "维护三个可合并的状态",
          "lines": [
            8,
            23
          ],
          "explanation": "第一块以一千零一为最大值，两个相对指数是 exp(−1) 与一；分母约一点三六七九，分子约四点七三五八。第二块带来更大的最大值一千零二，此时不能直接累加新块，因为旧分子分母以旧最大值计量。把旧量都乘 exp(−1)，再加入新块的 exp(−3) 与一，两个部分才处于同一尺度。始终保存最大值、分母和分子三个状态，最终相除即可恢复整行输出。",
          "state": "第二块使最大值从 1001 变为 1002，旧分子和分母先同步缩放，再合并。"
        },
        {
          "title": "把分数模型映射到 SDPA",
          "lines": [
            24,
            29
          ],
          "explanation": "令 query 为一、head 宽度为一，则 QKᵀ 正好等于我们给出的四个分数，默认缩放因子也为一。SDPA 返回与参考和分块模型一致的结果，证明这些表达具有相同数值目标。CPU 可能使用数学后端，这段代码没有验证 Flash Attention 的速度或显存。Flash 的关键收益来自避免在设备显存中物化大矩阵以及减少数据搬运，并没有把密集注意力的所有乘加变成线性复杂度。",
          "state": "参考、在线分块、CPU SDPA 三条路径的输出在容差内一致。"
        },
        {
          "title": "正确内核也救不了错误可见性",
          "lines": [
            30,
            33
          ],
          "explanation": "如果这个唯一查询实际位于完整上下文末尾，四个键都是历史或自身，本来都应可见。但 SDPA 的非方阵 is_causal 采用左上对齐，下三角的第一行只保留首列，于是输出变成第一个 V，也就是二。此时 softmax 和分块算法都可能完全正确，错的是位置解释。缓存解码应依据绝对位置建立矩形 mask，或在确定缓存没有未来 token 时允许全部有效键；批量追加多个 token 时还要保留新块内部因果关系。",
          "state": "错误矩形 mask 只留下首键，输出 2，明显偏离整行参考。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "新块最大值变大，只更新分母",
        "why": "旧分子与分母都使用旧指数参考；仅缩放一边会改变加权平均。",
        "fix": "对两个旧累积都乘相同重缩放系数，再加入新块贡献。"
      },
      {
        "wrong": "调用 SDPA 就证明用了 Flash Attention",
        "why": "接口根据设备、dtype、shape 和 mask 选择后端，CPU 对照不能证明 GPU 内核选择。",
        "fix": "数值正确性与实际后端、吞吐和显存分别验证，并显式关闭推理 dropout。"
      }
    ],
    "check": {
      "prompt": "若第二块最大值没有超过第一块，旧累积的缩放系数是多少？",
      "hint": "新最大值等于旧最大值。",
      "answer": "exp(旧最大值−新最大值)=exp(0)=1，旧分子和分母可以直接保留，但新块仍要减同一个全局运行最大值。"
    },
    "transfer": "优化任何归一化算子时，先写出需要保留的充分统计量，再推导怎样合并分块。随后单独核对 mask、dtype 与后端；保持数学目标并不自动保证所有边界或执行配置都相同。"
  },
  "transformer-3": {
    "scenario": "生成器每次只输出一个新 token，为什么上下文越长仍然越来越慢？缓存消除了历史 token 的重复投影，但当前 query 仍要读取历史 K/V。本例同时数“计算新 K/V 的 token 数”和“注意力读取的键数”，把这两种工作量明确分开。",
    "prerequisites": [
      "transformer-1",
      "transformer-2",
      "tensor-1"
    ],
    "terms": [
      {
        "name": "Prefill",
        "meaning": "一次处理已有前缀，通常产生多个查询及对应各层 K/V；计算形状与逐步 decode 不同。"
      },
      {
        "name": "Decode",
        "meaning": "自回归地追加少量新 token，利用历史缓存，仅为新位置计算当前所需的新状态。"
      },
      {
        "name": "KV head 数",
        "meaning": "实际存储 K/V 的 head 数；GQA 中可少于 query head 数，缓存公式使用它而非查询数量。"
      }
    ],
    "observe": "图解每向前一步，K 和 V 缓存都新增一列；两行表示层而不是 head。切换 MHA 的八个 KV heads 与 GQA 的两个，比较字节数如何成为四分之一。本例也使用这组缓存估算参数。",
    "walkthrough": {
      "title": "缓存前向一致，但历史读取依然增长",
      "intro": "用零 Q/K 让每步注意力变成历史 V 的平均，V 固定为 [2,4,8,16]。先进行一次完整因果 prefill，再逐 token 写入预分配缓存，比较同一位置的输出。代码是单层 CPU 注意力模型，不含真实词嵌入或位置旋转。",
      "code": "import torch\nfrom torch.nn import functional as F\ntorch.set_num_threads(1)\nq = torch.zeros(1, 1, 4, 1, dtype=torch.float64)\nk = torch.zeros_like(q)\nv = torch.tensor([2., 4., 8., 16.], dtype=torch.float64).reshape(1, 1, 4, 1)\nfull = F.scaled_dot_product_attention(q, k, v, dropout_p=0., is_causal=True)\nprint('prefill=' + ','.join(f'{x:.6f}' for x in full.flatten().tolist()))\nkey_cache = torch.empty_like(k)\nvalue_cache = torch.empty_like(v)\noutputs = []\nwith torch.inference_mode():\n    for pos in range(4):\n        key_cache[:, :, pos:pos+1].copy_(k[:, :, pos:pos+1])\n        value_cache[:, :, pos:pos+1].copy_(v[:, :, pos:pos+1])\n        result = F.scaled_dot_product_attention(\n            q[:, :, pos:pos+1], key_cache[:, :, :pos+1],\n            value_cache[:, :, :pos+1], dropout_p=0., is_causal=False)\n        outputs.append(result.item())\nprint('cached=' + ','.join(f'{x:.6f}' for x in outputs))\ntorch.testing.assert_close(torch.tensor(outputs, dtype=torch.float64), full.flatten())\nwithout_cache_tokens = sum(range(1, 5))\nwith_cache_tokens = 4\nattention_key_reads = sum(range(1, 5))\nprint(f'projected_tokens_without_cache={without_cache_tokens}')\nprint(f'projected_tokens_with_cache={with_cache_tokens}')\nprint(f'cached_attention_key_reads={attention_key_reads}')\ndef logical_bytes(kv_heads, length):\n    return 2 * 2 * 1 * length * kv_heads * 4 * 2\nmha_bytes = logical_bytes(8, 4)\ngqa_bytes = logical_bytes(2, 4)\nprint(f'mha_fp16_bytes={mha_bytes}; gqa_fp16_bytes={gqa_bytes}')\nprint(f'gqa_fraction={gqa_bytes/mha_bytes:.2f}')\nassert mha_bytes == 1024 and gqa_bytes == 256\n",
      "output": "prefill=2.000000,3.000000,4.666667,7.500000\ncached=2.000000,3.000000,4.666667,7.500000\nprojected_tokens_without_cache=10\nprojected_tokens_with_cache=4\ncached_attention_key_reads=10\nmha_fp16_bytes=1024; gqa_fp16_bytes=256\ngqa_fraction=0.25\n",
      "steps": [
        {
          "title": "先取得完整因果参考",
          "lines": [
            1,
            8
          ],
          "explanation": "完整因果矩阵的第一个查询只看值二，第二个看二和四，因此前两个输出是二、三。第三个看前三个值，平均为十四除以三；第四个看全部值，平均为三十除以四。虽然这次前向一次处理四个查询，每一行仍有自己的因果边界。它提供每个位置的参考，接下来缓存路径必须在同样上下文和位置条件下复现，而不是只比较最后一个 shape。",
          "state": "prefill 输出为 2、3、14/3、7.5。"
        },
        {
          "title": "写入新位置，只读取有效前缀",
          "lines": [
            9,
            21
          ],
          "explanation": "预分配缓存容量为四，但第一个步骤只有位置零已经写入；切片到 pos+1 保证不会读到未初始化内容。每个新 query 使用所有已写入键，这些键都是历史或自身，因此不再需要左上对齐的因果限制。输出列表与 prefill 逐位置一致。真实模型每层都要独立缓存，而且 K 通常已包含相应位置变换；重复旋转旧 K 或写错绝对位置都会破坏这种等价。",
          "state": "每一步缓存有效长度增加一，输出与完整因果参考逐位置相同。"
        },
        {
          "title": "避免重算不等于避免读历史",
          "lines": [
            22,
            27
          ],
          "explanation": "若每次从头运行长度一、二、三、四的前缀，累计会为十个 token 次数计算投影和网络层状态。缓存只为每个新 token 做一次，共四次。但这四个新 query 分别仍读取一、二、三、四个历史键，注意力键访问合计仍为十。这里数的是单 head、单层的抽象键次数，不是实测带宽。它解释了为什么缓存可以极大提速，却不能保证长上下文的单 token 延迟恒定。",
          "state": "新状态计算量由 10 个 token 次数降为 4；键读取次数仍合计 10。"
        },
        {
          "title": "把逻辑缓存与实际分配分开",
          "lines": [
            28,
            34
          ],
          "explanation": "该估算另设两层、batch 一、长度四、head 宽度四、FP16 两字节。首个二代表 K 和 V，第二个二代表层数；MHA 的八个 KV heads 得到一千零二十四字节，GQA 两个得到二百五十六。计算代码中的实际演示张量是 double 且只有一层，不能拿其 nbytes 与这组假设混算。实际部署还需计入预留容量、块尾浪费、元数据和不同并行策略的复制或分片。",
          "state": "按图解假设，GQA 逻辑缓存为 MHA 的 1/4；这不是整体模型显存缩小到 1/4。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "只按 query head 数估算 GQA 缓存",
        "why": "查询有多个 head 不代表每个都保存独立 K/V；共享关系正是 GQA 的关键。",
        "fix": "在模型配置中找实际 KV head 数，并检查每卡是分片还是复制。"
      },
      {
        "wrong": "每步把整块预分配容量交给注意力",
        "why": "尚未写入的缓存可能是未初始化值，或属于别的请求，形状正确也会污染输出。",
        "fix": "维护有效长度和位置映射，只读取当前请求已经有效写入的前缀或块。"
      }
    ],
    "check": {
      "prompt": "把生成长度从 4 改成 5，缓存路径为新状态计算了多少次 token，累计读取多少个键？",
      "hint": "新状态每个位置一次，历史读取是 1+2+…+T。",
      "answer": "新状态计算 5 次，累计键读取 15 次；缓存消除历史状态重算，但历史读取仍随上下文增长。"
    },
    "transfer": "读缓存实现时，把容量、有效长度、逻辑位置、物理块和请求身份分别标清。先验证与无缓存参考的输出一致，再评估追加、回收和并行带来的性能收益。"
  },
  "transformer-4": {
    "scenario": "你拿到生成结果中的 logprob，想把它用于训练比率或序列评分，却不知道它指的是原模型概率还是 top-k 过滤后的采样概率。同一个 token 在两种分布下可以有不同 logprob。本例固定 token，不进行随机抽样，逐步展示标签对齐、温度、过滤与目标 mask。",
    "prerequisites": [
      "transformer-1",
      "nn-3",
      "tensor-2"
    ],
    "terms": [
      {
        "name": "条件概率",
        "meaning": "在已有前缀条件下下一个 token 的概率；整段序列概率由各步条件概率共同构成。"
      },
      {
        "name": "Logprob",
        "meaning": "概率的自然对数，乘积变加和；必须同时说明它属于哪一种分布。"
      },
      {
        "name": "重新归一化",
        "meaning": "删除候选后，把剩余权重按它们的新总和重新分配，否则不是总和为一的概率分布。"
      }
    ],
    "observe": "切换图解的 T=0.5、T=1、T=2，观察同一 logits 的概率集中程度，再切 top-2 看后两个 token 概率归零。步进显示的是被查看 token 的 log p，不是模型实际随机生成了一次。",
    "walkthrough": {
      "title": "同一 token，原始 logprob 与采样 logprob 为什么不同",
      "intro": "词表大小为四，所有位置的 logits 都固定为 [3,2,1,0]，输入 token 为 [0,1,2,3]。用稳定 log_softmax 计算参考，再在温度和 top-k 后重新计算实际策略概率。所有输出都确定可复现。",
      "code": "import torch\nfrom torch.nn import functional as F\ntorch.set_num_threads(1)\nids = torch.tensor([[0, 1, 2, 3]])\nlogits = torch.tensor([3., 2., 1., 0.], dtype=torch.float64).repeat(1, 4, 1)\nnext_logits = logits[:, :-1]\ntargets = ids[:, 1:]\nraw_logp = F.log_softmax(next_logits, dim=-1)\nselected = raw_logp.gather(-1, targets.unsqueeze(-1)).squeeze(-1)\nprint(f'next_targets={targets.tolist()}')\nprint('target_logprobs=' + ','.join(f'{x:.6f}' for x in selected.flatten().tolist()))\nprint(f'sequence_logprob={selected.sum().item():.6f}')\none_step = logits[0, 0]\ntemperature = 0.5\nscaled = one_step / temperature\nprobability = scaled.softmax(-1)\nprint('temperature_prob=' + ','.join(f'{x:.6f}' for x in probability.tolist()))\nassert abs(probability.sum().item() - 1.) < 1e-12\ntop_values, top_indices = scaled.topk(2)\nfiltered = torch.full_like(scaled, float('-inf'))\nfiltered.scatter_(-1, top_indices, top_values)\nsampling_logp = filtered.log_softmax(-1)\nchosen_id = 1\nprint('top2_prob=' + ','.join(f'{x:.6f}' for x in sampling_logp.exp().tolist()))\nprint(f'chosen_raw_logprob={raw_logp[0, 0, chosen_id].item():.6f}')\nprint(f'chosen_sampling_logprob={sampling_logp[chosen_id].item():.6f}')\nassert sampling_logp[2:].isneginf().all()\nresponse_mask = torch.tensor([[False, True, True]])\nresponse_loss = -selected[response_mask].mean()\nprint(f'response_token_count={int(response_mask.sum())}')\nprint(f'response_mean_nll={response_loss.item():.6f}')\nassert response_mask.shape == targets.shape\n",
      "output": "next_targets=[[1, 2, 3]]\ntarget_logprobs=-1.440190,-2.440190,-3.440190\nsequence_logprob=-7.320569\ntemperature_prob=0.864955,0.117059,0.015842,0.002144\ntop2_prob=0.880797,0.119203,0.000000,0.000000\nchosen_raw_logprob=-1.440190\nchosen_sampling_logprob=-2.126928\nresponse_token_count=2\nresponse_mean_nll=2.940190\n",
      "steps": [
        {
          "title": "把预测位置和目标位置错开一位",
          "lines": [
            1,
            12
          ],
          "explanation": "位置零已经读到 token 零，它的输出预测 token 一；最后一个输入位置没有后续目标，因此不参与这次三项损失。gather 在词表轴按目标 ID 取值，输出保留 batch 与位置轴。三个目标概率并不相同，因为同一 logits 对 ID 一、二、三给出不同分数。序列 logprob 是这三个条件 logprob 的和；平均值是另一种按长度归一化评分，不应把两者用同一个名字混用。",
          "state": "目标为 [1,2,3]，每个 logprob 对应前一个输入位置的预测。"
        },
        {
          "title": "温度作用在 logits，而非标签",
          "lines": [
            13,
            18
          ],
          "explanation": "温度零点五把分数差放大两倍，最高分相对次高分的优势由 exp(1) 变成 exp(2)，分布更集中。标签仍然是原来的整数 ID，没有因为温度改变而移动或重编码。温度为零不能直接代入除法；需要贪心时直接选择最大分数。这里只展示概率，所以可以逐项验算，不把一次抽样的偶然结果当成温度效果的证明。",
          "state": "四项概率仍合计为 1，但较低温度使最高分候选占比更大。"
        },
        {
          "title": "截断候选后再定义采样策略",
          "lines": [
            19,
            27
          ],
          "explanation": "先对温度后的分数保留前两个候选，再用负无穷屏蔽其他项。新 softmax 只在这两个候选间分配概率，被排除的 token 的 logprob 为负无穷。我们固定查看 ID 一：原始模型给它的 logprob 约负一点四四，而经过温度零点五和 top-2 后约负二点一二七。两个值都可能正确，但含义不同。用于策略比率时，分子分母必须明确对应目标策略与行为策略，不能因字段都叫 logprob 就直接相减。",
          "state": "同一 chosen_id=1，在原模型与实际采样分布下的 logprob 不同。"
        },
        {
          "title": "目标 mask 跟随被预测的 token",
          "lines": [
            28,
            32
          ],
          "explanation": "假设原输入中的 token 二和三属于回答，而 token 一仍属于 prompt，那么错位后的三个目标中只保留后两项。mask 的形状与 targets 对齐，不能不加思考地把原输入的四位置 mask 直接使用。负 logprob 取均值成为回答 token 的平均负对数似然；这里使用原模型分布，它与第三步的采样分布仍是两个明确对象。忽略 prompt 是训练目标选择，不是因果注意力会自动完成的动作。",
          "state": "仅两个回答目标计入分母，回答 NLL 是对应原模型 logprob 的负均值。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "保存一个 logprob 字段，不记录变换",
        "why": "温度、候选截断与惩罚都可能改变分布，之后无法判断这个概率能否用于训练或校准。",
        "fix": "同时记录分布定义、温度、过滤规则和目标 token 对齐方式。"
      },
      {
        "wrong": "序列越长，总 logprob 越低就说明质量越差",
        "why": "条件概率连乘会天然随长度变小，长短序列的总和不能直接当相同尺度置信度。",
        "fix": "先定义任务比较目标，再选择总和、长度归一化或独立任务指标。"
      }
    ],
    "check": {
      "prompt": "ID 二被 top-2 排除后，它在原始模型中有非零概率吗？在采样分布中的 logprob 是多少？",
      "hint": "候选过滤改变的是实际策略，不会倒过来修改原始 logits。",
      "answer": "原模型仍给 ID 二非零概率；当前 top-2 采样分布给它概率零、logprob 负无穷。"
    },
    "transfer": "读生成或训练接口时，给每个概率张量写上“哪个位置、哪个 token、哪种分布、是否应用 mask”。有了这四个坐标，再分析序列评分或强化学习比率才不会混淆语义。"
  },
  "distributed-1": {
    "scenario": "两台机器各有两张卡，你看到 WORLD_SIZE=4，就把全局 batch 乘四；同时又把 RANK=3 当成本机 GPU 编号。前者可能多算数据，后者可能选到不存在的设备。先为每个进程画出主机、全局身份、本地身份和通信组，比直接启动复杂模型更容易发现这类错误。",
    "prerequisites": [
      "training-2",
      "tensor-3"
    ],
    "terms": [
      {
        "name": "全局 rank",
        "meaning": "进程在整个默认通信组中的唯一编号，用于标识参与者，不等同于本机设备编号。"
      },
      {
        "name": "本地 rank",
        "meaning": "进程在当前主机内的编号，常用于选择可见 CUDA 设备；每台主机都会重新从零开始。"
      },
      {
        "name": "通信组",
        "meaning": "一组需要共同调用 collective 的进程，DP、TP 可以对应不同的成员集合。"
      }
    ],
    "observe": "本课图解显示两台主机、四个进程。步进比较第二台主机的 RANK=2/3 与 LOCAL_RANK=0/1；下面再给这四个身份分别安排 TP 与 DP 组，让全局进程数和数据并行度的区别具体可见。",
    "walkthrough": {
      "title": "用一张身份表推导设备映射和独立样本数",
      "intro": "这是单进程 CPU 数学模型：列表元素代表不同 rank，不会启动进程、初始化通信或访问 GPU。它只能验证编号和分组代数；真实 torchrun 与通信环境请运行原课程的多进程示例。",
      "code": "import torch\ntorch.set_num_threads(1)\nworld_size = 4\nlocal_world_size = 2\nidentities = [(rank, rank // local_world_size, rank % local_world_size)\n              for rank in range(world_size)]\nprint(f'(rank,host,local_rank)={identities}')\ntp_groups = [[0, 1], [2, 3]]\ndp_groups = [[0, 2], [1, 3]]\nprint(f'tp_groups={tp_groups}; dp_groups={dp_groups}')\nrank_values = torch.arange(1, 5)\ndp_sums = [None] * world_size\nfor group in dp_groups:\n    total = rank_values[group].sum().item()\n    for rank in group:\n        dp_sums[rank] = total\nprint(f'simulated_dp_group_sums={dp_sums}')\nsamples_per_microbatch = 2\naccumulation_steps = 3\ndp_degree = len(dp_groups[0])\neffective_samples = samples_per_microbatch * accumulation_steps * dp_degree\nwrong_samples = samples_per_microbatch * accumulation_steps * world_size\nprint(f'effective_samples={effective_samples}; using_world_size_wrongly={wrong_samples}')\nassert effective_samples == 12\nlocal_states = [torch.tensor([1.]) for _ in range(world_size)]\nlocal_states[0].add_(10.)\nprint(f'simulated_local_states={[state.item() for state in local_states]}')\nassert [state.item() for state in local_states] == [11., 1., 1., 1.]\n",
      "output": "(rank,host,local_rank)=[(0, 0, 0), (1, 0, 1), (2, 1, 0), (3, 1, 1)]\ntp_groups=[[0, 1], [2, 3]]; dp_groups=[[0, 2], [1, 3]]\nsimulated_dp_group_sums=[4, 6, 4, 6]\neffective_samples=12; using_world_size_wrongly=24\nsimulated_local_states=[11.0, 1.0, 1.0, 1.0]\n",
      "steps": [
        {
          "title": "全局编号与本地编号回答不同问题",
          "lines": [
            1,
            7
          ],
          "explanation": "全局 rank 连续为零到三，而本地编号由除以每机进程数的余数得到。rank 三位于第二台主机，本地编号为一，所以在一进程一卡的常见配置中绑定逻辑 GPU 一。逻辑设备编号还受 CUDA_VISIBLE_DEVICES 映射影响，不能直接推断物理卡号。这个身份表不意味着 torchrun 自动包装了 DDP；启动、初始化通信、放置模型、切分输入仍是不同步骤。",
          "state": "第二台主机的全局 rank 为 2、3，本地 rank 重新为 0、1。"
        },
        {
          "title": "一个 rank 可以属于多种组",
          "lines": [
            8,
            17
          ],
          "explanation": "本例每台主机内的两个 rank 用张量并行合作计算同一模型副本，所以 TP 组是 [0,1] 和 [2,3]。持有相同模型分片的 rank 跨副本组成 DP 组，分别是 [0,2] 和 [1,3]。把各 rank 本地数值一、二、三、四按 DP 组求和，结果分别是四与六，不能默认全世界一起求成十。通信函数的 group 参数决定参加者，公式中的 world size 也必须指向同一个组。",
          "state": "每个 rank 既属于一个 TP 组，也属于一个大小为 2 的 DP 组。"
        },
        {
          "title": "只有独立数据副本增加样本数",
          "lines": [
            18,
            24
          ],
          "explanation": "每个模型副本每个微批处理两个独立样本，累积三次，两个数据副本合计十二个。TP 组的两个 rank 处理的是同一批样本的不同计算部分，不产生额外独立训练数据。若再乘整个进程数四，会错误得到二十四，随后学习率缩放、吞吐统计和训练预算都可能跟着失真。真实系统还需要确认数据 sampler 与组划分匹配，否则名义上的 DP 副本也可能读到重复样本。",
          "state": "正确有效样本数为 2×3×2=12，TP 不再额外乘入。"
        },
        {
          "title": "独立进程没有默认共享参数内存",
          "lines": [
            25,
            28
          ],
          "explanation": "这里用独立张量模拟不同进程各自的状态，修改 rank 零不会自动改变其他副本。真实多个 Python 进程的内存隔离更加明确；模型一致性需要初始化同步、梯度通信和相同更新逻辑共同维持。不要把进程组想成共享 Python 列表，也不要认为一个 rank 加载了检查点其他 rank 就自动获得权重。单进程模型便于手算，但它没有测试通信时序、后端支持或网络可达性。",
          "state": "本地修改只影响一个模拟副本，其他值不变；同步必须由明确机制完成。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "使用全局 rank 选择本机 GPU",
        "why": "全局编号可能大于本机可见设备数，且不同主机的本地编号会重复。",
        "fix": "用 LOCAL_RANK 结合可见设备映射绑定设备，再记录全局身份用于日志。"
      },
      {
        "wrong": "每个 collective 都用默认全局组",
        "why": "混合并行中，不同操作只需要特定成员参与；用错组可能混合不同分片的数值或造成协议不一致。",
        "fix": "先写组成员表，确认每个算子的数据布局与归约组相匹配。"
      }
    ],
    "check": {
      "prompt": "若每台主机四个 rank 做 TP，两台主机对应两个 DP 副本，微批 2、累积 3，全局样本数是否变成 24？",
      "hint": "新增的是 TP 参与者还是独立数据副本？",
      "answer": "仍是 12。数据副本仍为两个，更多 TP rank 只是协作计算同一副本。"
    },
    "transfer": "启动多机前，把每个 rank 的主机、设备、DP/TP/PP 成员和输入数据范围列出来。先让最小 collective 通过，再加入模型；这样能把环境故障与训练语义错误分开定位。"
  },
  "distributed-2": {
    "scenario": "四个 rank 手里各有一段数据，你需要把它们组合起来，却不确定该用 all-reduce、all-gather 还是 reduce-scatter。先问两个问题：需要求和吗，最后每个 rank 要完整结果还是只要一片？本例用不同数量级的数值，让每个输出都能看出它来自哪些参与者。",
    "prerequisites": [
      "distributed-1",
      "tensor-2",
      "autograd-1"
    ],
    "terms": [
      {
        "name": "归约",
        "meaning": "对不同参与者的对应元素应用求和等运算，输出数值由多个输入共同产生。"
      },
      {
        "name": "收集",
        "meaning": "把各参与者的数据按约定顺序放在一起，通常不对数值求和。"
      },
      {
        "name": "分片输出",
        "meaning": "每个参与者只保留归约结果的一部分，片段身份属于布局契约而不是任意截取。"
      }
    ],
    "observe": "在图解中分别切换 All-reduce SUM、All-gather、Reduce-scatter SUM，步进到输出。注意 all-gather 保留每个来源的数值，而求和归约改变数值；reduce-scatter 切的是结果位置，不是把数值除以 rank 数。",
    "walkthrough": {
      "title": "先确定求和与布局，再选择 collective",
      "intro": "这是单进程 CPU 数学模型。用二维张量的行表示 rank，列表示该 rank 的本地元素；sum、stack 和 transpose 表达通信语义，没有调用真实分布式后端，也不能据此判断实际通信带宽。",
      "code": "import torch\ntorch.set_num_threads(1)\nlocal = torch.tensor([[1., 2., 3., 4.], [10., 20., 30., 40.],\n                      [100., 200., 300., 400.], [1000., 2000., 3000., 4000.]],\n                     dtype=torch.float64)\nprint(f'rank0_input={local[0].tolist()}')\nprint(f'rank3_input={local[3].tolist()}')\nreduced = local.sum(dim=0)\nall_reduced = reduced.repeat(4, 1)\nscalars = torch.tensor([1., 2., 3., 4.], dtype=torch.float64)\ngathered = scalars.repeat(4, 1)\nprint(f'all_reduce_each_rank={all_reduced[0].tolist()}')\nprint(f'all_gather_each_rank={gathered[0].tolist()}')\nassert torch.equal(all_reduced[0], all_reduced[3])\nreduce_scattered = [piece.tolist() for piece in reduced.chunk(4)]\nall_to_all = local.transpose(0, 1).contiguous()\nprint(f'reduce_scatter_rank_outputs={reduce_scattered}')\nprint(f'all_to_all_rank0={all_to_all[0].tolist()}')\nprint(f'all_to_all_rank1={all_to_all[1].tolist()}')\nassert reduce_scattered == [[1111.], [2222.], [3333.], [4444.]]\nx = torch.tensor(2., dtype=torch.float64, requires_grad=True)\ncopies = torch.stack([x, x])\nloss = 2 * copies[0] + 3 * copies[1]\nloss.backward()\nprint(f'copied_value_gradient={x.grad.item():.1f}')\nassert x.grad.item() == 5.\n",
      "output": "rank0_input=[1.0, 2.0, 3.0, 4.0]\nrank3_input=[1000.0, 2000.0, 3000.0, 4000.0]\nall_reduce_each_rank=[1111.0, 2222.0, 3333.0, 4444.0]\nall_gather_each_rank=[1.0, 2.0, 3.0, 4.0]\nreduce_scatter_rank_outputs=[[1111.0], [2222.0], [3333.0], [4444.0]]\nall_to_all_rank0=[1.0, 10.0, 100.0, 1000.0]\nall_to_all_rank1=[2.0, 20.0, 200.0, 2000.0]\ncopied_value_gradient=5.0\n",
      "steps": [
        {
          "title": "让来源在数值中可辨认",
          "lines": [
            1,
            7
          ],
          "explanation": "每行是一个 rank 的四个位置，列零分别为一、十、一百、一千。归约时“对应元素”是同一列，不是把整个二维表求成一个标量。不同数量级让错误轴更容易暴露：正确列零总和应为一千一百一十一。真实 collective 还要求设备、dtype、形状或分片大小满足接口约束；这张表只是让语义可见，不意味着任何不同形状都能直接拼接。",
          "state": "四行代表 rank，四列代表本地位置；将沿 rank 轴进行对应位置归约。"
        },
        {
          "title": "All-reduce 改数值，all-gather 保留来源",
          "lines": [
            8,
            14
          ],
          "explanation": "对矩阵按列求和，得到 [1111,2222,3333,4444]，all-reduce 语义要求每个成员最终都得到这一完整向量。单独的标量收集例子则让每个成员得到 [1,2,3,4]，保留来源顺序，没有把它们加成十。两者都可能让每卡输出更完整，但数学含义完全不同。DDP 的梯度平均建立在通信与缩放之上，原生 SUM 并不会自动除以进程数。",
          "state": "all-reduce 每卡拿到相同归约值；all-gather 每卡拿到按 rank 排列的原始片段。"
        },
        {
          "title": "归约后分片与重新路由",
          "lines": [
            15,
            20
          ],
          "explanation": "reduce-scatter 把归约后的四个位置分给四个 rank，所以 rank 零拿一千一百一十一，rank 一拿二千二百二十二。数值没有再除以四。“先求和再切片”是理解语义的方法，不要求后端真的先在每卡物化完整结果。all-to-all 则按目的地重排：约定每行第 j 个元素发给 rank j，接收端按来源 rank 排列，因而本例是转置。它可以用于专家路由等数据重分布，但不会自动进行求和。",
          "state": "reduce-scatter 的各片段拼回去等于归约向量；all-to-all 改变持有者而保留数值。"
        },
        {
          "title": "反向必须收集所有使用路径的贡献",
          "lines": [
            21,
            26
          ],
          "explanation": "把 x 的值提供给两个使用者，第一个贡献上游梯度二，第二个贡献三，源变量应收到总梯度五。这个本地可微模型说明了收集或复制之后的反向为何常需要跨使用者累加。普通 torch.distributed imperative 调用不能因为输入 requires_grad=True 就一概视为可微通信；应使用文档明确支持的路径，并与单进程全局目标比较反向。只有前向数值对齐，仍可能漏掉梯度倍数。",
          "state": "两个副本的梯度贡献回到同一个源输入，得到 2+3=5。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "把 reduce-scatter 理解成 all-reduce 后每个数除以组大小",
        "why": "scatter 分配的是不同位置，SUM 的数值本身并未做平均。",
        "fix": "分别标出归约运算和目标分片，只有算法明确定义平均时才额外缩放。"
      },
      {
        "wrong": "async_op=True 后立即使用输出",
        "why": "异步返回时通信可能未完成，读取没有建立依赖的结果会产生竞争。",
        "fix": "在消费结果前使用正确的 Work 或流同步；独立计算才可安排在重叠区间。"
      }
    ],
    "check": {
      "prompt": "若 rank 零想获得四个标量的总和，而其他 rank 不需要结果，all-gather 是否就是最直接的语义？",
      "hint": "先判断是否要保留各来源，再判断谁需要输出。",
      "answer": "目标是归约且只有一个目的 rank，可考虑 reduce 到该 rank；all-gather 先收集再手动求和能表达结果，但通信输出契约不同。"
    },
    "transfer": "给每个通信点写“输入布局→数学操作→输出布局”。之后再查成员顺序、后端支持、自动求导和异步依赖，能避免把一切多卡数据交换都叫作同步。"
  },
  "distributed-3": {
    "scenario": "两个数据并行副本分别拿到二个和六个有效 token，DDP 会平均梯度。若你让每个副本先算本地 mean，较短副本就占了过高权重。下面让可微损失在当前参数处恰好对应图解中的数值，并打印每个微批之后的本地梯度，直接证明全局系数为什么必须包含 DP 组大小。",
    "prerequisites": [
      "distributed-1",
      "distributed-2",
      "training-2"
    ],
    "terms": [
      {
        "name": "局部损失和",
        "meaning": "一个 rank 在整次更新窗口内所有有效 token 损失的总和，尚未按本地长度取平均。"
      },
      {
        "name": "全局分母",
        "meaning": "所有参与数据并行副本的有效 token 数之和；必须与同一更新窗口和通信组对应。"
      },
      {
        "name": "DDP 默认平均",
        "meaning": "同步后得到各 rank 梯度的平均；自定义通信 hook 或其他策略可能改变该语义。"
      }
    ],
    "observe": "本课图解先显示局部均值一和三，再显示缩放后的零点五和四点五。向后步进看符号梯度公式。本例不仅计算这些损失值，还构造依赖 w 的函数，让最终梯度五与错误梯度四可直接验证。",
    "walkthrough": {
      "title": "从局部微批梯度推导全局 token 平均",
      "intro": "这是单进程 CPU 数学模型，不是真实 DDP，也不模拟通信时序。每个 token 损失定义为 c·w²，rank 零的 c 为 [1,1]，rank 一为六个 3；所有副本的 w 都从 1 开始。这样损失和为 2 与 18，但梯度并不是常数求导。",
      "code": "import torch\ntorch.set_num_threads(1)\ncoefficients = [torch.tensor([1., 1.], dtype=torch.float64),\n                torch.tensor([3., 3., 3., 3., 3., 3.], dtype=torch.float64)]\nworld = len(coefficients)\ncounts = [c.numel() for c in coefficients]\ntotal = sum(counts)\nsums_at_one = [c.sum().item() for c in coefficients]\nprint(f'counts={counts}; global_tokens={total}; local_sums={sums_at_one}')\nprint(f'mean_of_local_means={sum(s/n for s,n in zip(sums_at_one,counts))/world:.1f}')\nprint(f'global_token_mean={sum(sums_at_one)/total:.1f}')\nlocal_grads = []\nfor rank, coefficients_on_rank in enumerate(coefficients):\n    w = torch.tensor(1., dtype=torch.float64, requires_grad=True)\n    for micro, chunk in enumerate(coefficients_on_rank.chunk(2), 1):\n        local_loss_sum = (chunk * w.square()).sum()\n        (local_loss_sum * world / total).backward()\n        print(f'rank={rank}; micro={micro}; accumulated_grad={w.grad.item():.1f}')\n    local_grads.append(w.grad.detach().clone())\nsimulated_ddp_grad = torch.stack(local_grads).mean()\nprint(f'simulated_ddp_grad={simulated_ddp_grad.item():.1f}')\nreference = torch.tensor(1., dtype=torch.float64, requires_grad=True)\nall_coefficients = torch.cat(coefficients)\nreference_loss = (all_coefficients * reference.square()).mean()\nreference_loss.backward()\nprint(f'reference_loss={reference_loss.item():.1f}; reference_grad={reference.grad.item():.1f}')\ntorch.testing.assert_close(simulated_ddp_grad, reference.grad)\nwrong_grads = []\nfor c in coefficients:\n    w = torch.tensor(1., dtype=torch.float64, requires_grad=True)\n    (c * w.square()).mean().backward()\n    wrong_grads.append(w.grad.detach())\nwrong = torch.stack(wrong_grads).mean()\nprint(f'wrong_average_local_grad={wrong.item():.1f}')\nassert wrong.item() == 4.\nassert simulated_ddp_grad.item() == 5.\n",
      "output": "counts=[2, 6]; global_tokens=8; local_sums=[2.0, 18.0]\nmean_of_local_means=2.0\nglobal_token_mean=2.5\nrank=0; micro=1; accumulated_grad=0.5\nrank=0; micro=2; accumulated_grad=1.0\nrank=1; micro=1; accumulated_grad=4.5\nrank=1; micro=2; accumulated_grad=9.0\nsimulated_ddp_grad=5.0\nreference_loss=2.5; reference_grad=5.0\nwrong_average_local_grad=4.0\n",
      "steps": [
        {
          "title": "先确定同一个全局训练目标",
          "lines": [
            1,
            11
          ],
          "explanation": "当前 w=1，各 token 的损失就是它自己的系数。短 rank 总损失二、计数二，均值一；长 rank 总损失十八、计数六，均值三。本地均值再平均得到二，但全部八个 token 的均值是二点五。差异不是通信误差，而是每个 token 权重不同：正确目标对每个 token 给八分之一权重。我们先确定这个目标，之后才能判断 DDP 的平均需要怎样补偿。",
          "state": "错误均值为 2，正确全局 token 均值为 2.5，目标分母固定为 8。"
        },
        {
          "title": "把默认平均提前补偿到每个微批",
          "lines": [
            12,
            21
          ],
          "explanation": "每个局部 loss sum 乘 W/N=2/8，梯度也乘同一比例。rank 零两个微批各含一个系数一，梯度分别贡献零点五，最终为一；rank 一每个微批含三个系数三，分别贡献四点五，最终为九。模拟 DDP 取两边梯度平均，得到五。没有再除累积次数，因为全窗口分母已经包含全部 token。真实 no_sync 应包住前几次前向和反向，最后一个匹配微批触发同步。",
          "state": "本地累积梯度为 1 和 9；默认 DDP 平均后为 5。"
        },
        {
          "title": "用一份全局张量作独立参考",
          "lines": [
            22,
            27
          ],
          "explanation": "全局目标可以写成二点五乘 w²，所以在 w=1 时梯度为五。独立参考直接拼接八个系数求均值，既不使用局部缩放代码，也不依赖模拟通信，断言两条路径一致。验证分布式时，不能只比较各 rank 梯度是否相同：即使大家共享同一个错误倍数，也会完全相等。参考目标还应固定随机性、参数起点与有效 mask，避免把不同前向行为误当成通信问题。",
          "state": "全局参考 loss=2.5、grad=5，与正确缩放路径一致。"
        },
        {
          "title": "本地均值会给出另一条梯度",
          "lines": [
            28,
            36
          ],
          "explanation": "错误路径的两个本地 mean 分别是一乘 w²和三乘 w²，梯度为二与六，平均得到四。这相当于让两个 rank 等权，而不是八个 token 等权。如果任务本来定义每序列等权，应重新推导分母，而非无条件套 token 平均。计数为零时还涉及协议：全局为零要共同跳过，本地为零但其他 rank 有数据时仍需参与匹配通信，不能自行退出。",
          "state": "错误梯度为 4，尽管它也能在全部 rank 上同步成一致的值。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "已经除以全局 token 数，就无需乘 W",
        "why": "默认 DDP 还会再平均一次，相当于额外除以 W，最终梯度被缩小。",
        "fix": "从 (1/W)Σ梯度反推每个局部目标的系数，确认没有自定义 hook 改变语义。"
      },
      {
        "wrong": "一个 rank 没有有效 token 就跳过 backward",
        "why": "其他成员可能仍等待同一步梯度通信，形成控制流分叉。",
        "fix": "统一有效计数和更新协议，确保所有成员的通信顺序及同步边界一致。"
      }
    ],
    "check": {
      "prompt": "如果 DDP 组大小从 2 变成 4，而全窗口有效 token 数仍是 8，每个局部 loss sum 应乘什么？",
      "hint": "目标仍需抵消同步时的 1/W 平均。",
      "answer": "应乘 4/8=0.5，前提是默认梯度平均且四个 rank 共同覆盖这八个有效 token；不是继续固定乘 2/8。"
    },
    "transfer": "把分布式训练的损失记录和反向目标分开：日志归约 detached 的总损失与计数后相除，反向则按 reducer 语义补偿。不要把用于训练的局部缩放值直接当全局报告损失。"
  },
  "distributed-4": {
    "scenario": "验证集有五个样本，用两个 rank 跑 DistributedSampler 后，指标变好了。模型没有改变，变化可能只是样本零被补齐计算了两遍。训练需要步数整齐，而评估需要范围与分母准确，这两个目标不能只靠同一个 drop_last 开关同时保证。",
    "prerequisites": [
      "distributed-1",
      "distributed-2",
      "data-3",
      "data-4"
    ],
    "terms": [
      {
        "name": "索引补齐",
        "meaning": "当样本数不能整除副本数时，复用部分索引补足长度，使各 rank 得到相同数量。"
      },
      {
        "name": "有效评估范围",
        "meaning": "指标究竟覆盖哪些真实样本及其次数；多算或漏算都可能改变结果。"
      },
      {
        "name": "通信协议一致",
        "meaning": "同一组成员以匹配顺序参加 collective；相同步数只是必要条件之一，还要核对算子与形状。"
      }
    ],
    "observe": "图解中切换补齐和丢尾，观察索引零重复出现或索引四被删除。图解使用 shuffle=False，本例保持相同设定，随后把每个样本是否预测正确也放进去，让计数偏差直接变成指标偏差。",
    "walkthrough": {
      "title": "五个真实样本，为什么会统计成六次或四次",
      "intro": "使用 CPU DistributedSampler 直接生成各 rank 索引，无需启动进程；num_replicas 和 rank 显式传入。后半段的协议比较是单进程列表模型，不会模拟真正的网络超时。真实并行初始化与恢复仍需原课程的多进程验证。",
      "code": "import torch\nfrom torch.utils.data import DistributedSampler\ntorch.set_num_threads(1)\ndataset = list(range(5))\ncorrect_by_id = torch.tensor([1., 0., 1., 0., 1.], dtype=torch.float64)\ndef shards(drop_last):\n    return [list(DistributedSampler(dataset, num_replicas=2, rank=rank,\n                                    shuffle=False, drop_last=drop_last))\n            for rank in range(2)]\nprint(f'true_accuracy={correct_by_id.mean().item():.6f}')\npadded = shards(False)\npadded_ids = [sample for rank_ids in padded for sample in rank_ids]\npadded_accuracy = correct_by_id[padded_ids].mean()\nprint(f'padded_shards={padded}')\nprint(f'padded_total={len(padded_ids)}; unique={len(set(padded_ids))}; accuracy={padded_accuracy.item():.6f}')\ndropped = shards(True)\ndropped_ids = [sample for rank_ids in dropped for sample in rank_ids]\nprint(f'dropped_shards={dropped}')\nprint(f'dropped_total={len(dropped_ids)}; accuracy={correct_by_id[dropped_ids].mean().item():.6f}')\nunique_ids = sorted(set(padded_ids))\nprint(f'deduplicated_accuracy={correct_by_id[unique_ids].mean().item():.6f}')\nassert unique_ids == dataset\nmatching = [['forward', 'backward', 'all_reduce']] * 2\nmismatched = [['forward', 'backward', 'all_reduce'], ['forward', 'skip']]\ndef same_protocol(events):\n    return all(events[0] == sequence for sequence in events[1:])\nprint(f'matching_protocol={same_protocol(matching)}')\nprint(f'mismatched_protocol={same_protocol(mismatched)}')\nassert not same_protocol(mismatched)\n",
      "output": "true_accuracy=0.600000\npadded_shards=[[0, 2, 4], [1, 3, 0]]\npadded_total=6; unique=5; accuracy=0.666667\ndropped_shards=[[0, 2], [1, 3]]\ndropped_total=4; accuracy=0.500000\ndeduplicated_accuracy=0.600000\nmatching_protocol=True\nmismatched_protocol=False\n",
      "steps": [
        {
          "title": "明确真实评估集与正确数",
          "lines": [
            1,
            10
          ],
          "explanation": "真实样本 ID 为零到四，其中零、二、四预测正确，总体准确率应为三除以五。这个分母来自任务定义，而不是当前 DataLoader 总共吐出了多少行。只有当每条输出对应一个不重复且不遗漏的真实样本时，两种计数才相同。先保留样本身份与原始范围，后续才有能力检查补齐、重复、过滤或重试对指标的影响。",
          "state": "评估目标固定为 5 个不同样本，正确 3 个，accuracy=0.6。"
        },
        {
          "title": "补齐让步数整齐，但重复样本",
          "lines": [
            11,
            15
          ],
          "explanation": "不丢尾时，总长度被补成六。原顺序后追加样本零，再按每隔两个索引分配，rank 零得到 [0,2,4]，rank 一得到 [1,3,0]。两个 rank 各三项，便于安排匹配训练步骤；但样本零预测正确，被重复计入后，正确数从三变四，分母从五变六，准确率变成三分之二。即使聚合代码严格累加正确数与样本数，仍会忠实统计一个错误的评估样本集合。",
          "state": "补齐输出 6 次、只有 5 个唯一样本，accuracy≈0.666667。"
        },
        {
          "title": "丢尾不重复，却遗漏了目标样本",
          "lines": [
            16,
            22
          ],
          "explanation": "丢尾只保留前四个索引，两个 rank 各两项，确实没有重复，却漏掉本来预测正确的样本四，所以准确率降为二除以四。它不是完整五样本评估的修复方案。这里通过 ID 去重恢复原集合，仅因为我们掌握每个样本的固定预测结果；真实任务还应确保随机评估关闭、同一 ID 的重复结果一致。也可以设计不补齐的评估分片，但需要另行处理不等迭代长度的通信协议。",
          "state": "丢尾 accuracy=0.5；按样本 ID 去重后恢复真实 accuracy=0.6。"
        },
        {
          "title": "样本完整性和通信一致性分别验证",
          "lines": [
            23,
            29
          ],
          "explanation": "列表仅表示两个 rank 本应经过的阶段。一个成员因本地条件跳过反向，而另一个进入 all_reduce，后者可能表现为等待超时；超时位置不一定是最早错误位置。真实诊断要收集所有 rank 的步骤号、异常和 collective 顺序，而不是不断添加 barrier。保存分片检查点也有参与协议，不能假设只让 rank 零调用任何保存接口都安全；检查点、采样位置与每个 rank 的随机状态应共同设计恢复边界。",
          "state": "匹配路径通过，跳过反向的路径被识别为不一致；该模型没有执行真实通信。"
        }
      ]
    },
    "pitfalls": [
      {
        "wrong": "改成 drop_last=True 就能保证评估准确",
        "why": "它避免补齐重复，却可能遗漏尾部样本；指标对应的集合仍然改变。",
        "fix": "按任务要求覆盖全部样本，使用不补齐评估分片或按身份去重，并明确通信安排。"
      },
      {
        "wrong": "只看卡住的 rank，把超时调大",
        "why": "等待者可能只是受其他 rank 异常或分支影响，增加等待不能补回缺失参与者。",
        "fix": "从所有 rank 的最早分歧查起，关联数据加载、前向、反向和通信阶段。"
      }
    ],
    "check": {
      "prompt": "如果被补齐的样本零恰好预测错误，本例补齐后的准确率会变成多少？",
      "hint": "此时五个真实样本只有二、四正确，重复零不会增加正确数。",
      "answer": "真实准确率为 2/5=0.4，补齐后为 2/6≈0.333333。补齐偏差方向取决于被重复样本，不总使指标升高。"
    },
    "transfer": "在分布式评估日志中同时记录输出次数、唯一样本数与任务期望范围。恢复训练时再核对各 rank 的数据进度和协议，不要只用一个全局 epoch 数代替完整执行状态。"
  }
};
