-- Admin SQL runner function.
-- Allows authenticated admins to execute arbitrary SQL from the app.
-- SELECT/WITH/EXPLAIN/SHOW → returns rows as JSONB array.
-- Everything else → executes and returns affected row count.
-- Admin role is verified inside the function before anything runs.
--
-- NOTE: Uses FOR rec IN EXECUTE loop to avoid EXECUTE...INTO which
-- the Supabase SQL editor misinterprets as CREATE TABLE AS SELECT.

create or replace function public.admin_execute_sql(p_sql text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rows      jsonb := '[]'::jsonb;
  v_rec       record;
  v_count     integer;
  v_norm      text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Access denied: admin role required';
  end if;

  -- Strip single-line comments before checking statement type
  v_norm := trim(upper(regexp_replace(p_sql, '--[^\n]*', '', 'g')));

  if v_norm like 'SELECT%'
  or v_norm like 'WITH%'
  or v_norm like 'EXPLAIN%'
  or v_norm like 'SHOW%'
  then
    for v_rec in execute p_sql loop
      v_rows := v_rows || to_jsonb(v_rec);
    end loop;

    return jsonb_build_object(
      'type',     'select',
      'rows',     v_rows,
      'rowCount', jsonb_array_length(v_rows)
    );
  else
    execute p_sql;
    get diagnostics v_count = row_count;

    return jsonb_build_object(
      'type',     'mutation',
      'rows',     '[]'::jsonb,
      'rowCount', v_count
    );
  end if;

exception when others then
  return jsonb_build_object(
    'error',  sqlerrm,
    'detail', sqlstate
  );
end;
$$;

revoke all on function public.admin_execute_sql(text) from public;
grant execute on function public.admin_execute_sql(text) to authenticated;
