## What changed?

<!-- One or two sentences describing the change itself. -->

## Why?

<!-- Motivation. Link the issue this closes with `Closes #NNN` when applicable. -->

## Testing

<!-- How did you verify it? Which commands/tests did you run? -->

## Documentation

<!-- Does README/SETUP/customer-docs need updating? Done here or tracked separately? -->

## Security considerations

<!-- New env vars, auth changes, file/storage access, secrets handling. "None" is fine. -->

## Breaking changes

<!-- Any change to API contracts, env vars, DB shape, or upgrade behavior. "None" is fine. -->

## Checklist

- [ ] Tests added/updated where appropriate and `npm run test:coverage` passes (90%+ lines)
- [ ] Existing tests pass
- [ ] `npm run verify:public-purity` passes (no private-surface references)
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Documentation updated where needed
- [ ] Commits are signed off (DCO: `git commit -s`)
- [ ] No secrets committed
- [ ] Breaking changes documented

Note: `npm run lint` currently reports pre-existing React Compiler
diagnostics and is advisory in CI (see `.github/workflows/ci.yml`);
new code should still not add lint errors.
