"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Download, Filter, Plus, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/client-download";
import { formatCurrency, type AccountType, type GlAccount } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

const accountTypes: Array<AccountType | "ALL"> = ["ALL", "ASSET", "LIABILITY", "REVENUE", "EXPENSE"];

export default function GlAccountsPage() {
  const accounts = useDemoStore((state) => state.accounts);
  const loading = useDemoStore((state) => state.loading);
  const addAccount = useDemoStore((state) => state.addAccount);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "ALL">("ALL");
  const [selectedAccount, setSelectedAccount] = useState<GlAccount | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    accountNumber: "",
    name: "",
    type: "ASSET" as AccountType,
    balance: "",
  });

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch =
      account.accountNumber.includes(searchTerm) ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "ALL" || account.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const handleExport = () => {
    downloadCsv(
      "gl-accounts.csv",
      ["Account Number", "Account Name", "Type", "Balance"],
      filteredAccounts.map((account) => [
        account.accountNumber,
        account.name,
        account.type,
        account.balance.toFixed(2),
      ])
    );
  };

  const handleCreateAccount = async () => {
    if (!form.accountNumber || !form.name || !form.balance) {
      return;
    }

    try {
      await addAccount({
        accountNumber: form.accountNumber,
        name: form.name,
        type: form.type,
        balance: Number(form.balance),
      });

      setForm({ accountNumber: "", name: "", type: "ASSET", balance: "" });
      setShowCreate(false);
      setMessage("GL account created successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create GL account.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="mt-1 text-muted-foreground">
            Maintain the airline ledger, account balances, and account classification.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Account
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader className="space-y-4 border-b pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search account number or name..."
                className="bg-background pl-8"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {accountTypes.map((type) => (
                <Button
                  key={type}
                  variant={typeFilter === type ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => setTypeFilter(type)}
                >
                  <Filter className="h-4 w-4" />
                  {type === "ALL" ? "All Types" : type}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[120px]">Account</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Current Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No ledger accounts match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => (
                  <TableRow key={account.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-muted-foreground">
                      {account.accountNumber}
                    </TableCell>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>
                      <AccountTypeBadge type={account.type} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(account.balance)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedAccount(account)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create GL Account</DialogTitle>
            <DialogDescription>
              Add a new account to the airline ledger for reporting and journal posting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                value={form.accountNumber}
                onChange={(event) => setForm((current) => ({ ...current, accountNumber: event.target.value }))}
                placeholder="e.g. 4050"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ancillary Revenue - Baggage"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accountType">Account Type</Label>
              <select
                id="accountType"
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value as AccountType }))
                }
              >
                {accountTypes
                  .filter((type): type is AccountType => type !== "ALL")
                  .map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="openingBalance">Opening Balance</Label>
              <Input
                id="openingBalance"
                type="number"
                value={form.balance}
                onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateAccount()} disabled={loading}>
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedAccount !== null} onOpenChange={(open) => !open && setSelectedAccount(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedAccount && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAccount.name}</DialogTitle>
                <DialogDescription>
                  Account {selectedAccount.accountNumber} in the airline chart of accounts.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoCard label="Account Type" value={<AccountTypeBadge type={selectedAccount.type} />} />
                <InfoCard label="Current Balance" value={formatCurrency(selectedAccount.balance)} />
                <InfoCard label="Posting Frequency" value="Daily journal integration" />
                <InfoCard label="Control Status" value="Available for automated postings" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountTypeBadge({ type }: { type: AccountType }) {
  switch (type) {
    case "ASSET":
      return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Asset</Badge>;
    case "LIABILITY":
      return <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">Liability</Badge>;
    case "REVENUE":
      return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Revenue</Badge>;
    case "EXPENSE":
      return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Expense</Badge>;
  }
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}
