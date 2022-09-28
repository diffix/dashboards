CREATE DATABASE bi_diffix;
\connect bi_diffix

CREATE EXTENSION pg_diffix;

CREATE USER bi_diffix_admin WITH PASSWORD 'bi_diffix_admin';
CREATE USER bi_diffix_trusted WITH PASSWORD 'bi_diffix_trusted';

GRANT CONNECT ON DATABASE bi_diffix TO bi_diffix_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bi_diffix_admin;
ALTER USER bi_diffix_admin WITH SUPERUSER;

GRANT CONNECT ON DATABASE bi_diffix TO bi_diffix_trusted;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bi_diffix_trusted;
CALL diffix.mark_role('bi_diffix_trusted', 'anonymized_trusted');

ALTER DATABASE bi_diffix SET session_preload_libraries TO 'pg_diffix';
