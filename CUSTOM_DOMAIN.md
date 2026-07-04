# Custom Domain Setup (vltd.app)

## 1. Add domain in Vercel
1. Go to https://vercel.com → your VLTD project → **Settings → Domains**
2. Add `vltd.app` (and `www.vltd.app` if you want both)
3. Vercel will show you DNS records to add

## 2. Update your DNS registrar
Add the records Vercel shows — typically:
- `A` record: `@` → `76.76.21.21`
- `CNAME` record: `www` → `cname.vercel-dns.com`

## 3. Add the env var in Vercel
Go to **Settings → Environment Variables** and add:
```
NEXT_PUBLIC_SITE_URL = https://vltd.app
```
Apply to **Production**, **Preview**, and **Development**.

## 4. Redeploy
Trigger a redeploy so the new env var takes effect. All hardcoded URLs in:
- `share/[itemId]/page.tsx`
- `museum/share/[token]/layout.tsx`
- `museum/[galleryId]/guest/page.tsx`
- `u/[username]/page.tsx`

...will automatically use `https://vltd.app` instead of `https://vltd.vercel.app`.

## Result
- Facebook share cards will show `VLTD.APP` instead of `VLTD.VERCEL.APP`
- All canonical URLs and OG image URLs will use the real domain
- SSL is handled automatically by Vercel
