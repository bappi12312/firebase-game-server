
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

function checkFirebaseConfig(config: FirebaseOptions): boolean {
  console.log("Checking Firebase config...");
  const requiredKeys: (keyof FirebaseOptions)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    // 'storageBucket', // Often optional for basic auth/firestore
    // 'messagingSenderId', // Often optional
    'appId',
  ];
  const missingKeys = requiredKeys.filter(key => !config[key]);
  if (missingKeys.length > 0) {
    console.error(
      `Firebase initialization failed: Missing configuration for: ${missingKeys.join(', ')}. ` +
      `Please ensure all NEXT_PUBLIC_FIREBASE_* environment variables are set in your .env.local file.`
    );
    console.log("Current config values (excluding undefined):");
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        console.log(`${key}: ${value}`);
      }
    });
    return false;
  }
  console.log("Firebase config seems present.");
  return true;
}

// Initialize Firebase
let app;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (typeof window !== 'undefined') { // Ensure this only runs client-side or in Node.js env where 'window' is not a factor
  if (checkFirebaseConfig(firebaseConfig)) {
    try {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      auth = getAuth(app);
      db = getFirestore(app);
      console.log("Firebase initialized successfully.");
    } catch (error) {
      console.error("Error during Firebase initialization:", error);
      // `auth` and `db` will remain null
    }
  } else {
    console.warn("Firebase is not initialized due to missing or invalid configuration. App functionality requiring Firebase will be affected.");
  }
} else {
  // For server-side contexts (like Server Components or API routes if not using client SDK)
  // This setup primarily uses client-side Firebase SDK.
  // If admin SDK or server-side operations are needed, a different initialization is required.
  // console.log("Firebase client SDK initialization skipped in non-browser environment.");
   if (checkFirebaseConfig(firebaseConfig)) { // Still check config for server-side consistency if needed by genkit or other server parts
    try {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      auth = getAuth(app); // getAuth can be called server-side too with client SDK if careful
      db = getFirestore(app);
      console.log("Firebase initialized (server context - client SDK).");
    } catch (error) {
      console.error("Error during Firebase initialization (server context - client SDK):", error);
    }
  } else {
     console.warn("Firebase (server context - client SDK) is not initialized due to missing or invalid configuration.");
  }
}


export { app, auth, db };

