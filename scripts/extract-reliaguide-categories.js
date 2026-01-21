const puppeteer = require('puppeteer');

const sites = [
  { name: 'Michigan (SBM)', url: 'https://sbm.reliaguide.com/lawyer/search' },
  { name: 'Indiana', url: 'https://inbar.reliaguide.com/lawyer/search' },
  { name: 'Nebraska', url: 'https://nebar.reliaguide.com/lawyer/search' },
  { name: 'Mississippi', url: 'https://msbar.reliaguide.com/lawyer/search' }
];

async function extractCategories() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const site of sites) {
    console.log('\n' + '='.repeat(60));
    console.log(site.name + ': ' + site.url);
    console.log('='.repeat(60));

    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
      await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 3000));

      // Click on "More Filters" to expand filter options
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent);
        if (text.includes('More Filters')) {
          await btn.click();
          console.log('Clicked "More Filters"');
          await new Promise(r => setTimeout(r, 2000));
          break;
        }
      }

      // Try to find practice area / category dropdown or list
      const filterText = await page.evaluate(() => {
        // Look for any element that might contain category/practice area options
        const allText = [];

        // Find all elements with dropdown-related classes
        document.querySelectorAll('[class*="dropdown"], [class*="select"], [class*="filter"], [class*="menu"], [class*="list"]').forEach(el => {
          if (el.textContent.length > 10 && el.textContent.length < 5000) {
            allText.push(el.textContent.substring(0, 500));
          }
        });

        // Look for checkboxes or radio buttons
        document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
          const label = input.labels && input.labels[0] ? input.labels[0].textContent : '';
          const parentText = input.parentElement ? input.parentElement.textContent.substring(0, 100) : '';
          if (label || parentText) {
            allText.push('Input: ' + (label || parentText));
          }
        });

        return allText.slice(0, 20);
      });

      if (filterText.length > 0) {
        console.log('\nFilter elements found:');
        filterText.forEach((t, i) => console.log((i + 1) + '. ' + t.substring(0, 200)));
      }

      // Get the current URL to see what params are available
      const currentUrl = page.url();
      console.log('\nCurrent URL: ' + currentUrl);

      // Now try clicking on specific filter areas to reveal categories
      // Look for "Practice Area" or "Category" labels
      const practiceAreaSection = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          const text = el.textContent.toLowerCase();
          if ((text.includes('practice area') || text.includes('category')) && el.textContent.length < 200) {
            return {
              tag: el.tagName,
              text: el.textContent,
              className: el.className
            };
          }
        }
        return null;
      });

      if (practiceAreaSection) {
        console.log('\nFound practice area section:', practiceAreaSection);
      }

    } catch (err) {
      console.log('Error: ' + err.message);
    }
    await page.close();
  }

  await browser.close();
}

extractCategories().catch(console.error);
