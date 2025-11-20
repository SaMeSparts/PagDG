// 1. IMPORTAR ESTILOS
import "./style.css";

import { auth, provider, signInWithPopup, database } from "./firebase.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue, off } from "firebase/database";

const db = getFirestore();

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Cargado. App iniciada ✔");

  let currentUser = null;
  let currentListenerRef = null; // Para guardar la referencia de escucha activa

  // --- UI ELEMENTS ---
  const modal = document.getElementById("device-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalTitle = document.getElementById("modal-device-name");
  const modalVoltage = document.getElementById("modal-voltage");
  const modalAvg = document.getElementById("modal-avg");

  // --- SIDEBAR & NAV ---
  const openBtn = document.getElementById("open-sidebar-btn");
  const closeBtn = document.getElementById("close-sidebar-btn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const navLinks = document.querySelectorAll(".nav-link");
  const contentSections = document.querySelectorAll(".page-content");

  // --- SIDEBAR LOGIC ---
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

  // --- PAGE NAVIGATION ---
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
  showPage("page-dispositivos");

  // --- AUTHENTICATION ---
  const btnLogin = document.getElementById("btn-login-google");
  const btnLogout = document.getElementById("btn-logout");

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAjustesUI(user);
    if (user) loadUserDevices(user.uid);
    else clearDevicesDisplay();
  });

  btnLogin?.addEventListener("click", async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { console.error("Error login:", error); }
  });

  btnLogout?.addEventListener("click", () => {
    signOut(auth).catch((e) => console.error(e));
  });

  // --- DEVICES LOGIC ---
  const btnAddDevice = document.getElementById("btn-add-device");
  const devicesGrid = document.getElementById("devices-grid");

  // 1. AÑADIR DISPOSITIVO
  btnAddDevice?.addEventListener("click", async () => {
    if (!currentUser) {
      alert("Debes iniciar sesión primero.");
      showPage("page-ajustes");
      return;
    }

    const deviceName = prompt("Nombre del dispositivo (Ej: Sala):");
    if (!deviceName) return;

    // IMPORTANTE: Aquí definimos a qué parte de la Base de Datos se conecta.
    // Como tu ESP32 escribe en "/Sensores", usaremos eso por defecto.
    // Si tuvieras varios ESP32, aquí pedirías el ID único.
    const sensorPath = "Sensores"; 

    try {
      await addDoc(collection(db, "devices"), {
        name: deviceName,
        sensorPath: sensorPath, // Guardamos la ruta
        ownerUserId: currentUser.uid,
        createdAt: new Date()
      });
    } catch (e) {
      console.error("Error añadiendo:", e);
    }
  });

  // 2. CARGAR DISPOSITIVOS (FIRESTORE)
  function loadUserDevices(userId) {
    const q = query(collection(db, "devices"), where("ownerUserId", "==", userId));
    onSnapshot(q, (snapshot) => {
        clearDevicesDisplay();
        snapshot.forEach((docItem) => {
          const device = docItem.data();
          createDeviceCard(device, docItem.id);
        });
      });
  }

  function createDeviceCard(device, id) {
    const cardHTML = `
      <div data-doc-id="${id}" data-sensor-path="${device.sensorPath}" 
           class="device-card relative flex flex-col items-center p-4 bg-white shadow-md rounded-lg aspect-square transition-transform hover:scale-105 cursor-pointer border border-gray-200 hover:border-green-500 group">
        
        <button class="btn-delete-device absolute top-2 right-2 text-gray-300 hover:text-red-600 z-10">
          ✕
        </button>
        
        <div class="flex-1 flex items-center justify-center">
           <img src="./rayo.png" class="w-12 h-12 opacity-80 group-hover:opacity-100 transition-opacity" alt="Icono">
        </div>
        
        <span class="mt-2 font-semibold text-center text-gray-700 group-hover:text-green-700">${device.name}</span>
        <span class="text-xs text-gray-400">Click para ver</span>
      </div>
    `;
    btnAddDevice.insertAdjacentHTML("beforebegin", cardHTML);
  }

  function clearDevicesDisplay() {
    const cards = devicesGrid?.querySelectorAll(".device-card");
    cards?.forEach((c) => c.remove());
  }

  // 3. MANEJO DE CLICKS (ABRIR MODAL O BORRAR)
  devicesGrid?.addEventListener("click", async (event) => {
    const target = event.target;
    const card = target.closest(".device-card");
    
    if (!card) return;

    // Si clickeó en borrar
    if (target.closest(".btn-delete-device")) {
      if(confirm("¿Borrar este dispositivo?")) {
        const docId = card.dataset.docId;
        await deleteDoc(doc(db, "devices", docId));
      }
      return;
    }

    // Si clickeó en la tarjeta (ABRIR MODAL)
    const deviceName = card.querySelector("span").textContent;
    const sensorPath = card.dataset.sensorPath; // Recuperamos la ruta "Sensores"
    openDeviceModal(deviceName, sensorPath);
  });

  // --- MODAL LOGIC (REALTIME DATABASE) ---

  function openDeviceModal(name, path) {
    modalTitle.innerText = name;
    modal.classList.remove("hidden");
    
    // Reiniciar valores visuales
    modalVoltage.innerText = "--";
    modalAvg.innerText = "--";

    // CONECTAR A FIREBASE REALTIME
    // Construimos la referencia: "Sensores/Voltaje"
    const voltageRef = ref(database, `${path}/Voltaje`);
    
    // Guardamos la referencia para poder apagarla luego
    currentListenerRef = voltageRef;

    onValue(voltageRef, (snapshot) => {
      const val = snapshot.val();
      if (val !== null) {
        modalVoltage.innerText = val;
        
        // Lógica simple de promedio (simulada visualmente o real si tuvieras más datos)
        // Aquí mostramos el mismo valor o un cálculo si quisieras
        modalAvg.innerText = val; 
      }
    });
  }

  function closeDeviceModal() {
    modal.classList.add("hidden");
    
    // IMPORTANTE: Dejar de escuchar a Firebase para ahorrar datos
    if (currentListenerRef) {
      off(currentListenerRef);
      currentListenerRef = null;
      console.log("Desconectado del sensor.");
    }
  }

  closeModalBtn?.addEventListener("click", closeDeviceModal);
  
  // Cerrar si clickean fuera del cuadro blanco
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeDeviceModal();
  });

});