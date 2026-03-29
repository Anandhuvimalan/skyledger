import { requireSession } from "@/lib/server/auth";
import { renderCustomerBillHtml, renderPdf } from "@/lib/server/documents";
import { getCustomerBillDocument } from "@/lib/server/state";

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookingId: string; passengerId: string }> }
) {
  const session = await requireSession();
  const { bookingId, passengerId } = await context.params;
  const { booking, passenger, agent, invoice, airlineName } = getCustomerBillDocument(
    session,
    bookingId,
    passengerId
  );
  const pdf = await renderPdf(
    renderCustomerBillHtml({
      booking,
      passenger,
      agent,
      invoice,
      airlineName,
    })
  );

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${booking.ticketNumber}-${passenger.sequence}.pdf"`,
    },
  });
}
