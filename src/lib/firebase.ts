
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth, GoogleAuthProvider } from 'firebase/auth'; // Added GoogleAuthProvider
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage'; // Added for Firebase Storage

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
  // console.log("Checking Firebase config...");
  const requiredKeys: (keyof FirebaseOptions)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket', // Now required for file uploads
    'appId',
  ];
  const missingKeys = requiredKeys.filter(key => !config[key]);
  if (missingKeys.length > 0) {
    console.error(
      `Firebase initialization failed: Missing configuration for: ${missingKeys.join(', ')}. ` +
      `Please ensure all NEXT_PUBLIC_FIREBASE_* environment variables are set in your .env.local file.`
    );
    // console.log("Current config values (excluding undefined):");
    // Object.entries(config).forEach(([key, value]) => {
    //   if (value !== undefined) {
    //     console.log(`${key}: ${value}`);
    //   }
    // });
    return false;
  }
  // console.log("Firebase config seems present.");
  return true;
}

// Initialize Firebase
let app;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null; // Added storage

if (typeof window !== 'undefined') { 
  if (checkFirebaseConfig(firebaseConfig)) {
    try {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      auth = getAuth(app);
      db = getFirestore(app);
      storage = getStorage(app); // Initialize storage
      // console.log("Firebase initialized successfully (client-side).");
    } catch (error) {
      console.error("Error during Firebase initialization (client-side):", error);
    }
  } else {
    console.warn("Firebase is not initialized (client-side) due to missing or invalid configuration. App functionality requiring Firebase will be affected.");
  }
} else {
   if (checkFirebaseConfig(firebaseConfig)) { 
    try {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      auth = getAuth(app); 
      db = getFirestore(app);
      storage = getStorage(app); // Initialize storage for server contexts if needed (e.g. Genkit flows)
      // console.log("Firebase initialized (server context - client SDK).");
    } catch (error) {
      console.error("Error during Firebase initialization (server context - client SDK):", error);
    }
  } else {
     console.warn("Firebase (server context - client SDK) is not initialized due to missing or invalid configuration.");
  }
}

const googleProvider = auth ? new GoogleAuthProvider() : null;

export { app, auth, db, storage, googleProvider }; // Export storage and googleProvider
