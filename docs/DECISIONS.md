# Decision Log

Running record of product and technical decisions for The Block buyer app. For each decision: what we chose, why, the pros and cons, and the alternatives we turned down.

## How to read this log

I built The Block with Claude Code, and Claude wrote this log as we went. It interviewed me as the customer, one round at a time, and recorded each decision with its reasoning. So in this file:

- "The owner" is me. Entries marked "Decided" are my calls, usually picked from options Claude laid out; "recommended" means I took the option it recommended.
- Below this note, "I" and "Decided by me" are Claude. Those are smaller calls it made on its own, which I reviewed afterwards. They're marked so you can tell the two apart.

It's long because nothing was deleted. When I changed my mind (short auctions to multi-day ones, tiered increments to a flat $100, list rows to cards), both versions stay, and the [interview log](#interview-log) at the end lists every question and answer in order.

If you only read a few entries, start with these:

- [P2: proxy bidding, eBay-style, with a "Your max bid" field](#p2-bid-model-ebay-style-proxy-bidding-with-a-your-max-bid-field-decided-updated-in-round-5)
- [P24: the price jumps to the reserve when the leader's max covers it](#p24-the-price-jumps-to-the-reserve-when-the-leaders-max-covers-it-decided-approved-in-round-10)
- [P13: condition comes first on the detail page](#p13-detail-page-leads-with-condition-decided-recommended)
- [P29: a confirm step on every bid](#p29-every-bid-and-buy-now-has-a-confirm-step-decided-by-me-open-to-change)
- [T8: auction rules as pure functions, separate from React](#t8-auction-logic-as-pure-functions-in-srcdomain-decided)
- [Batch 2: generated data has to agree with the real data (the intro to that section)](#batch-2-trust-pricing-and-community-planned-in-round-14-built-in-rounds-15-19)
- [P36: deal ratings, and why the planned tuning changed](#p36-deal-rating-high--fair--low-price-with-a-coloured-icon-built-in-round-17-tuning-changed)
- [P38: the 2-minute auction extension](#p38-soft-close-bids-in-the-last-2-minutes-extend-the-auction-built-in-round-15)
- [P43: the phone layout fixes, after I found problems Claude had missed](#p43-phone-layout-bid-bar-no-sideways-overflow-no-input-zoom-owner-chose-the-bid-bar-in-round-20)

Status key: **Decided** · **Open** (waiting on an answer) · **Revisit** (decided for now, may change)

---

## Context

- **Brief:** buyer side of a vehicle auction platform (see [the challenge brief](CHALLENGE.md)). Must-haves: browse and search inventory, vehicle detail view, a bid flow whose visible state updates, works on desktop and mobile, runnable from the README.
- **Timebox:** 3-4 hours suggested, 5 days to submit.
- **Inspirations:**
  - **eBay auctions:** bidding model and auction UX (current bid, bid count, time left, proxy/max bidding, "Buy It Now" next to the auction).
  - **AutoTempest:** car-specific data layout (dense result rows with year/make/model/trim, mileage, price, and location up front; filters for make, model, year, price, mileage, body, drivetrain, and so on).

## Dataset facts (from `data/vehicles.json`)

These shape several decisions below.

| Fact | Value |
|---|---|
| Vehicles | 200, from 32 dealerships, 15 makes |
| Body styles | SUV 106, sedan 52, truck 31, hatchback 6, coupe 5 |
| Fuel | gasoline 164, hybrid 15, diesel 11, electric 10 |
| Title status | clean 170, rebuilt 16, salvage 14 |
| Condition grade | 1.2 to 5.0 |
| Has bids already | 88 of 200 |
| Has a reserve price | 140 of 200 (60 have no reserve) |
| Reserve already met | 26 |
| Has Buy Now price | 39 |
| Auction starts | 2026-03-31 to 2026-04-06, spread over 7 days (synthetic) |
| Images | 3-6 per vehicle, placehold.co placeholders |

The data has auction **start** times but no **end** times or duration.

---

## Technical decisions

### T1. React + Vite + TypeScript, frontend only (Decided)

**Why:** the brief suggests this stack, and a frontend-only prototype is explicitly acceptable.

- **Pros:** fast dev server and builds; types catch mistakes in the vehicle and bid models; no server to run or deploy; reviewers can clone and run with one command.
- **Cons:** all auction logic (proxy bidding, rival bids, timers) runs in the browser, so state isn't shared between tabs or users; it would need rewriting to move server-side for a real product.
- **Alternatives:** Next.js (routing and API routes built in, but more framework than this needs); Vite plus a small API (a more honest auction model, but more to build and run).

### T2. App in `web/`, data stays at `data/vehicles.json` (Decided)

**Why:** keeps the challenge files untouched at the repo root.

- **Pros:** clear split between the brief and the solution; upstream changes to the data merge cleanly.
- **Cons:** the app imports data from outside its own folder, which needs a relative path or a Vite alias; `npm` commands have to be run from `web/`.

### T3. Minimal scaffold first, tooling chosen step by step (Decided, resolved by T5 and T6)

**Why:** the owner wanted to pick the rest of the tooling deliberately.

- **Pros:** nothing installed that we might not use; every dependency added has a logged reason.
- **Cons:** none left open; routing and styling are now decided in T5 and T6.

### T4. Dev server: `cd web && npm install && npm run dev` (Decided)

**Why:** standard Vite. It uses port 5173, or the next free port if that's taken.

- **Pros:** zero configuration for reviewers.
- **Cons:** the port can change (on this machine it's 5174 because 5173 was busy), so the README should say to use the URL Vite prints.

### T5. React Router (v8), library mode, filters in the URL (Decided, recommended)

**Version note (round 7):** chosen as "v7", but the current release on npm is v8 (8.5.1), so that's what's installed. Library-mode usage (`createBrowserRouter`, `RouterProvider`, `useSearchParams`) is the same. We can pin to 7.18.5 if needed.

**What:** React Router used as a plain client-side router (no framework mode or server rendering). Routes: results `/`, vehicle detail `/lot/:lot`, My bids `/my-bids`, Watchlist `/watchlist`. Search, filters and sort live in the query string via `useSearchParams`.

- **Pros:** the most widely used React router, so reviewers will know it; filters in the URL mean searches can be shared, bookmarked and survive reloads, and the back button works as expected; library mode keeps the app a simple static SPA.
- **Cons:** search params are untyped strings, so we need a small parse/serialize layer for filters (TanStack Router does this for you); a client-only SPA needs a fallback rewrite if it's ever deployed to static hosting.
- **Alternatives:** TanStack Router (type-safe search params, steeper setup, less familiar); Wouter (tiny, but more manual search-param handling).

### T6. Tailwind CSS v4 + shadcn/ui (Decided, recommended)

**What:** Tailwind for layout and styling. shadcn/ui components are copied into the repo as needed: likely Sheet (mobile filter drawer), Slider (year, price, km ranges), Select, Checkbox, Dialog (bid confirmation), Badge, and Sonner (outbid toasts, P16).

- **Pros:** fastest route to a polished, responsive UI in the timebox; shadcn components are built on accessible Radix primitives (keyboard, focus, screen readers); the code lives in our repo, so we own it and can explain or change any of it; theming via CSS variables makes dark mode (P22) cheap.
- **Cons:** adds dependencies (Radix packages, class-variance-authority, tailwind-merge); utility classes make JSX long; copied components can look generic ("shadcn look") unless we restyle them; setup needs a path alias (`@/`) in Vite and TypeScript.
- **Alternatives:** Tailwind only (no extra dependencies, but drawers, sliders and toasts with good accessibility take real time); CSS Modules (no framework, slowest to polish).
- **Setup details (round 7):** shadcn initialised with the Radix base and the "Nova" preset (neutral greys, Lucide icons). The preset's Geist font was swapped for Inter (P21). Class merging uses shadcn's own `cn` package. The `shadcn` package is a dev dependency: the app only needs its CSS at build time, and the npm audit advisories (ts-morph, minimatch) are in its CLI tooling, not in shipped code. `npm audit --omit=dev` is clean.

### T7. Dark mode via a `.dark` class set from the system setting (Decided)

**What:** a small inline script in `index.html` adds `.dark` to `<html>` when the OS prefers dark, and updates it if the setting changes. Tailwind's `dark:` variant and shadcn's tokens key off that class.

- **Pros:** runs before the first paint, so no flash of the light theme; a manual toggle (P22, optional) can later just set the class.
- **Cons:** a few lines of inline JavaScript outside React; without JavaScript, the page stays light.
- **Alternatives:** a pure CSS `prefers-color-scheme` media query (no script, but then a manual toggle needs rework).

### T8. Auction logic as pure functions in `src/domain/` (Decided)

**What:** all auction rules live in plain TypeScript, separate from React:
- `lot.ts`: one lot's rules (proxy bidding, reserve, Buy Now, outcome, buyer status).
- `schedule.ts`: start and end times relative to now (P1, P11).
- `rivals.ts`: when rivals bid and how high (P20). Tuning numbers sit in one `RIVAL_CONFIG` object.
- `auction.ts`: the whole auction state, buyer actions, and a `tick(state, now, rng)` that advances the simulation.
- `storage.ts`: versioned localStorage save/load (P9).

Every function takes the state, the time and a random source, and returns a new state.

- **Pros:** the rules are testable without a browser, timers or React; the time and random source are passed in, so tests are exact; React only has to call `tick` once a second and render.
- **Cons:** some lot data (prices, reserve) is copied into the lot state, so it's stored twice (in the dataset and in saved state); immutable updates copy objects on every bid, which is fine at 200 lots.
- **Alternatives:** logic inside React components or hooks (faster to start, hard to test); a state library such as Zustand (not needed yet).

### T9. Pending rival bids are stored as data, not timers (Decided)

**What:** a rival's planned response is saved in the auction state as "bid at time X", and `tick` fires it when its time comes. No `setTimeout` per rival bid.

- **Pros:** responses survive navigation and reloads (P9) and can't double-fire; tests jump time forward instead of waiting.
- **Cons:** while the tab is closed nothing ticks; overdue rival bids fire all at once on the next visit (they're skipped if the lot has ended).

### T10. Vitest for tests (Decided)

**What:** `npm test` runs Vitest. Domain tests sit next to the code (`*.test.ts`); 52 tests cover proxy bidding, validation, reserve, Buy Now, outcomes, the schedule, rival responses and background bids.

- **Pros:** shares Vite's config, so no separate setup; fast.
- **Cons:** one more dev dependency. No UI tests yet.

### T11. One small store with `useSyncExternalStore`, one clock (Decided)

**What:** [`src/state/auction-store.ts`](../web/src/state/auction-store.ts) holds the auction state, saves it on every change, and exposes hooks (`useAuctionState`, `useLot`, `useWatchlist`, `useNow`). A single 1-second interval runs `tick` (rival bids) and updates the clock for countdowns, and only while something on screen is listening. Other open tabs pick up changes through the browser's `storage` event.

- **Pros:** no state library needed; components subscribe to just the slice they need (`useLot` only re-renders for its own lot); one timer for the whole app instead of one per countdown.
- **Cons:** the inventory grid re-renders every second for the countdowns (fine at 200 cards; would need per-card clocks or virtualization at thousands); module-level state is shared by everything that imports it.
- **Alternatives:** React context + reducer (re-renders everything on each tick); Zustand (nicer API, one more dependency for the same result).
- **Bug found in round 11:** a fresh state was only saved after its first change, so a reload before any bid built a new schedule and countdowns jumped. It's now saved as soon as it's created. Found by the browser walkthrough.
- **Bug found in round 13:** on page load the first simulation step ran while React was still mounting, before the outbid-toast listener was attached. Rival bids that came due while the app was closed outbid the buyer silently. The first step now runs right after mounting. Confirmed with a browser test that plants a rival bid, before and after the fix.

### T12. Toasts via Sonner, without `next-themes` (Decided)

**What:** shadcn's Sonner toast component, edited to follow the system theme directly instead of pulling in `next-themes` (a Next.js theming package).

- **Pros:** one less dependency; consistent with T7.
- **Cons:** a small local change to a generated shadcn file, to remember if it's ever regenerated.

### T13. Inventory query kept in React state, mirrored to the URL (Decided)

**What:** [`useInventoryQuery`](../web/src/features/inventory/useInventoryQuery.ts) holds search, status, sort and filters in React state and writes them to the URL. When the URL changes from outside (Back/Forward, a link), the hook reads it back in.

- **Why:** reading the URL directly made controlled inputs lag a frame behind, because router navigations finish asynchronously. A browser test caught checkboxes briefly showing their old state; the same lag in the search box could drop fast keystrokes. React Router's `flushSync` option didn't fix it.
- **Pros:** inputs update instantly; URLs stay shareable; Back undoes the last filter change; filters survive a reload.
- **Cons:** two copies of the query (state and URL) that the hook keeps in sync.

---

## Product decisions

### P1. Auction timing: shift start times to "now", fixed duration, countdown (Decided, recommended)

**What:** keep the dataset's relative order of start times but anchor them around the current time. Each lot runs a fixed duration (see P11) with a visible countdown. Lots fall into three states: upcoming, live, ended.

**Why:** the data has only start times, and they're synthetic dates that will be in the past or future depending on when the app runs. The brief explicitly allows normalizing them.

- **Pros:** always a realistic mix of upcoming, live and ended lots whenever the app is opened; keeps each dealer's relative schedule; countdowns add the urgency an auction needs.
- **Cons:** shown times aren't the dataset's real times, which needs a short note in the README; the shift is recalculated from "now" on load, so the schedule must be stored (P9) or it will jump on every reload.
- **Alternatives:** make everything live now (simplest, but loses upcoming/ended states); use dates as-is (accurate, but most lots would never be biddable).

### P2. Bid model: eBay-style proxy bidding with a "Your max bid" field (Decided, updated in round 5)

**What:** the bid box has two ways to bid:
- a **quick bid** button for the next minimum bid (current bid + $100, see P12);
- a **"Your max bid"** field where the buyer types the most they'll pay. The system bids for them, $100 at a time, only as far as needed to stay on top.

The visible current bid only rises to $100 above the next-highest maximum. The buyer's own max is shown back to them ("Your max: $38,000") but never to rivals. The buyer sees "You're the high bidder" or "You've been outbid".

**Why:** matches the eBay inspiration, and it's how buyers expect online auctions to work.

- **Pros:** protects buyers from overpaying, since they never pay more than one increment over the runner-up; buyers don't have to watch every lot; familiar to anyone who has used eBay.
- **Cons:** harder to build and test than plain bids (tie-breaking, a max equal to the current bid, a bid below the minimum); confusing for buyers who don't know proxy bidding, so the UI has to explain why their $20,000 max shows as a $15,250 bid; the buyer's max must stay hidden from rivals.
- **Alternatives:** plain bids (simpler, but buyers overbid and have to babysit lots); max field only, no quick bid (round 1 choice, extended in round 5 because a one-tap bid is faster for casual bids).

### P3. Simulated rival bidders (Decided, recommended)

**What:** a timer places occasional rival bids on some live lots.

**Why:** without rivals the buyer always wins, and outbid states, live price changes and the outbid toast (P16) never show up in a demo.

- **Pros:** the app feels like a live marketplace; exercises the full proxy-bidding logic, including outbid; makes the walkthrough demo more convincing.
- **Cons:** fake activity has to be clearly a simulation, not presented as real data; rivals need rules (how often, how high, which lots) so they don't feel random or always outbid the buyer; timers keep running in the background, which complicates testing.
- **Alternatives:** the buyer is the only bidder (less to build, but half the bid UX never appears).

### P4. Reserve: show status only, never the amount (Decided, recommended)

**What:** each lot shows "No reserve", "Reserve not met" or "Reserve met".

**Why:** the industry and eBay norm.

- **Pros:** realistic; still tells buyers whether winning will actually buy the car; "No reserve" is a strong selling point we can filter on (P6).
- **Cons:** buyers can't see how far off the reserve they are, which can be frustrating; the hidden amount is still in the browser's data bundle, so it's only hidden in the UI, not secure (fine for a prototype).
- **Alternatives:** show the amount (more transparent, less realistic).

### P5. Results layout: compact card grid (Decided, changed in round 8)

**What:** small, dense cards in a responsive grid (about 5 across on a wide desktop, 1-2 on mobile), modelled on the owner's reference screenshot of a dealer-auction inventory grid. Each card:
- **Photo** (4:3) with the **condition grade** as a small badge in the top-left corner and an **auction time chip** along the bottom-left ("Ends in 2d 4h", "Starts in 25 min", "Ended").
- **Title:** year, make, model, trim on one line, truncated with an ellipsis.
- **Spec line:** engine | odometer (km).
- **Meta:** city, province; title status badge when it isn't clean; bid status on the right ("12 bids", "Awaiting bids", "Reserve not met").
- **Footer strip:** label + price on a tinted band: "Current bid $31,400", or "Starts at $14,500" with no bids.

We copy the card layout pattern from the reference, not its branding (P21).

**Why:** the owner prefers the reference's compact cards over list rows.

- **Pros:** scans quickly across many lots; a familiar pattern for dealer buyers on wholesale auction sites; condition grade and time left are visible at a glance on the photo; reflows naturally from 5 columns to 1 on mobile.
- **Cons:** less data per lot than a list row (dealer name and fuel/drivetrain move to the detail page); harder to compare one spec down a column; with placehold.co images the photo area is a grey box, so the badges and text carry the card.
- **Alternatives:** AutoTempest-style list rows (round 2 choice: more data per lot, replaced in round 8); a list/grid toggle (more work).
- **Not copied from the reference:** its row of icon stats (hours, days, percentage) refers to data we don't have, so it's left out unless we decide what it should show.

### P6. Filters in v1 (Decided)

**What:** make, model (depends on make), year range, current-bid range, odometer range, body style, drivetrain, fuel type, and auction state (live / upcoming / ended, no reserve, has Buy Now, ending soon), plus free-text search.

**Why:** covers how buyers narrow by vehicle and by auction status.

- **Pros:** the core AutoTempest filter set; auction-state filters are what make this an auction site and not just a classifieds page.
- **Cons:** a lot of controls for a 3-4 hour build; the filter panel needs a mobile treatment (drawer or sheet); range filters (year, price, km) take more UI work than checkboxes.

### P7. Condition, title and location are not filterable in v1 (Revisit)

**What:** condition grade, title status and province/city aren't filters, but still appear on every row and the detail page.

**Why:** the owner's call, to keep the filter panel focused.

- **Pros:** smaller filter panel; less to build.
- **Cons:** title status matters a lot to dealer buyers (30 of 200 lots are rebuilt or salvage), and condition grade is a common auction filter; location matters for transport costs. Title is the likeliest early add.

### P8. Buy Now follows the eBay rule (Decided, recommended)

**What:** Buy Now is available until the current bid reaches the reserve (or the Buy Now price, for no-reserve lots). Buying ends the auction at once as "Sold to you".

**Why:** matches eBay, and stops a Buy Now from undercutting an auction that's already competitive.

- **Pros:** realistic; adds a time-pressure decision (buy now or gamble on the auction); fair to existing bidders once bidding is serious.
- **Cons:** the rule isn't obvious to buyers, so the UI should say when and why Buy Now disappears; one more state transition to test (Buy Now available → gone, and auction → sold early).
- **Alternatives:** always available until the end; show the price as information only.

### P9. Persist buyer state in localStorage, with "Reset demo" (Decided, recommended)

**What:** the buyer's bids, the simulated auction state (including the P1 schedule) and the watchlist are saved in the browser.

**Why:** a reload during the walkthrough shouldn't wipe the demo.

- **Pros:** the demo survives reloads; no backend needed; "Reset demo" gives a clean starting point on demand.
- **Cons:** state is per browser, so a reviewer on another machine starts fresh; stored data can go stale if the data or state shape changes, so it needs a version key; localStorage can be unavailable (private mode), so the app must still work without it.
- **Alternatives:** in-memory only (simplest, but a reload resets everything).

### P10. Watchlist (Decided)

**What:** buyers can watch lots (implied by P9, page added in P15).

**Why:** eBay's "watch" is a core part of following auctions without bidding.

- **Pros:** lets buyers track lots they're unsure about; cheap to build.
- **Cons:** one more piece of state to persist and reset.

### P11. eBay-style multi-day auctions, staged around the demo (Decided, changed in round 4)

**What:** every auction runs for days, like an eBay listing (default: a 3, 5 or 7 day duration per lot, assigned from the dataset so it's stable). Start times are placed so that, whenever the app is opened, lots sit at different points of their run:
- a handful **end within the demo** (minutes to an hour away), so "ending soon" and closing can be shown live;
- a handful **start during the demo** (upcoming, minutes to an hour away);
- most are **mid-auction**, ending over the next few days;
- some have **already ended** (see P18).

**Why:** the owner wants it to mimic how eBay runs auctions, while still showing auctions open and close during a walkthrough.

- **Pros:** realistic eBay pacing and countdowns ("3d 4h left"); still shows the full lifecycle in a 45-60 minute demo; the dataset's 7-day spread of start times fits naturally into multi-day auctions, so no heavy compression is needed.
- **Cons:** the staged lots ending "right now" are a demo device and should be noted in the README; most lots won't change state during a session, so rival bids (P20) carry most of the visible activity; an auction you're winning can end while you're elsewhere in the app, so wins need surfacing (P14, P16).
- **Alternatives:** short minutes-to-hours auctions (my first recommendation, chosen in round 3, then replaced in round 4: more lots close in a demo, but it doesn't feel like eBay); about an hour each, like a physical dealer lane.
- **Default picked by me, open to change:** 3/5/7 day durations and the "handful" sizes (roughly 5-10 lots each for ending soon and starting soon).

### P12. Flat $100 bid increments (Decided, changed in round 5)

**What:** every bid step is $100 at any price: $35,000 → $35,100 → $35,200. Max bids must be in whole $100 steps and at least the next minimum bid.

**Why:** the owner's call: one rule that any buyer can predict.

- **Pros:** dead simple to explain and test; buyers can work out the next bid in their head; no tier boundaries to get wrong.
- **Cons:** on expensive lots, $100 steps mean many small bids and long proxy-bidding chains (fine for software, slower for a human using quick bid); not how eBay scales increments. Max bids not on a $100 step need handling (reject with a clear message, or round down).
- **Alternatives:** a tiered table ($100 / $250 / $500 by price; my first recommendation, chosen in round 3, replaced in round 5).

### P23. Max bid can be any dollar amount above the current bid (Decided, round 7)

**What:** the "Your max bid" field accepts any whole-dollar amount greater than the current bid, for example $35,150. It does not have to be on a $100 step. The $100 step from P12 still applies to quick bids and to how proxy bidding raises the visible price.

**Why:** the owner's call: buyers type the number they actually have in mind.

- **Pros:** no validation errors for normal numbers; matches how people think about a budget ("I'll go to $35,150").
- **Cons:** the visible bid can land off the $100 grid. When proxy bidding is capped by someone's max, the price shows that max (or $100 over it, e.g. $35,250). eBay does the same. A max less than $100 above the current bid (say $35,050 on a $35,000 bid) is smaller than a normal step; it's accepted, but the UI should make clear it's a smaller-than-usual raise.
- **Alternatives:** require $100 steps and reject other values; round down to the nearest $100.

### P13. Detail page leads with condition (Decided, recommended)

**What:** condition grade, title status and damage notes sit high up next to the photos and bid box. The full specs table and selling dealer come below.

**Why:** dealer buyers bid without inspecting the car in person, so condition is what decides the price.

- **Pros:** answers the buyer's biggest risk question first; makes salvage/rebuilt titles and damage hard to miss, which builds trust; makes up for placeholder photos.
- **Cons:** key specs (km, engine, drivetrain) move lower, so a short spec strip may still be needed near the title; condition-first is less common on retail car sites, so it may surprise some users.
- **Alternatives:** specs first (AutoTempest style); bid box only, with everything else below.

### P14. "My bids" page (Decided)

**What:** a buyer view listing every lot they've bid on, grouped as winning, outbid, won and lost (like eBay's "Bids & offers").

- **Pros:** one place to see where the buyer stands; with short auctions (P11) it's where wins and losses show up.
- **Cons:** needs routing (T5); one more page to design for mobile.

### P15. Watchlist page (Decided)

**What:** a separate page listing watched lots.

- **Pros:** quick to reach; reuses the result row from P5.
- **Cons:** overlaps a little with a "watched" filter on search; another route.

### P16. In-app toast when outbid (Decided)

**What:** an in-app notification when a rival outbids the buyer on any lot, wherever they are in the app.

- **Pros:** makes the rival simulation (P3) visible; gets buyers back to a lot before it ends.
- **Cons:** needs app-wide state and a toast system; must not get noisy if many lots are active (consider batching); shows only while the app is open.

### P17. No bid history list in v1 (Decided)

**What:** the detail page shows bid count and current bid, but no list of individual bids.

**Why:** the owner didn't pick it for v1.

- **Pros:** less to build; avoids generating fake history for the 88 lots that already have bids.
- **Cons:** less transparency into how competitive a lot is; buyers can't see when a rival's bids came in.

### P18. Ended lots show their outcome and are hidden by default (Decided, recommended)

**What:** an ended lot shows "Sold for $X" (reserve met or no reserve) or "Reserve not met" (didn't sell). Ended lots are left out of default results but can be shown with the auction-state filter, like eBay's "Sold items".

- **Pros:** default results only show lots you can act on; sold prices are useful market data for buyers pricing similar cars.
- **Cons:** buyers may not realise ended lots exist unless the filter is obvious; ended lots the buyer bid on must still appear on My bids (P14).
- **Alternatives:** keep them in results, greyed out at the bottom; remove them entirely.

### P19. Default sort: ending soonest (Decided, recommended)

**What:** results default to ending soonest. Other sorts: current bid (low/high), km, year, newly listed.

- **Pros:** eBay's default for auctions; puts the most urgent lots, including the staged "ending soon" ones (P11), at the top.
- **Cons:** upcoming lots, which have no end time in play yet, need a defined place in this order (after live lots); a buyer browsing for a specific car may prefer best match.
- **Alternatives:** lot number (like a physical run list); newly listed.

### P20. Rival bidders: moderate, they react to the buyer, then give up or win (Decided, updated in round 5)

**What:** background rival bids land on random live lots every 20-60 seconds, so the market feels active. When the buyer takes the lead on a lot, a rival responds in one of two ways:
- **Tries and gives up:** the rival bids a couple of times (2-3 bids, a few seconds apart) trying to beat the buyer's max. Each bid fails against the buyer's proxy, which pushes the current bid up $100 at a time, and then the rival stops. The buyer stays on top.
- **Out-maxes the buyer:** the rival sets a hidden max above the buyer's. Proxy bidding then puts the rival in the lead at $100 over the buyer's max, and the buyer is outbid (P16).

Each rival has a hidden max, just like the buyer, and all bids go through the same proxy logic, so there's no special-case code for rivals.

**Why:** the owner wants rivals that push back realistically but don't always win.

- **Pros:** the buyer sees both outcomes: holding the lead against pressure, and being outbid; reuses the proxy engine (P2), so rivals and the buyer follow the same rules; the "couple of tries then stop" pattern is how real bidders behave.
- **Cons:** the odds of a rival out-maxing the buyer and the size of that margin are tuning guesses (default below); delayed rival bids need timers that survive navigation and reloads (P9) without double-firing.
- **Defaults picked by me, open to change:** about 1 in 3 responses out-max the buyer, by a random $100-$1,500 over the buyer's max; a rival never goes past the Buy Now price when there is one.
- **Alternatives:** light background bids only (calmer, but outbid is rare); aggressive with last-second sniping (dramatic, can feel unfair).

### P21. Visual direction: clean professional marketplace (Decided, recommended)

**What:** white and light-grey surfaces, one strong accent colour for primary actions (bid, Buy Now), dense AutoTempest-style rows (P5), and an eBay-style bid box. Status uses colour consistently: green for winning or reserve met, red/amber for outbid or ending soon. Prices and countdowns use tabular numbers so they don't jitter as they change.

**Why:** the users are dealer buyers making money decisions, so the app should read as a serious, trustworthy tool.

- **Pros:** fits the data-dense layout; easy to scan; trust matters when buyers bid thousands on cars they haven't seen; easiest look to keep consistent in the timebox.
- **Cons:** can look plain or generic without care in the details (type scale, spacing, the bid box); less "live auction" energy than the dark terminal option, so live activity needs other cues (brief highlight when a price changes, the outbid toast).
- **Alternatives:** dark trading terminal (live-auction energy, harder to make readable and trustworthy); warm consumer style (photo-led, but the photos are placeholders and it suits retail buyers more than dealers).
- **Accent and type (round 7):** deep blue accent; Inter for all text, self-hosted from npm (`@fontsource-variable/inter`) so there's no external font request. Wordmark is plain "The Block" text for now. The app uses its own look and doesn't copy OPENLANE's branding.

### P22. Light and dark themes, following the system setting (Decided, recommended)

**What:** colours defined as CSS variables (shadcn's theme tokens); dark mode follows the operating system. A manual toggle is optional.

- **Pros:** cheap with CSS variables from day one; respects the user's setting; shows attention to detail.
- **Cons:** every screen and status colour has to be checked in both themes; placeholder images are light grey and will look bright on dark backgrounds.
- **Alternatives:** light only (one theme to check, slightly faster).

### P24. The price jumps to the reserve when the leader's max covers it (Decided, approved in round 10)

**What:** if the leading bidder's max is at or above the reserve but the visible price is below it, the price rises to the reserve. Example: reserve $25,000, the only bidder's max is $30,000. The price shows $25,000 (reserve met), not the $10,000 starting bid. eBay does this.

**Why:** without it, a lot can end "reserve not met" even though the winner said they'd pay more than the reserve. That's a bad outcome for both buyer and seller.

- **Pros:** no false "didn't sell"; matches eBay.
- **Cons:** reveals a little about the reserve (the price stops exactly at it); the price can jump by more than $100 at once, which needs a short explanation in the UI.
- **Alternatives:** no jump, strict $100 steps (simpler to explain, but causes the bad outcome above).

### P25. Details of how the simulation runs (Decided, approved in round 10)

- **Existing bids in the dataset** belong to an unnamed earlier bidder. Their hidden max is unknown, so it's taken as equal to the current bid. Beating them costs just the next step.
- **Bid count** goes up by 2 when a bid triggers the other bidder's proxy (both bids count, as on eBay), otherwise by 1.
- **Mid-auction lots** end between 2 hours and 3 days from now, so they never mix with the "ending soon" group (which ends within the hour). Found by a failing test.
- **Upcoming lots** are picked from lots with no bids, since a lot that hasn't started can't have bids.
- **Buy Now** counts as one bid and sets the price to the Buy Now price.

### P26. Inventory toolbar: search, status tabs, sort (Decided by me, open to change)

**What:** above the card grid:
- **Search** across year, make, model, trim, body, lot number, VIN, dealer, city and province. Every word must match ("ford bronco"). Kept in the URL as `?q=`.
- **Status tabs:** Live & upcoming (default), Live, Upcoming, Ended. This is the auction-state part of P6 and the "ended lots hidden by default" rule of P18.
- **Sort** dropdown (P19) and a live result count.

The full filter panel from P6 (make, model, year, price, km, body, drivetrain, fuel, no reserve, Buy Now) is the next step.

- **Pros:** the most-used controls are one tap away; URLs are shareable (`/?q=f-150&sort=price-asc`).
- **Cons:** search matches whole words loosely ("ram" also matches "Ram" trucks and dealers named "...ram..."); no typo tolerance.

### P27. Card details (Decided by me, open to change)

- **Prices** in Canadian dollars (the inventory is all in Canadian provinces), shown as "$22,800".
- **Location** as city + province code ("Toronto, ON").
- **Time chip** turns red in the last hour; countdowns get more precise as time runs out ("3d 4h", "4h 12m", "12m 05s").
- **Condition grade badge:** green at 4.0 and up, amber below 3.0.
- **Tags:** branded title (rebuilt/salvage), No reserve, Reserve met, and Buy Now with its price while available. "Reserve not met" isn't tagged on live lots, to keep cards quiet; it shows on ended lots and on the detail page.
- **Right side of the meta row:** your status (Winning / Outbid / Won / Lost) if you've bid, otherwise the bid count or "Awaiting bids".
- **Watch** heart in the top-right corner of the photo.
- **Grid:** auto-fills cards at least 240px wide: 5 across on a 1440px screen, 2 on small tablets, 1 on phones. On phones the nav moves to its own row under the wordmark.
- **Reset demo** sits in the header and asks for confirmation first.

### P28. Detail page layout (Decided by me, open to change)

**What:** following P13 (condition first):
- **Header:** lot number and location, the title, a watch button, then a **key facts strip**: grade, title status, damage-note count, km, drivetrain, engine. Condition is visible before scrolling on every screen size.
- **Desktop:** photos, full condition report, specs and seller on the left; the **bid box** stays pinned on the right while you scroll.
- **Phones:** photos, bid box, condition, specs, seller.
- **Gallery:** main photo with previous/next buttons, a photo counter and a thumbnail strip.
- **Condition section:** grade with a meter, title status with a plain-language explanation of rebuilt and salvage titles, the inspection report, and the damage notes as a list.
- **Back link** returns to the previous page, keeping the inventory search and scroll position, or to the inventory if the lot was opened directly.

- **Pros:** buyers see the risk facts first; the bid box is always in reach on desktop; each section is rendered once (one grid, rearranged by screen size).
- **Cons:** the page is long on phones; with placeholder photos the gallery takes a lot of space for little information.

### P29. Every bid and Buy Now has a confirm step (Decided by me, open to change)

**What:** quick bid, max bid and Buy Now each show an inline "Bid $21,100?" / "Set your max bid to $31,150?" / "Buy it now for $51,500?" panel, explaining what will happen, with Confirm and Cancel. Nothing is committed until Confirm.

- **Why:** bids are binding and involve thousands of dollars. A review step builds trust and prevents mis-taps on phones. eBay also has a review step.
- **Pros:** fewer accidental bids; a place to explain proxy bidding at the moment it matters.
- **Cons:** one extra tap per bid, which slows down bidding wars in the final seconds. If the price moves while the panel is open, Confirm can fail; the buyer then sees "The price moved. Enter $X or more."
- **Alternatives:** one-tap bidding (faster, riskier); a modal dialog (heavier, covers the price).

### P30. Bid box wording and feedback (Decided by me, open to change)

- **Quick bid** button shows the exact amount ("Bid $21,100") and is hidden while you lead, since bidding against yourself makes no sense. Instead, the field becomes "Raise your max bid".
- **Status banner:** "You're the high bidder" (with a warning when you lead but the reserve isn't met), "You've been outbid", "You won this vehicle", "You didn't win", or "Reserve wasn't met" when you led but the price stayed below the reserve.
- **Reserve line** explains each state in plain words ("The seller's minimum price hasn't been reached yet").
- **Toasts after a bid** cover the surprising cases: outbid right away (another bidder's max was higher), and the price jumping to the reserve (P24).
- **Max bid field** accepts "$31,150", "31150" or "31 150" and shows the minimum as its placeholder.

### P31. Filters live in a drawer, with removable chips (Decided by me, open to change)

**What:** a **Filters** button next to the search box (showing how many filters are on) opens a side drawer on every screen size. Changes apply as you tick them; the drawer footer has "Clear all" and "Show N vehicles". Active filters appear as **chips** above the grid, each removable with one tap.

Filters (P6): No reserve, Buy Now available, Ending within 24 hours; make; model (appears once a make is picked, grouped by make); year from/to; price from/to (current bid, or starting bid); kilometres up to; body style; drivetrain; fuel.

Rules:
- A **model narrows only its own make**: Ford + Toyota + "F-150" shows Ford F-150s and every Toyota, as on AutoTempest. Unticking a make removes its models.
- Picking a "from" above the "to" moves the other end to match.
- Each option shows a **count**, based on the current status tab and search (not on the other filters).

- **Pros:** keeps the 5-column card grid from the reference screenshot (a sidebar would cut it to 4); one design for phones and desktop; chips make it obvious why results are narrowed.
- **Cons:** filters are a click away on desktop rather than always visible; counts don't reflect the other filters, so a combination can still return zero (e.g. Toyota 2020+ 4WD: the only match had already ended).
- **Alternatives:** AutoTempest-style left sidebar (always visible, narrower grid); eBay-style dropdown buttons per filter in a row (fast, but much more UI).
- **"Ending soon"** means live and ending within 24 hours.

### P32. My bids and Watchlist pages (Decided by me, open to change)

**My bids (P14):** every lot you've bid on or bought, in groups ordered by urgency: **Outbid** (needs action), **Winning**, **Won**, **Didn't win**. Jump links at the top show each group's count. Live lots are sorted by soonest end, ended lots by most recent. Empty state links back to the inventory.

**Watchlist (P15):** watched lots, live first (soonest end), then upcoming, then ended. Ended lots stay so you can see what they sold for (P18).

**Nav badge:** a red count on "My bids" when you've been outbid on live lots, visible from every page.

**Outbid toast (P16):** stays 10 seconds (instead of 4) with a "View" button, since it needs action before the auction ends.

- **Pros:** the buyer always knows where they stand and what needs attention; both pages reuse the inventory cards, so status, price and countdown look the same everywhere.
- **Cons:** no way to remove an ended lot from the watchlist other than un-hearting it; My bids has no filters or search (fine at prototype scale).

---

## Batch 2: trust, pricing and community (planned in round 14, built in rounds 15-19)

These come from the market analysis of other car platforms (OPENLANE, ACV, Manheim, Bring a Trailer, Cars & Bids, AutoTrader.ca and others). The dataset has no fault codes, engine recordings, market values, price history or comments, so most of this batch is **generated demo data**. The rule for all of it: generate it from the car's real fields (grade, condition report, damage notes, title, year, km) so it agrees with the rest of the page; make it the same on every load (seeded by the car's id); and label it as demo data.

### P33. Grade explainer: tooltip plus a "How grading works" panel (Built in round 16)

**What:** the condition grade gets an explanation in two places.
- **Tooltip** on the grade badge (cards and the detail page's key facts strip): the band's meaning and the car's damage note count. On the detail page it's a tap-to-open popover, so it works on phones; on cards it's hover-only, since tapping a card opens the car.
- **"How grading works" panel** (a dialog, linked from the popover and the condition section): the full 0–5 scale with this car's band highlighted, and one line on how inspectors set grades.

Bands (based on the NAAA scale):

| Grade | Band | Meaning |
|---|---|---|
| 4.5–5.0 | Excellent | Like new. Minimal wear, no repairs needed |
| 3.5–4.4 | Clean | Light wear for its age, minor cosmetic flaws |
| 2.5–3.4 | Average | Normal wear, some cosmetic and minor mechanical repairs |
| 1.5–2.4 | Rough | Heavy wear or visible damage, several repairs needed |
| 0–1.4 | Poor | Major damage, may not be roadworthy |

**Why:** the brief asks for a clearer buyer experience. Manheim's buyer guides show the grade alone isn't enough; buyers need to know what the number means.

- **Pros:** explains the number where the buyer looks at it; the panel teaches the whole scale once.
- **Cons:** the dataset's grades aren't calculated from the damage notes, so we explain the band, not why this car got exactly 3.3. The panel says so plainly ("set by the inspector from the full report").
- **Alternatives:** tooltip only; a separate page.

**As built:** the card badge, the condition meter and the strip now take their colour from the band (green for Excellent and Clean, amber for Rough and Poor), where before they used their own cut-offs (green from 4.0, amber under 3.0). The condition section shows the band name and meaning under the grade, with its own "How grading works" link. The popover's "See them" jumps to the damage notes.

### P34. Engine & diagnostics: fault codes and an engine sound analysis (Built in round 16)

**What:** a new section on the detail page, after Condition.

**Fault codes (like OPENLANE's Code Boost IQ).** Real OBD-II codes (e.g. P0420, P0300, P0700), each with a plain-English explanation and a colour:
- **Red, serious:** have it checked before buying (misfire, transmission, airbag, flood electrical).
- **Amber, monitor:** works now, may need repair (catalytic converter, EVAP leak, thermostat).
- **Grey, info:** stored or history codes, no current symptom.

Generated from the car's data so it matches the rest of the page:
- Damage notes map to codes: "Check engine light - catalytic converter code" → P0420; "Transmission slips…" → P0700 + P0732; "Flood damage - electrical…" → U0100 and B-codes; "Airbag deployed…" → a stored SRS history code; "AC compressor intermittent" → B-code, info.
- The grade sets how many extra codes appear: 4.5+ none; 3.5–4.4 at most one info code; 2.5–3.4 zero to two; under 2.5 two to four, which can include serious ones. "Not roadworthy" and "Mechanical inspection recommended" reports push it toward the high end.
- Electric cars get EV-specific codes (battery and charging) and no engine sound check.

**Engine sound analysis (instead of ACV's AMP recording).** An overall verdict (**Normal / Minor noise / Needs attention**), a drawn waveform of a ~30-second start-up, idle and rev, with flagged moments marked on it, and a list of findings (e.g. "0:04 Lifter tick at cold start", amber). The verdict follows the same inputs as the codes.

The key facts strip gains an item: e.g. "2 codes · Engine: minor noise".

**Why:** dealers buy without driving the car, so engine health is the biggest unknown after the grade. OPENLANE and ACV both lead with this.

- **Pros:** gives the condition story an engine chapter; colours make it scannable; derived data never contradicts the damage notes.
- **Cons:** it's fake data, clearly labelled "Demo data, generated from this car's condition report". The waveform looks like real audio analysis but isn't (owner chose it over a plain findings list in round 14). Adds a sizable section to an already long page.
- **Alternatives:** random codes (could contradict a 4.9 grade); findings list without a waveform; scores per check.

**As built:**
- The A/C note maps to P0645 (A/C clutch relay circuit), marked Monitor rather than Info, since the inspector says it "needs diagnosis".
- Only engine codes affect the sound verdict. Transmission and flood-wiring codes from damage notes are serious, but they don't make the engine sound different, so they don't make it "Needs attention" on their own. A grade under 2.0 does.
- Across the 200 cars: 77 sound normal, 75 have minor noise, 38 need attention, 10 EVs have no sound check; 55 cars have no fault codes.
- The waveform is decorative (hidden from screen readers); the numbered findings list under it carries the same information.

### P35. Condition guarantee and claims (Built in round 18)

**What:** an as-described guarantee in the spirit of OPENLANE's, under our own name ("Block Guarantee"), so we don't copy OPENLANE's trademarked name.
- **Coverage:** clean-title cars only. Rebuilt and salvage cars show "Sold as-is". Covered cars show a "Guaranteed" badge in the key facts strip and the bid box; the badge opens a short summary of what's covered.
- **Covered:** problems that weren't disclosed in the condition report or damage notes: mechanical, electrical, frame or structural, flood, odometer, missing keys or equipment.
- **Not covered:** anything already disclosed, normal wear for the grade, and repairs estimated under $500.
- **Window:** 7 days from winning (or buying with Buy Now). Won lots show "Claim window: 5d 3h left" in My bids and on the lot page.

**Filing a claim (form plus a simulated review):** on a won, covered lot within the window: pick a problem category, describe it (required), enter an estimated repair cost, submit. It shows **Under review**, and 15–30 seconds later (sped up for the demo) it's decided:
- **Approved** if the category isn't covered by any disclosed damage note and the estimate is $500 or more. The resolution: the seller pays the repair, up to the estimate.
- **Denied** with the reason: "Disclosed in the damage notes: Frame damage - right front (repaired)", or "Below the $500 minimum".

One claim per category per lot. A toast announces the decision, like the outbid toast.

**Why:** a guarantee is how wholesale platforms earn trust for buying sight unseen (OPENLANE, ACV, Manheim all have one), and it gives the as-is title badge real meaning.

- **Pros:** completes the story after "Won"; rewards the condition-first design (a disclosed problem can't be claimed); the review rule is simple and testable.
- **Cons:** the decision is automatic and instant compared with real arbitration, which takes days and includes an inspection; the category match is crude (a "mechanical" claim on a car with a disclosed transmission note gets denied even if it's about the brakes).
- **As built:**
  - "Block Guarantee" (green shield) or "Sold as-is" sits in the key facts strip and at the bottom of the bid box; both open a summary of what's covered and what isn't.
  - On a won lot the bid box shows the claim panel: time left in the window, each claim with its status (Under review, Approved, Denied with the reason), and the form (category with examples, description, repair estimate). Filing doesn't have a confirm step: unlike a bid, nothing is binding.
  - A claim counts as disclosed if a damage note **or a sentence in the inspection report** matches its category (e.g. "Mechanical inspection recommended" discloses mechanical problems). A denial quotes every matching note.
  - The decision is worked out when the claim is filed and revealed when the review ends, so a reload mid-review doesn't change it.
  - In My bids, won cards get a line: "Claim window: 6d 23h left", "Claim under review", "Claim approved" or "Sold as-is, no guarantee".
- **Alternatives:** submit with no decision; information only. OPENLANE's two-path window (5–7 days from sale, 7–14 from delivery) was turned down because we'd have to simulate delivery.

### P36. Deal rating: High / Fair / Low price with a coloured icon (Built in round 17, tuning changed)

**What:** every lot gets an estimated market value, and the current price (current bid, or starting bid if there are none) is compared with it:
- **Low price** (good deal): under 90% of value. Green down-arrow icon.
- **Fair price:** 90–110%. Grey dash icon.
- **High price:** over 110%. Amber up-arrow icon.

Shown as a small icon plus label next to the price on every card, and as a panel on the detail page ("Estimated value $31,400 · Current bid is 12% below"). The rating changes as bids come in, so a lot that starts as a Low price can become Fair. Labelled "Estimate, demo data".

**Market value:** calculated from the starting bid (public information), adjusted for year, km, grade and title, plus seeded noise of about ±15%. It doesn't use the reserve, so the rating can't leak the hidden reserve (P4).

**Why:** AutoTrader.ca's Price iQ and CarGurus' deal ratings answer the buyer's first question ("is this a good price?") right on the results page. The owner asked for icons rather than a fully coloured badge.

- **Pros:** scannable on the grid; a reason to bid early; moving ratings make the auction feel live.
- **Cons:** the value is made up; tying it to the starting bid means it reflects the seller's own pricing more than the market; the noise has to be tuned so the mix of Low, Fair and High looks believable (target roughly 30 / 45 / 25 at load).
- **Alternatives:** compare within the dataset (most models have too few cars); use the reserve (leaks it).

**As built, and a change to the plan's tuning:** the planned 30 / 45 / 25 mix at load couldn't be squared with the reserves. Reserves average 1.47× the starting bid. Tuned for 30 / 45 / 25 at load (value ≈ 1.2× the starting bid), about 80% of lots would read "High price" by the time bidding reached the reserve, which says most sellers' minimums are above market. I set the value to 1.35× the starting bid instead (then adjusted: ±4% per grade point from 3.0, ±1.5% per 10,000 km off 18,000 km a year, capped at ±10%; rebuilt −8%, salvage −15%; ±15% noise). Result: at load, 127 Low / 36 Fair / 17 High across the 180 live and upcoming lots; at the reserve, 13% Low / 34% Fair / 54% High. In words: starting bids look cheap, and the rating moves to Fair or High as bidding gets serious. That's how dealer auctions behave, and it makes the rating move during a demo. Easy to retune in `MARKET` in `web/src/domain/market.ts`.

Other details: the card shows the icon with a hover tooltip ("Low price: 12% below the estimated value of $8,000"), and the label is read out to screen readers. The bid box shows a line under the price ("Low price · 23% below est. value $27,300") that jumps to a new "Price check" section. Sold lots are rated on their final price; lots that ended unsold have no rating.

### P37. Model price trend on the detail page (Built in round 17)

**What:** under the deal rating, a 12-month line chart of the average sale price for that make and model (e.g. "Ford F-150, all trims"), with this car's current price marked as a dot. Simulated around the model's average market value with gentle depreciation and noise, seeded by make and model, so every F-150 shows the same line. A plain SVG chart, no chart library.

- **Pros:** context for the deal rating ("F-150s have dropped 4% this year"); cheap to draw.
- **Cons:** made-up history; mixes trims and years into one line, as the owner's request was per model.
- **Alternatives:** a recent-sales list; both.

**As built:** in the Price check section after Engine & diagnostics. Follows the dataviz rules: a 2px line, solid hairline gridlines, no legend (one series, the heading names it), the latest value labelled at the end, this car's price as a labelled reference line. A crosshair with a tooltip follows the pointer, and the arrow keys do the same when the chart has focus. A "Show as a table" view lists every month. Drawn at real pixel size (it measures its container), so text doesn't shrink on phones.

### P38. Soft close: bids in the last 2 minutes extend the auction (Built in round 15)

**What:** any bid placed when less than 2 minutes remain resets the end to 2 minutes from that bid, like Bring a Trailer. No limit on extensions. It applies to buyer bids, rival responses and background rival bids. Buy Now still ends the lot at once. The countdown shows an "Extended" tag, and the bid box explains the rule ("Bids in the last 2 minutes extend the auction by 2 minutes").

**Rival snipes ("sometimes"):** when you're leading a lot, there's a 40% chance a rival plans a last-minute bid 10–50 seconds before the end. It works like a normal rival response (one in three out-maxes you, the rest fail against your max), so the extension visibly kicks in and you get time to respond.

**As built:**
- Only a bid that moves the price or the lead extends the auction. Quietly raising your own max while you lead doesn't, so it can't be used to keep an auction open.
- Whether rivals snipe is decided once per lot and demo (seeded by the lot and the demo's start time), so bidding again doesn't re-roll the 40%.
- The bid box always shows the rule, and adds "Extended once by late bids" after it kicks in; the countdown chip shows "Extended".

**Why:** owner's top pick. It stops last-second sniping, which matters even more here because the simulated rivals react within seconds.

- **Pros:** fairer endings; makes the end of an auction exciting in a demo; matches what enthusiast auctions do.
- **Cons:** end times are no longer fixed, so "ending soonest" order can shuffle in the last minutes; an auction could run on, in theory, while bids keep coming.
- **Alternatives:** Cars & Bids' 1-minute rule; a cap of 5 extensions.

### P39. All-in price in the bid box (Built in round 15)

**As built:** a collapsed line under the max bid form ("Win at $21,100: $21,800 all-in") that opens to the breakdown, the "Deliver to" picker and a "How fees work" table. When you lead, it uses the current bid. The confirm step shows the breakdown for the amount being confirmed; for a max bid it's labelled "The most it can cost, at your full max".

**What:** the bid box shows what the next bid (or Buy Now) costs in total: the bid, a buyer fee and a transport estimate, with "plus applicable taxes". The confirm step shows the same breakdown. Not on cards, to keep them compact.

- **Buyer fee:** a tiered table, shown in a "Fees" tooltip. Proposed tiers: under $10,000: $300; $10,000–24,999: $450; $25,000–49,999: $600; $50,000+: $800.
- **Transport:** from the car's province to a "Deliver to" province picked in the bid box (default Ontario, saved). Estimated from the distance between each province's largest city (straight line × 1.25 for roads): $150 plus $0.60 per km, rounded to $25, with a flat $250 within the same province and as the minimum. The plan said $0.85 per km; that priced Toronto to Vancouver at about $3,700, so I lowered it. It's now about $2,675 (and Toronto to Montreal about $525).
- **Taxes:** left out. Dealers usually claim sales tax back, so including it would overstate the cost.

**Why:** Bring a Trailer and Cars & Bids publish their fees up front; surprise fees after winning hurt trust.

- **Pros:** no surprises at checkout; the delivery picker makes distant lots' real cost visible.
- **Cons:** made-up fees and distances; province-to-province is coarse (Toronto to Ottawa counts as "same province").
- **Alternatives:** fee only; adding taxes.

### P40. Questions & answers on each lot (Built in round 19)

**What:** a "Questions & answers" section at the bottom of the detail page.
- **Seeded:** each lot starts with 0–4 questions from other buyers (shown as "Buyer in Calgary, AB", never invented names), picked from templates that fit the car (rust, keys, service records, tires, accident history, the check engine light). Most have a seller reply, labelled "Seller · [dealership]", written from the car's real data. Replies never promise something the data doesn't say.
- **You can ask:** your question is saved locally and shown as "You". The seller replies after 10–30 seconds, using keyword matching against the car's data, or a fallback ("We'll check and add photos to the listing"). A toast tells you when it's answered. You can delete your own questions.
- **Be respectful:** a guidelines line above the box ("Keep it about the car. Be respectful: no personal attacks, and no phone numbers or emails"). A small blocklist stops posts with insults or slurs, and patterns stop phone numbers and email addresses, with a message explaining why. 500 characters max.

**Why:** Bring a Trailer's comments are its main trust tool: buyers' questions surface problems before the sale.

- **Pros:** a public Q&A trail; seller replies use real car data, so they're consistent.
- **Cons:** one real user, so it's a simulation of a community; a word list is easy to get around and can block innocent words, so it's kept short and conservative.
- **Alternatives:** your posts only; seeded with no replies; an agree-to-guidelines checkbox.

**As built:**
- Seven topics, each with keywords, a seeded question (only when it fits the car: "Why is it a salvage title?" only on branded titles, "How bad is the water damage?" only when there's a water note) and an answer written from the data: rust and brake notes are quoted, the check-engine answer lists the same codes as Engine & diagnostics, a branded title names its cause.
- Seeded authors are "Buyer in <city>", picked from the dataset's 30-odd cities. Seeded questions are dated before the demo started and never stored; about 80% have answers.
- The seller's answer to your question is written when you ask and shown 10-30 s later, like claims. A reload mid-wait keeps the question.
- The filter blocks a short list of insults and profanity, email addresses and phone numbers (a year or a price isn't mistaken for a phone number). I didn't put slurs in the repo; a real site would use a moderation service rather than a word list.
- The placeholder suggests questions the data can answer ("Any rust underneath? Do you have the service records?"). Key count isn't in the data, so a keys question gets the holding answer.

### P41. Build order for batch 2 (Decided, owner asked for the plan first)

1. Soft close + rival snipes + all-in price (P38, P39). Changes the bidding domain, so it goes first.
2. Grade explainer + Engine & diagnostics (P33, P34).
3. Deal rating + price trend (P36, P37).
4. Guarantee + claims (P35).
5. Questions & answers (P40).

Each step: domain logic in `web/src/domain/` with unit tests, then UI, then a headless-browser check on desktop and phone in light and dark, then this log and the README. New saved fields (extensions, claims, questions, delivery province) bump `STATE_VERSION` to 2, which resets old saved demos.

### P42. Notification bell (Decided by me, open to change; owner request in round 20)

**What:** a bell next to Reset demo with an unread count. It keeps a history of three things: you were outbid, a watched lot has 5 minutes left, a seller answered your question. Clicking one opens the car (straight to its questions for an answer) and marks it read; "Mark all as read" clears the badge. The toasts stay as the live alert, and an "Ending in 5 minutes" toast is new.

**Details I chose:**
- Saved with the demo (so it survives a reload), newest first, the latest 50.
- "Ending in 5 minutes" fires once per watched lot, even if a late bid extends the auction (P38); otherwise every extension inside the window could repeat it. Watching a lot that already has less than 5 minutes left notifies right away.
- Claim decisions (P35) aren't in the bell, since the request named three kinds. Easy to add.
- Notifications are made in the domain from the same events as the toasts, so the two can't disagree.

- **Pros:** you don't miss an outbid or an ending while on another page or away from the tab; one place to catch up.
- **Cons:** only works while the app is open (no email or push); a buyer watching many lots could get a burst of "ending" notifications.
- **Alternatives:** mark everything read when the panel opens (simpler, but loses track of what you haven't looked at); a separate notifications page.

### P43. Phone layout: bid bar, no sideways overflow, no input zoom (Owner chose the bid bar in round 20)

**What:**
- **Bid bar:** on phones and tablets (below the desktop layout), a bar pinned to the bottom of the car page with the price, bid count, time left, your status (Winning or Outbid) and a button that scrolls to the bid box ("Bid", "Raise max" when you lead, "View" before the auction opens). It slides away while the bid box is on screen and isn't shown on ended auctions. The page has bottom padding so the bar never covers the end of it.
- **Fits from 280px:** the inventory toolbar wraps the vehicle count onto its own line when Filters and Sort don't fit beside it; the status tabs use smaller text under 360px; popovers are capped at the screen width minus a margin.
- **No zoom on iPhone:** on touch screens every form field uses 16px text; iOS zooms the page when you tap a field with smaller text.
- **Bigger tap targets on touch screens only:** status tabs, filter rows, Reset demo, the key facts chips, the back link and a few text links get more height; desktop is unchanged.

**Why:** the owner reported the site wasn't mobile-optimized: too much scrolling on the car page, and things overflowing sideways. Earlier checks ran at 390px only and didn't emulate touch, so they missed narrower phones and the iOS zoom.

- **Pros:** price and Bid always in reach on a phone, like eBay's app; no sideways scrolling on any page down to 280px.
- **Cons:** the bar covers part of the screen while reading; touch-only sizing means desktop and phone spacing differ slightly.
- **Alternatives:** moving the bid box above the photos on phones (you'd scroll past it while reading the condition report); both.

---

## Open questions

- _None right now._ The four batch 2 defaults (fee table, "Block Guarantee" and its $500 minimum, the 40% snipe chance, the 90% / 110% deal thresholds) were approved in round 15.

---

## Interview log

Questions asked of the product owner (the customer) and their answers, in order.

### Round 1 (2026-11-11): auction and bidding model

| Question | Answer |
|---|---|
| No end times in data. How does timing work? | Shift start times relative to now, fixed duration, countdown (→ P1) |
| Bid mechanics? | eBay proxy bidding (→ P2) |
| Simulated competing bidders? | Yes, occasional rival bids (→ P3) |
| Reserve visibility? | Status only, never the amount (→ P4) |

### Round 2 (2026-11-11): browsing, Buy Now, persistence

| Question | Answer |
|---|---|
| Results layout? | AutoTempest-style list rows (→ P5) |
| Which filters in v1? | Make/model/year/price; odometer/body/drivetrain/fuel; auction state. Not condition/title/province (→ P6, P7) |
| Buy Now behaviour? | eBay rule: disappears once bidding reaches the reserve (→ P8) |
| Persist across reloads? | Yes, localStorage with a reset (→ P9, P10) |

### Round 3 (2026-11-11): auction rules, detail page, buyer views

| Question | Answer |
|---|---|
| Auction duration? | Short, minutes to hours (→ P11) |
| Bid increments? | Tiered table (→ P12) |
| What leads on the detail page? | Condition first (→ P13) |
| Extra buyer views in v1? | My bids page, watchlist page, outbid toast. Not bid history (→ P14-P17) |

### Round 4 (2026-11-11): schedule, ended lots, sort, rivals

| Question | Answer |
|---|---|
| How to fit the 7-day start spread with short auctions? | Changed P11: auctions last days, eBay style. Some lots staged to start or end during the demo (→ P11) |
| Ended lots? | Show outcome, hidden by default (→ P18) |
| Default sort? | Ending soonest (→ P19) |
| Rival aggressiveness? | Moderate, reacts to the buyer (→ P20) |

### Round 5 (2026-11-11): owner changes to bidding

| Change | Result |
|---|---|
| Increments are $100 no matter the price | Changed P12 from tiered to flat $100 |
| Add a "Your max bid" field to type a max | Updated P2: quick bid + max bid field |
| Rival bids a couple of times to beat my max then stops, or beats me by setting a higher max | Updated P20 |

### Round 6 (2026-11-11): tooling and visual direction

| Question | Answer |
|---|---|
| Router? | React Router v7 (→ T5) |
| Styling? | Tailwind + shadcn/ui (→ T6) |
| Visual direction? | Clean professional marketplace (→ P21) |
| Light/dark? | Both, following the system (→ P22) |

### Round 7 (2026-11-11): max bid input, accent and type

| Question | Answer |
|---|---|
| Max bid not on a $100 step? | Any value is fine as long as it's above the current bid (→ P23) |
| Accent colour and typeface? | Deep blue and Inter, as suggested (→ P21) |

### Round 8 (2026-11-11): listing cards

| Change | Result |
|---|---|
| Listings should be smaller cards, like the reference screenshot | Changed P5 from list rows to a compact card grid |

### Round 9 (2026-11-11): data layer

| Topic | Result |
|---|---|
| React Router v8 and Inter | Both fine (→ T5, P21) |
| Build the data layer | Built and tested (→ T8-T10). Added P24 (reserve jump) and P25 (simulation details) for the owner to confirm |

### Round 10 (2026-11-11): inventory grid

| Topic | Result |
|---|---|
| P24 and P25 | Approved |
| Build the store and inventory | Built (→ T11, T12, P26, P27). Checked in a headless browser at 1440px and 390px, light and dark, with no console errors |

### Round 11 (2026-11-11): vehicle detail and bid box

| Topic | Result |
|---|---|
| Build the detail page with the bid box | Built (→ P28-P30). Walked through in a headless browser: quick bid, max bid with the reserve jump, a too-low max, a rival trying and giving up, and Buy Now. No console errors. Found and fixed the unsaved-schedule bug (T11) |

### Round 12 (2026-11-11): filters

| Topic | Result |
|---|---|
| Build the filter panel | Built as a drawer with chips (→ P31). Browser-tested on desktop and mobile: filters, model-within-make, chip removal, Back, reload. Found and fixed input lag (→ T13) |

### Round 13 (2026-11-11): My bids and Watchlist

| Topic | Result |
|---|---|
| Build My bids and Watchlist | Built (→ P32), plus an outbid badge in the nav. Browser-tested with real bids, Buy Now and watched lots. Found and fixed lost outbid toasts after a reload (→ T11) |

### Round 14 (2026-11-12): batch 2 from the market analysis

| Question | Answer |
|---|---|
| How to explain the NAAA grade? | Tooltip + a "How grading works" panel (→ P33) |
| Fault codes and engine sound aren't in the data. How to generate them? | Derived from the car's grade, report and damage notes, labelled as demo data (→ P34) |
| What should the engine sound analysis show? | Verdict + a waveform with flagged moments (→ P34) |
| Claim window? | 7 days from the sale (→ P35) |
| What happens after a claim? | Form + simulated review that approves or denies (→ P35) |
| Which cars are covered? | Clean title only; rebuilt and salvage are as-is (→ P35) |
| How is the deal rating calculated? | Simulated market value from public fields (→ P36) |
| Price history? | 12-month trend per make and model (→ P37) |
| Comments with one user? | Seeded Q&A, the seller answers your questions (→ P40) |
| Respectful posting? | Guidelines line + word and contact-detail filter (→ P40) |
| Soft close numbers? | Any bid in the last 2 minutes resets the clock to 2 minutes, no cap (→ P38) |
| Which costs in the all-in price? | Buyer fee + transport. No taxes (→ P39) |
| Where does the deal icon show? | Cards and the detail page (→ P36) |
| Where to pick the delivery province? | In the bid box, remembered (→ P39) |
| Should rivals snipe? | Sometimes (→ P38) |
| Build order? | Plan in this log first, for review (→ P41) |

### Round 15 (2026-11-12): batch 2, step 1

| Topic | Result |
|---|---|
| Approve the plan and its four defaults | Approved |
| Build the soft close, rival snipes and the all-in price | Built (→ P38, P39). 20 new unit tests (101 total). Browser-checked on desktop (light) and phone (dark): a bid with 58 s left reset the clock to 2 minutes; changing the delivery province updated the total and was saved; a rival snipe 46 s before the end out-bid the buyer, extended the auction and showed the outbid toast. Transport rate lowered to $0.60/km. Also fixed an old bug: the countdown in the bid box turned white on grey in the last hour |

### Round 16 (2026-11-12): batch 2, step 2

| Topic | Result |
|---|---|
| Build the grade explainer and Engine & diagnostics | Built (→ P33, P34). 18 new unit tests (119 total), including checks across all 200 cars (a 4.5+ car only has codes from its damage notes; every "Needs attention" verdict has a serious finding). Browser-checked on desktop (light) and phone (dark): card tooltip, strip popover, scale dialog, and the section for a rough car, a clean car, a flood car and an EV. No console errors |

### Round 17 (2026-11-12): batch 2, step 3

| Topic | Result |
|---|---|
| Build the deal rating and price trend | Built (→ P36, P37). 14 new unit tests (133 total), including "never looks at the reserve". Changed the tuning from the planned 30 / 45 / 25 mix at load (see P36). Browser-checked on desktop (light) and phone (dark): grid icons and tooltip, bid box line, chart hover and keyboard, and the rating moving from Low to Fair after a bid. Fixed the label being read twice where it's also visible. No console errors |

### Round 18 (2026-11-12): batch 2, step 4

| Topic | Result |
|---|---|
| Build the Block Guarantee and claims | Built (→ P35). 14 new unit tests (147 total). Browser-checked: bought a clean-title car with Buy Now, an empty description was refused, a mechanical claim was denied quoting the disclosed notes, an odometer claim was approved, both toasts appeared, and the My bids note went from "under review" to "approved". A salvage car shows "Sold as-is". Desktop (light) and phone (dark), no console errors. Improved denials to quote every matching note, not just the first |

### Round 19 (2026-11-12): batch 2, step 5

| Topic | Result |
|---|---|
| Build questions and answers | Built (→ P40). 20 new unit tests (167 total). Browser-checked on desktop (light) and phone (dark): seeded Q&A, a rude post, a phone number and an empty post refused with the right message, a question that survived a reload, the seller's answer and its toast, and deleting it. No console errors. Batch 2 is complete |

### Round 20 (2026-11-12): submission and a bug report

| Topic | Result |
|---|---|
| Fill out SUBMISSION.md | A short version for the OPENLANE reviewers in the template's sections, linking to the README and this log. Time spent: about 4 hours (also added to the README) |
| Move the Filters button next to sort | Done (owner request, → P31). The toolbar now reads search · status tabs · count, Filters, Sort, with Filters and Sort together on the right. On phones the count no longer wraps and the sort menu is a little narrower, so the row fits at 390px even with "180 vehicles" and a filter badge |
| Add a notification bell for watchlist endings, seller replies and outbids | Built (→ P42). 6 new unit tests (173 total). Browser-checked: all three kinds fired with their toasts, the bell showed 3 unread, opening one went to the car and marked it read, "Mark all as read" cleared the badge, and the history survived a reload. Header fits at 390px |
| Show pop-ups (toasts) at the top right, under the navbar | Done (owner request). They used to sit at the bottom right. The offset comes from a `--header-height` CSS variable that changes at the same breakpoint as the header (two rows on phones, one from 640px up), so a toast never covers the nav, including at widths between Sonner's phone layout (under 600px) and ours. Checked at 390, 620, 660 and 1440px |
| Close questions once an auction has ended | Done (owner request, → P40). Ended lots, including Buy Now sales, show the existing Q&A "for reference" and a "Questions are closed" line instead of the form. Enforced in the auction logic too, not just hidden. Upcoming lots stay open, since buyers ask before bidding starts, and a question asked just before the end still gets its answer; the owner approved both. 3 new tests (176 total) |
| Make SUBMISSION.md the README | Done. README.md now holds the submission text (the template's sections), plus "How I Used AI" and "Project Layout" carried over from the longer README. SUBMISSION.md was then removed from the repo at the owner's request (the brief's link to it is now plain text). The longer README's extra detail lives in this log |
| "The webpage isn't mobile optimized": too much scrolling on the car page, things overflowing sideways | Fixed (→ P43). Reproduced the overflow at 320px (inventory toolbar 27–37px too wide) and two popovers wider than small screens; found form fields that make iPhones zoom and tap targets under 32px. Added the phone bid bar (owner's choice). Re-checked every page at 280, 320, 360, 375 and 414px with touch emulation, plus 375 and 500px in desktop mode, with popovers open: nothing overflows |
| Bug: "See them" in the grade popover didn't scroll to the damage notes | Fixed. Closing the popover handed focus back to the Grade button, which scrolled the page back up. "See them" now skips that, scrolls to the Damage notes heading and moves focus there. Also found that every in-page link (fault codes, deal line) landed under the sticky header; added a page-wide scroll offset. Browser-checked on desktop and phone |

### Owner requests about the log

- 2026-11-11: add why each decision was recommended, with pros and cons for each. Done: product and technical decisions now use per-decision sections.
