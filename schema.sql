-- =====================================================================
--  schema.sql · Sistema de gestión para mueblería (1 negocio, N sucursales)
--  Para Supabase: SQL Editor > New query > pegar > Run.
--  Ejecutar UNA sola vez en un proyecto nuevo (no es re-ejecutable).
-- =====================================================================
--
--  FUNCIONES RPC  ->  supabase.rpc('nombre', { parámetros })
--
--   registrar_entrada({ p_producto_id, p_sucursal_id, p_estado, p_cantidad })
--       Solo admin. Crea p_cantidad piezas (estado 'disponible' o 'en_produccion').
--   registrar_venta({ p_inventario_id, p_precio_final })
--       disponible -> vendido.
--   registrar_envio({ p_inventario_id })
--       vendido -> enviado.
--   trasladar_mueble({ p_inventario_id, p_sucursal_destino })
--       Mueve una pieza disponible o en_produccion a otra sucursal.
--   marcar_disponible({ p_inventario_id })
--       en_produccion -> disponible.
--   completar_tarea({ p_tarea_id })     Solo el empleado al que se la asignaron.
--   iniciar_tarea({ p_tarea_id })       pendiente -> en_progreso.
--
--  Admin y empleado usan las mismas funciones; el empleado solo puede
--  operar piezas de SU sucursal (se valida dentro de cada función).
--
--  Ciclo de vida de una pieza:
--     en_produccion -> disponible -> vendido -> enviado
--  Nadie hace INSERT/UPDATE directo sobre inventario ni movimientos:
--  todo pasa por las funciones, que actualizan el inventario y registran
--  el movimiento en la misma transacción.
-- =====================================================================


-- =====================================================================
-- 1. TABLAS
-- =====================================================================

create table public.sucursales (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  ubicacion  text,
  creado_en  timestamptz not null default now()
);

create table public.usuarios (
  id           uuid primary key references auth.users(id) on delete cascade,
  nombre       text not null,
  rol          text not null check (rol in ('admin', 'empleado')),
  sucursal_id  uuid references public.sucursales(id),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  -- un empleado siempre pertenece a una sucursal; el admin puede no tener
  constraint empleado_requiere_sucursal check (rol = 'admin' or sucursal_id is not null)
);

