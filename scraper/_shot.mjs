const puppeteer = (await import("puppeteer")).default;
const fs = await import("node:fs");
const env = fs.readFileSync("../dashboard/.env.local", "utf8");
const PW = env.match(/^ADMIN_PASSWORD=(.+)$/m)[1].trim().replace(/^["']|["']$/g, "");
const b = await puppeteer.launch({ headless: "new",
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000 });
await p.goto("http://localhost:3002/gate", { waitUntil: "networkidle0", timeout: 60000 });
await p.type('input[type="password"]', PW);
await Promise.all([
  p.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }).catch(() => {}),
  p.click('button[type="submit"], button'),
]);
await new Promise(r => setTimeout(r, 2500));
console.log("giris sonrasi URL:", p.url());
for (const [ad, u] of [["yontem", "/admin/yontem"], ["istihbarat", "/admin/istihbarat"]]) {
  await p.goto("http://localhost:3002" + u, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise(r => setTimeout(r, 4000));
  const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 260));
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.screenshot({ path: `/tmp/${ad}.png`, fullPage: true });
  console.log(`\n=== ${ad} · ${h}px ===\n${t}`);
}
await b.close();
