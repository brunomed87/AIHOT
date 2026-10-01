-- Allow the complete default query family to run. Keep any operator-customized budget.
UPDATE budgets SET per_minute=20,per_hour=60,per_day=500
WHERE service='brave' AND per_minute=1 AND per_hour=30 AND per_day=100;
