@echo off

setlocal

set LOCAL_PG_BIN=%~dp0..\pgsql\bin
set PATH=%PATH%;%LOCAL_PG_BIN%
set DIFFIX_DASHBOARDS_HOME=%userprofile%\.diffix_dashboards
set DIFFIX_DASHBOARDS_POSTGRES=%DIFFIX_DASHBOARDS_HOME%\postgres

pg_ctl -w -D %DIFFIX_DASHBOARDS_POSTGRES% stop
rd /s /q %DIFFIX_DASHBOARDS_HOME%
