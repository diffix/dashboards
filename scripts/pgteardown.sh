#!/bin/bash
set -x

PGROOT=`pg_config --bindir`
PATH=$PATH:$PGROOT
BI_DIFFIX_HOME=$HOME/.bi_diffix/postgres
BI_DIFFIX_LOGFILE=$BI_DIFFIX_HOME/logfile

pg_ctl -w -D $BI_DIFFIX_HOME -l $BI_DIFFIX_LOGFILE stop
rm -rf $BI_DIFFIX_HOME
