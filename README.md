# AlphaDesk 文档站

产品官网 + 用户手册 + 卖货素材，三合一，纯静态。

## 打开方式

双击 `index.html` 即用，无需服务器、无需联网（截图都在 `assets/` 本地）。

## 发布到网上（可选）

整个文件夹拖到以下任一平台即上线：

- **Cloudflare Pages**：免费，拖文件夹上传，送二级域名
- **Vercel**：`vercel --prod`，免费
- **Gitee Pages / 腾讯云静态托管**：国内访问快

## 改卖货信息

搜 `微信：________`，共 2 处（首页购买区、页脚），填你的微信。

## 目录

```
alphadesk-docs/
├── index.html      文档站（单文件应用：官网+手册+FAQ+版本历史）
├── styles.css      黑金主题样式
├── app.js          导航/FAQ折叠/截图灯箱
└── assets/         产品截图（本地）
    ├── dashboard.png   仪表盘
    ├── screener.png    智能选股器
    └── backtest.png    回测实验室
```
