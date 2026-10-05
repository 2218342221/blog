window.COURSE_FOUNDATIONS = [
  {
    "id": "tensor",
    "number": 1,
    "title": "张量与内存",
    "subtitle": "看懂每一个 shape 背后的内存",
    "description": "从张量布局、广播和数值精度出发，理解深度学习计算的表示方式与性能边界。",
    "level": "基础",
    "color": "#58a700",
    "icon": "tensor",
    "lessons": [
      {
        "id": "tensor-1",
        "title": "Shape、stride 与共享存储",
        "description": "张量不只是多维数组：学会从元数据推导真实的内存访问。",
        "duration": 18,
        "difficulty": "基础",
        "objectives": [
          "用 shape、stride 和 storage_offset 定位元素",
          "判断两个张量是否可能共享底层存储",
          "解释切片为什么可能保留一整块大内存"
        ],
        "sections": [
          {
            "heading": "张量的逻辑索引，怎样落到一维存储",
            "body": "本课讨论普通稠密 strided 张量。你在 Python 中看到的矩阵，是一块一维存储按照元数据解释出来的结果。shape 给出每个逻辑轴的长度；stride 给出沿该轴移动一步，要跨过多少个存储元素；storage_offset 指出逻辑首元素相对存储起点的偏移；dtype 决定每个元素占多少字节。理解这四者，就能从一个多维索引计算实际访问位置。\n\n设张量有 d 个轴，索引是 i，步长是 s，偏移是 o。先计算以“元素”为单位的位置 k，再乘每元素字节数 b，才得到字节地址。所有索引与存储位置都从零开始；stride 和 offset 本身并不是字节数。这一区分会直接影响切片、转置和底层算子的索引公式。\n\n逻辑元素个数是各轴长度的乘积，但它不总等于独立存储元素的数量。一个视图可以只使用原存储的一小部分，也可以让多个逻辑元素指向同一个存储位置。先区分“逻辑上有几个值”和“实际保留了哪块存储”，再讨论内存占用。",
            "formula": "k=o+\\sum_{j=0}^{d-1}i_j s_j,\\qquad \\operatorname{address}(i)=\\operatorname{storage\\_ptr}+k\\,b",
            "figure": {
              "type": "table",
              "caption": "一份张量描述信息：下面的单位不能互换。",
              "columns": [
                "属性",
                "回答的问题",
                "单位或例子"
              ],
              "rows": [
                [
                  "shape",
                  "每个轴有多少个逻辑元素",
                  "(3, 4)"
                ],
                [
                  "stride",
                  "沿每个轴前进一步跨多少元素",
                  "(4, 1)，单位：元素"
                ],
                [
                  "storage_offset",
                  "逻辑首元素在存储中的位置",
                  "0，单位：元素"
                ],
                [
                  "dtype / element_size",
                  "每个存储元素如何解释",
                  "int64 / 8 字节"
                ]
              ]
            },
            "bodyAfter": "地址公式描述普通 strided 布局。稀疏、量化及其他布局可能有额外索引或元数据，不能只凭这一个公式推断其全部存储结构。"
          },
          {
            "heading": "连续矩阵：从最后一维开始建立步长",
            "body": "考虑由 0 到 11 构成的连续存储，把它解释成三行四列。列索引增加一时，读取下一个元素，所以列步长为 1；行索引增加一时，需要跳过四个元素，所以行步长为 4。元素 x[2,1] 的存储位置是 2×4+1×1=9，读出的数值也恰好为 9。这里数值与位置相同，是因为例子使用了 arange，实际数据当然不必如此。\n\n对于没有退化维度的标准连续张量，最后一个轴步长为 1，前一轴的步长等于后一轴的步长乘后一轴长度。这个递推关系把多维按行遍历变成连续的一维访问。尺寸为 1 的轴不会产生真实的轴向移动，因而连续性判断不能机械要求其 stride 必须取某个唯一值。\n\n下面同时检查形状、步长、首偏移与字节地址差。所有数据都在 CPU，检查的是张量布局，不是 CUDA 分配器预留内存，也不是 Python 对象本身的大小。",
            "formula": "s_{d-1}=1,\\qquad s_j=n_{j+1}s_{j+1}\\quad\\text{(standard contiguous layout)}",
            "code": "import torch\nx = torch.arange(12, dtype=torch.int64).reshape(3, 4)\nassert x.shape == (3, 4)\nassert x.stride() == (4, 1)\nassert x.storage_offset() == 0\nposition = 2 * x.stride(0) + 1 * x.stride(1)\nassert position == 9\nassert x[2, 1].item() == 9\nassert x[2, 1].data_ptr() - x.data_ptr() == position * 8\nprint(x)\nprint(\"stride:\", x.stride(), \"element bytes:\", x.element_size())",
            "language": "python"
          },
          {
            "heading": "转置只改变坐标解释，不必搬动元素",
            "body": "令 y=x.t()。转置交换两个逻辑轴，shape 从 [3,4] 变为 [4,3]，stride 从 [4,1] 变为 [1,4]。y[1,2] 对应 x[2,1]，地址仍是 1×1+2×4=9。底层值没有重新排成一份连续的四行三列矩阵；改变的是“怎样把新坐标映射回原存储”。\n\n这也解释了为什么连续性发生变化。沿 y 的最后一维依次读取，要跨过四个元素，而不是读取相邻位置。转置这一步可能几乎不搬数据，后续算子却需要处理不同的访存顺序，或者先复制成它支持的布局。不能只根据 transpose 本身很快，就断言整条计算路径没有布局成本。\n\npermute 是相同原理在更多维度上的推广。读多头注意力的 [B,T,H,D]→[B,H,T,D] 时，同时记下每条轴的含义与步长，能避免把“轴重新排列”和“按新顺序实际复制”混为一谈。",
            "figure": {
              "type": "table",
              "caption": "转置后的几个坐标仍指向原来的存储。",
              "columns": [
                "y 的索引",
                "等价 x 索引",
                "存储位置"
              ],
              "rows": [
                [
                  "y[0,0]",
                  "x[0,0]",
                  "0"
                ],
                [
                  "y[0,1]",
                  "x[1,0]",
                  "4"
                ],
                [
                  "y[1,2]",
                  "x[2,1]",
                  "9"
                ],
                [
                  "y[3,2]",
                  "x[2,3]",
                  "11"
                ]
              ]
            },
            "code": "import torch\nx = torch.arange(12).reshape(3, 4)\ny = x.t()\nassert y.shape == (4, 3)\nassert y.stride() == (1, 4)\nassert y[1, 2].item() == x[2, 1].item() == 9\nassert y.untyped_storage().data_ptr() == x.untyped_storage().data_ptr()\nassert x.is_contiguous() and not y.is_contiguous()\nprint(y)",
            "language": "python"
          },
          {
            "heading": "切片：偏移与步长必须一起更新",
            "body": "取 s=x[1:,1::2]：从第二行、第二列开始，每隔一列读取一次。起点从存储位置 0 移到 1×4+1=5；行方向仍跨四个元素；列方向从一步跨一个变成一步跨两个。因此 s 的 shape=[2,2]、stride=(4,2)、offset=5，四个坐标依次访问位置 5、7、9、11。\n\n请把 s[1,1] 的索引代入公式，得到 5+1×4+1×2=11。这是从零开始的存储位置 11，也就是第 12 个元素。只看 shape=[2,2] 并假定 stride=(2,1)，会读到完全不同的位置。这类错误在手写 kernel、打包序列和缓存切片中尤其隐蔽，因为输出形状可能完全合法。\n\ns 逻辑上只有四个 int64 元素，逻辑大小是 32 字节，却仍保留原来 12 个元素对应的 96 字节存储。长时间缓存一个小切片，可能让原来的大块分配无法释放。确实需要独立快照时，可以用 clone 复制；是否复制，应取决于生命周期和后续使用，而不是一概追求零复制。",
            "formula": "k(s_{1,1})=5+1\\cdot4+1\\cdot2=11",
            "code": "import torch\nx = torch.arange(12, dtype=torch.int64).reshape(3, 4)\ns = x[1:, 1::2]\nassert s.tolist() == [[5, 7], [9, 11]]\nassert s.stride() == (4, 2) and s.storage_offset() == 5\nassert s.numel() * s.element_size() == 32\nassert s.untyped_storage().nbytes() == 96\nindependent = s.clone()\nassert independent.untyped_storage().data_ptr() != x.untyped_storage().data_ptr()\nprint(\"logical bytes:\", 32, \"retained storage bytes:\", 96)",
            "language": "python"
          },
          {
            "heading": "共享存储、独立副本与梯度关系是两条轴",
            "body": "变量名不同并不代表数据独立。基本切片和转置通常返回视图，修改视图中的值会影响原张量。clone 创建数据副本；如果输入需要梯度，clone 仍是可微操作。detach 切断与原计算图的联系，却通常继续共享存储。因此“是否复制数据”和“是否保留梯度路径”需要分别判断。\n\n要保存既不受后续原地修改影响、也不连接旧图的快照，可使用 x.detach().clone()。不要把 detach 当作保护原张量的复制操作。前向已经保存某个值供反向使用时，即使通过 detached 别名修改它，也可能触发版本计数检查，使 backward 报出原地修改相关错误。\n\n相同的底层 storage 指针能提示共享存储，却不能证明两个切片访问了相同元素。两个互不重叠的切片也可能属于同一存储。反过来，直接比较 tensor.data_ptr 可能漏掉共享关系，因为不同 offset 的视图具有不同首元素地址。判断危险写入时，需要进一步分析各自访问的索引集合。",
            "figure": {
              "type": "table",
              "caption": "数据所有权与自动微分关系应分开检查。",
              "columns": [
                "操作",
                "是否独立复制数据",
                "是否切断原图"
              ],
              "rows": [
                [
                  "y = x",
                  "否",
                  "否"
                ],
                [
                  "y = x.detach()",
                  "否",
                  "是"
                ],
                [
                  "y = x.clone()",
                  "是",
                  "否，输入需要梯度时仍可微"
                ],
                [
                  "y = x.detach().clone()",
                  "是",
                  "是"
                ]
              ]
            },
            "code": "import torch\nx = torch.tensor([1., 2.], requires_grad=True)\nalias = x.detach()\nsnapshot = x.detach().clone()\nalias[0] = 9\nassert x[0].item() == 9\nassert snapshot.tolist() == [1., 2.]\nz = torch.tensor([2., 3.], requires_grad=True)\nz.clone().square().sum().backward()\ntorch.testing.assert_close(z.grad, torch.tensor([4., 6.]))\nprint(\"clone keeps the differentiable path; detach alone keeps storage\")",
            "language": "python"
          },
          {
            "heading": "Expand 的零步长：多个逻辑位置指向同一个值",
            "body": "广播可以用零步长表达重复读取。把 [10,20,30] 扩展成四行三列时，不必实际复制四份数据；新增行轴的 stride 为 0，列轴的 stride 为 1。无论选择第几行，地址公式中的行贡献都是 i×0，因此每列重复指向同一个底层元素。\n\n零步长视图适合读取，却不适合任意批量原地写入：你以为在写多个独立位置，实际可能多次写同一个地址。PyTorch 会拒绝许多这类有重叠的写法；若确实需要每行拥有独立数据，应先 clone。更底层的 as_strided 可以构造复杂布局，但错误的重叠假设不会因为张量形状合法而自动变安全。\n\n反向传播也要尊重重复使用：同一个输入值被四行使用，四条路径的梯度会相加。下面对所有扩展元素求和，原始向量的每个元素梯度都是 4。这既是广播反向的直观解释，也是后续自定义算子中“把广播梯度归约回原形状”的依据。",
            "formula": "k(i,j)=o+i\\cdot0+j\\cdot1=j",
            "code": "import torch\na = torch.tensor([10., 20., 30.], requires_grad=True)\nb = a.unsqueeze(0).expand(4, 3)\nassert b.stride() == (0, 1)\nassert b[0, 2].data_ptr() == b[3, 2].data_ptr()\nb.sum().backward()\ntorch.testing.assert_close(a.grad, torch.full((3,), 4.0))\nwritable = b.detach().clone()\nwritable[0, 0] = -1\nassert a[0].item() == 10\nprint(\"expanded stride:\", b.stride(), \"input gradient:\", a.grad)",
            "language": "python"
          },
          {
            "heading": "把布局知识变成可复现的排查步骤",
            "body": "遇到 shape 正确但数值异常、view 报错或显存意外增大时，先为每条轴写明语义，再打印 shape、stride、storage_offset、dtype、device 和 is_contiguous。接着用两个具体坐标手算存储位置，检查是否与预期相同。第三步检查对象之间是否共享存储，以及是否存在原地修改；最后再判断消费算子要求怎样的布局。\n\nview 要求已有 stride 能支持新的坐标解释；reshape 在必要时可以复制；contiguous 保证指定内存格式，但输入已经满足时可能直接返回原对象。三者都不能单凭函数名判断“必然复制”或“必然独立”。需要独立快照时明确 clone，需要特定布局时按算子契约规范化。\n\n性能判断应放到真实消费路径中。非连续张量并不必然缓慢，连续化也不必然值得：一次大复制可能比支持 stride 的算子更贵。先证明逻辑正确，再用 profiler 或合适计时测量整体效果，才能决定是否改变布局。",
            "figure": {
              "type": "table",
              "caption": "排查顺序：先语义，再所有权，最后测性能。",
              "columns": [
                "步骤",
                "记录或检查",
                "能回答的问题"
              ],
              "rows": [
                [
                  "1. 标轴",
                  "B/T/H/D 等含义与 shape",
                  "是否交换错语义轴"
                ],
                [
                  "2. 算地址",
                  "stride、offset、两个具体索引",
                  "是否读取了预期元素"
                ],
                [
                  "3. 查别名",
                  "storage 与原地写入路径",
                  "修改是否影响其他张量"
                ],
                [
                  "4. 查算子",
                  "支持的 stride / memory_format",
                  "是否需要规范化布局"
                ],
                [
                  "5. 测整体",
                  "复制、后续 kernel、峰值内存",
                  "优化是否有真实收益"
                ]
              ]
            },
            "callout": "本课最重要的检查不是记住某个 stride，而是能从任意合法索引，推导它访问的存储位置，并解释它与其他视图的关系。"
          }
        ],
        "takeaways": [
          "索引映射由 storage_offset + Σ(index × stride) 决定，stride 的单位是元素。",
          "视图共享存储；clone 复制数据，detach 只切断梯度关系。",
          "小切片也可能保留大存储；布局成本常发生在后续消费算子中。"
        ],
        "references": [
          {
            "label": "PyTorch · Tensor Views",
            "url": "https://docs.pytorch.org/docs/stable/tensor_view.html"
          },
          {
            "label": "Tensor.stride",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.stride.html"
          }
        ],
        "quiz": [
          {
            "id": "tensor-1-q1",
            "type": "single",
            "topic": "张量布局",
            "prompt": "x = arange(12).reshape(3, 4)，y = x.t()。y 的 stride 是多少？",
            "options": [
              "(1, 4)",
              "(3, 1)",
              "(4, 1)",
              "(1, 3)"
            ],
            "answer": 0,
            "explanation": "x 的 stride 是 (4, 1)，转置交换两个轴，得到 (1, 4)。转置没有按新形状重新生成连续存储，因此不是新连续布局的 (3, 1)。"
          },
          {
            "id": "tensor-1-q2",
            "type": "single",
            "topic": "共享存储",
            "prompt": "需要保存一份与 x 不共享存储、也不连接原计算图的数据快照，应使用哪项？",
            "options": [
              "snapshot = x",
              "snapshot = x.detach()",
              "snapshot = x.detach().clone()",
              "snapshot = x.view_as(x)"
            ],
            "answer": 2,
            "explanation": "detach 切断计算图但共享存储，clone 再生成独立副本。赋值只是引用同一对象，view_as 通常也共享存储。"
          },
          {
            "id": "tensor-1-q3",
            "type": "single",
            "topic": "存储偏移",
            "prompt": "对 x = arange(12).reshape(3, 4)，s = x[1:, 1::2]。s[1, 1] 的存储元素位置是多少？",
            "options": [
              "5",
              "7",
              "9",
              "11"
            ],
            "answer": 3,
            "explanation": "s 的 offset 为 5，stride 为 (4, 2)，所以位置是 5 + 1×4 + 1×2 = 11。5 仅仅是 s 的首元素位置。"
          }
        ]
      },
      {
        "id": "tensor-2",
        "title": "索引、广播与 einsum",
        "description": "把 batch、sequence、head 等轴变成可以逐步验证的形状公式。",
        "duration": 20,
        "difficulty": "进阶",
        "objectives": [
          "逐轴判断广播是否合法并识别隐式扩张",
          "用 gather 从每个位置选出目标 token 的值",
          "推导多头注意力的 einsum 和 mask 形状"
        ],
        "sections": [
          {
            "heading": "广播从右边对齐，语义由你保证",
            "body": "两个张量做逐元素运算时，维度从右向左对齐。对应维度要么相等，要么其中一个为 1；缺失的前导维度按 1 处理。例如 [B, T, D] 加 [D] 会把同一份特征偏置用于全部 batch 和 token。广播通常不需要先物化一整份扩展输入，但结果本身仍然可能非常大。\n\n形状合法并不等于语义正确。对于这里的 [B,T,D]，如果 B 恰好等于 D，一个 [B] 的权重会从右侧对齐到特征轴 D，而不是样本轴 B，却可能完全不报错。请把轴含义写在注释中，并通过 unsqueeze 显式放置广播维度。做归一化时 keepdim=True 往往能保留正确的轴位置。",
            "code": "import torch\nx = torch.arange(24.).reshape(2, 3, 4)  # B, T, D\nbias = torch.arange(4.)                # D\ny = x + bias                          # 2, 3, 4\ncenter = x.mean(dim=-1, keepdim=True)   # 2, 3, 1\nz = x - center                        # 2, 3, 4\nsample_weight = torch.tensor([1., 2.])\nw = sample_weight[:, None, None]      # 2, 1, 1\nprint((z * w).shape)                  # [2, 3, 4]",
            "language": "python"
          },
          {
            "heading": "索引不是同一种操作",
            "body": "普通整数和切片组成的基本索引通常返回视图；整数张量或布尔张量参与的高级索引通常返回副本。注意，x[index] = value 是对 x 的索引赋值，不等于先取一个独立结果再修改。布尔选择还会压缩被选择位置，常常使原来的 batch 与 sequence 轴信息丢失。\n\n训练语言模型时，经常要从 [B, T, V] 的 log probability 中按 [B, T] 的 token id 选值。gather 要求 index 与输入具有相同维数，输出形状就是 index 的形状；因此先在最后增加一个长度为 1 的轴，再 gather，最后 squeeze 该轴，得到 [B, T]。",
            "code": "import torch\nlogp = torch.arange(30.).reshape(2, 3, 5)\nids = torch.tensor([[1, 0, 4], [2, 3, 1]])  # B, T\nchosen = logp.gather(dim=-1, index=ids.unsqueeze(-1))\nprint(chosen.shape)              # [2, 3, 1]\nprint(chosen.squeeze(-1).tolist())\n# [[1.0, 5.0, 14.0], [17.0, 23.0, 26.0]]\nmask = torch.tensor([[True, False, True], [False, True, False]])\nprint(logp[mask].shape)          # [3, 5], B and T were merged",
            "language": "python"
          },
          {
            "heading": "用 einsum 写出注意力的轴关系",
            "body": "einsum 的字母只是你给维度取的名字。出现在输入但没有出现在输出中的轴会被求和；相同字母表示需要对齐的轴。在多头注意力中，q 是 [B, H, T, D]，k 是 [B, H, S, D]，沿 D 做点积后得到 [B, H, T, S]。乘上 1/√D 能控制点积尺度，随后在 key 的 S 轴上做 softmax。\n\n接着让权重与 [B, H, S, Dv] 的 value 相乘，沿 S 求和得到 [B, H, T, Dv]。这些公式用于验证轴语义，不保证 einsum 比专用 attention kernel 更快。实际实现可能使用 matmul、scaled_dot_product_attention 或融合 kernel，但必须满足同一组数学关系。",
            "code": "import math\nimport torch\nB, H, T, S, D = 2, 4, 3, 5, 8\nq = torch.randn(B, H, T, D)\nk = torch.randn(B, H, S, D)\nv = torch.randn(B, H, S, D)\nscores = torch.einsum(\"bhtd,bhsd->bhts\", q, k) / math.sqrt(D)\nweights = scores.softmax(dim=-1)\nout = torch.einsum(\"bhts,bhsd->bhtd\", weights, v)\nprint(scores.shape, out.shape)  # [2,4,3,5], [2,4,3,8]",
            "language": "python"
          },
          {
            "heading": "Mask 的形状和约定必须同时检查",
            "body": "假设 key_valid 的形状是 [B, S]，True 表示有效 token。它需要变成 [B, 1, 1, S] 才能作用于每个 head 和 query。masked_fill 的布尔条件则表示“这里要被替换”，所以这里传入取反后的 ~key_valid。不同注意力 API 对布尔 mask 的解释可能不同，不能只按变量名猜测。\n\n如果某个 query 对应的全部 key 都被填成负无穷，普通 softmax 会遇到未定义的归一化并产生 NaN。必须从数据契约或实现逻辑中保证至少一个可见 key，或者显式处理空行。阅读变长序列、causal mask 和 padding mask 时，先画出轴与 True 的含义，再追踪广播过程。",
            "code": "import torch\nscores = torch.zeros(2, 4, 3, 5)\nkey_valid = torch.tensor([[1, 1, 1, 0, 0], [1, 1, 1, 1, 0]],\n                         dtype=torch.bool)\nblocked = ~key_valid[:, None, None, :]  # 2, 1, 1, 5\nweights = scores.masked_fill(blocked, float(\"-inf\")).softmax(-1)\nprint(weights[0, 0, 0])  # [1/3, 1/3, 1/3, 0, 0]\nprint(weights.sum(-1).shape)  # [2, 4, 3]",
            "language": "python",
            "callout": "scaled_dot_product_attention 的布尔 attn_mask 中 True 表示允许参与注意力；不要套用 masked_fill 的条件语义。"
          }
        ],
        "takeaways": [
          "广播按右侧维度对齐；用显式 singleton 维度表达 batch 与 token 语义。",
          "gather 输出与 index 同形，是提取 token log probability 的常用操作。",
          "注意力 logits 是 [B,H,T,S]；mask 的 shape、布尔约定与空行处理缺一不可。"
        ],
        "references": [
          {
            "label": "Broadcasting semantics",
            "url": "https://docs.pytorch.org/docs/stable/notes/broadcasting.html"
          },
          {
            "label": "torch.einsum",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.einsum.html"
          },
          {
            "label": "Scaled dot product attention",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.scaled_dot_product_attention.html"
          }
        ],
        "quiz": [
          {
            "id": "tensor-2-q1",
            "type": "single",
            "topic": "广播",
            "prompt": "x 的 shape 是 [B,T,D]，样本权重 w 是 [B]。怎样明确给每个样本的全部 token 和特征乘上权重？",
            "options": [
              "x * w",
              "x * w[None, None, :]",
              "x * w[:, None, None]",
              "x * w[:, None]"
            ],
            "answer": 2,
            "explanation": "w[:,None,None] 的 shape 为 [B,1,1]，两个后轴广播。其他写法从右对齐，可能报错，也可能在维度巧合相等时悄悄作用到错误的轴。"
          },
          {
            "id": "tensor-2-q2",
            "type": "single",
            "topic": "注意力形状",
            "prompt": "q=[B,H,T,D]、k=[B,H,S,D]，einsum(\"bhtd,bhsd->bhts\", q, k) 沿哪个轴求和？",
            "options": [
              "B",
              "H",
              "T",
              "D"
            ],
            "answer": 3,
            "explanation": "D 对应字母 d，在两个输入出现但不在输出中，所以对 d 求和。B、H、T、S 都保留在输出。"
          },
          {
            "id": "tensor-2-q3",
            "type": "single",
            "topic": "Mask 语义",
            "prompt": "key_valid=[B,S]，True 表示有效 key。scores=[B,H,T,S]，正确的屏蔽写法是哪项？",
            "options": [
              "scores.masked_fill(~key_valid[:,None,None,:], float(\"-inf\"))",
              "scores.masked_fill(key_valid, 0)",
              "scores * key_valid",
              "scores.masked_fill(key_valid[:,None,None,:], float(\"-inf\"))"
            ],
            "answer": 0,
            "explanation": "masked_fill 的 True 表示执行替换，所以要将无效 key 标为 True，并补齐 head 与 query 轴。乘零并不能让 softmax 概率变成零，最后一项则错误地屏蔽有效位置。"
          }
        ]
      },
      {
        "id": "tensor-3",
        "title": "Dtype、device 与数值稳定性",
        "description": "分清精度、范围与数据搬运，理解混合精度训练为什么能工作。",
        "duration": 18,
        "difficulty": "进阶",
        "objectives": [
          "区分 FP16、BF16 和 FP32 的数值取舍",
          "识别不稳定的 exp/log 与低精度归约",
          "解释设备迁移、异步拷贝和同步开销"
        ],
        "sections": [
          {
            "heading": "Dtype 同时决定数学规则和容量",
            "body": "张量的 dtype 决定元素字节数、可表示范围和舍入误差。FP16 与 BF16 都是两个字节，但 FP16 有更多有效精度位，BF16 有更大的指数范围；BF16 的范围接近 FP32，并不意味着精度也等于 FP32。整数 token id 通常使用 int64，不能因为模型参数用了 BF16 就把索引也转为浮点。\n\n内存估算先写元素个数再乘字节数。例如 [B,T,H,D] 张量有 B×T×H×D 个元素；从 FP32 转成 BF16 会让这份稠密张量的逻辑存储减半，但模型总显存还包括梯度、优化器状态、临时结果与分配器缓存，不能直接推断训练显存也减半。",
            "code": "import torch\nfor dtype in [torch.float16, torch.bfloat16, torch.float32]:\n    info = torch.finfo(dtype)\n    print(dtype, \"bytes:\", torch.empty((), dtype=dtype).element_size(),\n          \"max:\", info.max, \"eps:\", info.eps)\nids = torch.tensor([1, 5, 9], dtype=torch.long)\nvalues = ids.float()\nprint(values.mean().item())  # 5.0",
            "language": "python"
          },
          {
            "heading": "数学等价，浮点实现不一定等价",
            "body": "直接先 exp 再求和再 log，在 logits 很大时会溢出。logsumexp 利用减去最大值的稳定变换计算同一个数学表达式；log_softmax 也比 softmax 后取 log 更能避免极小概率下溢。不同归约顺序会导致末位差异，浮点加法不满足严格结合律，因此不要用逐位一致作为所有 GPU kernel 的正确性标准。\n\n对 loss、方差或较长序列的归约，需要关注累计精度。把结果最后转成 FP32 无法补救已经发生的低精度溢出；应该在敏感运算前转换，或者使用内部采用合适累计精度的受支持算子。数值验证需要合理的绝对和相对容差。",
            "code": "import torch\nx = torch.tensor([1000., 1001.])\nprint(torch.exp(x).sum().log())  # inf\nprint(torch.logsumexp(x, dim=0)) # about 1001.3133\nprint(torch.log_softmax(x, dim=0)) # [-1.3133, -0.3133]\ny = torch.tensor([60000., 60000.], dtype=torch.float16)\nprint(y.sum())                   # inf: result cannot fit in float16\nprint(y.sum(dtype=torch.float32))# 120000",
            "language": "python"
          },
          {
            "heading": "Device 是执行位置，不会自动配平",
            "body": "大部分张量算子要求参与运算的张量位于兼容的设备上。模型移到 CUDA，不会自动把 DataLoader 产出的 CPU batch 也移动过去；创建临时张量时优先使用 x.new_zeros 或显式 device=x.device。to 在无需转换时可以返回原张量，不能把它当成保证复制的操作。\n\nCPU 与 GPU 数据传输有额外成本。页锁定 CPU 内存配合 non_blocking=True 能支持更有效的异步传输；是否与计算重叠还取决于流、硬件和依赖关系。CUDA 操作通常异步提交，逐步调用 loss.item() 会等待相关计算，使看似无害的日志影响吞吐。",
            "code": "import torch\ndevice = torch.device(\"cuda\" if torch.cuda.is_available() else \"cpu\")\nx = torch.randn(2, 3, device=device)\nz = x.new_zeros(2, 3)  # inherit dtype and device\nprint((x + z).device)\n# With a pin_memory=True DataLoader and CUDA:\n# inputs = cpu_batch.to(device, non_blocking=True)\n# Move labels too; class-index labels stay torch.long.",
            "language": "python",
            "callout": "异步拷贝期间不要提前修改仍在使用的源缓冲区；计时 GPU 操作时需要 CUDA events 或在测量边界同步。"
          },
          {
            "heading": "混合精度不是整网强制 half",
            "body": "autocast 按算子规则为部分运算选择低精度，同时让某些敏感运算保持较高精度。常见训练方式仍然保留 FP32 参数和优化器状态，而不是直接对整个模型调用 half。FP16 梯度容易下溢，GradScaler 通过先放大 loss、反向后再还原梯度来改善问题；BF16 通常不需要梯度缩放，但依然要检查 NaN 和数值行为。\n\n如果使用梯度裁剪，应在 scaler.unscale_(optimizer) 之后裁剪真实尺度的梯度。分析训练配置时，分别查参数 dtype、计算 dtype、梯度归约 dtype 和优化器状态 dtype；它们可能不同。推理时的权重量化则是另一套数值表示与计算方案。",
            "code": "import torch\n# Run this example only on a CUDA device with BF16 support.\nif torch.cuda.is_available() and torch.cuda.is_bf16_supported():\n    layer = torch.nn.Linear(16, 8).cuda()\n    x = torch.randn(4, 16, device=\"cuda\")\n    with torch.autocast(device_type=\"cuda\", dtype=torch.bfloat16):\n        y = layer(x)\n        loss = y.float().square().mean()\n    loss.backward()\n    print(layer.weight.dtype, y.dtype) # float32, bfloat16",
            "language": "python"
          }
        ],
        "takeaways": [
          "BF16 与 FP16 同为两字节，但范围与精度不同；索引仍应保持整数类型。",
          "稳定算子与正确的累计精度比事后转成 FP32 更重要。",
          "autocast、参数 dtype、梯度缩放与设备搬运是不同机制。"
        ],
        "references": [
          {
            "label": "Numerical accuracy",
            "url": "https://docs.pytorch.org/docs/stable/notes/numerical_accuracy.html"
          },
          {
            "label": "Automatic mixed precision",
            "url": "https://docs.pytorch.org/docs/stable/amp.html"
          },
          {
            "label": "CUDA semantics",
            "url": "https://docs.pytorch.org/docs/stable/notes/cuda.html"
          }
        ],
        "quiz": [
          {
            "id": "tensor-3-q1",
            "type": "single",
            "topic": "浮点格式",
            "prompt": "关于 BF16 与 FP16，哪一项正确？",
            "options": [
              "BF16 每个元素需要 4 字节",
              "BF16 范围更大，但有效精度通常低于 FP16",
              "BF16 与 FP32 具有相同有效精度",
              "FP16 无法在 GPU 上参与矩阵乘法"
            ],
            "answer": 1,
            "explanation": "两者都是 2 字节。BF16 分配更多位给指数，因此范围接近 FP32，但尾数位比 FP16 少。"
          },
          {
            "id": "tensor-3-q2",
            "type": "single",
            "topic": "数值稳定",
            "prompt": "对 x=[1000,1001] 计算 log(sum(exp(x)))，应优先采用什么？",
            "options": [
              "先 exp，最后转成 float64",
              "x.softmax(0).sum().log()",
              "torch.logsumexp(x, dim=0)",
              "x.mean()"
            ],
            "answer": 2,
            "explanation": "logsumexp 采用稳定计算方式。已发生的 exp 溢出不能事后挽回；softmax 后求和为 1，计算的函数已经改变。"
          },
          {
            "id": "tensor-3-q3",
            "type": "single",
            "topic": "混合精度",
            "prompt": "FP16 AMP 训练中，正确的梯度裁剪时机是？",
            "options": [
              "backward 之前",
              "scale(loss).backward() 后直接裁剪缩放梯度",
              "optimizer.step() 之后",
              "unscale_(optimizer) 之后、scaler.step(optimizer) 之前"
            ],
            "answer": 3,
            "explanation": "先还原梯度真实尺度，才能使用预定裁剪阈值。裁剪放大的梯度会改变实际阈值，更新参数后再裁剪已经太晚。"
          }
        ]
      },
      {
        "id": "tensor-4",
        "title": "View、reshape 与连续性",
        "description": "沿着多头注意力的变形路径，定位隐式复制与错误的轴合并。",
        "duration": 17,
        "difficulty": "进阶",
        "objectives": [
          "解释 view 成功所需的 stride 兼容条件",
          "区分 reshape 的形状保证与是否复制的不确定性",
          "完整推导 attention 的拆头与合头"
        ],
        "sections": [
          {
            "heading": "View 改解释方式，但不能任意重排",
            "body": "view 想要复用原存储，因此只能在已有 stride 允许的范围内拆分或合并维度。把相邻多个轴合成一个轴时，相关 stride 需要满足类似 stride[i] = stride[i+1] × size[i+1] 的连续链条件。尺寸为 1 的轴等情况还有简化规则，不能把“不连续”直接等同于“任何 view 都失败”。\n\n下面 x 的转置让逻辑遍历顺序变成 0、3、1、4、2、5，无法用一个固定 stride 的一维视图表示，所以 y.view(-1) 报错。这是布局约束错误，不是元素数量错误。遇到 view 的异常时，应打印 shape 与 stride，而不只看 numel。",
            "code": "import torch\nx = torch.arange(6).reshape(2, 3)\ny = x.t()\nprint(y.tolist())  # [[0, 3], [1, 4], [2, 5]]\nprint(y.stride())  # (1, 3)\ntry:\n    y.view(-1)\nexcept RuntimeError:\n    print(\"This layout cannot be flattened as a view\")\nprint(x.view(3, 2))  # possible: original x is contiguous",
            "language": "python"
          },
          {
            "heading": "Reshape 保证形状，不保证无复制",
            "body": "reshape 会在布局兼容时返回视图，不兼容时复制出合适的存储。使用者不应依赖某一次 reshape 一定共享存储或一定独立；需要独立副本时显式 clone，算子明确要求某种内存格式时使用 contiguous。contiguous 对已经满足指定格式的张量可能直接返回原对象，因此它也不是无条件复制函数。\n\n复制不会自动切断 autograd。reshape 或 contiguous 为了满足布局而复制数据时，正常的可微路径仍然存在。对于大模型，隐式复制常常带来明显的峰值显存和内存带宽成本；对于少量数据，先保证逻辑清晰再测量优化更合理。",
            "code": "import torch\nx = torch.arange(6.).reshape(2, 3).requires_grad_()\ny = x.t()\nz = y.reshape(-1)\nprint(z.tolist())  # [0, 3, 1, 4, 2, 5]\nprint(z.is_contiguous())  # True\nz.sum().backward()\nprint(x.grad)  # all ones: the copy did not detach the graph\nprint(x.contiguous() is x)  # True for this layout",
            "language": "python"
          },
          {
            "heading": "多头注意力的拆头和合头",
            "body": "设输入投影为 [B,T,H×D]。先 view 成 [B,T,H,D]，只是把最后一维拆开；再 transpose 得到 [B,H,T,D]，用于每个 head 单独做注意力。假设注意力输出以 [B,H,T,D] 连续存放，把 head 合回特征维之前，需要先 transpose 成 [B,T,H,D]。此时 H 与 D 在物理存储里不一定能直接合并。\n\n常见代码使用 transpose(...).contiguous().view(B,T,H×D)，或语义等价的 transpose(...).reshape(B,T,H×D)。直接把 [B,H,T,D] reshape 成 [B,T,H×D] 虽然元素数匹配，却会把 token 与 head 的排列弄错。形状正确只是必要条件，索引语义才是最终依据。",
            "code": "import torch\nB, T, H, D = 2, 3, 4, 5\nprojected = torch.arange(B*T*H*D).reshape(B, T, H*D)\nq = projected.view(B, T, H, D).transpose(1, 2)\nprint(q.shape)  # [2, 4, 3, 5]\nhead_output = q.contiguous()\nmerged = head_output.transpose(1, 2).contiguous().view(B, T, H*D)\nprint(torch.equal(merged, projected))  # True\nwrong = head_output.reshape(B, T, H*D)\nprint(torch.equal(wrong, projected))  # False",
            "language": "python"
          },
          {
            "heading": "连续性必须和内存格式一起读",
            "body": "is_contiguous 默认询问的是标准连续格式。四维图像张量还可以采用 channels_last 内存格式，逻辑维度仍然写作 [N,C,H,W]，但是底层 stride 排列不同。修改 memory_format 不等于把维度 permute 成另一套语义；这是初次学习卷积优化时容易混淆的地方。\n\n自定义算子可能接受任意 stride，也可能只支持最后一维连续，或要求整块连续。不要把所有输入都无条件 contiguous 当作修复策略，它可能增加每步复制。先确认算子契约，构造转置、切片、尺寸为 1 等输入验证，再在调用边界做必要的规范化。",
            "code": "import torch\nx = torch.randn(2, 3, 5, 7)  # N, C, H, W\ny = x.contiguous(memory_format=torch.channels_last)\nprint(y.shape)   # [2, 3, 5, 7]: axis meaning unchanged\nprint(y.stride())  # (105, 1, 21, 3)\nprint(y.is_contiguous())  # False\nprint(y.is_contiguous(memory_format=torch.channels_last))  # True",
            "language": "python",
            "callout": "性能敏感路径要测量实际分配和耗时；仅凭函数名无法判断 reshape 有没有复制。"
          }
        ],
        "takeaways": [
          "view 的限制来自 stride 兼容性；reshape 必要时会复制。",
          "contiguous 不保证独立存储，也不会像 detach 一样切断梯度。",
          "拆头和合头必须保持 token/head 语义，不能只检查元素总数。"
        ],
        "references": [
          {
            "label": "Tensor.view",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.view.html"
          },
          {
            "label": "torch.reshape",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.reshape.html"
          },
          {
            "label": "Tensor.contiguous",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.contiguous.html"
          }
        ],
        "quiz": [
          {
            "id": "tensor-4-q1",
            "type": "single",
            "topic": "View 条件",
            "prompt": "x=arange(6).reshape(2,3)，y=x.t()。为什么 y.view(-1) 失败？",
            "options": [
              "y 与 x 的元素数量不同",
              "view 只支持浮点张量",
              "转置后的逻辑序列不能由一个固定一维 stride 表示",
              "所有转置都必须复制后才能读取"
            ],
            "answer": 2,
            "explanation": "y 的逻辑顺序为 0,3,1,4,2,5，无法通过固定步长表示。转置本身可零复制读取，失败的是这个特定形状的 view。"
          },
          {
            "id": "tensor-4-q2",
            "type": "single",
            "topic": "复制与计算图",
            "prompt": "哪条关于 reshape 的描述正确？",
            "options": [
              "reshape 总是返回独立存储",
              "reshape 可能返回视图，也可能复制，不能依赖其别名行为",
              "reshape 发生复制时一定切断梯度",
              "reshape 总是比 view 快"
            ],
            "answer": 1,
            "explanation": "reshape 根据布局决定是否复制，并保留可微关系。明确需要独立存储时使用 clone，性能需要实际测量。"
          },
          {
            "id": "tensor-4-q3",
            "type": "single",
            "topic": "Attention 布局",
            "prompt": "连续的 out=[B,H,T,D] 要按 token 合并 heads 得到 [B,T,H*D]，哪项正确？",
            "options": [
              "out.view(B,T,H*D)",
              "out.reshape(B,T,H*D)",
              "out.transpose(0,1).reshape(B,T,H*D)",
              "out.transpose(1,2).contiguous().view(B,T,H*D)"
            ],
            "answer": 3,
            "explanation": "必须先把轴排成 [B,T,H,D]，再合并 H 与 D。直接改变形状会错误解释原本的 head/token 排列。"
          }
        ]
      }
    ]
  },
  {
    "id": "autograd",
    "number": 2,
    "title": "自动微分与计算图",
    "subtitle": "从链式法则走进训练引擎",
    "description": "读懂梯度的构建、传播、累积与释放，掌握停止梯度、自定义反向与数值检查。",
    "level": "进阶",
    "color": "#58a700",
    "icon": "grad",
    "lessons": [
      {
        "id": "autograd-1",
        "title": "动态图与向量雅可比积",
        "description": "从一个可手算的例子理解 backward 究竟计算了什么。",
        "duration": 20,
        "difficulty": "进阶",
        "objectives": [
          "手算向量雅可比积并验证 autograd 结果",
          "解释非标量输出为什么需要上游梯度",
          "区分 retain_graph 与 create_graph 的作用"
        ],
        "sections": [
          {
            "heading": "动态图记录的是本次执行的张量运算",
            "body": "自动微分依靠链式法则，把最终目标对参数的导数拆成一系列局部导数。PyTorch 在梯度模式开启时，记录实际发生的可微张量运算。Python 分支和循环决定这次前向经过哪些操作，下一次执行可以建立不同的图。requires_grad 表示需要追踪相关计算，结果上的 grad_fn 则关联到产生该结果的反向节点。\n\n记录张量运算并不意味着记录全部 Python 语义。item() 把张量变成 Python 数值，用这个数值决定分支后，只会对实际执行分支里的张量计算求导，不会对离散的“选了哪条分支”求导。下例在 x=2 时走平方分支，导数为 4；在分支边界处是否可导，需要分析函数本身，而不是依赖程序给出一个梯度就认为数学上可导。\n\n理解图时，可从 loss 倒着问：它依赖哪些张量，每条边对应什么运算，这个运算的局部导数是什么。若中途转成 Python 数值、NumPy 数组或重新构造独立张量，原来的梯度路径可能已经断开。",
            "code": "import torch\ndef piecewise(x):\n    if x.item() > 0:\n        return x.square()\n    return 3 * x\nx = torch.tensor(2., requires_grad=True)\ny = piecewise(x)\ny.backward()\nassert y.item() == 4 and x.grad.item() == 4\nprint(\"value:\", y.item(), \"gradient:\", x.grad.item())",
            "language": "python"
          },
          {
            "heading": "先约定雅可比矩阵，再理解 VJP",
            "body": "设输入 x 有 n 个分量，输出 y=f(x) 有 m 个分量。雅可比矩阵 J 的第 i 行记录第 i 个输出对所有输入的偏导，因此 J 的形状是 [m,n]。如果后续标量目标 L 对 y 的梯度是 v，把梯度写成列向量，链式法则给出输入梯度 g=Jᵀv。每个输入分量都要累加来自全部输出的贡献。\n\nvector-Jacobian product 常按行向量写成 vᵀJ；PyTorch 返回的输入形状张量通常可按等价的列向量 Jᵀv 理解。名字里的“向量乘雅可比”不能用来猜矩阵乘法方向，最可靠的方法是先写清输出数 m、输入数 n，以及上游梯度长度 m。\n\n反向模式沿图传播这样的乘积，而不必显式构造完整 J。训练神经网络时，参数可能有数十亿个，目标 loss 却往往是标量，因此反向模式非常合适。前向模式计算 Jv，适合另一类输入输出规模；它与本课的 VJP 不是同一个乘积。",
            "formula": "J_{ij}=\\frac{\\partial y_i}{\\partial x_j},\\qquad g_j=\\sum_{i=1}^{m}v_iJ_{ij},\\qquad g=J^\\top v",
            "figure": {
              "type": "table",
              "caption": "用形状检查链式法则的方向。",
              "columns": [
                "对象",
                "含义",
                "形状"
              ],
              "rows": [
                [
                  "x",
                  "输入坐标",
                  "[n]"
                ],
                [
                  "y=f(x)",
                  "输出坐标",
                  "[m]"
                ],
                [
                  "J",
                  "每个输出对每个输入的偏导",
                  "[m,n]"
                ],
                [
                  "v=∂L/∂y",
                  "上游梯度",
                  "[m]"
                ],
                [
                  "Jᵀv=∂L/∂x",
                  "输入梯度",
                  "[n]"
                ]
              ]
            },
            "bodyAfter": "grad_outputs 传入的是上游梯度 v，不是要求 autograd 返回哪些输出，也不是默认的标签。它的形状必须与被求导的输出匹配。"
          },
          {
            "heading": "手算一个两输入、两输出的反向传播",
            "body": "取 y₀=x₀²、y₁=x₀x₁，在 x=[2,3] 处，雅可比第一行是 [4,0]，第二行是 [3,2]。给定上游梯度 v=[1,2]，x₀ 收到 1×4 与 2×3 两项贡献，共 10；x₁ 只收到 2×2，共 4。这个结果也等于标量目标 L=y₀+2y₁ 的梯度，因而可以从两种路径互相验证。\n\n若换成 y.sum()，上游梯度是 [1,1]，得到 [7,2]；若换成 y.mean()，上游梯度是 [1/2,1/2]，得到 [3.5,1]。sum 与 mean 看似只差一个归约选项，却直接改变整个模型的梯度尺度。这是后面理解 batch 大小、有效 token 分母和分布式平均的基础。\n\n非标量 y 直接 backward() 无法知道你想要哪一个标量目标，因此需要显式 gradient，或先归约成标量。返回完整雅可比则是另一个任务，可以用 jacrev 等接口表达，不能把一次普通 backward 的结果当作完整 J。",
            "formula": "J=\\begin{bmatrix}4&0\\\\3&2\\end{bmatrix},\\quad v=\\begin{bmatrix}1\\\\2\\end{bmatrix},\\quad J^\\top v=\\begin{bmatrix}10\\\\4\\end{bmatrix}",
            "code": "import torch\nx = torch.tensor([2., 3.], requires_grad=True)\ny = torch.stack((x[0].square(), x[0] * x[1]))\nv = torch.tensor([1., 2.])\n(g,) = torch.autograd.grad(y, x, grad_outputs=v)\ntorch.testing.assert_close(g, torch.tensor([10., 4.]))\nfresh_y = torch.stack((x[0].square(), x[0] * x[1]))\n(g2,) = torch.autograd.grad(fresh_y[0] + 2 * fresh_y[1], x)\ntorch.testing.assert_close(g, g2)\nprint(\"VJP:\", g.tolist(), \"x.grad:\", x.grad)",
            "language": "python"
          },
          {
            "heading": "分支汇合时，梯度贡献必须相加",
            "body": "一个输入可以被多条下游路径重复使用。对 y=x²+3x，平方路径贡献 2x，线性路径贡献 3，反向到 x 时二者相加。计算图不是一条覆盖式赋值链；每条依赖边都代表一份可能的导数贡献，遗漏一条路径就会得到错误梯度。\n\n参数共享是相同原理的工程形式。同一个 Linear 在多个时间步调用，或输入 embedding 与输出投影共享权重，同一 Parameter 会从多处使用接收梯度。共享对象不是把参数数量变成多份，而是让同一组参数同时影响更多位置，反向必须汇合所有贡献。\n\n还要区分两种累加：一次 backward 内部，autograd 汇合图上的多个分支；多次独立前向后的 backward，又会把结果累加到叶子的 .grad。第二种就是梯度累积的基础，也意味着优化器通常需要在新的更新窗口开始时清梯度。两者不能混成“每次反向会覆盖旧值”。",
            "figure": {
              "type": "table",
              "caption": "在 x=2 处追踪两条依赖路径。",
              "columns": [
                "路径",
                "局部表达式",
                "对 x 的贡献"
              ],
              "rows": [
                [
                  "x → 平方 → 相加",
                  "x²",
                  "2x=4"
                ],
                [
                  "x → 乘三 → 相加",
                  "3x",
                  "3"
                ],
                [
                  "两条路径汇合",
                  "x²+3x",
                  "4+3=7"
                ]
              ]
            },
            "code": "import torch\nx = torch.tensor(2., requires_grad=True)\n(x.square() + 3 * x).backward()\nassert x.grad.item() == 7\n(5 * x).backward()  # 新前向，又向同一个叶子累加 5。\nassert x.grad.item() == 12\nx.grad = None\n(x.square() + 3 * x).backward()\nassert x.grad.item() == 7\nprint(\"fresh-window gradient:\", x.grad.item())",
            "language": "python"
          },
          {
            "heading": "Backward 写入梯度，autograd.grad 返回梯度",
            "body": "backward 面向训练循环：把指定目标的梯度累加到需要梯度的叶子张量 .grad 中。autograd.grad 则面向显式求导：指定 outputs 与 inputs，把梯度作为返回值交给调用者，通常不会替你填入输入的 .grad。函数返回的是一个元组，即使只有一个输入，也常写成 (g,) 来解包。\n\n用户直接创建的需要梯度的张量通常是叶子；由可微运算产生的中间结果通常不是叶子。中间张量可以参与求导，但默认不保留 .grad，以减少内存；需要观察时可用 retain_grad。is_leaf、requires_grad 和 grad 是否为 None 回答的是不同问题，不能仅凭某个中间值的 .grad 为空就断言它不在计算图中。\n\n排查断图时，先确认目标是否依赖指定输入。完全未使用的输入与“参与计算但导数恰好为零”不同；默认 autograd.grad 对未使用输入报错，常常是在帮你发现错误依赖。不要在还没理解原因时随意允许 unused，再把 None 替换为零来掩盖问题。",
            "code": "import torch\nx = torch.tensor([1., 2.], requires_grad=True)\ny = 3 * x\ny.retain_grad()\nloss = y.square().sum()\nloss.backward()\ntorch.testing.assert_close(x.grad, torch.tensor([18., 36.]))\ntorch.testing.assert_close(y.grad, torch.tensor([6., 12.]))\nz = torch.tensor([1., 2.], requires_grad=True)\n(g,) = torch.autograd.grad(z.square().sum(), z)\nassert z.grad is None\nprint(\"leaf:\", x.is_leaf, \"intermediate:\", y.is_leaf)\nprint(\"returned gradient:\", g.tolist())",
            "language": "python"
          },
          {
            "heading": "图的生命周期：保存值为何会在反向后释放",
            "body": "反向计算某个局部导数时，可能需要前向的输入或输出，例如平方的导数需要 x，某些激活函数需要已计算的结果。autograd 会按操作需要保存这些值。默认反向完成后，相关保存资源会被释放，以便回收内存。因此，对同一次前向结果再次反向，可能因为保存值已释放而失败。\n\nretain_graph=True 表示本次反向后保留原图所需资源，适合确实需要复用同一前向的情况。它不是普通训练循环的固定选项，也不是“梯度累积”的必要条件；每个 microbatch 新前向后立即 backward，就可以在叶子上累积梯度，同时释放各自中间量。\n\n不要把某个简单图能够重复 backward 当作普遍规律。加法等操作可能不需要保存会被释放的张量，而更复杂的图需要。判断行为时应看具体操作与资源依赖。长期把带图 loss 或输出存入列表也可能保留相关对象，应明确日志与缓存需要的是数值、独立张量还是可微结果。",
            "code": "import torch\nx = torch.tensor(2., requires_grad=True)\ny = x.square()\n(g1,) = torch.autograd.grad(y, x, retain_graph=True)\n(g2,) = torch.autograd.grad(y, x)  # 本次之后无需继续保留。\nassert g1.item() == g2.item() == 4\ntry:\n    torch.autograd.grad(y, x)\nexcept RuntimeError:\n    print(\"saved values were released\")\nfresh_y = x.square()\n(g3,) = torch.autograd.grad(fresh_y, x)\nassert g3.item() == 4",
            "language": "python"
          },
          {
            "heading": "高阶导数：对求导过程继续构图",
            "body": "若希望继续对一阶梯度求导，必须让求导过程本身也成为可微计算。create_graph=True 请求记录反向公式中的运算，例如 y=x³ 的一阶导为 3x²，只有保留这条关于 x 的关系，才能再得到二阶导 6x。retain_graph 关注原图资源能否复用，create_graph 关注梯度结果是否具备新的求导关系，两者职责不同。\n\n多变量情况下，二阶导构成 Hessian。实际优化分析经常只需要 Hessian-vector product，无需显式建立完整矩阵：先对标量目标求梯度 g，再对 g 与固定向量 v 的内积求导，就得到 Hᵀv；对二阶连续可微的标量目标，H 对称，于是等于 Hv。v 在这里作为固定方向，不参与求导。\n\n下面目标是 x₀³+x₁³，在 x=[2,3] 处 Hessian 对角线为 [12,18]，取 v=[1,2] 得到 [12,36]。这把 VJP、标量内积和高阶导连在一起，也说明许多看起来需要巨大矩阵的运算，可以通过按需乘积实现。",
            "formula": "g=\\nabla_x L,\\qquad \\nabla_x(g^\\top v)=H^\\top v,\\qquad H_{ij}=\\frac{\\partial^2 L}{\\partial x_i\\partial x_j}",
            "code": "import torch\nx = torch.tensor([2., 3.], requires_grad=True)\nloss = x.pow(3).sum()\n(g,) = torch.autograd.grad(loss, x, create_graph=True)\nv = torch.tensor([1., 2.])\n(hv,) = torch.autograd.grad((g * v).sum(), x)\ntorch.testing.assert_close(g, torch.tensor([12., 27.]))\ntorch.testing.assert_close(hv, torch.tensor([12., 36.]))\nprint(\"first derivative:\", g.tolist())\nprint(\"Hessian-vector product:\", hv.tolist())",
            "language": "python",
            "callout": "拿到一个梯度后，先能说清“它是谁对谁的导数、对应哪个标量目标、上游向量是什么”，再讨论实现与性能。"
          }
        ],
        "takeaways": [
          "反向模式计算上游向量与雅可比的乘积，避免显式构造巨大雅可比。",
          "多个计算路径对同一输入的梯度贡献会相加。",
          "retain_graph 保留原图资源，create_graph 使求导过程可继续求导。"
        ],
        "references": [
          {
            "label": "Autograd mechanics",
            "url": "https://docs.pytorch.org/docs/stable/notes/autograd.html"
          },
          {
            "label": "torch.autograd.grad",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.autograd.grad.html"
          }
        ],
        "quiz": [
          {
            "id": "autograd-1-q1",
            "type": "single",
            "topic": "VJP",
            "prompt": "x=[2,3]，y=[x₀²,x₀x₁]，上游梯度 v=[1,2]。VJP 结果是什么？",
            "options": [
              "[4,2]",
              "[10,4]",
              "[4,6]",
              "[8,6]"
            ],
            "answer": 1,
            "explanation": "对 x₀，第一项贡献 1×2×2=4，第二项贡献 2×3=6，合计 10；对 x₁ 的贡献为 2×2=4。"
          },
          {
            "id": "autograd-1-q2",
            "type": "single",
            "topic": "非标量反向",
            "prompt": "y 是含多个元素且需要梯度的向量，哪项描述正确？",
            "options": [
              "y.backward() 默认返回完整雅可比",
              "向量不支持反向传播",
              "必须先把 y 转为 Python list",
              "可传入同形 gradient 指定 VJP 的上游向量"
            ],
            "answer": 3,
            "explanation": "非标量 backward 需要显式上游梯度，或者先 sum/mean 成标量。它不会默认产生完整雅可比。"
          },
          {
            "id": "autograd-1-q3",
            "type": "single",
            "topic": "高阶梯度",
            "prompt": "需要从一阶导数继续计算二阶导数，关键参数是什么？",
            "options": [
              "create_graph=True",
              "retain_grad=True",
              "allow_unused=True",
              "materialize_grads=False"
            ],
            "answer": 0,
            "explanation": "create_graph=True 为求导过程构图。retain_grad 是中间张量保留 .grad 的方法；只保留原图不单独保证一阶梯度本身可微。"
          }
        ]
      },
      {
        "id": "autograd-2",
        "title": "Leaf、grad 与梯度累积",
        "description": "追踪梯度在哪儿出现、何时清空，以及 microbatch 应如何缩放。",
        "duration": 20,
        "difficulty": "进阶",
        "objectives": [
          "判断叶子与中间张量的 .grad 行为",
          "正确处理梯度清零与多次 backward",
          "为有效 token 数不同的 microbatch 推导总体平均梯度"
        ],
        "sections": [
          {
            "heading": "叶子是梯度默认落地的位置",
            "body": "用户创建、需要梯度且不是可微运算结果的张量通常是叶子。Parameter 一般就是可训练叶子，backward 默认把梯度写入它的 .grad。中间张量即使 requires_grad=True，也通常不会自动保留 .grad，目的是减少内存；调试需要观察时可以显式 retain_grad。\n\n设备转换也可能是可微运算。先在 CPU 创建 requires_grad 的张量，再调用 cuda 得到的结果通常是非叶张量；直接在目标 device 创建更容易保持预期。is_leaf 描述张量在图中的角色，不等于“是否可以算出导数”，也不等于“是否是模型参数”。",
            "code": "import torch\nx = torch.tensor([1., 2.], requires_grad=True)\ny = 3 * x\ny.retain_grad()\nloss = y.square().sum()\nloss.backward()\nprint(x.is_leaf, y.is_leaf)  # True, False\nprint(x.grad)  # [18, 36]\nprint(y.grad)  # [6, 12], retained explicitly",
            "language": "python"
          },
          {
            "heading": "Backward 是累加，不是覆盖",
            "body": "每次 backward 都把新梯度加到现有 .grad 上。优化器 step 使用当前梯度更新参数，但不会顺便清空梯度；常规训练需要每个优化器更新窗口调用 zero_grad。set_to_none=True 让梯度回到 None，常能节省清零开销，随后第一次反向再分配梯度。\n\nNone 和全零梯度在某些优化器行为上并不等价：参数 grad 为 None 时一般被跳过，零梯度参数仍可能受到 weight decay 或动量影响。冻结参数、条件分支与稀疏专家训练中，应关注哪些参数根本没有参与本次计算，而不只检查梯度数值是否为零。",
            "code": "import torch\nw = torch.nn.Parameter(torch.tensor(2.))\nopt = torch.optim.SGD([w], lr=0.1)\n(w * 3).backward()\n(w * 4).backward()  # a fresh forward, same leaf\nprint(w.grad.item())  # 7\nopt.step()\nprint(round(w.item(), 3))  # 1.3\nopt.zero_grad(set_to_none=True)\nprint(w.grad)  # None",
            "language": "python"
          },
          {
            "heading": "等大小 microbatch 与有效 batch",
            "body": "显存不足时，可把一个优化器更新对应的大 batch 拆成 K 个 microbatch。每个 microbatch 新建前向图并立即反向，梯度留在参数上累加，最后只 step 一次。若每个 microbatch 的 loss 都是同等数量样本的平均，先除以 K 再 backward 就得到大 batch 的平均梯度。\n\n这不保证和一次大 batch 前向完全相同：BatchNorm 统计、dropout 随机数、浮点归约顺序及依赖 batch 的损失可能不同。梯度裁剪应在整个累积窗口完成后进行，学习率 scheduler 通常按 optimizer update 计步。普通累积不需要 retain_graph，因为每次前向都建立新图。",
            "code": "import torch\nw = torch.nn.Parameter(torch.tensor(0.))\nopt = torch.optim.SGD([w], lr=0.1)\nmicrobatches = [torch.tensor([1., 2.]), torch.tensor([3., 4.])]\nopt.zero_grad(set_to_none=True)\nfor target in microbatches:\n    loss = (w - target).square().mean()\n    (loss / len(microbatches)).backward()\nprint(w.grad.item())  # -5, same as mean over [1,2,3,4]\nopt.step()",
            "language": "python"
          },
          {
            "heading": "长度不同，不能直接平均各批均值",
            "body": "语言模型中的 microbatch 经常含有不同数量的有效 token。若目标是全部有效 token 的总体平均，正确目标是 Σloss_sum / Σvalid_count；把每个 microbatch 的平均 loss 再均分 K 次，会让短序列拥有过大的权重。必须先确定统计单位是 token 还是 sequence，再推导分母。\n\n当一个累积窗口的有效 token 总数预先已知，可以让每个 microbatch 的未归约损失求和，除以该窗口总有效数，再 backward。下例第一个 microbatch 有一个 token，第二个有三个；总体平均导数是 -5，错误的“两个均值再平均”会得到 -4。这个分母问题还会扩展到不同 rank 的分布式归约。",
            "code": "import torch\nw = torch.nn.Parameter(torch.tensor(0.))\ntargets = [torch.tensor([1.]), torch.tensor([2., 3., 4.])]\ntotal_tokens = sum(t.numel() for t in targets)\nfor t in targets:\n    loss_sum = (w - t).square().sum()\n    (loss_sum / total_tokens).backward()\nprint(w.grad.item())  # -5, not -4\n# Distributed reducers may average across ranks:\n# derive their extra scaling before reusing this formula.",
            "language": "python",
            "callout": "Token 平均、sequence 平均与 microbatch 平均一般不是同一个优化目标。"
          }
        ],
        "takeaways": [
          ".grad 默认保留在需要梯度的叶子上；观察中间值可用 retain_grad。",
          "backward 累加，step 不清梯度；None 与零可能触发不同更新。",
          "累积缩放必须匹配有效样本或 token 总数，不能盲目除 microbatch 数。"
        ],
        "references": [
          {
            "label": "Tensor.is_leaf",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.is_leaf.html"
          },
          {
            "label": "Optimizer.zero_grad",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.optim.Optimizer.zero_grad.html"
          },
          {
            "label": "AMP examples",
            "url": "https://docs.pytorch.org/docs/stable/notes/amp_examples.html"
          }
        ],
        "quiz": [
          {
            "id": "autograd-2-q1",
            "type": "single",
            "topic": "Leaf 与 grad",
            "prompt": "x 是需要梯度的叶子，y=3*x。想在 backward 后读取 y.grad，应提前做什么？",
            "options": [
              "y.detach()",
              "y.retain_grad()",
              "x.requires_grad_(False)",
              "y.item()"
            ],
            "answer": 1,
            "explanation": "中间张量默认不保留 .grad，retain_grad 请求保留。detach 切断反向联系，item 得到 Python 数值，均不能实现这一目的。"
          },
          {
            "id": "autograd-2-q2",
            "type": "single",
            "topic": "梯度累积",
            "prompt": "w 初始为 2，先对 3*w backward，再对新计算的 4*w backward，中间未清梯度。w.grad 是多少？",
            "options": [
              "3",
              "4",
              "7",
              "14"
            ],
            "answer": 2,
            "explanation": "两次分别贡献 3 和 4，累加得到 7。不会用第二次梯度覆盖第一次，参数初值也不影响这个线性函数的导数。"
          },
          {
            "id": "autograd-2-q3",
            "type": "single",
            "topic": "Token 分母",
            "prompt": "两个 microbatch 分别有 1 和 3 个有效 token，目标是总体 token 平均。哪种归约正确？",
            "options": [
              "(loss_sum_1 + loss_sum_2) / 4",
              "(loss_mean_1 + loss_mean_2) / 2",
              "loss_sum_1 + loss_sum_2",
              "loss_mean_1 / 4 + loss_mean_2 / 4"
            ],
            "answer": 0,
            "explanation": "总体 token 平均以 4 个有效 token 为分母。两个均值再平均会让只有一个 token 的第一个 microbatch 占一半权重。"
          }
        ]
      },
      {
        "id": "autograd-3",
        "title": "Detach、no_grad 与 inference_mode",
        "description": "区分冻结、停止梯度和评估模式，避免悄悄切断训练路径。",
        "duration": 18,
        "difficulty": "进阶",
        "objectives": [
          "根据下游是否需要反向选择梯度控制方式",
          "解释 eval 与梯度模式互不等价",
          "为教师模型与固定训练目标设置正确的梯度边界"
        ],
        "sections": [
          {
            "heading": "Detach 在某一条边上停止梯度",
            "body": "detach 返回与原张量共享存储的新张量，但它不再连接原来的反向图。它适合同一个中间结果一部分参与训练、另一部分作为固定目标的场景，例如 target network 的回归目标或某些固定损失权重。共享存储意味着对 detached 张量的原地修改仍可能影响原值，甚至触发反向版本检查。\n\ndetach 不等于将数据搬到 CPU，也不等于复制数据。如果要把结果长期缓存为不会被后续修改影响的快照，可以 detach().clone()。如果只是为了打印日志，通常只提取必要的标量，避免保留整条计算图和频繁同步。",
            "code": "import torch\nx = torch.tensor(2., requires_grad=True)\na = x.square()\nloss = a + 3 * a.detach()\nloss.backward()\nprint(loss.item())    # 16\nprint(x.grad.item())  # 4, not 16\nsnapshot = a.detach().clone()",
            "language": "python"
          },
          {
            "heading": "No_grad 关闭一个区域的反向记录",
            "body": "torch.no_grad 让作用域中的普通运算不记录反向图，即使输入参数仍然 requires_grad=True。这适合验证、参数更新或构造固定 target。离开作用域后梯度模式恢复，其输出通常仍是普通张量，可以作为常量参与后续需要梯度的计算。工厂函数的 requires_grad 参数存在例外，不能理解成强制所有新对象不可训练。\n\n冻结参数可以对它们设置 requires_grad_(False)。只要输入需要梯度，经过冻结模块的运算仍可能被记录，以便梯度继续传回更早的可训练模块。如果直接用 no_grad 包住整个冻结模块，则会切断这条输入梯度路径，两种方式并不等价。",
            "code": "import torch\nfrozen = torch.nn.Linear(3, 2)\nfrozen.requires_grad_(False)\nx = torch.randn(4, 3, requires_grad=True)\ny = frozen(x)\ny.sum().backward()\nprint(x.grad is not None)          # True\nprint(frozen.weight.grad is None)  # True\nwith torch.no_grad():\n    z = frozen(x)\nprint(z.requires_grad)             # False",
            "language": "python"
          },
          {
            "heading": "Inference_mode 更强，eval 是另一回事",
            "body": "inference_mode 在禁用梯度记录之外，还关闭部分视图跟踪和版本计数开销，并禁用前向模式自动微分。内部创建的 inference tensor 有更严格约束：不能假设它能像普通 no_grad 输出一样，安全进入后续需要保存输入的反向计算。后续还会参与训练时，优先用 no_grad，或在离开 inference_mode 后 clone 成普通张量。\n\nmodel.eval 只切换模块的 training 标志，让 Dropout、BatchNorm 等采用评估行为；不会关闭 autograd。反过来，no_grad 也不会自动关闭 Dropout。验证通常需要 eval 与 no_grad/inference_mode 两者配合，结束后还要恢复 train 模式。",
            "code": "import torch\nmodel = torch.nn.Sequential(torch.nn.Linear(3, 3), torch.nn.Dropout(0.5))\nx = torch.randn(2, 3, requires_grad=True)\nmodel.eval()\ny = model(x)\nprint(y.requires_grad)  # True: eval is not a gradient mode\nwith torch.inference_mode():\n    pred = model(x)\nprint(pred.requires_grad)  # False\nmodel.train()",
            "language": "python"
          },
          {
            "heading": "给固定教师和可训练学生划清边界",
            "body": "知识蒸馏是检查梯度边界的直观例子：教师输出提供监督目标，学生输出负责优化。先让教师进入 eval，冻结教师参数，再在 no_grad 中计算目标；学生正常前向并计算损失。这样既让教师行为稳定，又不为不需要的目标分支保存反向中间量。\n\n不能把整个 loss 放进 no_grad，也不能把学生输出一起 detach，否则学生没有更新信号。若某个任务需要通过教师对输入求导，例如构造输入扰动，则应重新审视这条边界：可以冻结教师参数而保留输入的图。梯度边界属于算法定义，不是可以一律套用的性能技巧。",
            "code": "import torch\nfrom torch import nn\nfrom torch.nn import functional as F\nteacher = nn.Linear(3, 2).eval().requires_grad_(False)\nstudent = nn.Linear(3, 2).train()\nx = torch.randn(4, 3)\nwith torch.no_grad():\n    target = teacher(x)\nprediction = student(x)\nloss = F.mse_loss(prediction, target)\nloss.backward()\nprint(student.weight.grad is not None)  # True\nprint(teacher.weight.grad is None)      # True",
            "language": "python",
            "callout": "eval 不等于冻结参数；requires_grad_(False) 不等于不记录输入的梯度路径。"
          }
        ],
        "takeaways": [
          "detach 切断局部连接但共享存储；no_grad 控制一段运算是否构图。",
          "inference_mode 约束更强，适合结果不再参与训练的纯推理区域。",
          "eval 控制模块行为；固定目标与可训练预测必须分别设置梯度边界。"
        ],
        "references": [
          {
            "label": "Locally disabling gradient computation",
            "url": "https://docs.pytorch.org/docs/stable/notes/autograd.html#locally-disabling-gradient-computation"
          },
          {
            "label": "torch.inference_mode",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.autograd.grad_mode.inference_mode.html"
          },
          {
            "label": "Tensor.detach",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.Tensor.detach.html"
          }
        ],
        "quiz": [
          {
            "id": "autograd-3-q1",
            "type": "single",
            "topic": "停止梯度",
            "prompt": "x=2 且需要梯度，a=x²，loss=a+3*a.detach()。d(loss)/dx 是多少？",
            "options": [
              "16",
              "12",
              "4",
              "0"
            ],
            "answer": 2,
            "explanation": "只有未 detach 的 a 提供梯度，导数为 2x=4。loss 的数值是 16，但数值大小不是导数。"
          },
          {
            "id": "autograd-3-q2",
            "type": "single",
            "topic": "评估模式",
            "prompt": "关于 model.eval()，哪项正确？",
            "options": [
              "它关闭所有参数的 requires_grad",
              "它让 Dropout 等切换评估行为，但不自动禁用 autograd",
              "它等价于 torch.inference_mode()",
              "它自动清空 .grad"
            ],
            "answer": 1,
            "explanation": "eval 修改模块 training 状态；梯度模式、参数可训练性与已有梯度缓存属于独立机制。"
          },
          {
            "id": "autograd-3-q3",
            "type": "single",
            "topic": "梯度边界",
            "prompt": "固定教师指导学生训练时，通常哪组关系正确？",
            "options": [
              "教师和学生输出都 detach",
              "仅教师输出需要梯度",
              "把 loss 放入 no_grad 再 backward",
              "教师目标不构图，学生预测保留梯度"
            ],
            "answer": 3,
            "explanation": "学生输出必须保留梯度以更新参数；固定教师目标可在 no_grad 中生成。把全部输出 detach 或关闭 loss 构图会切断学生的训练信号。"
          }
        ]
      },
      {
        "id": "autograd-4",
        "title": "自定义反向与 gradcheck",
        "description": "为自定义算子写出正确的 VJP，用数值差分发现静默错误。",
        "duration": 22,
        "difficulty": "进阶",
        "objectives": [
          "实现 autograd.Function 的 forward/backward 契约",
          "处理广播输入的梯度归约",
          "解释 gradcheck 的双精度要求与非光滑点限制"
        ],
        "sections": [
          {
            "heading": "什么时候才需要自定义 Function",
            "body": "如果运算已经能由普通 PyTorch 可微算子组合，优先写普通函数或 Module，autograd 会自动推导反向。自定义 Function 主要用于连接外部 kernel、融合操作、控制保存张量或定义特殊梯度。它不是让任意 Python 代码自动获得正确导数的装饰器，反向公式必须由实现者负责。\n\nforward 接收输入并返回张量；backward 接收每个输出对应的上游梯度，并按 forward 输入顺序返回输入梯度。非张量参数等位置返回 None。对于 y=x³，反向不能简单返回 3x²，而要乘上收到的 grad_output，才能与更大的计算图正确连接。",
            "code": "import torch\nclass Cube(torch.autograd.Function):\n    @staticmethod\n    def forward(ctx, x):\n        ctx.save_for_backward(x)\n        return x ** 3\n\n    @staticmethod\n    def backward(ctx, grad_output):\n        (x,) = ctx.saved_tensors\n        return grad_output * 3 * x.square()\n\nx = torch.tensor(2., requires_grad=True)\n(2 * Cube.apply(x)).backward()\nprint(x.grad.item())  # 24, includes upstream gradient 2",
            "language": "python"
          },
          {
            "heading": "保存必要的值，并尊重输入形状",
            "body": "需要在反向读取的张量应通过 save_for_backward 保存，它能接入 autograd 的生命周期、版本检查和 saved tensor 机制；普通标量元数据可以存到 ctx 属性上。任意把张量挂在 ctx 上容易绕开重要管理逻辑，也让后续内存优化更加困难。\n\n广播是自定义反向的常见陷阱。若 y=x×scale，x 为 [B,D]，scale 为 [D]，前向把 scale 广播到 B 行，但返回给 scale 的梯度必须缩回 [D]，沿被广播的 B 轴求和。sum_to_size 能把广播后的贡献归约到原输入形状。只让前向值对齐远远不够。",
            "code": "import torch\nclass Scale(torch.autograd.Function):\n    @staticmethod\n    def forward(ctx, x, scale):\n        ctx.save_for_backward(x, scale)\n        return x * scale\n\n    @staticmethod\n    def backward(ctx, grad_output):\n        x, scale = ctx.saved_tensors\n        grad_x = (grad_output * scale).sum_to_size(x.shape)\n        grad_scale = (grad_output * x).sum_to_size(scale.shape)\n        return grad_x, grad_scale\n\nx = torch.tensor([[1., 2.], [3., 4.]], requires_grad=True)\ns = torch.tensor([2., 3.], requires_grad=True)\nScale.apply(x, s).sum().backward()\nprint(s.grad)  # [4, 6], summed across B",
            "language": "python"
          },
          {
            "heading": "Gradcheck 对照有限差分",
            "body": "gradcheck 用小扰动近似数值导数，再与自定义反向的解析结果比较。默认容差主要面向 double 精度；用 FP16 或 FP32 输入直接检查，可能因为数值差分误差失败。输入必须设置 requires_grad，并应避免恰好处于 abs 在零点这样的不可导位置。\n\n重叠存储的输入也需要小心：对一个逻辑元素扰动可能同时改变其他元素，破坏有限差分的独立变量假设。随机性需要固定或移除。通过一次 gradcheck 只能证明所测形状和取值附近一致，还应覆盖广播、非连续输入、极端数值及不同上游梯度。",
            "code": "import torch\nclass Cube(torch.autograd.Function):\n    @staticmethod\n    def forward(ctx, x):\n        ctx.save_for_backward(x)\n        return x ** 3\n    @staticmethod\n    def backward(ctx, grad_output):\n        (x,) = ctx.saved_tensors\n        return grad_output * 3 * x.square()\n\nx = torch.randn(3, dtype=torch.double, requires_grad=True)\nprint(torch.autograd.gradcheck(Cube.apply, (x,)))      # True\nprint(torch.autograd.gradgradcheck(Cube.apply, (x,)))  # True",
            "language": "python"
          },
          {
            "heading": "高阶梯度与内存优化的边界",
            "body": "自定义 forward 内部的普通运算不会像常规前向那样全部构建可追溯的内部图。想支持双重反向，需要确保 backward 中使用的输入、保存值和操作形成正确的高阶梯度路径。保存输入再在 backward 里重算常常更清晰；如果只保存与输入脱离图的中间结果，二阶导可能错误或不可用。\n\n如果算子明确不支持高阶梯度，应使用 once_differentiable 等机制表达限制，并在接口说明中写清楚。分析 fused loss 或 activation checkpoint 时，要分别检查前向数值、反向 VJP、所需保存量与二阶导要求；节约内存不应建立在悄悄丢失正确梯度的基础上。",
            "code": "import torch\nfrom torch.autograd.function import once_differentiable\n\nclass FirstOrderSquare(torch.autograd.Function):\n    @staticmethod\n    def forward(ctx, x):\n        ctx.save_for_backward(x)\n        return x.square()\n\n    @staticmethod\n    @once_differentiable\n    def backward(ctx, grad_output):\n        (x,) = ctx.saved_tensors\n        return grad_output * 2 * x\n# This implementation explicitly supports first-order gradients only.",
            "language": "python",
            "callout": "gradcheck 检查一阶导，gradgradcheck 检查二阶相关路径，一个通过不能替代另一个。"
          }
        ],
        "takeaways": [
          "backward 返回上游梯度乘局部导数，并匹配每个输入的原始形状。",
          "用 save_for_backward 管理张量，广播梯度要归约回输入形状。",
          "用 double 精度 gradcheck 和必要的 gradgradcheck 验证导数。"
        ],
        "references": [
          {
            "label": "Extending torch.autograd",
            "url": "https://docs.pytorch.org/docs/stable/notes/extending.html#extending-torch-autograd"
          },
          {
            "label": "torch.autograd.gradcheck",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.autograd.gradcheck.html"
          },
          {
            "label": "torch.autograd.gradgradcheck",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.autograd.gradgradcheck.html"
          }
        ],
        "quiz": [
          {
            "id": "autograd-4-q1",
            "type": "single",
            "topic": "自定义 VJP",
            "prompt": "Cube.forward(x)=x³。backward(ctx, grad_output) 应返回什么？",
            "options": [
              "3*x**2",
              "grad_output*3*x**2",
              "grad_output*x**3",
              "torch.ones_like(x)"
            ],
            "answer": 1,
            "explanation": "链式法则要求乘上游梯度。只返回 3x² 仅在上游梯度恰好为 1 时碰巧正确，接入其他损失就会错。"
          },
          {
            "id": "autograd-4-q2",
            "type": "single",
            "topic": "广播反向",
            "prompt": "x=[B,D]，scale=[D]，y=x*scale。scale 的梯度应是什么形状？",
            "options": [
              "[B,D]，因为输出是这个形状",
              "[B]，沿 D 求和",
              "[D]，把逐元素贡献沿 B 归约",
              "标量，对所有元素求和"
            ],
            "answer": 2,
            "explanation": "输入梯度必须匹配输入形状。scale 在 B 轴被重复使用，因此沿 B 累加贡献，得到 [D]。"
          },
          {
            "id": "autograd-4-q3",
            "type": "single",
            "topic": "Gradcheck",
            "prompt": "为平滑自定义算子运行默认 gradcheck，哪组输入条件最合适？",
            "options": [
              "FP16、requires_grad=False、重叠 expand 视图",
              "int64 且每个元素为 0",
              "只用大 batch，不检查 dtype",
              "double、requires_grad=True、避免重叠存储和不可导点"
            ],
            "answer": 3,
            "explanation": "有限差分需要足够精度和可独立扰动的变量，默认容差针对 double。不可导点、随机性与重叠视图会影响可靠性。"
          }
        ]
      }
    ]
  },
  {
    "id": "nn",
    "number": 3,
    "title": "模型与训练工程",
    "subtitle": "把一个可训练模型变成可靠系统",
    "description": "掌握模块注册、网络构建、目标函数与训练状态，形成可以验证、恢复和扩展的训练基线。",
    "level": "进阶",
    "color": "#58a700",
    "icon": "layers",
    "lessons": [
      {
        "id": "nn-1",
        "title": "Module、Parameter 与状态",
        "description": "参数为什么能被优化器发现？检查模型注册与 checkpoint 的关系。",
        "duration": 18,
        "difficulty": "基础",
        "objectives": [
          "区分 Parameter、buffer 与普通张量属性",
          "解释 ModuleList 的注册作用与模块调用路径",
          "保存独立 state_dict 快照并检查加载键"
        ],
        "sections": [
          {
            "heading": "Module 是递归注册树",
            "body": "nn.Module 组织子模块、参数和缓冲区，使 parameters、to、train 及 state_dict 可以递归工作。把 nn.Linear 赋给 Module 属性会自动注册它；把若干层装进普通 Python list 则不会把列表内容自动注册成子模块。需要动态层数时使用 ModuleList 或 ModuleDict，按顺序执行的简单流水线可以使用 Sequential。\n\n应调用 model(x)，而不是直接调用 model.forward(x)。前者经过 Module 的调用逻辑，处理注册的前向与反向 hooks 等机制。使用监控 hook 或分布式包装器时，绕过调用路径可能导致行为不符合预期，即使前向数值暂时看起来相同。",
            "code": "import torch\nfrom torch import nn\nclass Stack(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.layers = nn.ModuleList([nn.Linear(4, 4) for _ in range(2)])\n    def forward(self, x):\n        for layer in self.layers:\n            x = torch.relu(layer(x))\n        return x\nmodel = Stack()\nprint(list(dict(model.named_parameters())))\n# layers.0.weight, layers.0.bias, layers.1.weight, layers.1.bias\nprint(model(torch.randn(3, 4)).shape)  # [3, 4]",
            "language": "python"
          },
          {
            "heading": "Parameter 和 buffer 管不同状态",
            "body": "nn.Parameter 是会被模块自动识别为参数的张量，通常参与梯度和优化器更新。buffer 是模型状态但不是优化器参数，例如 BatchNorm 的运行均值、固定位置编码或计数器。注册 buffer 后，它跟随 model.to 迁移设备，默认写入 state_dict；persistent=False 可以排除能重新生成的缓存。\n\n普通张量属性如果既不是 Parameter 也没注册为 buffer，不会享受这些递归行为。这样的代码在 CPU 上可能正常，在 GPU 或恢复 checkpoint 时才暴露问题。某个量是否应该训练、是否需要随设备迁移、是否持久保存，是三个不同的问题，应分别决定。",
            "code": "import torch\nfrom torch import nn\nclass Affine(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.weight = nn.Parameter(torch.ones(3))\n        self.register_buffer(\"offset\", torch.zeros(3))\n        self.register_buffer(\"scratch\", torch.zeros(3), persistent=False)\n        self.unregistered = torch.zeros(3)\n    def forward(self, x):\n        return x * self.weight + self.offset\nm = Affine()\nprint(list(dict(m.named_parameters())))  # [weight]\nprint(list(m.state_dict()))             # [weight, offset]",
            "language": "python"
          },
          {
            "heading": "State_dict 不是自动冻结的快照",
            "body": "state_dict 返回参数与持久 buffer 的映射，键名对应模块树的路径。返回值是浅层映射，内部张量通常仍引用模块的状态存储；如果仅把 best_state = model.state_dict() 放到变量里继续训练，其中的数据可能跟着变化。要在内存保存真正独立的最佳快照，应 deep copy 或逐项 detach().cpu().clone()。\n\n加载时应检查 missing_keys 与 unexpected_keys。strict=False 是允许键集合不完全匹配，并不意味着任意尺寸不匹配都能自动处理。迁移结构或加载外部权重时，还要确认键名前缀、共享参数、分片格式和 dtype 等信息，不能仅凭加载语句未报错就判断恢复完整。",
            "code": "import torch\nfrom torch import nn\nm = nn.Linear(2, 1)\nstate = m.state_dict()\nsnapshot = {k: v.detach().cpu().clone() for k, v in state.items()}\nwith torch.no_grad():\n    m.weight.add_(1)\nprint(torch.equal(state[\"weight\"], m.weight))     # True\nprint(torch.equal(snapshot[\"weight\"], m.weight))  # False\nresult = m.load_state_dict(snapshot, strict=True)\nprint(result.missing_keys, result.unexpected_keys)  # [], []",
            "language": "python"
          },
          {
            "heading": "参数身份影响优化器与共享权重",
            "body": "优化器在构造时接收 Parameter 对象引用。训练中如果把属性替换成新的 Parameter，已有优化器不会自动接管新对象；动量等状态也对应旧参数身份。因此设备迁移、模型初始化与参数注册通常先完成，再创建优化器。改变现有参数数值时，在 no_grad 下 copy_ 可以保留对象身份。\n\n权重共享则让多个模块使用同一个 Parameter，例如输入 embedding 和输出投影共享矩阵。这影响参数去重、梯度累加与 checkpoint 解释。分析模型结构时不仅要数层数，还要识别参数别名；表面出现两处 weight，不一定意味着内存里存在两份独立权重。",
            "code": "import torch\nfrom torch import nn\nembedding = nn.Embedding(7, 4)\nhead = nn.Linear(4, 7, bias=False)\nhead.weight = embedding.weight\nprint(head.weight is embedding.weight)  # True\nwith torch.no_grad():\n    head.weight.copy_(torch.ones_like(head.weight))\nprint(embedding.weight[0])  # also all ones",
            "language": "python",
            "callout": "权重 checkpoint 通常不包含优化器动量、scheduler、随机数状态与数据进度，不能等同于完整训练状态。"
          }
        ],
        "takeaways": [
          "ModuleList 注册子模块；Parameter、buffer 和普通属性的递归行为不同。",
          "state_dict 是状态映射，内存中的最佳权重快照需要显式复制。",
          "优化器持有参数对象引用，替换 Parameter 与修改数值不是同一操作。"
        ],
        "references": [
          {
            "label": "torch.nn.Module",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.Module.html"
          },
          {
            "label": "ModuleList",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.ModuleList.html"
          },
          {
            "label": "Serialization semantics",
            "url": "https://docs.pytorch.org/docs/stable/notes/serialization.html"
          }
        ],
        "quiz": [
          {
            "id": "nn-1-q1",
            "type": "single",
            "topic": "模块注册",
            "prompt": "动态层列表应使用什么，才能被 parameters() 和 to(device) 递归发现？",
            "options": [
              "普通 Python list",
              "nn.ModuleList",
              "tuple(layer.parameters())",
              "torch.tensor(layers)"
            ],
            "answer": 1,
            "explanation": "ModuleList 会注册内部 Module。普通 list 只存 Python 对象，不会自动把内部层加入父模块注册树。"
          },
          {
            "id": "nn-1-q2",
            "type": "single",
            "topic": "Buffer",
            "prompt": "固定统计量需要随模型移动设备、默认写入 state_dict，但不是优化器参数，应如何定义？",
            "options": [
              "self.stat = torch.zeros(3)",
              "nn.Parameter(..., requires_grad=True)",
              "register_buffer(\"stat\", tensor)",
              "每次 forward 创建 CPU 张量"
            ],
            "answer": 2,
            "explanation": "buffer 适合非参数状态，并默认持久化。普通张量属性不自动迁移或持久化，Parameter 会进入参数枚举。"
          },
          {
            "id": "nn-1-q3",
            "type": "single",
            "topic": "权重快照",
            "prompt": "想在内存保存最佳权重，随后继续训练，哪项可靠？",
            "options": [
              "best = {k: v.detach().cpu().clone() for k,v in model.state_dict().items()}",
              "best = model.state_dict()",
              "best = model",
              "best = model.parameters()"
            ],
            "answer": 0,
            "explanation": "显式 clone 让快照独立于后续修改。state_dict 是浅映射，其他选项则只是模型引用或参数迭代器。"
          }
        ]
      },
      {
        "id": "nn-2",
        "title": "从线性层搭建一个 MLP",
        "description": "逐层推导形状，理解非线性、初始化、归一化和残差连接。",
        "duration": 20,
        "difficulty": "基础",
        "objectives": [
          "推导 Linear 的输入输出形状与参数量",
          "构造包含激活、归一化和 Dropout 的 MLP",
          "检查初始化与残差连接的基本契约"
        ],
        "sections": [
          {
            "heading": "Linear 只变换最后一个维度",
            "body": "Linear(in_features, out_features) 计算 y=xWᵀ+b，权重形状是 [out_features,in_features]，不是输入输出维度顺序。它支持任意前导维度：输入 [B,T,D] 经 Linear(D,C) 得到 [B,T,C]，同一份权重作用于所有样本和位置。含 bias 时参数量是 D×C+C。\n\n多层线性映射如果中间没有非线性，可以合并为一个仿射映射，无法获得真正更强的非线性表达。ReLU、GELU 等激活函数因此是 MLP 的关键组成。分类头通常输出未归一化 logits，交叉熵负责稳定地组合 log-softmax 与负对数似然，不必在模型末尾先加 softmax。",
            "code": "import torch\nfrom torch import nn\nlayer = nn.Linear(4, 3)\nx = torch.randn(2, 5, 4)\nprint(layer.weight.shape)  # [3, 4]\nprint(layer(x).shape)      # [2, 5, 3]\nprint(sum(p.numel() for p in layer.parameters()))  # 15\nmanual = x @ layer.weight.t() + layer.bias\ntorch.testing.assert_close(layer(x), manual)",
            "language": "python"
          },
          {
            "heading": "用 Sequential 表达顺序计算",
            "body": "一个基础分类器可以依次执行输入投影、非线性、归一化、Dropout 和输出投影。Sequential 会注册子模块，并把前一个输出传给下一个。LayerNorm(hidden) 在最后一个长度为 hidden 的维度上做归一化，适合不希望混合不同样本统计量的场景；BatchNorm 则有不同的维度与运行统计契约。\n\n每层前后都写下形状，能在训练前发现大多数维度错误。Flatten 默认保留第零维，把其后的轴合并，所以图像 [B,C,H,W] 可以被转成 [B,C×H×W] 送入 MLP；序列如果需要保留 token 轴，就不应该不加分析地使用同一 Flatten。",
            "code": "import torch\nfrom torch import nn\nmodel = nn.Sequential(\n    nn.Flatten(),          # [B,1,8,8] -> [B,64]\n    nn.Linear(64, 32),\n    nn.ReLU(),\n    nn.LayerNorm(32),\n    nn.Dropout(0.1),\n    nn.Linear(32, 10),     # class logits\n)\nx = torch.randn(4, 1, 8, 8)\nfor layer in model:\n    x = layer(x)\n    print(type(layer).__name__, tuple(x.shape))\n# Final shape: (4, 10)",
            "language": "python"
          },
          {
            "heading": "初始化让前向和梯度保持合理尺度",
            "body": "初始权重太大会让激活与梯度迅速放大，太小则可能让信号逐层衰减。Kaiming 初始化根据输入或输出连接数与激活特性调整方差，常用于 ReLU；Xavier 初始化则根据输入输出连接数平衡尺度。不能把某个初始化方案无条件应用到所有层，还需要匹配激活和网络结构。\n\nnn.init 的操作在不记录梯度的上下文中修改参数。给网络 apply 一个初始化函数可以递归处理不同层，但应在优化器构建前完成。所有隐藏单元使用相同常数权重会产生对称性问题；偏置初始化为零很常见，不代表权重也应全部为零。",
            "code": "import torch\nfrom torch import nn\nmodel = nn.Sequential(nn.Linear(16, 32), nn.ReLU(), nn.Linear(32, 4))\n# Hidden layer feeds ReLU: use a matching Kaiming initialization.\nnn.init.kaiming_normal_(model[0].weight, nonlinearity=\"relu\")\nnn.init.zeros_(model[0].bias)\n# The output is linear: choose a separate initialization.\nnn.init.xavier_uniform_(model[2].weight)\nnn.init.zeros_(model[2].bias)\nx = torch.randn(64, 16)\nprint(model(x).shape)  # [64, 4]",
            "language": "python"
          },
          {
            "heading": "残差要求语义和形状一致",
            "body": "残差块把输入 x 与变换 f(x) 相加，为信息和梯度提供直接路径。两者不仅要形状兼容，还要具有相同的语义排列；如果依靠广播把不匹配的维度悄悄补齐，可能得到能运行却不正确的网络。隐藏宽度改变时，常用投影层把残差分支调整到目标宽度。\n\n训练与验证模式也属于模型契约：Dropout 在训练中随机屏蔽元素并缩放，在 eval 中成为恒等映射。LayerNorm 的统计来自当前输入，在训练和评估中使用相同机制，不像 BatchNorm 默认依赖运行统计。验证时切换 eval 后仍需选择合适的梯度模式，结束后恢复 train。",
            "code": "import torch\nfrom torch import nn\nclass ResidualMLP(nn.Module):\n    def __init__(self, width):\n        super().__init__()\n        self.norm = nn.LayerNorm(width)\n        self.net = nn.Sequential(nn.Linear(width, 2*width), nn.GELU(),\n                                 nn.Linear(2*width, width), nn.Dropout(0.1))\n    def forward(self, x):\n        return x + self.net(self.norm(x))\nblock = ResidualMLP(8)\nx = torch.randn(2, 5, 8)\nprint(block(x).shape)  # [2, 5, 8]\nblock.eval()\nwith torch.no_grad():\n    torch.testing.assert_close(block(x), block(x))",
            "language": "python",
            "callout": "模型能前向运行不等于正确：检查输出 logits、参数注册、随机层模式和每个轴的语义。"
          }
        ],
        "takeaways": [
          "Linear 变换最后一维，权重为 [out_features,in_features]。",
          "非线性、初始化与归一化共同决定训练信号的传播。",
          "残差加法需要语义一致；eval、梯度模式和冻结参数应分别控制。"
        ],
        "references": [
          {
            "label": "torch.nn.Linear",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.Linear.html"
          },
          {
            "label": "torch.nn.Sequential",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.Sequential.html"
          },
          {
            "label": "Weight initialization",
            "url": "https://docs.pytorch.org/docs/stable/nn.init.html"
          },
          {
            "label": "torch.nn.LayerNorm",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.LayerNorm.html"
          }
        ],
        "quiz": [
          {
            "id": "nn-2-q1",
            "type": "single",
            "topic": "Linear 形状",
            "prompt": "输入 [2,5,4] 经过带 bias 的 Linear(4,3)，输出形状和参数量是什么？",
            "options": [
              "[2,5,3]，15",
              "[2,3]，12",
              "[2,5,4]，15",
              "[2,5,3]，20"
            ],
            "answer": 0,
            "explanation": "Linear 仅把最后一维 4 变成 3，保留 [2,5]。权重有 3×4=12 个元素，偏置 3 个，共 15。"
          },
          {
            "id": "nn-2-q2",
            "type": "single",
            "topic": "非线性表达",
            "prompt": "多个 Linear 层之间没有非线性激活，整体相当于什么？",
            "options": [
              "任意深度的非线性函数",
              "一个仿射映射",
              "必然是恒等映射",
              "等价于 softmax"
            ],
            "answer": 1,
            "explanation": "仿射映射的复合仍是仿射映射；深度本身不会引入非线性。只有特定权重才可能得到恒等映射。"
          },
          {
            "id": "nn-2-q3",
            "type": "single",
            "topic": "初始化",
            "prompt": "下列初始化做法哪项最合理？",
            "options": [
              "把所有隐藏层权重设成同一个零常数",
              "所有层不分激活都使用同一个方差",
              "在每次 optimizer.step 后重新随机初始化",
              "ReLU 隐藏层按其连接数采用 Kaiming，并单独考虑输出层"
            ],
            "answer": 3,
            "explanation": "初始化应匹配激活和连接数。权重全相同会保留神经元对称性，每次更新后重新初始化则会抹掉学习结果。"
          }
        ]
      },
      {
        "id": "nn-3",
        "title": "Loss、mask 与归约分母",
        "description": "写出真正对应训练目标的损失，避免形状正确但优化目标错误。",
        "duration": 22,
        "difficulty": "进阶",
        "objectives": [
          "匹配回归、互斥分类与多标签任务的损失接口",
          "推导 masked loss 的有效元素分母",
          "完成自回归 next-token 的标签错位与 padding 屏蔽"
        ],
        "sections": [
          {
            "heading": "先定义预测对象，再选损失",
            "body": "损失函数定义“什么算错误”，其输入契约必须和任务匹配。MSE 比较连续值，通常要求预测与目标具有一致语义的形状；互斥多分类常用 CrossEntropyLoss，输入是未归一化 logits，整数目标表示一个类别；多标签任务的每个类别可以独立为真，通常使用 BCEWithLogitsLoss。\n\nCrossEntropyLoss 内部组合稳定的 log-softmax 与负对数似然，不需要在前面加 softmax。BCEWithLogitsLoss 内部组合 sigmoid 与二元交叉熵，也不需要先 sigmoid。重复归一化不仅多余，还会改变损失与梯度。先画出每个样本需要预测一个类别，还是多个独立标签，能避免从入口就选错目标。",
            "code": "import torch\nfrom torch.nn import functional as F\nlogits = torch.zeros(2, 3)\nclass_ids = torch.tensor([0, 2], dtype=torch.long)\nprint(F.cross_entropy(logits, class_ids))  # log(3), about 1.0986\nmulti_label = torch.tensor([[1., 0., 1.], [0., 1., 0.]])\nprint(F.binary_cross_entropy_with_logits(logits, multi_label))\n# log(2), about 0.6931\npred = torch.tensor([1., 3.])\ntarget = torch.tensor([2., 1.])\nprint(F.mse_loss(pred, target))  # (1 + 4) / 2 = 2.5",
            "language": "python"
          },
          {
            "heading": "类别轴与标签 dtype 是接口契约",
            "body": "CrossEntropyLoss 对常见的多维输入使用第 1 维作为类别轴：输入 [N,C,d₁,...] 搭配整数目标 [N,d₁,...]。Transformer 常输出 [B,T,V]，需要移成 [B,V,T]，或者把 batch 与 token 合并成 [B×T,V]。直接把 [B,T,V] 输入交叉熵，可能把 T 错当类别数。\n\n整数类别标签通常为 long，取值在合法类别范围内，另有 ignore_index 特例。交叉熵也支持与输入同形的浮点概率目标，但那是另一种契约，不等于任意浮点标签都会自动正确。BCE 的目标则与 logits 同形并使用浮点类型；回归中 [B,1] 和 [B] 意外广播成 [B,B] 也是常见错误。",
            "code": "import torch\nfrom torch.nn import functional as F\nB, T, V = 2, 3, 5\nlogits = torch.randn(B, T, V)\nlabels = torch.tensor([[1, 2, 3], [4, 0, 1]])\na = F.cross_entropy(logits.transpose(1, 2), labels, reduction=\"none\")\nb = F.cross_entropy(logits.reshape(B*T, V),\n                    labels.reshape(B*T), reduction=\"none\").reshape(B, T)\nprint(a.shape)  # [2, 3]\ntorch.testing.assert_close(a, b)\n# Regression: ensure both tensors are [B] or both are [B,1].",
            "language": "python"
          },
          {
            "heading": "Mask 的分母决定每个 token 的权重",
            "body": "忽略 padding 时，先保留逐 token 损失，再只对有效位置求和，以有效 token 数为分母。不能先把无效位置乘零，再直接对全部位置 mean，那样分母仍包括 padding，导致不同长度 batch 的梯度尺度变化。对每条序列先求均值再平均，则是 sequence 平均，和 token 平均一般不同。\n\n下面限定整数标签、未设置类别权重的交叉熵。ignore_index 使忽略位置的未归约损失为零；如果有效数为零，应跳过这个更新或按任务明确处理，不能让除零生成 NaN。设置 class weight 后，默认 mean 的分母有额外权重语义，不能继续无条件照搬 token 计数。",
            "code": "import torch\nfrom torch.nn import functional as F\nlogits = torch.zeros(2, 3, 4, requires_grad=True)\nlabels = torch.tensor([[1, 2, -100], [0, -100, -100]])\nper_token = F.cross_entropy(logits.transpose(1, 2), labels,\n                            ignore_index=-100, reduction=\"none\")\nvalid = labels.ne(-100)\ncount = valid.sum()\nif count.item() == 0:\n    print(\"Skip this optimizer update: there are no valid tokens.\")\nelse:\n    loss = per_token.sum() / count\n    print(loss.item())  # log(4), about 1.3863\n    loss.backward()\n# per_token.mean() would incorrectly divide by 6 instead of 3.",
            "language": "python",
            "callout": "Mask 不能把原本未定义的运算变成安全运算；NaN × 0 仍是 NaN，应确保被归约的计算路径本身有效。"
          },
          {
            "heading": "自回归训练还需要正确错位",
            "body": "next-token 训练中，位置 t 的 logits 预测位置 t+1 的 token。因此一般把 logits 去掉最后一个位置，把 labels 去掉第一个位置，再计算交叉熵；不能让位置 t 预测已经读到的同一个 token。注意力的 causal mask 同样必需，否则模型可能在前向偷看未来，单靠标签错位无法阻止信息泄漏。\n\npadding mask 应与错位后的目标同步裁剪。如果训练只评价回答部分，还需要把 prompt 对应目标也排除，但这属于明确的任务选择。先在一条短序列上列出“输入位置、目标 token、是否计分”，再推广到 batch，是定位错误的有效方法；日志也应记录有效 token 总数，便于解释 loss 的分母。",
            "code": "import torch\nfrom torch.nn import functional as F\ntokens = torch.tensor([[1, 2, 3, 0], [1, 4, 2, 3]])\nvalid = tokens.ne(0)\nlogits = torch.zeros(2, 4, 5, requires_grad=True)  # from a causal model\nnext_logits = logits[:, :-1, :]                 # [2, 3, 5]\ntargets = tokens[:, 1:].clone()                 # [2, 3]\ntargets.masked_fill_(~valid[:, 1:], -100)\nprint(targets.tolist())  # [[2, 3, -100], [4, 2, 3]]\nloss = F.cross_entropy(next_logits.transpose(1, 2), targets,\n                       ignore_index=-100)\nprint(loss.item())  # log(5), about 1.6094",
            "language": "python",
            "callout": "本课手工对齐 next-token 标签。如果模型的 forward(..., labels=...) 已在内部完成移位，就不要在外部再次移位。示例以 0 专门作为 PAD；若 PAD 与 EOS 共用 ID，应使用独立 attention/label mask，不能把所有该 ID 一律忽略。"
          }
        ],
        "takeaways": [
          "交叉熵接收 logits；互斥分类与多标签 BCE 使用不同目标契约。",
          "Mask 必须同时决定分子与分母，token 平均不等于序列平均。",
          "自回归训练需要标签错位、同步 mask 和防止未来泄漏的前向约束。"
        ],
        "references": [
          {
            "label": "CrossEntropyLoss",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.CrossEntropyLoss.html"
          },
          {
            "label": "BCEWithLogitsLoss",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.BCEWithLogitsLoss.html"
          },
          {
            "label": "MSELoss",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.nn.MSELoss.html"
          }
        ],
        "quiz": [
          {
            "id": "nn-3-q1",
            "type": "single",
            "topic": "损失输入",
            "prompt": "做互斥多分类时，CrossEntropyLoss 的常见输入组合是哪项？",
            "options": [
              "softmax 概率与任意浮点标签",
              "原始 logits 与 long 类型类别 id",
              "sigmoid 概率与布尔 attention mask",
              "argmax 类别与 long 标签"
            ],
            "answer": 1,
            "explanation": "交叉熵内部使用 log-softmax，应输入 logits。argmax 会丢掉可微概率信息；概率目标是另一种严格同形的接口，不是任意浮点标签。"
          },
          {
            "id": "nn-3-q2",
            "type": "single",
            "topic": "Mask 分母",
            "prompt": "6 个位置中只有 3 个有效 token，三个有效损失均为 2。总体有效 token 平均 loss 是多少？",
            "options": [
              "1",
              "6",
              "2",
              "3"
            ],
            "answer": 2,
            "explanation": "有效损失和为 6，有效计数为 3，所以均值为 2。直接对补零后的六个位置 mean 得到 1，错误地把 padding 纳入分母。"
          },
          {
            "id": "nn-3-q3",
            "type": "single",
            "topic": "标签错位",
            "prompt": "对 tokens=[1,2,3,0]，0 是 padding，next-token 的三个目标应是什么？",
            "options": [
              "[1,2,3]",
              "[2,3,0] 且三个位置都计分",
              "[1,2,-100]",
              "[2,3,-100]"
            ],
            "answer": 3,
            "explanation": "前三个 logits 分别预测后一个 token，目标是 2、3、padding。padding 应被忽略，因此使用约定的 ignore_index=-100。"
          }
        ]
      },
      {
        "id": "nn-4",
        "title": "训练、验证与可恢复 checkpoint",
        "description": "把清梯度、反向、更新、评估和状态保存串成一条可靠链路。",
        "duration": 24,
        "difficulty": "进阶",
        "objectives": [
          "实现一次完整的 optimizer 更新并控制 train/eval",
          "用样本总数正确汇总验证指标",
          "保存并恢复参数、优化器、scheduler 与随机数状态"
        ],
        "sections": [
          {
            "heading": "一次更新有严格的生命周期",
            "body": "训练步通常依次完成：设置训练模式、把输入与标签放到目标设备、清梯度、前向计算 loss、backward、必要时裁剪梯度、optimizer.step。scheduler 按其定义在恰当时机推进，常见按 epoch 或 optimizer update 计步，而不是任意跟随每次日志输出。\n\n先建立一个能在少量样本上过拟合的单机基线，再增加复杂机制，能迅速发现标签、损失与梯度错误。下面使用合成二分类数据，避免数据读取干扰。它是可执行的 CPU 训练示例；实际 loss 数值依版本与硬件可能稍有差异，重点检查梯度有限、更新发生和指标趋势。",
            "code": "import torch\nfrom torch import nn\nfrom torch.nn import functional as F\ntorch.manual_seed(7)\nfeatures = torch.randn(160, 4)\nlabels = (features[:, 0] + features[:, 1] > 0).long()\ntrain_x, val_x = features[:128], features[128:]\ntrain_y, val_y = labels[:128], labels[128:]\nmodel = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Linear(16, 2))\noptimizer = torch.optim.AdamW(model.parameters(), lr=0.01)\nscheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.5)\nfor epoch in range(20):\n    model.train()\n    order = torch.randperm(len(train_x))\n    for idx in order.split(32):\n        optimizer.zero_grad(set_to_none=True)\n        logits = model(train_x[idx])\n        loss = F.cross_entropy(logits, train_y[idx])\n        loss.backward()\n        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)\n        optimizer.step()\n    scheduler.step()  # this schedule is defined in epochs\nprint(\"Completed optimizer updates:\", 20 * 4)",
            "language": "python"
          },
          {
            "heading": "验证要切模式，并正确汇总分母",
            "body": "验证不应更新参数，也不应继续更新 BatchNorm 运行统计或使用训练 Dropout。先 eval，再在 no_grad 或 inference_mode 中前向；验证结束后恢复原来的训练状态。不要把验证集 loss 用于 backward，也不要让训练和验证样本混在同一份指标中。\n\n如果最后一个验证 batch 更小，平均每个 batch 的平均 loss 会造成偏差。正确做法是累加 reduction=\"sum\" 的损失与样本数，再做一次总归约；准确率同样累加正确个数。对 token 任务则改用有效 token 数，不能机械复用样本分母。空验证集应明确报错，而不是返回看似正常的零分。",
            "code": "# Continue from the training example above.\nwas_training = model.training\nmodel.eval()\nloss_sum = 0.0\ncorrect = 0\ncount = 0\nwith torch.inference_mode():\n    for x, y in zip(val_x.split(10), val_y.split(10)):\n        logits = model(x)\n        loss_sum += F.cross_entropy(logits, y, reduction=\"sum\").item()\n        correct += (logits.argmax(-1) == y).sum().item()\n        count += y.numel()\nif count == 0:\n    raise ValueError(\"Validation set is empty\")\nprint({\"loss\": loss_sum / count, \"accuracy\": correct / count})\nmodel.train(was_training)",
            "language": "python"
          },
          {
            "heading": "完整恢复需要的不只是权重",
            "body": "仅保存模型权重能恢复推理，但通常不能精确继续训练。AdamW 的动量与二阶统计、scheduler 进度、AMP scaler、全局更新步和数据位置都会影响下一次更新。随机数状态决定后续打乱、Dropout 等随机过程；使用 NumPy、Python random 或独立 Generator 时，还需要分别保存对应状态。\n\n下面在 epoch 边界、完成 scheduler.step 后保存，因此恢复起点是下一 epoch；如果在累积窗口中途保存，还要处理未完成梯度与采样位置，复杂度明显更高。多进程 DataLoader 预取与分布式分片也需要额外恢复协议。写文件时采用同一文件系统的临时文件加原子替换，可以降低中断导致损坏的风险。",
            "code": "# Continue from the previous sections: creates a local checkpoint file.\nfrom pathlib import Path\ncheckpoint_path = Path(\"training_state.pt\")\ntemporary_path = checkpoint_path.with_suffix(\".pt.tmp\")\ncheckpoint = {\n    \"model\": model.state_dict(),\n    \"optimizer\": optimizer.state_dict(),\n    \"scheduler\": scheduler.state_dict(),\n    \"next_epoch\": epoch + 1,\n    \"updates\": (epoch + 1) * 4,\n    \"torch_rng\": torch.get_rng_state(),\n    \"cuda_rng\": torch.cuda.get_rng_state_all() if torch.cuda.is_available() else [],\n}\ntorch.save(checkpoint, temporary_path)\ntemporary_path.replace(checkpoint_path)\nprint(\"Saved next epoch:\", checkpoint[\"next_epoch\"])",
            "language": "python",
            "callout": "这里只覆盖示例中的 CPU 数据与 epoch 边界恢复；实际项目还需要保存自身的数据、随机源和分布式状态。"
          },
          {
            "heading": "加载顺序与可复现性的实际边界",
            "body": "恢复时先重建相同模型结构与优化器、scheduler，再加载各自状态。scheduler 应在加载优化器状态之前完成初始化，避免构造过程干扰恢复的学习率。读取到 CPU 后再按既定策略放置模型和优化器状态，可以避免默认把整个文件直接加载到某块 GPU 导致内存峰值。\n\n最后恢复随机数状态，因为模型初始化本身会消耗随机数。即使保存了全部状态，不同 PyTorch 版本、设备和非确定性 kernel 之间仍不能无条件保证逐位复现；严格实验还应记录环境、配置与数据版本。加载不可信 checkpoint 时不要随意退回任意 pickle 反序列化，优先使用 weights_only 与可信来源。",
            "code": "# Continue from above; load the checkpoint created by this lesson.\nrestored = torch.load(\"training_state.pt\", map_location=\"cpu\", weights_only=True)\nresumed_model = nn.Sequential(nn.Linear(4, 16), nn.ReLU(), nn.Linear(16, 2))\nresumed_opt = torch.optim.AdamW(resumed_model.parameters(), lr=0.01)\nresumed_sched = torch.optim.lr_scheduler.StepLR(resumed_opt, step_size=10, gamma=0.5)\nresumed_model.load_state_dict(restored[\"model\"])\nresumed_sched.load_state_dict(restored[\"scheduler\"])\nresumed_opt.load_state_dict(restored[\"optimizer\"])\ntorch.set_rng_state(restored[\"torch_rng\"])\nif torch.cuda.is_available() and restored[\"cuda_rng\"]:\n    torch.cuda.set_rng_state_all(restored[\"cuda_rng\"])\nnext_epoch = restored[\"next_epoch\"]\nresumed_model.eval()\nmodel.eval()\nwith torch.no_grad():\n    torch.testing.assert_close(resumed_model(val_x), model(val_x))\nprint(\"Resume at epoch:\", next_epoch)",
            "language": "python"
          }
        ],
        "takeaways": [
          "一次更新按清梯度、前向、反向、裁剪、step 的生命周期执行。",
          "验证使用 eval 与禁用梯度，并按总有效数量汇总指标。",
          "恢复训练要保存优化器、scheduler、进度与随机状态，不只是权重。"
        ],
        "references": [
          {
            "label": "torch.optim",
            "url": "https://docs.pytorch.org/docs/stable/optim.html"
          },
          {
            "label": "Serialization semantics",
            "url": "https://docs.pytorch.org/docs/stable/notes/serialization.html"
          },
          {
            "label": "Reproducibility",
            "url": "https://docs.pytorch.org/docs/stable/notes/randomness.html"
          },
          {
            "label": "Optimizer.load_state_dict",
            "url": "https://docs.pytorch.org/docs/stable/generated/torch.optim.Optimizer.load_state_dict.html"
          }
        ],
        "quiz": [
          {
            "id": "nn-4-q1",
            "type": "single",
            "topic": "训练循环",
            "prompt": "常规单次更新中，哪组顺序正确？",
            "options": [
              "step → backward → zero_grad",
              "zero_grad → forward/loss → backward → clip → step",
              "backward → forward → step",
              "forward → eval → step"
            ],
            "answer": 1,
            "explanation": "梯度必须先从当前前向生成，再用于更新；通常先清空上一次梯度，完整反向后再裁剪。"
          },
          {
            "id": "nn-4-q2",
            "type": "single",
            "topic": "验证归约",
            "prompt": "验证两批分别有 10 和 2 个样本，平均 loss 分别是 1 和 3。总体样本平均 loss 是多少？",
            "options": [
              "2",
              "4",
              "16/12",
              "1"
            ],
            "answer": 2,
            "explanation": "总损失是 10×1+2×3=16，总数 12，因此为 16/12。直接平均两个 batch 的均值会过度放大小 batch 权重。"
          },
          {
            "id": "nn-4-q3",
            "type": "single",
            "topic": "恢复训练",
            "prompt": "AdamW 训练中，仅加载模型权重而丢失优化器状态，最可能意味着什么？",
            "options": [
              "恢复同一预测起点，但后续更新不一定等于原训练轨迹",
              "下一步更新必然逐位相同",
              "模型不再能推理",
              "所有学习率都会自动恢复"
            ],
            "answer": 0,
            "explanation": "权重可以恢复前向行为，但动量、二阶统计和 scheduler 进度影响后续更新，需要另外保存恢复。"
          }
        ]
      }
    ]
  }
];
