const admin = require("firebase-admin");
const serviceAccount = require('../secrets/serviceAccountKey.json');

// Initialize Admin SDK using credentials from secrets directory
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const uid = "KJ8uFnlhKhWgBa4NVcwT";
const newEmail = "scscot@gmail.com";
const newPassword = "11111111";

admin.auth().updateUser(uid, {
    email: newEmail,
    password: newPassword
})
    .then(userRecord => {
        console.log("Successfully updated user:", userRecord.uid);
    })
    .catch(error => {
        console.error("Error updating user:", error);
    });
