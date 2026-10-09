# Price Data Licensing — Outreach Emails (eBay, CovrPrice, GoCollect, PriceCharting)

Goal: a real, licensed source of **sold-price market values** so VLTD never shows a value nobody entered or looked up.
Each email asks for the same things: commercial API terms, cost, what it covers (comics, trading cards, vinyl, games), whether sold comps and history are included, and rate limits.

What I found while checking (verify before relying on any of it):
- **eBay Marketplace Insights API** — real sold items for the last 90 days, but it is a limited-release product approved by eBay's business units, not self-serve.
- **CovrPrice** — comic values based on recent sales on auction sites. Consumer plan is about $6.95/month. I found no public developer API (only a personal-token link used by Collectorz apps).
- **GoCollect** — comic price guide with a free tier and a paid plan; a key-based integration exists in third-party plugins, terms unknown.
- **PriceCharting** — games, cards and comics; consumer premium is about $50/year; official API terms and price unknown.
- Scraper services exist but carry terms-of-service risk. Not recommended.

Send each one separately. The goal of each email is a short call or a written quote, not a contract.

---

## 1. eBay — Marketplace Insights API access

**To:** eBay Developers Program support (open an "Application Growth Check" / Buy API production access ticket through developer.ebay.com; confirm current route)
**Subject:** Buy API — Marketplace Insights production access request — VLTD collector platform

Hi,

I'm the founder of VLTD (Vault), a collection-tracking platform for collectors of trading cards, comics, vinyl and other collectibles.

Our users want to see what their items actually sell for. Today we only show values that a collector types in themselves, and we are removing every automatic placeholder so no one sees a value that wasn't entered or looked up.

We'd like access to the Marketplace Insights API (sold items, last 90 days) to show real recent sold comparables on an item page. Each lookup would be started by an individual collector viewing their own item. We would show the sold price, date and a link back to the listing, and we would not resell or bulk-export the data.

Could you tell me:
1. What the application and approval process is for Marketplace Insights, and what you need from us.
2. Any usage limits, display requirements or attribution rules.
3. Whether there is a fee, and expected timing.

We are in early growth (soft launch) and expect several thousand active users over the next 12 months.

Thanks,
[EK]
Founder, VLTD
vltd.app
[phone]

---

## 2. CovrPrice — commercial data / API

**To:** CovrPrice support or business contact (confirm current contact on covrprice.com)
**Subject:** Commercial data access for a collector app — comic values

Hi,

I'm the founder of VLTD (Vault), a platform where collectors document and value their collections, including comics.

We would like to show real, sale-based comic values from CovrPrice inside VLTD instead of asking collectors to look values up by hand. We have seen that CovrPrice values are built from recent sales on auction sites, which is exactly what our users need.

Could you tell me:
1. Whether CovrPrice offers a developer or commercial API (or a data licence) for a third-party app.
2. What it costs, and whether pricing is per lookup, per month or per user.
3. What each lookup returns: raw and graded values, recent sold comps with dates, trend.
4. Rate limits, display and attribution requirements.

Every lookup would be started by a collector viewing their own item, with attribution and a link back to CovrPrice.

Thanks,
[EK]
Founder, VLTD
vltd.app
[phone]

---

## 3. GoCollect — API terms

**To:** GoCollect support or business contact (confirm current contact on gocollect.com)
**Subject:** API access and commercial terms — VLTD collector platform

Hi,

I'm the founder of VLTD (Vault), a collection-tracking platform for comics, trading cards and other collectibles.

We'd like to show GoCollect's comic values and sale history to our users, for their own items, with attribution. I understand an API key exists for some integrations.

Could you tell me:
1. How a third-party app gets API access, and the commercial terms for that.
2. The price, and whether there are volume tiers.
3. What the API returns (fair market value by grade, sold comps with dates and sources, trend).
4. Rate limits, caching rules and attribution requirements.

We are in soft launch and expect several thousand active users within a year.

Thanks,
[EK]
Founder, VLTD
vltd.app
[phone]

---

## 4. PriceCharting — API terms

**To:** PriceCharting support (confirm current contact on pricecharting.com)
**Subject:** API access and licensing — collector app (comics, cards, games)

Hi,

I'm the founder of VLTD (Vault), a platform where collectors document and value what they own: comics, trading cards, games, vinyl and more.

We'd like to show PriceCharting values and recent sold prices for a collector's own items, with attribution and a link back.

Could you tell me:
1. Whether you offer an API or data licence for a third-party app, and the terms.
2. The price, and whether it is per request, per month or by volume.
3. Which categories are covered (comics, trading cards, games, vinyl) and what each lookup returns: loose/graded values, sold listings with dates, history.
4. Rate limits, caching rules and attribution requirements.

Thanks,
[EK]
Founder, VLTD
vltd.app
[phone]

---

**Notes before sending:**
- Do not say we are pre-revenue. "In early growth and soft launch" is accurate.
- Keep each email short. The goal is a call or a written quote.
- When a source is chosen, VLTD should store the value together with its source and date so every number on screen says where it came from.
