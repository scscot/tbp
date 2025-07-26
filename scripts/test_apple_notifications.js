const axios = require('axios');

// Your Firebase Functions endpoint
const FIREBASE_FUNCTION_URL = 'https://us-central1-teambuilder-plus-fe74d.cloudfunctions.net/handleAppleSubscriptionNotification';

// Test notification payloads that Apple would send
const testNotifications = {
    initialBuy: {
        notification_type: 'INITIAL_BUY',
        latest_receipt_info: [{
            original_transaction_id: 'test_transaction_12345',
            product_id: 'monthly_subscription',
            purchase_date_ms: Date.now().toString(),
            expires_date_ms: (Date.now() + (30 * 24 * 60 * 60 * 1000)).toString(), // 30 days from now
            is_trial_period: 'false',
            is_in_intro_offer_period: 'false'
        }],
        unified_receipt: {
            latest_receipt_info: [{
                original_transaction_id: 'test_transaction_12345',
                product_id: 'monthly_subscription'
            }]
        }
    },

    didRenew: {
        notification_type: 'DID_RENEW',
        latest_receipt_info: [{
            original_transaction_id: 'test_transaction_12345',
            product_id: 'monthly_subscription',
            purchase_date_ms: Date.now().toString(),
            expires_date_ms: (Date.now() + (30 * 24 * 60 * 60 * 1000)).toString(),
            is_trial_period: 'false'
        }]
    },

    cancel: {
        notification_type: 'CANCEL',
        latest_receipt_info: [{
            original_transaction_id: 'test_transaction_12345',
            product_id: 'monthly_subscription',
            cancellation_date_ms: Date.now().toString(),
            expires_date_ms: (Date.now() + (7 * 24 * 60 * 60 * 1000)).toString() // Still valid for 7 days
        }]
    },

    didFailToRenew: {
        notification_type: 'DID_FAIL_TO_RENEW',
        latest_receipt_info: [{
            original_transaction_id: 'test_transaction_12345',
            product_id: 'monthly_subscription',
            expires_date_ms: (Date.now() - (24 * 60 * 60 * 1000)).toString(), // Expired yesterday
            is_in_billing_retry_period: 'true'
        }]
    }
};

async function testNotification(type, payload) {
    console.log(`\n🧪 Testing ${type} notification...`);
    console.log(`📤 Payload being sent:`, JSON.stringify(payload, null, 2));

    try {
        const response = await axios.post(FIREBASE_FUNCTION_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'App Store Server Notification'
            },
            timeout: 10000
        });

        console.log(`✅ ${type}: Status ${response.status}`);
        console.log(`📝 Response: ${response.data}`);
    } catch (error) {
        console.log(`❌ ${type}: Error - ${error.message}`);
        if (error.response) {
            console.log(`📝 Response Status: ${error.response.status}`);
            console.log(`📝 Response Data: ${JSON.stringify(error.response.data)}`);
        }
    }
}

async function runAllTests() {
    console.log('🚀 Starting Apple Subscription Notification Tests...');

    // Test each notification type
    await testNotification('INITIAL_BUY', testNotifications.initialBuy);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

    await testNotification('DID_RENEW', testNotifications.didRenew);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testNotification('CANCEL', testNotifications.cancel);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await testNotification('DID_FAIL_TO_RENEW', testNotifications.didFailToRenew);

    console.log('\n🏁 All tests completed!');
}

// Run the tests
runAllTests();