"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CreditCard, FileText, Ticket } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCurrency,
  getAgentBookings,
  getAgentInvoices,
  getCurrentAgent,
  getInvoiceStatus,
} from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

export default function AgentDashboard() {
  const state = useDemoStore();
  const currentAgent = getCurrentAgent(state);
  const bookings = getAgentBookings(state, state.currentAgentId);
  const invoices = getAgentInvoices(state, state.currentAgentId);

  const openInvoices = invoices.filter((invoice) => {
    const status = getInvoiceStatus(invoice);
    return status === "UNPAID" || status === "OVERDUE";
  });
  const outstandingBalance = openInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  const commissionEarned = bookings.reduce(
    (sum, booking) => sum + booking.baseFare * booking.commissionRate,
    0
  );
  const recentBookings = bookings
    .sort((left, right) => right.bookingDate.localeCompare(left.bookingDate))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Agent Dashboard</h1>
        <p className="text-muted-foreground">
          {currentAgent?.name} | ARC {currentAgent?.arcNumber}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Outstanding Balance"
          value={formatCurrency(outstandingBalance)}
          description={openInvoices.length > 0 ? `Next invoice due ${openInvoices[0].dueDate}` : "No open invoices"}
          icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Open Invoices"
          value={String(openInvoices.length)}
          description="Pay or defer balances from the invoices workspace"
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Commissions Earned"
          value={formatCurrency(commissionEarned)}
          description={`${currentAgent?.tier ?? "Tier"} override across all current bookings`}
          icon={<Ticket className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Ticket Activity</CardTitle>
          <Link href="/agent/book-flight" className="text-sm font-medium text-primary hover:underline">
            Book another flight
          </Link>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tickets have been issued from this agency yet.
            </p>
          ) : (
            <div className="space-y-4">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="flex justify-between border-t pt-4 text-sm font-medium first:border-t-0 first:pt-0">
                  <div>
                    <span className="block">{booking.ticketNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {booking.origin}-{booking.destination} | Flight {booking.flightDate}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block">{formatCurrency(booking.baseFare + booking.taxes)}</span>
                    <span className="text-xs text-muted-foreground">
                      {booking.invoiceId ? "Assigned to invoice" : "Awaiting invoice assignment"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
