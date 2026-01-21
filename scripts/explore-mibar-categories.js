#!/usr/bin/env node
/**
 * Discover available practice area categories from Michigan Bar
 */

const puppeteer = require('puppeteer');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Michigan Bar Category Discovery');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        // Navigate to base search page
        console.log('Loading search page...');
        await page.goto('https://sbm.reliaguide.com/lawyer/search', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        await sleep(5000);

        // Click "More Filters" button
        console.log('Looking for More Filters button...');
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent?.includes('More Filters')) {
                    btn.click();
                    return;
                }
            }
        });
        await sleep(3000);

        // Look for category/practice area dropdown and click it
        console.log('Looking for category dropdown...');

        // Find and click on Ant Design selects
        const selectClicked = await page.evaluate(() => {
            // Look for select elements with placeholder containing "category" or "practice"
            const selectors = document.querySelectorAll('.ant-select-selector');
            for (const sel of selectors) {
                const text = sel.textContent?.toLowerCase() || '';
                const placeholder = sel.querySelector('.ant-select-selection-placeholder')?.textContent?.toLowerCase() || '';
                if (text.includes('practice') || text.includes('category') ||
                    placeholder.includes('practice') || placeholder.includes('category') ||
                    placeholder.includes('area') || text.includes('specialty')) {
                    sel.click();
                    return sel.textContent || 'clicked';
                }
            }
            // If none found, click all selects and report
            const allSelects = Array.from(selectors).map(s => s.textContent?.substring(0, 30));
            return `No category select found. Found selects: ${allSelects.join(', ')}`;
        });
        console.log(`Select result: ${selectClicked}`);
        await sleep(2000);

        // Get dropdown options
        const dropdownOptions = await page.evaluate(() => {
            const options = [];
            // Ant Design dropdown items
            const items = document.querySelectorAll('.ant-select-dropdown .ant-select-item-option, .ant-select-item');
            items.forEach(item => {
                const text = item.textContent?.trim();
                const value = item.getAttribute('data-value') || item.getAttribute('title') || '';
                if (text && text.length > 0 && text.length < 100) {
                    options.push({ text, value });
                }
            });
            return options;
        });

        console.log('\nDropdown options found:');
        dropdownOptions.forEach(o => {
            console.log(`  ${o.text}${o.value ? ' (value: ' + o.value + ')' : ''}`);
        });

        // Take screenshot
        await page.screenshot({ path: '/tmp/mibar-filters.png', fullPage: true });
        console.log('\n✓ Screenshot saved to /tmp/mibar-filters.png');

        // Also get all visible text that might indicate categories
        const pageText = await page.evaluate(() => {
            return document.body.innerText.substring(0, 3000);
        });

        console.log('\n--- Page text sample ---');
        console.log(pageText.substring(0, 1500));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
