import { requireSession } from "@/lib/server/auth";
import { renderPaymentReceiptHtml, renderPdf } from "@/lib/server/documents";
import { getPaymentDocument } from "@/lib/server/state";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await context.params;
  const { payment, invoice, agent } = getPaymentDocument(session, id);
  const pdf = await renderPdf(
    renderPaymentReceiptHtml({
      payment,
      invoice,
      agent,
    })
  );

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payment-${payment.id}.pdf"`,
    },
  });
}
