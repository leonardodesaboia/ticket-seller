ALTER TABLE check_ins DROP CONSTRAINT "check_ins_idempotency_key";

CREATE UNIQUE INDEX "check_ins_idempotency_key_idx"
  ON check_ins(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
