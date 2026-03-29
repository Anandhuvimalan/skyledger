## SkyLedger

SkyLedger is a Next.js airline finance app for:

- airline admin users managing journals, revenue recognition, receivables, and travel agents
- travel agencies searching flights, creating bookings, paying invoices, and downloading receipts
- role-specific Gemini copilots using the live app state

## Project Setup

1. Clone the repository or download the project zip.
2. Open a terminal in the project folder:

```bash
cd skyledger
```

3. Install dependencies:

```bash
npm install
```

4. Create a file named `.env.local` in the project root.

The project root is the same folder that contains `package.json`, `README.md`, and `dev.db`.

5. Copy this example into `.env.local` and add your API keys:

```bash
DATABASE_URL=file:./dev.db
AVIATIONSTACK_API_KEY=your_aviationstack_key
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
DEFAULT_ADMIN_EMAIL=admin@gmail.com
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_AGENT_PASSWORD=test123
```

6. Start the development server:

```bash
npm run dev
```

7. Open the app in your browser at `http://localhost:3000`.

## Default Login Credentials

Use these seeded credentials after starting the app:

- Admin: `admin@gmail.com` / `admin123`
- Agent: `12345678` / `test123`

The agent ARC number can be typed as `12345678`.

## Runtime Notes

- The app runs against `dev.db` through a server-side SQLite layer and cookie sessions.
- Flight search uses Aviationstack schedule data.
- Copilot uses the Gemini `generateContent` REST API.
- Admin-created travel agents require their own passwords and can sign in directly.

## Useful Commands

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```
