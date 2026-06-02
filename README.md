This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Cabadbaran Seed Data

The renter map only shows approved, source-verified Cabadbaran accommodations
with valid coordinates and source metadata. To apply the required metadata
migration and seed the verified accommodation candidates, set `SUPABASE_DB_URL`
to the Supabase direct PostgreSQL connection string, then run:

```bash
npm run seed:ph
```

This applies `supabase/migrations/0007_property_seed_verification_metadata.sql`,
imports `supabase/seed.ph-demo.sql`, and runs
`supabase/seed.ph-demo.validation.sql`. To run only the validation checks after
an import:

```bash
npm run seed:ph:validate
```

Expected validation results include 8 total Cabadbaran seed records and 4
coordinate-ready map records: MLM Pension House, Gazebo Pools and Restaurant,
E & G Hotel and Convention Center / Resort, and La Dolce Vita Inland Resort.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
