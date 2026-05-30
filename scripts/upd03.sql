UPDATE sales_pipeline_deals SET
  prod_start_date = CASE
    WHEN id = 'crm-11565' THEN '2026-09-01'
    WHEN id = 'crm-11567' THEN '2026-09-01'
    WHEN id = 'crm-11571' THEN '2026-09-01'
    ELSE prod_start_date END,
  expected_close_date = CASE
    WHEN id = 'crm-11565' THEN '2026-07-01'
    WHEN id = 'crm-11567' THEN '2026-06-01'
    WHEN id = 'crm-11571' THEN '2025-10-13'
    ELSE expected_close_date END
WHERE id IN ('crm-11565','crm-11567','crm-11571','crm-row-157','crm-row-158','crm-row-160','crm-row-161','crm-row-162','crm-row-163','crm-row-164');