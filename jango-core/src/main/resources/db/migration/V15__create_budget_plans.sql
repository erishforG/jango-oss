CREATE TABLE budget_plans (
    id BIGSERIAL PRIMARY KEY,
    ledger_id BIGINT NOT NULL REFERENCES ledgers(id),
    year INTEGER NOT NULL,
    goal_month VARCHAR(6) NOT NULL,
    goal_amount DECIMAL(18,2) NOT NULL,
    avg_income DECIMAL(18,2) NOT NULL,
    avg_expense DECIMAL(18,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(ledger_id, year)
);

CREATE INDEX idx_budget_plans_ledger_year ON budget_plans(ledger_id, year);

CREATE TABLE budget_plan_months (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
    year_month VARCHAR(7) NOT NULL,
    planned_income DECIMAL(18,2) NOT NULL,
    planned_expense DECIMAL(18,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(plan_id, year_month)
);

CREATE INDEX idx_budget_plan_months_plan ON budget_plan_months(plan_id);
