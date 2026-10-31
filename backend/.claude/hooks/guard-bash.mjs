// PreToolUse hook (matcher: Bash): blocks the commands that rules/safety.md forbids.
// A rule in a markdown file is a request; this hook is a guarantee.
// Reads the hook payload as JSON on stdin and looks at `tool_input.command`.
// Exit 0 lets the command run. Exit 2 blocks it and sends the stderr message back to the agent.
// Any parse or runtime failure exits 0, so a broken hook can never wedge the agent.
// Wired in backend/.claude/settings.json and in the root .claude/settings.json, so a session started at
// the repo root is guarded too; tested in guards.test.mjs.

// Each rule is tested against one command segment (the text between `&&`, `||`, `;`, `|` or a newline),
// anchored at the command position, so "git commit -m 'never run git reset --hard'" is not a false positive:
// single-quoted strings (other than a plain path) are removed first and the message is only an argument.
const RULES = [
  [/^git\s+push\b(?:.*\s)?(?:-f|--force|--force-with-lease)(?:\s|$)/, 'git push --force rewrites shared history; ask the user and let them run it'],
  [/^git\s+reset\s+(?:.*\s)?--hard\b/, 'git reset --hard destroys uncommitted work; ask the user first'],
  [/^git\s+clean\s+(?:.*\s)?(?:-[a-zA-Z]*f[a-zA-Z]*|--force)\b/, 'git clean -f deletes untracked files; ask the user first'],
  [/^git\s+(?:checkout|restore)\s+(?:--\s+|--staged\s+|--worktree\s+)*\.(?:\s|$)/, 'git checkout . / git restore . throws away every uncommitted change; ask the user first'],
  [/^git\s+branch\s+(?:.*\s)?-D(?:\s|$)/, 'git branch -D deletes a branch for good; ask the user first'],
  [/^(?:poetry\s+(?:(?:-C|--directory|-P|--project)(?:=|\s+)\S+\s+)?run\s+)?alembic\s+downgrade\b/,'alembic downgrade drops tables and columns with their data; ask the user first (rules/backend-db.md)'],
  [/^docker(?:\s+compose|-compose)\s+down\b(?:.*\s)?(?:-v|--volumes|-[a-zA-Z]*v[a-zA-Z]*)(?:\s|$)/, 'docker compose down -v deletes the database volume; ask the user first'],
  [/^docker\s+volume\s+(?:rm|prune)\b/, 'deleting Docker volumes deletes data; ask the user first'],
  [/^(?:cat|less|more|head|tail|bat|type|Get-Content|strings)\s+(?:\S+\s+)*\S*\.env(?!\.example)(?:\.\w+)?(?:\s|$)/,'.env holds secrets and is never printed; read .env.example instead (rules/safety.md)'],
  [/^(?:uv\s+add|uv\s+pip\s+install|pip3?\s+install|poetry\s+(?:(?:-C|--directory|-P|--project)(?:=|\s+)\S+\s+)?add)\b/,'a new backend dependency needs approval: name the package, why it is needed and the alternative, then let the user run `poetry add <package>` themselves (rules/safety.md, ADR-013)'],
]

// `rm -r` (any flag spelling) aimed at a source tree, the repo root, the home folder or a bare wildcard.
// Paths are matched as typed in backend/ (`app/`) and at the repo root (`backend/app/`, `frontend/src/`).
// `rm -rf .venv`, `rm -rf data/*.db`, `rm -rf frontend/dist` or `rm -rf frontend/node_modules` stay allowed.
const PROTECTED_RM_TARGET =
  /^(?:\.\/)?(?:(?:backend\/)?(?:app|tests|alembic|docs|\.claude)(?:\/|$)|(?:backend|frontend)\/?$|frontend\/src(?:\/|$)|\.git(?:\/|$)|\/$|~\/?$|\*$|\.\.?\/?$)|\/(?:app|tests|alembic|alembic\/versions|\.claude|backend|frontend|frontend\/src)\/?$/

