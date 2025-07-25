import firebase_admin
from firebase_admin import credentials, firestore

# --- Configuration ---
# 1. Update the path to your service account key file.
#    You can download this from your Firebase project settings > Service accounts.
SERVICE_ACCOUNT_KEY_PATH = "../secrets/serviceAccountKey.json"

# 2. Specify the UID of the admin you want to exclude.
#    This script will NOT update the role for this user.
ADMIN_UID_TO_EXCLUDE = "KJ8uFnlhKhWgBa4NVcwT"
# ---------------------

def update_user_roles():
    """
    Connects to Firestore, finds all users that are not the specified admin,
    and updates their role to 'user'.
    """
    try:
        # Initialize Firebase Admin SDK
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("✅ Firebase Admin SDK initialized successfully.")

        # Get a reference to the 'users' collection
        users_ref = db.collection("users")

        # Fetch all documents from the collection
        docs = users_ref.stream()
        print("🔍 Fetching all user documents...")

        # Create a batch to perform multiple writes at once for efficiency
        batch = db.batch()
        users_to_update_count = 0

        # Loop through each document
        for doc in docs:
            # Check if the document ID is the admin UID we want to exclude
            if doc.id == ADMIN_UID_TO_EXCLUDE:
                print(f"  -> Skipping admin user: {doc.id}")
                continue

            # If the document is not the admin, add an update operation to the batch
            user_doc_ref = db.collection("users").document(doc.id)
            batch.update(user_doc_ref, {"role": "user"})
            users_to_update_count += 1
            print(f"  -> Queued for update: {doc.id}")

        # If there are users to update, commit the batch
        if users_to_update_count > 0:
            print(f"\n✨ Found {users_to_update_count} user(s) to update. Committing changes...")
            batch.commit()
            print(f"✅ Successfully updated {users_to_update_count} user documents.")
        else:
            print("\n✨ No users needed an update.")

    except FileNotFoundError:
        print(f"❌ ERROR: Service account key file not found at '{SERVICE_ACCOUNT_KEY_PATH}'.")
        print("Please download the file from your Firebase project settings and update the path.")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")

# Run the main function
if __name__ == "__main__":
    update_user_roles()
