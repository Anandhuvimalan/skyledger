"use client";

import { useState } from "react";
import { AlertTriangle, Download, Repeat, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadJson } from "@/lib/client-download";
import { formatCurrency } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

export default function RevenuePage() {
  const bookings = useDemoStore((state) => state.bookings);
  const revenueRules = useDemoStore((state) => state.revenueRules);
  const loading = useDemoStore((state) => state.loading);
  const runRevenueRecognitionBatch = useDemoStore((state) => state.runRevenueRecognitionBatch);

  const [message, setMessage] = useState<string | null>(null);

  const deferredValue = bookings
    .filter((booking) => booking.revenueStatus === "DEFERRED")
    .reduce((sum, booking) => sum + booking.baseFare, 0);
  const recognizedValue = bookings
    .filter((booking) => booking.revenueStatus === "RECOGNIZED")
    .reduce((sum, booking) => sum + booking.baseFare, 0);
  const breakageValue = 0;
  const totalTrackedRevenue = deferredValue + recognizedValue;

  const deferredProgress = totalTrackedRevenue > 0 ? (deferredValue / totalTrackedRevenue) * 100 : 0;
  const recognizedProgress = totalTrackedRevenue > 0 ? (recognizedValue / totalTrackedRevenue) * 100 : 0;

  const handleRunBatch = async () => {
    try {
      const result = await runRevenueRecognitionBatch();

      setMessage(
        result.recognized > 0
          ? `Recognized ${formatCurrency(result.value)} across ${result.recognized} flown itineraries.`
          : "No additional deferred bookings were eligible for recognition."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run revenue recognition.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Revenue Recognition</h1>
          <p className="mt-1 text-muted-foreground">
            ASC 606 workflows for releasing deferred ticket revenue into earned passenger revenue.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => downloadJson("revenue-rules.json", revenueRules)}>
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => void handleRunBatch()} disabled={loading}>
            <Repeat className="h-4 w-4" />
            Run Recognition Batch
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Air Traffic Liability</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(deferredValue)}</div>
            <p className="text-xs text-muted-foreground">Value still waiting on flight completion</p>
            <Progress
              value={deferredProgress}
              className="mt-3"
              indicatorClassName="bg-amber-500"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recognized Passenger Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(recognizedValue)}</div>
            <p className="text-xs text-muted-foreground">Revenue already released from flown itineraries</p>
            <Progress
              value={recognizedProgress}
              className="mt-3"
              indicatorClassName="bg-emerald-500"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Breakage</CardTitle>
            <Repeat className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(breakageValue)}</div>
            <p className="text-xs text-muted-foreground">No breakage postings have been recognized yet</p>
            <Progress value={0} className="mt-3" indicatorClassName="bg-blue-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recognition Rules Engine</CardTitle>
          <CardDescription>
            Each rule maps a revenue trigger to the deferred and realized accounts used during posting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Rule Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Debit (Deferred)</TableHead>
                <TableHead>Credit (Realized)</TableHead>
                <TableHead>Last Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="font-medium text-emerald-600">{rule.trigger}</TableCell>
                  <TableCell className="font-mono text-xs">{rule.debitAccount}</TableCell>
                  <TableCell className="font-mono text-xs">{rule.creditAccount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{rule.lastRun}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
