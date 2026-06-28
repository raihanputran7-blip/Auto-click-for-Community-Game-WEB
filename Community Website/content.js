(function () {
  const STORAGE_KEY = "xcAutoApproverState";
  const DEFAULT_STATE = {
    running: false,
    queue: [],
    index: 0,
    approved: 0,
    skipped: 0,
    lastAction: "Idle",
    lastError: "",
    startedAt: null,
    finishedAt: null,
    processed: []
  };
  const INBOX_LIST_REGEX = /^\/clans\/inbox\/?$/;
  const INBOX_DETAIL_REGEX = /^\/clans\/inbox\/[^/]+\/?$/i;
  const DISTRIBUTION_REGEX = /^\/clans\/[^/]+\/distributions\/[^/]+\/?$/i;

  let processing = false;
  let scheduledRun = null;

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function getState() {
    return chrome.storage.local.get(STORAGE_KEY).then((data) => {
      return { ...DEFAULT_STATE, ...(data[STORAGE_KEY] || {}) };
    });
  }

  function setState(nextState) {
    return chrome.storage.local.set({
      [STORAGE_KEY]: { ...DEFAULT_STATE, ...nextState }
    });
  }

  async function patchState(partialState) {
    const currentState = await getState();
    const nextState = { ...currentState, ...partialState };
    await setState(nextState);
    return nextState;
  }

  function scheduleRun(waitMs = 500) {
    window.clearTimeout(scheduledRun);
    scheduledRun = window.setTimeout(() => {
      processCurrentPage().catch((error) => {
        handleError(error);
      });
    }, waitMs);
  }

  async function handleError(error) {
    await patchState({
      lastError: error.message,
      lastAction: "Terjadi error.",
      running: false,
      finishedAt: new Date().toISOString()
    });
  }

  function normalizeUrl(value) {
    try {
      return new URL(value, window.location.origin).toString();
    } catch (error) {
      return "";
    }
  }

  function findElementByText(selector, expectedText, options = {}) {
    const { exact = true } = options;
    const textNeedle = expectedText.trim().toLowerCase();
    const candidates = Array.from(document.querySelectorAll(selector));
    return candidates.find((element) => {
      const text = (element.innerText || element.textContent || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
      return exact ? text === textNeedle : text.includes(textNeedle);
    });
  }

  function findFirstMatchingElement(selector, texts, options = {}) {
    for (const text of texts) {
      const element = findElementByText(selector, text, options);
      if (element) {
        return element;
      }
    }

    return null;
  }

  function clickElement(element) {
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    element.click();
  }

  function isDisabled(element) {
    return Boolean(
      element?.disabled ||
      element?.getAttribute("aria-disabled") === "true" ||
      element?.classList?.contains("disabled")
    );
  }

  async function waitForMatchingElement(selector, texts, options = {}) {
    const {
      attempts = 8,
      delayMs = 300,
      exact = true
    } = options;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const element = findFirstMatchingElement(selector, texts, { exact });
      if (element) {
        return element;
      }
      await delay(delayMs);
    }

    return null;
  }

  async function clickLoadMoreButtonIfPresent() {
    const loadMoreButton = findFirstMatchingElement(
      'button, a, [role="button"]',
      ["Muat lebih banyak", "Load more"],
      { exact: false }
    );

    if (!loadMoreButton || isDisabled(loadMoreButton)) {
      return false;
    }

    clickElement(loadMoreButton);
    await delay(1000);
    return true;
  }

  function isInboxPending(anchor) {
    const text = (anchor.innerText || "").toLowerCase();
    
    if (!text.includes("menunggu") && !text.includes("waiting")) {
      return false;
    }

    const style = window.getComputedStyle(anchor);
    if (parseFloat(style.opacity || "1") < 0.7) {
      return false;
    }

    const icon = anchor.querySelector("svg, img, i, .icon, button");
    if (icon) {
      const iconStyle = window.getComputedStyle(icon);
      const color = iconStyle.color || "";
      const opacity = parseFloat(iconStyle.opacity || "1");
      if (opacity < 0.7) {
        return false;
      }

      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);

        const isGrey = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r < 200;
        if (isGrey) {
          return false;
        }
      }
    }

    return true;
  }

  async function scanInboxListPage() {
    await patchState({
      lastError: "",
      lastAction: "Mencari inbox yang belum diproses..."
    });

    let anchors = [];
    for (let i = 0; i < 10; i++) {
      anchors = Array.from(document.querySelectorAll('a[href*="/clans/inbox/"]'));
      if (anchors.length > 0) break;
      await delay(300);
    }

    const state = await getState();
    const pendingInbox = anchors.find(anchor => {
      const href = normalizeUrl(anchor.getAttribute("href"));
      if (state.processed && state.processed.includes(href)) {
        return false;
      }
      return isInboxPending(anchor);
    });

    if (pendingInbox) {
      const href = pendingInbox.getAttribute("href");
      const absoluteUrl = normalizeUrl(href);
      
      const updatedProcessed = [...(state.processed || []), absoluteUrl];
      await patchState({
        processed: updatedProcessed,
        lastAction: `Membuka inbox: ${pendingInbox.textContent.trim().split('\n')[0]}`
      });
      
      clickElement(pendingInbox);
      
      await delay(300);
      if (window.location.href !== absoluteUrl) {
        window.location.href = absoluteUrl;
      }
      return;
    }

    const clickedLoadMore = await clickLoadMoreButtonIfPresent();
    if (clickedLoadMore) {
      await patchState({
        lastAction: "Memuat lebih banyak inbox..."
      });
      await delay(1200);
      scheduleRun(300);
      return;
    }

    await patchState({
      running: false,
      lastAction: "Semua inbox selesai diproses.",
      finishedAt: new Date().toISOString()
    });
    alert("sudah selesai");
  }

  async function openDistributionFromInboxDetail() {
    await patchState({
      lastError: "",
      lastAction: "Membuka tombol Lihat TKP..."
    });

    let actionElement = null;
    for (let i = 0; i < 10; i++) {
      actionElement =
        findElementByText('a, button, [role="button"]', "Lihat TKP", { exact: false }) ||
        Array.from(document.querySelectorAll('a[href*="/distributions/"]')).find(Boolean);
      if (actionElement) break;
      await delay(200);
    }

    if (!actionElement) {
      await patchState({
        lastAction: "Tombol Lihat TKP tidak ditemukan, kembali ke inbox."
      });
      await delay(500);
      window.location.href = "https://xcashshop.club/clans/inbox";
      return;
    }

    const href = actionElement.getAttribute("href");
    if (href) {
      const absoluteUrl = normalizeUrl(href);
      if (absoluteUrl) {
        window.location.href = absoluteUrl;
        return;
      }
    }

    clickElement(actionElement);
  }

  function readApprovalStatusText() {
    const sections = Array.from(document.querySelectorAll("body *"));
    for (const section of sections) {
      const text = (section.innerText || "").trim().toLowerCase();
      if (!text) {
        continue;
      }

      if (text === "menunggu" || text === "setuju" || text === "disetujui" || text === "ditolak") {
        return text;
      }
    }

    return "";
  }

  async function clickApproveButton() {
    await patchState({
      lastError: "",
      lastAction: "Mencari tombol Setuju..."
    });

    let approveButton = null;
    for (let i = 0; i < 10; i++) {
      approveButton = findElementByText('button, a, [role="button"]', "Setuju", { exact: false });
      if (approveButton) break;
      await delay(200);
    }

    const state = await getState();

    if (approveButton) {
      clickElement(approveButton);
      await patchState({
        lastAction: "Tombol Setuju diklik, menunggu Konfirmasi..."
      });

      const confirmButton = await waitForMatchingElement(
        'button, a, [role="button"]',
        ["Konfirmasi", "Confirm", "Ya", "OK"],
        {
          attempts: 10,
          delayMs: 300,
          exact: false
        }
      );

      if (confirmButton) {
        await patchState({
          lastAction: "Menekan tombol Konfirmasi..."
        });
        clickElement(confirmButton);
        await delay(800);
      }

      await patchState({
        approved: (state.approved || 0) + 1,
        lastAction: "Proses selesai, kembali ke inbox..."
      });
    } else {
      await patchState({
        skipped: (state.skipped || 0) + 1,
        lastAction: "Tombol Setuju tidak ditemukan, kembali ke inbox..."
      });
    }
    await delay(500);
    window.location.href = "https://xcashshop.club/clans/inbox";
  }

  async function stopAutomation(reason) {
    await patchState({
      running: false,
      lastAction: reason,
      finishedAt: new Date().toISOString()
    });
  }

  async function processCurrentPage() {
    if (processing) {
      return;
    }

    processing = true;

    try {
      const state = await getState();

      if (!state.running) {
        processing = false;
        return;
      }

      const path = window.location.pathname;
      console.log("XCLUB CLICKER: Processing page:", path);

      if (INBOX_LIST_REGEX.test(path)) {
        console.log("XCLUB CLICKER: Matches Inbox List Page");
        await scanInboxListPage();
      } else if (INBOX_DETAIL_REGEX.test(path)) {
        console.log("XCLUB CLICKER: Matches Inbox Detail Page");
        await openDistributionFromInboxDetail();
      } else if (DISTRIBUTION_REGEX.test(path)) {
        console.log("XCLUB CLICKER: Matches Distribution Page");
        await clickApproveButton();
      } else {
        console.log("XCLUB CLICKER: Unknown page. Redirecting to inbox...");
        await patchState({
          lastError: "",
          lastAction: "Halaman tidak sesuai. Mengarahkan ke inbox..."
        });
        await delay(700);
        window.location.href = "https://xcashshop.club/clans/inbox";
      }
    } finally {
      processing = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) {
      return;
    }

    if (message.type === "XC_CLICKER_START") {
      patchState({
        running: true,
        lastError: "",
        lastAction: "Automation dimulai dari tab ini.",
        startedAt: new Date().toISOString(),
        finishedAt: null
      }).then(() => {
        scheduleRun(400);
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === "XC_CLICKER_STOP") {
      stopAutomation("Automation dihentikan dari popup.").then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === "XC_CLICKER_RESET") {
      setState(DEFAULT_STATE).then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) {
      const state = changes[STORAGE_KEY].newValue || {};
      if (state.running) {
        console.log("XCLUB CLICKER: Automation started via storage change.");
        scheduleRun(300);
      } else {
        window.clearTimeout(scheduledRun);
        console.log("XCLUB CLICKER: Automation stopped via storage change.");
      }
    }
  });

  console.log("XCLUB CLICKER: Content script initialized on", window.location.href);

  // Watch for SPA path changes
  let lastPath = window.location.pathname;
  window.setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      console.log("XCLUB CLICKER: SPA Path changed to", lastPath);
      getState().then((state) => {
        if (state.running) {
          scheduleRun(500);
        }
      });
    }
  }, 1000);

  getState()
    .then((state) => {
      const path = window.location.pathname;
      if (INBOX_LIST_REGEX.test(path) && !state.running) {
        patchState({
          running: true,
          lastError: "",
          lastAction: "Automation auto-start terdeteksi di halaman inbox.",
          startedAt: new Date().toISOString(),
          finishedAt: null
        }).then(() => {
          scheduleRun(800);
        });
      } else if (state.running) {
        scheduleRun(800);
      }
    })
    .catch((error) => {
      console.error("XCLUB CLICKER failed to initialize:", error);
    });
})();
