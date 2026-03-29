import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">SkyLedger Legal</p>
        <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-muted-foreground">
          This portal supports airline accounting workflows, settlement reviews, and accredited
          agency operations.
        </p>
      </div>

      <section className="space-y-4 text-sm leading-6 text-muted-foreground">
        <p>
          Access is limited to authorized airline finance teams and accredited travel agencies.
          Users are responsible for protecting credentials, validating settlement data before
          posting, and reporting suspected discrepancies promptly.
        </p>
        <p>
          Flight schedules may be retrieved from external providers, while application records,
          invoices, journals, and payment receipts are stored within this environment for
          operational use.
        </p>
      </section>

      <Link href="/login" className="text-sm font-medium text-primary hover:underline">
        Return to sign in
      </Link>
    </main>
  );
}
