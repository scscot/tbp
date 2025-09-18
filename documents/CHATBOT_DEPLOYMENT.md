# Team Build Pro Chatbot - Deployment Guide

## 🚀 Pre-Deployment Checklist

### Prerequisites
- [ ] Firebase project with existing Team Build Pro setup
- [ ] Firebase CLI installed and authenticated
- [ ] Node.js 20+ installed for Cloud Functions
- [ ] OpenAI API account and key
- [ ] Flutter development environment setup

### Required Dependencies
```yaml
# Add to pubspec.yaml dependencies:
http: ^1.1.0  # For streaming HTTP requests (if not already present)
```

```json
// Add to functions/package.json dependencies:
"openai": "^4.20.0"
```

## 📋 Step-by-Step Deployment

### Phase 1: Cloud Function Setup (Week 1)

#### 1.1 Install Dependencies
```bash
cd functions/
npm install openai
```

#### 1.2 Configure OpenAI Secret
```bash
# Set up the OpenAI API key as a Firebase secret
firebase functions:secrets:set OPENAI_API_KEY
# When prompted, enter your OpenAI API key
```

#### 1.3 Update functions/index.js
Add to your existing `functions/index.js`:
```javascript
// Add at the top of your exports
const chatbot = require('./chatbot');
exports.chatbot = chatbot.chatbot;
```

#### 1.4 Setup FAQ Data
```bash
# Initialize FAQ collection in Firestore
cd functions/
node -e "
const admin = require('firebase-admin');
admin.initializeApp();
const { setupFAQ } = require('./setup_faq');
setupFAQ();
"
```

#### 1.5 Deploy Cloud Function
```bash
firebase deploy --only functions:chatbot
```

#### 1.6 Get Function URL
After deployment, note the function URL (will look like):
```
https://chatbot-xxxxx-uc.a.run.app
```

### Phase 2: Flutter Integration (Week 2)

#### 2.1 Update Service URL
In `lib/services/chatbot_service.dart`, update line 8:
```dart
static const String _baseUrl = 'YOUR_ACTUAL_FUNCTION_URL_HERE';
```

#### 2.2 Add Route Configuration
In your main route configuration file, add:
```dart
'/chatbot': (context) => const ChatBotScreen(),
```

#### 2.3 Test Integration
```bash
flutter run --debug
# Test the AI Coach card from dashboard
```

### Phase 3: Production Configuration (Week 3-4)

#### 3.1 Firebase Security Rules
Add to `firestore.rules`:
```javascript
// FAQ collection - read-only for all authenticated users
match /faq/{document} {
  allow read: if request.auth != null;
  allow write: if false; // Only admins can modify via Cloud Functions
}

// Chat budgets - users can only read their own
match /chat_budgets/{document} {
  allow read, write: if request.auth != null && 
    document.matches(request.auth.uid + '_.*');
}

// Chat logs - no direct client access
match /chat_logs/{document} {
  allow read, write: if false; // Only Cloud Functions can access
}
```

#### 3.2 Performance Optimization
Enable Cloud Function minimum instances:
```javascript
// Already configured in chatbot.js with minInstances: 1
```

#### 3.3 Monitoring Setup
1. Enable Firebase Analytics for chatbot usage:
```dart
// Add to chatbot_screen.dart initState():
FirebaseAnalytics.instance.logScreenView(screenName: 'chatbot_screen');
```

2. Enable Function logs monitoring:
```bash
firebase functions:log --only chatbot
```

## 🔧 Configuration Options

### OpenAI Model Configuration
In `functions/chatbot.js`, adjust these settings:
```javascript
const stream = await openai.chat.completions.create({
  model: 'gpt-4',           // Use 'gpt-3.5-turbo' for lower costs
  max_tokens: 500,          // Adjust response length
  temperature: 0.7,         // Creativity level (0.0-1.0)
  // ... other settings
});
```

### Token Budget Configuration
In `functions/chatbot.js`, adjust limits:
```javascript
const dailyLimit = 50000; // 50k tokens per day per user
// In checkTokenBudget function
```

### FAQ Content Management
Update FAQ content by modifying `functions/setup_faq.js` and running:
```bash
node -e "
const admin = require('firebase-admin');
admin.initializeApp();
const { setupFAQ } = require('./setup_faq');
setupFAQ();
"
```

## 🔒 Security Configuration

### API Key Protection
- ✅ OpenAI key stored as Firebase secret (not in code)
- ✅ Function access restricted to authenticated users
- ✅ Daily token limits prevent abuse
- ✅ User context limited to safe fields only

