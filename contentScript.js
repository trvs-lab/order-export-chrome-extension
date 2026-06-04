(function attachJdOrderContentScript() {
  const MESSAGE_EXPORT = "JD_EXPORT_ORDERS";
  const MESSAGE_PAGE_INFO = "JD_GET_PAGE_INFO";
  const MESSAGE_PROGRESS = "JD_EXPORT_PROGRESS";
  let isExporting = false;

  function randomDelay() {
    const delayMs = 800 + Math.floor(Math.random() * 701);
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  function sendProgress(detail) {
    try {
      chrome.runtime.sendMessage({
        type: MESSAGE_PROGRESS,
        ...detail
      });
    } catch (_) {
      // The popup may have closed while export continues.
    }
  }

  async function fetchPageDocument(url) {
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`第 ${new URL(url).searchParams.get("page")} 页请求失败：HTTP ${response.status}`);
    }

    const html = await response.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  function getFilterLabel() {
    const url = new URL(window.location.href);
    const d = url.searchParams.get("d");

    if (d === "1") {
      return "recent-3-months";
    }

    return "current-filter";
  }

  async function exportOrders(options) {
    if (isExporting) {
      return {
        ok: false,
        rows: [],
        pagesScanned: 0,
        error: "已有导出任务正在运行"
      };
    }

    isExporting = true;
    sendProgress({ page: 0, rowCount: 0, status: "running" });

    try {
      const result = await window.JdOrderExporterCore.collectJdOrders({
        currentDocument: document,
        currentUrl: window.location.href,
        fetchPageDocument,
        maxPages: options.maxPages,
        onProgress: ({ page, rowCount }) => sendProgress({ page, rowCount, status: "running" }),
        wait: randomDelay
      });

      return {
        ...result,
        filterLabel: getFilterLabel()
      };
    } finally {
      isExporting = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGE_PAGE_INFO) {
      sendResponse(window.JdOrderExporterCore.getJdOrderPageInfoFromDocument(document, window.location.href));
      return false;
    }

    if (message?.type !== MESSAGE_EXPORT) {
      return false;
    }

    exportOrders({ maxPages: message.maxPages || 50 })
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          ok: false,
          rows: [],
          pagesScanned: 0,
          error: error?.message || String(error)
        })
      );

    return true;
  });
})();
