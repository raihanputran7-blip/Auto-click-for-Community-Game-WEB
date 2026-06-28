// ==UserScript==
// @name         XCLUB CLICKER
// @namespace    https://xcashshop.club/
// @version      2.2.3
// @description  Bot Android untuk auto-approve distribusi klan di XCashShop. Panel muncul di pojok kanan bawah.
// @author       XCLUB
// @match        https://xcashshop.club/*
// @grant        GM_info
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  /* =========================================================
   *  Guard - cegah double inject
   * ========================================================= */
  if (window.__XC_CLICKER_LOADED__) return;
  window.__XC_CLICKER_LOADED__ = true;

  /* =========================================================
   *  CONSTANTS
   * ========================================================= */
  const STORAGE_KEY = "xcAndroidClickerState";
  const PANEL_ID    = "xc-panel-v2";

  const INBOX_LIST_REGEX   = /^\/clans\/inbox\/?$/;
  const INBOX_DETAIL_REGEX = /^\/clans\/inbox\/[^/]+\/?$/i;
  const DISTRIBUTION_REGEX = /^\/clans\/[^/]+\/distributions\/[^/]+\/?$/i;

  const DEFAULT_STATE = {
    running:    false,
    approved:   0,
    skipped:    0,
    lastAction: "Idle",
    lastError:  "",
    startedAt:  null,
    finishedAt: null,
    processed:  []
  };

  let processing   = false;
  let scheduledRun = null;

  /* =========================================================
   *  STATE HELPERS (localStorage)
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
    refreshUI(merged);
    return merged;
  }

  function patchState(partial) {
    return saveState(Object.assign({}, readState(), partial));
  }

  /* =========================================================
   *  UI — BUILD PANEL (semua inline style, tanpa CSS class)
   * ========================================================= */
  function buildPanel() {
    // Hapus panel lama jika ada
    const old = document.getElementById(PANEL_ID);
    if (old) old.remove();

    /* ── wrapper utama ── */
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    Object.assign(panel.style, {
      position:        "fixed",
      right:           "12px",
      bottom:          "12px",
      zIndex:          "2147483647",
      width:           "280px",
      maxWidth:        "calc(100vw - 24px)",
      padding:         "14px 16px",
      background:      "rgba(7,16,30,0.96)",
      color:           "#edf2ff",
      border:          "1px solid rgba(54,95,163,0.8)",
      borderRadius:    "16px",
      boxShadow:       "0 12px 40px rgba(0,0,0,0.6)",
      fontFamily:      "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize:        "13px",
      lineHeight:      "1.5",
      boxSizing:       "border-box",
      display:         "block"
    });

    /* ── judul ── */
    const title = document.createElement("div");
    title.textContent = "⚡ XCLUB CLICKER";
    Object.assign(title.style, {
      fontWeight:    "800",
      fontSize:      "13px",
      color:         "#6ea8fe",
      marginBottom:  "10px",
      letterSpacing: ".05em"
    });

    /* ── helper buat baris info ── */
    function makeRow(label, id) {
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", justifyContent: "space-between", marginBottom: "5px" });

      const lbl = document.createElement("span");
      lbl.textContent = label;
      lbl.style.color = "#8899bb";

      const val = document.createElement("span");
      val.id = PANEL_ID + "-" + id;
      val.style.fontWeight = "700";

      row.appendChild(lbl);
      row.appendChild(val);
      return row;
    }

    const rowStatus   = makeRow("Status",   "status");
    const rowApproved = makeRow("Setuju",   "approved");
    const rowSkipped  = makeRow("Skip",     "skipped");

    /* ── note / log aksi ── */
    const note = document.createElement("div");
    note.id = PANEL_ID + "-note";
    Object.assign(note.style, {
      fontSize:    "11px",
      color:       "#7a8fad",
      margin:      "8px 0",
      wordBreak:   "break-word",
      minHeight:   "16px"
    });
    note.textContent = "Tekan Mulai untuk memulai bot.";

    /* ── helper buat tombol ── */
    function makeBtn(text, bg, id) {
      const btn = document.createElement("button");
      btn.id          = PANEL_ID + "-" + id;
      btn.textContent = text;
      btn.type        = "button";
      Object.assign(btn.style, {
        flex:         "1",
        border:       "0",
        borderRadius: "10px",
        padding:      "9px 4px",
        background:   bg,
        color:        "#fff",
        fontWeight:   "700",
        fontSize:     "13px",
        cursor:       "pointer",
        fontFamily:   "inherit",
        touchAction:  "manipulation"
      });
      return btn;
    }

    const btnStart = makeBtn("▶ Mulai",       "#1a7f4e", "start");
    const btnStop  = makeBtn("■ Stop",        "#a02222", "stop");
    const btnReset = makeBtn("↺ Reset",       "#1d3352", "reset");
    const btnHide  = makeBtn("⌃ Sembunyikan", "#1d3352", "hide");

    /* ── baris tombol ── */
    function makeRow2(...btns) {
      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", gap: "7px", marginTop: "8px" });
      btns.forEach(b => row.appendChild(b));
      return row;
    }

    const btnRow1 = makeRow2(btnStart, btnStop);
    const btnRow2 = makeRow2(btnReset, btnHide);

    /* ── susun panel ── */
    panel.appendChild(title);
    panel.appendChild(rowStatus);
    panel.appendChild(rowApproved);
    panel.appendChild(rowSkipped);
    panel.appendChild(note);
    panel.appendChild(btnRow1);
    panel.appendChild(btnRow2);

    /* ── tombol launcher (muncul saat panel disembunyikan) ── */
    const launcher = document.createElement("button");
    launcher.id = PANEL_ID + "-launcher";
    launcher.textContent = "XC ⚡";
    launcher.type = "button";
    Object.assign(launcher.style, {
      position:     "fixed",
      right:        "12px",
      bottom:       "12px",
      zIndex:       "2147483647",
      background:   "#0f1c30",
      color:        "#6ea8fe",
      border:       "1px solid rgba(54,95,163,0.8)",
      borderRadius: "12px",
      padding:      "10px 14px",
      fontWeight:   "700",
      fontSize:     "13px",
      cursor:       "pointer",
      display:      "none",
      boxShadow:    "0 6px 18px rgba(0,0,0,.5)",
      fontFamily:   "inherit",
      touchAction:  "manipulation"
    });

    /* ── event listeners ── */
    btnStart.addEventListener("click",   onStart);
    btnStop.addEventListener("click",    onStop);
    btnReset.addEventListener("click",   onReset);
    btnHide.addEventListener("click", () => {
      panel.style.display    = "none";
      launcher.style.display = "block";
    });
    launcher.addEventListener("click", () => {
      panel.style.display    = "block";
      launcher.style.display = "none";
    });

    /* ── append ke html ── */
    const root = document.documentElement;
    root.appendChild(panel);
    root.appendChild(launcher);

    /* ── render state awal ── */
    refreshUI(readState());

    console.log("[XCLUB] Panel injected OK");
  }

  /* =========================================================
   *  UI — REFRESH VALUES
   * ========================================================= */
  function refreshUI(state) {
    const $ = (suffix) => document.getElementById(PANEL_ID + "-" + suffix);

    const statusEl   = $("status");
    const approvedEl = $("approved");
    const skippedEl  = $("skipped");
    const noteEl     = $("note");
    const startBtn   = $("start");
    const stopBtn    = $("stop");

    if (!statusEl) return; // panel belum ada

    statusEl.textContent   = state.running ? "🟢 Berjalan" : "🔴 Berhenti";
    approvedEl.textContent = String(state.approved || 0);
    skippedEl.textContent  = String(state.skipped  || 0);
    noteEl.textContent     = state.lastError
      ? "⚠ " + state.lastError
      : (state.lastAction || "Idle");

    startBtn.disabled       = Boolean(state.running);
    startBtn.style.opacity  = state.running ? "0.4" : "1";
    stopBtn.disabled        = !state.running;
    stopBtn.style.opacity   = !state.running ? "0.4" : "1";
  }

  /* =========================================================
   *  BUTTON HANDLERS
   * ========================================================= */
  function onStart() {
    if (!INBOX_LIST_REGEX.test(window.location.pathname)) {
      saveState(Object.assign({}, DEFAULT_STATE, {
        running:    true,
        lastAction: "Mengarahkan ke halaman inbox...",
        startedAt:  new Date().toISOString()
      }));
      window.location.href = "https://xcashshop.club/clans/inbox";
      return;
    }
    saveState(Object.assign({}, DEFAULT_STATE, {
      running:    true,
      lastAction: "Bot dimulai!",
      startedAt:  new Date().toISOString()
    }));
    scheduleRun(600);
  }

  function onStop() {
    window.clearTimeout(scheduledRun);
    patchState({
      running:    false,
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
    const low = needle.trim().toLowerCase();
    return Array.from(document.querySelectorAll(selector)).find((el) => {
      const t = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").toLowerCase();
      return exact ? t === low : t.includes(low);
    }) || null;
  }

  function findFirst(selector, needles) {
    for (const n of needles) {
      const el = findByText(selector, n, false);
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

  async function waitFor(selector, needles, tries, ms) {
    for (let i = 0; i < tries; i++) {
      const el = findFirst(selector, needles);
      if (el) return el;
      await delay(ms);
    }
    return null;
  }

  function isInboxPending(anchor) {
    const text = (anchor.innerText || "").toLowerCase();
    if (!text.includes("menunggu") && !text.includes("waiting")) return false;
    const st = window.getComputedStyle(anchor);
    if (parseFloat(st.opacity || "1") < 0.7) return false;
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
    const state   = readState();
    const pending = anchors.find((a) => {
      const href = normalizeUrl(a.getAttribute("href"));
      if (state.processed && state.processed.includes(href)) return false;
      return isInboxPending(a);
    });

    if (pending) {
      const href = normalizeUrl(pending.getAttribute("href"));
      patchState({
        processed: [...(state.processed || []), href],
        lastAction: "Membuka: " + (pending.textContent || "").trim().split("\n")[0]
      });
      tapElement(pending);
      await delay(400);
      if (window.location.href !== href) window.location.href = href;
      return;
    }

    const loadMore = findFirst('button, a, [role="button"]', ["Muat lebih banyak", "Load more"]);
    if (loadMore && !isDisabled(loadMore)) {
      patchState({ lastAction: "Memuat lebih banyak inbox..." });
      tapElement(loadMore);
      await delay(1500);
      scheduleRun(400);
      return;
    }

    patchState({ running: false, lastAction: "Semua inbox selesai!", finishedAt: new Date().toISOString() });
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
    if (href) { const url = normalizeUrl(href); if (url) { window.location.href = url; return; } }
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
      if (confirmBtn) { patchState({ lastAction: "Menekan Konfirmasi..." }); tapElement(confirmBtn); await delay(900); }
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
      if (INBOX_LIST_REGEX.test(path))        await scanInboxListPage();
      else if (INBOX_DETAIL_REGEX.test(path)) await openDistributionFromInboxDetail();
      else if (DISTRIBUTION_REGEX.test(path)) await clickApproveButton();
      else {
        patchState({ lastError: "", lastAction: "Redirect ke inbox..." });
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
    buildPanel();

    // Lanjutkan jika state masih running (setelah navigasi halaman)
    const state = readState();
    if (state.running) {
      console.log("[XCLUB] Resuming bot...");
      scheduleRun(800);
    }

    // SPA path watcher and UI restorer
    let lastPath = window.location.pathname;
    window.setInterval(() => {
      // Jika SPA menghapus panel kita saat pindah halaman, inject ulang
      if (!document.getElementById(PANEL_ID)) {
        buildPanel();
      }

      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        console.log("[XCLUB] Path changed:", lastPath);
        refreshUI(readState());
        if (readState().running) scheduleRun(500);
      }
    }, 1000);
  }

  // Jalankan langsung karena @run-at document-end / document-idle
  boot();

})();
