const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const OpenAI = require('openai');

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

// Simple RAG implementation for FAQ retrieval
class SimpleRAG {
  constructor() {
    this.faqData = null;
  }

  async loadFAQ() {
    if (this.faqData) return this.faqData;

    // Load from Firestore collection
    const snapshot = await admin.firestore().collection('faq').get();
    this.faqData = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return this.faqData;
  }

  async getRagSnippets(query, k = 3) {
    const faqs = await this.loadFAQ();
    const queryLower = query.toLowerCase();

    // Simple keyword matching with scoring
    const scored = faqs.map((faq) => {
      let score = 0;
      const searchText =
        `${faq.question} ${faq.answer} ${faq.keywords?.join(' ') || ''}`.toLowerCase();

      // Keyword matching score
      const queryWords = queryLower.split(/\s+/);
      queryWords.forEach((word) => {
        if (word.length > 2 && searchText.includes(word)) {
          score += searchText.split(word).length - 1;
        }
      });

      return { ...faq, score };
    });

    // Return top-k, sanitized to plain text
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .filter((item) => item.score > 0)
      .map((item) => ({
        id: item.id,
        text: `Q: ${item.question}\nA: ${item.answer.replace(/[[\]()]/g, '')}`, // Strip markdown links
      }));
  }
}

const ragEngine = new SimpleRAG();

// Enhanced usage tracking with hourly and daily limits
async function checkUsageLimits(userId) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  const hourKey = `${today}_${currentHour}`;

  // Check daily limits
  const dailyDoc = await admin
    .firestore()
    .collection('chat_usage')
    .doc(`${userId}_daily_${today}`)
    .get();

  const dailyData = dailyDoc.exists ? dailyDoc.data() : { messagesCount: 0, tokensUsed: 0 };

  // Check hourly limits
  const hourlyDoc = await admin
    .firestore()
    .collection('chat_usage')
    .doc(`${userId}_hourly_${hourKey}`)
    .get();

  const hourlyData = hourlyDoc.exists ? hourlyDoc.data() : { messagesCount: 0, tokensUsed: 0 };

  // Usage limits
  const DAILY_MESSAGE_LIMIT = 50; // 50 messages per day
  const HOURLY_MESSAGE_LIMIT = 10; // 10 messages per hour
  const DAILY_TOKEN_LIMIT = 25000; // 25k tokens per day

  if (dailyData.messagesCount >= DAILY_MESSAGE_LIMIT) {
    throw new Error('Daily message limit reached. Try again tomorrow.');
  }

  if (hourlyData.messagesCount >= HOURLY_MESSAGE_LIMIT) {
    throw new Error('Hourly message limit reached. Please wait and try again.');
  }

  if (dailyData.tokensUsed >= DAILY_TOKEN_LIMIT) {
    throw new Error('Daily usage limit reached. Try again tomorrow.');
  }

  return { dailyData, hourlyData, today, hourKey };
}

