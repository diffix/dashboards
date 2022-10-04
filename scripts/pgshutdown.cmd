@echo on

setlocal

set PGROOT=%1
if %PGROOT% == "" exit 1
set PATH=%PATH%;%PGROOT%\bin
set BI_DIFFIX_HOME=%userprofile%\.bi_diffix\postgres
set BI_DIFFIX_LOGFILE=%BI_DIFFIX_HOME%\logfile

pg_ctl -w -D %BI_DIFFIX_HOME% -l %BI_DIFFIX_LOGFILE% stop
if %errorlevel% neq 0 exit /b %errorlevel%