#!/usr/bin/env node
/**
 * Michigan Bar (ReliaGuide) Page Structure Explorer
 *
 * Discovers the page structure, attorney data elements, and pagination mechanism
 * for the Michigan Bar attorney directory at sbm.reliaguide.com
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'https://sbm.reliaguide.com/lawyer/search';
const SAMPLE_CATEGORY = 'Bankruptcy';
const SAMPLE_CATEGORY_ID = '3';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Michigan Bar (ReliaGuide) Structure Explorer');
    console.log('='.repeat(60));

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    try {
        // Navigate to search page with category filter
        const url = `${BASE_URL}?category.equals=${SAMPLE_CATEGORY}&categoryId.equals=${SAMPLE_CATEGORY_ID}&memberTypeId.equals=1`;
        console.log(`\nNavigating to: ${url}`);

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('Page loaded, waiting for React render...');
        await sleep(5000);

        // Get page title
        const title = await page.title();
        console.log(`\nPage title: ${title}`);

        // Look for attorney cards/list items
        console.log('\n--- ATTORNEY CARD ANALYSIS ---');

        const cardAnalysis = await page.evaluate(() => {
            const analysis = {
                possibleContainers: [],
                links: [],
                emails: [],
                phones: [],
                names: []
            };

            // Look for common card/list patterns
            const cardPatterns = [
                'card', 'item', 'result', 'lawyer', 'attorney', 'member', 'profile', 'listing'
            ];

            cardPatterns.forEach(pattern => {
                const byClass = document.querySelectorAll(`[class*="${pattern}"]`);
                const byId = document.querySelectorAll(`[id*="${pattern}"]`);
                if (byClass.length > 0) {
                    analysis.possibleContainers.push({
                        selector: `[class*="${pattern}"]`,
                        count: byClass.length,
                        sampleClasses: Array.from(byClass).slice(0, 3).map(el => el.className)
                    });
                }
                if (byId.length > 0) {
                    analysis.possibleContainers.push({
                        selector: `[id*="${pattern}"]`,
                        count: byId.length,
                        sampleIds: Array.from(byId).slice(0, 3).map(el => el.id)
                    });
                }
            });

            // Look for mailto links
            const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
            analysis.emails = Array.from(mailtoLinks).slice(0, 5).map(el => ({
                email: el.href.replace('mailto:', ''),
                parentClass: el.parentElement?.className
            }));

            // Look for tel links
            const telLinks = document.querySelectorAll('a[href^="tel:"]');
            analysis.phones = Array.from(telLinks).slice(0, 5).map(el => ({
                phone: el.href.replace('tel:', ''),
                parentClass: el.parentElement?.className
            }));

            // Look for visible links that might be profiles
            const allLinks = document.querySelectorAll('a[href]');
            analysis.links = Array.from(allLinks)
                .filter(a => a.href.includes('lawyer') || a.href.includes('profile') || a.href.includes('member'))
                .slice(0, 10)
                .map(a => ({
                    href: a.href,
                    text: a.textContent?.trim()?.substring(0, 50)
                }));

            return analysis;
        });

        console.log('\nPossible card containers:');
        cardAnalysis.possibleContainers.forEach(c => {
            console.log(`  ${c.selector}: ${c.count} elements`);
            if (c.sampleClasses) console.log(`    Classes: ${c.sampleClasses.slice(0, 2).join(', ')}`);
        });

        console.log('\nEmails found:');
        cardAnalysis.emails.forEach(e => {
            console.log(`  ${e.email}`);
        });

        console.log('\nPhones found:');
        cardAnalysis.phones.forEach(p => {
            console.log(`  ${p.phone}`);
        });

        console.log('\nProfile-like links:');
        cardAnalysis.links.forEach(l => {
            console.log(`  ${l.text}: ${l.href}`);
        });

        // Look for pagination elements
        console.log('\n--- PAGINATION ANALYSIS ---');

        const paginationAnalysis = await page.evaluate(() => {
            const analysis = {
                loadMoreButtons: [],
                pageNumbers: [],
                nextButtons: [],
                infiniteScrollIndicators: []
            };

            // Look for "Load More" or "Show More" buttons
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
                const text = btn.textContent?.toLowerCase() || '';
                if (text.includes('load') || text.includes('more') || text.includes('show')) {
                    analysis.loadMoreButtons.push({
                        text: btn.textContent?.trim(),
                        className: btn.className
                    });
                }
                if (text.includes('next') || text.includes('→') || text.includes('>')) {
                    analysis.nextButtons.push({
                        text: btn.textContent?.trim(),
                        className: btn.className
                    });
                }
            });

            // Look for pagination links
            const pageLinks = document.querySelectorAll('[class*="page"], [class*="pagination"]');
            analysis.pageNumbers = Array.from(pageLinks).slice(0, 5).map(el => ({
                className: el.className,
                text: el.textContent?.trim()?.substring(0, 50)
            }));

            // Check for infinite scroll indicators
            const scrollIndicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="infinite"]');
            analysis.infiniteScrollIndicators = Array.from(scrollIndicators).slice(0, 3).map(el => el.className);

            return analysis;
        });

        console.log('\nLoad More buttons:');
        paginationAnalysis.loadMoreButtons.forEach(b => {
            console.log(`  "${b.text}" (class: ${b.className})`);
        });

        console.log('\nNext buttons:');
        paginationAnalysis.nextButtons.forEach(b => {
            console.log(`  "${b.text}" (class: ${b.className})`);
        });

        console.log('\nPagination elements:');
        paginationAnalysis.pageNumbers.forEach(p => {
            console.log(`  ${p.className}: ${p.text}`);
        });

        // Get total results count
        console.log('\n--- RESULTS COUNT ---');

        const resultsInfo = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const resultMatches = bodyText.match(/(\d+)\s*(results?|lawyers?|attorneys?|members?|found)/i);
            const showingMatches = bodyText.match(/showing\s*(\d+)/i);

            return {
                resultsMatch: resultMatches ? resultMatches[0] : null,
                showingMatch: showingMatches ? showingMatches[0] : null,
                bodyTextSample: bodyText.substring(0, 500)
            };
        });

        console.log(`Results indicator: ${resultsInfo.resultsMatch || 'Not found'}`);
        console.log(`Showing indicator: ${resultsInfo.showingMatch || 'Not found'}`);

        // Get sample attorney data
        console.log('\n--- SAMPLE ATTORNEY DATA ---');

        const sampleData = await page.evaluate(() => {
            // Try to find attorney names
            const namePatterns = ['h2', 'h3', 'h4', '.name', '[class*="name"]'];
            const names = [];

            namePatterns.forEach(pattern => {
                const elements = document.querySelectorAll(pattern);
                elements.forEach(el => {
                    const text = el.textContent?.trim();
                    // Filter out obvious non-names
                    if (text && text.length > 3 && text.length < 100 &&
                        !text.includes('Search') && !text.includes('Filter') &&
                        /^[A-Za-z\s,.'()-]+$/.test(text)) {
                        names.push({ pattern, text });
                    }
                });
            });

            return { names: names.slice(0, 10) };
        });

        console.log('\nPossible attorney names:');
        sampleData.names.forEach(n => {
            console.log(`  [${n.pattern}] ${n.text}`);
        });

        // Get available categories from the page
        console.log('\n--- AVAILABLE CATEGORIES ---');

        const categories = await page.evaluate(() => {
            const cats = [];
            // Look for select/dropdown with categories
            const selects = document.querySelectorAll('select');
            selects.forEach(select => {
                const options = select.querySelectorAll('option');
                if (options.length > 5) {
                    cats.push({
                        selectName: select.name || select.className,
                        options: Array.from(options).slice(0, 15).map(o => ({
                            value: o.value,
                            text: o.textContent?.trim()
                        }))
                    });
                }
            });

            // Also look for category links
            const catLinks = document.querySelectorAll('a[href*="category"]');
            const linkCats = Array.from(catLinks).slice(0, 10).map(a => ({
                href: a.href,
                text: a.textContent?.trim()
            }));

            return { selects: cats, links: linkCats };
        });

        console.log('\nCategory dropdowns:');
        categories.selects.forEach(s => {
            console.log(`  ${s.selectName}:`);
            s.options.forEach(o => {
                console.log(`    ${o.value}: ${o.text}`);
            });
        });

        console.log('\nCategory links:');
        categories.links.forEach(l => {
            console.log(`  ${l.text}: ${l.href}`);
        });

        // Take a screenshot for reference
        await page.screenshot({ path: '/tmp/mibar-screenshot.png', fullPage: true });
        console.log('\n✓ Screenshot saved to /tmp/mibar-screenshot.png');

        console.log('\n✓ Exploration complete!');

    } catch (error) {
        console.error('\nError:', error.message);
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
