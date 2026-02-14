const puppeteer = require('puppeteer');

async function checkTable() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  console.log('Loading page...');
  await page.goto('https://www.businessforhome.org/mlm-500-top-earners/', { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait for table
  await page.waitForSelector('table tbody tr', { timeout: 30000 });

  // Get the HTML around the table to find pagination
  const tableAreaInfo = await page.evaluate(() => {
    const table = document.querySelector('table');
    const parent = table.parentElement;
    const grandparent = parent.parentElement;

    // Get all siblings of table
    const siblings = Array.from(parent.children).map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id,
      textSnippet: el.textContent.substring(0, 100).replace(/\s+/g, ' ')
    }));

    // Look for elements with "Previous" or "Next" text
    const prevNextElements = [];
    document.querySelectorAll('a, button, span, div').forEach(el => {
      const text = el.textContent.trim();
      if (text === 'Previous' || text === 'Next' || text === '«' || text === '»') {
        prevNextElements.push({
          tag: el.tagName,
          className: el.className,
          id: el.id,
          text: text,
          parentClass: el.parentElement?.className,
          outerHTML: el.outerHTML.substring(0, 200)
        });
      }
    });

    // Check what's inside the table wrapper
    const tableWrapper = table.closest('div');
    const wrapperChildren = tableWrapper ? Array.from(tableWrapper.children).map(el => ({
      tag: el.tagName,
      className: el.className,
      id: el.id
    })) : [];

    return {
      parentTag: parent.tagName,
      parentClass: parent.className,
      parentId: parent.id,
      grandparentClass: grandparent?.className,
      siblings,
      prevNextElements,
      wrapperChildren
    };
  });

  console.log('\nTable parent:', tableAreaInfo.parentTag, tableAreaInfo.parentClass, tableAreaInfo.parentId);
  console.log('Grandparent class:', tableAreaInfo.grandparentClass);
  console.log('\nSiblings of table parent:');
  tableAreaInfo.siblings.forEach(s => console.log('  -', s.tag, s.className, s.textSnippet.substring(0, 50)));

  console.log('\nPrevious/Next elements found:', tableAreaInfo.prevNextElements.length);
  tableAreaInfo.prevNextElements.forEach(el => {
    console.log('  -', el.tag, el.className, 'text:', el.text);
    console.log('    HTML:', el.outerHTML);
  });

  console.log('\nWrapper children:', tableAreaInfo.wrapperChildren);

  // Take screenshot of just the bottom of the page where pagination would be
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.screenshot({ path: '/tmp/mlm500-bottom.png' });
  console.log('\nBottom screenshot saved to /tmp/mlm500-bottom.png');

  await browser.close();
}

checkTable().catch(console.error);
