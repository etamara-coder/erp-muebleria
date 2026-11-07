/**
 * =====================================================================
 * AUTH.JS · Gestión de Autenticación y Sesión de Usuario (ES Module)
 * =====================================================================
 * En Fase 1 simula la sesión para que el usuario pueda probar el flujo
 * de navegación entre Login, Vista Admin y Vista Empleado.
 * En Fase 2 delegará la autenticación a `supabase.auth`.
 */

// Clave de almacenamiento de sesión de prueba
const SESION_KEY = 'muebleria_usuario_actual';

// Usuarios de prueba predeterminados para la maqueta
export const USUARIOS_DEMO = {
  admin: {
    id: 'usr-admin-001',
    nombre: 'Don Fernando Morales (Jefe de Taller)',
    rol: 'admin',
    sucursal_id: null,
    sucursal_nombre: 'Todas las Sucursales'
  },
  empleado: {
    id: 'usr-emp-002',
    nombre: 'Carlos Ruiz (Ebanista)',
    rol: 'empleado',
    sucursal_id: 'suc-001',
    sucursal_nombre: 'Taller Central - Cedro'
  }
};

/**
 * Obtiene el usuario actual en sesión (o null si no hay sesión iniciada)
 */
export function obtenerUsuarioActual() {
  const guardado = sessionStorage.getItem(SESION_KEY);
  if (guardado) {
    try {
      return JSON.parse(guardado);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Inicia sesión simulada para pruebas de maqueta (Fase 1)
 * @param {'admin' | 'empleado'} tipo
 */
export function iniciarSesionDemo(tipo) {
  const usuario = USUARIOS_DEMO[tipo] || USUARIOS_DEMO.admin;
  sessionStorage.setItem(SESION_KEY, JSON.stringify(usuario));
  
  if (usuario.rol === 'admin') {
    window.location.href = 'dashboard_admin.html';
  } else {
    window.location.href = 'dashboard_empleado.html';
  }
}

/**
 * Cierra la sesión activa y redirige al login
 */
export function cerrarSesion() {
  sessionStorage.removeItem(SESION_KEY);
  window.location.href = 'index.html';
}

/**
 * Verifica si la página requiere un rol específico
 * @param {'admin' | 'empleado'} rolRequerido
 */
export function protegerRuta(rolRequerido) {
  const usuario = obtenerUsuarioActual();
  if (!usuario) {
    // Si no hay sesión en la maqueta, por comodidad cargamos un demo por defecto
    const demoPorDefecto = rolRequerido === 'admin' ? USUARIOS_DEMO.admin : USUARIOS_DEMO.empleado;
    sessionStorage.setItem(SESION_KEY, JSON.stringify(demoPorDefecto));
    return demoPorDefecto;
  }
  return usuario;
}

