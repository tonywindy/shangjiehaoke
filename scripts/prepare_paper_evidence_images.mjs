import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const outputRoot = path.resolve("docs/论文素材/学生前后测");
const cropDir = path.join(outputRoot, "正文局部截图");
const fullDir = path.join(outputRoot, "附录匿名整页");

const sourceRoot =
  "/Users/renard/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_wbsvyow03c6922_0a1d/temp/RWTemp/2026-07/9124e04e22b01ac0fc4b491ebead2e74";

const sheets = [
  {
    code: "A",
    phase: "pre",
    source: "87308f00e953360429e93c0c6815f718.jpg",
    headerMask: { left: 215, top: 225, width: 650, height: 90 },
  },
  {
    code: "B",
    phase: "pre",
    source: "66955010bfdd8a231924427775fc087e.jpg",
    headerMask: { left: 180, top: 195, width: 590, height: 70 },
  },
  {
    code: "C",
    phase: "pre",
    source: "bbc19bac34ed4e560e3cc99f4ff30a99.jpg",
    headerMask: { left: 170, top: 175, width: 620, height: 80 },
  },
  {
    code: "D",
    phase: "pre",
    source: "ee59e01a1946917b99e809929f590a6a.jpg",
    headerMask: { left: 190, top: 210, width: 650, height: 80 },
  },
  {
    code: "A",
    phase: "post",
    source: "4a0169e65dc1303549b0d64546b31ce0.jpg",
    headerMask: { left: 190, top: 185, width: 650, height: 80 },
  },
  {
    code: "B",
    phase: "post",
    source: "c9cd47933c856ecd828f90c7e4f1b21f.jpg",
    headerMask: { left: 190, top: 180, width: 670, height: 85 },
  },
  {
    code: "C",
    phase: "post",
    source: "9f89f3587cefed87e23fe0d0d7f48b49.jpg",
    headerMask: { left: 190, top: 180, width: 640, height: 75 },
  },
  {
    code: "D",
    phase: "post",
    source: "0e454e631971879d578dfbc26cfd624c.jpg",
    headerMask: { left: 190, top: 175, width: 650, height: 75 },
  },
];

const crops = [
  {
    name: "student_A_pre_concept.png",
    source: "87308f00e953360429e93c0c6815f718.jpg",
    extract: { left: 105, top: 300, width: 870, height: 475 },
  },
  {
    name: "student_A_post_concept.png",
    source: "4a0169e65dc1303549b0d64546b31ce0.jpg",
    extract: { left: 90, top: 245, width: 830, height: 500 },
  },
  {
    name: "student_C_pre_formula.png",
    source: "bbc19bac34ed4e560e3cc99f4ff30a99.jpg",
    extract: { left: 100, top: 720, width: 780, height: 300 },
  },
  {
    name: "student_C_post_formula.png",
    source: "9f89f3587cefed87e23fe0d0d7f48b49.jpg",
    extract: { left: 105, top: 685, width: 790, height: 255 },
  },
  {
    name: "student_D_pre_composite_boundary.png",
    source: "ee59e01a1946917b99e809929f590a6a.jpg",
    extract: { left: 100, top: 1055, width: 825, height: 290 },
  },
  {
    name: "student_D_post_wall_boundary.png",
    source: "0e454e631971879d578dfbc26cfd624c.jpg",
    extract: { left: 95, top: 885, width: 820, height: 365 },
  },
];

await fs.mkdir(cropDir, { recursive: true });
await fs.mkdir(fullDir, { recursive: true });

function anonymousHeaderSvg(width, height, code) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" rx="8" fill="#fffefa"/>
      <text x="${width / 2}" y="${height / 2 + 9}" text-anchor="middle"
        font-family="PingFang SC, Noto Sans CJK SC, sans-serif"
        font-size="24" font-weight="600" fill="#52615d">学生${code}（匿名）　班级信息已隐去</text>
    </svg>`,
  );
}

for (const sheet of sheets) {
  const sourcePath = path.join(sourceRoot, sheet.source);
  const mask = sheet.headerMask;
  const composites = [
    {
      input: anonymousHeaderSvg(mask.width, mask.height, sheet.code),
      left: mask.left,
      top: mask.top,
    },
  ];
  const phaseLabel = sheet.phase === "pre" ? "pre" : "post";
  const outputPath = path.join(
    fullDir,
    `student_${sheet.code}_${phaseLabel}_full_anonymized.png`,
  );
  await sharp(sourcePath)
    .rotate()
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

for (const crop of crops) {
  await sharp(path.join(sourceRoot, crop.source))
    .rotate()
    .extract(crop.extract)
    .png({ compressionLevel: 9 })
    .toFile(path.join(cropDir, crop.name));
}

function labelSvg(width, label) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="58">
      <rect width="${width}" height="58" rx="10" fill="#174f45"/>
      <text x="${width / 2}" y="38" text-anchor="middle"
        font-family="PingFang SC, Noto Sans CJK SC, sans-serif"
        font-size="26" font-weight="600" fill="#ffffff">${label}</text>
    </svg>`,
  );
}

async function makePanel(inputPath, label, panelWidth, panelHeight) {
  const imageHeight = panelHeight - 78;
  const fitted = await sharp(inputPath)
    .resize(panelWidth - 36, imageHeight - 18, {
      fit: "contain",
      background: "#ffffff",
      withoutEnlargement: false,
    })
    .extend({
      top: 9,
      bottom: 9,
      left: 18,
      right: 18,
      background: "#ffffff",
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: panelWidth,
      height: panelHeight,
      channels: 3,
      background: "#f6f7f4",
    },
  })
    .composite([
      { input: labelSvg(panelWidth, label), left: 0, top: 0 },
      { input: fitted, left: 0, top: 72 },
    ])
    .png()
    .toBuffer();
}

async function makeComparison({
  before,
  after,
  output,
  panelWidth = 900,
  panelHeight = 620,
}) {
  const [beforePanel, afterPanel] = await Promise.all([
    makePanel(path.join(cropDir, before), "前测", panelWidth, panelHeight),
    makePanel(path.join(cropDir, after), "后测", panelWidth, panelHeight),
  ]);

  await sharp({
    create: {
      width: panelWidth * 2 + 24,
      height: panelHeight,
      channels: 3,
      background: "#d9ded9",
    },
  })
    .composite([
      { input: beforePanel, left: 0, top: 0 },
      { input: afterPanel, left: panelWidth + 24, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(outputRoot, output));
}

await makeComparison({
  before: "student_A_pre_concept.png",
  after: "student_A_post_concept.png",
  output: "figure_student_A_concept_pre_post.png",
  panelHeight: 650,
});

await makeComparison({
  before: "student_C_pre_formula.png",
  after: "student_C_post_formula.png",
  output: "figure_student_C_formula_pre_post.png",
  panelHeight: 560,
});

await makeComparison({
  before: "student_D_pre_composite_boundary.png",
  after: "student_D_post_wall_boundary.png",
  output: "figure_student_D_boundary_reference.png",
  panelHeight: 570,
});

console.log(`Evidence images written to ${outputRoot}`);
