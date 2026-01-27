#!/usr/bin/env node
/**
 * Fetch actual practice area categories from bar association websites
 * Uses Puppeteer for ReliaGuide sites, fetch for others
 */

const puppeteer = require('puppeteer');

async function fetchReliaGuideCategories(name, baseUrl) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${name} (ReliaGuide: ${baseUrl})`);
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        // First load the search page to establish session
        await page.goto(`${baseUrl}/lawyer/search`, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        // Now fetch the category-lookups API
        const response = await page.evaluate(async (url) => {
            const res = await fetch(`${url}/api/public/category-lookups?sort=flatSortOrder,category,asc&size=1000`, {
                headers: { 'Accept': 'application/json' }
            });
            return { status: res.status, body: await res.text() };
        }, baseUrl);

        if (response.status === 200) {
            const data = JSON.parse(response.body);
            const categories = Array.isArray(data) ? data : (data.content || data);
            console.log(`Found ${categories.length} categories:\n`);
            categories.forEach(cat => {
                console.log(`  ID: ${cat.id} | Name: ${cat.category || cat.name}`);
            });
            return categories;
        } else {
            console.log(`API returned status ${response.status}`);

            // Fallback: try to extract from the search page dropdown
            const dropdownCategories = await page.evaluate(() => {
                const options = document.querySelectorAll('select option, [role="option"], [data-category]');
                return Array.from(options).map(o => ({
                    value: o.value || o.getAttribute('data-category'),
                    text: o.textContent.trim()
                })).filter(o => o.value && o.text);
            });

            if (dropdownCategories.length > 0) {
                console.log(`Found ${dropdownCategories.length} categories from dropdown:\n`);
                dropdownCategories.forEach(cat => {
                    console.log(`  Value: ${cat.value} | Name: ${cat.text}`);
                });
            }
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    } finally {
        await browser.close();
    }
}

async function fetchFloridaBarCategories() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Florida Bar (floridabar.org)');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        await page.goto('https://www.floridabar.org/directories/find-mbr/', { waitUntil: 'networkidle2', timeout: 30000 });

        const categories = await page.evaluate(() => {
            const select = document.querySelector('select[name="practiceArea"], select[id*="practice"], select[id*="Practice"]');
            if (!select) {
                // Try to find any select with practice area options
                const allSelects = document.querySelectorAll('select');
                for (const s of allSelects) {
                    const opts = Array.from(s.options);
                    if (opts.some(o => o.text.includes('Injury') || o.text.includes('Immigration'))) {
                        return opts.map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value);
                    }
                }
                return [];
            }
            return Array.from(select.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value);
        });

        if (categories.length > 0) {
            console.log(`Found ${categories.length} practice areas:\n`);
            categories.forEach(cat => {
                console.log(`  Code: ${cat.value} | Name: ${cat.text}`);
            });
        } else {
            console.log('Could not find practice area dropdown. Page may use different structure.');
            // Try to get page content for debugging
            const title = await page.title();
            console.log(`Page title: ${title}`);
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    } finally {
        await browser.close();
    }
}

async function fetchGeorgiaBarCategories() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Georgia Bar (gabar.org)');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        await page.goto('https://www.gabar.org/member-directory/', { waitUntil: 'networkidle2', timeout: 30000 });

        const categories = await page.evaluate(() => {
            // Look for member group links
            const links = document.querySelectorAll('a[href*="memberGroup="]');
            return Array.from(links).map(a => {
                const match = a.href.match(/memberGroup=([A-Z]+\d+)/);
                return {
                    code: match ? match[1] : '',
                    name: a.textContent.trim()
                };
            }).filter(c => c.code);
        });

        if (categories.length > 0) {
            console.log(`Found ${categories.length} practice areas:\n`);
            categories.forEach(cat => {
                console.log(`  Code: ${cat.code} | Name: ${cat.name}`);
            });
        } else {
            console.log('Could not find member group links. Trying alternative selectors...');
            const pageContent = await page.content();
            const matches = pageContent.match(/memberGroup=[A-Z]+\d+/g);
            if (matches) {
                const unique = [...new Set(matches)];
                console.log(`Found ${unique.length} member group codes in page source:`);
                unique.forEach(m => console.log(`  ${m}`));
            }
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    } finally {
        await browser.close();
    }
}

async function fetchMissouriBarCategories() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Missouri Bar (mobar.org)');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        await page.goto('https://www.mobar.org/public/lawyersearch.aspx', { waitUntil: 'networkidle2', timeout: 30000 });

        const categories = await page.evaluate(() => {
            const select = document.querySelector('select[name*="PracticeArea"], select[id*="PracticeArea"]');
            if (!select) {
                const allSelects = document.querySelectorAll('select');
                for (const s of allSelects) {
                    const opts = Array.from(s.options);
                    if (opts.length > 10) { // Practice area dropdowns typically have many options
                        return opts.map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value && o.value !== '');
                    }
                }
                return [];
            }
            return Array.from(select.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value && o.value !== '');
        });

        if (categories.length > 0) {
            console.log(`Found ${categories.length} practice areas:\n`);
            categories.forEach(cat => {
                console.log(`  Value: ${cat.value} | Name: ${cat.text}`);
            });
        } else {
            console.log('Could not find practice area dropdown.');
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    } finally {
        await browser.close();
    }
}

async function fetchKentuckyBarCategories() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Kentucky Bar (kybar.org)');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        // KY Bar uses iframe - need to navigate directly to the iframe URL
        await page.goto('https://kybar.org/cv5/cgi-bin/utilities.dll/openpage?WRP=LawyerLocator.htm', {
            waitUntil: 'networkidle2', timeout: 30000
        });

        const categories = await page.evaluate(() => {
            const select = document.querySelector('select[name="PRACTICEAREA"]');
            if (!select) return [];
            return Array.from(select.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value && o.value !== '' && o.text !== 'Select...');
        });

        if (categories.length > 0) {
            console.log(`Found ${categories.length} practice areas:\n`);
            categories.forEach(cat => {
                console.log(`  Value: ${cat.value} | Name: ${cat.text}`);
            });
        } else {
            console.log('Could not find practice area dropdown.');
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    } finally {
        await browser.close();
    }
}

async function fetchCaliforniaBarCategories() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('California Bar (calbar.ca.gov)');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        await page.goto('https://apps.calbar.ca.gov/attorney/LicenseeSearch/AdvancedSearch', {
            waitUntil: 'networkidle2', timeout: 30000
        });

        const categories = await page.evaluate(() => {
            // Try various selectors for practice area
            const selects = document.querySelectorAll('select');
            for (const s of selects) {
                const opts = Array.from(s.options);
                if (opts.some(o => o.text.includes('Injury') || o.text.includes('Immigration') || o.text.includes('Bankruptcy'))) {
                    return opts.map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value && o.value !== '');
                }
            }
            // Check for checkboxes or other inputs
            const labels = document.querySelectorAll('label');
            return Array.from(labels).filter(l => l.textContent.includes('Practice')).map(l => ({
                value: l.htmlFor || '',
                text: l.textContent.trim()
            }));
        });

        if (categories.length > 0) {
            console.log(`Found ${categories.length} practice areas:\n`);
            categories.forEach(cat => {
                console.log(`  Value: ${cat.value} | Name: ${cat.text}`);
            });
        } else {
            console.log('CalBar advanced search may not have a practice area dropdown.');
            console.log('CalBar uses "Certified Specialization" not generic practice areas.');
            const title = await page.title();
            console.log(`Page title: ${title}`);
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    } finally {
        await browser.close();
    }
}

async function fetchOhioBarCategories() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Ohio Bar (ohiobar.org)');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        await page.goto('https://www.ohiobar.org/membership/find-a-lawyer/', {
            waitUntil: 'networkidle2', timeout: 30000
        });
        await new Promise(r => setTimeout(r, 3000)); // Wait for React SPA

        // Ohio Bar uses checkboxes, not dropdowns
        const categories = await page.evaluate(() => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"][id*="PracticeArea"], input[type="checkbox"][id*="practiceArea"], input[type="checkbox"][id*="filterPracticeAreas"]');
            const results = [];
            for (const cb of checkboxes) {
                const label = document.querySelector(`label[for="${cb.id}"]`);
                results.push({
                    id: cb.id,
                    value: cb.value,
                    name: label ? label.textContent.trim() : cb.value
                });
            }

            if (results.length === 0) {
                // Try broader search
                const allLabels = document.querySelectorAll('label');
                const practiceLabels = Array.from(allLabels).filter(l => {
                    const forAttr = l.htmlFor || '';
                    return forAttr.includes('PracticeArea') || forAttr.includes('practiceArea');
                });
                return practiceLabels.map(l => ({
                    id: l.htmlFor,
                    value: l.htmlFor,
                    name: l.textContent.trim()
                }));
            }
            return results;
        });

        if (categories.length > 0) {
            console.log(`Found ${categories.length} practice areas:\n`);
            categories.forEach(cat => {
                console.log(`  ID: ${cat.id} | Value: ${cat.value} | Name: ${cat.name}`);
            });
        } else {
            console.log('Could not find practice area checkboxes. React SPA may need more load time.');
        }
    } catch (err) {
        console.log(`Error: ${err.message}`);
    } finally {
        await browser.close();
    }
}

async function main() {
    console.log('Bar Association Category Discovery Tool');
    console.log('='.repeat(60));
    console.log('Fetching actual categories from each bar association website...\n');

    // ReliaGuide sites (IL, MI)
    await fetchReliaGuideCategories('Illinois Bar (ISBA)', 'https://isba.reliaguide.com');
    await fetchReliaGuideCategories('Michigan Bar (SBM)', 'https://sbm.reliaguide.com');

    // Other bar associations
    await fetchFloridaBarCategories();
    await fetchCaliforniaBarCategories();
    await fetchGeorgiaBarCategories();
    await fetchMissouriBarCategories();
    await fetchKentuckyBarCategories();
    await fetchOhioBarCategories();

    console.log('\n' + '='.repeat(60));
    console.log('DONE');
    console.log('='.repeat(60));
}

main().catch(console.error);
