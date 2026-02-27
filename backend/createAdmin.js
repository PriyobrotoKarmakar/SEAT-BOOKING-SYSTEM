import { db } from "./src/config/firebase.js";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";

const createAdmin = async () => {
  try {
    const auth = firebase.auth();
    const usersRef = db.collection("users");
    const email = "priyobroto@gmail.com";
    const password = "123456789";

    const adminData = {
      name: "Priyo ( admin )",
      email: email,
      password: password,
      batch: 1,
      squad: 1,
      isAdmin: true,
      createdAt: new Date().toISOString(),
    };

    let userUid;

    // Try to register the user in Firebase Auth
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(
        email,
        password,
      );
      userUid = userCredential.user.uid; //for the user 
      console.log(`Successfully created Firebase Auth user: ${userUid}`);
    } catch (authErr) {
      if (authErr.code === "auth/email-already-in-use") {
        console.log(
          "Firebase Auth user already exists. Attempting login to get UID...",
        );
        const userCredential = await auth.signInWithEmailAndPassword(
          email,
          password,
        );
        userUid = userCredential.user.uid;
      } else {
        throw authErr;
      }
    }

    // Now upsert the Firestore Document
    const snapshot = await usersRef.where("email", "==", email).get();

    if (!snapshot.empty) {
      console.log("Firestore User doc already exists. Updating to Admin...");
      // In case they exist in Firestore under a different UID
      const docId = snapshot.docs[0].id;
      await usersRef.doc(docId).update(adminData);
      console.log(
        `Successfully updated existing Firestore user ${docId} to Admin!`,
      );
    } else {
      console.log("Creating new Firestore Admin user doc...");
      await usersRef.doc(userUid).set(adminData);
      console.log(
        `Successfully created new Firestore Admin doc with ID: ${userUid}`,
      );
    }
  } catch (error) {
    console.error("Error creating/updating admin:", error);
  } finally {
    process.exit(0);
  }
};

createAdmin();
