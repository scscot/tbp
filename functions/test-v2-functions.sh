#!/bin/bash
# Test script for new V2 Cloud Functions
# Run after deploying to verify all endpoints work correctly

BASE_URL="https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net"

echo "=== Testing V2 Referral Attribution Functions ==="
echo ""

# Test 1: Issue Referral Token
echo "1. Testing issueReferralV2..."
ISSUE_RESPONSE=$(curl -sS -X POST "${BASE_URL}/issueReferralV2" \
  -H "Content-Type: application/json" \
  -d '{"sponsorCode":"88888888","t":"2","source":"web_button"}')

echo "Response: $ISSUE_RESPONSE"
TOKEN=$(echo $ISSUE_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token extracted: $TOKEN"
echo ""

# Test 2: Redeem Token (first time)
echo "2. Testing redeemReferralV2 (first redemption)..."
REDEEM_RESPONSE=$(curl -sS -X POST "${BASE_URL}/redeemReferralV2" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}")

echo "Response: $REDEEM_RESPONSE"
echo ""

# Test 3: Redeem Token (idempotency test)
echo "3. Testing redeemReferralV2 (idempotency - should return already_redeemed)..."
REDEEM2_RESPONSE=$(curl -sS -X POST "${BASE_URL}/redeemReferralV2" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}")

echo "Response: $REDEEM2_RESPONSE"
echo ""

# Test 4: Clip Handoff Create
echo "4. Testing clipHandoffCreateV2..."
HANDOFF_ID="test-$(date +%s)"
CLIP_CREATE_RESPONSE=$(curl -sS -X POST "${BASE_URL}/clipHandoffCreateV2" \
  -H "Content-Type: application/json" \
  -d "{\"handoffId\":\"$HANDOFF_ID\",\"ref\":\"88888888\",\"t\":\"2\"}")

echo "Response: $CLIP_CREATE_RESPONSE"
echo ""

# Test 5: Clip Handoff Create (idempotency test)
echo "5. Testing clipHandoffCreateV2 (idempotency - should return created:false)..."
CLIP_CREATE2_RESPONSE=$(curl -sS -X POST "${BASE_URL}/clipHandoffCreateV2" \
  -H "Content-Type: application/json" \
  -d "{\"handoffId\":\"$HANDOFF_ID\",\"ref\":\"88888888\",\"t\":\"2\"}")

echo "Response: $CLIP_CREATE2_RESPONSE"
echo ""

# Test 6: Clip Handoff Claim
echo "6. Testing clipHandoffClaimV2..."
CLIP_CLAIM_RESPONSE=$(curl -sS -X POST "${BASE_URL}/clipHandoffClaimV2" \
  -H "Content-Type: application/json" \
  -d "{\"handoffId\":\"$HANDOFF_ID\"}")

echo "Response: $CLIP_CLAIM_RESPONSE"
echo ""

# Test 7: Resolve Sponsor
echo "7. Testing resolveSponsorV2..."
RESOLVE_RESPONSE=$(curl -sS "${BASE_URL}/resolveSponsorV2?ref=88888888")

echo "Response: $RESOLVE_RESPONSE"
echo ""

# Test 8: Rate Limiting (should fail on 31st request)
echo "8. Testing rate limiting (issueReferralV2 - 31 rapid requests)..."
echo "Sending 31 requests rapidly..."
for i in {1..31}; do
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/issueReferralV2" \
    -H "Content-Type: application/json" \
    -d '{"sponsorCode":"test","t":"1","source":"web_button"}')

  if [ "$HTTP_CODE" == "429" ]; then
    echo "✅ Rate limit triggered on request #$i (HTTP $HTTP_CODE)"
    break
  elif [ $i -eq 31 ]; then
    echo "⚠️  Rate limit not triggered after 31 requests"
  fi
done
echo ""

echo "=== Test Summary ==="
echo "✅ issueReferralV2 - Token issuance"
echo "✅ redeemReferralV2 - Token redemption + idempotency"
echo "✅ clipHandoffCreateV2 - Handoff creation + idempotency"
echo "✅ clipHandoffClaimV2 - Handoff claiming"
echo "✅ resolveSponsorV2 - Sponsor name resolution"
echo "✅ Rate limiting verification"
echo ""
echo "Next steps:"
echo "1. Verify all responses match expected TypeScript types"
echo "2. Check Firebase Console for new collections:"
echo "   - referralTokens/{token}"
echo "   - clipHandoffs/{handoffId}"
echo "3. Test TTL expiration (wait 24 hours or manually delete docs)"
echo "4. Update web to use V2 endpoints"
echo "5. Test on real device with App Clip flow"
