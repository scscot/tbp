const puppeteer = require('puppeteer');

// Check total attorney counts on each site
const sites = [
  { name: 'Indiana', url: 'https://inbar.reliaguide.com/lawyer/search' },
  { name: 'Nebraska', url: 'https://nebar.reliaguide.com/lawyer/search' },
  { name: 'Mississippi', url: 'https://msbar.reliaguide.com/lawyer/search' }
];

async function checkSite(site) {
  console.log('\n' + '='.repeat(60));
  console.log(site.name + ': ' + site.url);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  try {
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));

    // Get total results count
    const totalResults = await page.evaluate(() => {
      // Look for "Showing X results" or similar
      const text = document.body.innerText;
      const match = text.match(/(\d[\d,]*)\s*results?/i);
      if (match) return match[1].replace(/,/g, '');

      // Alternative: look for pagination info
      const pageMatch = text.match(/of\s+(\d[\d,]*)/);
      if (pageMatch) return pageMatch[1].replace(/,/g, '');

      // Count visible items
      const items = document.querySelectorAll('a[href*="/lawyer/"]');
      return 'visible: ' + items.length;
    });

    console.log('Total results: ' + totalResults);

    // Check pagination structure
    const pagination = await page.evaluate(() => {
      const pageItems = document.querySelectorAll('.ant-pagination-item');
      const lastPage = pageItems.length > 0 ? pageItems[pageItems.length - 1].textContent : '?';

      return {
        pageItemCount: pageItems.length,
        lastPageNumber: lastPage,
        hasNext: !!document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)')
      };
    });

    console.log('Pagination: ' + pagination.pageItemCount + ' page buttons, last page: ' + pagination.lastPageNumber);
    console.log('Has next button: ' + pagination.hasNext);

    // Get practice areas visible on the page
    const practiceAreas = await page.evaluate(() => {
      const areas = new Set();
      // Look for practice areas in attorney cards
      document.querySelectorAll('[class*="card"], [class*="profile"], [class*="result"]').forEach(card => {
        const text = card.innerText;
        // Common practice areas
        const known = ['Personal Injury', 'Family Law', 'Criminal', 'Bankruptcy', 'Immigration',
          'Real Estate', 'Estate Planning', 'Business Law', 'Tax', 'Employment',
          'Workers Compensation', 'Civil Litigation', 'Medical Malpractice'];
        known.forEach(area => {
          if (text.includes(area)) areas.add(area);
        });
      });
      return Array.from(areas);
    });

    console.log('Practice areas found: ' + (practiceAreas.length > 0 ? practiceAreas.join(', ') : 'None visible'));

  } catch (err) {
    console.log('Error: ' + err.message);
  }

  await browser.close();
}

async function main() {
  for (const site of sites) {
    await checkSite(site);
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().catch(console.error);
