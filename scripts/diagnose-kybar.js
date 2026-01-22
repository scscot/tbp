#!/usr/bin/env node

/**
 * Kentucky Bar Diagnostic Script
 *
 * Purpose: Determine if Kentucky Bar attorney profiles display email addresses
 * before committing to building a full scraper.
 *
 * Run: node scripts/diagnose-kybar.js
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'https://kybar.org/For-Public/Find-a-Lawyer';
const IFRAME_URL = 'https://kybar.org/cv5/cgi-bin/utilities.dll/openpage?WRP=LawyerLocator.htm';

async function diagnoseKyBar() {
    console.log('=== Kentucky Bar Diagnostic Script ===\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Step 1: Navigate to the Find a Lawyer page
        console.log('Step 1: Navigating to Find a Lawyer page...');
        await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('✓ Main page loaded\n');

        // Step 2: Find and access the iframe
        console.log('Step 2: Looking for iframe...');
        const iframeHandle = await page.$('iframe[src*="LawyerLocator"]');

        if (!iframeHandle) {
            console.log('✗ No iframe found with LawyerLocator in src');

            // Try to find any iframe
            const allIframes = await page.$$('iframe');
            console.log(`Found ${allIframes.length} iframe(s) on page`);

            for (let i = 0; i < allIframes.length; i++) {
                const src = await allIframes[i].evaluate(el => el.src);
                console.log(`  Iframe ${i + 1}: ${src}`);
            }
            return;
        }

        const iframe = await iframeHandle.contentFrame();
        if (!iframe) {
            console.log('✗ Could not access iframe content');
            return;
        }
        console.log('✓ Iframe accessed\n');

        // Step 3: Analyze the search form
        console.log('Step 3: Analyzing search form...');

        // Look for practice area dropdown
        const practiceAreaSelect = await iframe.$('select[name*="AREA"], select[name*="practice"], select[id*="practice"]');
        if (practiceAreaSelect) {
            const options = await iframe.$$eval('select[name*="AREA"] option, select[name*="practice"] option, select[id*="practice"] option', opts =>
                opts.slice(0, 10).map(o => ({ value: o.value, text: o.textContent.trim() }))
            );
            console.log('✓ Practice area dropdown found. Sample options:');
            options.forEach(o => console.log(`    ${o.value}: ${o.text}`));
        } else {
            console.log('✗ Practice area dropdown not found');
            // List all selects
            const allSelects = await iframe.$$eval('select', selects =>
                selects.map(s => ({ name: s.name, id: s.id, optionCount: s.options.length }))
            );
            console.log('  All select elements:', allSelects);
        }
        console.log('');

        // Step 4: Perform a search for Personal Injury
        console.log('Step 4: Performing search for Personal Injury attorneys...');

        // Log the full iframe HTML structure for debugging
        const formHTML = await iframe.evaluate(() => {
            const form = document.querySelector('form');
            return form ? form.outerHTML.substring(0, 3000) : 'No form found';
        });
        console.log('  Form structure:', formHTML.substring(0, 800) + '...\n');

        // Try to fill the practice area
        try {
            // Look for the practice area select dropdown
            const practiceSelect = await iframe.$('select');
            if (practiceSelect) {
                // Get all selects and their names
                const selectInfo = await iframe.$$eval('select', selects =>
                    selects.map(s => ({ name: s.name, id: s.id, options: s.options.length }))
                );
                console.log('  Select elements found:', selectInfo);

                // Select Personal Injury (option value 43 based on typical KY Bar structure)
                const practiceAreaSelectHandle = await iframe.$('select:first-of-type');
                if (practiceAreaSelectHandle) {
                    // Get options to find Personal Injury from PRACTICEAREA select
                    const options = await iframe.$$eval('select[name="PRACTICEAREA"] option', opts =>
                        opts.map(o => ({ value: o.value, text: o.textContent.trim() }))
                    );
                    const piOption = options.find(o => o.text.toLowerCase().includes('personal injury'));
                    console.log('  Personal Injury option:', piOption);

                    if (piOption) {
                        await iframe.select('select[name="PRACTICEAREA"]', piOption.value);
                        console.log('  Selected:', piOption.value);
                    }
                }
            }

            // Click search button - it's a button[type="button"] with text "Search"
            const allButtons = await iframe.$$('button');
            let searchBtn = null;
            for (const btn of allButtons) {
                const text = await btn.evaluate(el => el.textContent.trim());
                if (text.includes('Search')) {
                    searchBtn = btn;
                    break;
                }
            }

            if (searchBtn) {
                console.log('  Found Search button, clicking...');
                await searchBtn.click();
                console.log('  Clicked search button');

                // Wait for AJAX response
                await new Promise(resolve => setTimeout(resolve, 5000)); // Extra wait for AJAX

                // Check results container content
                const resultsHTML = await iframe.$eval('#lawyerLocatorResults', el => el.innerHTML);
                console.log('  Results HTML length:', resultsHTML.length);
                console.log('  Results sample:', resultsHTML.substring(0, 1000));
            } else {
                console.log('  No search button found');
            }

            console.log('✓ Search submitted\n');
        } catch (e) {
            console.log('  Search form interaction failed:', e.message);
        }

        // Step 5: Look for search results
        console.log('Step 5: Looking for search results...');

        const resultsContainer = await iframe.$('#lawyerLocatorResults, .results, .search-results');
        if (resultsContainer) {
            const resultsHTML = await resultsContainer.evaluate(el => el.innerHTML.substring(0, 2000));
            console.log('✓ Results container found');
            console.log('  Sample HTML:', resultsHTML.substring(0, 500) + '...');
        } else {
            console.log('✗ Results container not found');

            // Take a screenshot for debugging
            await page.screenshot({ path: '/tmp/kybar-debug.png', fullPage: true });
            console.log('  Screenshot saved to /tmp/kybar-debug.png');
        }
        console.log('');

        // Step 6: Try to find attorney links and check for email
        console.log('Step 6: Looking for attorney profile links...');

        // Look for links that might open attorney profiles
        const attorneyLinks = await iframe.$$eval('a[onclick*="openLawyerInfo"], a[href*="profile"], a[href*="attorney"]', links =>
            links.slice(0, 5).map(l => ({
                text: l.textContent.trim(),
                onclick: l.getAttribute('onclick'),
                href: l.href
            }))
        );

        if (attorneyLinks.length > 0) {
            console.log('✓ Found attorney links:');
            attorneyLinks.forEach(l => console.log(`    ${l.text}: onclick=${l.onclick || 'none'}, href=${l.href || 'none'}`));
        } else {
            console.log('✗ No standard attorney profile links found');

            // Look for any clickable elements in results
            const clickableItems = await iframe.$$eval('#lawyerLocatorResults a, #lawyerLocatorResults [onclick], .results a, .search-results a', items =>
                items.slice(0, 10).map(el => ({
                    tag: el.tagName,
                    text: el.textContent.trim().substring(0, 50),
                    onclick: el.getAttribute('onclick'),
                    href: el.href || null
                }))
            );
            console.log('  Clickable items in results:', clickableItems);
        }
        console.log('');

        // Step 6b: Try clicking on the first attorney to see profile details
        console.log('Step 6b: Attempting to open first attorney profile...');
        try {
            // Look for any elements with openLawyerInfo onclick
            const profileLinks = await iframe.$$('[onclick*="openLawyerInfo"]');
            if (profileLinks.length > 0) {
                console.log(`  Found ${profileLinks.length} profile link(s). Clicking first one...`);
                await profileLinks[0].click();
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for profile to load

                // Now check for email in profile view
                const profileEmails = await iframe.$$eval('a[href^="mailto:"]', links =>
                    links.map(l => l.href.replace('mailto:', ''))
                );
                if (profileEmails.length > 0) {
                    console.log('✓ FOUND EMAILS IN PROFILE VIEW:');
                    profileEmails.forEach(e => console.log(`    ${e}`));
                } else {
                    // Check full page text for emails
                    const profileText = await iframe.evaluate(() => document.body.innerText);
                    const foundEmails = profileText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
                    if (foundEmails.length > 0) {
                        console.log('✓ FOUND EMAILS IN PROFILE TEXT:');
                        [...new Set(foundEmails)].forEach(e => console.log(`    ${e}`));
                    } else {
                        console.log('✗ No emails found in profile view');

                        // Log the profile content for analysis
                        const profileHTML = await iframe.evaluate(() => document.body.innerHTML);
                        console.log('  Profile HTML sample:', profileHTML.substring(0, 1500) + '...');
                    }
                }
            } else {
                // Try to find clickable attorney names
                const nameElements = await iframe.$$('.attorney-name, .lawyer-name, .member-name, td a, .result-item a');
                console.log(`  Found ${nameElements.length} potential clickable name elements`);

                if (nameElements.length > 0) {
                    await nameElements[0].click();
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    const profileText = await iframe.evaluate(() => document.body.innerText);
                    const foundEmails = profileText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
                    console.log('  Emails after click:', foundEmails.length > 0 ? foundEmails : 'none');
                }
            }
        } catch (e) {
            console.log('  Error opening profile:', e.message);
        }
        console.log('');

        // Step 7: Look for any email addresses in the page
        console.log('Step 7: Searching for email addresses...');

        const pageText = await iframe.evaluate(() => document.body.innerText);
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = pageText.match(emailRegex) || [];

        if (emails.length > 0) {
            console.log('✓ Found email addresses:');
            [...new Set(emails)].forEach(e => console.log(`    ${e}`));
        } else {
            console.log('✗ No email addresses found in visible text');
        }
        console.log('');

        // Step 8: Check for mailto links
        console.log('Step 8: Checking for mailto links...');

        const mailtoLinks = await iframe.$$eval('a[href^="mailto:"]', links =>
            links.map(l => l.href.replace('mailto:', ''))
        );

        if (mailtoLinks.length > 0) {
            console.log('✓ Found mailto links:');
            mailtoLinks.forEach(e => console.log(`    ${e}`));
        } else {
            console.log('✗ No mailto links found');
        }
        console.log('');

        // Final summary
        console.log('=== DIAGNOSIS COMPLETE ===');
        console.log('\nConclusion:');
        if (emails.length > 0 || mailtoLinks.length > 0) {
            console.log('✓ Kentucky Bar DOES display email addresses');
            console.log('→ Proceed with scraper development');
        } else {
            console.log('✗ Kentucky Bar does NOT appear to display email addresses');
            console.log('→ Manual verification recommended before proceeding');
        }

    } catch (error) {
        console.error('Error during diagnosis:', error);
    } finally {
        await browser.close();
    }
}

diagnoseKyBar().catch(console.error);
