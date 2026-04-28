const colorMap = {
  红: "#e73326",
  蓝: "#126edc",
  黄: "#ffc928",
  绿: "#32b55b",
  紫: "#875bd6",
  橙: "#ff8a2a",
  粉: "#e65c9c",
  白: "#ffffff",
  黑: "#222222",
};

const presets = [
  { total: 15, cycle: 4, pattern: ["红", "红", "蓝", "黄"] },
  { total: 20, cycle: 4, pattern: ["红", "蓝", "黄", "绿"] },
  { total: 22, cycle: 5, pattern: ["蓝", "蓝", "红", "红", "黄"] },
  { total: 37, cycle: 6, pattern: ["红", "黄", "蓝", "绿", "红", "紫"] },
];

const state = {
  total: 15,
  cycle: 4,
  pattern: ["红", "红", "蓝", "黄"],
  flags: [],
  selectedColor: "红",
  grouped: false,
  selectedPosition: null,
};

const ui = {
  totalInput: document.getElementById("totalInput"),
  cycleInput: document.getElementById("cycleInput"),
  patternInput: document.getElementById("patternInput"),
  applyConfigBtn: document.getElementById("applyConfigBtn"),
  newQuestionBtn: document.getElementById("newQuestionBtn"),
  resetBtn: document.getElementById("resetBtn"),
  taskText: document.getElementById("taskText"),
  noticeTotal: document.getElementById("noticeTotal"),
  palette: document.getElementById("palette"),
  flagStrip: document.getElementById("flagStrip"),
  jumpInput: document.getElementById("jumpInput"),
  jumpBtn: document.getElementById("jumpBtn"),
  fillFeedback: document.getElementById("fillFeedback"),
  groupSizeInput: document.getElementById("groupSizeInput"),
  groupBtn: document.getElementById("groupBtn"),
  groupFeedback: document.getElementById("groupFeedback"),
  locateQuestion: document.getElementById("locateQuestion"),
  positionButtons: document.getElementById("positionButtons"),
  locateFeedback: document.getElementById("locateFeedback"),
  groupSummary: document.getElementById("groupSummary"),
  groupList: document.getElementById("groupList"),
  resultText: document.getElementById("resultText"),
};

