
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
  const requiredKeys: (keyof FirebaseOptions)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];
  const missingKeys = requiredKeys.filter(key => !config[key]);
  if (missingKeys.length > 0) {
    console.error(
      `Firebase initialization failed: Missing configuration for: ${missingKeys.join(', ')}. ` +
      `Please ensure all NEXT_PUBLIC_FIREBASE_* environment variables are set in your .env file.`
    );
    return false;
  }
  return true;
}

// Initialize Firebase
let app;
let auth;
let db;

if (checkFirebaseConfig(firebaseConfig)) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // Fallback or error state if config is invalid
  // This prevents the app from crashing hard if config is missing
  // You might want to throw an error in development or handle this more gracefully
  console.warn("Firebase is not initialized due to missing configuration. Some features may not work.");
  // Mock auth and db if needed for the app to not crash, though functionality will be broken
  // For example:
  // auth = {} as any; // Or a more sophisticated mock
  // db = {} as any;
}


export { app, auth, db };
