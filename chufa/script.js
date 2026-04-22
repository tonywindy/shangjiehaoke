const PLACE_ORDER = ["hundreds", "tens", "ones"];
const PLACE_VALUES = {
  hundreds: 100,
  tens: 10,
  ones: 1,
};
const PLACE_LABELS = {
  hundreds: "百位",
  tens: "十位",
  ones: "个位",
};

const state = {
  started: false,
  mode: "teacher",
  dividend: 87,
  divisor: 2,
  phase: "idle",
  currentPlaceIndex: 0,
  remainder: 0,
  currentPlacePool: 0,
  remainingTotal: 324,
  quotientDigits: {
    hundreds: 0,
    tens: 0,
    ones: 0,
  },
  pools: {
    hundreds: 3,
    tens: 2,
    ones: 4,
  },
  stageStartPools: {
    hundreds: 0,
    tens: null,
    ones: null,
  },
  digits: {
    hundreds: 3,
    tens: 2,
    ones: 4,
  },
  squirrels: [],
  steps: [],
  teacherHistory: [],
  pendingAction: null,
  highlightSlots: [],
  dragSession: null,
  soundOn: true,
};

const ui = {
  dividendInput: document.getElementById("dividend"),
  divisorInput: document.getElementById("divisor"),
  modeSelect: document.getElementById("mode"),
  startBtn: document.getElementById("startBtn"),
  resetBtn: document.getElementById("resetBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  soundBtn: document.getElementById("soundBtn"),
  settingsPanel: document.getElementById("settingsPanel"),
  headlineText: document.getElementById("headlineText"),
  teacherChip: document.getElementById("teacherChip"),
  studentChip: document.getElementById("studentChip"),
  remainingTotal: document.getElementById("remainingTotal"),
  leftHint: document.getElementById("leftHint"),
  hundredsCard: document.getElementById("hundredsCard"),
  tensCard: document.getElementById("tensCard"),
  onesCard: document.getElementById("onesCard"),
  hundredsCount: document.getElementById("hundredsCount"),
  tensCount: document.getElementById("tensCount"),
  onesCount: document.getElementById("onesCount"),
  hundredsItems: document.getElementById("hundredsItems"),
  tensItems: document.getElementById("tensItems"),
  onesItems: document.getElementById("onesItems"),
  squirrelGrid: document.getElementById("squirrelGrid"),
  statusBox: document.getElementById("statusBox"),
  dropZone: document.getElementById("dropZone"),
  operationFeedback: document.getElementById("operationFeedback"),
  conceptFeedback: document.getElementById("conceptFeedback"),
  errorFeedback: document.getElementById("errorFeedback"),
  questionBox: document.getElementById("questionBox"),
  questionText: document.getElementById("questionText"),
  canBtn: document.getElementById("canBtn"),
  cannotBtn: document.getElementById("cannotBtn"),
  equationDividend: document.getElementById("equationDividend"),
  equationDivisor: document.getElementById("equationDivisor"),
  slotHundreds: document.getElementById("slotHundreds"),
  slotTens: document.getElementById("slotTens"),
  slotOnes: document.getElementById("slotOnes"),
  slotRemainder: document.getElementById("slotRemainder"),
  stepCounter: document.getElementById("stepCounter"),
  divisionSummary: document.getElementById("divisionSummary"),
  guideChoiceHundreds: document.getElementById("guideChoiceHundreds"),
  guideChoiceTens: document.getElementById("guideChoiceTens"),
  guideChoiceOnes: document.getElementById("guideChoiceOnes"),
  guideChoiceWhole: document.getElementById("guideChoiceWhole"),
  teacherActionBar: document.getElementById("teacherActionBar"),
  prevStepBtn: document.getElementById("prevStepBtn"),
  nextStepBtn: document.getElementById("nextStepBtn"),
  visualDivisor: document.getElementById("visualDivisor"),
  visualQ1: document.getElementById("visualQ1"),
  visualQ2: document.getElementById("visualQ2"),
  visualQ3: document.getElementById("visualQ3"),
  visualD1: document.getElementById("visualD1"),
  visualD2: document.getElementById("visualD2"),
  visualD3: document.getElementById("visualD3"),
  visualS1H: document.getElementById("visualS1H"),
  visualS1T: document.getElementById("visualS1T"),
  visualS1O: document.getElementById("visualS1O"),
  visualB1H: document.getElementById("visualB1H"),
  visualB1T: document.getElementById("visualB1T"),
  visualB1O: document.getElementById("visualB1O"),
  visualS2H: document.getElementById("visualS2H"),
  visualS2T: document.getElementById("visualS2T"),
  visualS2O: document.getElementById("visualS2O"),
  visualB2H: document.getElementById("visualB2H"),
  visualB2T: document.getElementById("visualB2T"),
  visualB2O: document.getElementById("visualB2O"),
  visualS3H: document.getElementById("visualS3H"),
  visualS3T: document.getElementById("visualS3T"),
  visualS3O: document.getElementById("visualS3O"),
  visualR1: document.getElementById("visualR1"),
  visualR2: document.getElementById("visualR2"),
  visualR3: document.getElementById("visualR3"),
  divisionSteps: document.getElementById("divisionSteps"),
  divisionGridboard: document.querySelector(".division-gridboard"),
  leftPanel: document.getElementById("leftPanel"),
  middlePanel: document.getElementById("middlePanel"),
  rightPanel: document.getElementById("rightPanel"),
};

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function splitDigits(value) {
  return {
    hundreds: Math.floor(value / 100),
    tens: Math.floor((value % 100) / 10),
    ones: value % 10,
  };
}

function buildSquirrels() {
  state.squirrels = Array.from({ length: state.divisor }, (_, index) => ({
    id: index + 1,
    hundreds: 0,
    tens: 0,
    ones: 0,
  }));
}

function getQuotientValue() {
  return (
    state.quotientDigits.hundreds * 100 +
    state.quotientDigits.tens * 10 +
    state.quotientDigits.ones
  );
}

function getCurrentPlace() {
  return PLACE_ORDER[state.currentPlaceIndex] || "ones";
}

function getStartingPlaceIndex() {
  if (state.digits.hundreds > 0) {
    return 0;
  }
  if (state.digits.tens > 0) {
    return 1;
  }
  return 2;
}

function getCurrentPlaceLabel() {
  return PLACE_LABELS[getCurrentPlace()];
}

function getCurrentPlaceValue() {
  return PLACE_VALUES[getCurrentPlace()];
}

function setStatus(text) {
  ui.statusBox.textContent = text;
}

function setFeedback(type, text) {
  if (type === "operation") {
    ui.operationFeedback.textContent = text;
  }
  if (type === "concept") {
    ui.conceptFeedback.textContent = text;
  }
  if (type === "error") {
    ui.errorFeedback.textContent = text;
  }
}

function resetStateFromInputs() {
  state.dividend = clamp(Number(ui.dividendInput.value), 10, 999);
  state.divisor = clamp(Number(ui.divisorInput.value), 2, 9);
  state.mode = ui.modeSelect.value;
  state.started = false;
  state.phase = "idle";
  state.currentPlaceIndex = 0;
  state.remainder = 0;
  state.currentPlacePool = 0;
  state.remainingTotal = state.dividend;
  state.digits = splitDigits(state.dividend);
  state.pools = { ...state.digits };
  state.stageStartPools = {
    hundreds: state.digits.hundreds,
    tens: null,
    ones: null,
  };
  state.quotientDigits = {
    hundreds: 0,
    tens: 0,
    ones: 0,
  };
  state.steps = [];
  state.teacherHistory = [];
  state.pendingAction = null;
  state.highlightSlots = [];
  state.dragSession = null;
  buildSquirrels();

  ui.dividendInput.value = state.dividend;
  ui.divisorInput.value = state.divisor;

  setStatus("点击“开始分配”进入演示。");
  setFeedback("operation", "操作反馈：等待开始");
  setFeedback("concept", "概念反馈：商表示每只分到多少。");
  setFeedback("error", "错误反馈：暂无");
  render();
}

function startLesson() {
  resetStateFromInputs();
  state.started = true;
  state.currentPlaceIndex = getStartingPlaceIndex();
  state.phase = getCurrentPlace();
  state.currentPlacePool = state.pools[state.phase];
  state.stageStartPools[state.phase] = state.currentPlacePool;
  setStatus(`正在分${getCurrentPlaceLabel()}`);
  setFeedback("operation", `操作反馈：开始第一阶段，先分${getCurrentPlaceLabel()}。`);
  setFeedback(
    "concept",
    `概念反馈：先看 ${state.currentPlacePool} 个${state.phase === "hundreds" ? "百" : state.phase === "tens" ? "十" : "一"}，能不能平均分给 ${state.divisor} 只松鼠。`,
  );
  if (state.mode === "teacher") {
    prepareNextTeacherAction();
  }
  render();
}

function captureTeacherSnapshot() {
  return JSON.parse(
    JSON.stringify({
      started: state.started,
      mode: state.mode,
      dividend: state.dividend,
      divisor: state.divisor,
      phase: state.phase,
      currentPlaceIndex: state.currentPlaceIndex,
      remainder: state.remainder,
      currentPlacePool: state.currentPlacePool,
      remainingTotal: state.remainingTotal,
      quotientDigits: state.quotientDigits,
      pools: state.pools,
      stageStartPools: state.stageStartPools,
      digits: state.digits,
      squirrels: state.squirrels,
      steps: state.steps,
      pendingAction: state.pendingAction,
      highlightSlots: state.highlightSlots,
      statusText: ui.statusBox.textContent,
      operationText: ui.operationFeedback.textContent,
      conceptText: ui.conceptFeedback.textContent,
      errorText: ui.errorFeedback.textContent,
    }),
  );
}

function restoreTeacherSnapshot(snapshot) {
  state.started = snapshot.started;
  state.mode = snapshot.mode;
  state.dividend = snapshot.dividend;
  state.divisor = snapshot.divisor;
  state.phase = snapshot.phase;
  state.currentPlaceIndex = snapshot.currentPlaceIndex;
  state.remainder = snapshot.remainder;
  state.currentPlacePool = snapshot.currentPlacePool;
  state.remainingTotal = snapshot.remainingTotal;
  state.quotientDigits = snapshot.quotientDigits;
  state.pools = snapshot.pools;
  state.stageStartPools = snapshot.stageStartPools;
  state.digits = snapshot.digits;
  state.squirrels = snapshot.squirrels;
  state.steps = snapshot.steps;
  state.pendingAction = snapshot.pendingAction;
  state.highlightSlots = snapshot.highlightSlots;
  render();
  ui.statusBox.textContent = snapshot.statusText;
  ui.operationFeedback.textContent = snapshot.operationText;
  ui.conceptFeedback.textContent = snapshot.conceptText;
  ui.errorFeedback.textContent = snapshot.errorText;
}

function pushTeacherSnapshot() {
  state.teacherHistory.push(captureTeacherSnapshot());
}

function getPendingTeacherAction() {
  if (state.phase === "question" || state.phase === "done" || state.phase === "idle") {
    return null;
  }

  const place = getCurrentPlace();
  const pool = state.currentPlacePool;
  const quotientSlotMap = {
    hundreds: "slotHundreds",
    tens: "slotTens",
    ones: "slotOnes",
  };
  const visualQuotientMap = {
    hundreds: "visualQ1",
    tens: "visualQ2",
    ones: "visualQ3",
  };

  if (pool >= state.divisor) {
    const rowMap = {
      hundreds: ["visualS1H", "visualS1T", "visualS1O"],
      tens: ["visualS2H", "visualS2T", "visualS2O"],
      ones: ["visualS3H", "visualS3T", "visualS3O"],
    };
    return {
      type: "round",
      kind: place,
      slots: [quotientSlotMap[place], visualQuotientMap[place], ...rowMap[place]],
    };
  }

  if (place !== "ones") {
    const bringRowMap = {
      hundreds: ["visualB1H", "visualB1T", "visualB1O"],
      tens: ["visualB2H", "visualB2T", "visualB2O"],
    };
    return {
      type: "transition",
      slots: bringRowMap[place],
    };
  }

  return {
    type: "question",
    slots: ["slotRemainder", "visualR1", "visualR2", "visualR3"],
  };
}

function prepareNextTeacherAction() {
  state.pendingAction = getPendingTeacherAction();
  state.highlightSlots = state.pendingAction ? state.pendingAction.slots : [];
}

function handleTeacherNextStep() {
  if (!(state.mode === "teacher" && state.started)) {
    return;
  }
  if (!state.pendingAction) {
    prepareNextTeacherAction();
    render();
    return;
  }

  pushTeacherSnapshot();
  const action = state.pendingAction;
  state.pendingAction = null;
  state.highlightSlots = [];

  if (action.type === "round") {
    performRound(action.kind, false);
  } else if (action.type === "transition") {
    transitionToNextPlace();
  } else if (action.type === "question") {
    enterQuestionPhase();
  }

  if (["hundreds", "tens", "ones"].includes(state.phase)) {
    prepareNextTeacherAction();
  }

  render();
}

function handleTeacherPrevStep() {
  if (!(state.mode === "teacher" && state.started)) {
    return;
  }
  if (state.teacherHistory.length === 0) {
    return;
  }
  restoreTeacherSnapshot(state.teacherHistory.pop());
}

function addStep(title, text) {
  state.steps.push({ title, text });
}

function performRound(kind, fromDrag) {
  const placeValue = PLACE_VALUES[kind];
  const beforePool = state.currentPlacePool;
  const dragStartRect = fromDrag && state.dragSession ? state.dragSession.startRect : null;

  if (kind !== state.phase) {
    return;
  }

  if (state.currentPlacePool < state.divisor) {
    setFeedback("error", `错误反馈：当前${PLACE_LABELS[kind]}不够再平均分给 ${state.divisor} 只松鼠。`);
    return;
  }

  animateDistribution(kind, dragStartRect);

  state.currentPlacePool -= state.divisor;
  state.pools[kind] = state.currentPlacePool;
  state.quotientDigits[kind] += 1;
  state.remainingTotal -= state.divisor * placeValue;
  state.squirrels.forEach((squirrel) => {
    squirrel[kind] += 1;
  });

  addStep(
    `${PLACE_LABELS[kind]}第 ${state.quotientDigits[kind]} 轮`,
    `${beforePool} 个${kind === "hundreds" ? "百" : kind === "tens" ? "十" : "一"} ÷ ${state.divisor} = 每只 1 个${kind === "hundreds" ? "百" : kind === "tens" ? "十" : "一"}\n` +
      `所以商的${PLACE_LABELS[kind]}写 ${state.quotientDigits[kind]}，剩下 ${state.currentPlacePool} 个${kind === "hundreds" ? "百" : kind === "tens" ? "十" : "一"}`,
  );

  setStatus(`正在分${PLACE_LABELS[kind]}`);
  setFeedback("operation", "操作反馈：已平均分，两边数量相同。");
  setFeedback("concept", `概念反馈：商的${PLACE_LABELS[kind]}表示每只松鼠分到了几个${kind === "hundreds" ? "百包" : kind === "tens" ? "十包" : "单个松果"}。`);

  if (state.currentPlacePool < state.divisor && state.mode === "student") {
    if (kind === "ones") {
      window.setTimeout(enterQuestionPhase, 700);
    } else {
      window.setTimeout(transitionToNextPlace, 700);
    }
  }

  render();
}

function transitionToNextPlace() {
  const currentPlace = getCurrentPlace();
  if (currentPlace === "ones") {
    return;
  }

  const nextPlace = PLACE_ORDER[state.currentPlaceIndex + 1];
  const carryValue = state.currentPlacePool * 10 + state.digits[nextPlace];

  state.currentPlaceIndex += 1;
  state.phase = nextPlace;
  state.currentPlacePool = carryValue;
  state.pools[nextPlace] = carryValue;
  state.stageStartPools[nextPlace] = carryValue;
  state.remainingTotal = carryValue * PLACE_VALUES[nextPlace];

  addStep(
    `${PLACE_LABELS[currentPlace]}分完，开始分${PLACE_LABELS[nextPlace]}`,
    `剩下 ${state.pools[currentPlace]} 个${currentPlace === "hundreds" ? "百" : "十"}，转换成 ${state.pools[currentPlace] * 10} 个${nextPlace === "tens" ? "十" : "一"}，再和原来的 ${state.digits[nextPlace]} 个${nextPlace === "tens" ? "十" : "一"} 合起来，一共 ${carryValue} 个${nextPlace === "tens" ? "十" : "一"}`,
  );

  setStatus(`正在分${PLACE_LABELS[nextPlace]}`);
  setFeedback("operation", `操作反馈：${PLACE_LABELS[currentPlace]}分完了，进入${PLACE_LABELS[nextPlace]}分配。`);
  setFeedback("concept", "概念反馈：先分高位，再把剩下的转换到下一位继续分。");
  render();
}

function enterQuestionPhase() {
  state.phase = "question";
  state.remainder = state.currentPlacePool;
  setStatus("还能继续平均分吗？");
  setFeedback("operation", "操作反馈：请判断能不能继续平均分。");
  setFeedback("concept", `概念反馈：余数必须小于除数，现在 ${state.remainder} < ${state.divisor}。`);
  render();
}

function finishLesson(correct) {
  if (correct) {
    state.phase = "done";
    state.remainder = state.currentPlacePool;
    addStep(
      "完成",
      `${state.dividend} ÷ ${state.divisor} = ${getQuotientValue()} …… ${state.remainder}\n商表示每只松鼠分到 ${getQuotientValue()} 个，余数表示剩下无法继续平均分的数量`,
    );
    setStatus("分配完成");
    setFeedback("operation", "操作反馈：判断正确，分配完成。");
    setFeedback("concept", "概念反馈：余数表示剩下无法继续平均分的数量，而且一定小于除数。");
    setFeedback("error", "错误反馈：这一步没有错误。");
  } else {
    setFeedback("error", "错误反馈：如果不能让每只松鼠分到一样多，就不能继续平均分。");
    setFeedback("concept", "概念反馈：再想一想，剩下的数量已经不够每只松鼠分到 1 个了。");
  }
  render();
}

function getStepInfo() {
  if (!state.started) {
    return {
      counter: "步骤 0 / 4",
      summary: "先看被除数的哪一部分？",
      choice: state.digits.hundreds > 0 ? "hundreds" : "tens",
    };
  }

  if (state.phase === "hundreds") {
    return {
      counter: "步骤 1 / 4",
      summary: `先看百位：${state.digits.hundreds} 个百能不能平均分给 ${state.divisor} 只松鼠？`,
      choice: "hundreds",
    };
  }

  if (state.phase === "tens") {
    return {
      counter: "步骤 2 / 4",
      summary: `再看十位：现在有 ${state.currentPlacePool} 个十，继续平均分。`,
      choice: "tens",
    };
  }

  if (state.phase === "ones") {
    return {
      counter: "步骤 3 / 4",
      summary: `最后看个位：现在有 ${state.currentPlacePool} 个一，继续平均分。`,
      choice: "ones",
    };
  }

  return {
    counter: "步骤 4 / 4",
    summary: `还剩 ${state.currentPlacePool} 个，已经不能继续平均分，所以它是余数。`,
    choice: "whole",
  };
}

function render() {
  renderHeader();
  renderSource();
  renderSquirrels();
  renderModeArea();
  renderQuestion();
  renderEquation();
  renderDivision();
}

function renderHeader() {
  ui.headlineText.textContent = `${state.dividend} 个松果平均分给 ${state.divisor} 只松鼠`;
  ui.teacherChip.classList.toggle("active", state.mode === "teacher");
  ui.studentChip.classList.toggle("active", state.mode === "student");
  ui.soundBtn.textContent = state.soundOn ? "🔊 声音" : "🔈 静音";
}

function createItem(text, kind) {
  const span = document.createElement("span");
  span.className = `item ${kind}`;
  span.textContent = text;

  const isStudentDraggable =
    state.mode === "student" &&
    ((kind === "hundreds" && state.phase === "hundreds") ||
      (kind === "tens" && state.phase === "tens") ||
      (kind === "ones" && state.phase === "ones"));

  if (isStudentDraggable) {
    span.classList.add("draggable-source");
    span.dataset.dragKind = kind;
  }

  return span;
}

function renderSource() {
  ui.remainingTotal.textContent = state.remainingTotal;
  ui.hundredsCount.textContent = `${state.pools.hundreds} 个`;
  ui.tensCount.textContent = `${state.pools.tens} 个`;
  ui.onesCount.textContent = `${state.pools.ones} 个`;

  const showHundredsTrack = state.digits.hundreds > 0;
  ui.hundredsCard.classList.toggle("hidden", !showHundredsTrack || !["hundreds"].includes(state.phase));
  ui.tensCard.classList.toggle("hidden", !["tens"].includes(state.phase));
  ui.onesCard.classList.toggle("hidden", !["ones", "question", "done"].includes(state.phase));

  ui.hundredsItems.innerHTML = "";
  ui.tensItems.innerHTML = "";
  ui.onesItems.innerHTML = "";

  for (let i = 0; i < state.pools.hundreds; i += 1) {
    if (showHundredsTrack) {
      ui.hundredsItems.appendChild(createItem("100", "hundreds"));
    }
  }
  for (let i = 0; i < state.pools.tens; i += 1) {
    ui.tensItems.appendChild(createItem("10", "tens"));
  }
  for (let i = 0; i < state.pools.ones; i += 1) {
    ui.onesItems.appendChild(createItem("1", "ones"));
  }

  if (!state.started || state.phase === "idle") {
    const startPlace = PLACE_ORDER[getStartingPlaceIndex()];
    ui.leftHint.textContent = `先分${PLACE_LABELS[startPlace]}：${state.digits[startPlace]} 个${startPlace === "hundreds" ? "百" : startPlace === "tens" ? "十" : "一"}平均分给 ${state.divisor} 只松鼠。`;
  } else if (["hundreds", "tens", "ones"].includes(state.phase)) {
    ui.leftHint.textContent = `正在分${getCurrentPlaceLabel()}：还剩 ${state.currentPlacePool} 个${getCurrentPlace() === "hundreds" ? "百" : getCurrentPlace() === "tens" ? "十" : "一"}，看看能不能继续平均分。`;
  } else {
    ui.leftHint.textContent = `最后还剩 ${state.currentPlacePool} 个，不能继续平均分，这就是余数。`;
  }
}

function renderSquirrels() {
  ui.squirrelGrid.innerHTML = "";
  const showHundredsTrack = state.digits.hundreds > 0;
  state.squirrels.forEach((squirrel) => {
    const card = document.createElement("div");
    card.className = "squirrel-card";
    card.innerHTML = `
      <div class="squirrel-top">
        <div class="squirrel-emoji">🐿️</div>
        <div class="squirrel-name">松鼠${String.fromCharCode(65 + squirrel.id - 1)}</div>
      </div>
      ${showHundredsTrack ? `
      <div class="receive-zone" data-zone-kind="hundreds">
        <div class="zone-title">百位区（百包）</div>
        <div class="item-grid">${Array.from({ length: squirrel.hundreds }, () => '<span class="item hundreds">100</span>').join("")}</div>
      </div>
      ` : ""}
      <div class="receive-zone" data-zone-kind="tens">
        <div class="zone-title">十位区（十包）</div>
        <div class="item-grid">${Array.from({ length: squirrel.tens }, () => '<span class="item tens">10</span>').join("")}</div>
      </div>
      <div class="receive-zone" data-zone-kind="ones">
        <div class="zone-title ones-zone-title">个位区（单个）</div>
        <div class="item-grid small-grid">${Array.from({ length: squirrel.ones }, () => '<span class="item ones">1</span>').join("")}</div>
      </div>
      <div class="stat-box">${squirrel.hundreds * 100 + squirrel.tens * 10 + squirrel.ones}</div>
    `;
    ui.squirrelGrid.appendChild(card);
  });
}

function renderModeArea() {
  const isStudentRound = state.mode === "student" && ["hundreds", "tens", "ones"].includes(state.phase);
  ui.dropZone.classList.toggle("hidden", !isStudentRound);
  ui.teacherActionBar.classList.toggle("hidden", !(state.mode === "teacher" && state.started && state.phase !== "idle"));
  ui.prevStepBtn.disabled = state.teacherHistory.length === 0;
  ui.nextStepBtn.disabled = ["question", "done", "idle"].includes(state.phase);
}

function renderQuestion() {
  ui.questionBox.classList.toggle("hidden", state.phase !== "question");
  if (state.phase === "question") {
    ui.questionText.textContent = `还剩 ${state.currentPlacePool} 个，还能继续平均分给 ${state.divisor} 只松鼠吗？`;
  }
}

function renderEquation() {
  const leadingHundredsSkipped = state.digits.hundreds > 0 && state.digits.hundreds < state.divisor;
  ui.equationDividend.textContent = state.dividend;
  ui.equationDivisor.textContent = state.divisor;
  ui.slotHundreds.textContent = state.started ? (state.digits.hundreds > 0 && !leadingHundredsSkipped ? state.quotientDigits.hundreds : "□") : "□";
  ui.slotTens.textContent = state.started ? state.quotientDigits.tens : "□";
  ui.slotOnes.textContent = state.started ? state.quotientDigits.ones : "□";
  ui.slotRemainder.textContent = ["question", "done"].includes(state.phase) ? state.currentPlacePool : "□";
  ui.slotHundreds.classList.toggle("hidden", state.digits.hundreds === 0 || leadingHundredsSkipped);
  updateSlotHighlights();
}

function setRowTriplet(rowElements, value) {
  const digits = value === null || value === undefined ? [] : String(value).split("");
  const padded = ["□", "□", "□"];
  for (let i = 0; i < digits.length; i += 1) {
    padded[3 - digits.length + i] = digits[i];
  }
  rowElements.forEach((element, index) => {
    element.textContent = padded[index];
    element.classList.remove("ghost-slot");
  });
}

function renderDivision() {
  const leadingHundredsSkipped = state.digits.hundreds > 0 && state.digits.hundreds < state.divisor;
  const stepInfo = getStepInfo();
  ui.stepCounter.textContent = stepInfo.counter;
  ui.divisionSummary.textContent = stepInfo.summary;

  ui.guideChoiceHundreds.classList.toggle("active", stepInfo.choice === "hundreds");
  ui.guideChoiceTens.classList.toggle("active", stepInfo.choice === "tens");
  ui.guideChoiceOnes.classList.toggle("active", stepInfo.choice === "ones");
  ui.guideChoiceWhole.classList.toggle("active", stepInfo.choice === "whole");
  ui.guideChoiceHundreds.classList.toggle("hidden", state.digits.hundreds === 0);
  ui.divisionGridboard.classList.toggle("compact-two-digit", state.digits.hundreds === 0);
  ui.divisionGridboard.classList.toggle("compact-leading-skip", leadingHundredsSkipped);

  ui.visualDivisor.textContent = state.divisor;
  ui.visualQ1.textContent = state.started ? (state.digits.hundreds > 0 && !leadingHundredsSkipped ? state.quotientDigits.hundreds : "□") : "□";
  ui.visualQ2.textContent = state.started ? state.quotientDigits.tens : "□";
  ui.visualQ3.textContent = state.started ? state.quotientDigits.ones : "□";
  ui.visualD1.textContent = state.digits.hundreds > 0 ? state.digits.hundreds : "□";
  ui.visualD2.textContent = state.digits.tens;
  ui.visualD3.textContent = state.digits.ones;
  [
    ui.visualQ1,
    ui.visualD1,
    ui.visualS1H,
    ui.visualB1H,
    ui.visualS2H,
    ui.visualB2H,
    ui.visualS3H,
    ui.visualR1,
  ].forEach((element) => {
    element.classList.toggle("hidden", state.digits.hundreds === 0 || (element === ui.visualQ1 && leadingHundredsSkipped));
  });

  const subtract1 = state.quotientDigits.hundreds * state.divisor * 100;
  const onesStageStart = state.stageStartPools.ones;
  const mergedTensToOnes =
    state.quotientDigits.tens === 0 && ["ones", "question", "done"].includes(state.phase);
  const bring1 = state.phase === "tens" || state.phase === "ones" || state.phase === "question" || state.phase === "done"
    ? mergedTensToOnes
      ? onesStageStart
      : state.stageStartPools.tens !== null
        ? state.stageStartPools.tens * 10
        : null
    : null;
  const subtract2 = mergedTensToOnes ? null : state.quotientDigits.tens * state.divisor * 10;
  const bring2 = mergedTensToOnes
    ? null
    : state.phase === "ones" || state.phase === "question" || state.phase === "done"
      ? state.stageStartPools.ones
      : null;
  const subtract3 = state.quotientDigits.ones * state.divisor;
  const remainder = ["question", "done"].includes(state.phase) ? state.currentPlacePool : null;
  ui.divisionGridboard.classList.toggle("compact-two-step", mergedTensToOnes);

  setRowTriplet([ui.visualS1H, ui.visualS1T, ui.visualS1O], subtract1 || null);
  setRowTriplet([ui.visualB1H, ui.visualB1T, ui.visualB1O], bring1);
  setRowTriplet([ui.visualS2H, ui.visualS2T, ui.visualS2O], subtract2 || null);
  setRowTriplet([ui.visualB2H, ui.visualB2T, ui.visualB2O], bring2);
  setRowTriplet([ui.visualS3H, ui.visualS3T, ui.visualS3O], subtract3 || null);
  setRowTriplet([ui.visualR1, ui.visualR2, ui.visualR3], remainder);

  ui.divisionSteps.innerHTML = "";
  state.steps.slice(-6).forEach((step) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-title">${step.title}</div>
      <div class="history-text">${step.text}</div>
    `;
    ui.divisionSteps.appendChild(item);
  });

  updateSlotHighlights();
}

function updateSlotHighlights() {
  [
    ui.slotHundreds,
    ui.slotTens,
    ui.slotOnes,
    ui.slotRemainder,
    ui.visualQ1,
    ui.visualQ2,
    ui.visualQ3,
    ui.visualS1H,
    ui.visualS1T,
    ui.visualS1O,
    ui.visualB1H,
    ui.visualB1T,
    ui.visualB1O,
    ui.visualS2H,
    ui.visualS2T,
    ui.visualS2O,
    ui.visualB2H,
    ui.visualB2T,
    ui.visualB2O,
    ui.visualS3H,
    ui.visualS3T,
    ui.visualS3O,
    ui.visualR1,
    ui.visualR2,
    ui.visualR3,
  ].forEach((element) => {
    element.classList.remove("target-slot");
  });

  state.highlightSlots.forEach((id) => {
    if (ui[id]) {
      ui[id].classList.add("target-slot");
    }
  });
}

function flashPanels() {
  [ui.leftPanel, ui.middlePanel, ui.rightPanel].forEach((panel) => {
    panel.classList.remove("highlight");
    void panel.offsetWidth;
    panel.classList.add("highlight");
    window.setTimeout(() => panel.classList.remove("highlight"), 900);
  });
}

function animateDistribution(kind, dragStartRect) {
  const startRect = dragStartRect || ui.middlePanel.getBoundingClientRect();
  const cards = Array.from(document.querySelectorAll(".squirrel-card"));
  const label = { hundreds: "100", tens: "10", ones: "1" }[kind];

  cards.forEach((card, index) => {
    const zone = card.querySelector(`[data-zone-kind="${kind}"]`);
    if (!zone) {
      return;
    }
    const targetRect = zone.getBoundingClientRect();
    const flying = document.createElement("div");
    flying.className = `flying-item ${kind}`;
    flying.textContent = label;
    flying.style.left = `${startRect.left + 24}px`;
    flying.style.top = `${startRect.top + 24}px`;
    document.body.appendChild(flying);

    window.requestAnimationFrame(() => {
      const dx = targetRect.left - startRect.left + (index % 3) * 16;
      const dy = targetRect.top - startRect.top + 10;
      flying.style.transform = `translate(${dx}px, ${dy}px) scale(0.88)`;
      flying.style.opacity = "0.18";
    });

    window.setTimeout(() => flying.remove(), 650);
  });

  flashPanels();
}

function canStudentDrag() {
  return state.mode === "student" && ["hundreds", "tens", "ones"].includes(state.phase);
}

function updateDropZoneReady(clientX, clientY) {
  const rect = ui.dropZone.getBoundingClientRect();
  const inside =
    !ui.dropZone.classList.contains("hidden") &&
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom;
  ui.dropZone.classList.toggle("ready", inside);
  return inside;
}

function beginPointerDrag(sourceElement, kind, clientX, clientY) {
  const proxy = document.createElement("div");
  proxy.className = `drag-proxy ${kind}`;
  proxy.innerHTML = `<span>${kind === "hundreds" ? "💜" : kind === "tens" ? "🧺" : "🌰"}</span><span>平均分这一个${kind === "hundreds" ? "百包" : kind === "tens" ? "十包" : "松果"}</span>`;
  document.body.appendChild(proxy);

  state.dragSession = {
    proxy,
    kind,
    sourceElement,
    startRect: sourceElement.getBoundingClientRect(),
  };

  movePointerDrag(clientX, clientY);
  sourceElement.classList.add("dragging-source");
}

function movePointerDrag(clientX, clientY) {
  if (!state.dragSession) {
    return;
  }
  state.dragSession.proxy.style.left = `${clientX}px`;
  state.dragSession.proxy.style.top = `${clientY}px`;
  updateDropZoneReady(clientX, clientY);
}

function endPointerDrag(clientX, clientY) {
  if (!state.dragSession) {
    return;
  }
  const insideDropZone = updateDropZoneReady(clientX, clientY);
  const { kind, sourceElement } = state.dragSession;
  state.dragSession.proxy.remove();
  sourceElement.classList.remove("dragging-source");
  ui.dropZone.classList.remove("ready");

  if (!insideDropZone) {
    state.dragSession = null;
    return;
  }

  performRound(kind, true);
  state.dragSession = null;
}

ui.startBtn.addEventListener("click", startLesson);
ui.resetBtn.addEventListener("click", resetStateFromInputs);
ui.modeSelect.addEventListener("change", resetStateFromInputs);
ui.dividendInput.addEventListener("change", resetStateFromInputs);
ui.divisorInput.addEventListener("change", resetStateFromInputs);

ui.settingsBtn.addEventListener("click", () => {
  ui.settingsPanel.classList.toggle("hidden");
});

ui.soundBtn.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  renderHeader();
});

document.addEventListener("pointerdown", (event) => {
  const source = event.target.closest(".draggable-source");
  if (!source || !canStudentDrag()) {
    return;
  }
  event.preventDefault();
  source.setPointerCapture(event.pointerId);
  beginPointerDrag(source, source.dataset.dragKind, event.clientX, event.clientY);
});

document.addEventListener("pointermove", (event) => {
  if (!state.dragSession) {
    return;
  }
  event.preventDefault();
  movePointerDrag(event.clientX, event.clientY);
});

document.addEventListener("pointerup", (event) => {
  if (!state.dragSession) {
    return;
  }
  event.preventDefault();
  endPointerDrag(event.clientX, event.clientY);
});

document.addEventListener("pointercancel", () => {
  if (!state.dragSession) {
    return;
  }
  state.dragSession.proxy.remove();
  state.dragSession.sourceElement.classList.remove("dragging-source");
  state.dragSession = null;
  ui.dropZone.classList.remove("ready");
});

ui.canBtn.addEventListener("click", () => finishLesson(false));
ui.cannotBtn.addEventListener("click", () => finishLesson(true));
ui.nextStepBtn.addEventListener("click", handleTeacherNextStep);
ui.prevStepBtn.addEventListener("click", handleTeacherPrevStep);

resetStateFromInputs();
