const els = {
  method: document.getElementById("method"),
  time: document.getElementById("time"),
  phase: document.getElementById("phase"),
  ring: document.getElementById("ring"),
  primary: document.getElementById("primary"),
  secondary: document.getElementById("secondary"),
  flowComplete: document.getElementById("flow-complete"),
  status: document.getElementById("status"),
  taskList: document.getElementById("task-list"),
  taskForm: document.getElementById("task-form"),
  taskTitle: document.getElementById("task-title"),
  taskEstimate: document.getElementById("task-estimate"),
  history: document.getElementById("history"),
  refresh: document.getElementById("refresh"),
  themeToggle: document.getElementById("theme-toggle"),
};

let appState = {
  state: null,
  settings: null,
  methods: {},
};

let ticker = null;

init();

function init() {
  fetchState();
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "stateUpdated") {
      appState = {
        state: msg.state,
        settings: msg.settings,
        methods: msg.methods,
      };
      render();
    }
  });

  applyThemeFromSettings();

  if (els.method) {
    els.method.addEventListener("change", async () => {
      await chrome.runtime.sendMessage({
        type: "setMethod",
        methodKey: els.method.value,
      });
    });
  }

  els.primary?.addEventListener("click", handlePrimary);
  els.secondary?.addEventListener("click", () =>
    chrome.runtime.sendMessage({ type: "resetTimer" })
  );
  els.flowComplete?.addEventListener("click", () =>
    chrome.runtime.sendMessage({ type: "completeFlowtime" })
  );
  els.refresh?.addEventListener("click", fetchState);
  els.themeToggle?.addEventListener("click", toggleTheme);

  els.taskForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = els.taskTitle.value.trim();
    if (!title) return;
    const estimate = Number(els.taskEstimate.value) || 1;
    await chrome.runtime.sendMessage({ type: "addTask", title, estimate });
    els.taskTitle.value = "";
    els.taskEstimate.value = 1;
    fetchState();
  });
}

async function fetchState() {
  const res = await chrome.runtime.sendMessage({ type: "getState" });
  appState = { state: res.state, settings: res.settings, methods: res.methods };
  applyThemeFromSettings();
  render(res.remaining);
}

function render(initialRemaining) {
  const { state, settings, methods } = appState;
  if (!state || !settings) return;
  renderMethods(methods, state.timer.methodKey);
  renderTimer(state, methods, initialRemaining);
  renderTasks(state.tasks, state.timer.activeTaskId);
  renderHistory(state.history, methods);
  updateThemeToggle();
}

function renderMethods(methods, selected) {
  if (!els.method) return;
  els.method.innerHTML = "";
  Object.values(methods).forEach((method) => {
    const opt = document.createElement("option");
    opt.value = method.key;
    opt.textContent = method.label;
    if (method.key === selected) opt.selected = true;
    els.method.append(opt);
  });
}

