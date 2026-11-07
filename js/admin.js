/**
 * =====================================================================
 * ADMIN.JS · Lógica de Interacción UI para Vista Administrador (Jefe)
 * =====================================================================
 * Controla:
 * - Cambio de pestañas (Catálogo, Inventario, Tareas, Movimientos).
 * - Selector de sucursal activa.
 * - Apertura y cierre de modales limpios para formularios.
 * - Simulación de acciones con datos de ejemplo (Fase 1).
 */

import { protegerRuta, cerrarSesion } from './auth.js';

// Datos de ejemplo para Sucursales
export const SUCURSALES_DEMO = [
  { id: 'todas', nombre: 'Todas las Sucursales' },
  { id: 'suc-001', nombre: 'Taller Central - Cedro', ubicacion: 'Zona Industrial Av. Los Robles #120' },
  { id: 'suc-002', nombre: 'Showroom Norte - Nogal', ubicacion: 'Centro Comercial Plaza Maderas Local 14' },
  { id: 'suc-003', nombre: 'Almacén Sur - Roble', ubicacion: 'Carretera Vieja Km 4.5' }
];

document.addEventListener('DOMContentLoaded', () => {
  // 1. Proteger ruta con sesión demo
  const usuario = protegerRuta('admin');
  const userPillName = document.getElementById('admin-user-name');
  if (userPillName) {
    userPillName.textContent = usuario.nombre;
  }

  // 2. Configurar botón de Salir / Cerrar Sesión
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSesion();
    });
  }

  // 3. Sistema de Pestañas (Tabs)
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('activo'));
      tabContents.forEach(c => c.classList.remove('activo'));

      btn.classList.add('activo');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('activo');
      }
    });
  });

  // 4. Selector de Sucursal
  const sucursalSelect = document.getElementById('sucursal-filtro-global');
  if (sucursalSelect) {
    sucursalSelect.addEventListener('change', (e) => {
      const sucursalNombre = e.target.options[e.target.selectedIndex].text;
      mostrarNotificacion(`Mostrando información para: ${sucursalNombre}`);
    });
  }

  // 5. Gestión de Modales
  configurarModales();
});

/**
 * Configuración accesible de modales
 */
function configurarModales() {
  // Función genérica para abrir modal
  window.abrirModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('activo');
      document.body.style.overflow = 'hidden';
      // Enfocar primer input si existe
      const firstInput = modal.querySelector('input, select, textarea');
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
  };

  // Función genérica para cerrar modal
  window.cerrarModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('activo');
      document.body.style.overflow = '';
    }
  };

  // Cerrar al hacer clic en fondo o botón con data-close
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-close-modal]')) {
        modal.classList.remove('activo');
        document.body.style.overflow = '';
      }
    });
  });

  // Cerrar con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.activo').forEach(modal => {
        modal.classList.remove('activo');
        document.body.style.overflow = '';
      });
    }
  });

  // Interceptar submits de formularios demo en modales
  const formNuevoProducto = document.getElementById('form-nuevo-producto');
  if (formNuevoProducto) {
    formNuevoProducto.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('prod-nombre').value;
      mostrarNotificacion(`¡Producto "${nombre}" registrado con éxito (Simulado)!`);
      cerrarModal('modal-nuevo-producto');
      formNuevoProducto.reset();
    });
  }

  const formRegistrarEntrada = document.getElementById('form-registrar-entrada');
  if (formRegistrarEntrada) {
    formRegistrarEntrada.addEventListener('submit', (e) => {
      e.preventDefault();
      const cantidad = document.getElementById('lote-cantidad').value;
      const estado = document.getElementById('lote-estado').value;
      mostrarNotificacion(`Lote de ${cantidad} pieza(s) registrado como "${estado}" (Simulado)`);
      cerrarModal('modal-registrar-entrada');
      formRegistrarEntrada.reset();
    });
  }

  const formNuevaTarea = document.getElementById('form-nueva-tarea');
  if (formNuevaTarea) {
    formNuevaTarea.addEventListener('submit', (e) => {
      e.preventDefault();
      const titulo = document.getElementById('tarea-titulo').value;
      mostrarNotificacion(`Tarea "${titulo}" asignada exitosamente (Simulada)`);
      cerrarModal('modal-nueva-tarea');
      formNuevaTarea.reset();
    });
  }

  const formVentaAdmin = document.getElementById('form-vender-admin');
  if (formVentaAdmin) {
    formVentaAdmin.addEventListener('submit', (e) => {
      e.preventDefault();
      const precio = document.getElementById('venta-admin-precio').value;
      mostrarNotificacion(`Venta registrada por $${precio} COP (Simulada)`);
      cerrarModal('modal-vender-admin');
    });
  }

  const formTrasladoAdmin = document.getElementById('form-trasladar-admin');
  if (formTrasladoAdmin) {
    formTrasladoAdmin.addEventListener('submit', (e) => {
      e.preventDefault();
      const destino = document.getElementById('traslado-admin-destino');
      const destinoNombre = destino.options[destino.selectedIndex].text;
      mostrarNotificacion(`Pieza trasladada hacia ${destinoNombre} (Simulado)`);
      cerrarModal('modal-trasladar-admin');
    });
  }
}

/**
 * Notificación flotante amigable
 */
function mostrarNotificacion(mensaje) {
  let toast = document.getElementById('admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.backgroundColor = 'var(--madera-oscura)';
    toast.style.color = '#ffffff';
    toast.style.padding = '14px 20px';
    toast.style.borderRadius = 'var(--radio-md)';
    toast.style.boxShadow = 'var(--sombra-lg)';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '0.95rem';
    toast.style.fontWeight = '600';
    toast.style.borderLeft = '5px solid var(--cuero-acento)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    document.body.appendChild(toast);
  }

  toast.textContent = mensaje;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 3500);
}

