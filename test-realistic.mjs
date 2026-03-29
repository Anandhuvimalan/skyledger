import puppeteer from "puppeteer";

const BASE = "http://localhost:3847";

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  // DON'T clear localStorage — start with existing/default data like a real user
  await page.goto(BASE, { waitUntil: "networkidle0" });

  // Check initial state
  const initial = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("skyledger-demo-store") || "{}");
    const s = store?.state;
    if (!s) return "NO_STORE";
    const todayInv = (s.invoices || []).filter((i) => i.issueDate === "2026-03-28");
    return {
      totalBookings: (s.bookings || []).length,
      totalInvoices: (s.invoices || []).length,
      todayInvoices: todayInv.map((i) => ({
        num: i.invoiceNumber, count: i.bookingIds.length, bal: i.balanceDue
      })),
    };
  });
  console.log("Initial state:", JSON.stringify(initial));

  // If there's existing data from a previous test, clear and start fresh
  if (initial !== "NO_STORE") {
    console.log("(Clearing stale data for clean test)");
    await page.evaluate(() => localStorage.clear());
  }

  // ── Book ticket 1 via agent portal ──
  console.log("\n--- BOOK TICKET 1 ---");
  await page.goto(`${BASE}/agent/book-flight`, { waitUntil: "networkidle0" });
  await page.waitForSelector("h1");
  const s1 = await page.waitForSelector('button[type="submit"]');
  await s1.click();
  await new Promise((r) => setTimeout(r, 500));
  for (const btn of await page.$$("button")) {
    if ((await btn.evaluate((el) => el.textContent))?.includes("Book Now")) { await btn.click(); break; }
  }
  await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 5000 }).catch(() => null);
  const msg1 = await page.evaluate(() => (document.querySelector('[class*="emerald"]') || document.querySelector('[class*="amber"]'))?.textContent || "none");
  console.log("  Message:", msg1);

  // ── Check admin invoices page for ticket 1 ──
  console.log("\n--- CHECK ADMIN AFTER TICKET 1 ---");
  await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle0" });
  await page.waitForSelector("h1", { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 1500));

  const admin1 = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("skyledger-demo-store") || "{}");
    const s = store?.state || {};
    const inv = (s.invoices || []).find((i) => i.issueDate === "2026-03-28" && i.agentId === "agent-amex");
    // Also check what the page actually renders
    const rows = Array.from(document.querySelectorAll("tr"));
    let rowData = null;
    for (const row of rows) {
      if (row.textContent?.includes("INV-2026-003852")) {
        const cells = Array.from(row.querySelectorAll("td"));
        rowData = cells.map((c) => c.textContent?.trim());
      }
    }
    return {
      storeInvoice: inv ? { num: inv.invoiceNumber, count: inv.bookingIds.length, bal: inv.balanceDue } : "NONE",
      renderedRow: rowData,
    };
  });
  console.log("  Store invoice:", JSON.stringify(admin1.storeInvoice));
  console.log("  Rendered row:", JSON.stringify(admin1.renderedRow));

  // ── Go back and book ticket 2 ──
  console.log("\n--- BOOK TICKET 2 ---");
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
  const msg2 = await page.evaluate(() => (document.querySelector('[class*="emerald"]') || document.querySelector('[class*="amber"]'))?.textContent || "none");
  console.log("  Message:", msg2);

  // ── Check admin invoices page for ticket 2 ──
  console.log("\n--- CHECK ADMIN AFTER TICKET 2 ---");
  await page.goto(`${BASE}/invoices`, { waitUntil: "networkidle0" });
  await page.waitForSelector("h1", { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 1500));

  const admin2 = await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem("skyledger-demo-store") || "{}");
    const s = store?.state || {};
    const inv = (s.invoices || []).find((i) => i.issueDate === "2026-03-28" && i.agentId === "agent-amex");
    const rows = Array.from(document.querySelectorAll("tr"));
    let rowData = null;
    for (const row of rows) {
      if (row.textContent?.includes("INV-2026-003852")) {
        const cells = Array.from(row.querySelectorAll("td"));
        rowData = cells.map((c) => c.textContent?.trim());
      }
    }
    return {
      storeInvoice: inv ? { num: inv.invoiceNumber, count: inv.bookingIds.length, bal: inv.balanceDue } : "NONE",
      renderedRow: rowData,
    };
  });
  console.log("  Store invoice:", JSON.stringify(admin2.storeInvoice));
  console.log("  Rendered row:", JSON.stringify(admin2.renderedRow));

  // Verify update
  if (admin1.storeInvoice !== "NONE" && admin2.storeInvoice !== "NONE") {
    const count1 = admin1.storeInvoice.count;
    const count2 = admin2.storeInvoice.count;
    const bal1 = admin1.storeInvoice.bal;
    const bal2 = admin2.storeInvoice.bal;
    console.log(`\n=== RESULT ===`);
    console.log(`Booking count: ${count1} → ${count2} (${count2 > count1 ? "UPDATED" : "NOT UPDATED"})`);
    console.log(`Balance due: $${bal1} → $${bal2} (${bal2 > bal1 ? "UPDATED" : "NOT UPDATED"})`);
  }

  await browser.close();
}

run().catch((err) => { console.error("Test failed:", err.message); process.exit(1); });
