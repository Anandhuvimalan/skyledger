"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CreditCard,
  History,
  Loader2,
  ShieldCheck,
  SquareArrowOutUpRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatCurrency,
  getAgentInvoices,
  getInvoiceStatus,
} from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

function AgentPaymentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useDemoStore();
  const loading = useDemoStore((store) => store.loading);
  const deferInvoice = useDemoStore((store) => store.deferInvoice);
  const hydrate = useDemoStore((store) => store.hydrate);

  const invoices = getAgentInvoices(state, state.currentAgentId);
  const requestedInvoiceId = searchParams.get("invoice");
  const stripeSessionId = searchParams.get("stripe_session_id");
  const stripeCanceled = searchParams.get("stripe_canceled") === "1";
  const openInvoices = invoices.filter((invoice) => {
    const status = getInvoiceStatus(invoice);
    return status === "UNPAID" || status === "OVERDUE";
  });

  const [paymentOption, setPaymentOption] = useState<"full" | "half" | "custom" | "later">("full");
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);
  const finalizedStripeSession = useRef<string | null>(null);

  const requestedInvoice = invoices.find((invoice) => invoice.id === requestedInvoiceId) ?? null;
  const requestedInvoiceStatus = requestedInvoice ? getInvoiceStatus(requestedInvoice) : null;
  const selectedInvoice =
    requestedInvoice && (requestedInvoiceStatus === "UNPAID" || requestedInvoiceStatus === "OVERDUE")
      ? requestedInvoice
      : !requestedInvoiceId
        ? openInvoices[0] ?? null
        : null;

  useEffect(() => {
    if (!requestedInvoiceId && selectedInvoice) {
      router.replace(`/agent/payments?invoice=${selectedInvoice.id}`);
    }
  }, [requestedInvoiceId, router, selectedInvoice]);

  useEffect(() => {
    if (!stripeCanceled) {
      return;
    }

    setMessage("Stripe checkout was canceled. No payment was applied.");
    router.replace(requestedInvoiceId ? `/agent/payments?invoice=${requestedInvoiceId}` : "/agent/payments");
  }, [requestedInvoiceId, router, stripeCanceled]);

  useEffect(() => {
    if (!stripeSessionId || finalizedStripeSession.current === stripeSessionId) {
      return;
    }

    finalizedStripeSession.current = stripeSessionId;
    setStripeBusy(true);

    void (async () => {
      try {
        const response = await fetch("/api/payments/stripe/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ checkoutSessionId: stripeSessionId }),
        });
        const payload = (await response.json()) as {
          applied?: number;
          remainingBalance?: number;
          invoiceNumber?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Unable to confirm Stripe payment.");
        }

        await hydrate();
        setMessage(
          payload.remainingBalance === 0
            ? `Stripe payment posted successfully. ${payload.invoiceNumber ?? "Invoice"} is now fully settled.`
            : `Stripe payment posted successfully. Remaining balance: ${formatCurrency(payload.remainingBalance ?? 0)}.`
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to confirm Stripe payment.");
      } finally {
        setStripeBusy(false);
        router.replace(requestedInvoiceId ? `/agent/payments?invoice=${requestedInvoiceId}` : "/agent/payments");
      }
    })();
  }, [hydrate, requestedInvoiceId, router, stripeSessionId]);

  const invoiceAmount = selectedInvoice?.balanceDue ?? 0;
  const finalAmount =
    paymentOption === "full"
      ? invoiceAmount
      : paymentOption === "half"
        ? invoiceAmount / 2
        : paymentOption === "custom"
          ? Number(customAmount || "0")
          : 0;

  const handleDefer = async () => {
    if (!selectedInvoice) {
      return;
    }

    try {
      const nextDueDate = await deferInvoice(selectedInvoice.id);
      setMessage(
        nextDueDate
          ? `Payment deferred. New due date is ${nextDueDate}.`
          : "Unable to defer this invoice."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to defer this invoice.");
    }
  };

  const handleStripeCheckout = async () => {
    if (!selectedInvoice) {
      return;
    }

    const appliedAmount = Number(finalAmount.toFixed(2));

    if (appliedAmount <= 0) {
      setMessage("Enter a valid payment amount before continuing to Stripe.");
      return;
    }

    if (appliedAmount > selectedInvoice.balanceDue) {
      setMessage("Custom payment amount cannot exceed the remaining invoice balance.");
      return;
    }

    setStripeBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceId: selectedInvoice.id,
          amount: appliedAmount,
        }),
      });
      const payload = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Unable to start Stripe checkout.");
      }

      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setStripeBusy(false);
      setMessage(error instanceof Error ? error.message : "Unable to start Stripe checkout.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="mt-1 text-muted-foreground">
            Settle open ARC invoices through Stripe Checkout or defer them to the next billing cycle.
          </p>
        </div>
        <Link
          href="/agent/payment-history"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <History className="h-4 w-4" />
          View Payment History
        </Link>
      </div>

      {message ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      ) : null}

      {requestedInvoice && requestedInvoiceStatus === "PAID" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {requestedInvoice.invoiceNumber} is already fully settled.
        </div>
      ) : null}

      <div className="max-w-3xl">
        <Card className="relative overflow-hidden border-primary/50 shadow-lg">
          <div className="absolute top-0 left-0 h-full w-2 bg-primary" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Pay by Card
            </CardTitle>
            <CardDescription>
              {selectedInvoice
                ? `Preparing Stripe checkout for ${selectedInvoice.invoiceNumber}`
                : "No open invoice is currently available for card payment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border bg-muted p-4">
              <span className="font-medium text-muted-foreground">Amount Due</span>
              <span className="text-3xl font-bold tracking-tight">{formatCurrency(invoiceAmount)}</span>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Payment Amount</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ["full", "Full", "100%"],
                  ["half", "Half", "50%"],
                  ["custom", "Custom", "Amount"],
                  ["later", "Later", "Defer"],
                ] as const).map(([value, label, caption]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-md border p-3 text-left transition-colors ${
                      paymentOption === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                    onClick={() => setPaymentOption(value)}
                  >
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-1 block text-xs opacity-80">{caption}</span>
                  </button>
                ))}
              </div>

              {paymentOption === "custom" ? (
                <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                  <Label htmlFor="customAmount">Enter Custom Amount ($)</Label>
                  <div className="relative mt-1">
                    <span className="absolute top-2.5 left-3 text-muted-foreground">$</span>
                    <Input
                      id="customAmount"
                      type="number"
                      className="pl-7"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(event) => setCustomAmount(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {paymentOption !== "later" ? (
              <div className="space-y-4 border-t pt-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">Secure Stripe Checkout</p>
                      <p className="text-sm text-slate-600">
                        The card entry happens on Stripe&apos;s hosted payment page, and you will return
                        here after Stripe confirms the settlement.
                      </p>
                    </div>
                    <SquareArrowOutUpRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                  </div>
                </div>

                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700">
                  Stripe will return here after payment so the invoice, receipt, and journal entry can be posted automatically.
                </div>
              </div>
            ) : (
              <div className="border-t pt-4">
                <div className="flex items-start gap-3 rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-amber-700">
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Defer to Next Billing Cycle</p>
                    <p className="mt-1 text-xs">
                      The current invoice due date will move forward by seven calendar days.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-3 border-t bg-muted/30 py-4">
            <Button
              className={`h-12 w-full text-md ${paymentOption === "later" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
              disabled={!selectedInvoice || loading || stripeBusy}
              onClick={() => void (paymentOption === "later" ? handleDefer() : handleStripeCheckout())}
            >
              {stripeBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : paymentOption === "later" ? (
                "Confirm Deferral"
              ) : (
                `Continue to Stripe ${formatCurrency(finalAmount)}`
              )}
            </Button>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className={`h-4 w-4 ${paymentOption === "later" ? "text-amber-500" : "text-emerald-600"}`} />
              <span>
                {paymentOption === "later"
                  ? "Deferred balances remain visible until payment is completed."
                  : "Receipts are posted back into SkyLedger after Stripe confirms the payment."}
              </span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function AgentPaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AgentPaymentsContent />
    </Suspense>
  );
}
