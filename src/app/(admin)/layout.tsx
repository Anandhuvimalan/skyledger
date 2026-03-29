"use client";

import React, { useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  BookOpen,
  LayoutDashboard,
  Menu,
  PlaneTakeoff,
  Receipt,
  ScrollText,
  Users,
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
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/airspace", label: "Live Airspace", icon: <Activity size={18} /> },
  { href: "/gl", label: "GL Accounts", icon: <BookOpen size={18} /> },
  { href: "/journals", label: "Journal Entries", icon: <ScrollText size={18} /> },
  { href: "/revenue", label: "Revenue Rec", icon: <BadgeDollarSign size={18} /> },
  { href: "/agents", label: "Travel Agents", icon: <Users size={18} /> },
  { href: "/invoices", label: "Invoices", icon: <Receipt size={18} /> },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 border-r bg-card md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b p-6">
          <PlaneTakeoff className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">SkyLedger Admin</span>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {navItems.map((item) => (
            <PortalNavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </nav>

        <div className="p-4 border-t flex flex-col gap-4">
          <ThemeToggle />
          <LogoutButton className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <PlaneTakeoff className="h-5 w-5 text-primary" />
            <span className="font-semibold">SkyLedger Admin</span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger render={<Button variant="outline" size="icon" />}>
                <Menu className="h-4 w-4" />
                <span className="sr-only">Open navigation</span>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <PlaneTakeoff className="h-5 w-5 text-primary" />
                    SkyLedger Admin
                  </SheetTitle>
                  <SheetDescription>
                    Navigate finance operations, settlements, and reporting.
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
                  <LogoutButton
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  />
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <DemoStoreBoundary>{children}</DemoStoreBoundary>
        </main>
      </div>
      <CopilotSheet role="admin" />
    </div>
  );
}
