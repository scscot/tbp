/**
 * PreIntake.ai Embeddable Widget
 *
 * Usage:
 * <div id="preintake"></div>
 * <script src="https://preintake.ai/widget.js" data-firm="YOUR_FIRM_ID"></script>
 */
(function() {
    'use strict';

    // Get firm ID from script tag or URL parameter
    let firmId = null;

    // Try 1: document.currentScript (works for static script tags)
    if (document.currentScript?.dataset?.firm) {
        firmId = document.currentScript.dataset.firm;
    }

    // Try 2: Find script by src (works for dynamically loaded scripts)
    if (!firmId) {
        const scripts = document.querySelectorAll('script[src*="widget.js"]');
        for (const script of scripts) {
            if (script.dataset.firm) {
                firmId = script.dataset.firm;
                break;
            }
        }
    }

    // Try 3: URL parameter (fallback for testing)
    if (!firmId) {
        const urlParams = new URLSearchParams(window.location.search);
        firmId = urlParams.get('firm');
    }

    if (!firmId) {
        console.error('PreIntake Widget: Missing data-firm attribute');
        return;
    }

    // API endpoints
    const API_BASE = 'https://us-west1-teambuilder-plus-fe74d.cloudfunctions.net';
    const CONFIG_URL = `${API_BASE}/getWidgetConfig?firm=${firmId}`;
    const CHAT_URL = `${API_BASE}/intakeChat`;

    // Find container
    const container = document.getElementById('preintake');
    if (!container) {
        console.error('PreIntake Widget: Container #preintake not found');
        return;
    }

    // Create Shadow DOM for style encapsulation
    const shadow = container.attachShadow({ mode: 'closed' });

    // Session state
    let sessionId = generateSessionId();
    let conversationHistory = [];
    let collectedData = {};
    let isProcessing = false;
    let config = null;
    let currentStep = 0;

    // Progress steps - will be customized based on practice area
    let progressSteps = [
        { id: 'contact', label: 'Contact Info', completed: false },
        { id: 'case_type', label: 'Case Type', completed: false },
        { id: 'details', label: 'Case Details', completed: false },
        { id: 'assessment', label: 'Assessment', completed: false }
    ];

    /**
     * Generate unique session ID
     */
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get practice-area-specific step labels (matches demo-generator)
     */
    function getPracticeAreaSteps(practiceAreas, isMultiPractice) {
        const primaryArea = practiceAreas?.[0] || 'Legal Matter';
        const area = primaryArea.toLowerCase();

        // Practice-area-specific 5-step progressions (matching demo-generator-functions.js)
        let stepLabels;
        if (area.includes('personal injury') || area.includes('car accident') || area.includes('auto accident')) {
            stepLabels = ['Basic Information', 'Incident Details', 'Liability Assessment', 'Injuries & Treatment', 'Insurance Details'];
        } else if (area.includes('immigration')) {
            stepLabels = ['Basic Information', 'Immigration Status', 'Case Details', 'Application History', 'Review'];
        } else if (area.includes('family') || area.includes('divorce') || area.includes('custody')) {
            stepLabels = ['Basic Information', 'Case Type', 'Family Details', 'Urgency Assessment', 'Review'];
        } else if (area.includes('tax')) {
            stepLabels = ['Basic Information', 'Tax Issue', 'IRS Situation', 'Resolution Options', 'Review'];
        } else if (area.includes('bankruptcy')) {
            stepLabels = ['Basic Information', 'Financial Situation', 'Debt Details', 'Qualification', 'Review'];
        } else if (area.includes('criminal')) {
            stepLabels = ['Basic Information', 'Charges', 'Case Status', 'Court Details', 'Review'];
        } else if (area.includes('estate') || area.includes('probate') || area.includes('trust')) {
            stepLabels = ['Basic Information', 'Planning Needs', 'Asset Overview', 'Special Circumstances', 'Review'];
        } else if (area.includes('employment') || area.includes('labor')) {
            stepLabels = ['Basic Information', 'Employment Situation', 'Incident Details', 'Documentation', 'Review'];
        } else if (area.includes('real estate') || area.includes('property')) {
            stepLabels = ['Basic Information', 'Property Details', 'Transaction Type', 'Issues', 'Review'];
        } else if (area.includes('business') || area.includes('corporate')) {
            stepLabels = ['Basic Information', 'Business Type', 'Legal Needs', 'Timeline', 'Review'];
        } else {
            stepLabels = ['Basic Information', 'Case Overview', 'Details', 'Qualification', 'Review'];
        }

        // Build step objects
        const stepIds = ['basic', 'step2', 'step3', 'step4', 'review'];
        return stepLabels.map((label, i) => ({
            id: stepIds[i],
            label: label,
            completed: false
        }));
    }

    /**
     * Initialize widget - fetch config and render
     */
    async function init() {
        try {
            // Fetch public config
            const response = await fetch(CONFIG_URL);
            if (!response.ok) throw new Error('Failed to load config');
            config = await response.json();

            // Set practice-area-specific steps
            const isMultiPractice = config.practiceAreas && config.practiceAreas.length > 1;
            progressSteps = getPracticeAreaSteps(config.practiceAreas, isMultiPractice);

            // Render UI
            render();

            // Start conversation
            startConversation();

        } catch (error) {
            console.error('PreIntake Widget: Initialization failed', error);
            renderError('Unable to load intake form. Please refresh the page.');
        }
    }

    /**
     * Render the chat UI with progress sidebar
     */
    function render() {
        const primaryColor = config.colors?.primary || '#0c1f3f';
        const accentColor = config.colors?.accent || '#c9a962';

        shadow.innerHTML = `
            <style>
                :host {
                    --primary-dark: ${primaryColor};
                    --primary-blue: #1a365d;
                    --accent-gold: ${accentColor};
                    --text-light: #ffffff;
                    --text-muted: #a0aec0;
                    --bg-card: rgba(255, 255, 255, 0.05);
                    --bg-card-hover: rgba(255, 255, 255, 0.08);
                    --border-subtle: rgba(255, 255, 255, 0.1);
                    --success: #48bb78;

                    display: block;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    color: var(--text-light);
                    line-height: 1.6;
                }

                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                .widget-container {
                    background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-blue) 50%, var(--primary-dark) 100%);
                    border-radius: 16px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    height: 650px;
                    max-height: 85vh;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }

                .widget-header {
                    padding: 1rem 1.5rem;
                    background: rgba(0, 0, 0, 0.2);
                    border-bottom: 1px solid var(--border-subtle);
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .widget-logo {
                    height: 40px;
                    max-width: 150px;
                    object-fit: contain;
                }

                .widget-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: var(--accent-gold);
                }

                .widget-main {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }

                /* Progress Sidebar */
                .progress-sidebar {
                    width: 220px;
                    padding: 1.5rem;
                    background: rgba(0, 0, 0, 0.2);
                    border-right: 1px solid var(--border-subtle);
                    flex-shrink: 0;
                }

                .progress-title {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: var(--text-muted);
                    margin-bottom: 1.25rem;
                    font-weight: 600;
                }

                .progress-steps {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .progress-step {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                }

                .progress-step.active {
                    background: var(--bg-card);
                }

                .step-indicator {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: 2px solid var(--border-subtle);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 600;
                    flex-shrink: 0;
                    transition: all 0.3s ease;
                }

                .progress-step.active .step-indicator {
                    border-color: var(--accent-gold);
                    background: var(--accent-gold);
                    color: var(--primary-dark);
                }

                .progress-step.completed .step-indicator {
                    background: var(--success);
                    border-color: var(--success);
                }

                .step-indicator svg {
                    display: none;
                    width: 14px;
                    height: 14px;
                    stroke: white;
                }

                .progress-step.completed .step-indicator svg {
                    display: block;
                }

                .progress-step.completed .step-indicator .step-number {
                    display: none;
                }

                .step-text {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                    transition: color 0.3s ease;
                }

                .progress-step.active .step-text,
                .progress-step.completed .step-text {
                    color: var(--text-light);
                }

                /* Chat Area */
                .chat-area {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    min-width: 0;
                }

                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .message {
                    display: flex;
                    gap: 0.75rem;
                    max-width: 90%;
                    animation: fadeInUp 0.3s ease;
                }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .message.assistant { align-self: flex-start; }
                .message.user { align-self: flex-end; flex-direction: row-reverse; }

                .message-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    font-weight: 600;
                    font-size: 0.75rem;
                }

                .message.assistant .message-avatar {
                    background: var(--accent-gold);
                    color: var(--primary-dark);
                }

                .message.user .message-avatar {
                    background: var(--primary-blue);
                    color: var(--text-light);
                }

                .message-content {
                    padding: 0.875rem 1rem;
                    border-radius: 12px;
                    line-height: 1.5;
                    font-size: 0.9375rem;
                }

                .message.assistant .message-content {
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-bottom-left-radius: 4px;
                }

                .message.user .message-content {
                    background: var(--primary-blue);
                    border-bottom-right-radius: 4px;
                }

                .typing-indicator {
                    display: flex;
                    gap: 4px;
                    padding: 0.875rem 1rem;
                    background: var(--bg-card);
                    border-radius: 12px;
                    border: 1px solid var(--border-subtle);
                    width: fit-content;
                }

                .typing-indicator span {
                    width: 8px;
                    height: 8px;
                    background: var(--accent-gold);
                    border-radius: 50%;
                    animation: bounce 1.4s ease-in-out infinite;
                }

                .typing-indicator span:nth-child(1) { animation-delay: 0s; }
                .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
                .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

                @keyframes bounce {
                    0%, 60%, 100% { transform: translateY(0); }
                    30% { transform: translateY(-6px); }
                }

                .response-options {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-top: 0.75rem;
                }

                .response-button {
                    padding: 0.5rem 1rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 20px;
                    color: var(--text-light);
                    font-size: 0.875rem;
                    font-family: inherit;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .response-button:hover {
                    background: var(--accent-gold);
                    border-color: var(--accent-gold);
                    color: var(--primary-dark);
                    transform: translateY(-1px);
                }

                .chat-input-area {
                    padding: 1rem 1.5rem;
                    background: rgba(0, 0, 0, 0.2);
                    border-top: 1px solid var(--border-subtle);
                }

                .chat-input-container {
                    display: flex;
                    gap: 0.75rem;
                }

                .chat-input {
                    flex: 1;
                    padding: 0.875rem 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border-subtle);
                    border-radius: 25px;
                    color: var(--text-light);
                    font-size: 0.9375rem;
                    font-family: inherit;
                    outline: none;
                    transition: border-color 0.3s ease;
                }

                .chat-input:focus {
                    border-color: var(--accent-gold);
                }

                .chat-input::placeholder {
                    color: var(--text-muted);
                }

                .send-button {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: var(--accent-gold);
                    border: none;
                    color: var(--primary-dark);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                    flex-shrink: 0;
                }

                .send-button:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 0 0 20px rgba(201, 169, 98, 0.4);
                }

                .send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .send-button svg {
                    width: 18px;
                    height: 18px;
                }

                .powered-by {
                    text-align: center;
                    padding: 0.5rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    background: rgba(0, 0, 0, 0.1);
                }

                .powered-by a {
                    color: var(--accent-gold);
                    text-decoration: none;
                }

                .error-message {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 8px;
                    padding: 1rem;
                    color: #fca5a5;
                    text-align: center;
                }

                /* Responsive - Mobile */
                @media (max-width: 640px) {
                    .widget-container {
                        height: 100vh;
                        max-height: 100vh;
                        border-radius: 0;
                    }

                    .widget-main {
                        flex-direction: column;
                    }

                    .progress-sidebar {
                        width: 100%;
                        padding: 0.75rem 1rem;
                        border-right: none;
                        border-bottom: 1px solid var(--border-subtle);
                    }

                    .progress-title {
                        display: none;
                    }

                    .progress-steps {
                        flex-direction: row;
                        overflow-x: auto;
                        gap: 0.25rem;
                        -webkit-overflow-scrolling: touch;
                    }

                    .progress-step {
                        flex-direction: column;
                        padding: 0.5rem 0.75rem;
                        text-align: center;
                        min-width: 70px;
                    }

                    .step-text {
                        font-size: 0.7rem;
                        white-space: nowrap;
                    }

                    .step-indicator {
                        width: 24px;
                        height: 24px;
                        font-size: 0.7rem;
                    }

                    .message {
                        max-width: 95%;
                    }
                }
            </style>

            <div class="widget-container">
                <div class="widget-header">
                    ${config.logoUrl ? `<img src="${config.logoUrl}" alt="${config.firmName}" class="widget-logo">` : ''}
                    <span class="widget-title">${config.firmName || 'Legal Intake'}</span>
                </div>
                <div class="widget-main">
                    <div class="progress-sidebar">
                        <div class="progress-title">Your Progress</div>
                        <div class="progress-steps" id="progress-steps">
                            ${renderProgressSteps()}
                        </div>
                    </div>
                    <div class="chat-area">
                        <div class="chat-messages" id="messages"></div>
                        <div class="chat-input-area">
                            <div class="chat-input-container">
                                <input type="text" class="chat-input" id="input" placeholder="Type your message..." autocomplete="off">
                                <button class="send-button" id="send-btn">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13"></line>
                                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="powered-by">
                    Powered by <a href="https://preintake.ai" target="_blank">PreIntake.ai</a>
                </div>
            </div>
        `;

        // Attach event listeners
        const input = shadow.getElementById('input');
        const sendBtn = shadow.getElementById('send-btn');

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !isProcessing) {
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', () => {
            if (!isProcessing) sendMessage();
        });
    }

    /**
     * Render progress steps HTML
     */
    function renderProgressSteps() {
        return progressSteps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = step.completed;
            const classes = ['progress-step'];
            if (isActive) classes.push('active');
            if (isCompleted) classes.push('completed');

            return `
                <div class="${classes.join(' ')}" data-step="${step.id}">
                    <div class="step-indicator">
                        <span class="step-number">${index + 1}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <span class="step-text">${step.label}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Render error state
     */
    function renderError(message) {
        shadow.innerHTML = `
            <style>
                :host {
                    display: block;
                    padding: 2rem;
                    background: #1a1a2e;
                    border-radius: 12px;
                    text-align: center;
                    color: #fca5a5;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                }
            </style>
            <div class="error-message">${message}</div>
        `;
    }

    /**
     * Start the conversation with initial message
     */
    async function startConversation() {
        const initialMessage = { role: 'user', content: 'Hello, I need help with a legal matter.' };
        conversationHistory.push(initialMessage);
        await sendToAPI();
    }

    /**
     * Send user message
     */
    async function sendMessage() {
        const input = shadow.getElementById('input');
        const text = input.value.trim();

        if (!text || isProcessing) return;

        input.value = '';
        addMessage('user', text);

        conversationHistory.push({ role: 'user', content: text });
        await sendToAPI();
    }

    /**
     * Handle button click
     */
    function handleButtonClick(buttonText) {
        if (isProcessing) return;

        addMessage('user', buttonText);
        conversationHistory.push({ role: 'user', content: buttonText });
        sendToAPI();
    }

    /**
     * Send messages to API
     */
    async function sendToAPI() {
        if (isProcessing) return;
        isProcessing = true;

        const sendBtn = shadow.getElementById('send-btn');
        const input = shadow.getElementById('input');
        sendBtn.disabled = true;
        input.disabled = true;

        showTypingIndicator();

        try {
            const response = await fetch(CHAT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firmId,
                    sessionId,
                    messages: conversationHistory,
                }),
            });

            hideTypingIndicator();

            if (!response.ok) {
                if (response.status === 429) {
                    addMessage('assistant', 'Please wait a moment before sending another message.');
                } else {
                    throw new Error('API request failed');
                }
                return;
            }

            const data = await response.json();

            // Handle tool calls
            if (data.toolCalls && data.toolCalls.length > 0) {
                await handleToolCalls(data.toolCalls, data.content);
            } else if (data.content) {
                // Add assistant message
                conversationHistory.push({ role: 'assistant', content: data.content });
                addMessage('assistant', data.content, data.buttons);
            }

        } catch (error) {
            console.error('PreIntake Widget: API error', error);
            hideTypingIndicator();
            addMessage('assistant', 'Sorry, something went wrong. Please try again.');
        } finally {
            isProcessing = false;
            sendBtn.disabled = false;
            input.disabled = false;
            input.focus();
        }
    }

    /**
     * Handle tool calls from Claude
     */
    async function handleToolCalls(toolCalls, textContent) {
        // Build assistant message content array with text and all tool_use blocks
        const assistantContent = [];
        if (textContent) {
            assistantContent.push({ type: 'text', text: textContent });
        }

        // Build tool results array
        const toolResults = [];

        for (const tool of toolCalls) {
            // Add tool_use to assistant message
            assistantContent.push({
                type: 'tool_use',
                id: tool.id,
                name: tool.name,
                input: tool.input
            });

            // Build tool result
            toolResults.push({
                type: 'tool_result',
                tool_use_id: tool.id,
                content: 'Information recorded successfully.'
            });

            // Store collected data and update progress based on tool
            if (tool.name === 'collect_contact_info') {
                collectedData.lead = tool.input;
                advanceProgress(); // Step 1 -> 2
            } else if (tool.name === 'select_practice_area') {
                collectedData.practice_area = tool.input;
                advanceProgress();
            } else if (tool.name === 'collect_case_info' || tool.name === 'collect_incident_details') {
                collectedData.case_info = tool.input;
                advanceProgress();
            } else if (tool.name === 'collect_details' || tool.name === 'collect_injury_info') {
                collectedData.details = tool.input;
                advanceProgress();
            } else if (tool.name === 'collect_additional_info' || tool.name === 'collect_insurance_info') {
                collectedData.additional = tool.input;
                advanceProgress();
            } else if (tool.name === 'complete_intake') {
                // Intake complete - show final message and send webhook
                collectedData.assessment = tool.input;
                markAllComplete();
                await handleIntakeComplete(tool.input);
                return;
            }
        }

        // Add the complete assistant message to history
        conversationHistory.push({
            role: 'assistant',
            content: assistantContent
        });

        // Add all tool results as a single user message
        conversationHistory.push({
            role: 'user',
            content: toolResults
        });

        // Continue the conversation
        await sendToAPI();
    }

    /**
     * Advance to next progress step
     */
    function advanceProgress() {
        if (currentStep < progressSteps.length) {
            progressSteps[currentStep].completed = true;
            currentStep++;
            renderProgressUpdate();
        }
    }

    /**
     * Mark all steps as complete
     */
    function markAllComplete() {
        progressSteps.forEach(step => step.completed = true);
        currentStep = progressSteps.length;
        renderProgressUpdate();
    }

    /**
     * Re-render progress sidebar
     */
    function renderProgressUpdate() {
        const progressContainer = shadow.getElementById('progress-steps');
        if (progressContainer) {
            progressContainer.innerHTML = renderProgressSteps();
        }
    }

    /**
     * Handle intake completion
     */
    async function handleIntakeComplete(assessment) {
        const routing = assessment.routing;
        let message = '';

        if (routing === 'green') {
            message = `Thank you for sharing this information. Based on what you've told us, ${config.firmName} would like to schedule a consultation with you. Someone from our team will contact you shortly at the phone number you provided.`;
        } else if (routing === 'yellow') {
            message = `Thank you for your time. We've received your information and a member of our team will review your case and reach out to you soon.`;
        } else {
            message = `Thank you for reaching out. Based on the information provided, this may not be the right fit for our firm at this time. We recommend consulting with other legal resources in your area.`;
        }

        addMessage('assistant', message);

        // Send completion webhook
        try {
            const webhookUrl = `${API_BASE}/handleIntakeCompletion`;
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...collectedData,
                    ...assessment,
                    source: `preintake-widget-${firmId}`,
                    timestamp: new Date().toISOString(),
                }),
            });
        } catch (error) {
            console.error('PreIntake Widget: Webhook failed', error);
        }
    }

    /**
     * Add message to chat
     */
    function addMessage(role, content, buttons = []) {
        const messagesContainer = shadow.getElementById('messages');
        const initials = role === 'assistant' ? 'AI' : 'You';

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        let buttonsHtml = '';
        if (buttons && buttons.length > 0) {
            buttonsHtml = `
                <div class="response-options">
                    ${buttons.map(btn => `<button class="response-button">${btn}</button>`).join('')}
                </div>
            `;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">${initials}</div>
            <div class="message-content">
                ${content}
                ${buttonsHtml}
            </div>
        `;

        messagesContainer.appendChild(messageDiv);

        // Attach button click handlers
        if (buttons && buttons.length > 0) {
            messageDiv.querySelectorAll('.response-button').forEach(btn => {
                btn.addEventListener('click', () => handleButtonClick(btn.textContent));
            });
        }

        // Scroll to bottom
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    /**
     * Show typing indicator
     */
    function showTypingIndicator() {
        const messagesContainer = shadow.getElementById('messages');

        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant';
        typingDiv.id = 'typing';
        typingDiv.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    /**
     * Hide typing indicator
     */
    function hideTypingIndicator() {
        const typing = shadow.getElementById('typing');
        if (typing) typing.remove();
    }

    // Initialize widget
    init();

})();
