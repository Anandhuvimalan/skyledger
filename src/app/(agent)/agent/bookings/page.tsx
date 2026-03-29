"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Filter, Loader2, Search } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadCsv } from "@/lib/client-download";
import {
  formatCurrency,
  getAgentBookings,
  getBookingPassengers,
  getBookingCommission,
  getBookingGross,
  getBookingSettlementStatus,
  getCurrentAgent,
  getInvoiceById,
  getSeatTypeLabel,
  type Booking,
  type Invoice,
} from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

function AgentBookingsContent() {
  const searchParams = useSearchParams();
  const state = useDemoStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const bookings = getAgentBookings(state, state.currentAgentId);
  const invoices = state.invoices;
  const currentAgent = getCurrentAgent(state);

  const filteredBookings = bookings.filter((booking) => {
    const normalized = searchTerm.toUpperCase();
    const passengers = getBookingPassengers(state, booking.id);
    return (
      booking.pnr.includes(normalized) ||
      booking.ticketNumber.includes(searchTerm) ||
      `${booking.origin}-${booking.destination}`.includes(normalized) ||
      passengers.some(
        (passenger) =>
          passenger.fullName.toUpperCase().includes(normalized) ||
          passenger.passportId.toUpperCase().includes(normalized)
      )
    );
  });

  const unpaidCount = bookings.filter((booking) => {
    const status = getBookingSettlementStatus(booking, getInvoiceById(state, booking.invoiceId));
    return status === "UNPAID" || status === "OVERDUE";
  }).length;
  const createdTicket = searchParams.get("created");
  const createdBooking = createdTicket
    ? bookings.find((booking) => booking.ticketNumber === createdTicket)
    : null;
  const createdBookingInvoice = createdBooking
    ? getInvoiceById(state, createdBooking.invoiceId)
    : undefined;
  const selectedInvoice = getInvoiceById(state, selectedBooking?.invoiceId);
  const selectedPassengers = getBookingPassengers(state, selectedBooking?.id);

  const handleExport = () => {
    downloadCsv(
      "agent-bookings.csv",
      ["Ticket Number", "PNR", "Booking Date", "Route", "Lead Passenger", "Seat Type", "Passengers", "Gross", "Commission", "Status"],
      filteredBookings.map((booking) => [
        booking.ticketNumber,
        booking.pnr,
        booking.bookingDate,
        `${booking.origin}-${booking.destination}`,
        booking.travelerName,
        getSeatTypeLabel(booking.seatType),
        String(booking.passengers),
        getBookingGross(booking).toFixed(2),
        getBookingCommission(booking).toFixed(2),
        getBookingSettlementStatus(booking, getInvoiceById(state, booking.invoiceId)),
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Bookings</h1>
          <p className="mt-1 text-muted-foreground">
            Review {currentAgent?.name}&apos;s ticket activity, commissions, and settlement status.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/agent/customer-bills"
            className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Customer Bills
          </Link>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {createdTicket ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            createdBooking
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {createdBooking
            ? createdBookingInvoice
              ? `Ticket ${createdTicket} was created successfully and added to invoice ${createdBookingInvoice.invoiceNumber}. Passenger bills are ready on the Customer Bills page and inside booking detail.`
              : `Ticket ${createdTicket} was created successfully and is waiting for the next settlement batch.`
            : `Ticket ${createdTicket} is not in the current booking state yet. Refresh once and verify the settlement queue before continuing.`}
        </div>
      ) : null}

      <Card>
        <Tabs defaultValue="all" className="w-full">
          <CardHeader className="space-y-4 border-b pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="all">All Bookings</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid / Open ({unpaidCount})</TabsTrigger>
                <TabsTrigger value="paid">Settled</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search PNR, ticket, route..."
                    className="w-[250px] bg-background pl-8"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <TabsContent value="all" className="m-0 border-none">
              <BookingsTable data={filteredBookings} invoices={invoices} onView={setSelectedBooking} />
            </TabsContent>
            <TabsContent value="unpaid" className="m-0 border-none">
              <BookingsTable
                data={filteredBookings.filter(
                  (booking) => {
                    const status = getBookingSettlementStatus(
                      booking,
                      getInvoiceById(state, booking.invoiceId)
                    );

                    return status === "UNPAID" || status === "OVERDUE";
                  }
                )}
                invoices={invoices}
                onView={setSelectedBooking}
              />
            </TabsContent>
            <TabsContent value="paid" className="m-0 border-none">
              <BookingsTable
                data={filteredBookings.filter(
                  (booking) =>
                    getBookingSettlementStatus(booking, getInvoiceById(state, booking.invoiceId)) ===
                    "PAID"
                )}
                invoices={invoices}
                onView={setSelectedBooking}
              />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <Dialog open={selectedBooking !== null} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-xl">
          {selectedBooking ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedBooking.ticketNumber}</DialogTitle>
                <DialogDescription>
                  {selectedBooking.origin}-{selectedBooking.destination} | Flight {selectedBooking.flightDate}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoBlock label="Gross Fare" value={formatCurrency(getBookingGross(selectedBooking))} />
                <InfoBlock label="Commission" value={formatCurrency(getBookingCommission(selectedBooking))} />
                <InfoBlock
                  label="Settlement"
                  value={
                    selectedBooking.invoiceId && selectedInvoice
                      ? `${selectedInvoice.invoiceNumber} (${getBookingSettlementStatus(selectedBooking, selectedInvoice)})`
                      : "Pending next batch"
                  }
                />
                <InfoBlock label="Passengers" value={String(selectedBooking.passengers)} />
                <InfoBlock label="Seat Type" value={getSeatTypeLabel(selectedBooking.seatType)} />
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Passenger Bills</h3>
                  <p className="text-xs text-muted-foreground">
                    Each traveler has an individual bill with name, passport ID, seat assignment, and charge amount.
                  </p>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Passenger</TableHead>
                      <TableHead>Passport ID</TableHead>
                      <TableHead>Seat</TableHead>
                      <TableHead>Cabin</TableHead>
                      <TableHead className="text-right">Bill Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPassengers.map((passenger) => (
                      <TableRow key={passenger.id}>
                        <TableCell className="font-medium">{passenger.fullName}</TableCell>
                        <TableCell>{passenger.passportId}</TableCell>
                        <TableCell>{passenger.seatNumber}</TableCell>
                        <TableCell>{getSeatTypeLabel(passenger.seatType)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(passenger.totalAmount)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(
                                `/api/bookings/${selectedBooking.id}/passengers/${passenger.id}/download`,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                          >
                            Download Bill
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AgentBookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AgentBookingsContent />
    </Suspense>
  );
}

function BookingsTable({
  data,
  invoices,
  onView,
}: {
  data: Booking[];
  invoices: Invoice[];
  onView: (booking: Booking) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Ticket Number</TableHead>
            <TableHead>PNR</TableHead>
            <TableHead>Issue Date</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Lead Passenger</TableHead>
            <TableHead>Cabin</TableHead>
            <TableHead className="text-right">Gross</TableHead>
            <TableHead className="text-right">Commission</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                No bookings found matching your criteria.
              </TableCell>
            </TableRow>
          ) : (
            data.map((booking) => {
              const invoice = invoices.find((item) => item.id === booking.invoiceId);
              const status = getBookingSettlementStatus(booking, invoice);

              return (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.ticketNumber}</TableCell>
                  <TableCell>{booking.pnr}</TableCell>
                  <TableCell className="text-muted-foreground">{booking.bookingDate}</TableCell>
                  <TableCell>{booking.origin}-{booking.destination}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div>{booking.travelerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {booking.passengers > 1 ? `${booking.passengers} travelers` : "1 traveler"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getSeatTypeLabel(booking.seatType)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(getBookingGross(booking))}</TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {formatCurrency(getBookingCommission(booking))}
                  </TableCell>
                  <TableCell>
                    {status === "PENDING_BATCH" ? (
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                        Pending Batch
                      </Badge>
                    ) : status === "PAID" ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                        Settled via ARC
                      </Badge>
                    ) : status === "OVERDUE" ? (
                      <Badge variant="destructive">Overdue</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                        Open Invoice
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => onView(booking)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
