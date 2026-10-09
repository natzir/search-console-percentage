# Search Console Percentage Calculator

A Chrome extension for Search Console's Performance reports. When you compare two periods, it shows
how much every number changed: in the totals cards, day by day in a strip under the chart, next to
each Difference in the table, and in a CSV export.

## Install

From the Chrome Web Store: [Search Console Percentage Calculator by Natzir](https://chromewebstore.google.com/detail/search-console-percentage/licaefgklohoebcfefffhinemkidgejm).

## Use

1. Open a Performance report: Search results, Discover, Google News, or their Generative AI views.
2. In the date filter choose *Compare*, a pair of periods, and *Apply*.
3. The changes appear by themselves. Green is better and red is worse; the arrow follows the number,
   so a position that goes down is ▼ and green. CTR changes are in percentage points and in %.
4. *Export with %* downloads the whole table as CSV with a % column after each Difference.
   The strip under the chart works with the keyboard too: Tab into it and use the arrow keys to read each day.
5. The extension's icon turns it off in that tab, and on again.

It works in any Search Console language.

## How it reads the numbers

Only from what Search Console already shows: the table's own numbers, the totals cards, and for the
daily strip, the values Google's chart shows as the pointer moves over it. The strip covers the
metrics turned on in the chart. Values already read are kept for the current dates and filters, so
turning a metric off and on doesn't read the days again.

## Privacy

It doesn't send data anywhere. See [PRIVACY.md](PRIVACY.md).

Not affiliated with Google. Google and Google Search Console are trademarks of Google LLC.

## Develop

`npm install`, `npm test`, `npm run build` (→ `dist/extension/`, for *Load unpacked*), `npm run pack`
(the zip for the Chrome Web Store) and `npm run icons`.

## License

MIT, see [LICENSE](LICENSE).
