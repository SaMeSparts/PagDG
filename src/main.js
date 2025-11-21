// 1. IMPORTAR ESTILOS
import "./style.css";

// 2. IMPORTAR FIREBASE Y FUNCIONES NECESARIAS
import { auth, provider, signInWithPopup, database } from "./firebase.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue, off } from "firebase/database";

const db = getFirestore();

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Cargado. App iniciada ✔");

  let currentUser = null;
  let currentListenerRef = null; 
  let connectionWatchdog = null; // Temporizador para detectar desconexión

  // --- ELEMENTOS DEL UI ---
  const modal = document.getElementById("device-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalTitle = document.getElementById("modal-device-name");
  const modalVoltage = document.getElementById("modal-voltage");
  const modalAvg = document.getElementById("modal-avg");
  const statusBadge = document.createElement("div"); // Badge de estado (Online/Offline)

  // Insertamos el badge de estado en el modal dinámicamente
  statusBadge.className = "absolute px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full top-4 left-4";
  document.querySelector("#device-modal > div > div").appendChild(statusBadge);

  // --- FUNCIONES DE NAVEGACIÓN (SIDEBAR & PAGES) ---
  // (Mismo código de siempre para sidebar y navegación)
  const openBtn = document.getElementById("open-sidebar-btn");
  const closeBtn = document.getElementById("close-sidebar-btn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const navLinks = document.querySelectorAll(".nav-link");
  const contentSections = document.querySelectorAll(".page-content");

  function openSidebar() { sidebar?.classList.remove("translate-x-full"); overlay?.classList.remove("hidden"); }
  function closeSidebar() { sidebar?.classList.add("translate-x-full"); overlay?.classList.add("hidden"); }
  openBtn?.addEventListener("click", openSidebar);
  closeBtn?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);

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
      if (targetId) { showPage(targetId); if (targetId === "page-ajustes") updateAjustesUI(currentUser); }
      closeSidebar();
    });
  });
  showPage("page-dispositivos");

  // --- AUTENTICACIÓN ---
  const btnLogin = document.getElementById("btn-login-google");
  const btnLogout = document.getElementById("btn-logout");

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAjustesUI(user);
    if (user) loadUserDevices(user.uid);
    else clearDevicesDisplay();
  });

  btnLogin?.addEventListener("click", async () => { try { await signInWithPopup(auth, provider); } catch (error) { console.error(error); } });
  btnLogout?.addEventListener("click", () => { signOut(auth).catch((e) => console.error(e)); });

  // --- LÓGICA DE DISPOSITIVOS ---
  const btnAddDevice = document.getElementById("btn-add-device");
  const devicesGrid = document.getElementById("devices-grid");

  // 1. AÑADIR DISPOSITIVO (AHORA PIDE ID)
  btnAddDevice?.addEventListener("click", async () => {
    if (!currentUser) { alert("Inicia sesión primero."); showPage("page-ajustes"); return; }

    const deviceName = prompt("Nombre del dispositivo (Ej: Sala):");
    if (!deviceName) return;

    // ¡AQUÍ PEDIMOS EL ID DEL ESP32!
    const deviceId = prompt("Ingresa el ID del dispositivo (Lo viste en el Monitor Serie del Arduino):");
    if (!deviceId) return;

    try {
      await addDoc(collection(db, "devices"), {
        name: deviceName,
        deviceId: deviceId.trim(), // Guardamos el ID único
        ownerUserId: currentUser.uid,
        createdAt: new Date()
      });
    } catch (e) { console.error("Error añadiendo:", e); }
  });

  // 2. CARGAR Y MOSTRAR TARJETAS
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
      <div data-doc-id="${id}" data-device-id="${device.deviceId}" 
           class="device-card relative flex flex-col items-center p-4 bg-white shadow-md rounded-lg aspect-square transition-transform hover:scale-105 cursor-pointer border border-gray-200 hover:border-green-500 group">
        <button class="btn-delete-device absolute top-2 right-2 text-gray-300 hover:text-red-600 z-10">✕</button>
        <div class="flex-1 flex items-center justify-center">
           <svg class="w-16 h-16 text-[#FFD700] group-hover:text-[#FF8C00] transition-colors duration-300" fill="currentColor" viewBox="0 0 24 24">
             <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
           </svg>
        </div>
        <span class="mt-2 font-semibold text-center text-gray-700 group-hover:text-green-700">${device.name}</span>
        <span class="text-xs text-gray-400">ID: ${device.deviceId}</span>
      </div>
    `;
    btnAddDevice.insertAdjacentHTML("beforebegin", cardHTML);
  }

  function clearDevicesDisplay() {
    const cards = devicesGrid?.querySelectorAll(".device-card");
    cards?.forEach((c) => c.remove());
  }

  devicesGrid?.addEventListener("click", async (event) => {
    const target = event.target;
    const card = target.closest(".device-card");
    if (!card) return;

    if (target.closest(".btn-delete-device")) {
      if(confirm("¿Borrar este dispositivo?")) {
        await deleteDoc(doc(db, "devices", card.dataset.docId));
      }
      return;
    }

    const deviceName = card.querySelector("span").textContent;
    const deviceId = card.dataset.deviceId;
    openDeviceModal(deviceName, deviceId);
  });

  // --- MODAL Y LÓGICA DE DESCONEXIÓN (WATCHDOG) ---

  function setOnlineStatus(isOnline) {
    if (isOnline) {
      statusBadge.innerText = "🟢 CONECTADO";
      statusBadge.className = "absolute px-3 py-1 text-xs font-bold tracking-wider text-green-800 uppercase bg-green-100 border border-green-200 rounded-full top-4 left-4";
      modalVoltage.classList.remove("text-gray-400");
      modalVoltage.classList.add("text-green-700");
    } else {
      statusBadge.innerText = "🔴 DESCONECTADO";
      statusBadge.className = "absolute px-3 py-1 text-xs font-bold tracking-wider text-gray-600 uppercase bg-gray-200 border border-gray-300 rounded-full top-4 left-4";
      modalVoltage.classList.remove("text-green-700");
      modalVoltage.classList.add("text-gray-400"); // Gris para indicar desconexión
    }
  }

  function openDeviceModal(name, deviceId) {
    modalTitle.innerText = name;
    modal.classList.remove("hidden");
    
    // Reiniciamos UI
    modalVoltage.innerText = "--";
    modalAvg.innerText = "--";
    
    // 1. AL ABRIR, ASUMIMOS QUE ESTÁ DESCONECTADO HASTA DEMOSTRAR LO CONTRARIO
    setOnlineStatus(false); 

    const deviceRef = ref(database, `Sensores/${deviceId}`);
    currentListenerRef = deviceRef;
    
    let lastUpdateTimestamp = 0;

    // Escuchar cambios
    onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        // Actualizar textos visuales
        if (data.Voltaje !== undefined) modalVoltage.innerText = data.Voltaje;
        if (data.Promedio !== undefined) modalAvg.innerText = parseFloat(data.Promedio).toFixed(2);
        
        // --- LÓGICA INTELIGENTE DE CONEXIÓN ---
        if (data.UltimaActulizacion) {
            // La fecha del dato (viene en segundos desde el ESP32)
            const dataTimeSeconds = data.UltimaActulizacion;
            
            // La fecha de mi computadora (Date.now() es milisegundos, dividimos por 1000)
            const myTimeSeconds = Math.floor(Date.now() / 1000);

            // Calculamos la diferencia (¿Qué tan viejo es el dato?)
            const diff = myTimeSeconds - dataTimeSeconds;

            console.log(`Antigüedad del dato: ${diff} segundos`);

            // Si el dato tiene menos de 15 segundos de antigüedad, es válido.
            // Si es más viejo, es un dato "zombi" que quedó guardado.
            if (diff < 15) {
                setOnlineStatus(true);
                lastUpdateTimestamp = Date.now(); // Actualizamos para el watchdog
            } else {
                setOnlineStatus(false); // Es un dato viejo, seguimos desconectados
            }
        }
      }
    });

    // 2. WATCHDOG: Comprobar cada segundo si el dispositivo sigue vivo
    connectionWatchdog = setInterval(() => {
      const now = Date.now();
      // Si han pasado más de 8 segundos (8000ms) desde la última actualización...
      if (now - lastUpdateTimestamp > 8000 && lastUpdateTimestamp !== 0) {
         setOnlineStatus(false); // ...marcarlo como desconectado
      }
    }, 1000);
  }

  function closeDeviceModal() {
    modal.classList.add("hidden");
    if (currentListenerRef) { off(currentListenerRef); currentListenerRef = null; }
    if (connectionWatchdog) { clearInterval(connectionWatchdog); connectionWatchdog = null; }
  }

  closeModalBtn?.addEventListener("click", closeDeviceModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeDeviceModal(); });
});