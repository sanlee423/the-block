# The Block

The buyer side of a used-vehicle auction: browse 200 lots, open a car, and bid against simulated rivals with eBay-style proxy bidding. It's a React + TypeScript app with no backend; all auction state lives in the browser.

[docs/DECISIONS.md](docs/DECISIONS.md) logs every product and technical decision with the reasoning, pros, cons and the options I turned down. The original challenge brief is in [docs/CHALLENGE.md](docs/CHALLENGE.md).

## How to Run

You need Node.js 20.19+ or 22.12+.

```sh
cd web
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). `npm test` runs the unit tests and `npm run build` type-checks and builds. The Reset demo button in the header clears your bids, watchlist and notifications and restarts every auction from the current time.

## Time Spent

About 4 hours.

I spent the first part on the minimum bar: inventory with search and filters, the detail page, and bidding that visibly updates, working on a phone and a laptop. Only once that was solid did I add extras, and I picked those by looking at how OPENLANE, ACV, Manheim, Bring a Trailer, Cars & Bids and AutoTrader.ca make buying clearer and more trustworthy. Before each part I wrote down the open questions and answered them as the customer would, so scope was settled before code. Every step ended with tests and a check in a real browser.

## Assumptions and Scope

- One buyer, no accounts. Other bidders are simulated: one bids somewhere every 20 to 60 seconds, and when you take the lead a rival pushes back. About one time in three it beats your max.
- The dataset's dates are synthetic, so the app builds its own schedule relative to now. Auctions run 3, 5 or 7 days, and the demo always has lots that have ended, lots ending within the hour and lots about to start.
- The reserve shows as a status (met, not met, none), never the amount. The amount still ships in the JavaScript bundle. A real system would keep it on the server.
- Prices are in Canadian dollars, since every car is in a Canadian province.
- The dataset has no fault codes, engine recordings, market values or buyer questions, so the app generates them from each car's grade, condition report, damage notes and title, and labels them as demo data on the page.
- I didn't build sign-in, payments and checkout, seller tools, bid history, a backend, or real photos.

## Stack

- **Frontend:** React 19, TypeScript, Vite, React Router, Tailwind CSS 4, shadcn/ui (Radix)
- **Backend:** none
- **Database:** none; state is saved to `localStorage`

## What I Built

The inventory is a grid of compact cards with the condition grade, a live countdown and an arrow showing whether the price is low, fair or high for that car. Search, a filter drawer and sorting are all kept in the URL, so a search can be shared and survives a reload.

A car's page puts condition first: grade, title status and damage notes come before the specs, and rebuilt or salvage titles are explained in plain words. Tapping the grade explains what that band of the 0–5 scale means. Below that are fault codes in plain English, an engine sound analysis, a price check with a 12-month trend for the model, and a questions section where the seller answers from the car's own data.

To bid, you tap for the next $100 or set a max and let the system bid for you. Every bid has a confirm step that shows the all-in cost: the price, a buyer fee and transport to your province. A bid in the last 2 minutes resets the clock to 2 minutes. On a phone, a bar pinned to the bottom of the screen keeps the price, time left and a Bid button in reach while you read the condition report. My bids groups everything as outbid, winning, won and didn't win. A notification bell, with toasts, tells you when you're outbid, when a watched car has 5 minutes left and when a seller answers you. Clean-title cars come with a guarantee: after winning, you have 7 days to claim for a problem the listing didn't disclose.

## Notable Decisions

These are the decisions that shaped the app most. The [decision log](docs/DECISIONS.md) has the rest, including the ones I changed my mind on.

### Proxy bidding the way eBay does it

You enter the most you'll pay and the system raises your bid only as far as needed. I added one rule after building it: if the leader's max covers the reserve, the price jumps to the reserve. Without it, a buyer willing to pay $30,000 could fail to buy a car with a $25,000 reserve while the price sat at $10,000. The cost is a price that can jump by more than $100 at once, so the app says why when it happens.

### Condition first, and a confirm step on every bid

Dealers buy cars they can't inspect, so damage and title come before specs. The confirm step costs a tap in a bidding war, but bids are binding and a mis-tap on a phone is easy. It's also where the app explains proxy bidding and shows the all-in price, when the buyer needs it.

### Generated data has to agree with the real data

Random fault codes would have been quicker, but a car graded 4.9 could then show a misfire, or a seller could say "no rust" on a car whose notes list rust. So codes come from the damage notes, the number of extra codes follows the grade, and the seller's answers quote the listing. The market value is worked out from the public starting bid, never the reserve, so the deal rating can't give the reserve away.

### Ratings that move

Starting bids sit well below market, so most lots open as a "Low price" and turn Fair or High as bidding nears the reserve. I'd planned an even mix at load, but tuning for that made about 80% of cars read "High" at their reserve, which would say most sellers ask too much. I chose the version that behaves like a real auction.

### A 2-minute auction extension

Simulated rivals react within seconds, so a last-second bid would otherwise decide most auctions. Any bid in the last 2 minutes resets the clock to 2 minutes, and rivals sometimes bid late so the extension shows up in a demo.

### Plain TypeScript rules, kept apart from React

Every auction rule is a pure function that takes the state, the time and a random source and returns a new state. That made the rules easy to test. Rival bids are saved in the state as "bid at time X" records, so they survive navigation and reloads.

## Testing

`npm test` runs 176 Vitest tests covering proxy bidding (wins, losses, ties, raising your own max), the reserve jump, Buy Now, the extension and rival snipes, fees, the schedule, rival behaviour, diagnostics, market values, claim decisions, the posting filter, notifications, and inventory search, filters and sort. Some run across all 200 cars, for example to check that no car graded 4.5 or above gets a fault code its notes don't explain.

I also drove the running app in headless Chromium after each step, on a 390px phone in dark mode and a laptop in light mode. That found bugs the unit tests couldn't: a schedule that wasn't saved until the first change, filter inputs that lagged a frame behind the URL, outbid toasts lost after a reload, and a countdown that went white on grey in its last hour. Checking at 390px wasn't enough, though. A later pass with touch emulation from 280px to 414px found the inventory toolbar running off screens narrower than 360px, form fields small enough to make iPhones zoom in, and tap targets under 32px. All three are fixed, and every page now fits from 280px up. Those browser scripts aren't in the repo yet.

## How I Used AI

I built this with Claude Code. I played the customer: it interviewed me about the product in rounds (auction timing, bid model, rivals, reserve, layout, filters, Buy Now), I made the calls, and it recorded each one in the decision log with pros and cons. Some answers changed along the way. I moved from short auctions to multi-day ones, from tiered increments to a flat $100, and from list rows to cards; the log keeps both versions. Where it made smaller calls on its own (the reserve jump, the confirm step, filter details), they're marked in the log and I reviewed them. It wrote most of the code and tests, and checked its work in a real browser after each step. For the second batch I had it research how other car platforms earn buyers' trust, chose the ideas I wanted (grade explanations, diagnostics, a guarantee, deal ratings, Q&A, the auction extension, all-in pricing), and went through another interview round before any code was written.

## What I'd Do With More Time

- Move bids, the clock and the reserve to a server and push price changes to every open page. Rivals would then be real people, and the reserve wouldn't reach the browser.
- Commit the browser checks as end-to-end tests that run in CI, and do an accessibility pass with a real screen reader.
- Add bid history on the car's page.
- Make filter counts reflect the other filters you've picked, and add filters for grade, title status and province.
- Send outbid and ending-soon alerts by email or push notifications.

## Project Layout

```
data/vehicles.json        the dataset (unchanged)
docs/CHALLENGE.md         the original challenge brief
docs/DECISIONS.md         decision log
web/
  src/domain/             auction rules: lots, proxy bidding, schedule, rivals, storage (pure TS + tests)
  src/state/              the store that runs the clock and saves state
  src/features/           inventory filters, bid box and detail sections, price check, guarantee, Q&A, My bids
  src/pages/              Inventory, Lot detail, My bids, Watchlist
  src/components/         shared UI: cards, grid, badges; ui/ holds the shadcn components
```