function parsePattern(text) {
  return text
    .replace(/[，,、|/]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function correctColorAt(index) {
  return state.pattern[(index - 1) % state.cycle];
}

function targetPosition() {
  const remainder = state.total % state.cycle;
  return remainder === 0 ? state.cycle : remainder;
}

function targetColor() {
  return state.pattern[targetPosition() - 1];
}

function normalizeConfig(config) {
  const total = clamp(Number(config.total), 1, 80);
  let cycle = clamp(Number(config.cycle), 2, 8);
  let pattern = config.pattern.length ? config.pattern : ["红", "红", "蓝", "黄"];

  if (pattern.length !== cycle) {
    pattern = pattern.slice(0, cycle);
    while (pattern.length < cycle) {
      pattern.push(pattern[pattern.length % Math.max(1, pattern.length)] || "红");
    }
  }

  return { total, cycle, pattern };
}

function applyConfig(config) {
  const next = normalizeConfig(config);
  state.total = next.total;
  state.cycle = next.cycle;
  state.pattern = next.pattern;
  state.grouped = false;
  state.selectedPosition = null;
  state.selectedColor = state.pattern[0];
  state.flags = Array.from({ length: state.total }, (_, index) => {
    const number = index + 1;
    return number <= Math.min(10, state.total) ? correctColorAt(number) : null;
  });

  ui.totalInput.value = state.total;
  ui.cycleInput.value = state.cycle;
  ui.groupSizeInput.value = state.cycle;
  ui.jumpInput.value = state.total;
  ui.jumpInput.max = state.total;
  ui.patternInput.value = state.pattern.join(" ");

  setFeedback(ui.fillFeedback, "先观察前面的彩旗规律。", "");
  setFeedback(ui.groupFeedback, "输入你观察到的周期。", "");
  setFeedback(ui.locateFeedback, "分组后再定位。", "");
  render();
}

function render() {
  ui.taskText.textContent = `第2关：第${state.total}面彩旗是什么颜色？`;
  ui.noticeTotal.textContent = state.total;
  ui.locateQuestion.textContent = `第${state.total}面在这一组的第几个？`;
  renderPalette();
  renderFlags();
  renderPositionButtons();
  renderGroups();
}

function renderPalette() {
  ui.palette.innerHTML = "";
  [...new Set(state.pattern)].forEach((color) => {
    const button = document.createElement("button");
    button.className = `color-button${state.selectedColor === color ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `<span class="swatch" style="background:${getColorValue(color)}"></span><span>${color}色</span>`;
    button.addEventListener("click", () => {
      state.selectedColor = color;
      renderPalette();
    });
    ui.palette.appendChild(button);
  });
}

function renderFlags() {
  ui.flagStrip.innerHTML = "";
  state.flags.forEach((color, index) => {
    const number = index + 1;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `flag-card${number === state.total ? " target" : ""}${color ? "" : " empty"}`;
    card.id = `flag-${number}`;
    card.setAttribute("aria-label", `第${number}面彩旗`);

    const clothClass = color ? "flag-cloth" : "flag-cloth empty";
    const fill = color ? getColorValue(color) : "transparent";
    card.innerHTML = `
      <span class="flag-shape">
        <span class="${clothClass}" style="background:${fill}"></span>
      </span>
      <span class="flag-number">${number}</span>
    `;
    card.addEventListener("click", () => fillFlag(number));
    ui.flagStrip.appendChild(card);
  });
}

function renderPositionButtons() {
  ui.positionButtons.innerHTML = "";
  for (let index = 1; index <= state.cycle; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `position-button${state.selectedPosition === index ? " selected" : ""}`;
    button.textContent = `第${index}个`;
    button.addEventListener("click", () => choosePosition(index));
    ui.positionButtons.appendChild(button);
  }
}

function renderGroups() {
  ui.groupList.innerHTML = "";

  if (!state.grouped) {
    ui.groupSummary.classList.add("empty-guide");
    ui.groupSummary.textContent = "点击右侧“开始分组”按钮，看看每一组有几个彩旗吧！";
    ui.resultText.textContent = `找出第${state.total}面彩旗的颜色！`;
    return;
  }

  ui.groupSummary.classList.remove("empty-guide");
  const groupCount = Math.ceil(state.total / state.cycle);
  ui.groupSummary.textContent = `每${state.cycle}面一组，共${groupCount}组。`;

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const row = document.createElement("div");
    row.className = "group-row";
    const label = document.createElement("div");
    label.className = "group-label";
    label.textContent = `第${groupIndex + 1}组`;

    const flags = document.createElement("div");
    flags.className = "group-flags";

    for (let itemIndex = 0; itemIndex < state.cycle; itemIndex += 1) {
      const number = groupIndex * state.cycle + itemIndex + 1;
      const mini = document.createElement("div");
      mini.className = `mini-flag${number === state.total ? " target" : ""}`;
      if (number <= state.total) {
        const color = state.flags[number - 1];
        mini.textContent = color || "□";
        mini.style.background = color ? getColorValue(color) : "rgba(255,255,255,0.82)";
        mini.style.color = color === "黑" ? "#ffffff" : "#253041";
      } else {
        mini.textContent = "";
        mini.style.opacity = "0.25";
      }
      flags.appendChild(mini);
    }

    row.append(label, flags);
    ui.groupList.appendChild(row);
  }
}

function fillFlag(number) {
  state.flags[number - 1] = state.selectedColor;
  const expected = correctColorAt(number);

  if (state.selectedColor === expected) {
    setFeedback(ui.fillFeedback, `第${number}面填对了，规律继续成立。`, "good");
  } else {
    setFeedback(ui.fillFeedback, "再观察规律哦。", "bad");
  }

  renderFlags();
  renderGroups();
}

function startGrouping() {
  const groupSize = Number(ui.groupSizeInput.value);
  if (groupSize !== state.cycle) {
    state.grouped = false;
    setFeedback(ui.groupFeedback, "试试能不能完整重复？", "bad");
    renderGroups();
    return;
  }

  state.grouped = true;
  setFeedback(ui.groupFeedback, `很好，每${state.cycle}面一组。`, "good");
  setFeedback(ui.locateFeedback, `现在想一想：第${state.total}面在当前组里的第几个？`, "warn");
  renderGroups();
}

function choosePosition(position) {
  if (!state.grouped) {
    setFeedback(ui.locateFeedback, "先完成分组，再定位第N面。", "warn");
    return;
  }

  state.selectedPosition = position;
  const answerPosition = targetPosition();
  const answerColor = targetColor();

  if (position !== answerPosition) {
    setFeedback(ui.locateFeedback, "再想一想：余数表示在这一组里的位置。", "bad");
    renderPositionButtons();
    return;
  }

  state.flags[state.total - 1] = answerColor;
  const remainder = state.total % state.cycle;
  const extra = remainder === 0 ? "没有余数，说明是这一组的最后一个。" : `余数是${remainder}，说明是这一组的第${remainder}个。`;
  setFeedback(ui.locateFeedback, `${extra} 第${state.total}面是${answerColor}色。`, "good");
  ui.resultText.textContent = `闯关成功：第${state.total}面是${answerColor}色！`;
  render();
  scrollToTarget();
}

function jumpToTarget() {
  const requested = clamp(Number(ui.jumpInput.value), 1, state.total);
  ui.jumpInput.value = requested;
  const target = document.getElementById(`flag-${requested}`);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

function scrollToTarget() {
  const target = document.getElementById(`flag-${state.total}`);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

function getColorValue(color) {
  return colorMap[color] || color;
}

function setFeedback(element, text, tone) {
  element.className = `feedback${tone ? ` ${tone}` : ""}`;
  element.textContent = text;
}

ui.applyConfigBtn.addEventListener("click", () => {
  applyConfig({
    total: ui.totalInput.value,
    cycle: ui.cycleInput.value,
    pattern: parsePattern(ui.patternInput.value),
  });
});

ui.newQuestionBtn.addEventListener("click", () => {
  const preset = presets[Math.floor(Math.random() * presets.length)];
  applyConfig(preset);
});

ui.resetBtn.addEventListener("click", () => {
  applyConfig(presets[0]);
});

ui.groupBtn.addEventListener("click", startGrouping);
ui.jumpBtn.addEventListener("click", jumpToTarget);

applyConfig(presets[0]);
