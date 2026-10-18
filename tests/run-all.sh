#!/bin/sh
# Serves the site on :8765 and runs every suite. Exit code 1 if any fails.
cd "$(dirname "$0")/.." || exit 1
python3 -m http.server 8765 >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1; FAIL=0
for t in stats.test v3 shots flow offline seeded features batch3 login sync friends data settypes reorder core version.test; do
  node tests/$t.js > /tmp/gym-test.out 2>&1; rc=$?
  printf '== %s: %s\n' "$t" "$([ $rc = 0 ] && echo ok || echo FAILED)"
  [ $rc = 0 ] || { tail -15 /tmp/gym-test.out; FAIL=1; }
done
exit $FAIL
