// Tests guard-bash and guard-edits the way Claude Code runs them: the command is read from the settings file,
// once from backend/.claude/settings.json (a session started in backend/) and once from the root
// .claude/settings.json (a session started at the repo root), so a wrong path in either file fails too.
// Run: `node --test backend/.claude/hooks/guards.test.mjs` from the root (CI runs it from backend/).
// No dependencies; the only fixture is a migration that is already committed.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'

const repo = path.resolve(import.meta.dirname, '../../..')
const backend = path.join(repo, 'backend')

const SESSIONS = [
  { name: 'root', dir: repo, prefix: 'backend/' },
  { name: 'backend', dir: backend, prefix: '' },
]

// The PreToolUse command for `matcher`, with $CLAUDE_PROJECT_DIR filled in as Claude Code would.
const hookCommand = (dir, matcher) => {
  const settings = JSON.parse(fs.readFileSync(path.join(dir, '.claude', 'settings.json'), 'utf8'))
  const entry = settings.hooks?.PreToolUse?.find((hook) => hook.matcher === matcher)
  assert.ok(entry, `${path.relative(repo, dir) || '.'}/.claude/settings.json has no PreToolUse hook for ${matcher}`)
  return entry.hooks[0].command.replaceAll('$CLAUDE_PROJECT_DIR', dir)
}

const run = (dir, matcher, toolInput) =>
  spawnSync(hookCommand(dir, matcher), {
    shell: true,
    cwd: dir,
    input: JSON.stringify({ tool_input: toolInput }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
  })

const committedMigration = execFileSync('git', ['ls-files', 'alembic/versions/*.py'], { cwd: backend, encoding: 'utf8' })
  .split('\n')
  .find(Boolean)

for (const { name, dir, prefix } of SESSIONS) {
  describe(`guard-edits, session started in ${name}`, () => {
    const edit = (file) => run(dir, 'Edit|Write|MultiEdit', { file_path: file })
    const blocked = [
      ['a committed migration (absolute path)', path.join(backend, committedMigration ?? '')],
      ['a committed migration (relative path)', `${prefix}${committedMigration}`],
      ['backend/.env', path.join(backend, '.env')],
      ['backend/.env.local', path.join(backend, '.env.local')],
      ['backend/poetry.lock', path.join(backend, 'poetry.lock')],
    ]
    const allowed = [
      ['a file in backend/app', path.join(backend, 'app', 'main.py')],
      ['a new, uncommitted migration', path.join(backend, 'alembic', 'versions', '9999999999_new_revision.py')],
      ['backend/.env.example', path.join(backend, '.env.example')],
      ['a frontend file', path.join(repo, 'frontend', 'src', 'main.tsx')],
    ]

    test('finds a committed migration to test with', () => assert.ok(committedMigration))
    for (const [label, file] of blocked) {
      test(`blocks ${label}`, () => {
        const result = edit(file)
        assert.equal(result.status, 2, result.stderr)
        assert.match(result.stderr, /BLOCKED by guard-edits/)
      })
    }
    for (const [label, file] of allowed) {
      test(`allows ${label}`, () => assert.equal(edit(file).status, 0))
    }
  })

  describe(`guard-bash, session started in ${name}`, () => {
    const bash = (command) => run(dir, 'Bash', { command })
    const blocked = [
      'git push --force origin main',
      'git push -f',
      'git reset --hard HEAD~1',
      'git clean -fd',
      'git checkout .',
      'git restore --staged .',
      'git branch -D old-branch',
      'poetry run alembic downgrade -1',
      'cd backend && poetry run alembic downgrade base',
      'poetry -C backend run alembic downgrade -1',
      'poetry --directory=backend run alembic downgrade -1',
      'docker compose down -v',
      'docker volume rm zona_db',
      'cat backend/.env',
      'tail -n 5 .env',
      'cat README.md backend/.env',
      'poetry add httpx',
      'poetry --directory backend add httpx',
      'pip install httpx',
      'uv add httpx',
      'rm -rf app',
      'rm -rf backend',
      'rm -rf backend/app',
      'rm -rf backend/alembic/versions',
      'rm -r frontend/src',
      'rm -rf frontend',
      'rm -rf .claude',
      'rm -rf .',
      'sudo rm -rf /',
      'psql -c "DROP TABLE users"',
      'sqlite3 data/app.db "DELETE FROM bookings"',
    ]
    const allowed = [
      'git status',
      'git push origin fix/root-guard-hooks',
      "git commit -m 'never run git reset --hard'",
      'pnpm lint',
      'poetry run pytest',
      'poetry -C backend run alembic upgrade head',
      'cat backend/.env.example',
      'rm -rf frontend/dist',
      'rm -rf frontend/node_modules',
      'rm -rf .venv',
      'rm -rf data/app.db',
      'sqlite3 data/app.db "SELECT count(*) FROM users"',
    ]

    for (const command of blocked) {
      test(`blocks ${command}`, () => {
        const result = bash(command)
        assert.equal(result.status, 2, result.stderr)
        assert.match(result.stderr, /BLOCKED by guard-bash/)
      })
    }
    for (const command of allowed) {
      test(`allows ${command}`, () => assert.equal(bash(command).status, 0))
    }
  })
}
