const ROWS = 6;
const COLS = 6;
const SIZE = ROWS * COLS;
const SHIFT = 3;
const MOVE_COLS = [0, 2, 4];
const PAD = "★";

const groupTexts = [
  "小小交通员收到一封重要密信，请按约定密钥安全传递给同伴完成今天任务。",
  "保护密信就是保护重要信息，传递途中不能随意透露密钥内容守护信息安全。",
  "遇到神秘密文不要乱猜，要认真观察规则，再一步一步破解争做小小卫士。",
  "只有掌握正确密钥，才能把看不懂的密文还原成真正明文发现算法诀窍。",
  "加密时按照规则移动文字，解密时要把每个步骤反过来操作保证准确无误。",
  "重要信息要先加密后传送，收到以后再根据密钥认真解密保护传递安全。",
  "同伴合作完成中文密信任务，认真记录密钥，并互相检查结果一起成功解密。",
  "铭记隐秘英雄守护信息安全，今天我们也要学会谨慎保密争做数字公民。"
];

const els = {
  grid: document.querySelector("#cipherGrid"),
  resultGrid: document.querySelector("#resultGrid"),
  title: document.querySelector("#gridTitle"),
  state: document.querySelector("#statePill"),
  groupSelect: document.querySelector("#groupSelect"),
  input: document.querySelector("#plainInput"),
  charCount: document.querySelector("#charCount"),
  cipherOutput: document.querySelector("#cipherOutput"),
  feedback: document.querySelector("#feedback"),
  placeBtn: document.querySelector("#placeBtn"),
  encryptBtn: document.querySelector("#encryptBtn"),
  decryptBtn: document.querySelector("#decryptBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  fullscreenBtn: document.querySelector("#fullscreenBtn"),
  keyCard: document.querySelector("#keyCard"),
  toggleKeyBtn: document.querySelector("#toggleKeyBtn"),
  safetyDialog: document.querySelector("#safetyDialog"),
  confirmSafetyBtn: document.querySelector("#confirmSafetyBtn"),
  summaryDialog: document.querySelector("#summaryDialog"),
  closeSummaryBtn: document.querySelector("#closeSummaryBtn")
};

const state = {
  grid: Array(SIZE).fill(""),
  plainGrid: Array(SIZE).fill(""),
  resultGrid: Array(SIZE).fill(""),
  originalText: "",
  cipherText: "",
  mode: "empty",
  safetyConfirmed: false,
  busy: false
};

function charsOf(text) {
  return Array.from(text.trim());
}

function toMatrix(flat) {
  return Array.from({ length: ROWS }, (_, row) => flat.slice(row * COLS, row * COLS + COLS));
}

function toFlat(matrix) {
  return matrix.flat();
}

function padToGrid(chars) {
  return [...chars, ...Array(Math.max(0, SIZE - chars.length)).fill(PAD)];
}

function cleanPlainText(chars) {
  return chars.join("").replace(new RegExp(`${PAD}+$`), "");
}

function shiftColumns(flat, direction) {
  const matrix = toMatrix(flat);
  const next = matrix.map((row) => [...row]);
  const step = direction === "down" ? SHIFT : -SHIFT;

  MOVE_COLS.forEach((col) => {
    for (let row = 0; row < ROWS; row += 1) {
      const targetRow = (row + step + ROWS) % ROWS;
      next[targetRow][col] = matrix[row][col];
    }
  });

  return toFlat(next);
}

function shiftOneColumn(flat, col, direction) {
  const matrix = toMatrix(flat);
  const next = matrix.map((row) => [...row]);
  const step = direction === "down" ? SHIFT : -SHIFT;

  for (let row = 0; row < ROWS; row += 1) {
    const targetRow = (row + step + ROWS) % ROWS;
    next[targetRow][col] = matrix[row][col];
  }

  return toFlat(next);
}

function renderGrid(options = {}) {
  const { fillIndex = -1, cipher = state.mode === "cipher", highlight = false, movingCol = null, moveDirection = "" } = options;
  els.grid.innerHTML = "";

  for (let index = 0; index < SIZE; index += 1) {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.pos = `${row + 1}-${col + 1}`;
    cell.textContent = state.grid[index] || "";

    if (!state.grid[index]) cell.classList.add("empty");
    if (MOVE_COLS.includes(col)) cell.classList.add("odd-col");
    if (cipher) cell.classList.add("cipher");
    if (highlight && MOVE_COLS.includes(col)) cell.classList.add("highlight");
    if (fillIndex === index) cell.classList.add("fill-pop");
    if (movingCol === col) {
      const wrapsDown = moveDirection === "down" && row >= ROWS - SHIFT;
      const wrapsUp = moveDirection === "up" && row < SHIFT;
      cell.classList.add(moveDirection === "up" ? "move-up" : "move-down", "moving-col", "highlight");
      if (wrapsDown) cell.classList.add("wrap-down");
      if (wrapsUp) cell.classList.add("wrap-up");
    }

    els.grid.appendChild(cell);
  }
}

function renderResultGrid(options = {}) {
  if (!els.resultGrid) return;

  const { highlight = false, cipher = false, movingCol = null, moveDirection = "" } = options;
  els.resultGrid.innerHTML = "";

  for (let index = 0; index < SIZE; index += 1) {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    const cell = document.createElement("div");
    cell.className = "result-cell";
    cell.textContent = state.resultGrid[index] || "";

    if (!state.resultGrid[index]) cell.classList.add("empty");
    if (MOVE_COLS.includes(col)) cell.classList.add("odd-col");
    if (cipher) cell.classList.add("cipher");
    if (highlight && MOVE_COLS.includes(col)) cell.classList.add("highlight");
    if (movingCol === col) {
      const wrapsDown = moveDirection === "down" && row >= ROWS - SHIFT;
      const wrapsUp = moveDirection === "up" && row < SHIFT;
      cell.classList.add(moveDirection === "up" ? "move-up" : "move-down", "moving-col", "highlight");
      if (wrapsDown) cell.classList.add("wrap-down");
      if (wrapsUp) cell.classList.add("wrap-up");
    }

    els.resultGrid.appendChild(cell);
  }
}

function setFeedback(message, type = "") {
  els.feedback.className = `feedback ${type}`.trim();
  els.feedback.textContent = message;
}

function setBusy(isBusy) {
  state.busy = isBusy;
  [els.placeBtn, els.encryptBtn, els.decryptBtn, els.resetBtn, els.groupSelect].forEach((el) => {
    el.disabled = isBusy;
  });
}

function updateCount() {
  const count = charsOf(els.input.value).length;
  els.charCount.textContent = `当前字数：${count} / 36`;
  els.input.classList.toggle("too-long", count > SIZE);
}

function validateInput() {
  const chars = charsOf(els.input.value);
  if (chars.length === 0) {
    setFeedback("请先输入一段明文。", "error");
    return null;
  }
  if (chars.length > SIZE) {
    setFeedback("明文太长啦！6×6方格最多只能放36个字符。", "error");
    return null;
  }
  return chars;
}

async function placeText() {
  if (state.busy) return;
  const chars = validateInput();
  if (!chars) return;

  setBusy(true);
  state.originalText = chars.join("");
  state.cipherText = "";
  state.resultGrid = Array(SIZE).fill("");
  state.mode = "plain";
  els.title.textContent = "明文方格";
  els.state.textContent = "正在放入";
  els.cipherOutput.textContent = "等待生成";
  setFeedback("正在把明文放入方格，请观察排列顺序。");

  const padded = padToGrid(chars);
  state.plainGrid = [...padded];
  state.grid = Array(SIZE).fill("");
  renderGrid();
  renderResultGrid();

  for (let index = 0; index < SIZE; index += 1) {
    state.grid[index] = padded[index];
    renderGrid({ fillIndex: index });
    await sleep(42);
  }

  els.state.textContent = "明文已放入";
  setFeedback("明文已放入方格。请观察：文字是按照从左到右、从上到下的顺序排列的。", "success");
  setBusy(false);
}

async function encryptFlow() {
  if (state.busy) return;
  if (state.mode === "empty") {
    setFeedback("请先把明文放入方格。", "error");
    return;
  }
  if (state.mode === "cipher") {
    setFeedback("密文已经生成，可以点击“开始解密”观察反向操作。", "success");
    return;
  }
  if (!state.safetyConfirmed) {
    els.safetyDialog.showModal();
    return;
  }

  setBusy(true);
  els.title.textContent = "加密中";
  els.state.textContent = "奇数列下移";
  setFeedback("这些是奇数列，需要向下移动3行。");
  renderGrid({ highlight: true });
  await sleep(700);

  for (const col of MOVE_COLS) {
    els.state.textContent = `第${col + 1}列下移`;
    renderGrid({ movingCol: col, moveDirection: "down" });
    await sleep(900);
    state.grid = shiftOneColumn(state.grid, col, "down");
    renderGrid({ highlight: true });
    await sleep(180);
  }

  state.resultGrid = [...state.grid];
  state.mode = "cipher";
  state.cipherText = state.resultGrid.join("");
  state.grid = [...state.plainGrid];
  els.title.textContent = "明文方格";
  els.state.textContent = "加密完成";
  els.cipherOutput.textContent = state.cipherText;
  renderGrid({ highlight: true });
  renderResultGrid({ cipher: true, highlight: true });
  setFeedback("加密成功！左侧保留明文，右侧展示密文，方便对照观察。", "success");
  setBusy(false);
}

async function decryptFlow() {
  if (state.busy) return;
  if (state.mode !== "cipher") {
    setFeedback("请先生成密文，再进行解密。", "error");
    return;
  }

  setBusy(true);
  state.grid = [...state.plainGrid];
  els.title.textContent = "明文方格";
  els.state.textContent = "反向上移";
  setFeedback("左侧明文方格保持不动。请观察右侧密文方格：解密时奇数列向上移动3行。");
  renderGrid({ highlight: true });
  renderResultGrid({ cipher: true, highlight: true });
  await sleep(700);

  for (const col of MOVE_COLS) {
    els.state.textContent = `第${col + 1}列上移`;
    renderGrid({ highlight: true });
    renderResultGrid({ cipher: true, movingCol: col, moveDirection: "up" });
    await sleep(900);
    state.resultGrid = shiftOneColumn(state.resultGrid, col, "up");
    renderGrid({ highlight: true });
    renderResultGrid({ cipher: true, highlight: true });
    await sleep(180);
  }

  state.mode = "plain";
  const restored = cleanPlainText(state.resultGrid);
  els.title.textContent = "明文方格";
  els.state.textContent = "解密成功";
  renderGrid({ highlight: true });
  renderResultGrid({ highlight: true });
  setFeedback(`解密成功！右侧已经还原，可以和左侧明文对比：${restored}`, "success");
  setBusy(false);

  await sleep(450);
  els.summaryDialog.showModal();
}

function resetAll() {
  state.grid = Array(SIZE).fill("");
  state.plainGrid = Array(SIZE).fill("");
  state.resultGrid = Array(SIZE).fill("");
  state.originalText = "";
  state.cipherText = "";
  state.mode = "empty";
  state.safetyConfirmed = false;
  els.groupSelect.value = "0";
  els.input.value = groupTexts[0];
  els.title.textContent = "明文方格";
  els.state.textContent = "等待放入方格";
  els.cipherOutput.textContent = "等待生成";
  updateCount();
  renderGrid();
  renderResultGrid();
  setFeedback("请选择明文，然后点击“放入方格”。");
}

async function copyCipher() {
  if (!state.cipherText) {
    setFeedback("请先生成密文，再复制密文。", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(state.cipherText);
    setFeedback("密文已复制，可以交给同伴尝试解密。", "success");
  } catch {
    setFeedback(`复制失败，请手动选择密文：${state.cipherText}`, "error");
  }
}

function viewCipher() {
  if (!state.cipherText) {
    setFeedback("请先生成密文，再查看密文。", "error");
    return;
  }
  setFeedback(`密文：${state.cipherText}`, "success");
}

function printCipherCard() {
  if (!state.cipherText) {
    setFeedback("请先生成密文，再打印密信卡。", "error");
    return;
  }

  const printWindow = window.open("", "_blank", "width=720,height=520");
  if (!printWindow) {
    setFeedback("浏览器阻止了打印窗口，请允许弹出窗口后再试。", "error");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>小小交通员密信卡</title>
        <style>
          body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; margin: 0; background: #fff5d8; color: #2c211a; }
          .card { margin: 34px; padding: 28px; border: 5px solid #b62020; border-radius: 8px; background: #fffaf0; }
          h1 { margin: 0 0 20px; color: #7f1616; }
          p { font-size: 22px; line-height: 1.8; word-break: break-all; }
          .stamp { display: inline-block; margin-top: 12px; padding: 8px 14px; border: 2px solid #b62020; color: #b62020; font-weight: 800; }
        </style>
      </head>
      <body>
        <section class="card">
          <h1>小小交通员密信卡</h1>
          <p><strong>密文：</strong>${state.cipherText}</p>
          <p><strong>密钥：</strong>6行6列，奇数列下移3行。</p>
          <span class="stamp">课堂学习使用</span>
        </section>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function toggleFullscreen() {
  if (!document.fullscreenEnabled) {
    setFeedback("当前浏览器不支持网页全屏。", "error");
    return;
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    setFeedback("全屏切换没有成功，请再试一次。", "error");
  }
}

function syncFullscreenButton() {
  const active = Boolean(document.fullscreenElement);
  els.fullscreenBtn.textContent = active ? "⛶ 退出全屏" : "⛶ 全屏";
  els.fullscreenBtn.setAttribute("aria-label", active ? "退出全屏" : "进入全屏");
}

els.input.addEventListener("input", updateCount);
els.groupSelect.addEventListener("change", () => {
  els.input.value = groupTexts[Number(els.groupSelect.value)];
  updateCount();
  setFeedback("已填入小组明文，可以点击“放入方格”。");
});
els.placeBtn.addEventListener("click", placeText);
els.encryptBtn.addEventListener("click", encryptFlow);
els.decryptBtn.addEventListener("click", decryptFlow);
els.resetBtn.addEventListener("click", resetAll);
els.fullscreenBtn.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenButton);
els.toggleKeyBtn.addEventListener("click", () => {
  const hidden = els.keyCard.classList.toggle("hidden-key");
  els.toggleKeyBtn.textContent = hidden ? "显示" : "隐藏";
  els.toggleKeyBtn.setAttribute("aria-label", hidden ? "显示密钥" : "隐藏密钥");
});
els.confirmSafetyBtn.addEventListener("click", () => {
  state.safetyConfirmed = true;
  els.safetyDialog.close();
  encryptFlow();
});
els.closeSummaryBtn.addEventListener("click", () => {
  els.summaryDialog.close();
});

resetAll();
syncFullscreenButton();
