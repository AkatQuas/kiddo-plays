create table if not exists items (
  id bigserial primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into items (name)
select v.name
from (values ('alpha'), ('beta')) as v(name)
where not exists (select 1 from items i where i.name = v.name);
