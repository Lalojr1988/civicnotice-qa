export type Severity = "high" | "medium" | "low";

export type NoticeIssue = {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  evidence: string;
  suggestion: string;
};

export type NoticeReview = {
  caseId: string;
  score: number;
  completedChecks: number;
  totalChecks: number;
  summary: string;
  issues: NoticeIssue[];
  revisedText: string;
  source: "sample" | "gpt-5.6" | "local-rules";
};

export const SAMPLE_NOTICE = `ILLINOIS FAMILY SUPPORT SERVICES
NOTICE OF BENEFIT CHANGE

Notice date: July 15, 2026

Your monthly food assistance benefit will be reduced beginning August 1, 2026. This action takes effect August 5, 2026.

Pursuant to applicable program requirements and based upon information contained in the agency record, the Department has recalculated the household allotment after applying the relevant income standards, deductions, household-composition rules, and other factors governing benefit issuance.

You may appeal this decision by submitting a written request to the Department. If you need help understanding this notice, call (800) 555-0147.

This fictional notice is provided only for the CivicNotice QA demonstration.`;

export const SAMPLE_REVIEW: NoticeReview = {
  caseId: "Case CN-240187",
  score: 72,
  completedChecks: 6,
  totalChecks: 9,
  summary: "Three findings need human review before this notice is approved.",
  source: "sample",
  issues: [
    {
      id: "appeal-deadline",
      title: "Missing appeal deadline",
      severity: "high",
      description: "The notice offers an appeal but does not state when the request is due.",
      evidence: "You may appeal this decision by submitting a written request to the Department.",
      suggestion: "Verify the governing requirement and insert the exact deadline and filing instructions.",
    },
    {
      id: "effective-dates",
      title: "Conflicting effective dates",
      severity: "medium",
      description: "The notice gives two different dates for the same benefit change.",
      evidence: "beginning August 1, 2026. This action takes effect August 5, 2026.",
      suggestion: "Confirm the authorized effective date and use one consistent date throughout the notice.",
    },
    {
      id: "dense-language",
      title: "Dense procedural language",
      severity: "low",
      description: "A long sentence uses abstract terms without explaining the specific reason for the change.",
      evidence:
        "Pursuant to applicable program requirements and based upon information contained in the agency record, the Department has recalculated the household allotment after applying the relevant income standards, deductions, household-composition rules, and other factors governing benefit issuance.",
      suggestion: "State the household-specific reason in short sentences and identify the information used.",
    },
  ],
  revisedText: `ILLINOIS FAMILY SUPPORT SERVICES
NOTICE OF BENEFIT CHANGE — DRAFT FOR REVIEW

Notice date: July 15, 2026

What is changing
Your monthly food assistance benefit will be reduced.

When the change begins
[Reviewer: confirm and insert one authorized effective date.]

Why your benefit is changing
[Reviewer: insert the household-specific factual reason, the information used, and the applicable authority.]

Your right to appeal
You may ask the Department to review this decision. Submit your request by [insert verified deadline] using these instructions: [insert filing methods and address].

Need help?
Call (800) 555-0147. [Reviewer: add accessibility and language-assistance information if required.]

This draft contains reviewer placeholders. An authorized employee must verify every requirement before sending it.`,
};

const monthPattern =
  "(?:January|February|March|April|May|June|July|August|September|October|November|December)";

function sentenceContaining(text: string, pattern: RegExp): string | null {
  return (
    text
      .split(/(?<=[.!?])\s+/)
      .find((sentence) => pattern.test(sentence))
      ?.trim() ?? null
  );
}

function longestSentence(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length)[0]
    ?.trim();
}

function buildRevisedDraft(text: string, issues: NoticeIssue[]): string {
  const reviewerActions = issues
    .map((issue) => `• ${issue.title}: ${issue.suggestion}`)
    .join("\n");
  return `PLAIN-LANGUAGE DRAFT — HUMAN REVIEW REQUIRED

What this notice says
${text.trim()}

Reviewer actions before approval
${reviewerActions || "• Complete a final policy, accuracy, and accessibility review."}

This draft preserves the submitted text and adds review instructions. It does not establish legal compliance.`;
}

