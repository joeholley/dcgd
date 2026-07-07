import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

const defaultConfig = {
  projectId: 'demo-project',
  appId: '1:000000000:web:000000000',
  apiKey: 'PLACEHOLDER_KEY',
  authDomain: 'demo-project.firebaseapp.com',
  firestoreDatabaseId: '(default)'
};

let firebaseConfig = defaultConfig;
let isUsingFirebaseMock = true;

try {
  const modules = import.meta.glob('../../firebase-applet-config.json', { eager: true });
  const custom = (modules['../../firebase-applet-config.json'] || modules['/firebase-applet-config.json']) as any;
  if (custom && custom.default && custom.default.apiKey && custom.default.apiKey !== 'PLACEHOLDER_KEY' && !custom.default.apiKey.includes('YOUR_')) {
    firebaseConfig = custom.default;
    isUsingFirebaseMock = false;
  }
} catch {
  isUsingFirebaseMock = true;
}

export { isUsingFirebaseMock };

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);

// Connectivity check as per Firebase skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error.message?.includes('the client is offline')) {
      console.error("Firebase connection test failed: client is offline.");
    }
  }
}

if (!isUsingFirebaseMock) {
  testConnection();
}


