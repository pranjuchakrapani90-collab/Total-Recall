# Zerodha Kite link for Investments — one-time setup

ETF Shop reads your real Kite figures through the free **Kite Connect Personal** plan: cash, holdings,
today's orders (to answer "Did your AMO fill?") and GTTs. It is **read-only**: nothing is ever placed
in Kite from Pranju OS. The Personal plan has no prices, so live prices still come from Yahoo.

Kite ends every API login at **6 AM IST**, so the card asks you to **Log in to Kite for today** once a day.
The login token stays on the Worker, never on a phone.

## 1. Kite developer app (5 minutes, once)

1. Open <https://developers.kite.trade>, sign up / log in with your Zerodha ID.
2. **Create new app** → type **Personal** (free).
3. App name *Pranju OS*. **Redirect URL** exactly:
   `https://total-recall-ticktick.pranjuchakrapani90.workers.dev/kite-callback`
   (Postback URL: leave empty.)
4. Save, then copy the **API key** and **API secret**.

## 2. Cloudflare Worker

1. Cloudflare dashboard → Workers → **total-recall-ticktick** → **Edit code** → paste the latest
   `ticktick-worker.js` from this repo → **Deploy**.
2. Settings → **Variables and Secrets** → Add, type **Secret**, for both:
   - `KITE_API_KEY` = the API key
   - `KITE_API_SECRET` = the API secret

## 3. Use it

Pranju OS → Money Trace → Investments → **ETF Shop** or **JuniorBees PKP** → Kite card (one login serves both) → **Log in to Kite for today** →
Kite's own login page (ID, password, TOTP) → you land back in ETF Shop with the figures.

- **Did your AMO fill?** shows Kite's answer: filled (with Kite's average price and quantity, used when you
  tap *Record it*), rejected/cancelled (tap *Clear it*), or still open.
- **JuniorBees PKP:** the SIP AMO question shows Kite's answer the same way; a BID or sell GTT question shows
  whether Kite says that GTT triggered or is still active.
- **Holdings** compares the units in Kite with ETF Shop lots + JuniorBees PKP + LiquidBees.
- **Use Kite's figures** sets the app's Kite fund to Kite's cash (live balance) and LiquidBees units.
