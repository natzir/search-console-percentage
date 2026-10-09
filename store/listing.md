# Chrome Web Store listing

Everything the Developer Dashboard asks for, ready to paste.

Package: `npm run pack` → `dist/search-console-percentage-<version>.zip` (only the files the extension loads).

## Store listing

**Name:** Search Console Percentage Calculator by Natzir

**Summary** (132 characters max):

> See how much every number changed when you compare dates in Search Console, in the totals, by day and per row.

**Category:** Developer Tools

**Language:** English

**Description:**

```
Search Console Percentage Calculator shows how much every number changed when you compare two periods in Search Console's Performance reports.

Turn on a comparison in the date filter and it works by itself, in any language, on Search results, Discover, Google News and their Generative AI views.

• Totals: the difference and the % change under each card.
• Day by day: a strip of bars under Google's chart, one per day, for the metric you pick. You can read it with the keyboard too. Up when the number went up, green when that is better and red when it is worse.
• Table: the % change next to every Difference, for clicks, impressions, CTR and position.
• Export with %: the whole table as CSV, with a % column after each Difference.

Position is read the way SEOs read it: going down is better, so it shows green. CTR changes are shown in percentage points and in %.

It doesn't send data anywhere. Everything runs in your browser, inside Search Console.

Not affiliated with Google. Google and Google Search Console are trademarks of Google LLC.
```

**Images**

- Icon: `extension/icons/128.png`.
- Screenshots, 1280 × 800: the totals cards, the daily strip, the table with its % pills, and an exported CSV. Taken from real Search Console data with the extension on.
- Small promo tile, 440 × 280.

**Official URL:** natzir.com · **Homepage:** https://github.com/natzir/search-console-percentage · **Support:** https://github.com/natzir/search-console-percentage/issues

## Privacy practices

**Single purpose:**

> Show how much the numbers changed when comparing periods in Search Console's Performance reports.

**Permission justifications:**

- **storage:** Remembers the metric chosen for the daily strip, in this browser.
- **Host permission (https://search.google.com/\*):** Search Console lives at search.google.com. The extension reads the Performance report (cards, table, chart) and adds the changes to it. It runs on no other site.

**Remote code:** No, I am not using remote code. Every script is in the package.

**Data usage:** the extension collects none of the listed kinds of user data. Tick the three certifications (not sold to third parties, not used or transferred for purposes unrelated to the single purpose, not used to determine creditworthiness or for lending).

**Privacy policy URL:** https://github.com/natzir/search-console-percentage/blob/main/PRIVACY.md
