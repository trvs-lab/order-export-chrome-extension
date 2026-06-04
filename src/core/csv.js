(function attachCsvCore(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.JdOrderExporterCore = Object.assign(root.JdOrderExporterCore || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function csvFactory() {
  const ORDER_COLUMNS = [
    ["下单时间", "orderedAt"],
    ["订单号", "orderNumber"],
    ["店铺/平台", "shopName"],
    ["商品名称", "productName"],
    ["商品数量", "quantity"],
    ["收货人显示名", "recipient"],
    ["金额", "amount"],
    ["支付方式", "paymentMethod"],
    ["订单状态", "status"],
    ["京豆/奖励信息", "rewardInfo"],
    ["可见操作项", "actions"],
    ["订单详情链接", "detailUrl"]
  ];

  function escapeCsvValue(value) {
    const text = String(value ?? "");
    if (!/[",\r\n]/.test(text)) {
      return text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  function buildOrdersCsv(rows) {
    const header = ORDER_COLUMNS.map(([label]) => escapeCsvValue(label)).join(",");
    const body = rows.map((row) =>
      ORDER_COLUMNS.map(([, key]) => escapeCsvValue(row[key])).join(",")
    );

    return `\uFEFF${[header, ...body].join("\n")}`;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatTimestamp(now) {
    return [
      now.getUTCFullYear(),
      pad2(now.getUTCMonth() + 1),
      pad2(now.getUTCDate())
    ].join("") + "-" + [pad2(now.getUTCHours()), pad2(now.getUTCMinutes())].join("");
  }

  function sanitizeFilterLabel(filterLabel) {
    return String(filterLabel || "current-filter")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "current-filter";
  }

  function buildCsvFileName({ filterLabel = "current-filter", now = new Date() } = {}) {
    return `jd-orders_${sanitizeFilterLabel(filterLabel)}_${formatTimestamp(now)}.csv`;
  }

  return {
    ORDER_COLUMNS,
    buildCsvFileName,
    buildOrdersCsv
  };
});