async function updateUsage(userId, tokensUsed, today, hourKey) {
  const batch = admin.firestore().batch();

  // Update daily usage
  const dailyRef = admin.firestore().collection('chat_usage').doc(`${userId}_daily_${today}`);
  batch.set(
    dailyRef,
    {
      messagesCount: admin.firestore.FieldValue.increment(1),
      tokensUsed: admin.firestore.FieldValue.increment(tokensUsed),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Update hourly usage
  const hourlyRef = admin.firestore().collection('chat_usage').doc(`${userId}_hourly_${hourKey}`);
  batch.set(
    hourlyRef,
    {
      messagesCount: admin.firestore.FieldValue.increment(1),
      tokensUsed: admin.firestore.FieldValue.increment(tokensUsed),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}

function buildUserContext(userData) {
  return {
    directSponsors: userData.directSponsorCount || 0,
    totalTeam: userData.totalTeamCount || 0,
    isQualified: !!userData.qualifiedDate,
    accountAgeDays: userData.createdDate
      ? Math.floor((Date.now() - userData.createdDate.toMillis()) / 86400000)
      : null,
    subscriptionStatus: userData.subscriptionStatus || 'free',
    lastActiveDate: userData.lastActiveDate?.toDate?.()?.toISOString?.()?.split('T')[0] || null,
  };
}

function buildSystemPrompt() {
  return `You are the Team Build Pro Assistant, a specialized coach ONLY for Team Build Pro app users.

STRICT BOUNDARIES - YOU MUST REFUSE:
❌ General life advice, homework help, coding questions
❌ Information about other companies, apps, or opportunities  
❌ Personal finance advice not related to Team Build Pro
❌ Any topic outside of Team Build Pro app functionality
❌ Income claims, earnings promises, or financial projections
❌ Personal information about team members

YOU ONLY HELP WITH:
✅ Team Build Pro app features and navigation
✅ Understanding the qualification system (4 direct + 20 total)
✅ Team building strategies within the app
✅ App troubleshooting and technical issues
✅ Explaining why Team Build Pro is NOT an MLM
✅ Subscription and billing questions

IF REQUEST IS OFF-TOPIC:
Respond: "I can only help with Team Build Pro app questions. For other topics, please use general search engines or ask elsewhere. What can I help you with regarding the Team Build Pro app?"

RESPONSE FORMAT:
- For app questions: Provide helpful answer based on FAQ snippets
- For navigation suggestions: End your response with ONLY the JSON on a new line: {"action": {"route": "/tab", "params": {}}}
- For off-topic: Politely redirect to Team Build Pro topics

CRITICAL: When including navigation JSON, put it on a separate line at the very end, NOT embedded in sentences.

AVAILABLE APP TABS:
- /team: Team tab - view your team, network data, and member progress (tab index 1)
- /grow: Grow tab - share app, invite people, team building tools (tab index 2)  
- /messages: Messages tab - communicate with team members (tab index 3)
- /dashboard: Dashboard tab - home screen with overview (tab index 0)

ROUTE ACTION RULES:
- When mentioning viewing team, checking progress, or team data: END with {"action": {"route": "/team", "params": {}}}
- When mentioning sharing, inviting, or growing team: END with {"action": {"route": "/grow", "params": {}}}
- When mentioning messages or communication: END with {"action": {"route": "/messages", "params": {}}}
- When mentioning dashboard or overview: END with {"action": {"route": "/dashboard", "params": {}}}

EXAMPLE CORRECT FORMAT:
"Use the app analytics to track your team's progress and identify areas for improvement.

{"action": {"route": "/team", "params": {}}}"

EXAMPLE WRONG FORMAT:
"Visit the Team tab. {"action": {"route": "/team", "params": {}}}"

CONTEXT: Team Build Pro is a SaaS tool ($6.99/month) that helps professionals build teams BEFORE joining business opportunities. It's NOT an MLM - users pay us, we don't pay them.`;
}

exports.chatbot = onRequest(
  {
    region: 'us-central1',
    minInstances: 1,
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    try {
      const { message, userId, threadId } = req.body || {};

      if (!userId || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check usage limits
      const {
        dailyData: _dailyData,
        hourlyData: _hourlyData,
        today,
        hourKey,
      } = await checkUsageLimits(userId);

      // Get user context
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const userContext = buildUserContext(userData);

      // Retrieve FAQ snippets
      const snippets = await ragEngine.getRagSnippets(message, 3);

      // Build conversation context
      const systemPrompt = buildSystemPrompt();
      const userPrompt = [
        `User message: ${message}`,
        `User context: ${JSON.stringify(userContext)}`,
        `Relevant FAQ snippets:`,
        ...snippets.map((s, i) => `[${i + 1}] ${s.text}`),
        ``,
        `Provide a helpful response. If suggesting an app action, include JSON route.`,
      ].join('\n');

      // Initialize OpenAI
      const openai = new OpenAI({
        apiKey: OPENAI_API_KEY.value(),
      });

      // Setup streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let totalTokens = 0;
      let responseText = '';

      try {
        const stream = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: true,
          max_tokens: 500,
          temperature: 0.7,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            responseText += content;
            res.write(`data: ${JSON.stringify({ type: 'content', data: content })}\n\n`);
          }
        }

        // Estimate token usage (rough approximation)
        totalTokens = Math.ceil(
          (systemPrompt.length + userPrompt.length + responseText.length) / 4
        );

        // Send completion signal
        res.write(`data: ${JSON.stringify({ type: 'done', tokens: totalTokens })}\n\n`);

        // Update usage tracking
        await updateUsage(userId, totalTokens, today, hourKey);

        // Log interaction
        await admin
          .firestore()
          .collection('chat_logs')
          .add({
            userId,
            threadId: threadId || 'default',
            message: message.substring(0, 200), // Truncate for privacy
            responseLength: responseText.length,
            tokensUsed: totalTokens,
            snippetIds: snippets.map((s) => s.id),
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userContext: {
              directSponsors: userContext.directSponsors,
              totalTeam: userContext.totalTeam,
              isQualified: userContext.isQualified,
            },
          });
      } catch (openaiError) {
        console.error('OpenAI Error:', openaiError);
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: 'Sorry, I encountered an error. Please try again.' })}\n\n`
        );
      }

      res.end();
    } catch (error) {
      console.error('Chatbot Error:', error);

      if (error.message.includes('limit')) {
        return res.status(429).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);
