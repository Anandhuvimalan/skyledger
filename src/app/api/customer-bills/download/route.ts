import { requireSession } from "@/lib/server/auth";
import { renderCustomerBillPacketHtml, renderPdf } from "@/lib/server/documents";
import { getCustomerBillDocuments } from "@/lib/server/state";

type DownloadBody = {
  items?: Array<{
    bookingId?: string;
    passengerId?: string;
  }>;
};

function getDownloadFilename() {
  const dateLabel = new Intl.DateTimeFormat("en-CA").format(new Date());
  return `customer-bills-${dateLabel}.pdf`;
}

export async function POST(request: Request) {
  const session = await requireSession();
  const body = (await request.json().catch(() => null)) as DownloadBody | null;
  const items =
    body?.items?.filter(
      (item): item is { bookingId: string; passengerId: string } =>
        typeof item.bookingId === "string" && typeof item.passengerId === "string"
    ) ?? [];

  if (items.length === 0) {
    return Response.json({ error: "Select at least one customer bill." }, { status: 400 });
  }

  const documents = getCustomerBillDocuments(session, items.slice(0, 100));
  const pdf = await renderPdf(
    renderCustomerBillPacketHtml({
      documents,
    })
  );

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${getDownloadFilename()}"`,
    },
  });
}
