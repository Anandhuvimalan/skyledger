"use client";

import { useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useDemoStore } from "@/lib/demo-store";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export function CopilotSheet({ role }: { role: "admin" | "agent" }) {
  const currentUser = useDemoStore((state) => state.currentUser);
  const hydrate = useDemoStore((state) => state.hydrate);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "assistant",
      text:
        role === "agent"
          ? "Ask about balances, flights, or use explicit actions like: Book JFK to LHR on YYYY-MM-DD for 1 passenger. Traveler name: John Doe. You can also say: Pay full balance."
          : "Ask about revenue, receivables, journals, or travel-agent balances.",
    },
  ]);

  const handleSend = async () => {
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    const nextMessages = [
      ...messages,
      {
        id: `user-${Date.now()}`,
        role: "user" as const,
        text: trimmed,
      },
    ];

    setMessages(nextMessages);
    setMessage("");
    setPending(true);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });
      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
        refreshState?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Copilot request failed.");
      }

      if (payload.refreshState) {
        await hydrate();
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: payload.reply || "No response returned.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: error instanceof Error ? error.message : "Copilot request failed.",
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button className="fixed bottom-5 right-5 z-50 rounded-full shadow-lg">
            <Bot className="mr-2 h-4 w-4" />
            {role === "agent" ? "Agent Copilot" : "Admin Copilot"}
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            {role === "agent" ? "Agent Copilot" : "Admin Copilot"}
          </SheetTitle>
          <SheetDescription>
            {currentUser?.name ? `Signed in as ${currentUser.name}.` : "Ask role-specific airline questions."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex h-[calc(100vh-12rem)] flex-col gap-4">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border bg-muted/20 p-4">
            {messages.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-lg px-4 py-3 text-sm ${
                  entry.role === "user"
                    ? "ml-auto max-w-[85%] bg-primary text-primary-foreground"
                    : "mr-auto max-w-[90%] border bg-background"
                }`}
              >
                {entry.text}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <textarea
              className="min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm"
              placeholder={
                role === "agent"
                  ? "Ask about flights, balances due, or say: Pay full balance."
                  : "Ask about revenue, journals, outstanding agency balances..."
              }
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <Button className="w-full" onClick={handleSend} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {pending ? "Thinking..." : "Send"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
