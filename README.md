# Duit 小家 · galagame

[正式首页](https://9p307r8l8grk7.villa.functorz-app.com/) · [提交文字设计任务](https://9p307r8l8grk7.villa.functorz-app.com/ops-records) · [体验三维空间造型室](https://9p307r8l8grk7.cave.functorz-app.com/workbench/index.html)

评审可以使用自己的 Duit 账号，在「项目运行记录」页提交一项房间设计需求、查看 Agent 的处理记录和文字方案，并由本人确认交付。已有的「橡木与鼠尾草客厅」支持访客进入三维工作台、移动人物和导出 GLB 模型。

房间设计页提供两种图像。「生成房间图」请求云端模型制作效果图，需要项目具备可用的 Zion AI 积分。项目配额不足或服务失败时，页面可以按这次要求绘制空间示意图，并明确标记图像类型。「生成空间示意图」也可以直接使用，在浏览器中按输入的家具、材质和光线等要求绘制，可下载 PNG，无需云端积分。两种呈现的实现可在[房间页面源码](src/components/i9aaghsoe/document.html)中核验。

## 开源范围

团队为本项目编写并持有权利的软件代码按 [MIT 许可](LICENSE) 开放。Duit 品牌名、标志、首页画板、示意图片及其他视觉素材不在该授权范围内。库、运行时、模型权重与依赖文件沿用各自权利人的许可与声明。可在[第三方组件说明](THIRD_PARTY_NOTICES.md)中查阅上游和随附许可。Zion 编辑器与平台服务由平台提供。

Duit 是一个在 Zion 上制作的桌面 Web 应用。访客可从首页进入「房间灵感室」，填写房间名和设计要求，提交生成任务，在同一页面查看完成的房间图片。项目还包含空间造型、个人中心、陪伴功能与运行记录相关页面。

归档中保留了原生首页与房间灵感室的编辑配置，以及三维工作台在归档时使用的静态文件。评审体验请使用上方链接。

## 评审复核

用 Git 克隆仓库，进入仓库根目录。安装 Node.js 18 或更高版本后可以直接执行以下命令，无需安装项目依赖。

```sh
git log --oneline --decorate --all
git show --stat submission-image-fix-20261108
node tools/verify.mjs
node tools/serve.mjs
```

在浏览器打开 `http://127.0.0.1:4173/` 可查看静态工作台，打开 `/inspiration.html` 可查看静态站的房间灵感页面。Zion 原生首页使用顶部的正式网址。实际生图、账号和服务端行为依赖原项目运行态及其权限。本地命令只启动文件服务。完整性检查可离线执行，不会调用模型。

## 如何阅读仓库

| 路径 | 可核验内容 |
| --- | --- |
| [zion/project.json](zion/project.json) | 当前 Zion Web 编辑配置，包括原生界面、导航、表结构、角色权限、API 配置、AI 配置和行为流。账号由评审自行登录，服务端 Secret 在 Zion 内配置。 |
| [src/components](src/components) | 从同一份配置提取的 5 个 HTML 组件。房间灵感室的 [document.html](src/components/i9aaghsoe/document.html) 是解开内嵌 iframe 后的可读 HTML、CSS 和 JavaScript。 |
| [src/flows](src/flows) | 行为流中的自定义 JavaScript，以行为流 ID、节点 ID 命名。可视化节点及连线见 project.json 的 server.actionFlows。 |
| [site](site) | 本次取样时 Zion BETA 正在提供的静态站文件，保留首页、灵感室、个人页、记录页、JS、CSS、模型、WASM 和随附第三方声明。 |
| [assets](assets) | 原始 duit 标志及首页画板素材。Zion 素材 ID、文件路径及 SHA-256 对照见 [assets.json](zion/assets.json)。 |
| [zion/static-manifest.json](zion/static-manifest.json) | Zion 对部署版本给出的逐文件路径、字节数及 MD5。校验程序会逐项核对。 |
| [tools](tools) | 提取项目配置、校验归档及启动本地文件服务的工具。 |

## 版本与实现范围

2026 年 11 月 8 日首次将已有 Zion 项目纳入本仓库。首个提交记录当日的源码基线，较早的设计和调试发生在 Zion 编辑器。Git 历史从实际建库时开始。提交标签可用于定位交付版本，在线预览可能随项目继续编辑而更新。

首次归档的标签是 `submission-baseline-20261108`。修复版本 `submission-journal-fix-20261108` 收录了 8 个页面、171 个组件和 11 个行为流。静态工作台对应 Zion BETA 部署 `mJK9Kkjq1gV`，清单含 33 个文件，共 25,939,046 字节。部分部署依赖以压缩脚本、WASM 或模型权重形式分发。

### 个人任务与工作台链接

「项目运行记录」页通过原生行为流读取当前账号的任务与事件。首次打开、刷新和状态筛选更新「我的任务」，点击「查看详情与时间线」读取所选任务。提交与人工处理复用已有记录服务；Token 或费用没有记录时显示「未提供」。2026 年 11 月 8 日的线上验收覆盖了访客拒绝、登录后的空列表、任务所有者查询与状态筛选、已选任务事件，以及另一个账号无法读取该任务。测试记录已清理，验收账号均已注销。

五处原生工作台入口共用客户端变量 `workbench_origin`。房间灵感室只向配置的工作台来源发送房间引用。配置中当前使用已经验证的 BETA 站点。正式工作台部署后，可在已选定 galagame / Web 应用的 Zion CLI 工作目录用 PowerShell 7 运行 [正式工作台检查脚本](tools/Use-ProductionWorkbench.ps1)。它读取实际 PROD 地址，并匿名检查工作台、个人中心和记录页的内容；默认只检查，加 `-Apply` 才会把验证通过的网址写回 Web 草稿。原生 Web 客户端仍须在编辑器生成预览、验收并发布。

Zion 的编辑器、渲染引擎、托管数据库和模型服务由平台提供。仓库保留与本项目有关的设计、程序、素材和调用关系。项目账号、数据库业务记录、用户上传和密钥不属于源码交付内容。服务迁移需要在目标 Zion 环境重新配置密钥和外部服务，仓库未验证一键重建新的 Zion 项目。

## 第三方组件

Three.js、MediaPipe、LAME/MP3 与 MD5 等依赖保留其部署包中的声明。见 [Three.js](site/THREE-LICENSE.txt)、[MediaPipe](site/avatar/MEDIAPIPE-LICENSE.txt)、[LAME/MP3](site/companion/MP3-LICENSE.txt) 和 [MD5](site/journal/MD5-LICENSE.txt)。LAME 项目主页为 [lame.sourceforge.net](https://lame.sourceforge.net/)。
