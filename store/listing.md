# Chrome Web Store listing

Everything the Developer Dashboard asks for, ready to paste.

Package: `npm run pack` → `dist/search-console-percentage-<version>.zip` (only the files the extension loads).

## Store listing

**Name:** Search Console Percentage Calculator by Natzir

**Summary** (132 characters max). The dashboard takes it from the package (the manifest's `description`), so it must stay exactly this:

> See how much every number changed when you compare dates in Search Console's Performance reports: totals, chart, table and CSV.

**Category:** Developer Tools

**Language:** English

**Description:**

```
Search Console Percentage Calculator shows how much every number changed when you compare two periods in Search Console's Performance reports.

Turn on a comparison in the date filter and it works by itself, in any language, on Search results and its Generative AI view, Discover and Google News.

• Totals: the difference and the % change under each card.
• By date: a strip of bars under Google's chart, one per point of the chart (a day, week or month), for the metric you pick. You can read it with the keyboard too. Up when the number went up, green when that is better and red when it is worse.
• Table: the % change next to every Difference, for clicks, impressions, CTR and position.
• Export with %: the whole table as CSV, with a % change column after each Difference. In languages that write decimals with a comma, the CSV uses semicolons and decimal commas, as Excel expects there.

Position is read the way SEOs read it: going down is better, so it shows green. CTR changes are shown in percentage points and in %.

It doesn't send data anywhere. Everything runs in your browser, inside Search Console.

Not affiliated with Google. Google and Google Search Console are trademarks of Google LLC.
```

**Images**

- Icon: `extension/icons/128.png`.
- Screenshots, 1280 × 800: the totals cards, the strip under the chart, the table with its % pills, and an exported CSV. Taken from real Search Console data with the extension on.
- Small promo tile, 440 × 280.

**Official URL:** natzir.com · **Homepage:** https://github.com/natzir/search-console-percentage · **Support:** https://github.com/natzir/search-console-percentage/issues

## Privacy practices

**Single purpose:**

> Show how much the numbers changed when comparing periods in Search Console's Performance reports.

**Permission justifications:**

- **storage:** Remembers the metric chosen for the strip under the chart, in this browser.
- **Host permission (search.google.com/search-console):** Search Console lives at search.google.com. The extension reads the Performance report (cards, table, chart) and adds the changes to it. It runs on no other site.

**Remote code:** No, I am not using remote code. Every script is in the package.

**Data usage:** the extension collects none of the listed kinds of user data. Tick the three certifications (not sold to third parties, not used or transferred for purposes unrelated to the single purpose, not used to determine creditworthiness or for lending).

**Privacy policy URL:** https://github.com/natzir/search-console-percentage/blob/main/PRIVACY.md
