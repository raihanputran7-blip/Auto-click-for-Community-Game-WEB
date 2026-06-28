// ==UserScript==
// @name         XCLUB CLICKER
// @namespace    https://xcashshop.club/
// @version      2.1.0
// @description  Bot Android untuk auto-approve distribusi klan di XCashShop. Panel muncul di pojok kanan bawah.
// @author       XCLUB
// @match        https://xcashshop.club/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function () {
  "use strict";

  // Guard: cegah double inject
  if (window.__XC_CLICKER_LOADED__) return;
  window.__XC_CLICKER_LOADED__ = true;

  /* =========================================================
   *  CONSTANTS & STATE
   * ========================================================= */
  const STORAGE_KEY      = "xcAndroidClickerState";
  const PANEL_ID         = "xc-panel";
  const LAUNCHER_ID      = "xc-launcher";

  const INBOX_LIST_REGEX  = /^\/clans\/inbox\/?$/;
  const INBOX_DETAIL_REGEX = /^\/clans\/inbox\/[^/]+\/?$/i;
  const DISTRIBUTION_REGEX = /^\/clans\/[^/]+\/distributions\/[^/]+\/?$/i;

  const DEFAULT_STATE = {
    running: false,
    approved: 0,
    skipped: 0,
    lastAction: "Idle",
    lastError: "",
    startedAt: null,
    finishedAt: null,
    processed: []
  };

  let processing   = false;
  let scheduledRun = null;

  /* =========================================================
   *  STATE HELPERS
   * ========================================================= */
  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return Object.assign({}, DEFAULT_STATE, raw ? JSON.parse(raw) : {});
    } catch (_) {
      return Object.assign({}, DEFAULT_STATE);
    }
  }

  function saveState(next) {
    const merged = Object.assign({}, DEFAULT_STATE, next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch (_) {}
    updatePanel(merged);
    return merged;
  }

  function patchState(partial) {
    return saveState(Object.assign({}, readState(), partial));
  }

  /* =========================================================
   *  UI — INJECT PANEL
   * ========================================================= */
  function injectPanel() {
    // Hapus panel lama jika ada
    const oldPanel    = document.getElementById(PANEL_ID);
    const oldLauncher = document.getElementById(LAUNCHER_ID);
    if (oldPanel)    oldPanel.remove();
    if (oldLauncher) oldLauncher.remove();

    /* ── CSS ── */
    const css = `
      #${PANEL_ID} {
        position: fixed !important;
        right: 12px !important;
        bottom: 12px !important;
        z-index: 2147483647 !important;
        width: min(300px, calc(100vw - 24px));
        padding: 14px 16px;
        background: rgba(7,16,30,0.97);
        color: #edf2ff;
        border: 1px solid rgba(54,95,163,0.8);
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.55);
        font: 13px/1.5 -apple-system, "Segoe UI", sans-serif;
        display: block;
      }
      #${PANEL_ID}.xc-hidden { display: none !important; }
      #${PANEL_ID} .xc-title {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: .06em;
        margin-bottom: 10px;
        color: #6ea8fe;
      }
      #${PANEL_ID} .xc-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
        font-size: 12px;
      }
      #${PANEL_ID} .xc-lbl { color: #8899bb; }
      #${PANEL_ID} .xc-val { font-weight: 700; }
      #${PANEL_ID} .xc-note {
        font-size: 11px;
        color: #7a8fad;
        margin: 8px 0;
        word-break: break-word;
      }
      #${PANEL_ID} .xc-btns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 7px;
        margin-top: 10px;
      }
      #${PANEL_ID} button {
        border: 0;
        border-radius: 10px;
        padding: 9px 0;
        font: 700 13px -apple-system, "Segoe UI", sans-serif;
        cursor: pointer;
        transition: opacity .15s;
      }
      #${PANEL_ID} button:active { opacity: .7; }
      #${PANEL_ID} .btn-start  { background: #1a7f4e; color: #fff; }
      #${PANEL_ID} .btn-stop   { background: #a02222; color: #fff; }
      #${PANEL_ID} .btn-reset  { background: #1d3352; color: #b0c4de; }
      #${PANEL_ID} .btn-hide   { background: #1d3352; color: #b0c4de; }

      #${LAUNCHER_ID} {
        position: fixed !important;
        right: 12px !important;
        bottom: 12px !important;
        z-index: 2147483647 !important;
        background: #0f1c30;
        color: #6ea8fe;
        border: 1px solid rgba(54,95,163,0.8);
        border-radius: 12px;
        padding: 10px 14px;
        font: 700 12px -apple-system, "Segoe UI", sans-serif;
        cursor: pointer;
        box-shadow: 0 6px 18px rgba(0,0,0,.45);
        display: none;
      }
      #${LAUNCHER_ID}.xc-visible { display: block !important; }
    `;

    // Inject style — coba GM_addStyle dulu, fallback ke style element
    try {
      GM_addStyle(css);
    } catch (_) {
      const s = document.createElement("style");
      s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
    }

    /* ── Panel HTML ── */
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="xc-title">⚡ XCLUB CLICKER</div>
      <div class="xc-row"><span class="xc-lbl">Status</span><span class="xc-val" id="xc-status">Berhenti</span></div>
      <div class="xc-row"><span class="xc-lbl">Setuju</span><span class="xc-val" id="xc-approved">0</span></div>
      <div class="xc-row"><span class="xc-lbl">Skip</span><span class="xc-val" id="xc-skipped">0</span></div>
      <div class="xc-note" id="xc-note">Tekan Mulai untuk memulai bot.</div>
      <div class="xc-btns">
        <button class="btn-start" id="xc-btn-start">▶ Mulai</button>
        <button class="btn-stop"  id="xc-btn-stop">■ Stop</button>
      </div>
      <div class="xc-btns" style="margin-top:6px;">
        <button class="btn-reset" id="xc-btn-reset">↺ Reset</button>
        <button class="btn-hide"  id="xc-btn-hide">⌃ Sembunyikan</button>
      </div>
    `;

    /* ── Launcher ── */
    const launcher = document.createElement("button");
    launcher.id   = LAUNCHER_ID;
    launcher.textContent = "XC";

    /* ── Append ke body dulu, fallback ke documentElement ── */
    const root = document.body || document.documentElement;
    root.appendChild(panel);
    root.appendChild(launcher);

    /* ── Event listeners ── */
    document.getElementById("xc-btn-start").addEventListener("click", onStart);
    document.getElementById("xc-btn-stop" ).addEventListener("click", onStop);
    document.getElementById("xc-btn-reset").addEventListener("click", onReset);
    document.getElementById("xc-btn-hide" ).addEventListener("click", () => {
      panel.classList.add("xc-hidden");
      launcher.classList.add("xc-visible");
    });
    launcher.addEventListener("click", () => {
      panel.classList.remove("xc-hidden");
      launcher.classList.remove("xc-visible");
    });

    /* ── Render state awal ── */
    updatePanel(readState());
  }

  /* =========================================================
   *  UI — UPDATE PANEL VALUES
   * ========================================================= */
  function updatePanel(state) {
    const el = (id) => document.getElementById(id);
    const statusEl   = el("xc-status");
    const approvedEl = el("xc-approved");
    const skippedEl  = el("xc-skipped");
    const noteEl     = el("xc-note");
    const startBtn   = el("xc-btn-start");
    const stopBtn    = el("xc-btn-stop");

    // Panel belum di-inject, skip
    if (!statusEl) return;

    statusEl.textContent   = state.running ? "🟢 Berjalan" : "🔴 Berhenti";
    approvedEl.textContent = String(state.approved || 0);
    skippedEl.textContent  = String(state.skipped  || 0);
    noteEl.textContent     = state.lastError
      ? "⚠ " + state.lastError
      : state.lastAction || "Idle";

    startBtn.disabled = Boolean(state.running);
    stopBtn.disabled  = !state.running;
    startBtn.style.opacity = state.running ? "0.4" : "1";
    stopBtn.style.opacity  = !state.running ? "0.4" : "1";
  }

  /* =========================================================
   *  BUTTON HANDLERS
   * ========================================================= */
  function onStart() {
    // Jika bukan di halaman inbox, arahkan ke sana dulu
    if (!INBOX_LIST_REGEX.test(window.location.pathname)) {
      saveState(Object.assign({}, DEFAULT_STATE, {
        running: true,
        lastAction: "Mengarahkan ke halaman inbox...",
        startedAt: new Date().toISOString()
      }));
      window.location.href = "https://xcashshop.club/clans/inbox";
      return;
    }

    saveState(Object.assign({}, DEFAULT_STATE, {
      running: true,
      lastAction: "Bot dimulai!",
      startedAt: new Date().toISOString()
    }));
    scheduleRun(600);
  }

  function onStop() {
    window.clearTimeout(scheduledRun);
    patchState({
      running: false,
      lastAction: "Bot dihentikan manual.",
      finishedAt: new Date().toISOString()
    });
  }

  function onReset() {
    window.clearTimeout(scheduledRun);
    processing = false;
    saveState(Object.assign({}, DEFAULT_STATE));
  }

  /* =========================================================
   *  AUTOMATION HELPERS
   * ========================================================= */
  function delay(ms) {
    return new Promise((res) => window.setTimeout(res, ms));
  }

  function normalizeUrl(href) {
    try { return new URL(href, window.location.origin).href; } catch (_) { return ""; }
  }

  function findByText(selector, needle, exact) {
    const needleLow = needle.trim().toLowerCase();
    return Array.from(document.querySelectorAll(selector)).find((el) => {
      const t = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").toLowerCase();
      return exact ? t === needleLow : t.includes(needleLow);
    }) || null;
  }

  function findFirst(selector, needles, exact) {
    for (const n of needles) {
      const el = findByText(selector, n, exact);
      if (el) return el;
    }
    return null;
  }

  function tapElement(el) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    ["mouseover","mousedown","mouseup"].forEach((ev) =>
      el.dispatchEvent(new MouseEvent(ev, { bubbles: true }))
    );
    el.click();
  }

  function isDisabled(el) {
    return Boolean(
      el.disabled ||
      el.getAttribute("aria-disabled") === "true" ||
      el.classList.contains("disabled")
    );
  }

  async function waitFor(selector, needles, tries, delayMs) {
    for (let i = 0; i < tries; i++) {
      const el = findFirst(selector, needles, false);
      if (el) return el;
      await delay(delayMs);
    }
    return null;
  }

  function isInboxPending(anchor) {
    const text = (anchor.innerText || "").toLowerCase();
    if (!text.includes("menunggu") && !text.includes("waiting")) return false;

    const style = window.getComputedStyle(anchor);
    if (parseFloat(style.opacity || "1") < 0.7) return false;

    const icon = anchor.querySelector("svg, img, i, .icon, button");
    if (icon) {
      const ic = window.getComputedStyle(icon);
      if (parseFloat(ic.opacity || "1") < 0.7) return false;
      const m = (ic.color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r < 200) return false;
      }
    }
    return true;
  }

  /* =========================================================
   *  BOT PAGES
   * ========================================================= */
  async function scanInboxListPage() {
    patchState({ lastError: "", lastAction: "Mencari inbox pending..." });

    let anchors = [];
    for (let i = 0; i < 12; i++) {
      anchors = Array.from(document.querySelectorAll('a[href*="/clans/inbox/"]'));
      if (anchors.length > 0) break;
      await delay(300);
    }

    const state = readState();
    const pending = anchors.find((a) => {
      const href = normalizeUrl(a.getAttribute("href"));
      if (state.processed && state.processed.includes(href)) return false;
      return isInboxPending(a);
    });

    if (pending) {
      const href = normalizeUrl(pending.getAttribute("href"));
      patchState({
        processed: [...(state.processed || []), href],
        lastAction: "Membuka inbox: " + (pending.textContent || "").trim().split("\n")[0]
      });
      tapElement(pending);
      await delay(400);
      if (window.location.href !== href) window.location.href = href;
      return;
    }

    // Tidak ada pending — cari tombol Muat Lebih Banyak
    const loadMore = findFirst('button, a, [role="button"]', ["Muat lebih banyak", "Load more"], false);
    if (loadMore && !isDisabled(loadMore)) {
      patchState({ lastAction: "Memuat lebih banyak inbox..." });
      tapElement(loadMore);
      await delay(1500);
      scheduleRun(400);
      return;
    }

    // Semua selesai
    patchState({
      running: false,
      lastAction: "Semua inbox selesai diproses!",
      finishedAt: new Date().toISOString()
    });
    window.setTimeout(() => alert("✅ Sudah selesai! Semua inbox telah diproses."), 300);
  }

  async function openDistributionFromInboxDetail() {
    patchState({ lastError: "", lastAction: "Mencari tombol Lihat TKP..." });

    let btn = null;
    for (let i = 0; i < 12; i++) {
      btn = findByText('a, button, [role="button"]', "Lihat TKP", false) ||
            Array.from(document.querySelectorAll('a[href*="/distributions/"]')).find(Boolean) || null;
      if (btn) break;
      await delay(200);
    }

    if (!btn) {
      patchState({ lastAction: "Lihat TKP tidak ditemukan, kembali..." });
      await delay(500);
      window.location.href = "https://xcashshop.club/clans/inbox";
      return;
    }

    const href = btn.getAttribute("href");
    if (href) {
      const url = normalizeUrl(href);
      if (url) { window.location.href = url; return; }
    }
    tapElement(btn);
  }

  async function clickApproveButton() {
    patchState({ lastError: "", lastAction: "Mencari tombol Setuju..." });

    let approveBtn = null;
    for (let i = 0; i < 12; i++) {
      approveBtn = findByText('button, a, [role="button"]', "Setuju", false);
      if (approveBtn) break;
      await delay(200);
    }

    const state = readState();

    if (approveBtn) {
      tapElement(approveBtn);
      patchState({ lastAction: "Setuju diklik, tunggu Konfirmasi..." });

      const confirmBtn = await waitFor('button, a, [role="button"]', ["Konfirmasi","Confirm","Ya","OK"], 10, 300);
      if (confirmBtn) {
        patchState({ lastAction: "Menekan Konfirmasi..." });
        tapElement(confirmBtn);
        await delay(900);
      }

      patchState({ approved: (state.approved || 0) + 1, lastAction: "Disetujui! Kembali ke inbox..." });
    } else {
      patchState({ skipped: (state.skipped || 0) + 1, lastAction: "Setuju tidak ditemukan, skip..." });
    }

    await delay(500);
    window.location.href = "https://xcashshop.club/clans/inbox";
  }

  /* =========================================================
   *  SCHEDULER
   * ========================================================= */
  function scheduleRun(ms) {
    window.clearTimeout(scheduledRun);
    scheduledRun = window.setTimeout(() => {
      runBot().catch((err) => {
        patchState({ lastError: err.message, running: false, lastAction: "Error terjadi." });
      });
    }, ms);
  }

  async function runBot() {
    if (processing) return;
    processing = true;
    try {
      const state = readState();
      if (!state.running) { processing = false; return; }

      const path = window.location.pathname;
      if (INBOX_LIST_REGEX.test(path)) {
        await scanInboxListPage();
      } else if (INBOX_DETAIL_REGEX.test(path)) {
        await openDistributionFromInboxDetail();
      } else if (DISTRIBUTION_REGEX.test(path)) {
        await clickApproveButton();
      } else {
        patchState({ lastError: "", lastAction: "Halaman tidak sesuai, redirect ke inbox..." });
        await delay(700);
        window.location.href = "https://xcashshop.club/clans/inbox";
      }
    } finally {
      processing = false;
    }
  }

  /* =========================================================
   *  BOOT
   * ========================================================= */
  function boot() {
    console.log("[XCLUB CLICKER] Booted on", window.location.href);

    injectPanel();

    // Lanjutkan jika state masih running (misal setelah navigasi halaman)
    const state = readState();
    if (state.running) {
      console.log("[XCLUB CLICKER] State running=true, resuming...");
      scheduleRun(800);
    }

    // SPA path change watcher
    let lastPath = window.location.pathname;
    window.setInterval(() => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        console.log("[XCLUB CLICKER] Path changed:", lastPath);
        updatePanel(readState());
        const s = readState();
        if (s.running) scheduleRun(500);
      }
    }, 800);
  }

  // Tunggu body siap
  if (document.body) {
    boot();
  } else {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }

})();
