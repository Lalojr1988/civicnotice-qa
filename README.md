# CivicNotice QA

**AI-assisted quality control for clear, complete, and accountable government notices.**

CivicNotice QA helps public employees identify unclear, incomplete, and internally inconsistent notices before they reach residents. It combines deterministic checks with an optional GPT-5.6 review to produce evidence-backed findings, a plain-language revision, and a documented human-review step.

## Build Week pitch

Government notices often carry consequential information, but quality-control teams must review dates, explanations, procedural instructions, and readability under tight deadlines. CivicNotice QA turns that review into a focused casework desk without turning AI into the decision-maker.

The demonstration begins with a synthetic benefits notice containing three deliberate problems:

1. a missing appeal deadline;
2. conflicting effective dates; and
3. dense procedural language.

Select a finding to jump to its evidence, compare the original and revised drafts, or upload/paste another plain-text notice.

## Product safeguards

- Decision support only: the product does not decide eligibility, legal compliance, or agency action.
- Human approval is required for every revision.
- Model findings must point to exact source text.
- Missing information becomes a reviewer placeholder; the model is instructed not to invent dates, facts, or authority.
- Responses API requests use `store: false`.
- The public prototype is intended for synthetic or public information only.

## How it works

```text
Draft notice
   ↓
Input validation
   ↓
GPT-5.6 structured review (when OPENAI_API_KEY is configured)
   ↘ rules-based fallback (when it is not)
   ↓
Evidence-linked findings + clarity score + revised draft
   ↓
Human verification and approval
```

The GPT-5.6 path uses the OpenAI Responses API with Structured Outputs. A local rules engine keeps the demonstration functional without an API key and checks common patterns such as missing appeal timing, multiple effective dates, dense sentences, and absent contact information.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

For live model-assisted reviews, set the server-side environment variable:

```bash
OPENAI_API_KEY=your_project_key
```

Do not expose the key to browser code or commit it to the repository.

## Verification

```bash
npm run lint
npm test
```

## Stack

- React and Next.js-compatible Vinext runtime
- Cloudflare-compatible server route
- OpenAI Responses API
- GPT-5.6 Structured Outputs
- TypeScript and CSS

## Status

Build Week prototype. Not legal advice and not approved for production government use.
