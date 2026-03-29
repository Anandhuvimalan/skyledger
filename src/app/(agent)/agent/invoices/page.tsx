"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Download, ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/client-download";
import {
  formatCurrency,
  getAgentInvoices,
  getBookingNetDue,
  getInvoiceStatus,
  getSeatTypeLabel,
  type Invoice,
} from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

export default function AgentInvoicesPage() {
  const router = useRouter();
  const state = useDemoStore();

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const invoices = getAgentInvoices(state, state.currentAgentId);
  const openInvoice = invoices.find((invoice) => {
    const status = getInvoiceStatus(invoice);
    return status === "UNPAID" || status === "OVERDUE";
  });
  const selectedBookings = state.bookings.filter((booking) =>
    selectedInvoice?.bookingIds.includes(booking.id)
  );

  const handleExport = () => {
    downloadCsv(
      "agent-invoices.csv",
      ["Invoice Number", "Issue Date", "Due Date", "Status", "Original Amount", "Balance Due"],
      invoices.map((invoice) => [
        invoice.invoiceNumber,
        invoice.issueDate,
        invoice.dueDate,
        getInvoiceStatus(invoice),
        invoice.totalDue.toFixed(2),
        invoice.balanceDue.toFixed(2),
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ARC Invoices</h1>
          <p className="mt-1 text-muted-foreground">
            Review weekly settlement invoices and launch payment directly from the latest open balance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/agent/customer-bills")}>
            Customer Bills
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            className="group gap-2 bg-primary hover:bg-primary/90"
            disabled={!openInvoice}
            onClick={() => openInvoice && router.push(`/agent/payments?invoice=${openInvoice.id}`)}
          >
            <CreditCard className="h-4 w-4 group-hover:animate-pulse" />
            {openInvoice ? "Pay Open Invoice" : "No Open Invoice"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Gross Sales</TableHead>
                <TableHead className="text-right text-emerald-600">Commission Credit</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const status = getInvoiceStatus(invoice);

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{invoice.issueDate}</TableCell>
                    <TableCell className={status === "PAID" ? "text-muted-foreground" : "font-medium text-amber-600"}>
                      {invoice.dueDate}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(invoice.subtotal)}
                    </TableCell>
                    <TableCell className="text-right font-medium text-emerald-600">
                      {formatCurrency(invoice.commissionCredit)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(invoice.balanceDue)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" title="View details" onClick={() => setSelectedInvoice(invoice)}>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Download invoice PDF"
                          onClick={() =>
                            window.open(
                              `/api/invoices/${invoice.id}/download`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Open payment page"
                          disabled={status === "PAID"}
                          onClick={() => router.push(`/agent/payments?invoice=${invoice.id}`)}
                        >
                          <CreditCard className="h-4 w-4 text-primary" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={selectedInvoice !== null} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-2xl">
          {selectedInvoice ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedInvoice.invoiceNumber}</DialogTitle>
                <DialogDescription>
                  Balance due {formatCurrency(selectedInvoice.balanceDue)} | Due {selectedInvoice.dueDate}
                </DialogDescription>
              </DialogHeader>

              <Table>
                <caption className="sr-only">Invoice booking detail</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Lead Passenger</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Cabin</TableHead>
                    <TableHead>Pax</TableHead>
                    <TableHead>Flight Date</TableHead>
                    <TableHead className="text-right">Net Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>{booking.ticketNumber}</TableCell>
                      <TableCell>{booking.travelerName}</TableCell>
                      <TableCell>{booking.origin}-{booking.destination}</TableCell>
                      <TableCell>{getSeatTypeLabel(booking.seatType)}</TableCell>
                      <TableCell>{booking.passengers}</TableCell>
                      <TableCell>{booking.flightDate}</TableCell>
                      <TableCell className="text-right">{formatCurrency(getBookingNetDue(booking))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="grid gap-4 sm:grid-cols-3">
                <SummaryCard label="Gross Sales" value={formatCurrency(selectedInvoice.subtotal)} />
                <SummaryCard label="Commission Credit" value={formatCurrency(selectedInvoice.commissionCredit)} />
                <SummaryCard label="Balance Due" value={formatCurrency(selectedInvoice.balanceDue)} />
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() =>
                    window.open(
                      `/api/invoices/${selectedInvoice.id}/download`,
                      "_blank",
                      "noopener,noreferrer"
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: "UNPAID" | "PAID" | "OVERDUE" | "DRAFT" }) {
  if (status === "PAID") {
    return <Badge variant="secondary" className="bg-emerald-100/60 text-emerald-700">Paid</Badge>;
  }

  if (status === "OVERDUE") {
    return <Badge variant="destructive">Overdue</Badge>;
  }

  return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Unpaid Settlement</Badge>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
