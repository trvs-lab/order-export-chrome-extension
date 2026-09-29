const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { JSDOM } = require("jsdom");

const {
  buildJdOrderPageUrl,
  getJdOrderPageInfoFromDocument,
  parseJdOrdersFromDocument
} = require("../src/core/jdOrders");

function documentFrom(html) {
  return new JSDOM(html, { url: "https://order.jd.com/center/list.action?d=1&s=4096&page=1" }).window.document;
}

describe("JD order list parsing", () => {
  it("extracts products from the current order card layout", () => {
    const document = documentFrom(`
      <div class="orderCard-b731ca">
        <div class="header-c3768c">
          <div class="orderTime-4e55a3"><div class="metaValue-7993e4">2026-09-26 09:57:22</div></div>
          <div class="orderMetas-4f212f"><div class="metaLabel-23db69">订单号</div><div class="metaValue-7993e4">1234567890123456</div></div>
          <span class="shopNames-53c072">京东</span>
          <span class="statusText-ca72c5">已完成</span>
        </div>
        <div class="orderBody-6b35e2">
          <div class="productList-386ae9">
            <div class="productItem-f5a70e"><div class="productInfo-634b25"><h3 class="productTitle-aa0842">商品一</h3><div class="productCount-123456">共 <span class="countNum-d453df">2</span> 件</div></div></div>
            <div class="productItem-f5a70e"><div class="productInfo-634b25"><h3 class="productTitle-aa0842">商品二</h3><div class="productCount-123456">共 <span class="countNum-d453df">1</span> 件</div></div></div>
          </div>
          <div class="priceActionSection-68d47c">
            <div class="priceRow-56eb40"><span class="priceSymbol-123456">¥</span><span class="priceInteger-123456">48</span><span class="priceDecimal-123456">.39</span></div>
            <div class="jingDouReceived-60bf1c">5 京豆已到账</div>
            <div class="paymentTypeName-4077b2">在线支付</div>
            <div class="deliveryAndExpress-adfc02"><div class="deliveryInfo-121bce"><span class="custom-b5654b"><div class="deliveryTextGroup-c7ccbc"><span class="metaValue-1bbf6f"><span><span class="userName-943ad1">张三</span></span>浙江省杭州市</span></div></span></div></div>
            <div class="action-a4cdb7"><div class="button-ee6181">立即购买</div><div class="button-ee6181">查看发票</div></div>
          </div>
        </div>
      </div>
    `);

    assert.deepEqual(parseJdOrdersFromDocument(document), [
      {
        orderedAt: "2026-09-26 09:57:22",
        orderNumber: "1234567890123456",
        shopName: "京东",
        productName: "商品一",
        quantity: "2",
        recipient: "张三",
        amount: "¥48.39",
        paymentMethod: "在线支付",
        status: "已完成",
        rewardInfo: "5 京豆已到账",
        actions: "立即购买；查看发票",
        detailUrl: ""
      },
      {
        orderedAt: "2026-09-26 09:57:22",
        orderNumber: "1234567890123456",
        shopName: "京东",
        productName: "商品二",
        quantity: "1",
        recipient: "张三",
        amount: "¥48.39",
        paymentMethod: "在线支付",
        status: "已完成",
        rewardInfo: "5 京豆已到账",
        actions: "立即购买；查看发票",
        detailUrl: ""
      }
    ]);
  });

  it("extracts one visible order item from the JD order list", () => {
    const document = documentFrom(`
      <table class="order-tb">
        <tbody id="tb-3509435005990555">
          <tr class="tr-th">
            <td colspan="6">
              <span class="dealtime">2026-05-25 09:35:58</span>
              <span class="number">订单号：<a href="//order.jd.com/normal/item.action?orderid=3509435005990555">3509435005990555</a></span>
              <span class="order-shop">京东</span>
            </td>
          </tr>
          <tr class="tr-bd">
            <td class="goods">
              <div class="goods-item">
                <div class="p-img">
                  <a href="//item.jd.com/100123.html"><img src="//img10.360buyimg.com/n5/s80x80_sample.jpg"></a>
                </div>
                <div class="p-msg"><div class="p-name">
                  <a>久光の林儿日本痔疮膏凝胶消去医肉球根断正品内外混合肛门止血膏</a>
                </div></div>
                <div class="goods-number">x1</div>
              </div>
            </td>
            <td class="consignee"><span>王晓光</span></td>
            <td class="amount"><span>¥67.79</span><br><span>在线支付/白条</span></td>
            <td class="status"><span>已完成</span><br><a href="//order.jd.com/normal/item.action?orderid=3509435005990555">订单详情</a></td>
            <td class="operate"><a>白条还款</a><a>查看发票</a><a>评价晒单</a></td>
          </tr>
        </tbody>
      </table>
    `);

    assert.deepEqual(parseJdOrdersFromDocument(document), [
      {
        orderedAt: "2026-05-25 09:35:58",
        orderNumber: "3509435005990555",
        shopName: "京东",
        productName: "久光の林儿日本痔疮膏凝胶消去医肉球根断正品内外混合肛门止血膏",
        quantity: "1",
        recipient: "王晓光",
        amount: "¥67.79",
        paymentMethod: "在线支付/白条",
        status: "已完成",
        rewardInfo: "",
        actions: "白条还款；查看发票；评价晒单",
        detailUrl: "https://order.jd.com/normal/item.action?orderid=3509435005990555"
      }
    ]);
  });

  it("exports each visible product in the same order as a separate row", () => {
    const document = documentFrom(`
      <table class="order-tb">
        <tbody id="tb-3500000000000001">
          <tr class="tr-th">
            <td colspan="6">
              <span class="dealtime">2026-05-18 10:49:18</span>
              <span class="number">订单号：3500000000000001</span>
              <span class="order-shop">京东</span>
            </td>
          </tr>
          <tr class="tr-bd">
            <td class="goods">
              <div class="goods-item">
                <div class="p-msg"><div class="p-name"><a>小米米家充气宝</a></div></div>
                <div class="goods-number">x1</div>
              </div>
              <div class="goods-item">
                <div class="p-msg"><div class="p-name"><a>汽车启动应急电源</a></div></div>
                <div class="goods-number">x2</div>
              </div>
            </td>
            <td class="consignee"><span>王晓光</span></td>
            <td class="amount"><span>¥0.00</span><span>在线支付</span></td>
            <td class="status"><span>已完成</span><a href="//order.jd.com/normal/item.action?orderid=3500000000000001">订单详情</a></td>
            <td class="operate"><a>查看发票</a></td>
          </tr>
        </tbody>
      </table>
    `);

    assert.deepEqual(
      parseJdOrdersFromDocument(document).map((row) => ({
        orderNumber: row.orderNumber,
        productName: row.productName,
        quantity: row.quantity,
        amount: row.amount,
        recipient: row.recipient
      })),
      [
        {
          orderNumber: "3500000000000001",
          productName: "小米米家充气宝",
          quantity: "1",
          amount: "¥0.00",
          recipient: "王晓光"
        },
        {
          orderNumber: "3500000000000001",
          productName: "汽车启动应急电源",
          quantity: "2",
          amount: "¥0.00",
          recipient: "王晓光"
        }
      ]
    );
  });

  it("does not expose product image or note fields", () => {
    const document = documentFrom(`
      <table class="order-tb">
        <tbody id="tb-3502235014552679">
          <tr class="tr-th">
            <td><span class="dealtime">2026-05-18 10:49:18</span><span class="number">订单号：3502235014552679</span></td>
          </tr>
          <tr class="tr-bd">
            <td>
              <div class="goods-item">
                <div class="p-img"><img src="//img10.360buyimg.com/n5/s80x80_sample.jpg"></div>
                <div class="p-name"><a>普通订单商品一</a></div>
                <div class="goods-number">x1</div>
              </div>
            </td>
          </tr>
        </tbody>
        <tbody id="tb-349063745774">
          <tr class="tr-th">
            <td><span class="dealtime">2026-05-16 21:21:11</span><span class="number">订单号：349063745774</span></td>
          </tr>
          <tr class="tr-bd">
            <td><div class="goods-item"><div class="p-name"><a>普通订单商品二</a></div><div class="goods-number">x1</div></div></td>
          </tr>
        </tbody>
      </table>
    `);

    const rows = parseJdOrdersFromDocument(document);

    assert.equal(Object.hasOwn(rows[0], "imageUrl"), false);
    assert.equal(Object.hasOwn(rows[0], "note"), false);
    assert.equal(Object.hasOwn(rows[1], "imageUrl"), false);
    assert.equal(Object.hasOwn(rows[1], "note"), false);
  });

  it("reuses row-spanned visible order fields for later product rows", () => {
    const document = documentFrom(`
      <table class="order-tb">
        <tbody id="tb-3500000000000002">
          <tr class="tr-th">
            <td><span class="dealtime">2026-05-16 20:31:35</span><span class="number">订单号：3500000000000002</span></td>
          </tr>
          <tr class="tr-bd">
            <td><div class="goods-item"><div class="p-name"><a>商品一</a></div><div class="goods-number">x1</div></div></td>
            <td class="consignee" rowspan="2"><span>王晓光</span></td>
            <td class="amount" rowspan="2"><span>¥14.36</span><span>在线支付</span></td>
            <td class="status" rowspan="2"><span>已完成</span><a href="//order.jd.com/normal/item.action?orderid=3500000000000002">订单详情</a></td>
            <td class="operate" rowspan="2"><a>查看发票</a></td>
          </tr>
          <tr class="tr-bd">
            <td><div class="goods-item"><div class="p-name"><a>商品二</a></div><div class="goods-number">x3</div></div></td>
          </tr>
        </tbody>
      </table>
    `);

    assert.deepEqual(
      parseJdOrdersFromDocument(document).map((row) => ({
        productName: row.productName,
        quantity: row.quantity,
        recipient: row.recipient,
        amount: row.amount,
        status: row.status,
        actions: row.actions
      })),
      [
        {
          productName: "商品一",
          quantity: "1",
          recipient: "王晓光",
          amount: "¥14.36",
          status: "已完成",
          actions: "查看发票"
        },
        {
          productName: "商品二",
          quantity: "3",
          recipient: "王晓光",
          amount: "¥14.36",
          status: "已完成",
          actions: "查看发票"
        }
      ]
    );
  });
});

describe("JD order page URLs", () => {
  it("preserves the current filters while replacing the page number", () => {
    assert.equal(
      buildJdOrderPageUrl("https://order.jd.com/center/list.action?d=1&s=4096&page=1", 12),
      "https://order.jd.com/center/list.action?d=1&s=4096&page=12"
    );
  });

  it("reads the current page and total pages from the order list", () => {
    const document = documentFrom(`
      <div class="pagin">
        <a href="/center/list.action?d=1&s=4096&page=2">上一页</a>
        <span class="curr">3</span>
        <span class="page-skip">共 27 页</span>
      </div>
    `);

    assert.deepEqual(
      getJdOrderPageInfoFromDocument(document, "https://order.jd.com/center/list.action?d=1&s=4096&page=3"),
      {
        currentPage: 3,
        totalPages: 27
      }
    );
  });
});
