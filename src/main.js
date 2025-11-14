// 1. IMPORTAR ESTILOS
import "./style.css";

// 2. IMPORTAR FIREBASE DESDE firebase.js (TU CONFIG)
import { auth, provider, signInWithPopup } from "./firebase.js";
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

// 3. INICIALIZAR FIRESTORE
const db = getFirestore();

// 4. CÓDIGO PRINCIPAL
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Cargado. App iniciada ✔");

  let currentUser = null;

  // --- SIDEBAR ---
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

  // --- CAMBIO DE PÁGINAS ---
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

  // Página inicial
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

  // --- DISPOSITIVOS ---
  const btnAddDevice = document.getElementById("btn-add-device");
  const devicesGrid = document.getElementById("devices-grid");

  btnAddDevice?.addEventListener("click", async () => {
    if (!currentUser) {
      showPage("page-ajustes");
      return;
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

  // Borrar dispositivo
  devicesGrid?.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest(".btn-delete-device");
    if (!deleteBtn) return;

    const card = deleteBtn.closest(".device-card");
    const docId = card?.dataset.docId;

    if (docId) {
      await deleteDoc(doc(db, "devices", docId));
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
      <div data-doc-id="${id}" class="device-card relative flex flex-col items-center p-4 bg-white shadow-md rounded-lg aspect-square">
        <button class="btn-delete-device absolute top-2 right-2 text-gray-400 hover:text-red-600">
          ✕
        </button>
        <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="6"></circle>
        </svg>
        <span class="mt-2 font-semibold">${name}</span>
      </div>
    `;
    btnAddDevice.insertAdjacentHTML("beforebegin", cardHTML);
  }

  function clearDevicesDisplay() {
    devicesGrid?.querySelectorAll(".device-card").forEach((c) => c.remove());
  }
});
