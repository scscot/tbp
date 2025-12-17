/**
 * Team Build Pro - AI Script Generator
 * Frontend application logic
 */

(function() {
    'use strict';

    // Cloud Function endpoint
    const API_ENDPOINT = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/generateRecruitingScript';

    // DOM Elements
    const form = document.getElementById('script-form');
    const companySelect = document.getElementById('company');
    const otherCompanyGroup = document.getElementById('other-company-group');
    const otherCompanyInput = document.getElementById('other-company');
    const scenarioSelect = document.getElementById('scenario');
    const toneSelect = document.getElementById('tone');
    const generateBtn = document.getElementById('generate-btn');
    const btnText = generateBtn.querySelector('.btn-text');
    const btnLoading = generateBtn.querySelector('.btn-loading');
    const resultArea = document.getElementById('result');
    const scriptOutput = document.getElementById('script-output');
    const copyBtn = document.getElementById('copy-btn');

    // Show/hide "Other company" input
    companySelect.addEventListener('change', function() {
        if (this.value === 'Other') {
            otherCompanyGroup.style.display = 'block';
            otherCompanyInput.required = true;
        } else {
            otherCompanyGroup.style.display = 'none';
            otherCompanyInput.required = false;
        }
    });

    // Form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Get form values
        let company = companySelect.value;
        if (company === 'Other') {
            company = otherCompanyInput.value.trim();
            if (!company) {
                alert('Please enter your company name');
                return;
            }
        }

        const scenario = scenarioSelect.value;
        const tone = toneSelect.value;

        if (!company || !scenario) {
            alert('Please fill in all required fields');
            return;
        }

        // Show loading state
        setLoading(true);

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    company: company,
                    scenario: scenario,
                    tone: tone
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Display the script with branding
            displayScript(data.script);

        } catch (error) {
            console.error('Error generating script:', error);
            alert('Sorry, there was an error generating your script. Please try again.');
        } finally {
            setLoading(false);
        }
    });

    // Copy to clipboard
    copyBtn.addEventListener('click', function() {
        const textToCopy = scriptOutput.innerText;

        navigator.clipboard.writeText(textToCopy).then(() => {
            // Show copied state
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copied!
            `;

            // Reset after 2 seconds
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy
                `;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            fallbackCopy(textToCopy);
        });
    });

    // Fallback copy method
    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
            }, 2000);
        } catch (err) {
            alert('Failed to copy. Please select the text manually.');
        }
        document.body.removeChild(textarea);
    }

    // Set loading state
    function setLoading(isLoading) {
        generateBtn.disabled = isLoading;
        btnText.style.display = isLoading ? 'none' : 'inline';
        btnLoading.style.display = isLoading ? 'inline-flex' : 'none';
    }

    // Display the generated script
    function displayScript(script) {
        // Create the branded output
        const brandedScript = `${script}

---
Powered by Team Build Pro
Download free: teambuildpro.com`;

        scriptOutput.textContent = brandedScript;
        resultArea.style.display = 'block';

        // Scroll to result
        resultArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Track page view (simple analytics)
    function trackPageView() {
        // Could be expanded with proper analytics
        console.log('Script Generator loaded');
    }

    // Initialize
    trackPageView();

})();
