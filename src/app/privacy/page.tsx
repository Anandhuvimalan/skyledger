import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">SkyLedger Legal</p>
        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground">
          SkyLedger stores the operational and accounting data required to run airline
          settlements in this environment.
        </p>
      </div>

      <section className="space-y-4 text-sm leading-6 text-muted-foreground">
        <p>
          Contact details, invoice balances, booking history, and journal activity are used to
          power the portal views, settlement batches, and accounting workflows shown in the
          application.
        </p>
        <p>
          Flight search requests can be sent to configured schedule providers, and copilot
          prompts can be sent to the configured language model endpoint when those features are
          enabled.
        </p>
      </section>

      <Link href="/login" className="text-sm font-medium text-primary hover:underline">
        Return to sign in
      </Link>
    </main>
  );
}
