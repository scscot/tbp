# Deploy Firestore Rules - Fix Permission Error

## The Issue

You're getting this error because the updated Firestore rules haven't been deployed to Firebase yet:
```
FirebaseError: [code=permission-denied]: Missing or insufficient permissions.
```

## Solution: Deploy the Updated Rules

### Step 1: Deploy the Rules

**From your project directory, run:**
```bash
firebase deploy --only firestore:rules
```

**Expected Output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/teambuilder-plus-fe74d/overview
```

### Step 2: Verify Deployment

1. **Go to Firebase Console**: https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/rules
2. **Check the Rules Tab**: You should see your updated rules
3. **Check the timestamp**: Should show recent deployment time

### Step 3: Test Your Website

**Visit your website with a referral code:**
```
https://www.teambuildpro.com/?ref=88888888
```

**Expected Results:**
- ✅ No permission errors in console
- ✅ User name displays in the invite section
- ✅ Smart App Banner works correctly

## Alternative: Deploy via Firebase Console

If the CLI doesn't work, you can deploy via the web console:

1. **Go to**: https://console.firebase.google.com/project/teambuilder-plus-fe74d/firestore/rules
2. **Click "Edit Rules"**
3. **Copy and paste the entire content from your `firestore.rules` file**
4. **Click "Publish"**

## Updated Rules Summary

Your new rules allow:

✅ **Unauthenticated users** can:
- Read user documents (for referral lookups)
- Query users by referralCode (for website functionality)

✅ **Authenticated users** can:
- Access their own data
- Access network/team data based on existing relationships
- Use all existing app functionality

✅ **Security maintained**:
- Write operations still require authentication
- Admin settings have appropriate restrictions
- Chat system remains secure

## Troubleshooting

### If you still get permission errors after deployment:

1. **Clear browser cache** (hard refresh: Ctrl+Shift+R)
2. **Wait 1-2 minutes** for rules to propagate globally
3. **Check Firebase Console** to confirm rules are deployed
4. **Test with a different browser** to rule out caching issues

### If deployment fails:

1. **Check your Firebase CLI is logged in:**
   ```bash
   firebase login
   ```

2. **Verify you're in the right project:**
   ```bash
   firebase use --list
   ```

3. **Make sure you're in the project directory** (where `firebase.json` is located)

## Test Commands

After deployment, you can test the rules work by visiting:

```bash
# Test with referral code
https://www.teambuildpro.com/?ref=88888888

# Test without referral code  
https://www.teambuildpro.com/
```

Both should work without permission errors.

## Next Steps After Successful Deployment

1. ✅ Confirm referral functionality works
2. ✅ Test your mobile app still works normally
3. ✅ Replace `YOUR_APP_ID` with your actual App Store ID
4. ✅ Test Smart App Banner on iOS Safari device

The permission error will be resolved once these rules are deployed to Firebase.
