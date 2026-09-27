
# Deploy to Vercel in 5 minutes

## Step 1: Create DB (30 sec)
1. Go to neon.tech -> Sign up free
2. Create project maqr-os
3. Copy DATABASE_URL (pooled) and DIRECT_URL

## Step 2: Push to GitHub
git init
git add .
git commit -m "Maqr OS v2 AUTH"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/maqr-os.git
git push -u origin main

## Step 3: Vercel
1. Go to vercel.com -> Add New Project -> Import from GitHub
2. Add Environment Variables from .env.example
3. Set (all required - see .env.example for the full list, including Paymob/Pusher/WhatsApp/R2):
   NEXTAUTH_URL = https://YOUR_PROJECT.vercel.app
   NEXTAUTH_SECRET = openssl rand -base64 32
   CRON_SECRET = openssl rand -base64 32   (the cron endpoint rejects requests without this)
   PAYMOB_HMAC = <from your Paymob dashboard>   (the payment webhook rejects everything without this)
4. Deploy

Vercel Cron is already configured in vercel.json to hit /api/cron/check-subscriptions and
/api/cron/expire-pending-payments once daily each. Vercel automatically sends the CRON_SECRET as
a Bearer token for its own cron calls - you don't need to do anything extra for that part.

**Hobby plan note**: Vercel's Hobby (free) plan only allows cron schedules that fire at most once
a day - anything more frequent (e.g. every 15 minutes) fails the deploy outright. Both crons here
are already set to once-daily schedules so this works on Hobby. The practical effect: an abandoned
online-payment order (customer started paying and never finished) will sit for up to ~24h before
being auto-cancelled, instead of ~30 minutes. Staff can still cancel it immediately by hand from
/admin/payments if that's too slow. If you upgrade to Pro later, you can tighten
/api/cron/expire-pending-payments back to something like "*/15 * * * *" in vercel.json.

## Step 4: Seed
After deploy, go to Vercel -> Functions -> Run:
npx prisma db push
npx tsx prisma/seed.ts

Or run locally:
DATABASE_URL="..." npx prisma db push
DATABASE_URL="..." npx tsx prisma/seed.ts

## Step 5: Domain
Vercel -> Settings -> Domains
Add: maqr.cloud
Add wildcard: *.maqr.cloud
Go to Cloudflare -> DNS -> CNAME *.maqr.cloud -> cname.vercel-dns.com

## Test
https://your-app.vercel.app/login
super@maqr.cloud / super123

https://your-app.vercel.app/t/5 -> customer (no auth)
https://your-app.vercel.app/kitchen -> will redirect to login if not kitchen user
