import puppeteer from "puppeteer";

import {
  formatCurrency,
  formatRoute,
  getBookingNetDue,
  type Booking,
  type BookingPassenger,
  type Invoice,
  type Payment,
  type TravelAgent,
} from "@/lib/demo-data";
import { getSeatTypeLabel } from "@/lib/demo-data";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function renderDocumentHtml(title: string, pages: string[]) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
      }
      body {
        font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: #17212b;
        background: #ffffff;
        font-variant-numeric: tabular-nums;
      }
      .page {
        padding: 0 0 6mm;
      }
      .page:not(:last-child) {
        page-break-after: always;
      }
      .header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 200px;
        gap: 24px;
        align-items: start;
        padding-bottom: 14px;
        border-bottom: 2px solid #1f2937;
      }
      .brand {
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 700;
      }
      .eyebrow {
        margin-top: 12px;
        font-size: 10px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #374151;
        font-weight: 700;
      }
      h1 {
        margin: 10px 0 6px;
        font-size: 28px;
        line-height: 1.15;
        color: #111827;
        font-weight: 700;
      }
      .subtitle {
        margin: 0;
        max-width: 620px;
        font-size: 13px;
        line-height: 1.55;
        color: #4b5563;
      }
      .header-meta {
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 14px 16px;
      }
      .header-meta-row + .header-meta-row {
        margin-top: 12px;
      }
      .header-meta-label {
        display: block;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 700;
      }
      .header-meta-value {
        display: block;
        margin-top: 6px;
        font-size: 13px;
        font-weight: 600;
        color: #111827;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-top: 18px;
      }
      .metric {
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 12px 14px;
        background: #ffffff;
      }
      .metric-label {
        display: block;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 700;
      }
      .metric-value {
        display: block;
        margin-top: 8px;
        font-size: 18px;
        line-height: 1.3;
        font-weight: 700;
        color: #111827;
      }
      .section {
        margin-top: 18px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        overflow: hidden;
        background: #ffffff;
      }
      .section-head {
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        background: #f8fafc;
      }
      .section-head h2 {
        margin: 0;
        font-size: 15px;
        color: #111827;
      }
      .section-head p {
        margin: 5px 0 0;
        font-size: 12px;
        color: #4b5563;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        padding: 16px;
      }
      .detail-card {
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 12px 14px;
        background: #ffffff;
      }
      .detail-card span {
        display: block;
      }
      .detail-label {
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 700;
      }
      .detail-value {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.45;
        font-weight: 600;
        color: #111827;
      }
      .totals {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        padding: 16px;
      }
      .total-card {
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 14px 16px;
        background: #ffffff;
      }
      .total-card .label {
        display: block;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 700;
      }
      .total-card .value {
        display: block;
        margin-top: 8px;
        font-size: 21px;
        font-weight: 700;
        color: #111827;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      thead {
        background: #f3f4f6;
      }
      th, td {
        padding: 11px 14px;
        border-bottom: 1px solid #e5e7eb;
        text-align: left;
        font-size: 12px;
        vertical-align: top;
      }
      th {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #4b5563;
        font-weight: 700;
      }
      td strong {
        color: #111827;
      }
      .align-right {
        text-align: right;
      }
      .muted {
        color: #6b7280;
      }
      .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px;
        padding-top: 10px;
        border-top: 1px solid #e5e7eb;
        font-size: 11px;
        color: #6b7280;
      }
      tr {
        page-break-inside: avoid;
      }
    </style>
  </head>
  <body>
    ${pages.join("")}
  </body>
