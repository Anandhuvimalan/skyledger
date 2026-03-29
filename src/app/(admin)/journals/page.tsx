"use client";

import { useState } from "react";
import { FileText, Filter, RefreshCw, Search } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

export default function JournalsPage() {
  const journals = useDemoStore((state) => state.journals);
  const accounts = useDemoStore((state) => state.accounts);
  const loading = useDemoStore((state) => state.loading);
  const addJournalEntry = useDemoStore((state) => state.addJournalEntry);
  const postDraftJournals = useDemoStore((state) => state.postDraftJournals);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [entryForm, setEntryForm] = useState({
    description: "",
    reference: "",
    debitAccount: "1110",
    creditAccount: "2100",
    amount: "0",
  });

  const filteredEntries = journals.filter((journal) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "draft" && journal.status === "DRAFT") ||
      (activeTab === "posted" && journal.status === "POSTED");
    const normalized = searchTerm.toLowerCase();
    const matchesSearch =
      journal.id.toLowerCase().includes(normalized) ||
      journal.reference.toLowerCase().includes(normalized) ||
      journal.description.toLowerCase().includes(normalized);

    return matchesTab && matchesSearch;
  });

  const draftCount = journals.filter((journal) => journal.status === "DRAFT").length;
  const postedCount = journals.filter((journal) => journal.status === "POSTED").length;

  const accountLookup = new Map(accounts.map((account) => [account.accountNumber, account.name]));

  const handleBatchPost = async () => {
    try {
      const posted = await postDraftJournals();
      setMessage(
        posted > 0
          ? `Posted ${posted} draft journal entr${posted === 1 ? "y" : "ies"}.`
          : "No draft journal entries were waiting to post."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to post draft journals.");
    }
  };

  const handleCreateEntry = async () => {
    const amount = Number(entryForm.amount);

    if (!entryForm.description || !entryForm.reference || amount <= 0) {
      return;
    }

    try {
      await addJournalEntry({
        description: entryForm.description,
        reference: entryForm.reference,
        lines: [
          {
            accountNumber: entryForm.debitAccount,
            name: accountLookup.get(entryForm.debitAccount) ?? "Selected Account",
            debit: amount,
            credit: 0,
          },
          {
            accountNumber: entryForm.creditAccount,
            name: accountLookup.get(entryForm.creditAccount) ?? "Selected Account",
            debit: 0,
            credit: amount,
          },
        ],
      });

      setShowCreate(false);
      setEntryForm({
        description: "",
        reference: "",
        debitAccount: "1110",
        creditAccount: "2100",
        amount: "0",
      });
      setMessage("Manual journal entry added in draft status.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create journal entry.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journal Entries</h1>
          <p className="mt-1 text-muted-foreground">
            Review and post double-entry accounting activity across bookings, revenue, and payments.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreate(true)}>
            Manual Entry
          </Button>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => void handleBatchPost()} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Run Batch Post
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      ) : null}

      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <CardHeader className="space-y-4 border-b pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="all">All Entries ({journals.length})</TabsTrigger>
                <TabsTrigger value="draft">Draft ({draftCount})</TabsTrigger>
                <TabsTrigger value="posted">Posted ({postedCount})</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search JE or reference..."
                    className="w-[220px] pl-8"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4">
            <TabsContent value={activeTab} className="m-0 space-y-8">
              {filteredEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No journal entries match the current search and status filters.
                </div>
              ) : (
                filteredEntries.map((journal) => (
                  <div key={journal.id} className="overflow-hidden rounded-lg border bg-card shadow-sm">
                    <div className="flex flex-col gap-4 border-b bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-primary/10 p-2 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{journal.id}</span>
                            {journal.status === "POSTED" ? (
                              <Badge variant="secondary" className="bg-emerald-100/60 text-emerald-700">
                                Posted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                Draft
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {journal.date} | Ref: {journal.reference}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm font-medium">{journal.description}</div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[110px]">Account</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[160px] text-right">Debit</TableHead>
                          <TableHead className="w-[160px] text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {journal.lines.map((line, index) => (
                          <TableRow key={`${journal.id}-${index}`}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {line.accountNumber}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{line.name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New Manual Journal Entry</DialogTitle>
            <DialogDescription>
              Add a balanced draft entry for review before posting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="journalDescription">Description</Label>
              <Input
                id="journalDescription"
                value={entryForm.description}
                onChange={(event) =>
                  setEntryForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Commission correction"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="journalReference">Reference</Label>
              <Input
                id="journalReference"
                value={entryForm.reference}
                onChange={(event) =>
                  setEntryForm((current) => ({ ...current, reference: event.target.value }))
                }
                placeholder="ADJ-YYYY-001"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="debitAccount">Debit Account</Label>
                <select
                  id="debitAccount"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={entryForm.debitAccount}
                  onChange={(event) =>
                    setEntryForm((current) => ({ ...current, debitAccount: event.target.value }))
                  }
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.accountNumber}>
                      {account.accountNumber} - {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="creditAccount">Credit Account</Label>
                <select
                  id="creditAccount"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={entryForm.creditAccount}
                  onChange={(event) =>
                    setEntryForm((current) => ({ ...current, creditAccount: event.target.value }))
                  }
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.accountNumber}>
                      {account.accountNumber} - {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="journalAmount">Amount</Label>
              <Input
                id="journalAmount"
                type="number"
                value={entryForm.amount}
                onChange={(event) =>
                  setEntryForm((current) => ({ ...current, amount: event.target.value }))
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateEntry()} disabled={loading}>
              Save Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
