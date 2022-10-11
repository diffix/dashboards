@echo off

setlocal

set LOCAL_PG_BIN=%~dp0..\pgsql\bin
set PATH=%PATH%;%LOCAL_PG_BIN%
set DIFFIX_DASHBOARDS_HOME=%userprofile%\.diffix_dashboards\postgres
set DIFFIX_DASHBOARDS_LOGFILE=%DIFFIX_DASHBOARDS_HOME%\logfile

pg_ctl -w -D %DIFFIX_DASHBOARDS_HOME% -l %DIFFIX_DASHBOARDS_LOGFILE% stop
rd /s /q %userprofile%\.diffix_dashboards\postgres
