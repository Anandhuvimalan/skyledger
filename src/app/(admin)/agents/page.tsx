"use client";

import { useState } from "react";
import { Filter, LayoutGrid, Plus, Search } from "lucide-react";

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
import { formatCurrency, type TravelAgent } from "@/lib/demo-data";
import { useDemoStore } from "@/lib/demo-store";

export default function AgentsPage() {
  const agents = useDemoStore((state) => state.agents);
  const invoices = useDemoStore((state) => state.invoices);
  const loading = useDemoStore((state) => state.loading);
  const addAgent = useDemoStore((state) => state.addAgent);
  const toggleAgentStatus = useDemoStore((state) => state.toggleAgentStatus);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TravelAgent["status"] | "ALL">("ALL");
  const [selectedAgent, setSelectedAgent] = useState<TravelAgent | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    arcNumber: "",
    email: "",
    annualVolume: "",
    tier: "Tier 2" as TravelAgent["tier"],
    overrideRate: "0.03",
    password: "",
  });

  const filteredAgents = agents.filter((agent) => {
    const normalized = searchTerm.toLowerCase();
    const matchesSearch =
      agent.name.toLowerCase().includes(normalized) ||
      agent.arcNumber.toLowerCase().includes(normalized) ||
      agent.email.toLowerCase().includes(normalized);
    const matchesStatus = statusFilter === "ALL" || agent.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const selectedAgentInvoices = invoices.filter((invoice) => invoice.agentId === selectedAgent?.id);
  const outstandingForSelected = selectedAgentInvoices.reduce(
    (sum, invoice) => sum + invoice.balanceDue,
    0
  );

  const handleCreateAgent = async () => {
    if (!form.name || !form.arcNumber || !form.email || !form.annualVolume || !form.password) {
      return;
    }

    try {
      await addAgent({
        name: form.name,
        arcNumber: form.arcNumber,
        email: form.email,
        annualVolume: Number(form.annualVolume),
        tier: form.tier,
        overrideRate: Number(form.overrideRate),
        password: form.password,
      });

      setShowCreate(false);
      setForm({
        name: "",
        arcNumber: "",
        email: "",
        annualVolume: "",
        tier: "Tier 2",
        overrideRate: "0.03",
        password: "",
      });
      setMessage("Agency created successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create agency.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Travel Agents</h1>
          <p className="mt-1 text-muted-foreground">
            Manage ARC agencies, commission tiers, and settlement standing.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button className="gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Add Agency
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader className="space-y-4 border-b bg-muted/20 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ARC number, agency, or email..."
                className="bg-background pl-8"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(["ALL", "ACTIVE", "SUSPENDED"] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  className="gap-2"
                  onClick={() => setStatusFilter(status)}
                >
                  <Filter className="h-4 w-4" />
                  {status === "ALL" ? "All Agents" : status}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Agency Name</TableHead>
                <TableHead>ARC / IATA Number</TableHead>
                <TableHead>Annual Volume</TableHead>
                <TableHead>Commission Tier</TableHead>
                <TableHead>Override Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-semibold">{agent.name}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{agent.arcNumber}</TableCell>
                  <TableCell>{formatCurrency(agent.annualVolume)}</TableCell>
                  <TableCell>
                    <Badge variant={agent.tier === "Tier 1" ? "secondary" : "outline"}>
                      {agent.tier}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-emerald-600">
                    {(agent.overrideRate * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    {agent.status === "ACTIVE" ? (
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Suspended</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" onClick={() => setSelectedAgent(agent)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Travel Agency</DialogTitle>
            <DialogDescription>
              Create a new agency profile for ARC settlement, invoice delivery, and commission setup.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="agencyName">Agency Name</Label>
              <Input
                id="agencyName"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="arcNumber">ARC / IATA Number</Label>
                <Input
                  id="arcNumber"
                  value={form.arcNumber}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, arcNumber: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agencyEmail">Finance Email</Label>
                <Input
                  id="agencyEmail"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="annualVolume">Annual Volume</Label>
                <Input
                  id="annualVolume"
                  type="number"
                  value={form.annualVolume}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, annualVolume: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tier">Tier</Label>
                <select
                  id="tier"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.tier}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tier: event.target.value as TravelAgent["tier"],
                    }))
                  }
                >
                  <option value="Tier 1">Tier 1</option>
                  <option value="Tier 2">Tier 2</option>
                  <option value="Tier 3">Tier 3</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="overrideRate">Override Rate</Label>
                <Input
                  id="overrideRate"
                  type="number"
                  step="0.005"
                  value={form.overrideRate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, overrideRate: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agencyPassword">Password</Label>
                <Input
                  id="agencyPassword"
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateAgent()} disabled={loading}>
              Create Agency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedAgent !== null} onOpenChange={(open) => !open && setSelectedAgent(null)}>
        <DialogContent className="sm:max-w-xl">
          {selectedAgent ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAgent.name}</DialogTitle>
                <DialogDescription>
                  ARC {selectedAgent.arcNumber} | {selectedAgent.email}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoCard label="Annual Volume" value={formatCurrency(selectedAgent.annualVolume)} />
                <InfoCard label="Open Invoice Balance" value={formatCurrency(outstandingForSelected)} />
                <InfoCard label="Commission Tier" value={selectedAgent.tier} />
                <InfoCard label="Override Rate" value={`${(selectedAgent.overrideRate * 100).toFixed(1)}%`} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedAgent(null)}>
                  Close
                </Button>
                <Button
                  variant={selectedAgent.status === "ACTIVE" ? "destructive" : "default"}
                  disabled={loading}
                  onClick={async () => {
                    try {
                      await toggleAgentStatus(selectedAgent.id);
                      setSelectedAgent((current) =>
                        current
                          ? {
                              ...current,
                              status: current.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                            }
                          : null
                      );
                      setMessage(
                        selectedAgent.status === "ACTIVE"
                          ? `${selectedAgent.name} has been suspended.`
                          : `${selectedAgent.name} has been reactivated.`
                      );
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "Unable to update agency status.");
                    }
                  }}
                >
                  {selectedAgent.status === "ACTIVE" ? "Suspend Agency" : "Reactivate Agency"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}
