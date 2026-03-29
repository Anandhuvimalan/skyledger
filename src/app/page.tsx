import Link from "next/link"
import { PlaneTakeoff, ShieldAlert, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col pt-20 items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center mb-12 text-center">
        <PlaneTakeoff className="h-16 w-16 text-primary mb-6" />
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl mb-4">
          SkyLedger
        </h1>
        <p className="max-w-xl text-xl text-muted-foreground">
          Airline finance operations for travel-agent settlements, journal postings, revenue
          recognition, and live schedule-assisted ticketing.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Card className="hover:border-primary/50 transition-colors shadow-sm cursor-pointer relative group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldAlert className="text-primary" /> Airline Admin Portal
            </CardTitle>
            <CardDescription className="text-base pt-2">
              For financial analysts and airline staff. Manage General Ledger, Journal Entries, and global Revenue Recognition.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-4">
            <Link
              href="/login?role=admin"
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Enter Admin Portal <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors shadow-sm cursor-pointer relative group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <PlaneTakeoff className="text-primary" /> Travel Agent Portal
            </CardTitle>
            <CardDescription className="text-base pt-2">
              For accredited travel agencies (ARC/BSP). View bookings, track commissions, and settle outstanding balances.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-4">
            <Link
              href="/login?role=agent"
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              Enter Agent Portal <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
