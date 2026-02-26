import { db } from '../config/firebase.js';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // In a real app, use Firebase Auth or bcrypt for password hashing
    // For this prototype, we'll simluate login by checking the 'users' collection
    // or just return success if user exists.
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Mock search for user by email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Mock password validaton (DO NOT USE IN PRODUCTION)
    if (userData.password !== password) {
       return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(200).json({ 
      message: 'Login successful',
      user: {
        uid: userDoc.id,
        name: userData.name,
        email: userData.email,
        batch: userData.batch,
        squad: userData.squad
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const signup = async (req, res) => {
  try {
    const { name, email, password, batch, squad } = req.body;
    
    if (!name || !email || !password || !batch || !squad) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (!snapshot.empty) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    const newUser = {
      name,
      email,
      password, // Note: Hash this in production!
      batch: parseInt(batch),
      squad: parseInt(squad),
      createdAt: new Date().toISOString()
    };

    const docRef = await usersRef.add(newUser);

    res.status(201).json({ 
      message: 'User created successfully',
      user: {
        uid: docRef.id,
        ...newUser
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
