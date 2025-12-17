/**
 * Script Generator Cloud Functions
 * Provides Claude API proxy for the free AI script generator tool
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const Anthropic = require('@anthropic-ai/sdk');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

// Rate limiting configuration
const IP_DAILY_LIMIT = 20; // Max requests per IP per day
const RATE_LIMIT_COLLECTION = 'scriptGeneratorRateLimits';

// Define the secret for the API key
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// Scenario configurations
const SCENARIOS = {
  'cold-outreach': {
    name: 'Cold Outreach',
    description: 'Initial message to someone you don\'t know well',
    instruction: 'Write a warm, non-pushy cold outreach message that piques curiosity without being salesy.',
  },
  'warm-market': {
    name: 'Warm Market',
    description: 'Message to a friend or family member',
    instruction: 'Write a natural message to a friend or family member that feels authentic and not like a sales pitch.',
  },
  'follow-up': {
    name: 'Follow-Up',
    description: 'Following up with someone who showed interest',
    instruction: 'Write a friendly follow-up message that adds value and gently moves the conversation forward.',
  },
  'objection-time': {
    name: 'Objection: No Time',
    description: 'Response to "I don\'t have time"',
    instruction: 'Write a response that acknowledges their time concerns and shows how this can actually save time or be done flexibly.',
  },
  'objection-money': {
    name: 'Objection: No Money',
    description: 'Response to "I don\'t have money to invest"',
    instruction: 'Write a response that addresses financial concerns without being pushy, showing low barrier to entry.',
  },
  'objection-mlm': {
    name: 'Objection: Is This MLM?',
    description: 'Response to "Is this one of those MLM things?"',
    instruction: 'Write an honest, transparent response that doesn\'t dodge the question but reframes the conversation positively.',
  },
  'objection-tried': {
    name: 'Objection: Tried Before',
    description: 'Response to "I\'ve tried this before and it didn\'t work"',
    instruction: 'Write a response that validates their past experience while showing what\'s different this time.',
  },
  'reconnect': {
    name: 'Re-Engage',
    description: 'Reaching out to an old contact',
    instruction: 'Write a natural reconnection message that doesn\'t immediately go into business talk.',
  },
};

// Tone configurations
const TONES = {
  'friendly': 'Use a warm, casual, and friendly tone like texting a good friend.',
  'professional': 'Use a professional but approachable tone suitable for business contexts.',
  'curious': 'Use a curiosity-building tone with intriguing questions.',
  'story': 'Lead with a brief personal story or example before the ask.',
};

/**
 * Generate a recruiting script using Claude API
 */
const generateRecruitingScript = onRequest(
  {
    secrets: [anthropicApiKey],
    cors: true,
    memory: '256MiB',
    timeoutSeconds: 60,
    maxInstances: 10,
  },
  async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      // Server-side IP rate limiting
      const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                       req.headers['x-real-ip'] ||
                       req.connection?.remoteAddress ||
                       'unknown';

      // Hash the IP for privacy (simple hash)
      const ipHash = Buffer.from(clientIP).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const rateLimitDocId = `${ipHash}_${today}`;

      const db = getFirestore();
      const rateLimitRef = db.collection(RATE_LIMIT_COLLECTION).doc(rateLimitDocId);
      const rateLimitDoc = await rateLimitRef.get();

      if (rateLimitDoc.exists) {
        const data = rateLimitDoc.data();
        if (data.count >= IP_DAILY_LIMIT) {
          res.status(429).json({
            error: 'Daily limit reached. Please try again tomorrow.',
            retryAfter: 'tomorrow'
          });
          return;
        }
      }

      const { company, scenario, tone = 'friendly' } = req.body;

      // Validate required fields
      if (!company || !scenario) {
        res.status(400).json({ error: 'Missing required fields: company and scenario' });
        return;
      }

      // Validate scenario
      if (!SCENARIOS[scenario]) {
        res.status(400).json({ error: 'Invalid scenario type' });
        return;
      }

      // Validate tone
      if (!TONES[tone]) {
        res.status(400).json({ error: 'Invalid tone type' });
        return;
      }

      const scenarioConfig = SCENARIOS[scenario];
      const toneInstruction = TONES[tone];

      // Build the prompt with company-specific knowledge
      const prompt = `You are an expert direct sales recruiter helping someone with their ${company} business.

IMPORTANT: Use your knowledge about ${company} to make this message specific and authentic. Consider:
- What products or services does ${company} offer?
- Who is their ideal customer or target market?
- What makes ${company} unique in their industry?
- What's the company culture or community like?

If you know specific details about ${company} (their flagship products, wellness/beauty/financial focus, founding story, etc.), weave those naturally into the message to make it feel authentic and knowledgeable.

If you're not familiar with ${company}, write a professional message that could apply to any quality direct sales company without making up specific details.

Scenario: ${scenarioConfig.name}
${scenarioConfig.instruction}

Tone: ${toneInstruction}

Requirements:
- Keep the message to 3-5 sentences maximum
- Be authentic and warm, never pushy or salesy
- Don't use exclamation marks excessively
- End with a soft call to action or open-ended question
- Don't mention specific compensation or income claims
- Don't use phrases like "life-changing" or "ground floor opportunity"
- Sound like a real person texting, not a marketing template
- If referencing products, mention real ${company} products you're confident about

Generate only the message text, no quotes or explanations.`;

      // Call Claude API
      const anthropic = new Anthropic({
        apiKey: anthropicApiKey.value(),
      });

      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract the text from the response
      const scriptText = message.content[0].text.trim();

      // Log company usage and increment rate limit (non-blocking)
      try {
        const companyKey = company.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // Increment IP rate limit
        await rateLimitRef.set({
          count: FieldValue.increment(1),
          lastRequest: FieldValue.serverTimestamp(),
          date: today,
        }, { merge: true });

        // Log company usage
        await db.collection('scriptGeneratorStats').doc('companyUsage').set({
          [companyKey]: FieldValue.increment(1),
          _lastUpdated: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error('Failed to log usage:', logError);
      }

      res.status(200).json({
        script: scriptText,
        scenario: scenarioConfig.name,
        company: company,
      });

    } catch (error) {
      console.error('Error generating script:', error);

      // Handle specific error types
      if (error.status === 401) {
        res.status(500).json({ error: 'API configuration error' });
      } else if (error.status === 429) {
        res.status(429).json({ error: 'Too many requests. Please try again in a moment.' });
      } else {
        res.status(500).json({ error: 'Failed to generate script. Please try again.' });
      }
    }
  }
);

module.exports = {
  generateRecruitingScript,
};
