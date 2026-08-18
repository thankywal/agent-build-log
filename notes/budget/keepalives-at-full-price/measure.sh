#!/bin/bash
# The numerator: every request in the window that reported a latency, bucketed.
#
# This is half of the measurement. The other half (billable.sh) comes from a
# completely different API on purpose. Two independent sources is what makes the
# ratio survive someone checking it, because no single subsystem can be both the
# thing being measured and the thing reporting the measurement.
#
#   GCP_PROJECT=your-project SERVICE=your-service STREAM_PATH=/your/stream \
#     ./measure.sh 2026-08-12
set -euo pipefail

D="${1:?usage: measure.sh YYYY-MM-DD}"
P="${GCP_PROJECT:?set GCP_PROJECT}"
SVC="${SERVICE:?set SERVICE}"
# The long lived endpoint you are investigating. Everything else falls through
# to a bucket you should open before you trust any of this. Mine was hiding the
# next bug in it.
STREAM="${STREAM_PATH:-/events}"
FROM="${FROM_HOUR:-13:30:00}"
TO="${TO_HOUR:-14:30:00}"

gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SVC\"
   AND httpRequest.latency!=\"\"
   AND timestamp>=\"${D}T${FROM}Z\" AND timestamp<\"${D}T${TO}Z\"" \
  --project "$P" --limit 5000 \
  --format="value(httpRequest.requestUrl,httpRequest.latency,httpRequest.userAgent)" \
| STREAM="$STREAM" python3 -c '
import os, sys
stream = os.environ["STREAM"]
total = 0.0
rows = []
for line in sys.stdin:
    parts = line.rstrip("\n").split("\t")
    if len(parts) < 2:
        continue
    url, latency = parts[0], parts[1]
    agent = parts[2] if len(parts) > 2 else ""
    try:
        seconds = float(latency.rstrip("s"))
    except ValueError:
        continue
    rows.append((url, seconds, agent))
    total += seconds

def bucket(url, agent):
    if stream in url:
        return "event stream"
    if "Google-Cloud-Scheduler" in agent or "cron" in url:
        return "scheduled jobs"
    return "everything else"

agg = {}
for url, seconds, agent in rows:
    key = bucket(url, agent)
    n, t = agg.get(key, (0, 0.0))
    agg[key] = (n + 1, t + seconds)

print(f"requests with a latency: {len(rows)}")
print(f"summed request seconds : {total:.1f}")
for key, (n, t) in sorted(agg.items(), key=lambda kv: -kv[1][1]):
    print(f"  {key:22} n={n:5d}  {t:9.1f}s")
'
