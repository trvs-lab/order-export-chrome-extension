const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { JSDOM } = require("jsdom");

const { collectJdOrders } = require("../src/core/exportFlow");

function documentFrom(html, url = "https://order.jd.com/center/list.action?d=1&s=4096&page=1") {
  return new JSDOM(html, { url }).window.document;
}

function orderPage(orderNumber) {
  return `
    <table class="order-tb">
      <tbody id="tb-${orderNumber}">
        <tr class="tr-th">
          <td><span class="dealtime">2026-05-25 09:35:58</span><span class="number">订单号：${orderNumber}</span></td>
        </tr>
        <tr class="tr-bd">
          <td><div class="goods-item"><div class="p-name"><a>商品 ${orderNumber}</a></div><div class="goods-number">x1</div></div></td>
        </tr>
      </tbody>
    </table>
  `;
}

describe("JD order export flow", () => {
  it("collects current filtered pages until the next page has no visible orders", async () => {
    const fetchedUrls = [];

    const result = await collectJdOrders({
      currentDocument: documentFrom(orderPage("3500000000000001")),
      currentUrl: "https://order.jd.com/center/list.action?d=1&s=4096&page=1",
      maxPages: 50,
      fetchPageDocument: async (url) => {
        fetchedUrls.push(url);
        return documentFrom("", url);
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.rows.length, 1);
    assert.equal(result.pagesScanned, 1);
    assert.equal(result.stoppedReason, "empty-page");
    assert.deepEqual(fetchedUrls, ["https://order.jd.com/center/list.action?d=1&s=4096&page=2"]);
  });

  it("stops on a failed page request and returns the rows already collected", async () => {
    const result = await collectJdOrders({
      currentDocument: documentFrom(orderPage("3500000000000001")),
      currentUrl: "https://order.jd.com/center/list.action?d=1&s=4096&page=1",
      maxPages: 50,
      fetchPageDocument: async () => {
        throw new Error("network failed");
      }
    });

    assert.equal(result.ok, false);
    assert.equal(result.rows.length, 1);
    assert.equal(result.failedPage, 2);
    assert.match(result.error, /network failed/);
  });
});
