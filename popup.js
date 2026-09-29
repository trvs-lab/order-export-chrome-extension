(function attachPopup() {
  const MESSAGE_PAGE_INFO = "JD_GET_PAGE_INFO";
  const MESSAGE_PAGE_ROWS = "JD_GET_PAGE_ROWS";
  const ORDER_LIST_URL = "https://order.jd.com/center/list.action";

  const pageStatus = document.getElementById("pageStatus");
  const loadingView = document.getElementById("loadingView");
  const readyView = document.getElementById("readyView");
  const progressView = document.getElementById("progressView");
  const resultPanel = document.getElementById("resultPanel");
  const wrongPageView = document.getElementById("wrongPageView");
  const maxPages = document.getElementById("maxPages");
  const rangeNotice = document.getElementById("rangeNotice");
  const exportButton = document.getElementById("exportButton");
  const totalPagesText = document.getElementById("totalPagesText");
  const progressFraction = document.getElementById("progressFraction");
  const progressBar = document.querySelector(".progressBar");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const cancelButton = document.getElementById("cancelButton");
  const resultIcon = document.getElementById("resultIcon");
  const resultTitle = document.getElementById("resultTitle");
  const resultMeta = document.getElementById("resultMeta");
  const resultFile = document.getElementById("resultFile");
  const showFileButton = document.getElementById("showFileButton");
  const openDownloadsButton = document.getElementById("openDownloadsButton");
  const retryButton = document.getElementById("retryButton");
  const openOrdersButton = document.getElementById("openOrdersButton");

  let activeTab = null;
  let currentPageInfo = null;
  let isBusy = false;
  let cancelRequested = false;
  let cancelWait = null;
  let lastDownloadId = null;
  let progressPageLimit = 1;

  function isJdOrderPage(url) {
    return /^https:\/\/order\.jd\.com\/center\/list\.action/.test(url || "");
  }

  function setView(view) {
    loadingView.hidden = view !== "loading";
    readyView.hidden = view !== "ready";
    progressView.hidden = view !== "progress";
    resultPanel.hidden = !view.startsWith("result-");
    wrongPageView.hidden = view !== "wrong-page";

    pageStatus.dataset.state = view;
    pageStatus.textContent = ({
      loading: "检查中",
      ready: "已连接",
      progress: "导出中",
      "result-success": "已完成",
      "result-warning": "部分完成",
      "result-error": "需处理",
      "result-neutral": "已停止",
      "wrong-page": "未连接"
    })[view];
  }

  function setBusy(nextBusy) {
    isBusy = nextBusy;
    exportButton.disabled = nextBusy || !currentPageInfo;
    maxPages.disabled = nextBusy;
  }

  function selectedPageLimit() {
    const total = Math.max(1, Number(currentPageInfo?.totalPages) || 1);
    const cap = maxPages.value === "unlimited" ? total : Number(maxPages.value) || 50;
    return Math.min(total, cap);
  }

  function updateScope() {
    if (!currentPageInfo) return;
    const total = Math.max(1, Number(currentPageInfo.totalPages) || 1);
    const selected = selectedPageLimit();
    totalPagesText.textContent = String(total);
    exportButton.textContent = `导出这 ${selected} 页`;
    rangeNotice.hidden = selected >= total;
    rangeNotice.textContent = selected < total
      ? `共 ${total} 页，本次最多导出 ${selected} 页`
      : "";
  }

  function pageNumber(page) {
    return String(page).padStart(2, "0");
  }

  function setProgress(page, rowCount) {
    const percent = Math.min(100, Math.round((page / progressPageLimit) * 100));
    progressFraction.textContent = `${pageNumber(page)} / ${pageNumber(progressPageLimit)} 页`;
    progressFill.style.width = `${percent}%`;
    progressBar.setAttribute("aria-valuenow", String(percent));
    progressText.textContent = `已读取 ${rowCount} 条商品记录`;
  }

  function showResult({ tone, title, meta, fileName = "", downloadId = null }) {
    lastDownloadId = downloadId;
    resultPanel.dataset.tone = tone;
    resultIcon.textContent = ({ success: "✓", warning: "!", error: "!", neutral: "—" })[tone];
    resultTitle.textContent = title;
    resultMeta.textContent = meta;
    resultFile.textContent = fileName;
    resultFile.hidden = !fileName;
    showFileButton.hidden = downloadId === null;
    openDownloadsButton.hidden = downloadId === null || tone === "warning";
    retryButton.hidden = downloadId !== null && tone !== "warning";
    retryButton.className = downloadId !== null ? "quietButton" : "primaryButton";
    retryButton.textContent = downloadId !== null ? "重新导出" : "重新检查";
    setView(`result-${tone}`);
  }

  function downloadCsv(csv, fileName) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      chrome.downloads.download(
        {
          url,
          filename: fileName,
          saveAs: false,
          conflictAction: "uniquify"
        },
        (downloadId) => {
          const error = chrome.runtime.lastError;
          setTimeout(() => URL.revokeObjectURL(url), 1000);

          if (error) {
            reject(new Error(error.message));
            return;
          }

          resolve(downloadId);
        }
      );
    });
  }

  async function queryActiveTab() {
    setView("loading");
    currentPageInfo = null;
    setBusy(false);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      activeTab = tab;

      if (!isJdOrderPage(tab?.url)) {
        setView("wrong-page");
        return;
      }

      currentPageInfo = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_PAGE_INFO });
      if (!currentPageInfo || !Number(currentPageInfo.totalPages)) {
        throw new Error("未识别到订单页数，请刷新京东订单列表页后重试");
      }

      updateScope();
      setBusy(false);
      setView("ready");
    } catch (error) {
      const message = error?.message || String(error);
      showResult({
        tone: "error",
        title: "无法读取订单页",
        meta: /Receiving end does not exist|Could not establish connection/.test(message)
          ? "请刷新京东订单列表页后重试"
          : message
      });
    }
  }

  async function loadSettings() {
    try {
      const settings = await chrome.storage.local.get({ maxPages: "50" });
      maxPages.value = settings.maxPages;
    } catch (_) {
      maxPages.value = "50";
    }
    if (!maxPages.value) maxPages.value = "50";
  }

  async function saveSettings() {
    updateScope();
    await chrome.storage.local.set({ maxPages: maxPages.value });
  }

  function buildPageUrl(page) {
    const url = new URL(activeTab.url);
    url.searchParams.set("page", String(page));
    return url.href;
  }

  function filterLabel() {
    return new URL(activeTab.url).searchParams.get("d") === "1"
      ? "recent-3-months"
      : "current-filter";
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitBeforeNextPage(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        cancelWait = null;
        resolve();
      }, ms);
      cancelWait = () => {
        clearTimeout(timer);
        cancelWait = null;
        resolve();
      };
    });
  }

  function stopIfCancelled() {
    if (cancelRequested) throw new Error("导出已取消");
  }

  async function readRenderedPage(tabId, page) {
    const deadline = Date.now() + 15000;

    while (Date.now() < deadline) {
      stopIfCancelled();
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: MESSAGE_PAGE_ROWS });
        stopIfCancelled();
        if (response?.currentPage === page && response.rows?.length > 0) {
          return response.rows;
        }
      } catch (error) {
        if (cancelRequested) throw error;
        // The content script is unavailable until the new page finishes loading.
      }

      await wait(300);
    }

    throw new Error(`第 ${page} 页加载超时，未读取到订单`);
  }

  async function collectOrders() {
    const pageInfo = await chrome.tabs.sendMessage(activeTab.id, { type: MESSAGE_PAGE_INFO });
    stopIfCancelled();
    currentPageInfo = pageInfo;
    updateScope();
    progressPageLimit = selectedPageLimit();
    setProgress(0, 0);
    let workerTabId = null;

    try {
      const result = await window.JdOrderExporterCore.collectJdOrders({
        totalPages: pageInfo.totalPages,
        maxPages: maxPages.value,
        readPage: async (page) => {
          stopIfCancelled();
          if (page === pageInfo.currentPage) {
            return readRenderedPage(activeTab.id, page);
          }

          const url = buildPageUrl(page);
          if (workerTabId === null) {
            const workerTab = await chrome.tabs.create({ url, active: false });
            workerTabId = workerTab.id;
          } else {
            await chrome.tabs.update(workerTabId, { url });
          }

          stopIfCancelled();
          return readRenderedPage(workerTabId, page);
        },
        onProgress: ({ page, rowCount }) => setProgress(page, rowCount),
        wait: () => waitBeforeNextPage(800 + Math.floor(Math.random() * 701))
      });

      return { ...result, filterLabel: filterLabel() };
    } finally {
      if (workerTabId !== null) {
        await chrome.tabs.remove(workerTabId).catch(() => {});
      }
    }
  }

  async function exportOrders() {
    if (isBusy || !activeTab || !currentPageInfo) return;

    cancelRequested = false;
    cancelButton.disabled = false;
    cancelButton.textContent = "取消导出";
    progressPageLimit = selectedPageLimit();
    setBusy(true);
    setProgress(0, 0);
    setView("progress");

    try {
      const result = await collectOrders();
      if (cancelRequested) {
        showResult({ tone: "neutral", title: "导出已取消", meta: "未保存文件" });
        return;
      }

      const rows = result?.rows || [];
      if (rows.length === 0) {
        showResult({
          tone: "error",
          title: "没有导出文件",
          meta: result?.error || "当前筛选下没有读取到商品记录"
        });
        return;
      }

      const csv = window.JdOrderExporterCore.buildOrdersCsv(rows);
      const fileName = window.JdOrderExporterCore.buildCsvFileName({
        filterLabel: result.filterLabel || "current-filter",
        now: new Date()
      });

      cancelButton.disabled = true;
      cancelButton.textContent = "正在保存文件…";
      const downloadId = await downloadCsv(csv, fileName);
      showResult({
        tone: result.ok ? "success" : "warning",
        title: result.ok ? "订单已导出" : "已导出部分订单",
        meta: result.ok
          ? `${rows.length} 条商品记录 · 扫描 ${result.pagesScanned} 页`
          : `${rows.length} 条商品记录 · 第 ${result.failedPage} 页读取失败：${result.error}`,
        fileName,
        downloadId
      });
    } catch (error) {
      if (cancelRequested) {
        showResult({ tone: "neutral", title: "导出已取消", meta: "未保存文件" });
      } else {
        const message = error?.message || String(error);
        showResult({
          tone: "error",
          title: "导出失败",
          meta: /Receiving end does not exist|Could not establish connection/.test(message)
            ? "请刷新京东订单列表页后重试"
            : message
        });
      }
    } finally {
      setBusy(false);
    }
  }

  maxPages.addEventListener("change", saveSettings);
  exportButton.addEventListener("click", exportOrders);
  cancelButton.addEventListener("click", () => {
    if (!isBusy || cancelButton.disabled) return;
    cancelRequested = true;
    cancelButton.disabled = true;
    cancelButton.textContent = "正在停止…";
    if (cancelWait) cancelWait();
  });
  showFileButton.addEventListener("click", () => {
    if (lastDownloadId !== null) chrome.downloads.show(lastDownloadId);
  });
  openDownloadsButton.addEventListener("click", () => chrome.downloads.showDefaultFolder());
  retryButton.addEventListener("click", queryActiveTab);
  openOrdersButton.addEventListener("click", () => chrome.tabs.create({ url: ORDER_LIST_URL }));

  loadSettings().then(queryActiveTab);
})();
