# BSV Project

Standard BSV project structure:

```
Directory Structure
| - deployment-info.json
| - package.json
| - local-data/
| - frontend/
  | - package.json
  | - webpack.config.js
  | - src/
  | - public/
| - backend/
  | - package.json
  | - tsconfig.json
  | - mod.ts
  | - src/
    | - contracts/
    | - lookup-services/
    | - topic-managers/
    | - script-templates/
  | - artifacts/
  | - dist/
  | - docs/
    | - topic-managers/
    | - lookup-services/
```

Root directory can
- Compile contracts
- Compile backend (npm package)
- Build frontend
- Start frontend
- Start LARS
- Start frontend and LARS

Backend directory can:
- Compile contracts
- Compile backend (npm package)
- Publish package to NPM
- Publish package to chain (in the future)

Frontend directory can:
- Build frontend
- Start frontend
