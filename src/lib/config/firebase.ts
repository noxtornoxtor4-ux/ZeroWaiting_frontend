import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { env } from '$env/dynamic/public';

const firebaseConfig = {
	apiKey: env.PUBLIC_FIREBASE_API_KEY,
	authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: env.PUBLIC_FIREBASE_APP_ID
};

let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;

export const getFirebaseAuth = () => {
	if (!app) {
		app = initializeApp(firebaseConfig);
		auth = getAuth(app);
		googleProvider = new GoogleAuthProvider();
	}
	return { auth, googleProvider };
};
