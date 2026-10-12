---
title: 'Go 语言代码静态分析技术与应用'
description: '一本面向工程实践的中文教材：从 AST、类型系统、SSA 到数据流、指针分析与 go/analysis 框架，再到安全漏洞、并发缺陷与 CI/CD 落地，共四篇十三章 122 页，附完整 LaTeX 源码。'
published: 2026-10-12
category: '后端开发'
tags: ['Go', '静态分析', 'AST', 'SSA', 'go/analysis', 'linter', '教材']
cover: 'engineering'
featured: false
draft: false
---

静态分析在**不运行程序**的前提下推断代码性质，是现代软件工程的基础设施：编译器的类型检查、`go vet` 的可疑代码告警、`staticcheck` 与 `golangci-lint` 的大规模缺陷扫描、安全领域的污点分析，背后都是同一套技术。Go 语言为此提供了得天独厚的土壤——官方开放了 `go/ast`、`go/types`、`go/ssa`、`go/analysis` 一整套生产级分析基础设施，让人无需从零实现编译器前端，就能构建工业级的分析工具。

这本教材把这条链路从原理讲到落地，共 **四篇十三章 + 四个附录，122 页**，大量可运行 Go 代码示例、TikZ 结构图与流程图，用 XeLaTeX 排版。

**[在线阅读完整 PDF →](/blog/lab/go-static-analysis/pdf.html)**

[直接打开 PDF](/blog/lab/go-static-analysis/go-static-analysis.pdf) · [下载 LaTeX 源码包](/blog/lab/go-static-analysis/go-static-analysis-source.zip) · [查看主文件 main.tex](/blog/lab/go-static-analysis/go-static-analysis.tex)

## 适合谁读

- **Go 研发工程师**：想弄清 `go vet`、`staticcheck` 为什么能发现问题，并能编写自定义 Lint 规则守护团队规范。
- **工具链与平台工程师**：需要构建代码扫描平台、把静态分析集成进 CI/CD，或为特定框架开发分析器。
- **高校师生与研究者**：学习程序分析、编译原理，想要一个可动手、可复现的现代语言实践载体。

只要求读者掌握 Go 基本语法、了解包与接口、goroutine 等概念；不要求编译原理背景，必要的理论都会在相应章节循序讲解。

## 按主题组织的学习路径

全书分四篇，层层递进：从"看懂代码结构"到"理解代码语义"，再到"自己造工具"，最后"面向真实工程"。

| 篇              | 章节  | 你将解决的问题                                                                                                                                            |
| --------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 一·基础篇       | 1–3   | 静态分析到底在分析什么？Go 编译器前端如何把源码变成 token、AST？如何遍历与理解语法树？                                                                    |
| 二·核心技术篇   | 4–7   | 类型信息从哪来、怎么用才抗重名？SSA 为何让分析更可靠？控制流图与数据流如何做不动点迭代？指针分析与调用图如何回答"谁调用了谁"？                            |
| 三·工具与框架篇 | 8–10  | `go/analysis` 框架如何组织一个分析器？如何从零写出带自动修复的产品级分析器？`go vet`、`staticcheck`、`golangci-lint` 各自的定位与配合？                   |
| 四·应用篇       | 11–13 | 如何用污点分析抓 SQL/命令注入、SSRF、路径穿越？如何静态检测数据竞争、循环变量捕获、锁拷贝、context 泄漏？如何把分析落到 CI/CD、增量分析、基线与误报治理？ |

四个附录汇集了常用工具速查、`go/ast`·`go/types`·`go/analysis` 核心 API 速查、环境搭建与参考资源，便于随手翻阅。

## 这本书的特点

- **原理不跳步**：从编译器前端的 token、AST 一路讲到 SSA、数据流、指针分析，每一层都讲清"为什么需要它"。
- **代码能跑**：示例均基于官方标准库与 `golang.org/x/tools`，可直接动手复现。
- **图文并茂**：用 TikZ 绘制 AST、控制流图、调用图、污点传播、生态分层与落地防线等结构图与流程图。
- **工程导向**：第四篇完整覆盖安全、并发与 CI/CD 落地，并给出可直接采用的 `.golangci.yml`、GitHub Actions / GitLab CI 配置与落地检查清单。

## 获取方式

- **在线阅读**：[PDF 阅读器](/blog/lab/go-static-analysis/pdf.html)（浏览器内直接翻阅，保留原版排版）。
- **下载 PDF**：[go-static-analysis.pdf](/blog/lab/go-static-analysis/go-static-analysis.pdf)（122 页）。
- **LaTeX 源码**：[完整源码包](/blog/lab/go-static-analysis/go-static-analysis-source.zip)，含全部章节、`preamble.tex` 样式与封面，用 `latexmk -xelatex main.tex` 即可编译；也可单独查看 [main.tex](/blog/lab/go-static-analysis/go-static-analysis.tex)。
