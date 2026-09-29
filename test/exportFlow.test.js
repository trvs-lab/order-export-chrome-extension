const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { collectJdOrders } = require("../src/core/exportFlow");

describe("JD order export flow", () => {
  it("collects every rendered page up to the page count", async () => {
    const visited = [];
    const result = await collectJdOrders({
      totalPages: 2,
      maxPages: 10,
      readPage: async (page) => {
        visited.push(page);
        return [{ orderNumber: String(page) }];
      }
    });

    assert.deepEqual(visited, [1, 2]);
    assert.deepEqual(result.rows.map((row) => row.orderNumber), ["1", "2"]);
    assert.equal(result.pagesScanned, 2);
    assert.equal(result.ok, true);
  });

  it("reports a failed later page and returns the rows already collected", async () => {
    const result = await collectJdOrders({
      totalPages: 2,
      readPage: async (page) => {
        if (page === 2) throw new Error("page failed");
        return [{ orderNumber: "1" }];
      }
    });

    assert.equal(result.ok, false);
    assert.equal(result.rows.length, 1);
    assert.equal(result.failedPage, 2);
    assert.match(result.error, /page failed/);
  });
});
