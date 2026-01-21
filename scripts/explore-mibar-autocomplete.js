#!/usr/bin/env node
/**
 * Explore Michigan Bar autocomplete to discover practice areas
 */

const puppeteer = require('puppeteer');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Michigan Bar Autocomplete Explorer');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({
        headless: 'new',  // Use new headless mode for better React compatibility
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        console.log('Loading homepage...');
        await page.goto('https://sbm.reliaguide.com/home', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait for the React app to fully render
        console.log('Waiting for search input to appear...');
        await sleep(8000); // Give React time to mount

        // Take a debug screenshot
        await page.screenshot({ path: '/tmp/mibar-debug.png', fullPage: true });
        console.log('Debug screenshot saved to /tmp/mibar-debug.png');

        // List all inputs on page
        const allInputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).map(i => ({
                id: i.id,
                placeholder: i.placeholder,
                type: i.type
            }));
        });
        console.log('All inputs on page:');
        allInputs.forEach(i => console.log(`  id="${i.id}" placeholder="${i.placeholder}"`));

        // The input is on /home with id="nameOrCategory__equals"
        let searchInput = await page.$('#nameOrCategory__equals');
        if (!searchInput) {
            searchInput = await page.$('input[placeholder*="practice area"]');
        }
        console.log(`Search input exists: ${!!searchInput}`);

        // Test typing different terms to see autocomplete suggestions
        const testTerms = [
            'Personal',
            'Immigration',
            'Family',
            'Criminal',
            'Bankruptcy',
            'Workers',
            'Real',
            'Estate',
            'Employment',
            'Tax',
            'Medical',
            'Injury'
        ];

        const allCategories = new Map();

        // Use the actual selector that worked
        const inputSelector = searchInput ? (await page.$('#nameOrCategory__equals') ? '#nameOrCategory__equals' : 'input[placeholder*="practice area"]') : null;

        if (!searchInput) {
            console.log('ERROR: Could not find search input. Taking screenshot...');
            await page.screenshot({ path: '/tmp/mibar-no-input.png', fullPage: true });
            console.log('Screenshot saved to /tmp/mibar-no-input.png');
            return;
        }

        for (const term of testTerms) {
            console.log(`\nTesting: "${term}"`);

            // Clear the input first
            await page.evaluate((selector) => {
                const input = document.querySelector(selector);
                if (input) {
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, inputSelector);
            await sleep(500);

            // Type the search term
            await page.type(inputSelector, term, { delay: 100 });
            await sleep(1500);

            // Get autocomplete suggestions
            const suggestions = await page.evaluate(() => {
                const items = [];
                // Ant Design autocomplete dropdown
                const options = document.querySelectorAll('.ant-select-item-option, [class*="autocomplete"] li, [role="option"]');
                options.forEach(opt => {
                    const text = opt.textContent?.trim();
                    const value = opt.getAttribute('data-value') || opt.getAttribute('title') || '';
                    if (text && text.length > 0) {
                        items.push({ text, value });
                    }
                });
                return items;
            });

            if (suggestions.length > 0) {
                console.log(`  Found ${suggestions.length} suggestions:`);
                suggestions.forEach(s => {
                    console.log(`    - ${s.text}`);
                    if (!allCategories.has(s.text)) {
                        allCategories.set(s.text, s.value);
                    }
                });
            } else {
                console.log('  No suggestions found');
            }

            // Clear for next test
            await page.evaluate((selector) => {
                const input = document.querySelector(selector);
                if (input) {
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, inputSelector);
            await sleep(500);
        }

        console.log('\n' + '='.repeat(60));
        console.log('ALL DISCOVERED CATEGORIES:');
        console.log('='.repeat(60));
        allCategories.forEach((value, text) => {
            console.log(`  "${text}"`);
        });

        // Now test selecting a category and doing a search
        console.log('\n--- Testing search with "Personal Injury" ---');

        await page.type(inputSelector, 'Personal Injury', { delay: 50 });
        await sleep(1500);

        // Click the first suggestion
        await page.evaluate(() => {
            const option = document.querySelector('.ant-select-item-option');
            if (option) option.click();
        });
        await sleep(2000);

        // Check URL after selection
        const url = page.url();
        console.log(`URL after selection: ${url}`);

        // Get results count
        const resultsInfo = await page.evaluate(() => {
            const text = document.body.innerText;
            const match = text.match(/Listing\s+(\d+)\s+of\s+(\d+)/);
            return match ? { showing: match[1], total: match[2] } : null;
        });

        if (resultsInfo) {
            console.log(`Results: Showing ${resultsInfo.showing} of ${resultsInfo.total}`);
        }

        // Extract the category ID from URL
        const categoryMatch = url.match(/categoryId\.equals=(\d+)/);
        const categoryNameMatch = url.match(/category\.equals=([^&]+)/);
        if (categoryMatch && categoryNameMatch) {
            console.log(`Category ID: ${categoryMatch[1]}`);
            console.log(`Category Name: ${decodeURIComponent(categoryNameMatch[1])}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
