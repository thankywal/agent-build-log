#!/bin/bash
# In how many five minute slots of a window did at least one instance exist?
#
# The instance count comes from the Monitoring API. It returns NO point for a
# period with nothing to count, so this divides by the slots in the window and
# never by the points returned. Divide by what came back and a service that was
# asleep for most of the day reports as mostly up.
#
#   GCP_PROJECT=your-project SERVICE=your-service \
#     ./alive.sh 2026-10-15T03:15:00Z 2026-10-16T03:15:00Z
set -euo pipefail

FROM="${1:?usage: alive.sh FROM TO, both as YYYY-MM-DDTHH:MM:SSZ}"
TO="${2:?usage: alive.sh FROM TO, both as YYYY-MM-DDTHH:MM:SSZ}"
P="${GCP_PROJECT:?set GCP_PROJECT}"
SVC="${SERVICE:?set SERVICE}"
PERIOD="${PERIOD_SECONDS:-300}"

METRIC="run.googleapis.com/container/instance_count"
FILTER="metric.type=\"$METRIC\" AND resource.label.service_name=\"$SVC\""

curl -sG "https://monitoring.googleapis.com/v3/projects/$P/timeSeries" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  --data-urlencode "filter=$FILTER" \
  --data-urlencode "interval.startTime=$FROM" \
  --data-urlencode "interval.endTime=$TO" \
  --data-urlencode "aggregation.alignmentPeriod=${PERIOD}s" \
  --data-urlencode "aggregation.perSeriesAligner=ALIGN_MAX" \
  --data-urlencode "aggregation.crossSeriesReducer=REDUCE_SUM" \
  --data-urlencode "aggregation.groupByFields=resource.label.service_name" \
  --data-urlencode "pageSize=10000" \
| FROM="$FROM" TO="$TO" PERIOD="$PERIOD" python3 -c '
import json, os, sys
from datetime import datetime, timedelta, timezone

def parse(s):
    return datetime.strptime(s[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)

data = json.load(sys.stdin)
if "error" in data:
    print("ERR", data["error"].get("message"))
    raise SystemExit(1)

start, end = parse(os.environ["FROM"]), parse(os.environ["TO"])
period = int(os.environ["PERIOD"])
slots = int((end - start).total_seconds() // period)

seen = {}
for series in data.get("timeSeries", []):
    for point in series.get("points", []):
        at = parse(point["interval"]["endTime"])
        slot = -(-int((at - start).total_seconds()) // period)   # ceiling
        if 1 <= slot <= slots:
            value = point["value"]
            n = float(value.get("doubleValue", value.get("int64Value", 0)))
            seen[slot] = max(seen.get(slot, 0), n)

alive = dead = longest = wakes = 0
longest_end = None
was_alive = False
for slot in range(1, slots + 1):
    is_alive = seen.get(slot, 0) >= 1
    if is_alive:
        alive += 1
        wakes += 0 if was_alive else 1
        dead = 0
    else:
        dead += 1
        if dead > longest:
            longest, longest_end = dead, start + timedelta(seconds=slot * period)
    was_alive = is_alive

share = alive / slots if slots else 0
print(f"slots in the window : {slots}")
print(f"points returned     : {len(seen)}")
print(f"alive               : {alive} of {slots} ({share:.1%})")
print(f"separate wakes      : {wakes}")
minutes = longest * period // 60
ended = longest_end.strftime("%Y-%m-%d %H:%M UTC") if longest_end else "never"
print(f"longest silence     : {minutes // 60}h{minutes % 60:02d}m, ended {ended}")
'
