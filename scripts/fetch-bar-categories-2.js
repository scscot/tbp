#!/usr/bin/env node
/**
 * Second pass: Fetch categories from remaining bar associations
 * - ReliaGuide (IL, MI): Intercept network requests for category data
 * - Georgia Bar: Extract from page source
 * - Ohio Bar: Wait longer for React SPA
 */

const puppeteer = require('puppeteer');

async function fetchReliaGuideViaIntercept(name, baseUrl) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${name} (ReliaGuide: ${baseUrl})`);
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let categoryData = null;

    // Intercept network responses to capture category-lookups API call
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('category-lookups') && response.status() === 200) {
            try {
                const text = await response.text();
                categoryData = JSON.parse(text);
                console.log(`  [Intercepted] category-lookups response (${url})`);
            } catch (e) {
                // ignore parse errors
            }
        }
    });

    try {
        console.log(`  Loading search page...`);
        await page.goto(`${baseUrl}/lawyer/search`, { waitUntil: 'networkidle2', timeout: 60000 });
        // Wait for React app to load and make API calls
        await new Promise(r => setTimeout(r, 5000));

        if (categoryData) {
            const categories = Array.isArray(categoryData) ? categoryData : (categoryData.content || categoryData);
            console.log(`\nFound ${categories.length} categories:\n`);
            categories.forEach(cat => {
                console.log(`  ID: ${cat.id} | Name: ${cat.category || cat.name}`);
            });
            return categories;
        }

        // Fallback: try to extract from React state or DOM
        console.log(`  No intercepted API call. Trying DOM extraction...`);
        const domCategories = await page.evaluate(() => {
            // Look for category filter elements
            const elements = document.querySelectorAll('[class*="category"], [class*="filter"], [data-testid*="category"]');
            const results = [];
            elements.forEach(el => {
                const text = el.textContent.trim();
                if (text && text.length < 100) results.push(text);
            });

            // Also try to find React state
            const root = document.querySelector('#root, #app, [data-reactroot]');
            if (root && root._reactRootContainer) {
                return ['[React state found but cannot extract directly]'];
            }

            // Look for any dropdown/select with category options
            const selects = document.querySelectorAll('select');
            for (const s of selects) {
                if (s.options.length > 5) {
                    return Array.from(s.options).map(o => `${o.value}: ${o.text}`);
                }
            }

            // Try looking for category links or buttons
            const links = document.querySelectorAll('a[href*="category"], button[data-category]');
            return Array.from(links).map(l => l.textContent.trim());
        });

        if (domCategories.length > 0) {
            console.log(`  Found ${domCategories.length} DOM elements:`);
            domCategories.forEach(c => console.log(`    ${c}`));
        } else {
            console.log(`  No categories found in DOM.`);

            // Last resort: try to directly fetch API with cookies from the page session
            console.log(`  Trying API fetch with session cookies...`);
            const cookies = await page.cookies();
            const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

            const apiResult = await page.evaluate(async (url) => {
                try {
                    const res = await fetch(`${url}/api/public/category-lookups?sort=flatSortOrder,category,asc&size=1000`);
                    return { status: res.status, body: await res.text() };
                } catch (e) {
                    return { status: -1, body: e.message };
                }
            }, baseUrl);

            console.log(`  API fetch result: status ${apiResult.status}`);
            if (apiResult.status === 200) {
                const data = JSON.parse(apiResult.body);
                const cats = Array.isArray(data) ? data : (data.content || data);
                console.log(`\nFound ${cats.length} categories:\n`);
                cats.forEach(cat => {
                    console.log(`  ID: ${cat.id} | Name: ${cat.category || cat.name}`);
                });
                return cats;
            } else if (apiResult.status === 429) {
                console.log(`  Still rate limited (429). ReliaGuide is aggressively blocking.`);
            }
        }
    } catch (err) {
        console.log(`  Error: ${err.message}`);
    } finally {
        await browser.close();
    }
    return null;
}

async function fetchGeorgiaBarFromSource() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Georgia Bar (gabar.org)');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        await page.goto('https://www.gabar.org/member-directory/', { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        // Get full page HTML and search for memberGroup patterns
        const pageHTML = await page.content();
        const matches = pageHTML.match(/memberGroup=[A-Za-z0-9]+/g);

        if (matches) {
            const unique = [...new Set(matches)].map(m => m.replace('memberGroup=', ''));
            console.log(`Found ${unique.length} member group codes in page source:\n`);
            unique.forEach(code => console.log(`  Code: ${code}`));
        } else {
            console.log('No memberGroup patterns found in page source.');
        }

        // Also look for the section/category listing
        const sections = await page.evaluate(() => {
            const results = [];
            // Try to find section headings or links
            const allLinks = document.querySelectorAll('a');
            for (const link of allLinks) {
                const href = link.href || '';
                if (href.includes('memberGroup') || href.includes('member-directory')) {
                    results.push({
                        text: link.textContent.trim(),
                        href: href
                    });
                }
            }
            return results;
        });

        if (sections.length > 0) {
            console.log(`\nFound ${sections.length} directory links:`);
            sections.forEach(s => console.log(`  ${s.text} → ${s.href}`));
        }

    } catch (err) {
        console.log(`Error: ${err.message}`);
    } finally {
        await browser.close();
    }
}

async function fetchOhioBarWithWait() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Ohio Bar (ohiobar.org) - Extended wait');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        console.log('  Loading page...');
        await page.goto('https://www.ohiobar.org/membership/find-a-lawyer/', {
            waitUntil: 'networkidle2', timeout: 60000
        });

        // Wait longer for React SPA to fully render
        console.log('  Waiting 10s for React SPA...');
        await new Promise(r => setTimeout(r, 10000));

        // Try multiple selector strategies
        const categories = await page.evaluate(() => {
            const results = [];

            // Strategy 1: Look for checkboxes with filterPracticeAreas prefix
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            for (const cb of checkboxes) {
                const id = cb.id || '';
                if (id.includes('filterPracticeAreas') || id.includes('PracticeArea') || id.includes('practiceArea')) {
                    const label = document.querySelector(`label[for="${id}"]`);
                    results.push({
                        id: id,
                        value: cb.value || id,
                        name: label ? label.textContent.trim() : id
                    });
                }
            }

            if (results.length > 0) return { source: 'checkboxes', data: results };

            // Strategy 2: Look for any list of text items that look like practice areas
            const allText = document.body.innerText;
            const hasLawyerSearch = allText.includes('Find a Lawyer') || allText.includes('find-a-lawyer');

            // Strategy 3: Dump all input elements
            const allInputs = document.querySelectorAll('input');
            const inputInfo = Array.from(allInputs).map(i => ({
                type: i.type,
                id: i.id,
                name: i.name,
                value: i.value
            }));

            // Strategy 4: Look for filter sections
            const filterSections = document.querySelectorAll('[class*="filter"], [class*="Filter"]');
            const filterInfo = Array.from(filterSections).map(f => ({
                className: f.className,
                textPreview: f.textContent.substring(0, 200)
            }));

            return {
                source: 'debug',
                hasLawyerSearch,
                inputCount: inputInfo.length,
                inputs: inputInfo.slice(0, 20),
                filterCount: filterSections.length,
                filters: filterInfo.slice(0, 5),
                pageTitle: document.title,
                bodyPreview: document.body.innerText.substring(0, 500)
            };
        });

        if (categories.source === 'checkboxes') {
            console.log(`Found ${categories.data.length} practice areas:\n`);
            categories.data.forEach(cat => {
                console.log(`  ID: ${cat.id} | Value: ${cat.value} | Name: ${cat.name}`);
            });
        } else {
            console.log('Debug info:');
            console.log(JSON.stringify(categories, null, 2));
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    } finally {
        await browser.close();
    }
}

async function main() {
    console.log('Bar Association Category Discovery - Pass 2');
    console.log('='.repeat(60));

    await fetchReliaGuideViaIntercept('Illinois Bar (ISBA)', 'https://isba.reliaguide.com');
    await fetchReliaGuideViaIntercept('Michigan Bar (SBM)', 'https://sbm.reliaguide.com');
    await fetchGeorgiaBarFromSource();
    await fetchOhioBarWithWait();

    console.log('\n' + '='.repeat(60));
    console.log('DONE');
}

main().catch(console.error);
