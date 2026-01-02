create or replace function get_verified_profiles()
returns table (
  id uuid,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
)
as $$
begin
  return query
  select p.id, p.name, p.email, p.avatar_url, p.created_at, p.updated_at
  from profiles p
  inner join auth.users u on u.id = p.id
  where u.email_confirmed_at is not null
  order by p.name;
end;
$$ language plpgsql security definer;
