-- Admin SQL runner function.
-- Allows authenticated admins to execute arbitrary SQL from the app.
-- SELECT/WITH/EXPLAIN → returns rows as JSONB array.
-- Everything else → executes and returns affected row count.
-- Admin role is verified inside the function before anything runs.

create or replace function public.admin_execute_sql(p_sql text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result    jsonb;
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
    execute format(
      'select coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) from (%s) t',
      p_sql
    ) into v_result;

    return jsonb_build_object(
      'type',     'select',
      'rows',     v_result,
      'rowCount', jsonb_array_length(v_result)
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
