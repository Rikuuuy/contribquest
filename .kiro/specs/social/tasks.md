# Tasks: social

These are Phase 4 (Sat 28 Nov). They need data-import groups 2 and 6, progression groups 2, 7, and 9, and presentation groups 3 and 5. On the cut list the share card goes first and raids fifth; if the share card is cut, skip group 4; if raids are cut, skip groups 2 and 3 (a challenge link starts a raid). Cut features stay playable in the prototype. Each task ends with its verify command passing and a commit naming the requirement IDs.

- [ ] 1. Pure text builders
  - [ ] 1.1 Implement `raidNames`, `challengeSearch`, `challengeUrl`, `challengeText` in `src/engine/social.ts`
    - _Requirements: 2.1, 3.2, 3.3 (FR-SOC-2, FR-SOC-3)_
  - [ ] 1.2 Write the link and text part of `tests/engine/social.test.ts`
    - _Requirements: 3.2, 3.3_
    - _Verify: `npx vitest --run tests/engine/social.test.ts`_

- [ ] 2. Raid flow and wording
  - [ ] 2.1 Add the raid branches to `newRun`'s first log line, `summaryView`, `resultsView`, and `continueLabel` using `raidNames`
    - _Requirements: 1.4, 2.2–2.5 (FR-SOC-1, FR-SOC-2, FR-OMEN-3, FR-SAV-1)_
  - [ ] 2.2 Write `tests/engine/raid-text.test.ts` with a raid built from two fixture sets
    - _Requirements: 1.3, 1.4, 2.2–2.5_
    - _Verify: `npx vitest --run tests/engine/raid-text.test.ts tests/engine/views.test.ts`_
  - [ ] 2.3 Start screen: the friend field, validation messages, `?u=&vs=` fill and start, `loadRun` with the raid loading text, errors from either profile shown with the demo link
    - _Requirements: 1.1–1.3, 2.1, 6.1, 6.2 (FR-SOC-1, FR-SOC-6, FR-IMP-1, FR-IMP-3, FR-IMP-6)_
    - _Verify: `npm run build && npx vitest --run tests/data/load.test.ts`_

- [ ] 3. Challenge links
  - [ ] 3.1 `?vs=` alone: fill the friend field, show `challengePrompt`, focus the username field; write `tests/render/start.test.ts`
    - _Requirements: 3.1 (FR-SOC-3, FR-IMP-6)_
    - _Verify: `npx vitest --run tests/render/start.test.ts`_
  - [ ] 3.2 "Copy challenge link" button in the results screen and the clipboard call with the text fallback in `main.ts`
    - _Requirements: 3.3, 3.4, 5.1 (FR-SOC-3, FR-SOC-5)_
    - _Verify: `npm run build`_

- [ ] 4. Share card
  - [ ] 4.1 Implement `cardTitle`, `cardRows`, `cardLinkLine`, `cardFileName` and finish `tests/engine/social.test.ts`
    - _Requirements: 4.1, 4.3, 4.5, 4.6 (FR-SOC-4, FR-REL-4)_
    - _Verify: `npx vitest --run tests/engine/social.test.ts`_
  - [ ] 4.2 Add the `revealAll` option to `drawMap`, and implement `SHARE_CARD` and `drawShareCard` in `src/render/share-card.ts`
    - _Requirements: 4.2–4.6, 5.2 (FR-SOC-4, FR-SOC-5)_
    - _Verify: `npm run build`_
  - [ ] 4.3 "Save share card" button: canvas, PNG data URL, preview image, download with `cardFileName`, note line
    - _Requirements: 4.1, 5.1 (FR-SOC-4, FR-SOC-5)_
    - _Verify: `npm run build`_
  - [ ] 4.4 With the Playwright power on `npm run preview`: finish a `?demo` run with Auto-timing, save the card, check it is 1200×630 and compare it with `docs/screenshots/26-share-card.png`; check the copied text; open `?vs=demo-necromancer` and check the prompt; add the steps to `tests/e2e/smoke.md`
    - _Requirements: 3.1, 3.3, 4.1–4.6 (FR-SOC-3, FR-SOC-4)_
    - _Verify: the Playwright power run in `tests/e2e/smoke.md` passes_

- [ ] 5. Module check
  - [ ] 5.1 Confirm `src/engine/social.ts` reads no `location`, `navigator`, or clock, and that no social code sends a request
    - _Requirements: 5.1 (all of FR-SOC-1 to FR-SOC-6)_
    - _Verify: `npm run typecheck && npx vitest --run tests/engine/social.test.ts tests/engine/raid-text.test.ts && ! grep -nE "location|navigator|fetch\(|Date\.now" src/engine/social.ts src/render/share-card.ts`_
