-- Holds metabase meta-data and administrative tables.
CREATE DATABASE metabaseappdb;
-- Holds the public and personal tables to be used with Diffix.
CREATE DATABASE diffix;
\connect diffix

CREATE EXTENSION pg_diffix;

CREATE USER diffix_admin WITH PASSWORD 'diffix_admin';
CREATE USER diffix_trusted WITH PASSWORD 'diffix_trusted';

ALTER USER diffix_admin WITH SUPERUSER;

GRANT CONNECT ON DATABASE diffix TO diffix_trusted;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO diffix_trusted;
CALL diffix.mark_role('diffix_trusted', 'anonymized_trusted');

ALTER DATABASE diffix SET session_preload_libraries TO 'pg_diffix';
