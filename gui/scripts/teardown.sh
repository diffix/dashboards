#!/bin/bash
set -x

PGROOT=`pg_config --bindir`
PATH=$PATH:$PGROOT
DIFFIX_DASHBOARDS_DATA="$HOME/.config/Diffix Dashboards/data"
DIFFIX_DASHBOARDS_POSTGRES="$DIFFIX_DASHBOARDS_DATA/postgres"

pg_ctl -w -D "$DIFFIX_DASHBOARDS_POSTGRES" stop
rm -rf "$DIFFIX_DASHBOARDS_DATA"
