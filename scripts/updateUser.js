const admin = require("firebase-admin");
const serviceAccount = require('../secrets/serviceAccountKey.json');

// Initialize Admin SDK using credentials from secrets directory
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const uid = "qzvHp5bIjvTEniYuds544aHLNE93";
const newEmail = null; // Don't change email
const newPassword = "DemoPWD999!";

const updateData = { password: newPassword };
if (newEmail) updateData.email = newEmail;

admin.auth().updateUser(uid, updateData)
    .then(userRecord => {
        console.log("Successfully updated user:", userRecord.uid);
    })
    .catch(error => {
        console.error("Error updating user:", error);
    });
