import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCFMmGO_esS2jbODxS3z-C7QebRtj4FzQk",
  authDomain: "efi-volt.firebaseapp.com",
  projectId: "efi-volt",
  storageBucket: "efi-volt.firebasestorage.app",
  messagingSenderId: "954519542514",
  appId: "1:954519542514:web:8f1a22ae4111ab4dfcce6b",
  measurementId: "G-TF99LG01NL"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Exporta para usarlo en otros archivos
export { auth, provider, signInWithPopup };
