#!/bin/bash

# run_migration.sh
# Script to execute the profile completion migration using Firebase CLI

echo "🚀 Starting profile completion migration..."
echo "📋 This will update all user documents with the isProfileComplete flag"
echo ""

# Check if Firebase CLI is available
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please run:"
    echo "   firebase login"
    exit 1
fi

echo "✅ Firebase CLI found and user is logged in"
echo ""

# Call the migration function
echo "📞 Calling migrateProfileCompletion function..."
firebase functions:shell --project=teambuilder-plus-fe74d << 'EOF'
migrateProfileCompletion().then(result => {
  console.log('🎉 Migration Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}).catch(error => {
  console.error('❌ Migration Error:', error);
  process.exit(1);
});
EOF

echo ""
echo "✅ Migration script completed!"
