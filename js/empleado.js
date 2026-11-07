/**
 * =====================================================================
 * EMPLEADO.JS · Lógica de Interacción UI para Vista Empleado (Taller)
 * =====================================================================
 * Controla:
 * - Cambio entre las 2 únicas secciones: Mis Tareas e Inventario de mi sucursal.
 * - Acciones táctiles sobre tareas: Iniciar tarea y Marcar completada.
 * - Acciones táctiles sobre piezas: Terminar producción, Vender, Enviar, Trasladar.
 * - Modales limpios para celular (Precio de Venta y Sucursal de Traslado).
 * - NO incluye tabla de movimientos.
 */

import { protegerRuta, cerrarSesion } from './auth.js';

let piezaSeleccionadaId = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. Proteger ruta con sesión de empleado
  const usuario = protegerRuta('empleado');
  const userEl = document.getElementById('empleado-user-name');
  const sucursalEl = document.getElementById('empleado-sucursal-name');
  if (userEl) userEl.textContent = usuario.nombre;
  if (sucursalEl) sucursalEl.textContent = usuario.sucursal_nombre || 'Taller Central';

  // 2. Cerrar sesión
  const btnLogout = document.getElementById('btn-logout-empleado');
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSesion();
    });
  }

  // 3. Navegación entre las DOS únicas secciones
  configurarTabs();

  // 4. Configurar acciones de Tareas
  configurarAccionesTareas();

  // 5. Configurar acciones de Inventario
  configurarAccionesInventario();

  // 6. Configurar Modales
  configurarModalesEmpleado();
});

/**
 * Pestañas principales de Taller
 */
