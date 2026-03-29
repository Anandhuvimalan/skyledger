"use client";

import { CheckCircle2, Download, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatShortDateTime,
  getAgentInvoices,
  getAgentPayments,
  type PaymentStatus,
} from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

export default function AgentPaymentHistoryPage() {
  const state = useDemoStore();

  const invoices = getAgentInvoices(state, state.currentAgentId);
  const payments = getAgentPayments(state, state.currentAgentId);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const settledInvoiceCount = new Set(payments.map((payment) => payment.invoiceId)).size;
  const latestPayment = payments[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment History</h1>
        <p className="mt-1 text-muted-foreground">
          Review completed settlements, trace invoices they closed, and download PDF receipts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Total Paid" value={formatCurrency(totalPaid)} />
        <SummaryCard label="Settlements Recorded" value={String(payments.length)} />
        <SummaryCard
          label="Latest Settlement"
          value={latestPayment ? formatShortDateTime(latestPayment.paymentDate) : "No payments yet"}
        />
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            Posted Receipts
          </CardTitle>
          <CardDescription>
            {payments.length === 0
              ? "Your agency has not posted any payments yet."
              : `${settledInvoiceCount} invoice${settledInvoiceCount === 1 ? "" : "s"} settled so far.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No payments have been recorded yet.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Paid On</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const invoice = invoices.find((item) => item.id === payment.invoiceId);

                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.id.toUpperCase()}</TableCell>
                      <TableCell>{invoice?.invoiceNumber ?? "Archived Invoice"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatShortDateTime(payment.paymentDate)}
                      </TableCell>
                      <TableCell>
                        {payment.paymentMethod} ending in {payment.cardLastFour}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Download PDF receipt"
                          onClick={() =>
                            window.open(
                              `/api/payments/${payment.id}/download`,
                              "_blank",
                              "noopener,noreferrer"
                            )
                          }
                        >
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "SETTLED") {
    return (
      <Badge variant="secondary" className="bg-emerald-100/60 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Settled
      </Badge>
    );
  }

  return <Badge variant="outline">Pending</Badge>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
