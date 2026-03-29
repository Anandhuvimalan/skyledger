"use client";

import React, { useState } from "react";
import {
  Activity,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  PlaneTakeoff,
  PlusCircle,
  ReceiptText,
  Ticket,
} from "lucide-react";

import { CopilotSheet } from "@/components/copilot-sheet";
import { DemoStoreBoundary } from "@/components/demo-store-boundary";
import { LogoutButton } from "@/components/logout-button";
import { PortalNavLink } from "@/components/portal-nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/agent/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { href: "/agent/airspace", label: "Live Airspace", icon: <Activity size={16} /> },
  { href: "/agent/book-flight", label: "Book Flight", icon: <PlusCircle size={16} /> },
  { href: "/agent/bookings", label: "My Bookings", icon: <Ticket size={16} /> },
  { href: "/agent/customer-bills", label: "Customer Bills", icon: <ReceiptText size={16} /> },
  { href: "/agent/invoices", label: "Invoices", icon: <FileText size={16} /> },
  { href: "/agent/payments", label: "Payments", icon: <CreditCard size={16} /> },
  { href: "/agent/payment-history", label: "Payment History", icon: <History size={16} /> },
];

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-card px-4 shadow-sm md:px-6">
        <div className="flex items-center gap-2">
          <PlaneTakeoff className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">SkyLedger Agent</span>
        </div>

        <nav className="ml-10 hidden flex-1 items-center space-x-3 md:flex">
          {navItems.map((item) => (
            <PortalNavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              variant="topbar"
            />
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <LogoutButton
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          />
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" className="md:hidden" />}>
              <Menu className="h-4 w-4" />
              <span className="sr-only">Open navigation</span>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="border-b">
                <SheetTitle className="flex items-center gap-2">
                  <PlaneTakeoff className="h-5 w-5 text-primary" />
                  SkyLedger Agent
                </SheetTitle>
                <SheetDescription>
                  Manage bookings, customer bills, invoices, and payments for your agency.
                </SheetDescription>
              </SheetHeader>
              <nav className="space-y-2 p-4">
                {navItems.map((item) => (
                  <PortalNavLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    variant="mobile"
                    onNavigate={() => setMobileNavOpen(false)}
                  />
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-6">
        <DemoStoreBoundary>{children}</DemoStoreBoundary>
      </main>
      <CopilotSheet role="agent" />
    </div>
  );
}
