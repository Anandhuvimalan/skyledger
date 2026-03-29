import puppeteer from "puppeteer";

const BASE = "http://localhost:3847";

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.clear());
  console.log("=== CLEARED localStorage ===\n");

  // ── BOOKING 1 ──
  console.log("--- BOOKING 1 ---");
  await page.goto(`${BASE}/agent/book-flight`, { waitUntil: "networkidle0" });
  await page.waitForSelector("h1");
  const s1 = await page.waitForSelector('button[type="submit"]');
  await s1.click();
  await new Promise((r) => setTimeout(r, 500));
  for (const btn of await page.$$("button")) {
    if ((await btn.evaluate((el) => el.textContent))?.includes("Book Now")) { await btn.click(); break; }
  }
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 5000 }).catch(() => null);

  const after1 = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("skyledger-demo-store") || "{}");
    const s = store?.state || {};
    const inv = (s.invoices || []).find((i) => i.issueDate === "2026-03-28" && i.agentId === "agent-amex");
    return inv ? { num: inv.invoiceNumber, count: inv.bookingIds.length, ids: inv.bookingIds, bal: inv.balanceDue } : "NONE";
  });
  console.log("  Invoice after booking 1:", JSON.stringify(after1));

  // ── BOOKING 2 ──
  console.log("\n--- BOOKING 2 ---");
  await page.goto(`${BASE}/agent/book-flight`, { waitUntil: "networkidle0" });
  await page.waitForSelector("h1");
  await page.evaluate(() => {
    document.querySelector("#origin").value = "";
    document.querySelector("#destination").value = "";
  });
  await page.type("#origin", "LAX");
  await page.type("#destination", "SYD");
  const s2 = await page.waitForSelector('button[type="submit"]');
  await s2.click();
  await new Promise((r) => setTimeout(r, 500));
  for (const btn of await page.$$("button")) {
    if ((await btn.evaluate((el) => el.textContent))?.includes("Book Now")) { await btn.click(); break; }
  }
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 5000 }).catch(() => null);

  // Check success message
  const msg2 = await page.evaluate(() => {
    const el = document.querySelector('[class*="emerald"]') || document.querySelector('[class*="amber"]');
    return el?.textContent || "no message";
  });
  console.log("  Success message:", msg2);

  const after2 = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("skyledger-demo-store") || "{}");
    const s = store?.state || {};
    const inv = (s.invoices || []).find((i) => i.issueDate === "2026-03-28" && i.agentId === "agent-amex");
    return inv ? { num: inv.invoiceNumber, count: inv.bookingIds.length, ids: inv.bookingIds, bal: inv.balanceDue } : "NONE";
  });
  console.log("  Invoice after booking 2:", JSON.stringify(after2));

  // Check all today's invoices (should be exactly 1)
  const allToday = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("skyledger-demo-store") || "{}");
    const s = store?.state || {};
    return (s.invoices || [])
      .filter((i) => i.issueDate === "2026-03-28")
      .map((i) => ({ num: i.invoiceNumber, count: i.bookingIds.length, bal: i.balanceDue, status: i.status }));
  });
  console.log("  All today's invoices:", JSON.stringify(allToday));

  // ── ADMIN CHECK ──
  console.log("\n--- ADMIN INVOICES PAGE ---");
  await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle0" });
  await page.waitForSelector("h1", { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 1500));

  // Click "View Details" on INV-2026-003852
  const viewBtn = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tr"));
    for (const row of rows) {
      if (row.textContent?.includes("INV-2026-003852")) {
        const btn = row.querySelector("button");
        if (btn) { btn.click(); return "clicked"; }
      }
    }
    return "not found";
  });
  console.log("  Clicked View Details:", viewBtn);
  await new Promise((r) => setTimeout(r, 500));

  // Read the dialog content
  const dialogContent = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return "NO DIALOG";
    return dialog.innerText;
  });
  console.log("  Dialog content:\n", dialogContent);

  await browser.close();
}

run().catch((err) => { console.error("Test failed:", err.message); process.exit(1); });
