"use client";

import type { ReactNode } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface PortalNavLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
  variant?: "sidebar" | "topbar" | "mobile";
  onNavigate?: () => void;
}

export function PortalNavLink({
  href,
  icon,
  label,
  variant = "sidebar",
  onNavigate,
}: PortalNavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 transition-colors",
        variant === "sidebar" &&
          "rounded-md px-3 py-2.5 text-sm font-medium",
        variant === "topbar" && "rounded-md px-3 py-2 text-sm font-medium",
        variant === "mobile" &&
          "rounded-lg px-3 py-3 text-sm font-medium",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
