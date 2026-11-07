# Proyecto: Sistema de gestión para negocio de muebles y objetos de madera

## Contexto
App web para UN solo negocio con varias sucursales. Dos roles: `admin` (jefes) y `empleado`. El admin ve todo y cambia entre sucursales; el empleado solo ve el inventario de su sucursal y las tareas asignadas a él.

## Stack (obligatorio)
- Frontend: HTML5, CSS3 y JavaScript puro (ES modules). Sin frameworks ni build tools.
- Backend: Supabase (PostgreSQL, Auth, Storage). Cliente `@supabase/supabase-js` v2 por CDN (fijando versión exacta, ej. `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm`, nunca `latest`).
- Interfaz en español, responsive (uso en celular desde el taller).
- Estructura:
  - `index.html` (login)
  - `dashboard_admin.html` (vista jefe: selector de sucursal, resumen/novedades, CRUD catálogo, alta de lotes en inventario, asignar tareas, tabla de movimientos)
  - `dashboard_empleado.html` (vista empleado: tiene solo dos secciones: Mis Tareas e Inventario de mi sucursal con acciones de estado; NO lleva tabla de movimientos)
  - `css/` (`style.css`, `admin.css`, `empleado.css`)
  - `js/` (`supabase.js`, `auth.js`, `admin.js`, `empleado.js`)
  - `assets/img/`

## Base de datos (Esquema exacto ya creado en Supabase en `schema.sql`)
- `sucursales(id, nombre, ubicacion, creado_en)`
- `usuarios(id → auth.users, nombre, rol 'admin'|'empleado', sucursal_id, activo, creado_en)`
- `productos(id, nombre, categoria, tipo_madera, precio_base, foto_url, activo, creado_en)`
- `inventario(id, producto_id, sucursal_id, estado 'en_produccion'|'disponible'|'vendido'|'enviado', creado_en, actualizado_en)`: una fila por pieza física.
- `movimientos(id, inventario_id, tipo 'entrada'|'traslado'|'venta'|'envio'|'ajuste', usuario_id, sucursal_origen, sucursal_destino, fecha, precio_final)`
- `tareas(id, titulo, descripcion, asignado_a, creado_por, sucursal_id, estado 'pendiente'|'en_progreso'|'completada', fecha_limite, creado_en, completada_en)`

## Reglas de Negocio y Funciones RPC (CRÍTICO)
- Nadie (ni siquiera el admin) hace `INSERT`, `UPDATE` o `DELETE` directo sobre `inventario` ni `movimientos`. Tampoco se borran piezas de inventario. Para dar de baja usuarios o productos se usa `UPDATE ... SET activo = false`.
- Ciclo de vida estricto de una pieza: `en_produccion` -> `disponible` -> `vendido` -> `enviado`.
- Toda operación sobre inventario o cambio de estado de tareas por empleados se hace EXCLUSIVAMENTE con `supabase.rpc(nombre, parametros)`:
  1. `registrar_entrada({ p_producto_id, p_sucursal_id, p_estado, p_cantidad })` -> Solo admin. `p_estado`: `'disponible'` o `'en_produccion'`. `p_cantidad`: 1 a 100.
  2. `marcar_disponible({ p_inventario_id })` -> Pasa pieza de `'en_produccion'` a `'disponible'` (registra movimiento `'ajuste'`).
  3. `registrar_venta({ p_inventario_id, p_precio_final })` -> Pasa pieza de `'disponible'` a `'vendido'`.
  4. `registrar_envio({ p_inventario_id })` -> Pasa pieza de `'vendido'` a `'enviado'`.
  5. `trasladar_mueble({ p_inventario_id, p_sucursal_destino })` -> Mueve pieza `'disponible'` o `'en_produccion'` a otra sucursal.
  6. `iniciar_tarea({ p_tarea_id })` -> Empleado asignado pasa su tarea de `'pendiente'` a `'en_progreso'`.
  7. `completar_tarea({ p_tarea_id })` -> Empleado asignado pasa su tarea a `'completada'`.

## Seguridad y alcance del frontend
- Ocultar botones según el rol es solo comodidad visual; la seguridad real es RLS en la base de datos. No confíes en el JS para proteger nada.
- Solo `inventario` y `movimientos` pasan siempre por RPC. `productos`, `tareas`, `sucursales` y `usuarios` los gestiona el admin con inserts y updates normales (RLS lo permite solo al admin).
- NO construir formulario de "crear empleado": el registro público está desactivado y las cuentas se crean a mano en el panel de Supabase. Nunca usar `signUp` ni `service_role` en el frontend.
- Las funciones RPC lanzan errores en español: mostrar `error.message` al usuario.
- Fijar una versión exacta de `supabase-js` en la URL del CDN, nunca `"latest"`.

## Storage (Fotos)
- Bucket público de solo lectura llamado `'fotos-productos'` (máx 5MB, jpeg/png/webp).
- Solo el admin sube, actualiza o borra fotos; la URL pública obtenida con `getPublicUrl` se guarda en `productos.foto_url` y se usa directo en `<img src="...">`.

## Reglas de trabajo
1. Trabaja por fases y detente al terminar cada una para que yo la pruebe.
2. No agregues funciones que no pedí. Código simple y comentado en español.
3. No inventes credenciales: usa variables claras para la URL y la anon key.
4. Deja que `supabase-js` maneje la sesión; no guardes tokens a mano.
5. No toques `schema.sql` sin avisarme: lo reviso yo antes de ejecutarlo.