# Duit 小家 · galagame

Duit 是一个在 Zion 上制作的桌面 Web 应用。访客可从首页进入「房间灵感室」，填写房间名和设计要求，提交生成任务，在同一页面查看完成的房间图片。项目还包含空间造型、个人中心、陪伴功能与运行记录相关页面。

[打开 Zion 桌面首页](https://mirror.functorz.com/preview/X57jbwZOjLw/8bD5JlVexgP?pageId=yrt7kexh8&breakpoint=desktop) · [打开房间灵感室](https://mirror.functorz.com/preview/X57jbwZOjLw/8bD5JlVexgP?pageId=zu2t0agh8&breakpoint=desktop) · [打开 Zion 托管的静态工作台](https://9p307r8l8grk7.cave.functorz-app.com/index.html)

## 评审复核

用 Git 克隆仓库，进入仓库根目录。安装 Node.js 18 或更高版本后可以直接执行以下命令，无需安装项目依赖。

```sh
git log --oneline --decorate --all
git show --stat submission-baseline-20261108
node tools/verify.mjs
node tools/serve.mjs
```

在浏览器打开 `http://127.0.0.1:4173/` 可查看静态工作台，打开 `/inspiration.html` 可查看静态站的房间灵感页面。Zion 原生首页使用顶部的桌面预览链接。实际生图、账号和服务端行为依赖原项目运行态及其权限。本地命令只启动文件服务。完整性检查可离线执行，不会调用模型。

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

本基线的 Web 编辑配置包含 8 个页面、170 个组件和 11 个行为流。静态站部署版本为 `ZOMQM4Kq1yy`，官方清单记录 31 个文件，共 25,930,860 字节。仓库同时保留设计配置与已部署的静态文件。部分部署依赖以压缩脚本、WASM 或模型权重形式分发。

Zion 的编辑器、渲染引擎、托管数据库和模型服务由平台提供。仓库保留与本项目有关的设计、程序、素材和调用关系。项目账号、数据库业务记录、用户上传和密钥不属于源码交付内容。服务迁移需要在目标 Zion 环境重新配置密钥和外部服务，仓库未验证一键重建新的 Zion 项目。

## 第三方组件

Three.js、MediaPipe、LAME/MP3 与 MD5 等依赖保留其部署包中的声明。见 [Three.js](site/THREE-LICENSE.txt)、[MediaPipe](site/avatar/MEDIAPIPE-LICENSE.txt)、[LAME/MP3](site/companion/MP3-LICENSE.txt) 和 [MD5](site/journal/MD5-LICENSE.txt)。LAME 项目主页为 [lame.sourceforge.net](https://lame.sourceforge.net/)。
