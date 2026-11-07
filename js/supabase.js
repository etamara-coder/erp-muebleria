/**
 * =====================================================================
 * SUPABASE.JS · Configuración del Cliente Supabase (ES Module)
 * =====================================================================
 * NOTA DE FASE 1:
 * En esta fase el maquetado utiliza datos locales de ejemplo sin conexión activa.
 * En la Fase 2 se habilitará el cliente con las credenciales de tu proyecto.
 *
 * Versión fija del SDK por CDN: 2.45.4 (cumpliendo regla de no usar "latest")
 */

// Importación fijando versión exacta (preparado para Fase 2):
// import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// Variables de entorno o configuración de Supabase:
export const SUPABASE_CONFIG = {
  url: 'https://TU-PROYECTO.supabase.co', // Reemplazar con la URL de tu proyecto
  anonKey: 'TU-ANON-KEY-AQUI'             // Reemplazar con la clave pública anon
};

// Instancia del cliente (se inicializará en Fase 2):
export let supabase = null;

/**
 * Inicializa la conexión con Supabase.
 * Se activará en la Fase 2 tras configurar credenciales.
 */
export function inicializarSupabase() {
  if (SUPABASE_CONFIG.url !== 'https://TU-PROYECTO.supabase.co' && window.createClient) {
    // supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    console.info('Cliente Supabase inicializado');
  } else {
    console.info('Modo maqueta UI (Fase 1): Sin conexión a Supabase');
  }
  return supabase;
}

