(function attachJdOrderCore(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.JdOrderExporterCore = Object.assign(root.JdOrderExporterCore || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function jdOrderFactory() {
  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function absoluteUrl(value, document) {
    if (!value) return "";

    try {
      return new URL(value, document.location.href).href;
    } catch (_) {
      return value;
    }
  }

  function textOf(root, selector) {
    const node = root.querySelector(selector);
    return node ? normalizeText(node.textContent) : "";
  }

  function firstHref(root, selector, document) {
    const node = root.querySelector(selector);
    return node ? absoluteUrl(node.getAttribute("href"), document) : "";
  }

  function parseAmountCell(row) {
    const amountCell = row.querySelector(".amount");
    if (!amountCell) return { amount: "", paymentMethod: "" };

    const parts = Array.from(amountCell.querySelectorAll("span"))
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean);

    if (parts.length > 0) {
      return {
        amount: parts[0] || "",
        paymentMethod: parts.slice(1).join("；")
      };
    }

    const lines = normalizeText(amountCell.textContent).split(" ").filter(Boolean);
    return {
      amount: lines[0] || "",
      paymentMethod: lines.slice(1).join("；")
    };
  }

  function parseOrderNumber(header) {
    const linkedNumber = textOf(header, ".number a");
    if (linkedNumber) return linkedNumber;

    const match = normalizeText(textOf(header, ".number")).match(/订单号[:：]\s*(\d+)/);
    return match ? match[1] : "";
  }

  function parseStatus(row) {
    const statusCell = row.querySelector(".status");
    if (!statusCell) return { status: "", rewardInfo: "" };

    const parts = Array.from(statusCell.querySelectorAll("span, em, b"))
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean);

    return {
      status: parts.find((part) => !/^[+＋]/.test(part)) || normalizeText(statusCell.childNodes[0]?.textContent),
      rewardInfo: parts.filter((part) => /^[+＋]/.test(part)).join("；")
    };
  }

  function parseActions(row) {
    return Array.from(row.querySelectorAll(".operate a, .operate button"))
      .map((node) => normalizeText(node.textContent))
      .filter(Boolean)
      .join("；");
  }

  function parseRowMeta(orderGroup, row) {
    const { amount, paymentMethod } = parseAmountCell(row);
    const { status, rewardInfo } = parseStatus(row);
    const detailUrl =
      firstHref(row, ".status a[href*='orderid']", row.ownerDocument) ||
      firstHref(orderGroup, ".number a", row.ownerDocument);

    return {
      recipient: textOf(row, ".consignee"),
      amount,
      paymentMethod,
      status,
      rewardInfo,
      actions: parseActions(row),
      detailUrl
    };
  }

  function mergeRowMeta(previousMeta, rowMeta) {
    return Object.fromEntries(
      Object.entries(rowMeta).map(([key, value]) => [key, value || previousMeta[key] || ""])
    );
  }

  function parseProduct(row, product, orderMeta, rowMeta) {
    return {
      orderedAt: orderMeta.orderedAt,
      orderNumber: orderMeta.orderNumber,
      shopName: orderMeta.shopName,
      productName: textOf(product, ".p-name a") || textOf(product, ".p-name"),
      quantity: normalizeText(textOf(product, ".goods-number")).replace(/^[xX×]\s*/, ""),
      recipient: rowMeta.recipient,
      amount: rowMeta.amount,
      paymentMethod: rowMeta.paymentMethod,
      status: rowMeta.status,
      rewardInfo: rowMeta.rewardInfo,
      actions: rowMeta.actions,
      detailUrl: rowMeta.detailUrl
    };
  }

  function parseJdOrdersFromDocument(document) {
    const orderGroups = Array.from(document.querySelectorAll(".order-tb tbody, tbody[id^='tb-']"));

    return orderGroups.flatMap((orderGroup) => {
      const header = orderGroup.querySelector(".tr-th");
      const productRows = Array.from(orderGroup.querySelectorAll(".tr-bd"));

      if (!header || productRows.length === 0) {
        return [];
      }

      const orderMeta = {
        orderedAt: textOf(header, ".dealtime"),
        orderNumber: parseOrderNumber(header),
        shopName: textOf(header, ".order-shop") || "京东"
      };

      let inheritedRowMeta = {};

      return productRows.flatMap((row) => {
        const products = Array.from(row.querySelectorAll(".goods-item"));
        const rowMeta = mergeRowMeta(inheritedRowMeta, parseRowMeta(orderGroup, row));
        inheritedRowMeta = rowMeta;
        return products.map((product) => parseProduct(row, product, orderMeta, rowMeta));
      });
    });
  }

  function buildJdOrderPageUrl(currentUrl, pageNumber) {
    const url = new URL(currentUrl);
    url.searchParams.set("page", String(pageNumber));
    return url.href;
  }

  function pageNumberFromUrl(url) {
    try {
      return Number(new URL(url).searchParams.get("page") || "1") || 1;
    } catch (_) {
      return 1;
    }
  }

  function getJdOrderPageInfoFromDocument(document, currentUrl = document.location.href) {
    const currentPage = pageNumberFromUrl(currentUrl);
    const bodyText = normalizeText(document.body?.textContent || "");
    const totalFromText = Number(bodyText.match(/共\s*(\d+)\s*页/)?.[1] || 0);
    const totalFromLinks = Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => {
        try {
          return Number(new URL(anchor.getAttribute("href"), currentUrl).searchParams.get("page") || 0);
        } catch (_) {
          return 0;
        }
      })
      .filter(Boolean);

    const totalPages = Math.max(totalFromText, currentPage, ...totalFromLinks);

    return {
      currentPage,
      totalPages: totalPages || null
    };
  }

  return {
    buildJdOrderPageUrl,
    getJdOrderPageInfoFromDocument,
    parseJdOrdersFromDocument
  };
});
