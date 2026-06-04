const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { buildCsvFileName, buildOrdersCsv } = require("../src/core/csv");

describe("order CSV export", () => {
  it("writes visible JD order fields with UTF-8 BOM and CSV escaping", () => {
    const csv = buildOrdersCsv([
      {
        orderedAt: "2026-05-25 09:35:58",
        orderNumber: "3509435005990555",
        shopName: "京东",
        productName: "商品A, 带逗号和\"引号\"",
        quantity: "1",
        recipient: "王晓光",
        amount: "¥67.79",
        paymentMethod: "在线支付/白条",
        status: "已完成",
        rewardInfo: "+6",
        actions: "白条还款；查看发票",
        detailUrl: "https://order.jd.com/normal/item.action?orderid=3509435005990555"
      }
    ]);

    assert.equal(
      csv,
      "\uFEFF下单时间,订单号,店铺/平台,商品名称,商品数量,收货人显示名,金额,支付方式,订单状态,京豆/奖励信息,可见操作项,订单详情链接\n" +
        "2026-05-25 09:35:58,3509435005990555,京东,\"商品A, 带逗号和\"\"引号\"\"\",1,王晓光,¥67.79,在线支付/白条,已完成,+6,白条还款；查看发票,https://order.jd.com/normal/item.action?orderid=3509435005990555"
    );
  });

  it("builds a privacy-safe CSV file name from filter label and timestamp", () => {
    assert.equal(
      buildCsvFileName({
        filterLabel: "recent/3:months 王晓光",
        now: new Date("2026-06-03T09:18:00.000Z")
      }),
      "jd-orders_recent-3-months_20260603-0918.csv"
    );
  });
});
