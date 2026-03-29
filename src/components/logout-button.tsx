"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";

import { useDemoStore } from "@/lib/demo-store";

export function LogoutButton({
  className = "",
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const router = useRouter();
  const logout = useDemoStore((state) => state.logout);
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        setPending(true);
        try {
          await logout();
          router.push("/login");
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut size={16} />}
      {showLabel ? <span>{pending ? "Signing out..." : "Sign out"}</span> : null}
    </button>
  );
}
