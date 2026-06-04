(function attachExportFlowCore(root, factory) {
  const dependencies = root.JdOrderExporterCore || {};
  const api = factory(dependencies);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./jdOrders"));
  }

  root.JdOrderExporterCore = Object.assign(root.JdOrderExporterCore || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function exportFlowFactory({
  buildJdOrderPageUrl,
  parseJdOrdersFromDocument
}) {
  function numericMaxPages(maxPages) {
    return maxPages === "unlimited" ? Number.POSITIVE_INFINITY : Number(maxPages || 50);
  }

  function currentDocumentMatchesPage(currentUrl, pageNumber) {
    const url = new URL(currentUrl);
    return Number(url.searchParams.get("page") || "1") === pageNumber;
  }

  async function collectJdOrders({
    currentDocument,
    currentUrl,
    fetchPageDocument,
    maxPages = 50,
    onProgress = () => {},
    wait = async () => {}
  }) {
    const rows = [];
    const limit = numericMaxPages(maxPages);

    for (let page = 1; page <= limit; page += 1) {
      const pageUrl = buildJdOrderPageUrl(currentUrl, page);
      let pageDocument;

      try {
        pageDocument =
          page === 1 && currentDocumentMatchesPage(currentUrl, page)
            ? currentDocument
            : await fetchPageDocument(pageUrl);
      } catch (error) {
        return {
          ok: false,
          rows,
          pagesScanned: page - 1,
          failedPage: page,
          error: error?.message || String(error)
        };
      }

      const pageRows = parseJdOrdersFromDocument(pageDocument);

      if (pageRows.length === 0) {
        return {
          ok: true,
          rows,
          pagesScanned: page - 1,
          stoppedReason: "empty-page"
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
      pagesScanned: Number.isFinite(limit) ? limit : rows.length,
      stoppedReason: "max-pages"
    };
  }

  return {
    collectJdOrders
  };
});
