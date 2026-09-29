(function attachExportFlowCore(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.JdOrderExporterCore = Object.assign(root.JdOrderExporterCore || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function exportFlowFactory() {
  function numericMaxPages(maxPages) {
    return maxPages === "unlimited" ? Number.POSITIVE_INFINITY : Number(maxPages || 50);
  }

  async function collectJdOrders({
    totalPages,
    maxPages = 50,
    readPage,
    onProgress = () => {},
    wait = async () => {}
  }) {
    const rows = [];
    const limit = Math.min(Number(totalPages) || 1, numericMaxPages(maxPages));

    for (let page = 1; page <= limit; page += 1) {
      let pageRows;

      try {
        pageRows = await readPage(page);
        if (!Array.isArray(pageRows) || pageRows.length === 0) {
          if (page === 1) {
            return { ok: true, rows, pagesScanned: 0, stoppedReason: "empty-page" };
          }
          throw new Error(`第 ${page} 页没有读取到订单`);
        }
      } catch (error) {
        return {
          ok: false,
          rows,
          pagesScanned: page - 1,
          failedPage: page,
          error: error?.message || String(error)
        };
      }

      rows.push(...pageRows);
      onProgress({ page, rowCount: rows.length });

      if (page < limit) {
        await wait(page);
      }
    }

    return {
      ok: true,
      rows,
      pagesScanned: limit,
      stoppedReason: limit < Number(totalPages) ? "max-pages" : "last-page"
    };
  }

  return {
    collectJdOrders
  };
});
