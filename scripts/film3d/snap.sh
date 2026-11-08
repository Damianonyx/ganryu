#!/bin/bash
# Snapshot the source into a separate folder and serve it on another port,
# so renders are not disturbed by edits (hot reload) in the working tree.
# usage: snap.sh <port>
set -e
PORT=${1:-8081}
SNAP=/tmp/claude-0/snap-$PORT
mkdir -p $SNAP
# copy everything but the heavy folders
(cd /home/user/ganryu && tar cf - --exclude=./node_modules --exclude=./artifacts --exclude=./.git --exclude=./dist --exclude=./.output .) | (cd $SNAP && tar xf -)
[ -e $SNAP/node_modules ] || ln -s /home/user/ganryu/node_modules $SNAP/node_modules
if ! curl -s -o /dev/null http://127.0.0.1:$PORT/film-lab; then
  (cd $SNAP && nohup node scripts/with-app-env.mjs npx vite dev --port $PORT --strictPort > /tmp/claude-0/snap-$PORT.log 2>&1 &)
  for i in $(seq 1 60); do sleep 2; curl -s -o /dev/null http://127.0.0.1:$PORT/film-lab && break; done
fi
echo "serving $SNAP on $PORT"
