# Uber-for-X 手机工作台

这是 [booleanhunter/how-to-build-your-own-uber-for-x-app](https://github.com/booleanhunter/how-to-build-your-own-uber-for-x-app)
的静态演示版，专为手机端设计，可直接托管在 GitHub Pages 上。

原仓库是 Node.js + Express + MongoDB + Socket.IO 的应用，GitHub Pages 无法运行后端，
因此本项目把核心功能搬到了浏览器里，用内置模拟数据 + 跨标签页实时同步代替服务器：

- 🗺️ **地图**：OpenStreetMap 实时地图，展示 7 名警员与全部求助点；点击标记查看详情
- 🆘 **求助**：一键定位 / 地图选点，发出求助后自动通知附近警员，模拟接单并显示预计到达时间
- 📟 **接警**：等待派单的求助实时列表，可一键派给最近警员；演示模式会自动产生新求助
- 🔄 **多标签页同步**：同时打开「求助」和「接警」两个页面，数据实时互通（BroadcastChannel）

## 本地运行

```bash
python -m http.server 8080 --directory .
```

然后手机或浏览器访问 `http://localhost:8080`。

## 说明

- 地图底图与图块来自 OpenStreetMap，无需 API Key
- 位置地址由 OpenStreetMap Nominatim 反向解析，失败时自动回退为坐标
- 所有数据均为演示用途，来自仓库内的 `db/cops.json` 与 `db/crime-data.json`