function renderTimer(state, methods, initialRemaining) {
  const timer = state.timer;
  const method = methods[timer.methodKey] || methods.pomodoro;
  const remainingMs = computeRemaining(timer, method, initialRemaining);
  const duration = computeDuration(timer, method);
  const flowReference = method.flexible ? flowReferenceMs(method) : duration;
  const progress = method.flexible
    ? Math.max(0, Math.min(1, remainingMs / flowReference))
    : duration > 0
    ? Math.max(0, Math.min(1, remainingMs / duration))
    : 0;
  els.ring.style.setProperty("--progress", `${progress * 100}%`);

  els.time.textContent = formatTime(remainingMs);
  els.phase.textContent = phaseLabel(timer.phase, method);
  els.status.textContent = buildStatus(timer, method);

  const isRunning = timer.isRunning;
  const shouldResume =
    !isRunning && (timer.remainingMs > 0 || timer.phase !== "work");
  els.primary.innerHTML = isRunning
    ? '<img src="../assets/pause.svg" width="16" height="16"> Pause'
    : shouldResume
    ? '<img src="../assets/play.svg" width="16" height="16"> Resume'
    : '<img src="../assets/play.svg" width="16" height="16"> Start';
  els.secondary.innerHTML = '<img src="../assets/reset.svg" width="16" height="16"> Reset';
  els.flowComplete.classList.toggle(
    "hidden",
    timer.methodKey !== "flowtime" || !isRunning
  );

  if (ticker) clearInterval(ticker);
  ticker = setInterval(() => {
    const { state, methods } = appState;
    if (!state?.timer) return;
    const method = methods[state.timer.methodKey] || methods.pomodoro;
    const remaining = computeRemaining(state.timer, method);
    const duration = computeDuration(state.timer, method);
    const flowReference = method.flexible ? flowReferenceMs(method) : duration;
    const pct = method.flexible
      ? Math.max(0, Math.min(1, remaining / flowReference))
      : duration > 0
      ? Math.max(0, Math.min(1, remaining / duration))
      : 0;
    els.ring.style.setProperty("--progress", `${pct * 100}%`);
    els.time.textContent = formatTime(remaining);
  }, 1000);
}

function handlePrimary() {
  const { state } = appState;
  if (!state) return;
  if (state.timer.isRunning) {
    chrome.runtime.sendMessage({ type: "pauseTimer" });
    return;
  }

  if (state.timer.remainingMs > 0 || state.timer.phase !== "work") {
    chrome.runtime.sendMessage({ type: "resumeTimer" });
    return;
  }

  const methodKey = els.method.value;
  chrome.runtime.sendMessage({
    type: "startTimer",
    methodKey,
    phase: state.timer.phase,
  });
}

function computeDuration(timer, method) {
  if (method.flexible) {
    const elapsed = timer.isRunning
      ? Math.max(0, Date.now() - (timer.startTime || Date.now()))
      : timer.remainingMs || 0;
    return Math.max(1, elapsed);
  }
  if (timer.endTime && timer.startTime) return timer.endTime - timer.startTime;
  if (timer.remainingMs) return timer.remainingMs;
  if (timer.phase === "work") return method.workMinutes * 60000;
  if (timer.phase === "longBreak") return method.longBreakMinutes * 60000;
  return method.shortBreakMinutes * 60000;
}

function computeRemaining(timer, method, overrideRemaining) {
  if (typeof overrideRemaining === "number") return overrideRemaining;
  if (method.flexible) {
    if (!timer.isRunning) return timer.remainingMs || 0;
    return Math.max(0, Date.now() - (timer.startTime || Date.now()));
  }
  if (timer.isRunning && timer.endTime) {
    return Math.max(0, timer.endTime - Date.now());
  }
  if (!timer.isRunning && timer.remainingMs) return timer.remainingMs;
  return Math.max(
    0,
    timer.endTime ? timer.endTime - Date.now() : computeDuration(timer, method)
  );
}

function phaseLabel(phase, method) {
  if (method.flexible && phase === "flow") return "Flowtime";
  if (phase === "work") return "Focus";
  if (phase === "longBreak") return "Long Break";
  return "Break";
}

function buildStatus(timer, method) {
  if (method.flexible) {
    return timer.isRunning
      ? "Flowtime running - end when you feel ready."
      : "Start flow and end to calculate break.";
  }
  if (timer.phase === "work") return "Focus block in progress";
  return "Recharge break";
}

