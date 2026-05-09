# Monaco Editor in Angular — Setup Guide

Audience: AI agents wiring `monaco-editor` into an Angular app. Two scopes covered: **Angular CLI** and **Nx**. The mechanics are identical; only the config file differs.

---

## Concepts (read first)

- Monaco ships three builds: `esm/` (recommended), `min/` and `dev/` (AMD — **deprecated** since v0.53.0, will be removed).
- Use `esm/` only. Never copy the whole `node_modules/monaco-editor` folder — it bloats the dist with all three builds plus typings.
- Monaco runs language services in **Web Workers**. The browser must be told where to fetch each worker via `window.MonacoEnvironment.getWorkerUrl`.
- Workers are static JS files served from `assets/`. They are not bundled by Angular — they are copied as-is.
- pnpm used in this example, mechanics are the same, always use project's own package-manager
  
---

## Scope 1: Angular CLI

### 1. Install

```bash
pnpm add monaco-editor
```

Pin to a known version (e.g. `^0.55.1`).
search web looking for the latest version and use it, or ask the user their preference.
Verify `node_modules/monaco-editor/esm/vs/` exists after install.

### 2. Copy the ESM build to `assets/`

Edit `angular.json` → `projects.<app>.architect.build.options.assets`. Add a second entry alongside the existing `public` glob:

```json
"assets": [
  { "glob": "**/*", "input": "public" },
  {
    "glob": "**/*",
    "input": "node_modules/monaco-editor/esm",
    "output": "/assets/monaco/"
  }
]
```

Notes:
- `input` points at `esm` — **not** the package root. This is the bloat-prevention step.
- `output: "/assets/monaco/"` means files land at `dist/<app>/browser/assets/monaco/vs/...` and are served at `/assets/monaco/vs/...` at runtime.

### 3. Create the worker polyfill

Create `src/polyfill.ts`:

```ts
import { Environment } from 'monaco-editor';

declare global {
  interface Window {
    MonacoEnvironment?: Environment;
  }
}

window.MonacoEnvironment = {
  getWorkerUrl: (_moduleId: string, label: string) => {
    const base = './assets/monaco/vs';
    switch (label) {
      case 'json':
        return `${base}/language/json/json.worker.js`;
      case 'css':
      case 'scss':
      case 'less':
        return `${base}/language/css/css.worker.js`;
      case 'html':
      case 'handlebars':
      case 'razor':
        return `${base}/language/html/html.worker.js`;
      case 'typescript':
      case 'javascript':
        return `${base}/language/typescript/ts.worker.js`;
      default:
        return `${base}/editor/editor.worker.js`;
    }
  },
};
```

Critical:
- `base` matches step 2's `output`, minus the leading slash, plus `/vs` (because the `esm` directory's contents — including a `vs/` folder — are copied directly under `/assets/monaco/`).
- `MonacoEnvironment` **must be set before any `monaco-editor` import executes**. Putting it in a polyfill (loaded before app code) guarantees this.

### 4. Register the polyfill

In `angular.json` → same `options` block:

```json
"polyfills": [
  "src/polyfill.ts"
]
```

If the project already has a `polyfills` entry (e.g. `"zone.js"`), append `"src/polyfill.ts"` to the array — do not replace.

### 5. Use the editor in a component

```ts
import { Component, ElementRef, OnInit, viewChild } from '@angular/core';
import { editor } from 'monaco-editor';

@Component({
  selector: 'app-root',
  imports: [],
  template: `
    <div class="h-screen">
      <div #editor class="h-full w-full border"></div>
    </div>
  `,
})
export class App implements OnInit {
  private readonly editorContainer = viewChild.required<ElementRef<HTMLDivElement>>('editor');

  ngOnInit(): void {
    editor.create(this.editorContainer().nativeElement, {
      language: 'javascript',
      value: 'console.log("Hello, Monaco Editor!");',
    });
  }
}
```

Notes:
- The host element **must have a non-zero height** or Monaco renders nothing. Use `h-full` / `height: 100%` and ensure the parent chain is sized.
- Import only what you use: `import { editor } from 'monaco-editor'` — do not `import * as monaco`.

### 6. Verify

```bash
pnpm start
```

Open DevTools → Network. Confirm:
- `assets/monaco/vs/editor/editor.main.js` loads.
- A worker (`*.worker.js`) is fetched when typing.

If workers 404: the `base` path in `polyfill.ts` is wrong. If the editor renders empty: check container height.

---

## Scope 2: Nx

Identical mechanics — different file. The `@angular/build:application` builder reads the same schema whether invoked from `angular.json` or Nx's `project.json`.

### 1. Install at the workspace root

```bash
pnpm add monaco-editor -w
```

### 2. Edit `apps/<app>/project.json`

Locate `targets.build.options`. Apply the same three changes as steps 2 + 4 above:

```json
{
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "options": {
        "assets": [
          { "glob": "**/*", "input": "apps/<app>/public" },
          {
            "glob": "**/*",
            "input": "node_modules/monaco-editor/esm",
            "output": "/assets/monaco/"
          }
        ],
        "polyfills": ["apps/<app>/src/polyfill.ts"],
        "styles": ["apps/<app>/src/styles.css"]
      }
    }
  }
}
```

Nx-specific notes:
- `input` is **relative to the workspace root**, not the project. `node_modules/monaco-editor/esm` works as-is — no `../../` prefix needed.
- `polyfills` is also workspace-root-relative — use the full path `apps/<app>/src/polyfill.ts`.
- If using `@nx/angular:application` instead of `@angular/build:application`, the schema is the same.

### 3. Polyfill + component

Identical to Scope 1, steps 3 and 5. File path becomes `apps/<app>/src/polyfill.ts`.

If the polyfill is shared across multiple apps in the monorepo, place it in a lib (e.g. `libs/monaco-setup/src/index.ts`) and reference it from each app's `polyfills` array — the import path will be the lib's resolved path.

### 4. Verify

```bash
nx serve <app>
```

Same Network checks as Scope 1.

---

## Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Editor area blank | Container height is 0 | Give parent + container a fixed/percent height |
| `Could not create web worker` | `MonacoEnvironment` set after `monaco-editor` was imported | Put setup in a polyfill, not in `main.ts` after imports |
| Worker 404s | `base` path mismatch with `output` in assets | Match: `output: "/assets/monaco/"` ↔ `base: "./assets/monaco/vs"` |
| Dist size > 50MB | Copying the whole package | Use `input: "node_modules/monaco-editor/esm"`, not `node_modules/monaco-editor` |
| Workers fail in subfolder deploy | `base` is absolute (`/assets/...`) | Use relative `./assets/...` so it works under any base href |
| `MonacoEnvironment` typed as `any` | Missing global declaration | Use the `declare global { interface Window { ... } }` block in the polyfill |

---

## Do not

- Do not use the AMD build (`min/` or `dev/`) — deprecated, custom workers already broken.
- Do not import the editor's CSS manually (`editor.main.css`). The ESM build injects styles itself.
- Do not call `editor.create()` in a constructor — the `viewChild` element does not exist yet. Use `ngOnInit` or later.
- Do not use `* as monaco` imports — it defeats tree-shaking.
