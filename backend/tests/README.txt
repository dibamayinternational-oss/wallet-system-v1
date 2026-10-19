# Wallet System feature 10 and 9 automated tests

These files are intended for `backend/tests/`:

- `test_transaction_reversal.py`
- `test_transaction_history.py`

## Important compatibility note

The uploaded project source currently has the existing transfer/ledger tests, but it does not yet contain `app.services.transaction_reversal` or `app.services.transaction_history`, and its `LedgerTransaction` model does not yet declare reversal metadata. These tests therefore will not pass until those feature implementations and the migration are in place.

The tests use the same SQLite-in-memory fixture style as the project's existing `test_transfer.py`. SQLite tests do not verify PostgreSQL triggers or row-level locking. Run concurrency and trigger tests against a dedicated PostgreSQL test database before considering reversals production-ready.

Run from `backend/`:

```powershell
python -m pytest tests/test_transaction_reversal.py -v
python -m pytest tests/test_transaction_history.py -v
python -m pytest -v
```