function renderTasks(tasks = [], activeTaskId) {
  if (!tasks.length) {
    els.taskList.textContent = "No tasks yet";
    els.taskList.classList.add("empty-state");
    return;
  }
  els.taskList.innerHTML = "";
  els.taskList.classList.remove("empty-state");
  tasks.forEach((task) => {
    const row = document.createElement("div");
    row.className = "task";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => {
      chrome.runtime.sendMessage({
        type: "updateTask",
        id: task.id,
        updates: { done: !task.done },
      });
    });

    const text = document.createElement("div");
    const title = document.createElement("p");
    title.className = "task-title";
    title.textContent = task.title;
    if (task.done) title.style.textDecoration = "line-through";
    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.textContent = `${task.completedSessions ?? 0}/${
      task.estimate ?? 1
    } sessions`;
    text.append(title, meta);

    const actions = document.createElement("div");
    const focusBtn = document.createElement("button");
    focusBtn.className = "btn tiny";
    focusBtn.textContent = task.id === activeTaskId ? "Active" : "Focus";
    if (task.id === activeTaskId) focusBtn.classList.add("primary");
    focusBtn.addEventListener("click", () =>
      chrome.runtime.sendMessage({ type: "setActiveTask", id: task.id })
    );

    const delBtn = document.createElement("button");
    delBtn.className = "btn tiny ghost";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () =>
      chrome.runtime.sendMessage({ type: "deleteTask", id: task.id })
    );
    const checkIcon = document.createElement("img");
    checkIcon.src = "../assets/check.svg";
    checkIcon.width = 14;
    checkIcon.height = 14;
    checkIcon.style.marginRight = "6px";
    checkIcon.style.opacity = task.done ? "1" : "0.2";
    const statusWrap = document.createElement("span");
    statusWrap.style.display = "inline-flex";
    statusWrap.style.alignItems = "center";
    statusWrap.append(checkIcon, document.createTextNode(task.done ? "Done" : "In Progress"));

    actions.append(statusWrap, focusBtn, delBtn);

    row.append(checkbox, text, actions);
    els.taskList.append(row);
  });
}

function renderHistory(history = [], methods = {}) {
  if (!history.length) {
    els.history.textContent = "No history yet";
    els.history.classList.add("empty-state");
    return;
  }
  els.history.classList.remove("empty-state");
  els.history.innerHTML = "";
  history.slice(0, 6).forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const label = document.createElement("div");
    label.innerHTML = `<strong>${
      methods[entry.methodKey]?.label || entry.methodKey
    }</strong> | ${capitalize(entry.phase)}`;
    const meta = document.createElement("div");
    meta.className = "meta";
    const date = new Date(entry.endedAt || entry.createdAt || Date.now());
    meta.textContent = `${formatDuration(
      entry.durationMs
    )} | ${date.toLocaleTimeString()}`;
    item.append(label, meta);
    els.history.append(item);
  });
}

function flowReferenceMs(method) {
  const suggested = Number(method.suggestedBreakMinutes);
  const minimumMinutes = 30;
  if (Number.isFinite(suggested) && suggested > 0) {
    return Math.max(suggested * 60000, minimumMinutes * 60000);
  }
  return minimumMinutes * 60000;
}

function applyThemeFromSettings() {
  const mode = appState.settings?.theme || "system";
  const resolved =
    mode === "system"
      ? window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : mode;
  document.documentElement.dataset.theme = resolved;
}

async function toggleTheme() {
  const current = appState.settings?.theme || "system";
  const next = current === "light" ? "dark" : "light";
  await chrome.runtime.sendMessage({
    type: "updateSettings",
    settings: { theme: next },
  });
  appState.settings = { ...(appState.settings || {}), theme: next };
  applyThemeFromSettings();
  updateThemeToggle();
}

function updateThemeToggle() {
  if (!els.themeToggle) return;
  const mode = appState.settings?.theme || "system";
  const resolved =
    mode === "system"
      ? window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : mode;
  els.themeToggle.textContent = resolved === "light" ? "Dark" : "Light";
  els.themeToggle.setAttribute(
    "title",
    `Switch to ${resolved === "light" ? "dark" : "light"} mode`
  );
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function formatDuration(ms = 0) {
  if (!ms) return "0m";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return `${Math.max(1, Math.round(ms / 1000))}s`;
  return `${minutes}m`;
}

function capitalize(text = "") {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
