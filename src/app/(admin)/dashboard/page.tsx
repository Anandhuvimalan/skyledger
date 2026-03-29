"use client";

import type { ReactNode } from "react";
import { Activity, DollarSign, Ticket, Users } from "lucide-react";

import { RevenueChart } from "@/components/revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildRevenueChartData,
  formatCurrency,
  formatRoute,
  getBookingNetDue,
  getInvoiceStatus,
} from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

export default function AdminDashboard() {
  const bookings = useDemoStore((state) => state.bookings);
  const agents = useDemoStore((state) => state.agents);
  const invoices = useDemoStore((state) => state.invoices);
  const nowIso = useDemoStore((state) => state.nowIso);

  const currentMonth = nowIso.slice(0, 7);
  const currentMonthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${currentMonth}-01T00:00:00.000Z`));

  const recognizedRevenue = bookings
    .filter((booking) => booking.revenueStatus === "RECOGNIZED")
    .reduce((sum, booking) => sum + booking.baseFare, 0);
  const deferredRevenue = bookings
    .filter((booking) => booking.revenueStatus === "DEFERRED")
    .reduce((sum, booking) => sum + booking.baseFare, 0);
  const activeAgents = agents.filter((agent) => agent.status === "ACTIVE").length;
  const monthlyTickets = bookings.filter((booking) => booking.bookingDate.startsWith(currentMonth)).length;
  const overdueInvoices = invoices.filter((invoice) => getInvoiceStatus(invoice) === "OVERDUE").length;
  const recentActivity = [...bookings]
    .sort((left, right) => right.bookingDate.localeCompare(left.bookingDate))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground">
          Live metrics across settlements, deferred revenue, and travel agent activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Recognized Revenue"
          value={formatCurrency(recognizedRevenue)}
          description="Revenue released after flown travel"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Air Traffic Liability"
          value={formatCurrency(deferredRevenue)}
          description="Outstanding deferred ticket value"
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Active Agents"
          value={String(activeAgents)}
          description={`${overdueInvoices} accounts need settlement follow-up`}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title={`${currentMonthLabel} Tickets`}
          value={String(monthlyTickets)}
          description="Bookings created in the current accounting month"
          icon={<Ticket className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Revenue Release Trend</CardTitle>
          </CardHeader>
          <CardContent className="pl-2 pt-4">
            <RevenueChart data={buildRevenueChartData(bookings)} />
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Travel Agent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 border-t pt-4">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings have been ticketed yet.</p>
            ) : (
              recentActivity.map((booking) => (
                <div key={booking.id} className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                    {booking.ticketNumber.slice(-4)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-none">{formatRoute(booking.origin, booking.destination)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ticket {booking.ticketNumber} issued on {booking.bookingDate}
                    </p>
                  </div>
                  <div className="text-right text-sm font-medium">
                    {formatCurrency(getBookingNetDue(booking))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
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
