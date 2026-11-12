-- TEST-ONLY shim. Emulates the bits of Supabase (roles, auth schema) and the
-- handful of PostGIS functions VEKTOR uses, so migrations can be exercised on a
-- plain PostgreSQL server. Real deployments use Supabase's own versions.
-- Polygon geofences are NOT emulated (st_covers always false); circles are.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to current_user;

create schema if not exists extensions;
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

create publication supabase_realtime;

-- geometry / geography stand-ins (lon, lat)
create type public.geometry as (lon double precision, lat double precision);
create type public.geography as (lon double precision, lat double precision);

create function public.st_makepoint(lon double precision, lat double precision)
returns public.geometry language sql immutable as $$ select row(lon, lat)::public.geometry $$;
create function public.st_setsrid(g public.geometry, srid integer)
returns public.geometry language sql immutable as $$ select g $$;
create function public.geometry_to_geography(g public.geometry)
returns public.geography language sql immutable as $$ select row(g.lon, g.lat)::public.geography $$;
create cast (public.geometry as public.geography) with function public.geometry_to_geography(public.geometry);

create function public.st_distance(a public.geography, b public.geography)
returns double precision language sql immutable as $$
  select 2 * 6371008.8 * asin(sqrt(
    power(sin(radians(b.lat - a.lat) / 2), 2) +
    cos(radians(a.lat)) * cos(radians(b.lat)) * power(sin(radians(b.lon - a.lon) / 2), 2)))
$$;
create function public.st_dwithin(a public.geography, b public.geography, m double precision)
returns boolean language sql immutable as $$ select public.st_distance(a, b) <= m $$;
create function public.st_covers(a public.geography, b public.geography)
returns boolean language sql immutable as $$ select false $$;

-- extra stand-ins needed by the 0007 upgrade path (reads coordinates back out)
create function public.geography_to_geometry(g public.geography)
returns public.geometry language sql immutable as $$ select row(g.lon, g.lat)::public.geometry $$;
create cast (public.geography as public.geometry) with function public.geography_to_geometry(public.geography);
create function public.st_x(g public.geometry) returns double precision language sql immutable as $$ select g.lon $$;
create function public.st_y(g public.geometry) returns double precision language sql immutable as $$ select g.lat $$;
create function public.st_asgeojson(g public.geometry) returns text language sql immutable as
$$ select '{"type":"Polygon","coordinates":[[[28.0,-18.0],[28.1,-18.0],[28.1,-18.1],[28.0,-18.0]]]}'::text $$;
