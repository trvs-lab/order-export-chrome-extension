const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { describe, it } = require("node:test");
const { JSDOM } = require("jsdom");

const popupHtml = readFileSync(join(__dirname, "../popup.html"), "utf8");

function waitFor(predicate) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 1000;
    function check() {
      if (predicate()) return resolve();
      if (Date.now() > deadline) return reject(new Error("Popup did not finish exporting"));
      setTimeout(check, 5);
    }
    check();
  });
}

describe("popup export", () => {
  it("exports every rendered page and reuses one background tab", async () => {
    const dom = new JSDOM(popupHtml, {
      url: "https://extension.local/popup.html",
      runScripts: "outside-only"
    });
    const { window } = dom;
    const createdTabs = [];
    const updatedTabs = [];
    const removedTabs = [];
    let workerPage = 0;
    const row = (page) => ({ orderNumber: String(page), productName: `商品${page}` });

    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, ms) => nativeSetTimeout(callback, ms >= 800 ? 0 : ms);
    window.URL.createObjectURL = () => "blob:test";
    window.URL.revokeObjectURL = () => {};
    window.chrome = {
      tabs: {
        query: async () => [{ id: 1, url: "https://order.jd.com/center/list.action" }],
        sendMessage: async (tabId, message) => {
          if (message.type === "JD_GET_PAGE_INFO") return { currentPage: 1, totalPages: 3 };
          if (message.type === "JD_EXPORT_ORDERS") {
            return { ok: true, rows: [row(1)], pagesScanned: 1 };
          }
          if (message.type === "JD_GET_PAGE_ROWS") {
            const page = tabId === 1 ? 1 : workerPage;
            return { currentPage: page, rows: [row(page)] };
          }
          throw new Error(`Unexpected message: ${message.type}`);
        },
        create: async (options) => {
          createdTabs.push(options);
          workerPage = Number(new URL(options.url).searchParams.get("page"));
          return { id: 2, url: options.url, status: "complete" };
        },
        update: async (_tabId, options) => {
          updatedTabs.push(options);
          workerPage = Number(new URL(options.url).searchParams.get("page"));
        },
        remove: async (tabId) => { removedTabs.push(tabId); }
      },
      storage: { local: { get: async () => ({ maxPages: "10" }), set: async () => {} } },
      downloads: { download: (_options, callback) => callback(42) },
      runtime: { lastError: null, onMessage: { addListener: () => {} } }
    };

    window.eval(readFileSync(join(__dirname, "../src/core/csv.js"), "utf8"));
    window.eval(readFileSync(join(__dirname, "../src/core/exportFlow.js"), "utf8"));
    window.eval(readFileSync(join(__dirname, "../popup.js"), "utf8"));
    await waitFor(() => window.document.getElementById("pageStatus").textContent === "已连接");
    assert.equal(window.document.getElementById("exportButton").textContent, "导出这 3 页");
    window.document.getElementById("exportButton").click();
    await waitFor(() => !window.document.getElementById("resultPanel").hidden);

    assert.match(window.document.getElementById("resultMeta").textContent, /3 条商品记录 · 扫描 3 页/);
    assert.equal(window.document.getElementById("pageStatus").textContent, "已完成");
    assert.equal(window.document.getElementById("progressView").hidden, true);
    assert.equal(window.document.getElementById("resultFile").hidden, false);
    assert.equal(createdTabs.length, 1);
    assert.equal(updatedTabs.length, 1);
    assert.deepEqual(removedTabs, [2]);
    dom.window.close();
  });

  it("shows the actual export range before starting", async () => {
    const dom = new JSDOM(popupHtml, {
      url: "https://extension.local/popup.html",
      runScripts: "outside-only"
    });
    const { window } = dom;
    window.chrome = {
      tabs: {
        query: async () => [{ id: 1, url: "https://order.jd.com/center/list.action" }],
        sendMessage: async () => ({ currentPage: 1, totalPages: 12 })
      },
      storage: { local: { get: async () => ({ maxPages: "10" }), set: async () => {} } },
      runtime: { lastError: null }
    };

    window.eval(readFileSync(join(__dirname, "../popup.js"), "utf8"));
    await waitFor(() => window.document.getElementById("pageStatus").textContent === "已连接");
    assert.equal(window.document.getElementById("totalPagesText").textContent, "12");
    assert.equal(window.document.getElementById("exportButton").textContent, "导出这 10 页");
    assert.equal(window.document.getElementById("rangeNotice").hidden, false);

    const maxPages = window.document.getElementById("maxPages");
    maxPages.value = "unlimited";
    maxPages.dispatchEvent(new window.Event("change"));
    assert.equal(window.document.getElementById("exportButton").textContent, "导出这 12 页");
    assert.equal(window.document.getElementById("rangeNotice").hidden, true);
    dom.window.close();
  });

  it("stops before saving when the export is cancelled", async () => {
    const dom = new JSDOM(popupHtml, {
      url: "https://extension.local/popup.html",
      runScripts: "outside-only"
    });
    const { window } = dom;
    const removedTabs = [];
    let resolvePageTwo = null;
    let downloads = 0;
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, ms) => nativeSetTimeout(callback, ms >= 800 ? 0 : ms);
    window.chrome = {
      tabs: {
        query: async () => [{ id: 1, url: "https://order.jd.com/center/list.action" }],
        sendMessage: async (tabId, message) => {
          if (message.type === "JD_GET_PAGE_INFO") return { currentPage: 1, totalPages: 3 };
          if (message.type === "JD_GET_PAGE_ROWS" && tabId === 1) {
            return { currentPage: 1, rows: [{ productName: "商品1" }] };
          }
          if (message.type === "JD_GET_PAGE_ROWS" && tabId === 2) {
            return new Promise((resolve) => { resolvePageTwo = resolve; });
          }
          throw new Error(`Unexpected message: ${message.type}`);
        },
        create: async () => ({ id: 2 }),
        remove: async (tabId) => { removedTabs.push(tabId); }
      },
      storage: { local: { get: async () => ({ maxPages: "10" }), set: async () => {} } },
      downloads: { download: () => { downloads += 1; } },
      runtime: { lastError: null }
    };

    window.eval(readFileSync(join(__dirname, "../src/core/csv.js"), "utf8"));
    window.eval(readFileSync(join(__dirname, "../src/core/exportFlow.js"), "utf8"));
    window.eval(readFileSync(join(__dirname, "../popup.js"), "utf8"));
    await waitFor(() => window.document.getElementById("pageStatus").textContent === "已连接");
    window.document.getElementById("exportButton").click();
    await waitFor(() => resolvePageTwo !== null);
    window.document.getElementById("cancelButton").click();
    resolvePageTwo({ currentPage: 2, rows: [{ productName: "商品2" }] });
    await waitFor(() => !window.document.getElementById("resultPanel").hidden);

    assert.equal(window.document.getElementById("resultTitle").textContent, "导出已取消");
    assert.equal(downloads, 0);
    assert.deepEqual(removedTabs, [2]);
    dom.window.close();
  });
});
