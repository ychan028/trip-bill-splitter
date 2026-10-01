import type { FirebaseOptions } from "firebase/app";

// From Firebase console → Project settings → Your apps → Web app.
// These values are not secrets; access is controlled by firestore.rules.
// Set to null to run in local-only mode (data stays on one device).
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: "AIzaSyB9uVqL1XIYcaLAbVUS-u5bYU1fcoNP-Lg",
  authDomain: "trip-bill-splitter.firebaseapp.com",
  projectId: "trip-bill-splitter",
  storageBucket: "trip-bill-splitter.firebasestorage.app",
  messagingSenderId: "713604014453",
  appId: "1:713604014453:web:60dd647bbd36b04f95333c",
};
