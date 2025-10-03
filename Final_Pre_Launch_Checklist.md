# Final Pre-Launch Checklist: Team Build Pro Referral System

## Overview
This comprehensive checklist ensures all components of the referral tracking system are production-ready before launch. Complete ALL items before deploying to production.

---

## ✅ Phase 1: AASA Configuration (CRITICAL)

### Primary Domain (teambuildpro.com)
- [ ] **AASA file syntax verified** - Uses `"query"` not `"?"`
- [ ] **Both bundle IDs included** - Current + future iPhone-only bundle
- [ ] **File uploaded to primary location** - `/.well-known/apple-app-site-association`
- [ ] **File uploaded to fallback location** - `/apple-app-site-association`
- [ ] **HTTP headers correct** - `Content-Type: application/json`
- [ ] **No redirects** - Direct file access, no 301/302 responses
- [ ] **HTTPS accessible** - Valid SSL certificate, no mixed content
- [ ] **File size under 128KB** - Current: ~200 bytes

### Branch Custom Domain (go.teambuildpro.com)
- [ ] **AASA file uploaded** - Both bundle IDs included
- [ ] **Permissive pattern confirmed** - `"/*"` for Branch flexibility
- [ ] **Same deployment requirements** - Headers, HTTPS, no redirects
- [ ] **Branch dashboard configured** - Custom domain active

### Validation Commands
```bash
# Execute these commands and verify results
curl -I https://teambuildpro.com/.well-known/apple-app-site-association    # Status: 200, Content-Type: application/json
curl -I https://go.teambuildpro.com/.well-known/apple-app-site-association # Status: 200, Content-Type: application/json
curl -s https://teambuildpro.com/.well-known/apple-app-site-association | jq .  # Valid JSON
xcrun simctl openurl booted "https://teambuildpro.com/?ref=88888888&t=1"  # Opens app in simulator
```

---

## ✅ Phase 2: iOS App Configuration

### Xcode Associated Domains
- [ ] **All three domains added** in Signing & Capabilities:
  - [ ] `applinks:teambuildpro.com`
  - [ ] `applinks:teambuildpro.app.link`
  - [ ] `applinks:go.teambuildpro.com`
- [ ] **Provisioning profile updated** - Includes Associated Domains capability
- [ ] **Release build tested** - Universal Links work in release mode
- [ ] **App Store build ready** - No debug/development configurations

### Branch SDK Integration
- [ ] **Branch key configuration** - Production keys active
- [ ] **Initialization order correct** - Branch before AppLinks
- [ ] **Session listener active** - Handles deferred deep links
- [ ] **Error handling implemented** - Graceful fallbacks for failures
- [ ] **Debug logging present** - Emoji-tagged logs for troubleshooting

### Flutter Analyze Status
```bash
flutter analyze  # Must show: "No issues found!"
```
- [ ] **Zero analyzer warnings** - Clean code quality
- [ ] **All imports resolved** - No missing dependencies
- [ ] **Async contexts correct** - Branch listener is async

---

## ✅ Phase 3: Website Integration

### Smart App Banner
- [ ] **Meta tag activated** - No longer commented out
- [ ] **Correct App Store ID** - `app-id=6751211622`
- [ ] **Dynamic JavaScript functional** - Updates app-argument with referral codes
- [ ] **URL parameter handling** - Supports `?ref=`, `?new=`, and `&t=`
- [ ] **Console logging active** - Shows banner configuration in dev tools

### Test Smart App Banner
```bash
# Navigate to these URLs in iOS Safari and verify Smart App Banner appears
https://teambuildpro.com/?ref=88888888&t=1
https://teambuildpro.com/?new=99999999&t=2
https://teambuildpro.com/  # Should show basic banner without app-argument
```

### Website Accessibility
- [ ] **Production domain accessible** - No staging/development URLs
- [ ] **SSL certificate valid** - No security warnings
- [ ] **CDN configuration** - Proper caching for AASA files
- [ ] **Load balancer ready** - Can handle launch traffic

---

## ✅ Phase 4: Referral System Testing

### Test Scenario Execution
Execute ALL 11 test scenarios from `test_referral_tracking.md`:

