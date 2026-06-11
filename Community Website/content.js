(function () {
  const STORAGE_KEY = "dsAutoApproverState";
  const DEFAULT_STATE = {
    running: false,
    queue: [],
    index: 0,
    approved: 0,
    skipped: 0,
    delaySeconds: 2,
    lastAction: "Idle",
    lastError: "",
    startedAt: null,
    finishedAt: null
  };
  const INBOX_LIST_REGEX = /^\/clans\/inbox\/?$/;
  const INBOX_DETAIL_REGEX = /^\/clans\/inbox\/[0-9a-f-]+\/?$/i;
  const DISTRIBUTION_REGEX = /^\/clans\/[^/]+\/distributions\/[0-9a-f-]+\/?$/i;
  const PANEL_ID = "ds-auto-approver-panel";
  const PANEL_STYLE_ID = "ds-auto-approver-style";

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
    renderPanel(nextState);
    return nextState;
  }

  function ensurePanel() {
    if (!document.head.querySelector(`#${PANEL_STYLE_ID}`)) {
      const style = document.createElement("style");
      style.id = PANEL_STYLE_ID;
      style.textContent = `
        #${PANEL_ID} {
          position: fixed;
          right: 16px;
          bottom: 16px;
          width: 280px;
          padding: 14px;
          background: rgba(9, 17, 31, 0.94);
          color: #edf2ff;
          border: 1px solid rgba(102, 126, 234, 0.35);
          border-radius: 14px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          z-index: 2147483647;
          font: 13px/1.45 "Segoe UI", Tahoma, sans-serif;
          backdrop-filter: blur(12px);
        }
        #${PANEL_ID}.is-hidden {
          display: none;
        }
        #${PANEL_ID} .ds-title {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        #${PANEL_ID} .ds-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 4px 0;
        }
        #${PANEL_ID} .ds-label {
          color: #9fb0d4;
        }
        #${PANEL_ID} .ds-value {
          font-weight: 600;
          text-align: right;
        }
        #${PANEL_ID} .ds-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        #${PANEL_ID} button {
          flex: 1;
          border: 0;
          border-radius: 9px;
          padding: 9px 10px;
          cursor: pointer;
          font-weight: 600;
        }
        #${PANEL_ID} .ds-stop {
          background: #b43333;
          color: #fff;
        }
        #${PANEL_ID} .ds-hide {
          background: #223754;
          color: #fff;
        }
      `;
      document.head.appendChild(style);
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("aside");
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <div class="ds-title">DarkSystem Auto Approver</div>
        <div class="ds-row"><span class="ds-label">Status</span><span class="ds-value" data-field="status">Idle</span></div>
        <div class="ds-row"><span class="ds-label">Queue</span><span class="ds-value" data-field="queue">0</span></div>
        <div class="ds-row"><span class="ds-label">Posisi</span><span class="ds-value" data-field="position">0</span></div>
        <div class="ds-row"><span class="ds-label">Setuju</span><span class="ds-value" data-field="approved">0</span></div>
        <div class="ds-row"><span class="ds-label">Skip</span><span class="ds-value" data-field="skipped">0</span></div>
        <div class="ds-row"><span class="ds-label">Aksi terakhir</span><span class="ds-value" data-field="action">Idle</span></div>
        <div class="ds-actions">
          <button class="ds-stop" type="button">Stop</button>
          <button class="ds-hide" type="button">Sembunyikan</button>
        </div>
      `;

      panel.querySelector(".ds-stop").addEventListener("click", () => {
        stopAutomation("Automation dihentikan dari panel.");
      });

      panel.querySelector(".ds-hide").addEventListener("click", () => {
        panel.classList.add("is-hidden");
      });

      document.documentElement.appendChild(panel);
    }

    return panel;
  }

  function renderPanel(state) {
    const panel = ensurePanel();
    const position = state.queue.length ? Math.min(state.index + 1, state.queue.length) : 0;

    panel.querySelector('[data-field="status"]').textContent = state.running ? "Berjalan" : "Berhenti";
    panel.querySelector('[data-field="queue"]').textContent = String(state.queue.length);
    panel.querySelector('[data-field="position"]').textContent = String(position);
    panel.querySelector('[data-field="approved"]').textContent = String(state.approved);
    panel.querySelector('[data-field="skipped"]').textContent = String(state.skipped);
    panel.querySelector('[data-field="action"]').textContent = state.lastError || state.lastAction || "Idle";
    panel.classList.remove("is-hidden");
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

  function getActionableInboxLinks() {
    const links = new Set();
    const anchors = Array.from(document.querySelectorAll('a[href*="/clans/inbox/"]'));

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href");
      const absoluteUrl = normalizeUrl(href);
      const url = absoluteUrl ? new URL(absoluteUrl) : null;
      if (!url || !INBOX_DETAIL_REGEX.test(url.pathname)) {
        continue;
      }

      const blockText = anchor.innerText || anchor.textContent || "";
      const nearbyText = anchor.closest("a, article, div, li")?.innerText || "";
      const combinedText = `${blockText} ${nearbyText}`.toLowerCase();

      if (
        combinedText.includes("sedang menunggu persetujuan") ||
        combinedText.includes("didistribusikan") ||
        combinedText.includes("distribution")
      ) {
        links.add(absoluteUrl);
      }
    }

    return Array.from(links);
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
      delayMs = 700,
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
    await delay(1600);
    return true;
  }

  async function autoScrollInboxPage() {
    let stableRounds = 0;
    let previousHeight = 0;
    let previousCount = 0;

    for (let round = 0; round < 20; round += 1) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      await delay(1200);
      const clickedLoadMore = await clickLoadMoreButtonIfPresent();

      if (clickedLoadMore) {
        await delay(1000);
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        await delay(900);
      }

      const currentHeight = document.body.scrollHeight;
      const currentCount = getActionableInboxLinks().length;

      if (
        currentHeight === previousHeight &&
        currentCount === previousCount &&
        !clickedLoadMore
      ) {
        stableRounds += 1;
      } else {
        stableRounds = 0;
      }

      previousHeight = currentHeight;
      previousCount = currentCount;

      if (stableRounds >= 2) {
        break;
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    await delay(400);
  }

  async function goToNextInboxItem(extraState = {}) {
    const state = await getState();
    const nextIndex = state.index + 1;
    const done = nextIndex >= state.queue.length;

    const updatedState = await patchState({
      ...extraState,
      index: nextIndex,
      lastError: "",
      lastAction: done ? "Semua inbox selesai diproses." : "Lanjut ke inbox berikutnya."
    });

    if (done) {
      await patchState({
        running: false,
        finishedAt: new Date().toISOString(),
        lastAction: `Selesai. Berhasil: ${updatedState.approved}, skip: ${updatedState.skipped}.`
      });
      window.location.href = "https://darksystem.id/clans/inbox";
      return;
    }

    await delay((updatedState.delaySeconds || 2) * 1000);
    window.location.href = updatedState.queue[nextIndex];
  }

  async function scanInboxListPage() {
    const existingState = await getState();

    if (
      existingState.queue.length &&
      existingState.index < existingState.queue.length
    ) {
      await patchState({
        lastError: "",
        lastAction: "Melanjutkan queue yang sudah ada..."
      });
      await delay((existingState.delaySeconds || 2) * 1000);
      window.location.href = existingState.queue[existingState.index];
      return;
    }

    await patchState({
      lastError: "",
      lastAction: "Mencari semua inbox distribusi..."
    });

    await autoScrollInboxPage();
    const links = getActionableInboxLinks();

    if (!links.length) {
      await patchState({
        running: false,
        lastAction: "Tidak ada inbox distribusi yang ditemukan.",
        finishedAt: new Date().toISOString()
      });
      return;
    }

    const nextState = await patchState({
      queue: links,
      index: 0,
      approved: 0,
      skipped: 0,
      lastError: "",
      lastAction: `Ditemukan ${links.length} inbox. Membuka item pertama...`
    });

    await delay((nextState.delaySeconds || 2) * 1000);
    window.location.href = links[0];
  }

  async function openDistributionFromInboxDetail() {
    await patchState({
      lastError: "",
      lastAction: "Membuka tombol Lihat TKP..."
    });

    await delay(1000);

    const actionElement =
      findElementByText('a, button, [role="button"]', "Lihat TKP", { exact: false }) ||
      Array.from(document.querySelectorAll('a[href*="/distributions/"]')).find(Boolean);

    if (!actionElement) {
      const state = await getState();
      await goToNextInboxItem({
        skipped: state.skipped + 1,
        lastAction: "Tombol Lihat TKP tidak ditemukan, item dilewati."
      });
      return;
    }

    const href = actionElement.getAttribute("href");
    if (href) {
      const absoluteUrl = normalizeUrl(href);
      if (absoluteUrl) {
        await delay(400);
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

    await delay(1000);

    const approveButton = findElementByText('button, a, [role="button"]', "Setuju", { exact: false });
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
          delayMs: 800,
          exact: false
        }
      );

      if (confirmButton) {
        await patchState({
          lastAction: "Menekan tombol Konfirmasi..."
        });
        clickElement(confirmButton);
        await delay(1500);
      }

      await delay(800);
      const remainingApproveButton = findElementByText('button, a, [role="button"]', "Setuju", { exact: false });
      const statusTextAfterClick = readApprovalStatusText();
      const state = await getState();

      if (
        confirmButton ||
        statusTextAfterClick === "setuju" ||
        statusTextAfterClick === "disetujui" ||
        !remainingApproveButton
      ) {
        await goToNextInboxItem({
          approved: state.approved + 1,
          lastAction: "Setuju dan Konfirmasi berhasil diproses."
        });
        return;
      }

      await goToNextInboxItem({
        skipped: state.skipped + 1,
        lastAction: "Konfirmasi tidak muncul, item dilewati."
      });
      return;
    }

    const statusText = readApprovalStatusText();
    const state = await getState();

    if (statusText === "setuju" || statusText === "disetujui") {
      await goToNextInboxItem({
        skipped: state.skipped + 1,
        lastAction: "Item ini sudah disetujui sebelumnya."
      });
      return;
    }

    await goToNextInboxItem({
      skipped: state.skipped + 1,
      lastAction: "Tombol Setuju tidak ditemukan, item dilewati."
    });
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
      renderPanel(state);

      if (!state.running) {
        processing = false;
        return;
      }

      const path = window.location.pathname;

      if (INBOX_LIST_REGEX.test(path)) {
        await scanInboxListPage();
      } else if (INBOX_DETAIL_REGEX.test(path)) {
        await openDistributionFromInboxDetail();
      } else if (DISTRIBUTION_REGEX.test(path)) {
        await clickApproveButton();
      } else {
        await patchState({
          lastError: "",
          lastAction: "Halaman tidak sesuai. Mengarahkan ke inbox..."
        });
        await delay(700);
        window.location.href = "https://darksystem.id/clans/inbox";
      }
    } finally {
      processing = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) {
      return;
    }

    if (message.type === "DS_AUTO_APPROVER_START") {
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

    if (message.type === "DS_AUTO_APPROVER_STOP") {
      stopAutomation("Automation dihentikan dari popup.").then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }

    if (message.type === "DS_AUTO_APPROVER_RESET") {
      setState(DEFAULT_STATE).then(() => {
        renderPanel(DEFAULT_STATE);
        sendResponse({ ok: true });
      });
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) {
      renderPanel({ ...DEFAULT_STATE, ...changes[STORAGE_KEY].newValue });
    }
  });

  getState()
    .then((state) => {
      renderPanel(state);
      if (state.running) {
        scheduleRun(800);
      }
    })
    .catch((error) => {
      console.error("DarkSystem Auto Approver failed to initialize:", error);
    });
})();
