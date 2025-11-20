// 1. IMPORTAR ESTILOS
import "./style.css";

// 2. IMPORTAR FIREBASE
// NOTA: Asegúrate de haber actualizado también tu archivo firebase.js para exportar 'database'
import { auth, provider, signInWithPopup, database } from "./firebase.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
// Importamos las herramientas para la Base de Datos en Tiempo Real
import { ref, onValue } from "firebase/database";

// 3. INICIALIZAR FIRESTORE (Para guardar los dispositivos)
const db = getFirestore();

// 4. CÓDIGO PRINCIPAL
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Cargado. App iniciada ✔");

  let currentUser = null;

  // --- SIDEBAR (MENÚ LATERAL) ---
  const openBtn = document.getElementById("open-sidebar-btn");
  const closeBtn = document.getElementById("close-sidebar-btn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  function openSidebar() {
    sidebar?.classList.remove("translate-x-full");
    sidebar?.classList.add("translate-x-0");
    overlay?.classList.remove("hidden");
  }

  function closeSidebar() {
    sidebar?.classList.add("translate-x-full");
    overlay?.classList.add("hidden");
  }

  openBtn?.addEventListener("click", openSidebar);
  closeBtn?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);

  // --- CAMBIO DE PÁGINAS (NAVEGACIÓN) ---
  const navLinks = document.querySelectorAll(".nav-link");
  const contentSections = document.querySelectorAll(".page-content");

  const loginSection = document.getElementById("login-section");
  const userInfoSection = document.getElementById("user-info-section");
  const userEmailDisplay = document.getElementById("user-email-display");

  function showPage(id) {
    contentSections.forEach((s) => s.classList.add("hidden"));
    document.getElementById(id)?.classList.remove("hidden");
  }

  function updateAjustesUI(user) {
    if (user) {
      loginSection?.classList.add("hidden");
      userInfoSection?.classList.remove("hidden");
      userEmailDisplay.textContent = user.email;
    } else {
      loginSection?.classList.remove("hidden");
      userInfoSection?.classList.add("hidden");
    }
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = event.currentTarget.dataset.target;
      if (targetId) {
        showPage(targetId);
        if (targetId === "page-ajustes") updateAjustesUI(currentUser);
      }
      closeSidebar();
    });
  });

  // Página inicial por defecto
  showPage("page-dispositivos");

  // --- AUTENTICACIÓN (GOOGLE) ---
  const btnLogin = document.getElementById("btn-login-google");
  const btnLogout = document.getElementById("btn-logout");

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAjustesUI(user);

    if (user) loadUserDevices(user.uid);
    else clearDevicesDisplay();
  });

  // Login con Google
  btnLogin?.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error en login:", error);
    }
  });

  // Logout
  btnLogout?.addEventListener("click", () => {
    signOut(auth).catch((error) => console.error("Error al cerrar sesión:", error));
  });

  // --- GESTIÓN DE DISPOSITIVOS (FIRESTORE) ---
  const btnAddDevice = document.getElementById("btn-add-device");
  const devicesGrid = document.getElementById("devices-grid");

  btnAddDevice?.addEventListener("click", async () => {
    if (!currentUser) {
      showPage("page-ajustes");
      return; // Si no hay usuario, no deja añadir
    }

    const deviceName = prompt("Nombre del dispositivo:");

    if (deviceName?.trim()) {
      try {
        await addDoc(collection(db, "devices"), {
          name: deviceName,
          type: "light",
          ownerUserId: currentUser.uid,
        });
      } catch (e) {
        console.error("Error al añadir documento:", e);
      }
    }
  });

  // Borrar dispositivo (Evento delegado)
  devicesGrid?.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest(".btn-delete-device");
    if (!deleteBtn) return;

    const card = deleteBtn.closest(".device-card");
    const docId = card?.dataset.docId;

    if (docId) {
      // Confirmación simple antes de borrar
      if(confirm("¿Seguro que quieres borrar este dispositivo?")) {
        await deleteDoc(doc(db, "devices", docId));
      }
    }
  });

  function loadUserDevices(userId) {
    const q = query(collection(db, "devices"), where("ownerUserId", "==", userId));

    onSnapshot(
      q,
      (snapshot) => {
        clearDevicesDisplay();
        snapshot.forEach((docItem) => {
          const device = docItem.data();
          createDeviceCard(device.name, docItem.id);
        });
      },
      (error) => console.error("Error al cargar dispositivos:", error)
    );
  }

  function createDeviceCard(name, id) {
    const cardHTML = `
      <div data-doc-id="${id}" class="device-card relative flex flex-col items-center p-4 bg-white shadow-md rounded-lg aspect-square transition-transform hover:scale-105">
        <button class="btn-delete-device absolute top-2 right-2 text-gray-400 hover:text-red-600" title="Eliminar">
          ✕
        </button>
        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span class="mt-2 font-semibold text-center">${name}</span>
      </div>
    `;
    // Insertamos antes del botón de "Añadir"
    btnAddDevice.insertAdjacentHTML("beforebegin", cardHTML);
  }

  function clearDevicesDisplay() {
    // Elimina todas las tarjetas MENOS el botón de añadir
    const cards = devicesGrid?.querySelectorAll(".device-card");
    cards?.forEach((c) => c.remove());
  }

  // ============================================================
  //  NUEVO: LECTURA DE SENSORES EN TIEMPO REAL (EFI-VOLT)
  // ============================================================
  const voltageDisplay = document.getElementById("live-voltage");
  
  if (voltageDisplay) {
    // Referencia a la ruta exacta donde el ESP32 escribe
    // Asegúrate de que en Firebase sea igual: /Sensores/Voltaje
    const sensorRef = ref(database, 'Sensores/Voltaje');

    console.log("Iniciando escucha de sensores...");

    onValue(sensorRef, (snapshot) => {
      const data = snapshot.val();
      
      // Verificamos que el dato exista
      if (data !== null) {
        console.log("⚡ Voltaje recibido del ESP32:", data);
        voltageDisplay.innerText = data;
        
        // Efecto visual simple: Color según valor
        // Si es menor a 10V lo ponemos rojo (ejemplo), sino blanco
        if(parseFloat(data) < 10) {
            voltageDisplay.style.color = "#ffcccc"; // Rojo claro
        } else {
            voltageDisplay.style.color = "#ffffff"; // Blanco
        }
      } else {
        voltageDisplay.innerText = "--";
      }
    });
  } else {
    console.warn("⚠️ No encontré el elemento con id='live-voltage'. Recuerda añadir el bloque HTML en index.html.");
  }

});
