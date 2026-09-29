(function attachJdOrderContentScript() {
  const MESSAGE_PAGE_INFO = "JD_GET_PAGE_INFO";
  const MESSAGE_PAGE_ROWS = "JD_GET_PAGE_ROWS";

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGE_PAGE_INFO) {
      sendResponse(window.JdOrderExporterCore.getJdOrderPageInfoFromDocument(document, window.location.href));
      return false;
    }

    if (message?.type === MESSAGE_PAGE_ROWS) {
      const pageInfo = window.JdOrderExporterCore.getJdOrderPageInfoFromDocument(document, window.location.href);
      sendResponse({
        currentPage: pageInfo.currentPage,
        rows: window.JdOrderExporterCore.parseJdOrdersFromDocument(document)
      });
    }

    return false;
  });
})();
