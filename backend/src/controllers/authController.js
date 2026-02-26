import { db } from "../config/firebase.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;



    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

  
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("email", "==", email).limit(1).get();

    if (snapshot.empty) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

  
    if (userData.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.status(200).json({
      message: "Login successful",
      user: {
        uid: userDoc.id,
        name: userData.name,
        email: userData.email,
        batch: userData.batch,
        squad: userData.squad,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const signup = async (req, res) => {
  try {
    const { name, email, password, batch, squad } = req.body;

    if (!name || !email || !password || !batch || !squad) {
      return res.status(400).json({ error: "All fields are required" });
    }

   
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("email", "==", email).get();

    if (!snapshot.empty) {
      return res.status(400).json({ error: "User already exists" });
    }

   
    const newUser = {
      name,
      email,
      password, 
      batch: parseInt(batch),
      squad: parseInt(squad),
      createdAt: new Date().toISOString(),
    };

    const docRef = await usersRef.add(newUser);

    res.status(201).json({
      message: "User created successfully",
      user: {
        uid: docRef.id,
        ...newUser,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { uid, name, batch, squad } = req.body;

    if (!uid) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (batch) updateData.batch = parseInt(batch);
    if (squad) updateData.squad = parseInt(squad);

    await userRef.update(updateData);

   
    const updatedDoc = await userRef.get();
    const userData = updatedDoc.data();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        uid: updatedDoc.id,
        name: userData.name,
        email: userData.email,
        batch: userData.batch,
        squad: userData.squad,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
