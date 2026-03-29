"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useDemoStore } from "@/lib/demo-store";

export function DemoStoreBoundary({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useDemoStore((state) => state.hydrated);
  const unauthorized = useDemoStore((state) => state.unauthorized);
  const currentUser = useDemoStore((state) => state.currentUser);
  const hydrate = useDemoStore((state) => state.hydrate);

  const inAgentPortal = pathname === "/agent" || pathname.startsWith("/agent/");
  const roleMismatch =
    hydrated &&
    currentUser !== null &&
    ((inAgentPortal && currentUser.role !== "AGENT") ||
      (!inAgentPortal && currentUser.role !== "ADMIN"));

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (hydrated && unauthorized) {
      router.replace("/login");
    }
  }, [hydrated, router, unauthorized]);

  useEffect(() => {
    if (!roleMismatch || !currentUser) {
      return;
    }

    router.replace(currentUser.role === "ADMIN" ? "/dashboard" : "/agent/dashboard");
  }, [currentUser, roleMismatch, router]);

  if (!hydrated || unauthorized || roleMismatch) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
