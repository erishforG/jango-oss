create index if not exists idx_transactions_consumer
    on transactions (consumer_user_id, consumer_tag);
