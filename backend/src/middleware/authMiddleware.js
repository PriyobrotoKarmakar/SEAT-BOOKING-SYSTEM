import dotenv from 'dotenv';
dotenv.config();

/**
 * Verifies a Firebase ID token using the Firebase REST API.
 * No service account key required — uses the Web API key.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!response.ok) {
      throw new Error('Token verification failed');
    }

    const data = await response.json();

    if (!data.users || data.users.length === 0) {
      throw new Error('User not found');
    }

    // Attach verified user info to request
    req.user = {
      uid: data.users[0].localId,
      email: data.users[0].email,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export default authMiddleware;
