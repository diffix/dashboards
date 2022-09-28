#!/bin/bash
set -x

PGROOT=`pg_config --bindir`
PATH=$PATH:$PGROOT
BI_DIFFIX_HOME=$HOME/.bi_diffix/postgres
BI_DIFFIX_SOCKET=$BI_DIFFIX_HOME/socket
BI_DIFFIX_LOGFILE=$BI_DIFFIX_HOME/logfile

if [ ! -d $BI_DIFFIX_HOME ] 
then
  mkdir -p $BI_DIFFIX_HOME

  # Init a fresh database in home dir.
  initdb -U $USER -D $BI_DIFFIX_HOME

  # Configure a separate socket/port for the `bi_diffix` instance.
  echo "port = 20432" >> $BI_DIFFIX_HOME/postgresql.auto.conf
  echo "unix_socket_directories = '$BI_DIFFIX_SOCKET'" >> $BI_DIFFIX_HOME/postgresql.auto.conf
  mkdir $BI_DIFFIX_SOCKET
fi

# Start the server, if isn't running.
pg_ctl -w -D $BI_DIFFIX_HOME -l $BI_DIFFIX_LOGFILE status
if [ $? -ne 0 ]
then
  pg_ctl -w -D $BI_DIFFIX_HOME -l $BI_DIFFIX_LOGFILE start
fi

# Test the server running.
psql -U $USER -d postgres -p 20432 -h $BI_DIFFIX_SOCKET -c 'SHOW config_file'

# Setup users/tables and the `pg_diffix` extension.
if [ "$( psql -U $USER -d postgres -p 20432 -h $BI_DIFFIX_SOCKET -XtAc "SELECT 1 FROM pg_database WHERE datname='bi_diffix'" )" != '1' ]
then
  psql -v ON_ERROR_STOP=1 -U $USER -d postgres -p 20432 -h $BI_DIFFIX_SOCKET -f ../scripts/init.sql 
fi
