// 1. IMPORTAR ESTILOS
import './style.css';

// 2. IMPORTAR FUNCIONES DE FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// CAMBIO: Añadir 'doc' y 'deleteDoc'
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 3. CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCFMmGO_esS2jbODxS3z-C7QebRtj4FzQk",
  authDomain: "efi-volt.firebaseapp.com",
  projectId: "efi-volt",
  storageBucket: "efi-volt.firebasestorage.app",
  messagingSenderId: "954519542514",
  appId: "1:954519542514:web:8f1a22ae4111ab4dfcce6b",
  measurementId: "G-TF99LG01NL"
};

// 4. INICIALIZAR FIREBASE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 5. CÓDIGO PRINCIPAL
document.addEventListener('DOMContentLoaded', () => {
  
  // --- LÓGICA DEL SIDEBAR (MENÚ) ---
  const openBtn = document.getElementById('open-sidebar-btn');
  const closeBtn = document.getElementById('close-sidebar-btn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');

  function openSidebar() {
    if (sidebar && overlay) {
      sidebar.classList.remove('translate-x-full');
      sidebar.classList.add('translate-x-0');
      overlay.classList.remove('hidden');
    }
  }

  function closeSidebar() {
    if (sidebar && overlay) {
      sidebar.classList.remove('translate-x-0');
      sidebar.classList.add('translate-x-full');
      overlay.classList.add('hidden');
    }
  }

  if (openBtn) openBtn.addEventListener('click', openSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // --- LÓGICA DE CAMBIO DE PÁGINA ---
  const navLinks = document.querySelectorAll('.nav-link');
  const contentSections = document.querySelectorAll('.page-content');

  function showPage(targetId) {
    contentSections.forEach(section => section.classList.add('hidden'));
    const targetPage = document.getElementById(targetId);
    if (targetPage) targetPage.classList.remove('hidden');
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault(); 
      const targetId = event.currentTarget.dataset.target;
      if (targetId) showPage(targetId);
      closeSidebar();
    });
  });

  // Mostrar la página de Dispositivos por defecto al cargar
  showPage('page-dispositivos');

  // 6. LÓGICA DE AUTENTICACIÓN Y BASE DE DATOS
  
  // --- Sección de Autenticación (Página 3: Ajustes) ---
  const loginSection = document.getElementById('login-section');
  const userInfoSection = document.getElementById('user-info-section');
  const btnLogin = document.getElementById('btn-login-google');
  const btnLogout = document.getElementById('btn-logout');
  const userEmailDisplay = document.getElementById('user-email-display');

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Usuario conectado:", user.email);
      if (loginSection) loginSection.classList.add('hidden');
      if (userInfoSection) userInfoSection.classList.remove('hidden');
      if (userEmailDisplay) userEmailDisplay.textContent = user.email;
      loadUserDevices(user.uid); 
    } else {
      console.log("Usuario desconectado.");
      if (loginSection) loginSection.classList.remove('hidden');
      if (userInfoSection) userInfoSection.classList.add('hidden');
      clearDevicesDisplay(); 
    }
  });

  if (btnLogin) {
    btnLogin.addEventListener('click', () => {
      const provider = new GoogleAuthProvider();
      signInWithPopup(auth, provider)
        .catch((error) => console.error("Error en login:", error));
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      signOut(auth)
        .catch((error) => console.error("Error al cerrar sesión:", error));
    });
  }

  // --- Sección de Base de Datos (Página 2: Dispositivos) ---
  const btnAddDevice = document.getElementById('btn-add-device'); 
  const devicesGrid = document.getElementById('devices-grid');

  // Evento para AÑADIR DISPOSITIVO
  if (btnAddDevice) {
    btnAddDevice.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) {
        console.warn("Usuario no conectado. Redirigiendo a Ajustes.");
        showPage('page-ajustes'); 
        return;
      }

      const deviceName = prompt("Introduce un nombre para el dispositivo:", "Luz Sala");
      
      if (deviceName && deviceName.trim() !== "") {
        try {
          await addDoc(collection(db, "devices"), {
            name: deviceName,
            type: "light",
            ownerUserId: user.uid
          });
          console.log("Dispositivo añadido");
        } catch (e) {
          console.error("Error al añadir documento: ", e);
        }
      }
    });
  } else {
    console.warn("El botón 'btn-add-device' no se encontró. Revisa tu index.html.");
  }
  
  // --- INICIO DE NUEVA LÓGICA DE BORRADO ---
  
  // Evento para ELIMINAR DISPOSITIVO (usando delegación de eventos)
  if (devicesGrid) {
    devicesGrid.addEventListener('click', async (event) => {
      // 1. Comprobar si se hizo clic en un botón de eliminar
      const deleteButton = event.target.closest('.btn-delete-device');
      
      if (!deleteButton) {
        return; // No se hizo clic en un botón de eliminar
      }
      
      // 2. Encontrar la tarjeta padre para obtener el ID del documento
      const card = deleteButton.closest('.device-card');
      const docId = card ? card.dataset.docId : null;
      
      if (docId) {
        // 3. Llamar a Firestore para eliminar el documento
        console.log("Eliminando dispositivo:", docId);
        try {
          await deleteDoc(doc(db, "devices", docId));
          console.log("Dispositivo eliminado con éxito");
          // No es necesario remover el HTML, onSnapshot se encargará
          // de actualizar la UI automáticamente.
        } catch (e) {
          console.error("Error al eliminar el documento: ", e);
        }
      }
    });
  }
  // --- FIN DE NUEVA LÓGICA DE BORRADO ---


  // Función para CARGAR dispositivos
  function loadUserDevices(userId) {
    if (!devicesGrid) {
        console.warn("El contenedor 'devices-grid' no se encontró. No se pueden cargar dispositivos.");
        return;
    }
    const q = query(collection(db, "devices"), where("ownerUserId", "==", userId));
    
    onSnapshot(q, (querySnapshot) => {
      clearDevicesDisplay(); 
      querySnapshot.forEach((doc) => {
        const device = doc.data();
        // CAMBIO: Pasar el ID del documento a la función de crear tarjeta
        createDeviceCard(device.name, doc.id); 
      });
    }, (error) => {
        console.error("Error al cargar dispositivos: ", error);
    });
  }

  // CAMBIO: La función ahora acepta docId y crea un <div> con botón de borrado
  function createDeviceCard(name, docId) {
    if (!devicesGrid || !btnAddDevice) return;
    
    // Ahora creamos un <div> en lugar de un <button>
    // Añadimos 'data-doc-id' para guardar el ID de Firebase
    // Añadimos un botón de borrado con la clase 'btn-delete-device'
    const cardHTML = `
      <div data-doc-id="${docId}" class="device-card relative flex flex-col items-center justify-center p-4 text-gray-800 bg-white border border-gray-200 rounded-lg shadow-md aspect-square transition-colors">
        
        <!-- Botón de Eliminar -->
        <button class="btn-delete-device absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 rounded-full transition-colors z-10">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <!-- Contenido de la tarjeta (el ícono) -->
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m12.728 0l-.707.707M12 21v-1m-6.657-3.343l.707-.707m12.728 0l.707.707" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 18a6 6 0 100-12 6 6 0 000 12z" />
        </svg>
        <span class="mt-2 text-sm font-semibold font-roboto">${name}</span>
      </div>
    `;
    btnAddDevice.insertAdjacentHTML('beforebegin', cardHTML);
  }

  // CAMBIO: Ahora busca '.device-card' para limpiar
  function clearDevicesDisplay() {
    if (!devicesGrid) return;
    // Selecciona todas las tarjetas de dispositivo generadas
    const cards = devicesGrid.querySelectorAll('.device-card'); 
    cards.forEach(card => card.remove());
  }

});