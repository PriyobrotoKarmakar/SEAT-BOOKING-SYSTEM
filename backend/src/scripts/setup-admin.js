import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { db } from "../config/firebase.js";

const setupAdmin = async () => {
  const email = "priyobroto@gmail.com";
  const password = "123456789";
  const displayName = "Priyo ( admin )";

  try {
    console.log(`Attempting to sign in or create user: ${email}...`);

    let userCredential;
    try {
      // Try to create the user
      userCredential = await firebase
        .auth()
        .createUserWithEmailAndPassword(email, password);
      console.log("User freshly created in Firebase Auth!");
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        console.log("User already exists. Signing in...");
        userCredential = await firebase
          .auth()
          .signInWithEmailAndPassword(email, password);
      } else {
        throw error;
      }
    }

    const user = userCredential.user;

    // Update display name (profile) in Firebase Auth
    await user.updateProfile({
      displayName: displayName,
    });

    console.log(`Setting up Firestore document for UID: ${user.uid}...`);

    // Write/Update the Firestore Document
    await db.collection("users").doc(user.uid).set(
      {
        name: displayName,
        email: email,
        batch: 1, // Defaulting to 1
        squad: 1, // Defaulting to 1
        isAdmin: true,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );

    console.log("\n=============================");
    console.log("✅ Admin User Successfully Configured!");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log("Role: Master Admin");
    console.log("=============================\n");

    process.exit(0);
  } catch (e) {
    console.error("❌ Error setting up admin user:", e);
    process.exit(1);
  }
};

setupAdmin();
