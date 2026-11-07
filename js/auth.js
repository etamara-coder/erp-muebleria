/**
 * =====================================================================
 * AUTH.JS · Autenticación y sesión con Supabase (ES Module)
 * =====================================================================
 * Fase 2A:
 * - Inicio de sesión con correo y contraseña.
 * - Cierre de sesión.
 * - Verificación de la sesión activa contra la tabla `usuarios`.
 *
 * La sesión la administra siempre supabase-js; aquí no se guardan tokens.
 */

import { supabase } from './supabase.js';

const PERFIL_CACHE_KEY = 'muebleria_perfil_usuario';
const CAMPOS_PERFIL = 'id, nombre, rol, sucursal_id, activo';

/**
 * Traduce al español los errores más comunes de Supabase Auth.
 */
function traducirErrorAuth(mensaje = '') {
  const texto = mensaje.toLowerCase();

  if (texto.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (texto.includes('email not confirmed')) {
    return 'Debes confirmar tu correo electrónico antes de iniciar sesión.';
  }
  if (texto.includes('user not found')) {
    return 'No existe una cuenta con ese correo electrónico.';
  }
  if (texto.includes('invalid email')) {
    return 'El correo electrónico no es válido.';
  }
  if (texto.includes('too many requests') || texto.includes('rate limit')) {
    return 'Demasiados intentos. Espera un momento antes de volver a intentar.';
  }
  if (texto.includes('failed to fetch') || texto.includes('network')) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
  }

  return mensaje || 'No se pudo iniciar sesión. Intenta de nuevo.';
}

/**
 * Consulta la fila del usuario autenticado en la tabla `usuarios`.
 */
async function consultarPerfil(userId) {
  const { data, error } = await supabase
    .from('usuarios')
    .select(CAMPOS_PERFIL)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo consultar tu perfil de usuario: ${error.message}`);
  }

  return data;
}

/**
 * Guarda una copia del perfil (sin tokens) para que las vistas de Fase 1
 * puedan pintar el nombre mientras se completa la verificación real.
 */
function guardarPerfilCache(perfil) {
  sessionStorage.setItem(PERFIL_CACHE_KEY, JSON.stringify(perfil));
}

function leerPerfilCache() {
  try {
    const guardado = sessionStorage.getItem(PERFIL_CACHE_KEY);
    return guardado ? JSON.parse(guardado) : null;
  } catch {
    return null;
  }
}

function limpiarPerfilCache() {
  sessionStorage.removeItem(PERFIL_CACHE_KEY);
}

/**
 * Inicia sesión con correo y contraseña.
 * Devuelve la fila del usuario en `usuarios` si la cuenta está activa.
 */
export async function signInWithPassword(email, password) {
  let resultado;

  try {
    resultado = await supabase.auth.signInWithPassword({ email, password });
  } catch (errorRed) {
    // Errores de red que supabase-js puede lanzar como excepción.
    throw new Error(traducirErrorAuth(errorRed.message));
  }

  const { data, error } = resultado;

  if (error) {
    throw new Error(traducirErrorAuth(error.message));
  }
  if (!data.user) {
    throw new Error('No se pudo obtener el usuario autenticado.');
  }

  let perfil;
  try {
    perfil = await consultarPerfil(data.user.id);
  } catch (errorPerfil) {
    await supabase.auth.signOut();
    limpiarPerfilCache();
    throw errorPerfil;
  }

  if (!perfil) {
    await supabase.auth.signOut();
    limpiarPerfilCache();
    throw new Error('Tu cuenta no tiene un perfil asignado. Contacta al administrador.');
  }

  if (!perfil.activo) {
    await supabase.auth.signOut();
    limpiarPerfilCache();
    throw new Error('Tu cuenta está desactivada. Contacta al administrador.');
  }

  guardarPerfilCache(perfil);
  return perfil;
}

/**
 * Cierra la sesión activa en Supabase.
 */
export async function signOut() {
  limpiarPerfilCache();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Verifica si hay una sesión activa y devuelve la fila de `usuarios`
 * (id, nombre, rol, sucursal_id, activo). Si no hay sesión, o la cuenta
 * está inactiva, devuelve null.
 */
export async function verificarSesionActiva() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    limpiarPerfilCache();
    return null;
  }

  const perfil = await consultarPerfil(user.id);

  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut();
    limpiarPerfilCache();
    return null;
  }

  guardarPerfilCache(perfil);
  return perfil;
}

/**
 * Redirige al tablero que corresponde al rol del usuario.
 */
export function redirigirSegunRol(perfil) {
  window.location.href = perfil.rol === 'admin'
    ? 'dashboard_admin.html'
    : 'dashboard_empleado.html';
}

/**
 * Compatibilidad con admin.js y empleado.js de la Fase 1.
 * Cierra la sesión y vuelve al login.
 */
export async function cerrarSesion() {
  try {
    await signOut();
  } catch (error) {
    console.error('Error al cerrar sesión:', error.message);
  } finally {
    window.location.href = 'index.html';
  }
}

/**
 * Compatibilidad con admin.js y empleado.js de la Fase 1.
 * Devuelve el perfil cacheado de inmediato y verifica la sesión real en
 * segundo plano; si no es válida, redirige al login.
 */
export function protegerRuta(rolRequerido) {
  const perfilCache = leerPerfilCache();

  verificarSesionActiva()
    .then((perfil) => {
      if (!perfil) {
        window.location.replace('index.html');
        return;
      }

      if (perfil.rol !== rolRequerido) {
        redirigirSegunRol(perfil);
        return;
      }

      // Si la página se abrió sin caché (por ejemplo, en otra pestaña),
      // actualiza el nombre cuando termina la verificación.
      if (!perfilCache) {
        actualizarNombreEnPantalla(perfil.nombre);
      }
    })
    .catch((error) => {
      console.error('No se pudo verificar la sesión:', error.message);
      window.location.replace('index.html');
    });

  return perfilCache || {
    id: '',
    nombre: 'Verificando sesión…',
    rol: rolRequerido,
    sucursal_id: null,
    activo: true
  };
}

/**
 * Actualiza el nombre visible en los encabezados de los tableros actuales.
 */
function actualizarNombreEnPantalla(nombre) {
  ['admin-user-name', 'empleado-user-name'].forEach((id) => {
    const elemento = document.getElementById(id);
    if (elemento) {
      elemento.textContent = nombre;
    }
  });
}
