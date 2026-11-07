/**
 * =====================================================================
 * SUPABASE.JS · Cliente único de Supabase (ES Module)
 * =====================================================================
 * Fase 2A: autenticación real con Supabase Auth.
 *
 * Versión fija del SDK por CDN: 2.45.4 (nunca "latest").
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// ---------------------------------------------------------------------
// Configuración del proyecto
// Reemplaza estos dos valores por los de tu proyecto:
// Supabase > Project Settings > API (Project URL y anon public key).
// La anon key es pública: la seguridad real la aplica RLS en la base.
// ---------------------------------------------------------------------
export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU-ANON-KEY-AQUI';

// Cliente único para toda la aplicación.
// supabase-js se encarga de mantener y refrescar la sesión.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Aviso útil si todavía no se configuraron las credenciales.
if (SUPABASE_URL.includes('TU-PROYECTO') || SUPABASE_ANON_KEY.includes('TU-ANON-KEY')) {
  console.warn('⚠️ Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/supabase.js');
}
