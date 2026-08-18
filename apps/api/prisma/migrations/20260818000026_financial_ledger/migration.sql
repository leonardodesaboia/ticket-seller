CREATE TABLE ledger_accounts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT        NOT NULL UNIQUE,
  name            TEXT        NOT NULL,
  account_type    TEXT        NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  organization_id UUID        REFERENCES organizations(id),
  currency        TEXT        NOT NULL DEFAULT 'BRL',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ledger_accounts_org ON ledger_accounts (organization_id) WHERE organization_id IS NOT NULL;

CREATE TABLE ledger_transactions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type  TEXT        NOT NULL,
  source_id    TEXT        NOT NULL,
  description  TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_id)
);

CREATE INDEX ledger_transactions_source ON ledger_transactions (source_type, source_id);
CREATE INDEX ledger_transactions_occurred ON ledger_transactions (occurred_at DESC);

CREATE TABLE ledger_entries (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_transaction_id   UUID        NOT NULL REFERENCES ledger_transactions(id),
  account_id              UUID        NOT NULL REFERENCES ledger_accounts(id),
  entry_type              TEXT        NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
  amount                  BIGINT      NOT NULL CHECK (amount > 0),
  currency                TEXT        NOT NULL,
  description             TEXT,
  occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ledger_entries_transaction ON ledger_entries (ledger_transaction_id);
CREATE INDEX ledger_entries_account ON ledger_entries (account_id);
CREATE INDEX ledger_entries_occurred ON ledger_entries (occurred_at DESC, id DESC);

-- Seed: contas da plataforma
INSERT INTO ledger_accounts (code, name, account_type, currency) VALUES
  ('PLATFORM_CLEARING', 'Platform Clearing', 'ASSET', 'BRL'),
  ('PLATFORM_REVENUE', 'Platform Revenue', 'REVENUE', 'BRL')
ON CONFLICT (code) DO NOTHING;
