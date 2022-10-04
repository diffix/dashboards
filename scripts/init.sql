CREATE DATABASE diffix;
\connect diffix

CREATE EXTENSION pg_diffix;

CREATE USER diffix_admin WITH PASSWORD 'diffix_admin';
CREATE USER diffix_trusted WITH PASSWORD 'diffix_trusted';

GRANT CONNECT ON DATABASE diffix TO diffix_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO diffix_admin;
ALTER USER diffix_admin WITH SUPERUSER;

GRANT CONNECT ON DATABASE diffix TO diffix_trusted;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO diffix_trusted;
CALL diffix.mark_role('diffix_trusted', 'anonymized_trusted');

ALTER DATABASE diffix SET session_preload_libraries TO 'pg_diffix';
