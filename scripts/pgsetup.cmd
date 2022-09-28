@echo on

setlocal

set PGROOT=%1
if %PGROOT% == "" exit 1
set PATH=%PATH%;%PGROOT%\bin
set BI_DIFFIX_HOME=%userprofile%\.bi_diffix\postgres
set BI_DIFFIX_LOGFILE=%BI_DIFFIX_HOME%\logfile

if not exist "%BI_DIFFIX_HOME%" (
    mkdir "%BI_DIFFIX_HOME%"
    if %errorlevel% neq 0 exit /b %errorlevel%

    REM Init a fresh database in home dir.
    initdb -U %username% -D %BI_DIFFIX_HOME%
    if %errorlevel% neq 0 exit /b %errorlevel%

    REM Configure a separate port for the `bi_diffix` instance.
    echo port = 20432>>"%BI_DIFFIX_HOME%\postgresql.auto.conf"
    if %errorlevel% neq 0 exit /b %errorlevel%
)

REM Start the server, if isn't running.
pg_ctl -w -D %BI_DIFFIX_HOME% -l %BI_DIFFIX_LOGFILE% status
if %errorlevel% neq 0 (
    pg_ctl -w -D %BI_DIFFIX_HOME% -l %BI_DIFFIX_LOGFILE% start
)
if %errorlevel% neq 0 exit /b %errorlevel%

REM Test the server running.
psql -U %username% -d postgres -p 20432 -c "SHOW config_file"
if %errorlevel% neq 0 exit /b %errorlevel%

REM Setup users/tables and the `pg_diffix` extension.
for /f %%i in ('psql -U %username% -d postgres -p 20432 -XAtc "SELECT 1 FROM pg_database WHERE datname='bi_diffix'"') do set HAS_BI_DIFFIX=%%i

if not "%HAS_BI_DIFFIX%" == "1" (
    psql -v "ON_ERROR_STOP=1" -U %username% -d postgres -p 20432 -f "..\scripts\init.sql"
)
if %errorlevel% neq 0 exit /b %errorlevel%