// Destructive SQL handed to a database shell (`psql -c "..."`, `sqlite3 data/app.db "..."`).
const DB_SHELL = /^(?:psql|sqlite3|pgcli|litecli)\b/
const DESTRUCTIVE_SQL = /\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA|INDEX)|TRUNCATE|DELETE\s+FROM)\b/i

// Writing a file guard-edits protects from the shell: `>`/`>>`, `tee`, `sed -i`, or `cp`/`mv` onto it.
// `.env.example` (and copies like `.env.example.bak`) holds placeholders and stays writable.
const PROTECTED_FILE = /^(?:\.env(?!\.example(?:\.|$))(?:\..+)?|poetry\.lock)$/

const writeTargets = (segment) => {
  const targets = [...segment.matchAll(/>>?(?!&)\s*([^\s<>&|;]+)/g)].map((match) => match[1])
  const [cmd, ...args] = segment.split(/\s+/)
  const files = args.filter((arg) => !arg.startsWith('-') && !/^\d*>/.test(arg))
  if (cmd === 'tee') targets.push(...files)
  if (cmd === 'sed' && args.some((arg) => /^(?:-[a-zA-Z]*i|--in-place)/.test(arg))) targets.push(...files)
  if ((cmd === 'cp' || cmd === 'mv') && files.length > 1) targets.push(files[files.length - 1])
  return targets
}

const writesProtectedFile = (segment) =>
  writeTargets(segment).some((target) => PROTECTED_FILE.test(target.replace(/^["']|["']$/g, '').split('/').pop() ?? ''))

const segments = (command) =>
  command
    .split(/&&|\|\||[;|\n]/)
    .map((segment) => segment.trim().replace(/^(?:sudo|time|nohup|env(?:\s+\w+=\S*)*)\s+/, ''))
    .filter(Boolean)

const rmHitsProtectedTarget = (segment) => {
  const [cmd, ...args] = segment.split(/\s+/)
  if (cmd !== 'rm') return false
  const recursive = args.some((arg) => /^-[a-zA-Z]*[rR]/.test(arg) || arg === '--recursive')
  const targets = args.filter((arg) => !arg.startsWith('-'))
  return recursive && targets.some((target) => PROTECTED_RM_TARGET.test(target.replace(/^["']|["']$/g, '')))
}

const block = (why, command) => {
  process.stderr.write(`BLOCKED by guard-bash: ${why}\nCommand: ${command}\n`)
  process.exit(2)
}

let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  try {
    const command = String(JSON.parse(input).tool_input?.command ?? '')
    if (!command) process.exit(0)

    // A single-quoted plain path is kept (`> '.env'` is still `.env`); any other quoted text is dropped.
    const scrubbed = command.replace(/'([^']*)'/g, (quoted, text) => (/^[\w./-]+$/.test(text) ? text : "''"))
    for (const segment of segments(scrubbed)) {
      for (const [pattern, why] of RULES) {
        if (pattern.test(segment)) block(why, command)
      }
      if (rmHitsProtectedTarget(segment)) block('rm -r on a source tree, the repo root or a wildcard; delete single files, or ask the user', command)
      if (writesProtectedFile(segment)) block('writing .env or poetry.lock from the shell skips guard-edits: put placeholders in .env.example and tell the user which value to set; poetry.lock changes only through `poetry add`, which the user runs (rules/safety.md, ADR-013)', command)
    }
    // SQL is checked on the raw command: the statement is usually inside quotes.
    if (segments(command).some((segment) => DB_SHELL.test(segment)) && DESTRUCTIVE_SQL.test(command)) {
      block('DROP / TRUNCATE / DELETE FROM through a database shell; schema changes are migrations, data deletes go through the API or a --dry-run script (rules/safety.md, ADR-004)', command)
    }
    process.exit(0)
  } catch {
    process.exit(0)
  }
})
