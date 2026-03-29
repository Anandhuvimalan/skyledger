import puppeteer from "puppeteer";

const BASE = "http://localhost:3847";

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

  // Tab 1: Agent portal
  const agentPage = await browser.newPage();
  // Tab 2: Admin portal (open simultaneously, like a real user)
  const adminPage = await browser.newPage();

  // Clear localStorage
  await agentPage.goto(BASE, { waitUntil: "networkidle0" });
  await agentPage.evaluate(() => localStorage.clear());
  console.log("=== CLEARED localStorage ===\n");

  // ── Open admin invoices in tab 2 FIRST ──
  console.log("--- OPEN ADMIN PAGE (tab 2) ---");
  await adminPage.goto(`${BASE}/invoices`, { waitUntil: "networkidle0" });
  await adminPage.waitForSelector("h1", { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 1500));

  const adminBefore = await adminPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tr"));
    let rowData = null;
    for (const row of rows) {
      if (row.textContent?.includes("INV-2026-003852")) {
        const cells = Array.from(row.querySelectorAll("td"));
        rowData = cells.map((c) => c.textContent?.trim());
      }
    }
    return { foundInvoice: !!rowData, row: rowData };
  });
  console.log("  Before booking - INV-2026-003852 visible:", adminBefore.foundInvoice);

  // ── Book ticket 1 in tab 1 ──
  console.log("\n--- BOOK TICKET 1 (tab 1) ---");
  await agentPage.goto(`${BASE}/agent/book-flight`, { waitUntil: "networkidle0" });
  await agentPage.waitForSelector("h1");
  const s1 = await agentPage.waitForSelector('button[type="submit"]');
  await s1.click();
  await new Promise((r) => setTimeout(r, 500));
  for (const btn of await agentPage.$$("button")) {
    if ((await btn.evaluate((el) => el.textContent))?.includes("Book Now")) { await btn.click(); break; }
  }
  await agentPage.waitForNavigation({ waitUntil: "networkidle0", timeout: 5000 }).catch(() => null);
  console.log("  Booked ticket 1");

  // ── Check admin tab WITHOUT refreshing ──
  console.log("\n--- CHECK ADMIN (no refresh, tab 2) ---");
  await new Promise((r) => setTimeout(r, 2000)); // Wait for storage event

  const adminAfter1 = await adminPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tr"));
    let rowData = null;
    for (const row of rows) {
      if (row.textContent?.includes("INV-2026-003852")) {
        const cells = Array.from(row.querySelectorAll("td"));
        rowData = cells.map((c) => c.textContent?.trim());
      }
    }
    // Also check localStorage
    const store = JSON.parse(localStorage.getItem("skyledger-demo-store") || "{}");
    const s = store?.state || {};
    const inv = (s.invoices || []).find((i) => i.invoiceNumber === "INV-2026-003852");
    return {
      foundInvoice: !!rowData,
      renderedRow: rowData,
      storageInvoice: inv ? { count: inv.bookingIds.length, bal: inv.balanceDue } : "NONE",
      isShowingSpinner: !!document.querySelector('.animate-spin'),
    };
  });
  console.log("  INV-2026-003852 visible:", adminAfter1.foundInvoice);
  console.log("  Rendered row:", JSON.stringify(adminAfter1.renderedRow));
  console.log("  localStorage invoice:", JSON.stringify(adminAfter1.storageInvoice));
  console.log("  Showing spinner:", adminAfter1.isShowingSpinner);

  // ── Book ticket 2 in tab 1 ──
  console.log("\n--- BOOK TICKET 2 (tab 1) ---");
  await agentPage.goto(`${BASE}/agent/book-flight`, { waitUntil: "networkidle0" });
  await agentPage.waitForSelector("h1");
  await agentPage.evaluate(() => {
    document.querySelector("#origin").value = "";
    document.querySelector("#destination").value = "";
  });
  await agentPage.type("#origin", "LAX");
  await agentPage.type("#destination", "SYD");
  const s2 = await agentPage.waitForSelector('button[type="submit"]');
  await s2.click();
  await new Promise((r) => setTimeout(r, 500));
  for (const btn of await agentPage.$$("button")) {
    if ((await btn.evaluate((el) => el.textContent))?.includes("Book Now")) { await btn.click(); break; }
  }
  await agentPage.waitForNavigation({ waitUntil: "networkidle0", timeout: 5000 }).catch(() => null);
  console.log("  Booked ticket 2");

  // ── Check admin tab WITHOUT refreshing ──
  console.log("\n--- CHECK ADMIN AGAIN (no refresh, tab 2) ---");
  await new Promise((r) => setTimeout(r, 2000));

  const adminAfter2 = await adminPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tr"));
    let rowData = null;
    for (const row of rows) {
      if (row.textContent?.includes("INV-2026-003852")) {
        const cells = Array.from(row.querySelectorAll("td"));
        rowData = cells.map((c) => c.textContent?.trim());
      }
    }
    const store = JSON.parse(localStorage.getItem("skyledger-demo-store") || "{}");
    const s = store?.state || {};
    const inv = (s.invoices || []).find((i) => i.invoiceNumber === "INV-2026-003852");
    return {
      foundInvoice: !!rowData,
      renderedRow: rowData,
      storageInvoice: inv ? { count: inv.bookingIds.length, bal: inv.balanceDue } : "NONE",
      isShowingSpinner: !!document.querySelector('.animate-spin'),
    };
  });
  console.log("  INV-2026-003852 visible:", adminAfter2.foundInvoice);
  console.log("  Rendered row:", JSON.stringify(adminAfter2.renderedRow));
  console.log("  localStorage invoice:", JSON.stringify(adminAfter2.storageInvoice));
  console.log("  Showing spinner:", adminAfter2.isShowingSpinner);

  // ── Now refresh admin page ──
  console.log("\n--- AFTER MANUAL REFRESH (tab 2) ---");
  await adminPage.reload({ waitUntil: "networkidle0" });
  await adminPage.waitForSelector("h1", { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 1500));

  const adminAfterRefresh = await adminPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("tr"));
    let rowData = null;
    for (const row of rows) {
      if (row.textContent?.includes("INV-2026-003852")) {
        const cells = Array.from(row.querySelectorAll("td"));
        rowData = cells.map((c) => c.textContent?.trim());
      }
    }
    return { foundInvoice: !!rowData, renderedRow: rowData };
  });
  console.log("  INV-2026-003852 visible:", adminAfterRefresh.foundInvoice);
  console.log("  Rendered row:", JSON.stringify(adminAfterRefresh.renderedRow));

  await browser.close();
}

run().catch((err) => { console.error("Test failed:", err.message); process.exit(1); });
