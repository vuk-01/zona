---
paths:
  - "frontend/src/**/*.tsx"
---

# Components

- One component per file, named export, kebab-case file name (`space-card.tsx`)
- Props type defined right above the component
- Variants (size, state) via `cva`, not if statements inside `className`
- A component does not fetch data: it gets it through props or a hook from `src/features/<name>/api/use-<name>.ts`
- A component used by one feature goes in `src/features/<name>/components/`; `src/components/` only holds what at least two features use
- A route in `src/app/routes/` only combines feature components and layout, with no data logic of its own
- Files in `src/components/ui/` stay as shadcn generates them (add new ones with `pnpm dlx shadcn@latest add <name>` inside `frontend/`); the only hand edits make a file follow DESIGN.md, each marked with a `// Zona:` comment, and they are re-applied after `shadcn add --overwrite`
- Interactive elements are `button` or `a`, never a `div` with onClick
