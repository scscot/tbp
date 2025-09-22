Firestore Database Indexes Required for Optimal Performance

CRITICAL: These indexes must be created in the Firebase Console for optimal query performance.
Without these indexes, queries will be slow and may fail at scale.

Collection: users
Required Composite Indexes:

1. Network Count Queries (functions/index.js line 2234-2242)
   Fields:
   - upline_refs (Array)
   - createdAt (Ascending)
   Query: For counting new team members in time periods

   Firebase Console Command:
   Create composite index for collection 'users':
   - upline_refs: Array
   - createdAt: Ascending

2. Qualified Members Query (functions/index.js line 2239)
   Fields:
   - upline_refs (Array)
   - qualifiedDate (Ascending)
   Query: For counting newly qualified team members

   Firebase Console Command:
   Create composite index for collection 'users':
   - upline_refs: Array
   - qualifiedDate: Ascending

3. Business Opportunity Joins Query (functions/index.js line 2240)
   Fields:
   - upline_refs (Array)
   - biz_join_date (Ascending)
   Query: For counting team members who joined business opportunity

   Firebase Console Command:
   Create composite index for collection 'users':
   - upline_refs: Array
   - biz_join_date: Ascending

4. Direct Sponsors Query (functions/index.js line 2242)
   Fields:
   - sponsor_id (Ascending)
   Query: For counting direct sponsors (single field, may auto-create)

   Firebase Console Command:
   Create single field index for collection 'users':
   - sponsor_id: Ascending

5. Filtered Network with Time Sorting (functions/index.js line 2326-2354)
   Fields:
   - upline_refs (Array)
   - createdAt (Descending)
   Query: For paginated team member lists sorted by join date

   Firebase Console Command:
   Create composite index for collection 'users':
   - upline_refs: Array
   - createdAt: Descending

6. Business Opportunity Joins with Date Sorting (functions/index.js line 2349-2351)
   Fields:
   - upline_refs (Array)
   - biz_join_date (Descending)
   Query: For team members who joined opportunity, sorted by join date

   Firebase Console Command:
   Create composite index for collection 'users':
   - upline_refs: Array
   - biz_join_date: Descending

7. Referral Code Lookup (functions/index.js line 2001)
   Fields:
   - referralCode (Ascending)
   Query: For finding sponsors by referral code (single field, likely auto-created)

   Firebase Console Command:
   Create single field index for collection 'users':
   - referralCode: Ascending

Collection: chats
Required Indexes:

8. Chat Participants Query (functions/index.js line 2213-2215)
   Fields:
   - participants (Array)
   Query: For finding chats by participant

   Firebase Console Command:
   Create single field index for collection 'chats':
   - participants: Array

IMPLEMENTATION STEPS:

1. Go to Firebase Console > Firestore Database > Indexes
2. Click "Create Index" for each composite index above
3. For single field indexes, go to "Single field" tab
4. Monitor index creation status (can take several minutes for large datasets)
5. Test queries after indexes are built

PERFORMANCE IMPACT:
- Without indexes: Queries may timeout or fail
- With indexes: 10-100x faster query performance
- Cost reduction: Significantly lower read costs

MAINTENANCE:
- Indexes are automatically maintained by Firebase
- No manual updates required
- Monitor usage in Firebase Console