- [ ] **Scenario 1**: Direct Universal Link (Immediate)
- [ ] **Scenario 2**: Branch Deferred Deep Link (App Store Install)
- [ ] **Scenario 3**: App Store Direct Link (Fallback)
- [ ] **Scenario 4**: Branch Link with App Installed (Immediate)
- [ ] **Scenario 5**: First Launch from Home Screen (Deferred)
- [ ] **Scenario 6**: Cold Start Attribution Test
- [ ] **Scenario 7**: Sponsor Overwrite Protection Test
- [ ] **Scenario 8**: Smart App Banner Web-to-App Flow
- [ ] **Scenario 9**: Enhanced Sponsor Overwrite Protection
- [ ] **Scenario 10**: Referral Source Attribution Validation
- [ ] **Scenario 11**: Web-to-App Fallback Chain Test

### Critical Test Requirements
- [ ] **Physical iOS devices used** - NOT simulators for deferred deep links
- [ ] **Multiple iOS versions tested** - iOS 14, 15, 16, 17+
- [ ] **Clean app installs** - Delete app between tests
- [ ] **Network connectivity stable** - Required for attribution
- [ ] **Branch dashboard monitoring** - Real-time event tracking

### Expected Results Documentation
- [ ] **All logs captured** - Screenshot or copy relevant debug output
- [ ] **Attribution chain verified** - Source tracking accurate
- [ ] **Sponsor names resolved** - HTTP fallback working
- [ ] **Overwrite protection functional** - Dialogs appear when expected
- [ ] **No false positives** - Generic installs show no referral data

---

## ✅ Phase 5: Fraud Prevention & Security

### Fraud Detection System
- [ ] **Self-referral detection active** - Cloud Function logic deployed
- [ ] **TTL caching implemented** - 24-hour expiry on cached codes
- [ ] **Device fingerprinting basic** - IP and user-agent tracking
- [ ] **Audit logging functional** - All overwrite decisions logged
- [ ] **Firestore security rules** - Fraud flags admin-only access

### Security Verification
- [ ] **No exposed credentials** - All API keys properly secured
- [ ] **Firestore rules tested** - User data properly isolated
- [ ] **HTTPS enforced** - No mixed content warnings
- [ ] **Input validation active** - Referral codes sanitized
- [ ] **Rate limiting configured** - Protection against abuse

---

## ✅ Phase 6: Monitoring & Analytics

### Launch Monitoring Setup
- [ ] **7-day dashboard configured** - All queries tested
- [ ] **Alert thresholds set** - Critical metrics monitored
- [ ] **Firebase Analytics active** - Custom events logging
- [ ] **Branch dashboard access** - Real-time attribution tracking
- [ ] **Error reporting enabled** - Crashlytics or equivalent

### Support Documentation
- [ ] **Customer support guide deployed** - Team trained on referral system
- [ ] **Internal documentation complete** - Technical team reference ready
- [ ] **Escalation procedures defined** - Clear contact paths for issues
- [ ] **FAQ responses prepared** - Common user questions addressed

---

## ✅ Phase 7: Production Deployment

### Deployment Sequence
1. [ ] **AASA files deployed first** - Both domains, both locations
2. [ ] **Website updated** - Smart App Banner activated
3. [ ] **CDN cache cleared** - Fresh AASA files served
4. [ ] **App Store submission** - Include Associated Domains
5. [ ] **Branch configuration live** - Production keys active

### Post-Deployment Validation
```bash
# Execute immediately after deployment
curl -I https://teambuildpro.com/.well-known/apple-app-site-association
curl -I https://go.teambuildpro.com/.well-known/apple-app-site-association
curl -s https://teambuildpro.com/?ref=TEST123 | grep "apple-itunes-app"
```

### Real-Time Monitoring
- [ ] **First 2 hours**: Check every 30 minutes
- [ ] **First 24 hours**: Check every 2 hours
- [ ] **First week**: Daily comprehensive review
- [ ] **Branch events visible** - Real-time attribution tracking
- [ ] **Firebase Analytics active** - Custom events flowing

---

## ✅ Phase 8: Team Readiness

