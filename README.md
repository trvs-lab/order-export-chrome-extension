# JD Order CSV Exporter

本地开发版 Chrome 插件，用于在京东订单列表页导出页面可见订单信息到 CSV。

## 使用方式

1. 打开 `chrome://extensions`。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展程序」。
4. 选择本目录
5. 打开或刷新京东订单列表页后，点击插件图标导出。
6. 导出完成后，弹窗会显示 CSV 文件名，并提供「显示文件」和「打开下载文件夹」。

## 当前范围

- 只支持京东订单列表页：`https://order.jd.com/center/list.action*`
- 只导出列表页可见信息，不读取订单详情页。
- 自动按当前筛选 URL 翻页，默认最多 50 页。
- 导出 UTF-8 BOM CSV，方便 Excel 直接打开中文。

## 开发

```sh
npm test
```
