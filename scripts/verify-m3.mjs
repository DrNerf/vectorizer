// M3 runtime verification: drive the real app in Edge with a scene that
// exercises the new stages — an annulus (enclosed hole → hole detection +
// winding) and scattered single-pixel specks (despeckle). Asserts a valid
// downloadable SVG, zero self-intersections, zero open subpaths, and that at
// least one hole survived (subpaths > colors). Requires dev on :3000.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:3000";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(90000);
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[type=file]', { state: "attached" });

const dataUrl = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const colors = ["#e6194b","#3cb44b","#ffe119","#4363d8","#f58231","#911eb4","#46f0f0","#000000"];
  // 8 vertical bands give KMeans (K=8) a clean palette.
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(i * 32, 0, 32, 256);
  }
  // Annulus: outer disc of color0 with an inner disc of color4 -> a hole.
  ctx.fillStyle = colors[0];
  ctx.beginPath(); ctx.arc(128, 128, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = colors[4];
  ctx.beginPath(); ctx.arc(128, 128, 35, 0, Math.PI * 2); ctx.fill();
  // Scattered single-pixel specks that despeckle should remove.
  ctx.fillStyle = colors[7];
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i * 53) % 256, (i * 97) % 256, 1, 1);
  }
  return c.toDataURL("image/png");
});
const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
await page.setInputFiles('input[type=file]', { name: "scene.png", mimeType: "image/png", buffer });

const downloadBtn = page.getByRole("button", { name: /download svg/i });
await downloadBtn.waitFor({ state: "visible" });
try {
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /download svg/i.test(x.textContent || ""));
    return b && !b.disabled;
  }, { timeout: 90000 });
} catch (e) {
  const diag = await page.evaluate(() => ({
    progress: [...document.querySelectorAll(".MuiTypography-caption")].map((x) => x.textContent),
    chips: [...document.querySelectorAll(".MuiChip-label")].map((x) => x.textContent),
  }));
  console.log("WAIT FAILED:", e.message);
  console.log("DIAG:", JSON.stringify(diag));
  console.log("ERRORS:", errors.join("\n") || "(none)");
  await browser.close();
  process.exit(1);
}

const chips = await page.evaluate(() =>
  [...document.querySelectorAll(".MuiChip-label")].map((e) => e.textContent),
);

const [download] = await Promise.all([page.waitForEvent("download"), downloadBtn.click()]);
const stream = await download.createReadStream();
let svg = "";
for await (const chunk of stream) svg += chunk;

const num = (re) => {
  const hit = chips.find((c) => re.test(c));
  return hit ? parseInt(hit, 10) : NaN;
};
const colorCount = num(/colors$/);
const subpaths = num(/subpaths$/);
const selfInt = num(/self-int$/);
const open = num(/open$/);
const pathCount = (svg.match(/<path/g) || []).length;
const evenodd = svg.includes('fill-rule="nonzero"'); // default param

const checks = {
  svgValid: svg.startsWith("<svg") && svg.trim().endsWith("</svg>") && pathCount > 0,
  zeroSelfInt: selfInt === 0,
  zeroOpen: open === 0,
  holeSurvived: subpaths > colorCount, // annulus -> outer+hole
  fillRule: evenodd,
};
const ok = Object.values(checks).every(Boolean);

console.log("CHIPS:", chips.join(" | "));
console.log("SVG bytes:", svg.length, "| <path>:", pathCount);
console.log("CHECKS:", JSON.stringify(checks));
if (errors.length) console.log("PAGE ERRORS:", errors.join("\n"));

await browser.close();
console.log(ok ? "VERIFY OK" : "VERIFY FAIL");
process.exit(ok ? 0 : 1);
