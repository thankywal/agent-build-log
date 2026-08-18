#!/bin/bash
# The denominator: what the provider actually charged for the same window.
#
# Measured from the Monitoring API, never from the request log. If you divide
# request seconds by request seconds you will prove whatever you already believe.
#
#   GCP_PROJECT=your-project SERVICE=your-service ./billable.sh 2026-08-12
set -euo pipefail

D="${1:?usage: billable.sh YYYY-MM-DD}"
P="${GCP_PROJECT:?set GCP_PROJECT}"
SVC="${SERVICE:?set SERVICE}"
FROM="${FROM_HOUR:-13:30:00}"
TO="${TO_HOUR:-14:30:00}"

METRIC="run.googleapis.com/container/billable_instance_time"
FILTER="metric.type=\"$METRIC\" AND resource.label.service_name=\"$SVC\""

curl -sG "https://monitoring.googleapis.com/v3/projects/$P/timeSeries" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  --data-urlencode "filter=$FILTER" \
  --data-urlencode "interval.startTime=${D}T${FROM}Z" \
  --data-urlencode "interval.endTime=${D}T${TO}Z" \
  --data-urlencode "aggregation.alignmentPeriod=3600s" \
  --data-urlencode "aggregation.perSeriesAligner=ALIGN_SUM" \
  --data-urlencode "aggregation.crossSeriesReducer=REDUCE_SUM" \
| python3 -c '
import json, sys
data = json.load(sys.stdin)
if "error" in data:
    print("ERR", data["error"].get("message"))
    raise SystemExit(1)
total = 0.0
for series in data.get("timeSeries", []):
    for point in series.get("points", []):
        value = point["value"]
        total += float(value.get("doubleValue", value.get("int64Value", 0)))
print(f"billable_instance_time : {total:.1f}s")
'
