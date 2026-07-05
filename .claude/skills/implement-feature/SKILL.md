---
name: implement-feature
description: Implement a new PowerClock feature from a SPEC_TEMPLATE.md-style description - plan, code, tests, states. Use when the user asks to add a feature or module described in SPEC.md or a filled SPEC_TEMPLATE.
---

# Implement a feature spec-first

1. **Locate the contract.** Read the feature's section in SPEC.md, or ask the
   user to fill `SPEC_TEMPLATE.md` if none exists. No code before a written
   contract with data model + edge cases.
2. **Map to modules.** Decide what lands in `scripts/lib/` (pipeline logic),
   `src/lib/` (pure frontend logic), `src/charts/` or `src/ui/` (rendering).
   Pure logic first — it's testable.
3. **Implement** following CLAUDE.md rules; pick the matching subagent
   (backend-engineer for scripts/workflows/data, frontend-developer for UI).
4. **Tests** in `tests/` for every pure function added — include the edge cases
   listed in the spec section verbatim.
5. **Verify**: `npm test` and `npm run build` green; for UI run `npm run dev`
   and check all four render states.
6. **Stop** for human review — no commits/pushes; list what was built and any
   spec deviations marked "(assumption)".
