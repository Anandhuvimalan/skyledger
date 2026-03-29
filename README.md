## SkyLedger

SkyLedger is a Next.js airline finance app for:

- airline admin users managing journals, revenue recognition, receivables, and travel agents
- travel agencies searching flights, creating bookings, paying invoices, and downloading receipts
- role-specific Gemini copilots using the live app state

## Runtime

The app now runs against `dev.db` through a server-side SQLite layer and cookie sessions.

Flight search uses Aviationstack schedule data.
Copilot uses the Gemini `generateContent` REST API.

## Environment

Copy `.env.example` to `.env.local` and provide valid keys if you are setting the project up on a new machine.

Expected variables:

```bash
DATABASE_URL=file:./dev.db
AVIATIONSTACK_API_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
DEFAULT_ADMIN_EMAIL=admin@skyledger.local
DEFAULT_ADMIN_PASSWORD=Admin#12345
DEFAULT_AGENT_PASSWORD=Agent#12345
```

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Default seeded login accounts:

- Admin: `admin@skyledger.local` / `Admin#12345`
- Agent: `12-3 4567 8` / `Agent#12345`

Admin-created travel agents now require their own passwords and can sign in directly.

## Notes

- Ticket sale posting now includes commission expense at booking time.
- Invoices and payment receipts can be downloaded from the UI after posting.
- Revenue recognition uses the current server date instead of a fixed seed date.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
