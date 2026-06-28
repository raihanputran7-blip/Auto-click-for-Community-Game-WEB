const STORAGE_KEY = "xcAutoApproverState";
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
  finishedAt: null,
  processed: []
};

const statusText = document.getElementById("statusText");
const approvedCount = document.getElementById("approvedCount");
const skippedCount = document.getElementById("skippedCount");
const hintText = document.getElementById("hintText");
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const resetButton = document.getElementById("resetButton");

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

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function render(state) {
  statusText.textContent = state.running ? "Sedang berjalan" : "Berhenti";
  approvedCount.textContent = String(state.approved);
  skippedCount.textContent = String(state.skipped);

  if (state.lastError) {
    hintText.textContent = `Terakhir: ${state.lastError}`;
  } else {
    hintText.textContent = state.lastAction || "Idle";
  }

  startButton.disabled = state.running;
  stopButton.disabled = !state.running;
}

async function notifyActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    // Tab aktif mungkin belum menjalankan content script; tidak masalah.
  }
}

async function startAutomation() {
  const nextState = {
    ...DEFAULT_STATE,
    running: true,
    lastAction: "Menyiapkan automation...",
    startedAt: new Date().toISOString(),
    finishedAt: null
  };

  await setState(nextState);
  render(nextState);

  const tab = await getActiveTab();
  const inboxUrl = "https://xcashshop.club/clans/inbox";

  if (!tab?.id) {
    hintText.textContent = "Tab aktif tidak ditemukan.";
    return;
  }

  if (!tab.url || !tab.url.startsWith("https://xcashshop.club/")) {
    await chrome.tabs.update(tab.id, { url: inboxUrl });
    return;
  }

  await notifyActiveTab({ type: "XC_CLICKER_START" });
}

async function stopAutomation() {
  const state = await getState();
  const nextState = {
    ...state,
    running: false,
    lastAction: "Automation dihentikan manual.",
    finishedAt: new Date().toISOString()
  };

  await setState(nextState);
  render(nextState);
  await notifyActiveTab({ type: "XC_CLICKER_STOP" });
}

async function resetAutomation() {
  await setState(DEFAULT_STATE);
  render(DEFAULT_STATE);
  await notifyActiveTab({ type: "XC_CLICKER_RESET" });
}

startButton.addEventListener("click", () => {
  startAutomation().catch((error) => {
    hintText.textContent = `Gagal memulai: ${error.message}`;
  });
});

stopButton.addEventListener("click", () => {
  stopAutomation().catch((error) => {
    hintText.textContent = `Gagal menghentikan: ${error.message}`;
  });
});

resetButton.addEventListener("click", () => {
  resetAutomation().catch((error) => {
    hintText.textContent = `Gagal reset: ${error.message}`;
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STORAGE_KEY]) {
    render({ ...DEFAULT_STATE, ...changes[STORAGE_KEY].newValue });
  }
});

getState()
  .then(render)
  .catch((error) => {
    hintText.textContent = `Gagal membaca state: ${error.message}`;
  });
