"use client";

import { Download, ReceiptText, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  getAgentBookings,
  getBookingPassengers,
  getInvoiceById,
  getSeatTypeLabel,
} from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

function getRowKey(bookingId: string, passengerId: string) {
  return `${bookingId}:${passengerId}`;
}

export default function AgentCustomerBillsPage() {
  const state = useDemoStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const bookings = getAgentBookings(state, state.currentAgentId);
  const rows = useMemo(
    () =>
      bookings.flatMap((booking) => {
        const invoice = getInvoiceById(state, booking.invoiceId);
        const passengers = getBookingPassengers(state, booking.id);

        return passengers.map((passenger) => ({
          booking,
          passenger,
          invoice,
          billNumber: `${booking.ticketNumber}-${String(passenger.sequence).padStart(2, "0")}`,
        }));
      }),
    [bookings, state]
  );

  const normalizedSearch = searchTerm.trim().toUpperCase();
  const filteredRows = rows.filter((row) => {
    if (!normalizedSearch) {
      return true;
    }

    return (
      row.billNumber.toUpperCase().includes(normalizedSearch) ||
      row.booking.ticketNumber.toUpperCase().includes(normalizedSearch) ||
      row.passenger.fullName.toUpperCase().includes(normalizedSearch) ||
      row.passenger.passportId.toUpperCase().includes(normalizedSearch) ||
      `${row.booking.origin}-${row.booking.destination}`.toUpperCase().includes(normalizedSearch) ||
      (row.invoice?.invoiceNumber.toUpperCase().includes(normalizedSearch) ?? false)
    );
  });

  const totalBilled = filteredRows.reduce((sum, row) => sum + row.passenger.totalAmount, 0);
  const openInvoiceCount = new Set(
    filteredRows
      .filter((row) => row.invoice && row.invoice.balanceDue > 0)
      .map((row) => row.invoice?.id)
      .filter(Boolean)
  ).size;
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const selectedRows = rows.filter((row) =>
    selectedKeySet.has(getRowKey(row.booking.id, row.passenger.id))
  );
  const visibleKeys = filteredRows.map((row) => getRowKey(row.booking.id, row.passenger.id));
  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeySet.has(key));
  const selectedCount = selectedRows.length;

  function setRowSelected(bookingId: string, passengerId: string, checked: boolean) {
    const key = getRowKey(bookingId, passengerId);
    setSelectedKeys((current) => {
      if (checked) {
        return current.includes(key) ? current : [...current, key];
      }

      return current.filter((item) => item !== key);
    });
  }

  function setVisibleSelected(checked: boolean) {
    setSelectedKeys((current) => {
      const next = new Set(current);

      for (const key of visibleKeys) {
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }

      return Array.from(next);
    });
  }

  async function downloadSelectedBills() {
    if (selectedRows.length === 0) {
      setDownloadError("Select at least one customer bill.");
      return;
    }

    try {
      setIsDownloading(true);
      setDownloadError("");

      const response = await fetch("/api/customer-bills/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: selectedRows.map((row) => ({
            bookingId: row.booking.id,
            passengerId: row.passenger.id,
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to download the selected bills.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename=\"?([^"]+)\"?/i)?.[1] ??
        `customer-bills-${new Date().toISOString().slice(0, 10)}.pdf`;

      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Unable to download the selected bills."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Bills</h1>
          <p className="mt-1 text-muted-foreground">
            Separate passenger-facing bills, ready to download and send directly to each traveler.
          </p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search passenger, passport, ticket, invoice..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Bills Ready" value={String(filteredRows.length)} />
        <SummaryCard label="Customer Charges" value={formatCurrency(totalBilled)} />
        <SummaryCard label="Open Agency Invoices" value={String(openInvoiceCount)} />
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            Passenger Bill Register
          </CardTitle>
          <CardDescription>
            Each row is a separate customer bill with traveler identity, seat assignment, and charge amount.
            Select multiple rows to export one combined PDF packet.
          </CardDescription>
          <div className="flex flex-col gap-3 pt-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedCount === 0
                ? "No customer bills selected."
                : `${selectedCount} customer bill${selectedCount === 1 ? "" : "s"} selected.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedKeys([])}
                disabled={selectedCount === 0 || isDownloading}
              >
                Clear Selection
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={downloadSelectedBills}
                disabled={selectedCount === 0 || isDownloading}
              >
                <Download className="h-4 w-4" />
                {isDownloading ? "Preparing PDF..." : "Download Selected PDF"}
              </Button>
            </div>
          </div>
          {downloadError ? <p className="text-sm text-destructive">{downloadError}</p> : null}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => setVisibleSelected(checked === true)}
                    aria-label="Select all visible customer bills"
                  />
                </TableHead>
                <TableHead>Bill #</TableHead>
                <TableHead>Passenger</TableHead>
                <TableHead>Passport ID</TableHead>
                <TableHead>Ticket</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Seat</TableHead>
                <TableHead>Cabin</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    No customer bills match the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => (
                  <TableRow key={row.passenger.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedKeySet.has(getRowKey(row.booking.id, row.passenger.id))}
                        onCheckedChange={(checked) =>
                          setRowSelected(row.booking.id, row.passenger.id, checked === true)
                        }
                        aria-label={`Select bill ${row.billNumber}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{row.billNumber}</TableCell>
                    <TableCell>{row.passenger.fullName}</TableCell>
                    <TableCell>{row.passenger.passportId}</TableCell>
                    <TableCell>{row.booking.ticketNumber}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div>
                          {row.booking.origin}-{row.booking.destination}
                        </div>
                        <div className="text-xs text-muted-foreground">{row.booking.flightDate}</div>
                      </div>
                    </TableCell>
                    <TableCell>{row.passenger.seatNumber}</TableCell>
                    <TableCell>{getSeatTypeLabel(row.passenger.seatType)}</TableCell>
                    <TableCell>{row.invoice?.invoiceNumber ?? "Pending settlement"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(row.passenger.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          window.open(
                            `/api/bookings/${row.booking.id}/passengers/${row.passenger.id}/download`,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <Download className="h-4 w-4" />
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