create table public.productos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  categoria    text,
  tipo_madera  text,
  precio_base  numeric(12,2) not null default 0 check (precio_base >= 0),
  foto_url     text,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create table public.inventario (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid not null references public.productos(id),
  sucursal_id    uuid not null references public.sucursales(id),
  estado         text not null check (estado in ('en_produccion', 'disponible', 'vendido', 'enviado')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.movimientos (
  id               uuid primary key default gen_random_uuid(),
  inventario_id    uuid not null references public.inventario(id),
  tipo             text not null check (tipo in ('entrada', 'traslado', 'venta', 'envio', 'ajuste')),
  usuario_id       uuid not null references public.usuarios(id),
  sucursal_origen  uuid references public.sucursales(id),
  sucursal_destino uuid references public.sucursales(id),
  fecha            timestamptz not null default now(),
  precio_final     numeric(12,2) check (precio_final is null or precio_final >= 0)
);

create table public.tareas (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descripcion   text,
  asignado_a    uuid not null references public.usuarios(id),
  creado_por    uuid not null default auth.uid() references public.usuarios(id),
  sucursal_id   uuid not null references public.sucursales(id),
  estado        text not null default 'pendiente' check (estado in ('pendiente', 'en_progreso', 'completada')),
  fecha_limite  date,
  creado_en     timestamptz not null default now(),
  completada_en timestamptz
);

create index inventario_sucursal_estado_idx on public.inventario (sucursal_id, estado);
create index inventario_producto_idx        on public.inventario (producto_id);
create index movimientos_fecha_idx          on public.movimientos (fecha desc);
create index movimientos_inventario_idx     on public.movimientos (inventario_id);
create index tareas_asignado_estado_idx     on public.tareas (asignado_a, estado);


-- =====================================================================
-- 2. FUNCIONES AUXILIARES DE ROL (SECURITY DEFINER evita recursión en RLS)
-- =====================================================================

-- Rol del usuario logueado ('admin' | 'empleado'); NULL si no existe en
-- usuarios o está inactivo.
create or replace function public.auth_rol()
returns text
language sql stable security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid() and activo
$$;

-- Sucursal del usuario logueado; NULL si no tiene o está inactivo.
create or replace function public.auth_sucursal()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select sucursal_id from public.usuarios where id = auth.uid() and activo
$$;


-- =====================================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================================

alter table public.sucursales  enable row level security;
alter table public.usuarios    enable row level security;
alter table public.productos   enable row level security;
alter table public.inventario  enable row level security;
alter table public.movimientos enable row level security;
alter table public.tareas      enable row level security;

-- Nota: (select ...) hace que Postgres evalúe la función una sola vez por
-- consulta y no una vez por fila.

-- sucursales: la lee cualquier usuario registrado y activo; el admin la gestiona
create policy sucursales_leer on public.sucursales
  for select to authenticated
  using ((select public.auth_rol()) is not null);
create policy sucursales_admin on public.sucursales
  for all to authenticated
  using ((select public.auth_rol()) = 'admin')
  with check ((select public.auth_rol()) = 'admin');

-- usuarios: cada quien ve su propia fila; el admin ve y gestiona todas.
-- Un empleado NUNCA puede modificar usuarios (ni su propio rol).
create policy usuarios_leer on public.usuarios
  for select to authenticated
  using ((select public.auth_rol()) = 'admin' or id = (select auth.uid()));
create policy usuarios_admin on public.usuarios
  for all to authenticated
  using ((select public.auth_rol()) = 'admin')
  with check ((select public.auth_rol()) = 'admin');

-- productos (catálogo): lo lee cualquier usuario registrado; el admin lo gestiona
create policy productos_leer on public.productos
  for select to authenticated
  using ((select public.auth_rol()) is not null);
create policy productos_admin on public.productos
  for all to authenticated
  using ((select public.auth_rol()) = 'admin')
  with check ((select public.auth_rol()) = 'admin');

-- inventario: admin ve todo; empleado solo su sucursal. SIN escritura directa.
create policy inventario_leer on public.inventario
  for select to authenticated
  using (
    (select public.auth_rol()) = 'admin'
    or (
      (select public.auth_rol()) = 'empleado'
      and sucursal_id = (select public.auth_sucursal())
    )
  );

-- movimientos: solo el admin los lee. SIN escritura directa.
create policy movimientos_leer_admin on public.movimientos
  for select to authenticated
  using ((select public.auth_rol()) = 'admin');

-- tareas: el empleado solo ve las que le asignaron; el admin gestiona todas.
-- El empleado cambia su estado únicamente con completar_tarea / iniciar_tarea.
create policy tareas_leer on public.tareas
  for select to authenticated
  using ((select public.auth_rol()) = 'admin' or asignado_a = (select auth.uid()));
create policy tareas_admin on public.tareas
  for all to authenticated
  using ((select public.auth_rol()) = 'admin')
  with check ((select public.auth_rol()) = 'admin');

-- Defensa en profundidad: sin privilegios de tabla para anon ni para
-- escrituras directas sobre inventario y movimientos.
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.inventario, public.movimientos from authenticated;
revoke truncate on all tables in schema public from authenticated;


-- =====================================================================
-- 4. FUNCIONES RPC (SECURITY DEFINER: se saltan RLS, por eso validan TODO)
-- =====================================================================

-- Auxiliar interna: bloquea la pieza y verifica que el llamante pueda
-- operarla (admin: cualquiera; empleado: solo de su sucursal).
create or replace function public._pieza_para_usuario(p_inventario_id uuid)
returns public.inventario
language plpgsql security definer
set search_path = public
as $$
declare
  v_rol   text := public.auth_rol();
  v_pieza public.inventario;
begin
  if auth.uid() is null or v_rol is null then
    raise exception 'No autenticado o usuario inactivo' using errcode = '42501';
  end if;

  select * into v_pieza from public.inventario where id = p_inventario_id for update;
  if not found then
    raise exception 'La pieza no existe';
  end if;

  if v_rol <> 'admin' and v_pieza.sucursal_id is distinct from public.auth_sucursal() then
    raise exception 'La pieza no pertenece a tu sucursal' using errcode = '42501';
  end if;

  return v_pieza;
end;
$$;

-- Entrada de piezas nuevas al inventario (solo admin).
create or replace function public.registrar_entrada(
  p_producto_id uuid,
  p_sucursal_id uuid,
  p_estado      text    default 'disponible',
  p_cantidad    integer default 1
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or public.auth_rol() is distinct from 'admin' then
    raise exception 'Solo un administrador puede registrar entradas' using errcode = '42501';
  end if;
  if p_estado not in ('disponible', 'en_produccion') then
    raise exception 'Estado inicial inválido: %', p_estado;
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 100 then
    raise exception 'La cantidad debe estar entre 1 y 100';
  end if;
  if not exists (select 1 from public.productos where id = p_producto_id and activo) then
    raise exception 'El producto no existe o está inactivo';
  end if;
  if not exists (select 1 from public.sucursales where id = p_sucursal_id) then
    raise exception 'La sucursal no existe';
  end if;

  for i in 1..p_cantidad loop
    insert into public.inventario (producto_id, sucursal_id, estado)
    values (p_producto_id, p_sucursal_id, p_estado)
    returning id into v_id;

    insert into public.movimientos (inventario_id, tipo, usuario_id, sucursal_destino)
    values (v_id, 'entrada', auth.uid(), p_sucursal_id);
  end loop;

  return p_cantidad;
end;
$$;

-- Venta: disponible -> vendido.
create or replace function public.registrar_venta(p_inventario_id uuid, p_precio_final numeric)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pieza public.inventario;
begin
  v_pieza := public._pieza_para_usuario(p_inventario_id);

  if p_precio_final is null or p_precio_final < 0 then
    raise exception 'Precio final inválido';
  end if;
  if v_pieza.estado <> 'disponible' then
    raise exception 'Solo se puede vender una pieza disponible (estado actual: %)', v_pieza.estado;
  end if;

  update public.inventario
     set estado = 'vendido', actualizado_en = now()
   where id = p_inventario_id;

  insert into public.movimientos (inventario_id, tipo, usuario_id, sucursal_origen, precio_final)
  values (p_inventario_id, 'venta', auth.uid(), v_pieza.sucursal_id, p_precio_final);
end;
$$;

-- Envío al cliente: vendido -> enviado.
create or replace function public.registrar_envio(p_inventario_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pieza public.inventario;
begin
  v_pieza := public._pieza_para_usuario(p_inventario_id);

  if v_pieza.estado <> 'vendido' then
    raise exception 'Solo se puede enviar una pieza vendida (estado actual: %)', v_pieza.estado;
  end if;

  update public.inventario
     set estado = 'enviado', actualizado_en = now()
   where id = p_inventario_id;

  insert into public.movimientos (inventario_id, tipo, usuario_id, sucursal_origen)
  values (p_inventario_id, 'envio', auth.uid(), v_pieza.sucursal_id);
end;
$$;

-- Traslado entre sucursales (disponible o en_produccion).
create or replace function public.trasladar_mueble(p_inventario_id uuid, p_sucursal_destino uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pieza public.inventario;
begin
  v_pieza := public._pieza_para_usuario(p_inventario_id);

  if v_pieza.estado not in ('disponible', 'en_produccion') then
    raise exception 'Solo se puede trasladar una pieza disponible o en producción (estado actual: %)', v_pieza.estado;
  end if;
  if not exists (select 1 from public.sucursales where id = p_sucursal_destino) then
    raise exception 'La sucursal de destino no existe';
  end if;
  if p_sucursal_destino = v_pieza.sucursal_id then
    raise exception 'La pieza ya está en esa sucursal';
  end if;

  update public.inventario
     set sucursal_id = p_sucursal_destino, actualizado_en = now()
   where id = p_inventario_id;

  insert into public.movimientos (inventario_id, tipo, usuario_id, sucursal_origen, sucursal_destino)
  values (p_inventario_id, 'traslado', auth.uid(), v_pieza.sucursal_id, p_sucursal_destino);
end;
$$;

-- Fin de producción: en_produccion -> disponible.
create or replace function public.marcar_disponible(p_inventario_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pieza public.inventario;
begin
  v_pieza := public._pieza_para_usuario(p_inventario_id);

  if v_pieza.estado <> 'en_produccion' then
    raise exception 'La pieza no está en producción (estado actual: %)', v_pieza.estado;
  end if;

  update public.inventario
     set estado = 'disponible', actualizado_en = now()
   where id = p_inventario_id;

  insert into public.movimientos (inventario_id, tipo, usuario_id, sucursal_origen)
  values (p_inventario_id, 'ajuste', auth.uid(), v_pieza.sucursal_id);
end;
$$;

-- Tarea: pendiente -> en_progreso (solo el empleado asignado).
create or replace function public.iniciar_tarea(p_tarea_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tarea public.tareas;
begin
  if auth.uid() is null or public.auth_rol() is null then
    raise exception 'No autenticado o usuario inactivo' using errcode = '42501';
  end if;

  select * into v_tarea from public.tareas where id = p_tarea_id for update;
  if not found then
    raise exception 'La tarea no existe';
  end if;
  if v_tarea.asignado_a is distinct from auth.uid() then
    raise exception 'La tarea no está asignada a ti' using errcode = '42501';
  end if;
  if v_tarea.estado <> 'pendiente' then
    raise exception 'Solo se puede iniciar una tarea pendiente (estado actual: %)', v_tarea.estado;
  end if;

  update public.tareas set estado = 'en_progreso' where id = p_tarea_id;
end;
$$;

-- Tarea: pendiente o en_progreso -> completada (solo el empleado asignado).
create or replace function public.completar_tarea(p_tarea_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tarea public.tareas;
begin
  if auth.uid() is null or public.auth_rol() is null then
    raise exception 'No autenticado o usuario inactivo' using errcode = '42501';
  end if;

  select * into v_tarea from public.tareas where id = p_tarea_id for update;
  if not found then
    raise exception 'La tarea no existe';
  end if;
  if v_tarea.asignado_a is distinct from auth.uid() then
    raise exception 'La tarea no está asignada a ti' using errcode = '42501';
  end if;
  if v_tarea.estado = 'completada' then
    raise exception 'La tarea ya estaba completada';
  end if;

  update public.tareas
     set estado = 'completada', completada_en = now()
   where id = p_tarea_id;
end;
$$;


-- =====================================================================
-- 5. PERMISOS DE EJECUCIÓN DE FUNCIONES
--    Por defecto Postgres da EXECUTE a todos: se retira y se concede
--    solo a usuarios autenticados.
-- =====================================================================

revoke all on function public.auth_rol()                            from public, anon;
revoke all on function public.auth_sucursal()                       from public, anon;
revoke all on function public._pieza_para_usuario(uuid)             from public, anon, authenticated;
revoke all on function public.registrar_entrada(uuid, uuid, text, integer) from public, anon;
revoke all on function public.registrar_venta(uuid, numeric)        from public, anon;
revoke all on function public.registrar_envio(uuid)                 from public, anon;
revoke all on function public.trasladar_mueble(uuid, uuid)          from public, anon;
revoke all on function public.marcar_disponible(uuid)               from public, anon;
revoke all on function public.iniciar_tarea(uuid)                   from public, anon;
revoke all on function public.completar_tarea(uuid)                 from public, anon;

grant execute on function public.auth_rol()                            to authenticated;
grant execute on function public.auth_sucursal()                       to authenticated;
grant execute on function public.registrar_entrada(uuid, uuid, text, integer) to authenticated;
grant execute on function public.registrar_venta(uuid, numeric)        to authenticated;
grant execute on function public.registrar_envio(uuid)                 to authenticated;
grant execute on function public.trasladar_mueble(uuid, uuid)          to authenticated;
grant execute on function public.marcar_disponible(uuid)               to authenticated;
grant execute on function public.iniciar_tarea(uuid)                   to authenticated;
grant execute on function public.completar_tarea(uuid)                 to authenticated;


-- =====================================================================
-- 6. STORAGE: bucket de fotos de productos
--    Bucket público de solo lectura (las fotos de catálogo se ven con una
--    URL directa en <img>). Solo el admin puede subir, cambiar o borrar.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-productos', 'fotos-productos', true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy fotos_admin_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-productos' and (select public.auth_rol()) = 'admin');

-- SELECT solo para el admin: hace falta para reemplazar fotos con upsert.
-- (Ver fotos con la URL pública NO requiere política; así tampoco se permite
-- que cualquiera con la anon key liste los archivos del bucket.)
create policy fotos_admin_leer on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-productos' and (select public.auth_rol()) = 'admin');

create policy fotos_admin_actualizar on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos-productos' and (select public.auth_rol()) = 'admin')
  with check (bucket_id = 'fotos-productos' and (select public.auth_rol()) = 'admin');

create policy fotos_admin_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-productos' and (select public.auth_rol()) = 'admin');


-- =====================================================================
-- 7. PRIMEROS DATOS (hacer a mano, NO automatizar)
-- =====================================================================
--
--  a) En Authentication > Providers > Email: DESACTIVAR "Allow new users
--     to sign up" (las cuentas las crea el admin, no el público).
--
--  b) Crear la primera sucursal:
--       insert into public.sucursales (nombre, ubicacion)
--       values ('Sucursal Principal', 'Ciudad');
--
--  c) En Authentication > Users > Add user: crear tu cuenta (correo y
--     contraseña, con "Auto Confirm User" activado). Copiar su UUID.
--
--  d) Convertirla en administrador (se ejecuta aquí, en el SQL Editor):
--       insert into public.usuarios (id, nombre, rol)
--       values ('PEGA-AQUI-EL-UUID', 'Tu nombre', 'admin');
--
--  e) Para cada empleado: crearlo en Authentication > Users y luego:
--       insert into public.usuarios (id, nombre, rol, sucursal_id)
--       values ('UUID-DEL-EMPLEADO', 'Nombre', 'empleado', 'UUID-DE-SUCURSAL');
--
--  Para dar de baja a un empleado: update public.usuarios set activo = false
--  where id = '...';  (no borrar: su historial queda en movimientos).