</html>`;
}

function renderDocumentPage({
  title,
  eyebrow,
  subtitle,
  body,
}: {
  title: string;
  eyebrow: string;
  subtitle: string;
  body: string;
}) {
  return `
    <section class="page">
      <div class="header">
        <div>
          <div class="brand">SkyLedger Aviation Finance</div>
          <div class="eyebrow">${escapeHtml(eyebrow)}</div>
          <h1>${escapeHtml(title)}</h1>
          <p class="subtitle">${escapeHtml(subtitle)}</p>
        </div>
        <div class="header-meta">
          <div class="header-meta-row">
            <span class="header-meta-label">Document Type</span>
            <span class="header-meta-value">${escapeHtml(eyebrow)}</span>
          </div>
          <div class="header-meta-row">
            <span class="header-meta-label">Generated On</span>
            <span class="header-meta-value">${escapeHtml(formatLongDate(new Date().toISOString()))}</span>
          </div>
        </div>
      </div>
      ${body}
      <div class="footer">
        <span>Generated by SkyLedger</span>
        <span>Prepared for travel agency and airline records</span>
      </div>
    </section>
  `;
}

function wrapDocument({
  title,
  eyebrow,
  subtitle,
  body,
}: {
  title: string;
  eyebrow: string;
  subtitle: string;
  body: string;
}) {
  return renderDocumentHtml(title, [renderDocumentPage({ title, eyebrow, subtitle, body })]);
}

export function renderInvoiceHtml({
  invoice,
  agent,
  bookings,
  bookingPassengers,
  payments,
}: {
  invoice: Invoice;
  agent?: TravelAgent;
  bookings: Booking[];
  bookingPassengers: BookingPassenger[];
  payments: Payment[];
}) {
  const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const passengersByBooking = new Map<string, BookingPassenger[]>();

  for (const passenger of bookingPassengers) {
    const bucket = passengersByBooking.get(passenger.bookingId) ?? [];
    bucket.push(passenger);
    passengersByBooking.set(passenger.bookingId, bucket);
  }

  return wrapDocument({
    title: `Invoice ${invoice.invoiceNumber}`,
    eyebrow: "ARC Settlement Invoice",
    subtitle:
      "Auto-issued when tickets are created. This PDF summarizes ticket activity, agency credits, and the balance still due to the airline.",
    body: `
      <div class="metrics">
        <div class="metric">
          <span class="metric-label">Travel Agency</span>
          <span class="metric-value">${escapeHtml(agent?.name ?? "Unknown Agent")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">ARC / IATA</span>
          <span class="metric-value">${escapeHtml(agent?.arcNumber ?? "N/A")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Issue Date</span>
          <span class="metric-value">${escapeHtml(formatLongDate(invoice.issueDate))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Due Date</span>
          <span class="metric-value">${escapeHtml(formatLongDate(invoice.dueDate))}</span>
        </div>
      </div>

      <section class="section">
        <div class="section-head">
          <h2>Settlement Summary</h2>
          <p>Ticketed sales, agency credit, payments applied, and current outstanding balance.</p>
        </div>
        <div class="totals">
          <div class="total-card">
            <span class="label">Gross Sales</span>
            <div class="value">${formatCurrency(invoice.subtotal)}</div>
          </div>
          <div class="total-card">
            <span class="label">Commission Credit</span>
            <div class="value">${formatCurrency(invoice.commissionCredit)}</div>
          </div>
          <div class="total-card">
            <span class="label">Balance Due</span>
            <div class="value">${formatCurrency(invoice.balanceDue)}</div>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-card">
            <span class="detail-label">Invoice Status</span>
            <span class="detail-value">${escapeHtml(invoice.status)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Payments Applied</span>
            <span class="detail-value">${formatCurrency(paidAmount)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Taxes</span>
            <span class="detail-value">${formatCurrency(invoice.taxes)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Bookings</span>
            <span class="detail-value">${bookings.length}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Ticket Line Items</h2>
          <p>Each ticket issued into this invoice, including traveler and route detail.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Lead Traveler</th>
              <th>Route</th>
              <th>Flight Date</th>
              <th>Cabin</th>
              <th>Pax</th>
              <th class="align-right">Net Due</th>
            </tr>
          </thead>
          <tbody>
            ${
              bookings.length === 0
                ? `<tr><td colspan="7" class="muted">No line items are attached to this invoice.</td></tr>`
                : bookings
                    .map(
                      (booking) => `<tr>
                        <td><strong>${escapeHtml(booking.ticketNumber)}</strong></td>
                        <td>${escapeHtml(booking.travelerName)}</td>
                        <td>${escapeHtml(formatRoute(booking.origin, booking.destination))}</td>
                        <td>${escapeHtml(formatLongDate(booking.flightDate))}</td>
                        <td>${escapeHtml(getSeatTypeLabel(booking.seatType))}</td>
                        <td>${booking.passengers}</td>
                        <td class="align-right"><strong>${formatCurrency(getBookingNetDue(booking))}</strong></td>
                      </tr>`
                    )
                    .join("")
            }
          </tbody>
        </table>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Passenger Manifest</h2>
          <p>Passenger-level names, passport IDs, seat assignments, and customer-facing charges.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Passenger</th>
              <th>Passport ID</th>
              <th>Seat</th>
              <th>Cabin</th>
              <th class="align-right">Customer Bill</th>
            </tr>
          </thead>
          <tbody>
            ${
              bookings.length === 0
                ? `<tr><td colspan="6" class="muted">No passenger records are attached to this invoice.</td></tr>`
                : bookings
                    .flatMap((booking) =>
                      (passengersByBooking.get(booking.id) ?? []).map(
                        (passenger) => `<tr>
                          <td><strong>${escapeHtml(booking.ticketNumber)}</strong></td>
                          <td>${escapeHtml(passenger.fullName)}</td>
                          <td>${escapeHtml(passenger.passportId)}</td>
                          <td>${escapeHtml(passenger.seatNumber)}</td>
                          <td>${escapeHtml(getSeatTypeLabel(passenger.seatType))}</td>
                          <td class="align-right"><strong>${formatCurrency(passenger.totalAmount)}</strong></td>
                        </tr>`
                      )
                    )
                    .join("")
            }
          </tbody>
        </table>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Applied Payments</h2>
          <p>Payments already posted back into SkyLedger against this invoice.</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Payment Date</th>
              <th>Method</th>
              <th>Status</th>
              <th class="align-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${
              payments.length === 0
                ? `<tr><td colspan="4" class="muted">No payments have been applied yet.</td></tr>`
                : payments
                    .map(
                      (payment) => `<tr>
                        <td>${escapeHtml(formatLongDate(payment.paymentDate))}</td>
                        <td>${escapeHtml(`${payment.paymentMethod} ending in ${payment.cardLastFour}`)}</td>
                        <td>${escapeHtml(payment.status)}</td>
                        <td class="align-right"><strong>${formatCurrency(payment.amount)}</strong></td>
                      </tr>`
                    )
                    .join("")
            }
          </tbody>
        </table>
      </section>
    `,
  });
}

export function renderPaymentReceiptHtml({
  payment,
  invoice,
  agent,
}: {
  payment: Payment;
  invoice: Invoice;
  agent?: TravelAgent;
}) {
  return wrapDocument({
    title: `Payment Receipt ${payment.id}`,
    eyebrow: "Settlement Receipt",
    subtitle:
      "Generated after Stripe or manual settlement posting. This document confirms the value applied back against the invoice balance.",
    body: `
      <div class="metrics">
        <div class="metric">
          <span class="metric-label">Travel Agency</span>
          <span class="metric-value">${escapeHtml(agent?.name ?? "Unknown Agent")}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Invoice</span>
          <span class="metric-value">${escapeHtml(invoice.invoiceNumber)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Payment Date</span>
          <span class="metric-value">${escapeHtml(formatLongDate(payment.paymentDate))}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Amount Applied</span>
          <span class="metric-value">${formatCurrency(payment.amount)}</span>
        </div>
      </div>

      <section class="section">
        <div class="section-head">
          <h2>Receipt Detail</h2>
          <p>Settlement confirmation, payment method trace, and remaining invoice exposure.</p>
        </div>
        <div class="detail-grid">
          <div class="detail-card">
            <span class="detail-label">Payment Method</span>
            <span class="detail-value">${escapeHtml(`${payment.paymentMethod} ending in ${payment.cardLastFour}`)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Receipt Status</span>
            <span class="detail-value">${escapeHtml(payment.status)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Remaining Balance</span>
            <span class="detail-value">${formatCurrency(invoice.balanceDue)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Invoice Due Date</span>
            <span class="detail-value">${escapeHtml(formatLongDate(invoice.dueDate))}</span>
          </div>
        </div>
      </section>
    `,
  });
}

type CustomerBillDocumentInput = {
  booking: Booking;
  passenger: BookingPassenger;
  agent?: TravelAgent;
  invoice?: Invoice;
  airlineName: string;
};

function getCustomerBillNumber(booking: Booking, passenger: BookingPassenger) {
  return `${booking.ticketNumber}-${String(passenger.sequence).padStart(2, "0")}`;
}

function renderCustomerBillBody({
  booking,
  passenger,
  agent,
  invoice,
  airlineName,
}: CustomerBillDocumentInput) {
  const customerBillNumber = getCustomerBillNumber(booking, passenger);

  return `
      <div class="metrics">
        <div class="metric">
          <span class="metric-label">Passenger</span>
          <span class="metric-value">${escapeHtml(passenger.fullName)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Passport ID</span>
          <span class="metric-value">${escapeHtml(passenger.passportId)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Seat</span>
          <span class="metric-value">${escapeHtml(passenger.seatNumber)}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Amount Charged</span>
          <span class="metric-value">${formatCurrency(passenger.totalAmount)}</span>
        </div>
      </div>

      <section class="section">
        <div class="section-head">
          <h2>Itinerary Detail</h2>
          <p>Traveler identity, ticket reference, route, airline, and seat assignment.</p>
        </div>
        <div class="detail-grid">
          <div class="detail-card">
            <span class="detail-label">Ticket Number</span>
            <span class="detail-value">${escapeHtml(booking.ticketNumber)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">PNR</span>
            <span class="detail-value">${escapeHtml(booking.pnr)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Route</span>
            <span class="detail-value">${escapeHtml(formatRoute(booking.origin, booking.destination))}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Flight Date</span>
            <span class="detail-value">${escapeHtml(formatLongDate(booking.flightDate))}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Cabin</span>
            <span class="detail-value">${escapeHtml(getSeatTypeLabel(passenger.seatType))}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Seat Number</span>
            <span class="detail-value">${escapeHtml(passenger.seatNumber)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Airline</span>
            <span class="detail-value">${escapeHtml(airlineName)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Issued By</span>
            <span class="detail-value">${escapeHtml(agent?.name ?? "Unknown Agent")}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Billing Summary</h2>
          <p>Passenger-level fare allocation for this itinerary.</p>
        </div>
        <div class="totals">
          <div class="total-card">
            <span class="label">Base Fare</span>
            <div class="value">${formatCurrency(passenger.baseFare)}</div>
          </div>
          <div class="total-card">
            <span class="label">Taxes & Fees</span>
            <div class="value">${formatCurrency(passenger.taxes)}</div>
          </div>
          <div class="total-card">
            <span class="label">Total Charged</span>
            <div class="value">${formatCurrency(passenger.totalAmount)}</div>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-card">
            <span class="detail-label">Bill Number</span>
            <span class="detail-value">${escapeHtml(customerBillNumber)}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Invoice Reference</span>
            <span class="detail-value">${escapeHtml(invoice?.invoiceNumber ?? "Pending agency settlement")}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Agency ARC</span>
            <span class="detail-value">${escapeHtml(agent?.arcNumber ?? "N/A")}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label">Booking Date</span>
            <span class="detail-value">${escapeHtml(formatLongDate(booking.bookingDate))}</span>
          </div>
        </div>
      </section>
    `;
}

export function renderCustomerBillHtml({
  booking,
  passenger,
  agent,
  invoice,
  airlineName,
}: CustomerBillDocumentInput) {
  const customerBillNumber = getCustomerBillNumber(booking, passenger);
  return wrapDocument({
    title: `Customer Bill ${customerBillNumber}`,
    eyebrow: "Passenger Travel Bill",
    subtitle:
      "Passenger-facing bill issued by the travel agency, including traveler identity, seat assignment, and the fare charged for this itinerary.",
    body: renderCustomerBillBody({
      booking,
      passenger,
      agent,
      invoice,
      airlineName,
    }),
  });
}

export function renderCustomerBillPacketHtml({
  documents,
}: {
  documents: CustomerBillDocumentInput[];
}) {
  return renderDocumentHtml(
    "Customer Bill Packet",
    documents.map((document) =>
      renderDocumentPage({
        title: `Customer Bill ${getCustomerBillNumber(document.booking, document.passenger)}`,
        eyebrow: "Passenger Travel Bill",
        subtitle:
          "Passenger-facing bill issued by the travel agency, including traveler identity, seat assignment, and the fare charged for this itinerary.",
        body: renderCustomerBillBody(document),
      })
    )
  );
}

export async function renderPdf(html: string) {
  const browser = await puppeteer.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    return Buffer.from(
      await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "14mm",
          bottom: "14mm",
          left: "12mm",
          right: "12mm",
        },
      })
    );
  } finally {
    await browser.close();
  }
}
