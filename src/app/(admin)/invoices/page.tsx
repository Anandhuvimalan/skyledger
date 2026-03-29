"use client";

import { useState } from "react";
import { Download, Filter, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  getBookingNetDue,
  getInvoiceStatus,
  getPendingSettlementBookings,
  getSeatTypeLabel,
  type Invoice,
} from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

export default function AdminInvoicesPage() {
  const state = useDemoStore();
  const loading = useDemoStore((store) => store.loading);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<Invoice["status"] | "ALL">("ALL");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const invoices = state.invoices;
  const agents = state.agents;
  const bookings = state.bookings;
  const pendingBookings = getPendingSettlementBookings(state)
    .sort((left, right) => right.bookingDate.localeCompare(left.bookingDate));

  const filteredInvoices = invoices.filter((invoice) => {
    const agent = agents.find((item) => item.id === invoice.agentId);
    const normalized = searchTerm.toLowerCase();
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(normalized) ||
      agent?.name.toLowerCase().includes(normalized);
    const computedStatus = getInvoiceStatus(invoice);
    const matchesStatus = statusFilter === "ALL" || computedStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const selectedInvoiceBookings = bookings.filter((booking) =>
    selectedInvoice?.bookingIds.includes(booking.id)
  );

  const handleGenerateBatch = async () => {
    try {
      const result = await state.generateSettlementBatch();

      setMessage(
        result.created > 0
          ? `Generated ${result.created} legacy backlog invoice${result.created === 1 ? "" : "s"}: ${result.invoiceNumbers.join(", ")}`
          : "Legacy settlement backlog is already clear."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate settlement backlog.");
    }
  };

  const handleExport = () => {
    downloadCsv(
      "arc-invoices.csv",
      ["Invoice Number", "Agent", "Issue Date", "Due Date", "Status", "Balance Due"],
      filteredInvoices.map((invoice) => [
        invoice.invoiceNumber,
        agents.find((agent) => agent.id === invoice.agentId)?.name ?? "Unknown Agent",
        invoice.issueDate,
        invoice.dueDate,
        getInvoiceStatus(invoice),
        invoice.balanceDue.toFixed(2),
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ARC Settlements & Invoices</h1>
          <p className="mt-1 text-muted-foreground">
            New tickets are invoiced automatically when they are issued. Use this screen to monitor collections and review invoice detail by agency.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export AR Report
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      ) : null}

      {pendingBookings.length > 0 ? (
        <Card>
          <CardHeader className="border-b">
            <div>
              <h2 className="text-lg font-semibold">Legacy Settlement Backlog</h2>
              <p className="text-sm text-muted-foreground">
                These older bookings are not yet tied to an invoice. Normal ticketing no longer needs a manual batch step.
              </p>
            </div>
            <div className="flex justify-end">
              <Button className="gap-2" onClick={() => void handleGenerateBatch()} disabled={loading}>
                Invoice Backlog
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Booked On</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Gross Sales</TableHead>
                  <TableHead className="text-right">Net Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingBookings.slice(0, 8).map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{booking.ticketNumber}</TableCell>
                    <TableCell>
                      {agents.find((agent) => agent.id === booking.agentId)?.name ?? "Unknown Agent"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{booking.bookingDate}</TableCell>
                    <TableCell>{booking.origin}-{booking.destination}</TableCell>
                    <TableCell className="text-right">{formatCurrency(booking.baseFare + booking.taxes)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(getBookingNetDue(booking))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="space-y-4 border-b bg-muted/20 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice or agency..."
                className="bg-background pl-8"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(["ALL", "UNPAID", "OVERDUE", "PAID"] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => setStatusFilter(status)}
                >
                  <Filter className="h-4 w-4" />
                  {status === "ALL" ? "All Invoices" : status}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Travel Agency</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Gross Sales</TableHead>
                <TableHead className="text-right">Commission Credit</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const agent = agents.find((item) => item.id === invoice.agentId);
                const status = getInvoiceStatus(invoice);

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-semibold text-primary/80">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="font-medium">{agent?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{invoice.issueDate}</TableCell>
                    <TableCell className={status !== "PAID" ? "font-medium text-amber-600" : "text-muted-foreground"}>
                      {invoice.dueDate}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.subtotal)}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {formatCurrency(invoice.commissionCredit)}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(invoice.balanceDue)}</TableCell>
                    <TableCell>
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(invoice)}>
                          View Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `/api/invoices/${invoice.id}/download`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                        >
                          Download PDF
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
                  {agents.find((agent) => agent.id === selectedInvoice.agentId)?.name} | Balance due{" "}
                  {formatCurrency(selectedInvoice.balanceDue)}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-4">
                <InfoBlock label="Issue Date" value={selectedInvoice.issueDate} />
                <InfoBlock label="Due Date" value={selectedInvoice.dueDate} />
                <InfoBlock label="Status" value={getInvoiceStatus(selectedInvoice)} />
                <InfoBlock label="Booking Count" value={String(selectedInvoice.bookingIds.length)} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <InfoBlock label="Gross Sales" value={formatCurrency(selectedInvoice.subtotal)} />
                <InfoBlock label="Commission Credit" value={formatCurrency(selectedInvoice.commissionCredit)} />
                <InfoBlock label="Balance Due" value={formatCurrency(selectedInvoice.balanceDue)} />
              </div>

              <Table>
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
                  {selectedInvoiceBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.ticketNumber}</TableCell>
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
    return <Badge variant="secondary" className="bg-emerald-100/60 text-emerald-700">Settled</Badge>;
  }

  if (status === "OVERDUE") {
    return <Badge variant="destructive">Overdue</Badge>;
  }

  if (status === "DRAFT") {
    return <Badge variant="outline">Draft</Badge>;
  }

  return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Awaiting Payment</Badge>;
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
