# Contributing

Thank you for helping improve JEE Question Generator. Contributions should
keep the existing learning flows working while making the code easier to
understand and test.

## Before you start

1. Read the [project documentation](docs/README.md).
2. Check open issues and existing pull requests.
3. For a substantial change, open an issue first so the scope and behavior
   are clear.
4. Never commit Firebase service-account files, OAuth credentials, API keys,
   model tokens, or local environment files.

## Local development

Use the setup instructions in the [README](README.md). Run the backend and
frontend separately during development. Keep generated model data and local
build output out of commits unless a change explicitly requires them.

## Making a change

- Keep changes focused and follow the existing module boundaries.
- Preserve public route names and response shapes unless the change is
  intentionally an API migration.
- Add or update tests before changing behavior.
- For agent changes, test deterministic helpers without requiring live model
  calls whenever possible.
- Update the relevant page under [docs/](docs/README.md) when architecture,
  routes, API behavior, or configuration changes.

## Verification

Run the smallest relevant checks, then broader checks when practical:

```powershell
.\venv\Scripts\python.exe -m pytest backend\tests
cd frontend
npm test -- --watchAll=false
npm run build
```

If a test requires credentials or an external model, document the limitation
and provide a deterministic replacement or stub where possible.

## Pull requests

Pull requests should include:

- A concise explanation of the problem and solution.
- The user-visible or API behavior that changed.
- Tests added or run, including any known limitations.
- Documentation updates for structural or behavioral changes.
- Screenshots or a short recording for meaningful UI changes.

Use a descriptive branch name such as `feature/placement-history` or
`fix/jee-distractors`. Keep commits small enough to review and avoid mixing
formatting-only changes with behavior changes.

## Reporting bugs

Include the environment, reproduction steps, expected behavior, actual
behavior, relevant logs, and whether the issue affects JEE mode, placement
mode, authentication, or persistence. Remove tokens and personal data before
posting logs.
