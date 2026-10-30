---
paths:
  - "tests/**"
---

# Backend tests

- Two layers, two folders (ADR-011):
  - `tests/unit/test_<name>_api.py`: the HTTP layer with the service mocked (`create_autospec(I<Name>Service, instance=True)` registered with `add_to_di_container`, removed with `remove_from_di_container`); routing, validation, auth, status codes and the error shape, no database
  - `tests/integration/test_<name>.py`: the whole stack against a real temporary SQLite database (or `DATABASE_URL` from the environment); records are created through the API
- Shared fixtures only in `conftest.py` files: `client` (`tests/conftest.py`), `session_factory` + `auth_service` + `listing_service` (`tests/unit/conftest.py`), `tables` + `clean_tables` + `auth_headers` + `other_auth_headers` + `listing_id` (`tests/integration/conftest.py`)
- Every endpoint has at least: the happy path, unauthenticated (`401`) for writes, forbidden (`403`) where there is an owner, not found (`404`) where there is an id, validation (`422`) where there is input (`/test-endpoint` writes the set)
- Assert on the status code and on the error shape: `response.json() == {"detail": ..., "code": ...}`, or the exact `fieldErrors` keys for `422` (ADR-005)
- Assert that responses use camelCase keys (`imageUrl`, `createdAt`), not snake_case (ADR-010)
- A unit test asserts what the endpoint passed to the service (`listing_service.create.call_args.kwargs["current_user"].id == 1`), not what the service would have done
- In integration tests, create records through the API, not by inserting rows directly; every test starts from empty tables (`clean_tables`) and does not depend on another test or on `data/app.db`
- No `time.sleep`, no network, no real files: a test runs in milliseconds and offline; the one bounded wait allowed is `Event.wait(timeout)` in a concurrency test that proves a thread is still blocked in the database (below)
- "Now" comes only from `IClock`: tests that depend on the time register `FixedClock` (`tests/utils.py`) with `add_to_di_container(IClock, ...)`, including DST dates (ADR-022)
- A test for a row changed mid-request (deleted over a second connection, a status changed between the read and the compare-and-set) is proven once by making it fail: temporarily put back the code it guards against (`get_by_id` instead of `exists`, no re-read), run the test and see it fail, then restore the fix and see it pass; the temporary change is never committed (ADR-019, ADR-023)
- A lock is proven by a concurrency test (`tests/integration/test_<name>_concurrency.py`), not by reading the code (ADR-023). A `threading.Barrier` only shows that threads reached the same line of Python, not that one is waiting in the database, so the test wraps the real lock method: thread A takes the lock, sets an `Event` and holds the transaction open until released; thread B sets its own `Event` right before calling the real lock method and another one after it returns; the test waits for B's first `Event`, asserts `not b_returned.wait(timeout=0.3)` (B is blocked in the database), then releases A and asserts the outcome (`[200, 409]`). A control test with the lock replaced by a no-op must overbook; there a `Barrier` after the count is enough, because only the order of the reads in Python matters. The same file runs on SQLite and on Postgres through `DATABASE_URL`
- Test names say what is expected: `test_patch_by_other_user_is_403`, not `test_patch_2`
- Every test function is typed (`-> None`, fixtures annotated); mypy checks `tests/` too
- A test is never deleted or skipped to make the suite green; a failing test is a finding
