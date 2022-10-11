@echo off

setlocal

set LOCAL_PG_BIN=%~dp0..\pgsql\bin
set PATH=%PATH%;%LOCAL_PG_BIN%
set BI_DIFFIX_HOME=%userprofile%\.bi_diffix\postgres
set BI_DIFFIX_LOGFILE=%BI_DIFFIX_HOME%\logfile

pg_ctl -w -D %BI_DIFFIX_HOME% -l %BI_DIFFIX_LOGFILE% stop
rd /s /q %userprofile%\.bi_diffix\postgres
