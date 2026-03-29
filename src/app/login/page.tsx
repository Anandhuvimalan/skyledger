"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LogIn, PlaneTakeoff, ShieldAlert, Users } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function LoginContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("role") === "agent" ? "agent" : "admin";
  const redirectTo = searchParams.get("redirectTo") ?? "";
  const error = searchParams.get("error");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute top-0 left-0 -z-10 h-full w-full overflow-hidden opacity-20 dark:opacity-10">
        <div className="absolute top-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-primary blur-3xl" />
        <div className="absolute right-[-10%] bottom-[-10%] h-[40%] w-[40%] rounded-full bg-blue-600 blur-3xl" />
      </div>

      <Link
        href="/"
        className="absolute top-8 left-8 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground mix-blend-difference"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>

      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 rounded-2xl bg-primary/10 p-3">
          <PlaneTakeoff className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to SkyLedger</h1>
        <p className="mt-2 text-muted-foreground">Sign in to your portal below</p>
      </div>

      <Card className="w-full max-w-md border-primary/10 bg-card/80 shadow-2xl backdrop-blur-xl">
        <Tabs defaultValue={defaultTab} className="w-full">
          <CardHeader className="p-0">
            <TabsList className="h-14 w-full rounded-none rounded-t-lg border-b bg-transparent p-0">
              <TabsTrigger
                value="admin"
                className="h-full flex-1 rounded-none transition-all data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
              >
                <ShieldAlert className="mr-2 h-4 w-4" /> Admin
              </TabsTrigger>
              <TabsTrigger
                value="agent"
                className="h-full flex-1 rounded-none transition-all data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
              >
                <Users className="mr-2 h-4 w-4" /> Travel Agent
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-6">
            {error ? (
              <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <TabsContent value="admin" className="m-0 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="mb-6 text-center">
                <CardTitle className="text-xl">Airline Administration</CardTitle>
                <CardDescription>Secure access for financial analysts</CardDescription>
              </div>
              <form action="/api/auth/login" method="post" className="space-y-4">
                <input type="hidden" name="role" value="admin" />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Corporate Email</Label>
                  <Input
                    id="admin-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@airlines.com"
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="admin-password">Password</Label>
                    <Link
                      href="mailto:support@skyledger.com?subject=Admin%20password%20reset"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="admin-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="bg-background/50"
                  />
                </div>
                <Button type="submit" className="mt-2 w-full">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In to Admin Portal
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="agent" className="m-0 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="mb-6 text-center">
                <CardTitle className="text-xl">Travel Agent Portal</CardTitle>
                <CardDescription>Manage ARC ticketing & commissions</CardDescription>
              </div>
              <form action="/api/auth/login" method="post" className="space-y-4">
                <input type="hidden" name="role" value="agent" />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <div className="space-y-2">
                  <Label htmlFor="agent-arc">ARC / IATA Number</Label>
                  <Input
                    id="agent-arc"
                    name="arcNumber"
                    autoComplete="username"
                    placeholder="e.g. 05-1 2345 6"
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="agent-password">Password</Label>
                    <Link
                      href="mailto:support@skyledger.com?subject=Agent%20password%20reset"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="agent-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="bg-background/50"
                  />
                </div>
                <Button type="submit" variant="default" className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In to Agent Portal
                </Button>
              </form>
            </TabsContent>
          </CardContent>

          <CardFooter className="flex flex-col items-center justify-center border-t bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">
              By signing in, you agree to the{" "}
              <Link href="/terms" className="text-primary/80 hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary/80 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </CardFooter>
        </Tabs>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <PlaneTakeoff className="h-8 w-8 animate-pulse text-primary" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
