create table if not exists import_jobs (
    id bigserial primary key,
    import_id varchar(64) not null unique,
    ledger_id bigint not null references ledgers(id),
    total integer not null default 0,
    imported integer not null default 0,
    skipped integer not null default 0,
    accounts_created integer not null default 0,
    skipped_unknown_type integer not null default 0,
    skipped_one_sided_entry integer not null default 0,
    skipped_invalid_date integer not null default 0,
    skipped_invalid_amount integer not null default 0,
    skipped_invalid_shape integer not null default 0,
    closed_accounts integer not null default 0,
    done boolean not null default false,
    error text,
    sample_errors text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_import_jobs_ledger_id on import_jobs(ledger_id);
