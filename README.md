# Finance — Driver & Fleet Tracker

Simple finance app for managing drivers, salary/advance payouts (UPI), expenses, and bank cash position.

## Stack

- React 19 + TanStack Router / Start
- Zustand (client state)
- Tailwind + Radix UI
- better-auth + Neon Postgres (optional)
- Vite + Nitro (Vercel preset)

## Features

- Drivers (full-time / part-time, UPI VPA)
- Payouts: salary, advance, extra route, fine, return
- Expenses tracking
- Bank accounts & cash position overview
- UPI-friendly fields

## Local development

```bash
npm install
npm run dev
```

App runs on `http://0.0.0.0:8080`.

## Deploy (Vercel + Neon)

1. Import this repo on [Vercel](https://vercel.com)
2. Create a free Postgres DB on [Neon](https://neon.tech)
3. Add env var in Vercel:
   ```
   DATABASE_URL=postgresql://...
   ```
4. Deploy — migrations run on build

## License

Private / personal use.
