# Frequent mistakes

A living log. When the agent makes the same mistake twice, add one line here: the mistake, the rule
that fixes it, the ADR behind the rule. The reviewer agents and `/review-changes` read this file first,
so a mistake logged here is caught in the next review instead of the one after. Keep entries short and
concrete; delete an entry when the mistake has not shown up for a while.

Format: `- **<what went wrong>** → <the rule> (ADR-0XX)`

## Backend

- **`ownerId` accepted from the request body** → the owner is `current_user.id` from `get_current_user`; request schemas have no `id` or `ownerId` field (ADR-006)
- **Query or ownership `if` written inside `app/<domain>/api/`** → an endpoint calls one service method; queries live in the repository, rules and exceptions in the service (ADR-014)
- **`db.commit()` called in a repository or service** → repositories `flush()`; the endpoint's `DBAPIRouter` commits on return and rolls back on raise (ADR-009)
- **Service or repository class without a `Protocol` and `@inject(alias=...)`, or a constructor that builds its own repository** → `I<Name>Service(Protocol)` + `@inject(alias=I<Name>Service)`; constructors take Protocols and the container resolves them; tests then mock the Protocol (ADR-015)
- **`__init__.py` files created in `app/<domain>/` and its subfolders** → only `app/__init__.py` exists under `app/`; domain packages are namespace packages (ADR-014)
- **`uv`, `pip install` or `python -m` used instead of the Poetry commands** → `poetry install`, `poetry run start | test | lint | typecheck | makemigrations | migrate | seed`; a dependency is proposed and the user runs `poetry add` (ADR-013)
- **Model changed, no migration generated: the table exists only on the agent's laptop** → every model change gets `poetry run makemigrations "<what>"`, read the file, `poetry run migrate`, then `poetry run alembic check` (ADR-004)
- **A committed file under `alembic/versions/` edited "to fix the migration"** → migrations are history; add a new revision (ADR-004)
- **`Base.metadata.create_all()` added to `app/app.py` "so the tables exist"** → tables come from migrations; `create_all` is allowed only in `tests/integration/conftest.py` (ADR-004)
- **Service returns the SQLAlchemy model (`-> Listing`) and the endpoint is annotated with it** → services return `...ResponseSchema.model_validate(model)`; the endpoint's return annotation is the schema (ADR-010)
- **`from __future__ import annotations` missing at the top of a new file** → ruff requires it in every file; `poetry run lint --fix` adds it (ADR-017)
- **`DateTime(timezone=True)` with `default=lambda: datetime.now(UTC)` for `created_at`** → `TIMESTAMP(timezone=True)` with `server_default=func.now()`; `sqlalchemy.DateTime` is a banned import (ADR-008)
- **Only the happy path tested, or only integration tests; or every route but one has its `*_maps_the_service_errors` unit test (bookings `POST` had none while `GET`, `PATCH` and `DELETE` did; `popular-times` had a plain 404 test instead, because its service raises one exception)** → every route gets a unit test with the service mocked plus integration tests for `401` on writes, `403` where there is an owner, `404` where there is an id, `422` with `fieldErrors` where there is input; and every route, `POST` included, has a `test_<route>_maps_the_service_errors` unit test, also when its service raises a single exception (a one-item parametrize, so the next exception lands in the same test), parametrized over every domain exception its service can raise (every `4xx` code in the route's `error_responses`), asserting the full body with `fieldErrors` (ADR-011, ADR-005)
- **`async def` endpoint on the sync session** → plain `def`; the sync engine must not run on the event loop (ADR-009)
- **`raise HTTPException(status_code=..., detail=...)` in a service, or `except Exception: pass` around a database call** → raise a domain exception from `app/<domain>/exceptions/` with `message` and `code`; catch `IntegrityError` only as ADR-019 says (UNIQUE → `409`, a foreign key → `401` or `404`) and raise the matching domain exception, unless the contract makes the write idempotent (ADR-021); never swallow (ADR-005, ADR-019)
- **Secret pasted into `settings.py` or a test "because `.env` did not load"** → defaults stay dev-only placeholders; the real value goes in `.env`, which the agent never reads or writes (rules/safety.md)
- **Uniqueness checked with a `SELECT` before the `INSERT`** → `unique=True` on the column and `IntegrityError` → `409` (ADR-007)
- **List endpoint returns `list[...ResponseSchema]` with every row** → `PaginationParams` in, `Page[...ResponseSchema]` out, `paginate()` in the repository (ADR-016)
- **N+1 test whose rows all share the same related row (one guest, one space): the identity map answers every lazy load after the first, so the test passes without the eager load** → give each list item its own related rows and count the statements for one item and for several; prove it once by removing the `joinedload`/`selectinload` and seeing the test fail (`/check-n1`, ADR-011)
- **`db.delete(model)` in a repository, a `PATCH` that never flushes, or a SELECT after a refused INSERT that assumes the refusing row is still there: a row a parallel request deleted answers `204` or `500` (users, spaces and listings all had it; favorites had the SELECT)** → `delete(Model).where(...).returning(Model.id)` and `404` on `False`, unless the contract makes the `DELETE` idempotent (ADR-021); `save()` flushes and `StaleDataError` → `404`; after a refused INSERT the read may return `None` on Postgres (READ COMMITTED): insert once more in a new SAVEPOINT, and only a second refusal re-raises (ADR-021); an integration test deletes the row over a second connection mid-request, or, between a refused INSERT and the read, in the request's own session, because SQLite keeps the write lock (ADR-005)

- **Compare-and-set `update()`/`delete()` left on the default `synchronize_session` (`"auto"` → `"evaluate"`): the WHERE is evaluated in Python against the loaded object, so the session shows the new status (or drops the object) even when the database changed no row** → `.execution_options(synchronize_session="fetch")` on every `update()`/`delete()` whose WHERE can miss; only the rows `RETURNING` names are synchronized (`set_status`, `delete_pending` in `app/bookings/repositories/booking.py`; ADR-023)

## Contract

- **Schema or route changed, `docs/entities.md` left as it was, or updated for the fields but not for the limits** → every `Field`/`Query`/`Path` limit (`max_length`, `ge`/`le`, required keys, `allow_inf_nan`) and every 4xx a route can return (including `401 invalid_token` on public reads and `422` on query and path params (every route row with `{id}` in the path must list `422`)) appears in `docs/entities.md`; both copies, `docs/entities.md` at the repo root and `backend/docs/entities.md`, change in the same commit and stay identical; run `contract-keeper` when unsure (ADR-018, ADR-002)
- **Contract changed, frontend left behind** → in this monorepo, update the frontend mocks and forms under `frontend/src/` (`features/<name>/api/<name>-api.ts`, `types.ts`, the forms in `features/<name>/components/`) in the same PR, or add them to `docs/follow-ups.md`; a list client must read `items` (ADR-018, ADR-016)
