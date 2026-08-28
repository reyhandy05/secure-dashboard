# Northstar Security Console

Internal secure asset and incident management dashboard built with Next.js App Router, TypeScript, Prisma/PostgreSQL, Auth.js database sessions, Argon2id, Zod, and Tailwind CSS.

## Structure

```text
src/app/                 UI, login, API route, server actions
src/auth.ts              Auth.js credentials provider and database sessions
src/lib/security.ts      Argon2id, rate limit, CSRF origin, SSRF URL guard
src/lib/validators.ts    Strict Zod payload schemas
src/lib/prisma.ts        Singleton Prisma client
prisma/schema.prisma     Users, sessions, incidents, audit events
middleware.ts            Auth guard, admin RBAC, CSP and HTTP headers
```

## Local setup

1. Copy `.env.example` to `.env` and provide PostgreSQL plus a long random `AUTH_SECRET`.
2. Run `npx prisma migrate dev --name init`.
3. Start with `npm run dev` and open `http://localhost:3000`.

The in-memory limiter is for single-instance development only. Production must replace it with shared Redis/Upstash sliding-window storage. MFA wiring is fail-closed in this sample; replace the placeholder TOTP check with a vetted server-side TOTP library before enabling accounts.

## Security checklist

- [ ] Enforce TLS and confirm HSTS preload is appropriate for the domain.
- [ ] Store `AUTH_SECRET`, database credentials, and IP salt in a secrets manager.
- [ ] Use a least-privilege PostgreSQL role with encrypted connections.
- [ ] Use shared Redis rate limiting across all app instances.
- [ ] Encrypt MFA TOTP secrets at rest and hash recovery codes.
- [ ] Validate origin plus CSRF token on every state-changing mutation.
- [ ] Sanitize rich text with a strict allowlist before persistence and rendering.
- [ ] Validate upload magic bytes, size, type, random object keys, and isolated storage.
- [ ] Keep audit logs append-only and free of passwords or secrets.
- [ ] Pass dependency review, SAST, DAST, and backup restore tests.

## Commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
