# Total Recall — dynamic TickTick responsibility cards

The Responsibility Recall section no longer contains hard-coded generic trigger points. It expects a private bridge that returns tomorrow's TickTick tasks grouped by responsibility.

## Architecture

`TickTick → Cloudflare Worker (private token) → Total Recall GitHub Pages`

The public `index.html` never contains a TickTick access token.

## Responsibility tags

Tasks are grouped by these TickTick tags:

- `SDE-TECH`
- `SDE-REV`
- `SDE-ESTT`
- `HOME-MANAGER`
- `BROTHER`
- `SON`

Use the same tags in TickTick. Tasks without one of these tags are ignored rather than guessed.

## Cloudflare Worker

1. Create a Cloudflare Worker.
2. Paste the contents of `ticktick-worker.js` into it.
3. Add a Worker secret named `TICKTICK_ACCESS_TOKEN` containing your TickTick OAuth access token.
4. Optionally add a Worker variable `TIME_ZONE` with `Asia/Kolkata`.
5. Deploy the Worker.
6. Copy its HTTPS Worker URL.

## Connect Total Recall

The current frontend reads the bridge URL from:

```js
window.TOTAL_RECALL_TICKTICK_URL
```

or from browser localStorage key `totalRecallTickTickUrl`.

For the clean permanent setup, set `window.TOTAL_RECALL_TICKTICK_URL` to the Worker URL in the site configuration before deployment. Do **not** put the TickTick token there.

## Response contract

The Worker returns JSON like:

```json
{
  "date": "YYYY-MM-DD",
  "timeZone": "Asia/Kolkata",
  "responsibilities": {
    "SDE-TECH": [{"id":"...","title":"...","due":"...","project":"...","tags":["SDE-TECH"]}],
    "SDE-REV": [],
    "SDE-ESTT": [],
    "HOME-MANAGER": [],
    "BROTHER": [],
    "SON": []
  }
}
```

Total Recall fetches this every time Responsibility Recall starts, so tomorrow's task cards change automatically.