export function analyzeNoticeLocally(text: string): NoticeReview {
  const normalized = text.replace(/\s+/g, " ").trim();
  const issues: NoticeIssue[] = [];
  const appealSentence = sentenceContaining(normalized, /appeal|hearing|review request/i);
  const hasDeadline = new RegExp(
    `(?:appeal|hearing|review request).{0,180}(?:within\\s+\\d+\\s+days|${monthPattern}\\s+\\d{1,2}|deadline|no later than)`,
    "i",
  ).test(normalized);

  if (appealSentence && !hasDeadline) {
    issues.push({
      id: "appeal-deadline",
      title: "Appeal timing may be incomplete",
      severity: "high",
      description: "Review rights are mentioned, but a filing deadline was not detected nearby.",
      evidence: appealSentence,
      suggestion: "Verify the governing requirement and add the exact deadline and complete filing instructions.",
    });
  }

  const effectiveSentences = normalized
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => /effective|takes effect|beginning/i.test(sentence));
  const effectiveDates = effectiveSentences
    .flatMap((sentence) => sentence.match(new RegExp(`${monthPattern}\\s+\\d{1,2},?\\s+\\d{4}`, "gi")) ?? [])
    .map((date) => date.toLowerCase());
  const uniqueEffectiveDates = [...new Set(effectiveDates)];

  if (uniqueEffectiveDates.length > 1) {
    issues.push({
      id: "effective-dates",
      title: "Multiple effective dates",
      severity: "medium",
      description: "More than one possible effective date appears in the action language.",
      evidence: effectiveSentences.join(" ").slice(0, 420),
      suggestion: "Confirm the authorized effective date and use it consistently throughout the notice.",
    });
  }

  const denseSentence = longestSentence(normalized);
  if (denseSentence && denseSentence.split(/\s+/).length >= 32) {
    issues.push({
      id: "dense-language",
      title: "Dense procedural language",
      severity: "low",
      description: "A sentence is long enough to create a readability barrier for many residents.",
      evidence: denseSentence.slice(0, 500),
      suggestion: "Break the sentence into shorter statements and replace abstract terms with the specific facts used.",
    });
  }

  const hasContact = /(?:\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}|@|contact|call|write to)/i.test(normalized);
  if (!hasContact) {
    issues.push({
      id: "contact-information",
      title: "Contact information not detected",
      severity: "medium",
      description: "The notice may not tell the resident where to ask questions or obtain help.",
      evidence: normalized.slice(-Math.min(240, normalized.length)),
      suggestion: "Add a verified phone number, address, or other authorized assistance channel.",
    });
  }

  const penalty = issues.reduce(
    (total, issue) => total + (issue.severity === "high" ? 16 : issue.severity === "medium" ? 10 : 6),
    0,
  );
  const totalChecks = 9;
  const completedChecks = Math.max(0, totalChecks - issues.length);

  return {
    caseId: `Case CN-${new Date().getUTCFullYear()}${String(normalized.length).padStart(4, "0").slice(-4)}`,
    score: Math.max(35, 96 - penalty),
    completedChecks,
    totalChecks,
    summary: issues.length
      ? `${issues.length} possible ${issues.length === 1 ? "issue needs" : "issues need"} human review.`
      : "No issues were detected by the prototype checks; human review is still required.",
    issues,
    revisedText: buildRevisedDraft(text, issues),
    source: "local-rules",
  };
}

export function normalizeModelReview(value: unknown, originalText: string): NoticeReview {
  if (!value || typeof value !== "object") throw new Error("Invalid model response.");
  const input = value as Record<string, unknown>;
  const rawIssues = Array.isArray(input.issues) ? input.issues : [];
  const issues: NoticeIssue[] = rawIssues.slice(0, 6).map((raw, index) => {
    const issue = (raw ?? {}) as Record<string, unknown>;
    const severity = ["high", "medium", "low"].includes(String(issue.severity))
      ? (String(issue.severity) as Severity)
      : "medium";
    const evidence = String(issue.evidence ?? "").trim();
    return {
      id: String(issue.id ?? `finding-${index + 1}`).replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
      title: String(issue.title ?? `Finding ${index + 1}`).slice(0, 100),
      severity,
      description: String(issue.description ?? "Human review is required.").slice(0, 400),
      evidence: originalText.toLowerCase().includes(evidence.toLowerCase())
        ? evidence
        : originalText.slice(0, Math.min(220, originalText.length)),
      suggestion: String(issue.suggestion ?? "Verify the requirement before approval.").slice(0, 500),
    };
  });

  return {
    caseId: String(input.caseId ?? `Case CN-${Date.now().toString().slice(-6)}`).slice(0, 40),
    score: Math.max(0, Math.min(100, Number(input.score) || 0)),
    completedChecks: Math.max(0, Math.min(9, Number(input.completedChecks) || 0)),
    totalChecks: 9,
    summary: String(input.summary ?? "Human review required.").slice(0, 300),
    issues,
    revisedText: String(input.revisedText ?? buildRevisedDraft(originalText, issues)).slice(0, 20_000),
    source: "gpt-5.6",
  };
}
