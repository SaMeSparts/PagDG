import "./style.css";
import Chart from 'chart.js/auto';
import { auth, provider, signInWithPopup, database } from "./firebase.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue, off, get, query as queryDb, limitToLast } from "firebase/database";

const db = getFirestore();

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Cargado. App iniciada ✔");

  let currentUser = null;
  let currentListenerRef = null; 
  let connectionWatchdog = null;
  let myChart = null; 

  const modal = document.getElementById("device-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalTitle = document.getElementById("modal-device-name");
  
  // Variables UI
  const modalValue = document.getElementById("modal-voltage"); // Ahora mostrará kW
  const modalAvg = document.getElementById("modal-avg");
  const modalCost = document.getElementById("modal-cost"); 
  
  const statusBadge = document.createElement("div"); 
  statusBadge.className = "absolute px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full top-4 left-4";
  document.querySelector("#device-modal > div").appendChild(statusBadge);

  // --- NAVEGACIÓN ---
  const openBtn = document.getElementById("open-sidebar-btn");
  const closeBtn = document.getElementById("close-sidebar-btn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  function openSidebar() { sidebar?.classList.remove("translate-x-full"); overlay?.classList.remove("hidden"); }
  function closeSidebar() { sidebar?.classList.add("translate-x-full"); overlay?.classList.add("hidden"); }
  openBtn?.addEventListener("click", openSidebar);
  closeBtn?.addEventListener("click", closeSidebar);
  overlay?.addEventListener("click", closeSidebar);

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
      if (targetId) { showPage(targetId); if (targetId === "page-ajustes") updateAjustesUI(currentUser); }
      closeSidebar();
    });
  });
  showPage("page-dispositivos");

  // --- AUTH ---
  const btnLogin = document.getElementById("btn-login-google");
  const btnLogout = document.getElementById("btn-logout");
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAjustesUI(user);
    if (user) loadUserDevices(user.uid);
    else clearDevicesDisplay();
  });
  btnLogin?.addEventListener("click", async () => { try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); } });
  btnLogout?.addEventListener("click", () => { signOut(auth).catch((e) => console.error(e)); });

  // --- DISPOSITIVOS ---
  const btnAddDevice = document.getElementById("btn-add-device");
  const devicesGrid = document.getElementById("devices-grid");

  btnAddDevice?.addEventListener("click", async () => {
    if (!currentUser) { alert("Inicia sesión."); showPage("page-ajustes"); return; }
    const deviceName = prompt("Nombre (Ej: Sala):");
    if (!deviceName) return;
    const deviceId = prompt("ID del Dispositivo (Ver Monitor Serie):");
    if (!deviceId) return;
    try { await addDoc(collection(db, "devices"), { name: deviceName, deviceId: deviceId.trim(), ownerUserId: currentUser.uid, createdAt: new Date() }); } catch (e) { console.error(e); }
  });

  function loadUserDevices(userId) {
    const q = query(collection(db, "devices"), where("ownerUserId", "==", userId));
    onSnapshot(q, (snapshot) => { clearDevicesDisplay(); snapshot.forEach((docItem) => { createDeviceCard(docItem.data(), docItem.id); }); });
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

  function clearDevicesDisplay() { devicesGrid?.querySelectorAll(".device-card").forEach((c) => c.remove()); }

  devicesGrid?.addEventListener("click", async (event) => {
    const target = event.target;
    const card = target.closest(".device-card");
    if (!card) return;
    if (target.closest(".btn-delete-device")) {
      if(confirm("¿Borrar?")) await deleteDoc(doc(db, "devices", card.dataset.docId));
      return;
    }
    const deviceName = card.querySelector("span").textContent;
    const deviceId = card.dataset.deviceId;
    openDeviceModal(deviceName, deviceId);
  });

  function setOnlineStatus(isOnline) {
    if (isOnline) {
      statusBadge.innerText = "🟢 ONLINE";
      statusBadge.className = "absolute px-3 py-1 text-xs font-bold tracking-wider text-green-800 uppercase bg-green-100 border border-green-200 rounded-full top-4 left-4";
      modalValue.classList.remove("text-gray-400");
      modalValue.classList.add("text-green-700");
    } else {
      statusBadge.innerText = "🔴 OFFLINE";
      statusBadge.className = "absolute px-3 py-1 text-xs font-bold tracking-wider text-gray-600 uppercase bg-gray-200 border border-gray-300 rounded-full top-4 left-4";
      modalValue.classList.remove("text-green-700");
      modalValue.classList.add("text-gray-400");
    }
  }

  // --- FUNCIÓN HELPER: AMPERES A KW ---
  function ampsToKw(amps) {
      // W = V * A -> kW = (V * A) / 1000
      // Usamos 127V como estándar
      const watts = amps * 127;
      return watts / 1000;
  }

  // --- GRÁFICA (En kW) ---
  function initChart() {
    const canvas = document.getElementById('voltageChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.5)'); 
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.0)'); 

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Potencia (kW)', // Etiqueta correcta
          data: [], 
          borderColor: '#16a34a', 
          backgroundColor: gradient,
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: false } },
        scales: {
          y: {
            // Escala kW: 0 kW a 2 kW (aprox 15 Amperes)
            min: 0, 
            max: 2, 
            border: { display: false },
            grid: { color: '#e5e7eb', borderDash: [5, 5] },
            ticks: { stepSize: 0.5, color: '#9ca3af', font: { size: 10 } }
          },
          x: { 
             type: 'linear', 
             min: 0, max: 24,
             grid: { display: true, color: '#f3f4f6', borderDash: [2, 2] },
             ticks: {
                 stepSize: 3, 
                 color: '#9ca3af',
                 font: { size: 10 },
                 callback: function(value) {
                    if (value === 24) return "23:59";
                    const hora = Math.floor(value).toString().padStart(2, '0');
                    return hora + ":00";
                 }
             }
          }
        }
      }
    });
  }

  // --- ABRIR MODAL ---
  function openDeviceModal(name, deviceId) {
    modalTitle.innerText = name;
    modal.classList.remove("hidden");
    
    modalValue.innerText = "--";
    modalAvg.innerText = "--";
    if (modalCost) modalCost.innerText = "0.0000"; 
    
    setOnlineStatus(false); 
    
    initChart();

    // 1. Historial
    const historyRef = queryDb(ref(database, `Sensores/${deviceId}/Historial`), limitToLast(100));
    
    get(historyRef).then((snapshot) => {
      if (snapshot.exists()) {
        const historyData = [];
        snapshot.forEach((childSnapshot) => {
          const timestamp = childSnapshot.key;
          const amps = childSnapshot.val();
          
          // CONVERSIÓN A KW
          const kw = ampsToKw(amps);

          const date = new Date(timestamp * 1000); 
          const decimalHour = date.getHours() + (date.getMinutes() / 60);
          historyData.push({ x: decimalHour, y: kw });
        });
        if (myChart) {
          myChart.data.datasets[0].data = historyData;
          myChart.update();
        }
      }
    }).catch((error) => console.error(error));

    // 2. En Vivo
    const deviceRef = ref(database, `Sensores/${deviceId}`);
    currentListenerRef = deviceRef;
    let lastUpdateTimestamp = 0;

    onValue(deviceRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        // En "Voltaje" vienen los Amperes reales del ESP32
        if (data.Voltaje !== undefined) {
             const amps = parseFloat(data.Voltaje);
             const kw = ampsToKw(amps);

             // Mostramos kW con 3 decimales (Ej: 0.150 kW)
             modalValue.innerText = kw.toFixed(2);
             
             if (myChart) {
                 const now = new Date();
                 const decimalHour = now.getHours() + (now.getMinutes() / 60);
                 myChart.data.datasets[0].data.push({ x: decimalHour, y: kw });
                 myChart.data.datasets[0].data.sort((a, b) => a.x - b.x);
                 myChart.update('none');
             }
        }

        // Promedio (También viene en Amperes, lo convertimos)
        if (data.Promedio !== undefined) {
            const ampsProm = parseFloat(data.Promedio);
            const kwProm = ampsToKw(ampsProm);
            modalAvg.innerText = kwProm.toFixed(3);
        }
        
        if (data.CostoDinero !== undefined && modalCost) {
            modalCost.innerText = parseFloat(data.CostoDinero).toFixed(4);
        }

        if (data.UltimaActulizacion) {
            const myTimeSeconds = Math.floor(Date.now() / 1000);
            const diff = myTimeSeconds - data.UltimaActulizacion;
            if (diff < 15) {
                setOnlineStatus(true);
                lastUpdateTimestamp = Date.now();
            } else {
                setOnlineStatus(false);
            }
        }
      }
    });

    connectionWatchdog = setInterval(() => {
      const now = Date.now();
      if (now - lastUpdateTimestamp > 8000 && lastUpdateTimestamp !== 0) {
         setOnlineStatus(false);
      }
    }, 1000);
  }

  function closeDeviceModal() {
    modal.classList.add("hidden");
    if (currentListenerRef) { off(currentListenerRef); currentListenerRef = null; }
    if (connectionWatchdog) { clearInterval(connectionWatchdog); connectionWatchdog = null; }
    if (myChart) { myChart.destroy(); myChart = null; }
  }

  closeModalBtn?.addEventListener("click", closeDeviceModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeDeviceModal(); });
});