### Privacy Settings
- ✅ No personal team member data in AI prompts
- ✅ Conversation logs limited to essential fields
- ✅ Local chat history encrypted
- ✅ GDPR compliance ready

## 📊 Monitoring & Analytics

### Key Metrics to Track
1. **Usage Metrics**:
   - Daily active chatbot users
   - Average messages per session
   - Most common questions

2. **Performance Metrics**:
   - Response time (target: < 3 seconds)
   - Error rate (target: < 1%)
   - Token usage per user

3. **Business Impact**:
   - Support ticket reduction
   - Feature discovery rate
   - User retention improvement

### Setting Up Dashboards
1. **Firebase Console**: Monitor function invocations and errors
2. **OpenAI Usage Dashboard**: Track API costs and usage
3. **Analytics**: Create custom events for chatbot interactions

## 🐛 Troubleshooting Guide

### Common Issues

#### "Function not found" Error
```bash
# Ensure function is properly deployed
firebase deploy --only functions:chatbot
# Check Firebase Functions dashboard for deployment status
```

#### "Daily token limit exceeded"
- Check user's token usage in Firestore `chat_budgets` collection
- Adjust daily limits in `functions/chatbot.js` if needed
- Users can wait until next day or limits reset

#### Streaming Not Working
- Verify CORS headers in function response
- Check network connectivity
- Test with simple HTTP client first

#### FAQ Answers Not Relevant
- Check FAQ data quality in Firestore
- Improve keyword matching in `getRagSnippets`
- Add more FAQ entries for common questions

#### High Costs
- Monitor OpenAI usage dashboard
- Consider switching to `gpt-3.5-turbo`
- Implement more aggressive caching
- Reduce `max_tokens` limit

### Debug Commands
```bash
# View function logs
firebase functions:log --only chatbot --limit 50

# Test function locally
firebase emulators:start --only functions

# Check Firestore FAQ data
# (Use Firebase console to browse /faq collection)
```

## 💰 Cost Estimation

### OpenAI API Costs (Estimated)
- **GPT-4**: ~$0.03 per response (500 tokens)
- **GPT-3.5-turbo**: ~$0.002 per response (500 tokens)

### Example Monthly Costs
**Scenario**: 1000 active users, 5 messages/user/month
- **GPT-4**: 5000 messages × $0.03 = $150/month
- **GPT-3.5-turbo**: 5000 messages × $0.002 = $10/month

### Firebase Costs
- Cloud Functions: ~$0.40 per 1M invocations
- Firestore: Minimal (small documents, cached reads)

## 🔄 Rollout Strategy

### Phase 1: Limited Beta (5% users)
```javascript
// Add to chatbot function for gradual rollout
const rolloutPercentage = 5; // 5% of users
const userHash = hash(userId) % 100;
if (userHash >= rolloutPercentage) {
  return res.status(403).json({ error: 'Feature not available' });
}
```

### Phase 2: Expanded Beta (50% users)
- Monitor performance and costs
- Gather user feedback
- Refine FAQ responses

### Phase 3: Full Release (100% users)
- Complete monitoring setup
- Optimize for scale
- Document lessons learned

## ✅ Post-Deployment Checklist

### Week 1 After Launch
- [ ] Monitor error rates daily
- [ ] Check token usage and costs
- [ ] Review user feedback
- [ ] Test all quick start prompts

### Month 1 After Launch
- [ ] Analyze most common questions
- [ ] Update FAQ based on real usage
- [ ] Measure impact on support tickets
- [ ] Optimize response quality

### Quarterly Reviews
- [ ] Cost analysis and optimization
- [ ] Feature usage analytics
- [ ] User satisfaction surveys
- [ ] Technical debt assessment

## 🆘 Emergency Procedures

### If Costs Spike Unexpectedly
1. Disable function: `firebase functions:config:unset chatbot`
2. Investigate usage patterns in logs
3. Implement additional rate limiting
4. Re-deploy with fixes

### If Function Goes Down
1. Check Firebase Console for errors
2. Review recent deployments
3. Rollback if needed: `firebase functions:delete chatbot`
4. Redeploy working version

### If Users Report Poor Responses
1. Check FAQ data quality
2. Review recent conversation logs
3. Adjust prompt engineering
4. Update RAG retrieval logic

---

## 📞 Support Contacts

- **Firebase Issues**: Firebase Console Support
- **OpenAI Issues**: OpenAI API Support 
- **Flutter Issues**: Team Build Pro Development Team

---

**Last Updated**: September 2025  
**Version**: 1.0  
**Next Review**: Post-Launch Week 1

---

*This deployment guide follows Joe's production-focused recommendations and includes all necessary security, monitoring, and cost controls for a successful chatbot launch.*