function configurarTabs() {
  const tabs = document.querySelectorAll('.empleado-tab-btn');
  const seccionTareas = document.getElementById('seccion-tareas');
  const seccionInventario = document.getElementById('seccion-inventario');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const seccion = tab.getAttribute('data-seccion');

      tabs.forEach(t => t.classList.remove('activo'));
      tab.classList.add('activo');

      if (seccion === 'tareas') {
        seccionTareas.classList.add('activo');
        seccionInventario.classList.remove('activo');
      } else {
        seccionTareas.classList.remove('activo');
        seccionInventario.classList.add('activo');
      }
    });
  });

  // Filtros de inventario por chip
  const chips = document.querySelectorAll('.filtro-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('activo'));
      chip.classList.add('activo');

      const filtro = chip.getAttribute('data-filtro');
      const tarjetas = document.querySelectorAll('.pieza-card');

      tarjetas.forEach(card => {
        const estado = card.getAttribute('data-estado');
        if (filtro === 'todos' || estado === filtro) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/**
 * Acciones sobre Tareas (iniciar_tarea y completar_tarea)
 */
function configurarAccionesTareas() {
  document.addEventListener('click', (e) => {
    // Iniciar tarea
    const btnIniciar = e.target.closest('[data-accion="iniciar-tarea"]');
    if (btnIniciar) {
      const card = btnIniciar.closest('.tarea-card');
      const badge = card.querySelector('.badge');
      
      card.classList.remove('pendiente');
      card.classList.add('en_progreso');
      badge.className = 'badge badge-progreso';
      badge.textContent = 'En Progreso';

      btnIniciar.outerHTML = `
        <button class="btn btn-success btn-lg btn-block btn-taller" data-accion="completar-tarea">
          ✓ Marcar como Completada
        </button>
      `;

      mostrarAvisoTaller('Tarea iniciada. ¡Buen trabajo en el taller!');
      return;
    }

    // Completar tarea
    const btnCompletar = e.target.closest('[data-accion="completar-tarea"]');
    if (btnCompletar) {
      const card = btnCompletar.closest('.tarea-card');
      const badge = card.querySelector('.badge');
      
      card.classList.remove('en_progreso');
      card.classList.add('completada');
      badge.className = 'badge badge-completada';
      badge.textContent = 'Completada';

      btnCompletar.outerHTML = `
        <div class="alerta alerta-exito text-center" style="margin: 0; font-weight: 700;">
          ✓ Tarea finalizada con éxito
        </div>
      `;

      mostrarAvisoTaller('¡Excelente! Tarea completada y registrada.');
    }
  });
}

/**
 * Acciones sobre Piezas de Inventario (marcar_disponible, registrar_venta, registrar_envio, trasladar_mueble)
 */
function configurarAccionesInventario() {
  document.addEventListener('click', (e) => {
    // 1. Terminar Producción (pasa a disponible)
    const btnTerminar = e.target.closest('[data-accion="terminar-produccion"]');
    if (btnTerminar) {
      const card = btnTerminar.closest('.pieza-card');
      const codigo = card.querySelector('.pieza-codigo').textContent;

      if (confirm(`¿Confirmas que la pieza ${codigo} terminó su proceso de producción y queda Disponible para venta?`)) {
        actualizarPiezaADisponible(card);
        mostrarAvisoTaller(`Pieza ${codigo} marcada como DISPONIBLE.`);
      }
      return;
    }

    // 2. Abrir Modal de Vender
    const btnVender = e.target.closest('[data-accion="abrir-venta"]');
    if (btnVender) {
      const card = btnVender.closest('.pieza-card');
      piezaSeleccionadaId = card.id;
      const nombre = card.querySelector('.pieza-nombre').textContent;
      const codigo = card.querySelector('.pieza-codigo').textContent;
      
      document.getElementById('modal-venta-pieza-info').textContent = `${codigo} - ${nombre}`;
      abrirModalEmp('modal-vender-empleado');
      return;
    }

    // 3. Enviar al Cliente
    const btnEnviar = e.target.closest('[data-accion="enviar-cliente"]');
    if (btnEnviar) {
      const card = btnEnviar.closest('.pieza-card');
      const codigo = card.querySelector('.pieza-codigo').textContent;

      if (confirm(`¿Confirmas la salida para ENVÍO al cliente de la pieza ${codigo}?`)) {
        actualizarPiezaAEnviada(card);
        mostrarAvisoTaller(`Envío registrado para la pieza ${codigo}.`);
      }
      return;
    }

    // 4. Abrir Modal de Traslado
    const btnTrasladar = e.target.closest('[data-accion="abrir-traslado"]');
    if (btnTrasladar) {
      const card = btnTrasladar.closest('.pieza-card');
      piezaSeleccionadaId = card.id;
      const nombre = card.querySelector('.pieza-nombre').textContent;
      const codigo = card.querySelector('.pieza-codigo').textContent;

      document.getElementById('modal-traslado-pieza-info').textContent = `${codigo} - ${nombre}`;
      abrirModalEmp('modal-trasladar-empleado');
      return;
    }
  });
}

function actualizarPiezaADisponible(card) {
  card.setAttribute('data-estado', 'disponible');
  const badge = card.querySelector('.badge');
  badge.className = 'badge badge-disponible';
  badge.textContent = 'Disponible';

  const accionesContainer = card.querySelector('.pieza-acciones-grid');
  accionesContainer.innerHTML = `
    <button class="btn btn-success btn-lg btn-taller" data-accion="abrir-venta">
      💰 Vender
    </button>
    <button class="btn btn-warning btn-lg btn-taller" data-accion="abrir-traslado">
      🚚 Trasladar
    </button>
  `;
}

function actualizarPiezaAVendida(card, precio) {
  card.setAttribute('data-estado', 'vendido');
  const badge = card.querySelector('.badge');
  badge.className = 'badge badge-vendido';
  badge.textContent = 'Vendido';

  const accionesContainer = card.querySelector('.pieza-acciones-grid');
  accionesContainer.innerHTML = `
    <button class="btn btn-purple btn-lg btn-block btn-full btn-taller" data-accion="enviar-cliente">
      📦 Registrar Envío al Cliente
    </button>
  `;
}

function actualizarPiezaAEnviada(card) {
  card.setAttribute('data-estado', 'enviado');
  const badge = card.querySelector('.badge');
  badge.className = 'badge badge-enviado';
  badge.textContent = 'Enviado';

  const accionesContainer = card.querySelector('.pieza-acciones-grid');
  accionesContainer.innerHTML = `
    <div class="pieza-finalizada-msg btn-full">
      ✓ Pieza despachada y entregada al cliente
    </div>
  `;
}

/**
 * Modales específicos para celular
 */
function configurarModalesEmpleado() {
  window.abrirModalEmp = (id) => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('activo');
      const input = modal.querySelector('input');
      if (input) setTimeout(() => input.focus(), 150);
    }
  };

  window.cerrarModalEmp = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('activo');
    piezaSeleccionadaId = null;
  };

  // Submit Modal Venta
  const formVenta = document.getElementById('form-venta-empleado');
  if (formVenta) {
    formVenta.addEventListener('submit', (e) => {
      e.preventDefault();
      const precio = document.getElementById('input-precio-final').value;
      if (piezaSeleccionadaId) {
        const card = document.getElementById(piezaSeleccionadaId);
        if (card) {
          actualizarPiezaAVendida(card, precio);
          mostrarAvisoTaller(`¡Venta guardada por $${precio} COP!`);
        }
      }
      cerrarModalEmp('modal-vender-empleado');
      formVenta.reset();
    });
  }

  // Submit Modal Traslado
  const formTraslado = document.getElementById('form-traslado-empleado');
  if (formTraslado) {
    formTraslado.addEventListener('submit', (e) => {
      e.preventDefault();
      const selectDestino = document.getElementById('select-sucursal-destino');
      const destinoNombre = selectDestino.options[selectDestino.selectedIndex].text;
      
      if (piezaSeleccionadaId) {
        const card = document.getElementById(piezaSeleccionadaId);
        if (card) {
          card.style.opacity = '0.5';
          setTimeout(() => {
            card.remove();
          }, 800);
          mostrarAvisoTaller(`Pieza trasladada a: ${destinoNombre}`);
        }
      }
      cerrarModalEmp('modal-trasladar-empleado');
    });
  }
}

/**
 * Notificación táctil visible en celular
 */
function mostrarAvisoTaller(mensaje) {
  let toast = document.getElementById('taller-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'taller-toast';
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = 'var(--madera-oscura)';
    toast.style.color = '#ffffff';
    toast.style.padding = '16px';
    toast.style.borderRadius = 'var(--radio-md)';
    toast.style.boxShadow = 'var(--sombra-lg)';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '1.05rem';
    toast.style.fontWeight = '700';
    toast.style.textAlign = 'center';
    toast.style.border = '2px solid var(--madera-dorada)';
    toast.style.transition = 'all 0.3s ease';
    document.body.appendChild(toast);
  }

  toast.textContent = mensaje;
  toast.style.display = 'block';
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-15px)';
    setTimeout(() => { toast.style.display = 'none'; }, 300);
  }, 3200);
}

