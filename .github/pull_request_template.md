## Linked Issue

Closes #

<!--
  Replace the issue number above.
  "Closes #N" automatically closes the issue and transitions it to Done
  in the GitHub Project board on merge.
  Use "Refs #N" if this PR addresses the issue partially.
-->

---

## Type of Change

<!-- Mark the relevant option with an [x]. -->

- [ ] `feat` — new functionality
- [ ] `fix` — bug correction
- [ ] `refactor` — code restructuring without behaviour change
- [ ] `test` — adding or correcting tests only
- [ ] `docs` — documentation only
- [ ] `chore` — tooling, dependencies, build scripts
- [ ] `ci` — CI/CD pipeline changes
- [ ] `perf` — performance improvement

---

## Summary

<!--
  Describe what this PR does and why.
  Focus on the functional intent, not the implementation details.
  One to three sentences is sufficient for most PRs.
-->

---

## Changes

<!--
  List the significant technical changes introduced.
  Group by layer where relevant (Domain / Application / Infrastructure / API).
-->

- 
- 

---

## API Contract Impact

<!--
  Complete this section if the PR modifies or introduces an API endpoint.
  Delete this section if the PR contains no API changes.
-->

- **Endpoint(s) affected:**
- **Breaking change:** Yes / No
- **Request / response schema updated in documentation:** Yes / No / N/A

---

## Test Coverage

<!--
  List the tests written or updated in this PR.
  For TDD PRs, indicate which service methods or controllers are now covered.
  Evidence for RNCP C2.2.2.
-->

- [ ] Unit tests written / updated for: 
- [ ] End-to-end tests written / updated for: 
- [ ] All existing tests pass (`npm run test` and `npm run test:e2e`)

---

## Security Considerations

<!--
  Required for any PR that touches authentication, authorisation, input
  validation, or data exposure. Delete this section if not applicable.
  Evidence for RNCP C2.2.3 (OWASP alignment).
-->

- [ ] Input is validated at the DTO level (class-validator)
- [ ] No sensitive data is exposed in the response payload
- [ ] Authorisation guards are in place for protected endpoints
- [ ] No SQL injection vector is introduced (TypeORM parameterised queries only)

---

## Self-Review Checklist

<!--
  Complete this checklist before marking the PR as ready for merge.
  Every unchecked item must be accompanied by a justification comment.
-->

- [ ] The PR title conforms to the Conventional Commits format: `<type>(<scope>): <description>`
- [ ] The branch name conforms to the naming convention: `<type>/<bounded-context>/<description>`
- [ ] The code follows the NestJS module boundaries (no cross-module direct imports)
- [ ] All new public methods and classes have JSDoc comments
- [ ] No hardcoded strings, credentials, or environment-specific values are present (use `ConfigService`)
- [ ] `npm run lint` passes with no warnings
- [ ] TypeScript compilation produces no errors (`npm run build`)
- [ ] Database migrations are included if the schema changed
- [ ] The CHANGELOG and `package.json` version are **not** manually edited (managed by `release-please`)
