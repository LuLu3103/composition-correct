# 作文批改器 · 考研

一个纯前端的考研英语作文 AI 批改工具：选好模型，把题目和作文（文字或照片）交进去，就能拿到**修改建议**、**修改作文**和**作文评分**。所有数据只留在你自己的浏览器里。

> 在线使用：<https://lulu3103.github.io/composition-correct/>
>
> 当前版本：**V1.0.0**

## 功能

- **首页**：标题栏展示品牌 Logo、实时时间与日期；三张卡片分别负责「模型选择 / 题目输入 / 作文输入」；作文支持直接粘贴文本，也支持拍照或上传图片（最多 3 张）；底部一键提交批改。
- **批改**：结果按「修改建议 → 修改作文 → 作文评分」三块卡片展示；评分包含总分环形图、档次、评语与四项维度得分条；支持复制、重新批改、查看原始作文。请求采用流式输出，批改过程可以实时看到模型返回的文字。
- **历史**：每条记录默认以批改时间命名，可自定义重命名、删除或清空；条目上标注时间、使用模型、字数与得分。点开任意一条，会同时把题目和作文回填到首页，并在批改页还原当时的批改结果。
- **设置**：服务商预设、接口地址、API Key、模型列表（可添加 / 删除 / 切换是否支持图片）、连通性测试；可编辑的批改提示词（支持恢复默认）；数据导出、导入、清空；使用说明与网站声明；版本号。

## 界面

- 蓝调 ins 风格、iOS 式大圆角与柔和阴影，移动端优先（430px 设计宽度），桌面端居中展示为手机框。
- 底部悬浮胶囊标签栏，四个页签：首页 / 批改 / 历史 / 设置。
- 支持 PWA：可「添加到主屏幕」，离线时仍能打开界面骨架。

## 快速开始

1. 打开网站，进入 **设置**。
2. 选择服务商（DeepSeek / OpenAI / 通义千问 / 智谱 / Kimi / 硅基流动 / 自定义），填写 **API Key**，按需添加模型。
3. 点 **测试连接** 确认可用（可选）。
4. 回到 **首页**，选模型，填题目和作文，提交批改。

### 接口要求

本项目调用 **OpenAI 兼容** 的 `/chat/completions` 接口，请求头带 `Authorization: Bearer <KEY>`：

| 服务商 | 接口地址（Base URL） |
| --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` |
| OpenAI | `https://api.openai.com/v1` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` |
| Kimi | `https://api.moonshot.cn/v1` |
| 硅基流动 | `https://api.siliconflow.cn/v1` |

> **关于跨域（CORS）**：纯前端页面由浏览器直接请求服务商接口。如果服务商没有开放浏览器跨域，会提示「网络连接失败」。此时换一家支持 CORS 的服务商，或自行加一层转发（会失去「密钥不出本机」的特性）。
>
> **图片批改**：只有带「视觉」标记的模型（如 `gpt-4o`、`qwen-vl-max`、`glm-4v-plus`）才会读取作文图片，图片会先压缩到长边 1400px 再发送。

## 数据与隐私

- 作文、批改结果、历史记录、API Key 全部保存在浏览器的 **localStorage**（键名以 `essayGrader.` 开头），不上传任何本项目服务器——本项目没有服务器。
- 提交批改时，作文与你编辑的提示词会**直接从浏览器**发送给你配置的 AI 服务商。
- 导出备份默认**不含** API Key；只有你主动选择「含 Key」时才会写进 JSON，请妥善保管。
- 换浏览器、清理站点数据、无痕模式都会导致本地数据丢失，重要记录请先导出备份。

## 目录结构

```
.
├── index.html                # 单页应用外壳
├── manifest.webmanifest      # PWA 清单
├── sw.js                     # 离线缓存
├── assets/
│   ├── css/app.css           # 全部样式
│   ├── icons/                # 图标（PNG / SVG）
│   └── js/
│       ├── app.js            # 路由、批改任务生命周期
│       ├── api.js            # OpenAI 兼容接口、SSE 流式解析
│       ├── parse.js          # 把模型输出拆成三段并解析评分
│       ├── store.js          # 本地存储（设置 / 历史 / 草稿 / 结果）
│       ├── utils.js          # DOM、图标、Markdown、弹层、图片压缩
│       └── views/            # 首页 / 批改 / 历史 / 设置
└── tools/make_icons.py       # 重新生成应用图标
```

## 本地开发

无需构建、无第三方依赖，任意静态服务器即可：

```bash
python -m http.server 8123
# 打开 http://127.0.0.1:8123
```

修改代码后刷新页面即可生效；`sw.js` 只在 HTTPS 下注册，本地调试不会缓存旧文件。

## 部署

推送到 GitHub 仓库的 `main` 分支，在仓库 **Settings → Pages** 选择 `Deploy from a branch → main / (root)` 即可，`.nojekyll` 已就位。也可直接托管到任意静态空间（Vercel、Netlify、对象存储等）。

如果本机 `git push` 连不上 github.com，可以改用 GitHub API 发布（需要已登录的 `gh`）：

```bash
python tools/deploy.py --dry-run   # 先看会提交哪些文件
python tools/deploy.py             # 创建提交并触发 Pages 构建
```

发布新版本时记得同时修改 `store.js` 里的 `APP_VERSION` 和 `sw.js` 里的 `VERSION`，避免浏览器继续使用旧的离线缓存。

## 打包为 Android App（V1.0 之后的计划）

1. **PWA → TWA（首选）**：仓库已带 `manifest.webmanifest` 与 Service Worker，可直接用 [PWABuilder](https://www.pwabuilder.com/) 生成 Trusted Web Activity 的 `.apk` / `.aab`。应用内实际加载线上页面，更新网站即更新 App，缺点是需要联网。
2. **Capacitor 壳（离线优先）**：`npm i @capacitor/core @capacitor/cli`，把本目录作为 `webDir`，`npx cap add android` 后用 Android Studio / Gradle 构建 APK。可完全离线加载内置页面，也能用原生插件替换 localStorage（让密钥更安全）。需要 JDK 与 Android SDK。
3. **原生 WebView 模板**：一个 Activity 加 WebView 加载内置页面，体积最小，但需要自己处理返回键、文件选择与权限。

三条路线都不需要改动现有前端代码；方案 2 若要离线，可把静态文件放进 `android/app/src/main/assets/public`。

## 免责声明

AI 批改结果仅供学习参考，不代表真实考试评分。因使用本工具产生的任何后果由使用者自行承担。
