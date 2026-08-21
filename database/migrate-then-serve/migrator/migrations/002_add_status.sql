-- 演示「发新版 + 新 migration」：第二次 compose up --build 会应用本文件
alter table items add column if not exists status text not null default 'active';

update items set status = 'active' where status is null;