### Technical Team
- [ ] **On-call rotation defined** - 24/7 coverage for launch week
- [ ] **Rollback procedures tested** - Can restore previous configuration
- [ ] **Branch support contact** - Direct escalation path available
- [ ] **Apple developer support** - Technical incident contacts ready

### Customer Support Team
- [ ] **Support guide reviewed** - All team members trained
- [ ] **Common scenarios practiced** - Role-playing referral issues
- [ ] **Escalation paths clear** - When to involve technical team
- [ ] **FAQ responses ready** - Standard answers for users

### Business Team
- [ ] **Launch campaign ready** - Referral links prepared
- [ ] **Influencer outreach** - Custom referral codes assigned
- [ ] **Success metrics defined** - Attribution targets set
- [ ] **Communication plan** - User education on referral system

---

## 🚨 Launch Day Checklist

### T-24 Hours Before Launch
- [ ] **Final test suite execution** - All 11 scenarios passed
- [ ] **AASA files verified live** - Both domains accessible
- [ ] **Monitoring dashboards active** - All alerts configured
- [ ] **Team communication channels** - Slack/Discord ready

### Launch Hour (T-0)
- [ ] **App Store approval received** - Release version live
- [ ] **Branch dashboard monitoring** - Real-time events visible
- [ ] **First user attribution test** - Verify end-to-end flow
- [ ] **Support team notified** - Launch officially active

### T+1 Hour Post Launch
- [ ] **Attribution metrics review** - Initial success rates
- [ ] **Error rate check** - Any unexpected failures
- [ ] **User feedback monitoring** - Social media and support channels
- [ ] **Branch analytics review** - Click/install/open funnel

---

## 🎯 Success Criteria

### Technical Metrics (Week 1)
- [ ] **Universal Link Success**: >95%
- [ ] **Branch Attribution**: >85%
- [ ] **Sponsor Name Resolution**: >98%
- [ ] **Smart App Banner CTR**: >15%
- [ ] **System Uptime**: >99.9%

### User Experience Metrics
- [ ] **Overwrite Dialog Acceptance**: 50-70%
- [ ] **Support Tickets**: <5% related to referral issues
- [ ] **User Satisfaction**: No major complaints
- [ ] **Fraud Detection**: <1% false positives

### Business Metrics
- [ ] **Referral Adoption**: >60% of installs attributed
- [ ] **Viral Coefficient**: Track invitation effectiveness
- [ ] **Sponsor Engagement**: Monitor sharing behavior
- [ ] **Revenue Attribution**: Track subscription conversions

---

## ⚠️ Red Flags (Stop Launch)

Do NOT proceed with launch if ANY of these conditions exist:

- [ ] **AASA files return 404 or wrong Content-Type**
- [ ] **Universal Links fail on any test device**
- [ ] **Branch dashboard shows API errors**
- [ ] **Flutter analyze shows any errors**
- [ ] **Smart App Banner not appearing on iOS Safari**
- [ ] **Test scenarios failing >10% of attempts**
- [ ] **Fraud detection system not functional**
- [ ] **Support team not trained on referral system**

---

## ✅ Final Approval Sign-Off

### Technical Lead
- [ ] **All technical requirements verified**
- [ ] **Code quality standards met**
- [ ] **Security requirements satisfied**
- Signature: _________________ Date: _______

### Product Manager
- [ ] **User experience requirements met**
- [ ] **Business logic verified**
- [ ] **Success metrics defined**
- Signature: _________________ Date: _______

### DevOps/Infrastructure
- [ ] **Deployment procedures ready**
- [ ] **Monitoring systems active**
- [ ] **Rollback procedures tested**
- Signature: _________________ Date: _______

### Customer Support Lead
- [ ] **Team training completed**
- [ ] **Documentation reviewed**
- [ ] **Escalation procedures understood**
- Signature: _________________ Date: _______

---

**🚀 GO/NO-GO DECISION**

Based on completion of ALL checklist items above:

**DECISION**: [ ] GO FOR LAUNCH  [ ] NO-GO (list blocking issues)

**Date**: _________________ **Time**: _________________

**Approved by**: _________________________________

---

*This checklist represents the culmination of comprehensive Branch SDK integration work. Every item is critical for launch success. Do not skip or postpone any requirements.*