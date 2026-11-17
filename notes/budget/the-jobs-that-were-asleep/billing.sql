-- What the waiting instance costs, from the bill and not from the price list.
--
-- Standard BigQuery billing export. Replace the table name and the project id.
-- `cost` is in the billing account's currency, so it is divided by the export's
-- own conversion rate to get US dollars. The export is for the whole billing
-- account: keep the project filter, or another project's usage lands in your
-- numbers.

-- 1. CPU that stayed allocated, per day. Run it across the day you changed the
--    minimum and the step is the change.
SELECT
  DATE(usage_start_time)                               AS day,
  ROUND(SUM(usage.amount_in_pricing_units) / 3600, 1)  AS vcpu_hours,
  ROUND(SUM(cost / currency_conversion_rate), 2)       AS usd
FROM `your-project.your_dataset.gcp_billing_export_v1_XXXXXX_XXXXXX_XXXXXX`
WHERE project.id = 'your-project'
  AND service.description = 'Cloud Run'
  AND sku.description LIKE 'Services CPU (Instance-based billing)%'
  AND usage_start_time >= TIMESTAMP('2026-10-01')
  AND usage_start_time <  TIMESTAMP('2026-11-17')
GROUP BY day
ORDER BY day;

-- 2. The bill by line for thirty days, largest first. This is where the waiting
--    instance stopped being a rounding error.
SELECT
  service.description                             AS service,
  sku.description                                 AS sku,
  ROUND(SUM(cost / currency_conversion_rate), 2)  AS usd
FROM `your-project.your_dataset.gcp_billing_export_v1_XXXXXX_XXXXXX_XXXXXX`
WHERE project.id = 'your-project'
  AND usage_start_time >= TIMESTAMP('2026-10-18')
  AND usage_start_time <  TIMESTAMP('2026-11-17')
GROUP BY service, sku
ORDER BY usd DESC
LIMIT 12;
