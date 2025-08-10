const admin = require("firebase-admin");
const serviceAccount = require('../secrets/serviceAccountKey.json');

// Initialize Admin SDK using credentials from secrets directory
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const uid = "a6f3b223-993b-4efd-9f62-df1961aa8f46";
const newEmail = "demo@teambuildpro.com";
const newPassword = "DemoPWD999!";

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
