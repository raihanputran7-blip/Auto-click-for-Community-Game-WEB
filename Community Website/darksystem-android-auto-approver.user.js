// ==UserScript==
// @name         DarkSystem Android Auto Approver
// @namespace    https://darksystem.id/
// @version      2.0.0
// @description  Userscript Android untuk scan inbox distribusi DarkSystem lalu klik Setuju dan Konfirmasi otomatis.
// @author       Codex
// @match        https://darksystem.id/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  if (window.__DS_ANDROID_AUTO_APPROVER__) {
    return;
  }
  window.__DS_ANDROID_AUTO_APPROVER__ = true;

  const STORAGE_KEY = "dsAndroidAutoApproverState";
  const PANEL_ID = "ds-android-auto-approver-panel";
  const LAUNCHER_ID = "ds-android-auto-approver-launcher";
  const STYLE_ID = "ds-android-auto-approver-style";
  const DEFAULT_STATE = {
    running: false,
    queue: [],
    index: 0,
    approved: 0,
    skipped: 0,
    delaySeconds: 2,
    hidden: false,
    lastAction: "Idle",
    lastError: "",
    startedAt: null,
    finishedAt: null
  };
  const INBOX_LIST_REGEX = /^\/clans\/inbox\/?$/;
  const INBOX_DETAIL_REGEX = /^\/clans\/inbox\/[0-9a-f-]+\/?$/i;
  const DISTRIBUTION_REGEX = /^\/clans\/[^/]+\/distributions\/[0-9a-f-]+\/?$/i;

  let processing = false;
  let scheduledRun = null;

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function readState() {
    try {
      const rawState = window.localStorage.getItem(STORAGE_KEY);
      return { ...DEFAULT_STATE, ...(rawState ? JSON.parse(rawState) : {}) };
    } catch (error) {
      return { ...DEFAULT_STATE };
    }
  }

  function writeState(nextState) {
    const mergedState = { ...DEFAULT_STATE, ...nextState };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedState));
    renderPanel(mergedState);
    return mergedState;
  }

  function patchState(partialState) {
    return writeState({ ...readState(), ...partialState });
  }

  function ensureUi() {
    if (!document.head.querySelector(`#${STYLE_ID}`)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        #${PANEL_ID} {
          position: fixed;
          right: 12px;
          bottom: 12px;
          width: min(320px, calc(100vw - 24px));
          padding: 14px;
          background: rgba(7, 16, 30, 0.96);
          color: #edf2ff;
          border: 1px solid rgba(54, 95, 163, 0.75);
          border-radius: 16px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38);
          z-index: 2147483647;
          font: 13px/1.45 "Segoe UI", Tahoma, sans-serif;
          backdrop-filter: blur(14px);
        }
        #${PANEL_ID}.is-hidden {
          display: none;
        }
        #${PANEL_ID} .ds-title {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 12px;
        }
        #${PANEL_ID} .ds-grid {
          display: grid;
          gap: 7px;
        }
        #${PANEL_ID} .ds-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        #${PANEL_ID} .ds-label {
          color: #9fb0d4;
        }
        #${PANEL_ID} .ds-value {
          font-weight: 600;
          text-align: right;
        }
        #${PANEL_ID} .ds-field {
          margin-top: 12px;
        }
        #${PANEL_ID} .ds-field label {
          display: block;
          margin-bottom: 6px;
          color: #bfd0f3;
        }
        #${PANEL_ID} .ds-field input {
          width: 100%;
          border: 1px solid #294164;
          border-radius: 10px;
          background: #0f1c30;
          color: #edf2ff;
          padding: 10px 12px;
          font: inherit;
        }
        #${PANEL_ID} .ds-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
        }
        #${PANEL_ID} .ds-actions-secondary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        #${PANEL_ID} button,
        #${LAUNCHER_ID} {
          border: 0;
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
        }
        #${PANEL_ID} .ds-start {
          background: #1e9d58;
          color: #fff;
        }
        #${PANEL_ID} .ds-stop {
          background: #b43333;
          color: #fff;
        }
        #${PANEL_ID} .ds-reset,
        #${PANEL_ID} .ds-hide {
          background: #223754;
          color: #fff;
        }
        #${PANEL_ID} .ds-note {
          margin-top: 10px;
          color: #9fb0d4;
          font-size: 12px;
        }
        #${LAUNCHER_ID} {
          position: fixed;
          right: 12px;
          bottom: 12px;
          z-index: 2147483646;
          min-width: 54px;
          background: #0f1c30;
          color: #edf2ff;
          border: 1px solid rgba(54, 95, 163, 0.75);
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.32);
        }
        #${LAUNCHER_ID}.is-hidden {
          display: none;
        }
      `;
      document.head.appendChild(style);
    }

    let launcher = document.getElementById(LAUNCHER_ID);
    if (!launcher) {
      launcher = document.createElement("button");
      launcher.id = LAUNCHER_ID;
      launcher.type = "button";
      launcher.textContent = "DS";
      launcher.addEventListener("click", () => {
        patchState({ hidden: false });
      });
      document.documentElement.appendChild(launcher);
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("aside");
      panel.id = PANEL_ID;
      panel.innerHTML = `
        <div class="ds-title">DarkSystem Android Auto Approver</div>
        <div class="ds-grid">
          <div class="ds-row"><span class="ds-label">Status</span><span class="ds-value" data-field="status">Berhenti</span></div>
          <div class="ds-row"><span class="ds-label">Queue</span><span class="ds-value" data-field="queue">0</span></div>
          <div class="ds-row"><span class="ds-label">Posisi</span><span class="ds-value" data-field="position">0</span></div>
          <div class="ds-row"><span class="ds-label">Setuju</span><span class="ds-value" data-field="approved">0</span></div>
          <div class="ds-row"><span class="ds-label">Skip</span><span class="ds-value" data-field="skipped">0</span></div>
          <div class="ds-row"><span class="ds-label">Aksi</span><span class="ds-value" data-field="action">Idle</span></div>
        </div>
        <div class="ds-field">
          <label for="ds-auto-approver-delay">Delay antar aksi (detik)</label>
          <input id="ds-auto-approver-delay" data-field="delay" type="number" min="1" max="10" step="1" value="2">
        </div>
        <div class="ds-actions">
          <button type="button" class="ds-start">Mulai</button>
          <button type="button" class="ds-stop">Stop</button>
        </div>
        <div class="ds-actions-secondary">
          <button type="button" class="ds-reset">Reset</button>
          <button type="button" class="ds-hide">Sembunyikan</button>
        </div>
        <div class="ds-note">Buka darksystem.id lalu tekan Mulai. Biarkan tab tetap terbuka sampai proses selesai.</div>
      `;

      panel.querySelector(".ds-start").addEventListener("click", () => {
        startAutomation();
      });
      panel.querySelector(".ds-stop").addEventListener("click", () => {
        stopAutomation("Automation dihentikan manual.");
      });
      panel.querySelector(".ds-reset").addEventListener("click", () => {
        writeState({ ...DEFAULT_STATE, hidden: false });
      });
      panel.querySelector(".ds-hide").addEventListener("click", () => {
        patchState({ hidden: true });
      });
      panel.querySelector('[data-field="delay"]').addEventListener("change", (event) => {
        const value = Math.max(1, Math.min(10, Number(event.target.value) || 2));
        event.target.value = String(value);
        patchState({ delaySeconds: value });
      });

      document.documentElement.appendChild(panel);
    }

    return { panel, launcher };
  }

  function renderPanel(state = readState()) {
    if (!document.body || !document.head) {
      return;
    }

    const { panel, launcher } = ensureUi();
    const currentPosition = state.queue.length ? Math.min(state.index + 1, state.queue.length) : 0;
    panel.querySelector('[data-field="status"]').textContent = state.running ? "Berjalan" : "Berhenti";
    panel.querySelector('[data-field="queue"]').textContent = String(state.queue.length);
    panel.querySelector('[data-field="position"]').textContent = String(currentPosition);
    panel.querySelector('[data-field="approved"]').textContent = String(state.approved);
    panel.querySelector('[data-field="skipped"]').textContent = String(state.skipped);
    panel.querySelector('[data-field="action"]').textContent = state.lastError || state.lastAction || "Idle";
    panel.querySelector('[data-field="delay"]').value = String(state.delaySeconds || 2);
    panel.classList.toggle("is-hidden", Boolean(state.hidden));
    launcher.classList.toggle("is-hidden", !state.hidden);
  }

  function scheduleRun(waitMs = 500) {
    window.clearTimeout(scheduledRun);
    scheduledRun = window.setTimeout(() => {
      processCurrentPage().catch((error) => {
        handleError(error);
      });
    }, waitMs);
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
    const state = readState();
    const nextIndex = state.index + 1;
    const done = nextIndex >= state.queue.length;

    const updatedState = patchState({
      ...extraState,
      index: nextIndex,
      lastError: "",
      lastAction: done ? "Semua inbox selesai diproses." : "Lanjut ke inbox berikutnya."
    });

    if (done) {
      patchState({
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
    const existingState = readState();

    if (existingState.queue.length && existingState.index < existingState.queue.length) {
      patchState({
        lastError: "",
        lastAction: "Melanjutkan queue yang sudah ada..."
      });
      await delay((existingState.delaySeconds || 2) * 1000);
      window.location.href = existingState.queue[existingState.index];
      return;
    }

    patchState({
      lastError: "",
      lastAction: "Mencari semua inbox distribusi..."
    });

    await autoScrollInboxPage();
    const links = getActionableInboxLinks();

    if (!links.length) {
      patchState({
        running: false,
        lastAction: "Tidak ada inbox distribusi yang ditemukan.",
        finishedAt: new Date().toISOString()
      });
      return;
    }

    const nextState = patchState({
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
    patchState({
      lastError: "",
      lastAction: "Membuka tombol Lihat TKP..."
    });

    await delay(1000);

    const actionElement =
      findElementByText('a, button, [role="button"]', "Lihat TKP", { exact: false }) ||
      Array.from(document.querySelectorAll('a[href*="/distributions/"]')).find(Boolean);

    if (!actionElement) {
      const state = readState();
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
    patchState({
      lastError: "",
      lastAction: "Mencari tombol Setuju..."
    });

    await delay(1000);

    const approveButton = findElementByText('button, a, [role="button"]', "Setuju", { exact: false });
    if (approveButton) {
      clickElement(approveButton);
      patchState({
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
        patchState({
          lastAction: "Menekan tombol Konfirmasi..."
        });
        clickElement(confirmButton);
        await delay(1500);
      }

      await delay(800);
      const remainingApproveButton = findElementByText('button, a, [role="button"]', "Setuju", { exact: false });
      const statusTextAfterClick = readApprovalStatusText();
      const state = readState();

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
    const state = readState();

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

  function startAutomation() {
    const delayInput = document.querySelector(`#${PANEL_ID} [data-field="delay"]`);
    const delaySeconds = Math.max(1, Math.min(10, Number(delayInput?.value) || 2));

    writeState({
      ...DEFAULT_STATE,
      running: true,
      hidden: false,
      delaySeconds,
      lastAction: "Automation dimulai dari userscript.",
      startedAt: new Date().toISOString(),
      finishedAt: null
    });

    scheduleRun(400);
  }

  function stopAutomation(reason) {
    patchState({
      running: false,
      lastAction: reason,
      finishedAt: new Date().toISOString()
    });
  }

  function handleError(error) {
    patchState({
      lastError: error.message,
      lastAction: "Terjadi error.",
      running: false,
      finishedAt: new Date().toISOString()
    });
  }

  async function processCurrentPage() {
    if (processing) {
      return;
    }

    processing = true;

    try {
      const state = readState();
      renderPanel(state);

      if (!state.running) {
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
        patchState({
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

  function boot() {
    renderPanel(readState());

    if (readState().running) {
      scheduleRun(800);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
