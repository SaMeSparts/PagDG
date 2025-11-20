import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getDatabase } from "firebase/database"; // <--- IMPORTANTE 1

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCFMmGO_esS2jbODxS3z-C7QebRtj4FzQk",
  authDomain: "efi-volt.firebaseapp.com",
  // --- IMPORTANTE 2: Añadimos la URL de la base de datos en tiempo real ---
  databaseURL: "https://efi-volt-default-rtdb.firebaseio.com", 
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
const database = getDatabase(app); // <--- IMPORTANTE 3: Inicializamos la RTDB

// Exporta para usarlo en otros archivos
export { auth, provider, signInWithPopup, database };