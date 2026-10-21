-- One result row. Every value must read true.
select jsonb_build_object(
  'function_exists', to_regprocedure('public.record_exhibition_view(text, text)') is not null,
  'runs_with_owner_rights', (select prosecdef from pg_proc where oid = to_regprocedure('public.record_exhibition_view(text, text)')),
  'visitors_can_call_it', has_function_privilege('anon', 'public.record_exhibition_view(text, text)', 'execute')
) as result;
