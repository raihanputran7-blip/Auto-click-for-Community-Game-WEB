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

const statusText = document.getElementById("statusText");
const queueCount = document.getElementById("queueCount");
const currentIndex = document.getElementById("currentIndex");
const approvedCount = document.getElementById("approvedCount");
const skippedCount = document.getElementById("skippedCount");
const hintText = document.getElementById("hintText");
const delayInput = document.getElementById("delaySeconds");
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
  const activeNumber = state.queue.length ? Math.min(state.index + 1, state.queue.length) : 0;

  statusText.textContent = state.running ? "Sedang berjalan" : "Berhenti";
  queueCount.textContent = String(state.queue.length);
  currentIndex.textContent = String(activeNumber);
  approvedCount.textContent = String(state.approved);
  skippedCount.textContent = String(state.skipped);
  delayInput.value = String(state.delaySeconds || 2);

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
  const delaySeconds = Math.max(1, Math.min(10, Number(delayInput.value) || 2));
  const nextState = {
    ...DEFAULT_STATE,
    running: true,
    delaySeconds,
    lastAction: "Menyiapkan automation...",
    startedAt: new Date().toISOString(),
    finishedAt: null
  };

  await setState(nextState);
  render(nextState);

  const tab = await getActiveTab();
  const inboxUrl = "https://darksystem.id/clans/inbox";

  if (!tab?.id) {
    hintText.textContent = "Tab aktif tidak ditemukan.";
    return;
  }

  if (!tab.url || !tab.url.startsWith("https://darksystem.id/")) {
    await chrome.tabs.update(tab.id, { url: inboxUrl });
    return;
  }

  await notifyActiveTab({ type: "DS_AUTO_APPROVER_START" });
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
  await notifyActiveTab({ type: "DS_AUTO_APPROVER_STOP" });
}

async function resetAutomation() {
  await setState(DEFAULT_STATE);
  render(DEFAULT_STATE);
  await notifyActiveTab({ type: "DS_AUTO_APPROVER_RESET" });
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
