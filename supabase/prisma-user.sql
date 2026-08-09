-- ClientFlow development database setup
-- IMPORTANT:
-- 1. Replace CHANGE_ME_WITH_A_STRONG_PASSWORD.
-- 2. Run this in Supabase SQL Editor.
-- 3. Never commit a real password into this file.

create user "prisma"
with password 'ZauraizRao@77'
bypassrls
createdb;

grant "prisma" to "postgres";

grant usage on schema public to prisma;
grant create on schema public to prisma;

grant all privileges
on all tables in schema public
to prisma;

grant all privileges
on all sequences in schema public
to prisma;

grant all privileges
on all routines in schema public
to prisma;

alter default privileges
for role postgres
in schema public
grant all on tables to prisma;

alter default privileges
for role postgres
in schema public
grant all on sequences to prisma;

alter default privileges
for role postgres
in schema public
grant all on routines to prisma;
