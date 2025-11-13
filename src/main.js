import './style.css'

// Espera a que todo el HTML esté cargado
document.addEventListener('DOMContentLoaded', () => {
  
  // --- LÓGICA DEL SIDEBAR (Para abrir y cerrar) ---
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

  if (openBtn) {
    openBtn.addEventListener('click', openSidebar);
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSidebar);
  }
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // --- LÓGICA NUEVA: CAMBIO DE PÁGINA ---

  // 1. Selecciona todos los enlaces de navegación y todas las secciones de contenido
  const navLinks = document.querySelectorAll('.nav-link');
  const contentSections = document.querySelectorAll('.page-content');

  // 2. Función para mostrar una página específica
  function showPage(targetId) {
    // Oculta TODAS las secciones de contenido
    contentSections.forEach(section => {
      section.classList.add('hidden');
    });

    // Muestra SOLO la sección deseada (la que tiene el ID 'targetId')
    const targetPage = document.getElementById(targetId);
    if (targetPage) {
      targetPage.classList.remove('hidden');
    }
  }

  // 3. Añade un "escuchador" de clic a CADA enlace de navegación
  navLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      // Evita que el enlace recargue la página (comportamiento por defecto)
      event.preventDefault(); 
      
      // Obtiene el ID de la página a mostrar desde el atributo 'data-target'
      const targetId = event.currentTarget.dataset.target;

      if (targetId) {
        // Llama a la función para mostrar esa página
        showPage(targetId);
      }
      
      // Cierra el sidebar después de hacer clic en una opción
      closeSidebar();
    });
  });

});