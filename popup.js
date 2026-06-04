(function attachPopup() {
  const MESSAGE_EXPORT = "JD_EXPORT_ORDERS";
  const MESSAGE_PAGE_INFO = "JD_GET_PAGE_INFO";
  const MESSAGE_PROGRESS = "JD_EXPORT_PROGRESS";

  const pageStatus = document.getElementById("pageStatus");
  const maxPages = document.getElementById("maxPages");
  const exportButton = document.getElementById("exportButton");
  const totalPagesText = document.getElementById("totalPagesText");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const resultPanel = document.getElementById("resultPanel");
  const resultTitle = document.getElementById("resultTitle");
  const resultMeta = document.getElementById("resultMeta");
  const showFileButton = document.getElementById("showFileButton");
  const openDownloadsButton = document.getElementById("openDownloadsButton");

  let activeTab = null;
  let isBusy = false;
  let lastDownloadId = null;

  function setBusy(nextBusy) {
    isBusy = nextBusy;
    exportButton.disabled = nextBusy || !isJdOrderPage(activeTab?.url || "");
    maxPages.disabled = nextBusy;
  }

  function isJdOrderPage(url) {
    return /^https:\/\/order\.jd\.com\/center\/list\.action/.test(url || "");
  }

  function setProgress(page, rowCount) {
    const selectedMaxPages = maxPages.value === "unlimited" ? 100 : Number(maxPages.value);
    const progress = page > 0 ? Math.min(100, Math.round((page / selectedMaxPages) * 100)) : 0;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = page > 0 ? `已扫描第 ${page} 页，已读取 ${rowCount} 行` : "准备导出";
  }

  function setPageInfo(pageInfo) {
    if (pageInfo?.totalPages) {
      totalPagesText.textContent = `共 ${pageInfo.totalPages} 页`;
      return;
    }

    totalPagesText.textContent = "未识别";
  }

  function clearResult() {
    lastDownloadId = null;
    resultPanel.hidden = true;
    resultTitle.textContent = "";
    resultMeta.textContent = "";
    showFileButton.disabled = true;
  }

  function showResult({ title, meta, downloadId }) {
    lastDownloadId = downloadId || null;
    resultTitle.textContent = title;
    resultMeta.textContent = meta;
    showFileButton.disabled = !lastDownloadId;
    resultPanel.hidden = false;
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;

    if (isJdOrderPage(tab?.url || "")) {
      pageStatus.textContent = "已识别京东订单列表页";
      exportButton.disabled = false;
      try {
        setPageInfo(await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_PAGE_INFO }));
      } catch (_) {
        totalPagesText.textContent = "刷新后识别";
      }
    } else {
      pageStatus.textContent = "请在京东订单列表页使用";
      exportButton.disabled = true;
      totalPagesText.textContent = "-";
    }
  }

  async function loadSettings() {
    const settings = await chrome.storage.local.get({ maxPages: "50" });
    maxPages.value = settings.maxPages;
  }

  async function saveSettings() {
    await chrome.storage.local.set({ maxPages: maxPages.value });
  }

  function sendExportMessage() {
    return chrome.tabs.sendMessage(activeTab.id, {
      type: MESSAGE_EXPORT,
      maxPages: maxPages.value === "unlimited" ? "unlimited" : Number(maxPages.value)
    });
  }

  async function exportOrders() {
    if (isBusy || !activeTab) return;

    if (maxPages.value === "unlimited") {
      const confirmed = window.confirm("不限制页数可能运行很久。确认继续导出吗？");
      if (!confirmed) return;
    }

    setBusy(true);
    clearResult();
    setProgress(0, 0);

    try {
      const result = await sendExportMessage();
      const rows = result?.rows || [];

      if (rows.length === 0) {
        progressFill.style.width = "0%";
        progressText.textContent = result?.error || "没有读取到可见订单";
        showResult({
          title: "没有导出文件",
          meta: progressText.textContent,
          downloadId: null
        });
        return;
      }

      const csv = window.JdOrderExporterCore.buildOrdersCsv(rows);
      const fileName = window.JdOrderExporterCore.buildCsvFileName({
        filterLabel: result.filterLabel || "current-filter",
        now: new Date()
      });

      const downloadId = await downloadCsv(csv, fileName);

      progressFill.style.width = "100%";
      progressText.textContent = result.ok
        ? `完成：导出 ${rows.length} 行，扫描 ${result.pagesScanned} 页`
        : `第 ${result.failedPage} 页失败，已导出 ${rows.length} 行`;
      showResult({
        title: result.ok ? "CSV 已导出" : "已导出部分订单",
        meta: `${fileName}，共 ${rows.length} 行，保存到浏览器默认下载目录`,
        downloadId
      });
    } catch (error) {
      progressFill.style.width = "0%";
      const message = error?.message || String(error);
      progressText.textContent = /Receiving end does not exist|Could not establish connection/.test(message)
        ? "请刷新京东订单列表页后重试"
        : message;
      showResult({
        title: "导出失败",
        meta: progressText.textContent,
        downloadId: null
      });
    } finally {
      setBusy(false);
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === MESSAGE_PROGRESS) {
      setProgress(message.page, message.rowCount);
    }
  });

  maxPages.addEventListener("change", saveSettings);
  exportButton.addEventListener("click", exportOrders);
  showFileButton.addEventListener("click", () => {
    if (lastDownloadId) {
      chrome.downloads.show(lastDownloadId);
    }
  });
  openDownloadsButton.addEventListener("click", () => chrome.downloads.showDefaultFolder());

  Promise.all([loadSettings(), queryActiveTab()]).then(() => setBusy(false));
})();
