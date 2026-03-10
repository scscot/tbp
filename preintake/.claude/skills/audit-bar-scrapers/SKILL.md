---
name: audit-bar-scrapers
description: Check status of PreIntake.ai bar association attorney scrapers. Use when verifying scraper health, reviewing contact yields, or troubleshooting failures.
argument-hint: "[--status | --yields | --errors]"
---

# Bar Scraper Audit Skill

Monitor and audit the PreIntake.ai attorney scraper pipeline across multiple state bar associations.

## Active Scrapers (5)

| State | Workflow | Schedule | Script |
|-------|----------|----------|--------|
| California | `calbar-scraper.yml` | Daily 2am PT | `scrape-calbar-attorneys.js` |
| Florida | `flbar-scraper.yml` | Daily 2am PT | `scrape-flbar-attorneys.js` |
| North Carolina | `ncbar-scraper.yml` | Daily (offset) | `scrape-ncbar-attorneys.js` |
| Ohio | `ohbar-scraper.yml` | Daily 4am PT | `scrape-ohiobar-attorneys.js` |
| Washington | `wsba-scraper.yml` | Daily 8pm PT | `scrape-wsba-attorneys.js` |

## Disabled Scrapers (Complete)

| State | Reason |
|-------|--------|
| Georgia | Fully complete |
| Illinois | Fully complete |
| Indiana | Fully complete |
| Kentucky | Fully complete |
| Michigan | Fully complete |
| Mississippi | Fully complete (283 attorneys) |
| Missouri | Fully complete |
| Nebraska (nebar) | Fully complete |
| Nebraska (nsba) | Fully complete |
| Oklahoma | Fully complete |

## Quick Status Check

### 1. Workflow Run Status
```bash
# Check recent runs for all active scrapers
gh run list --workflow=calbar-scraper.yml --limit=3
gh run list --workflow=flbar-scraper.yml --limit=3
gh run list --workflow=ncbar-scraper.yml --limit=3
gh run list --workflow=ohbar-scraper.yml --limit=3
gh run list --workflow=wsba-scraper.yml --limit=3
```

### 2. Contact Yields by Source
```bash
cd /Users/sscott/tbp/functions && node -e "
const { db } = require('./shared/utilities');
async function yields() {
  const snap = await db.collection('preintake_emails').get();
  const sources = {};
  snap.docs.forEach(d => {
    const src = d.data().source || 'unknown';
    sources[src] = (sources[src] || 0) + 1;
  });
  console.log('Contacts by Source:');
  Object.entries(sources).sort((a,b) => b[1]-a[1]).forEach(([s,c]) => {
    console.log('  ' + s + ': ' + c);
  });
  console.log('Total:', snap.size);
}
yields();
"
```

### 3. Check Failed Workflow Runs
```bash
# View details of failed runs
gh run list --status=failure --limit=10 | grep -E "(bar|scraper)"
```

## Scraper Technical Details

### Platform Types

| Platform | States | Characteristics |
|----------|--------|-----------------|
| ReliaGuide | MI, IL, IN, MS, NE | vCard API, category IDs, may need xvfb-run |
| ASP.NET WebForms | MO, OK, WA | ViewState pagination, GUID practice areas |
| Puppeteer/JS | CA, FL, GA, OH, KY, NC | Email obfuscation, React SPAs |
| YourMembership | NSBA | Caesar cipher emails, iframe search |

### Common Issues

1. **Rate Limiting**: ReliaGuide scrapers need category validation with safety valve
2. **Headless Detection**: MS Bar requires `xvfb-run` for non-headless mode
3. **Email Obfuscation**: CA/FL use CSS-based obfuscation techniques
4. **Large Result Sets**: OH/KY use city/county subdivision to avoid caps

### Government Contact Filtering

All scrapers skip government contacts using `gov-filter-utils.js`:
- Domain patterns: `.gov`, `.us`, `.state.`
- Organization patterns: "Attorney General", "Public Defender", etc.
- Audit script: `scripts/audit-gov-contacts.js`

## Monitoring Checklist

- [ ] All 5 active scrapers running without errors
- [ ] New contacts being added to `preintake_emails`
- [ ] No government contacts slipping through
- [ ] Duplicate detection working (email deduplication)
- [ ] Practice areas being captured correctly

## Related Files

- Scraper scripts: `scripts/scrape-*bar-attorneys.js`
- Gov filter: `scripts/gov-filter-utils.js`
- Workflows: `.github/workflows/*bar-scraper.yml`
- Progress tracking: Firestore `scraper_progress/{source}` documents
