import { requireSession } from "@/lib/server/auth";
import { renderInvoiceHtml, renderPdf } from "@/lib/server/documents";
import { getInvoiceDocument } from "@/lib/server/state";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await context.params;
  const { invoice, agent, bookings, bookingPassengers, payments } = getInvoiceDocument(session, id);
  const pdf = await renderPdf(
    renderInvoiceHtml({
      invoice,
      agent,
      bookings,
      bookingPassengers,
      payments,
    })
  );

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
