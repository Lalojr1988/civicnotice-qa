"use client";

import { ChangeEvent, ReactNode, useMemo, useRef, useState } from "react";
import {
  SAMPLE_NOTICE,
  SAMPLE_REVIEW,
  type NoticeIssue,
  type NoticeReview,
} from "../lib/review";

type ReviewStatus = "idle" | "reviewing" | "complete" | "error";

function HighlightedNotice({
  notice,
  issues,
  selectedIssue,
  onSelect,
}: {
  notice: string;
  issues: NoticeIssue[];
  selectedIssue: string | null;
  onSelect: (id: string) => void;
}) {
  const parts = useMemo(() => {
    const ranges = issues
      .map((issue) => {
        const start = notice.toLowerCase().indexOf(issue.evidence.toLowerCase());
        return start >= 0
          ? { start, end: start + issue.evidence.length, issue }
          : null;
      })
      .filter(
        (range): range is { start: number; end: number; issue: NoticeIssue } =>
          Boolean(range),
      )
      .sort((a, b) => a.start - b.start)
      .filter((range, index, all) => index === 0 || range.start >= all[index - 1].end);

    if (!ranges.length) return [notice];

    const nodes: ReactNode[] = [];
    let cursor = 0;
    ranges.forEach((range) => {
      if (range.start > cursor) nodes.push(notice.slice(cursor, range.start));
      nodes.push(
        <button
          className={`document-highlight ${
            selectedIssue === range.issue.id ? "is-selected" : ""
          }`}
          key={`${range.issue.id}-${range.start}`}
          onClick={() => onSelect(range.issue.id)}
          title={`Review: ${range.issue.title}`}
          type="button"
        >
          {notice.slice(range.start, range.end)}
        </button>,
      );
      cursor = range.end;
    });
    if (cursor < notice.length) nodes.push(notice.slice(cursor));
    return nodes;
  }, [issues, notice, onSelect, selectedIssue]);

  return <div className="notice-copy">{parts}</div>;
}

function SeverityBadge({ severity }: { severity: NoticeIssue["severity"] }) {
  return <span className={`severity severity-${severity}`}>{severity}</span>;
}

export default function Home() {
  const [noticeText, setNoticeText] = useState(SAMPLE_NOTICE);
  const [review, setReview] = useState<NoticeReview>(SAMPLE_REVIEW);
  const [activeTab, setActiveTab] = useState<"original" | "revised">("original");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(
    SAMPLE_REVIEW.issues[0]?.id ?? null,
  );
  const [status, setStatus] = useState<ReviewStatus>("complete");
  const [error, setError] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function runReview(text: string) {
    setStatus("reviewing");
    setError("");
    setActiveTab("original");

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice: text }),
      });
      const payload = (await response.json()) as NoticeReview & { error?: string };
      if (!response.ok) throw new Error(payload.error || "The review could not be completed.");

      setNoticeText(text);
      setReview(payload);
      setSelectedIssue(payload.issues[0]?.id ?? null);
      setStatus("complete");
    } catch (caught) {
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "The review could not be completed.");
    }
  }

  function loadSample() {
    setNoticeText(SAMPLE_NOTICE);
    setReview(SAMPLE_REVIEW);
    setSelectedIssue(SAMPLE_REVIEW.issues[0]?.id ?? null);
    setActiveTab("original");
    setError("");
    setStatus("complete");
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 60_000) {
      setError("Use a plain-text file smaller than 60 KB for this prototype.");
      setStatus("error");
      return;
    }
    const text = await file.text();
    if (text.trim().length < 80) {
      setError("The uploaded notice is too short to review.");
      setStatus("error");
      return;
    }
    await runReview(text.trim());
  }

  function reviewPastedNotice() {
    if (pasteText.trim().length < 80) {
      setError("Paste at least 80 characters from the draft notice.");
      setStatus("error");
      return;
    }
    setShowPaste(false);
    void runReview(pasteText.trim());
  }

  function downloadReport() {
    const findings = review.issues
      .map(
        (issue, index) =>
          `${index + 1}. ${issue.title.toUpperCase()} [${issue.severity}]\nEvidence: ${
            issue.evidence
          }\nFinding: ${issue.description}\nReviewer action: ${issue.suggestion}`,
      )
      .join("\n\n");
    const report = `CIVICNOTICE QA REVIEW\nCase: ${review.caseId}\nScore: ${
      review.score
    }/100\nChecks completed: ${review.completedChecks}/${review.totalChecks}\nReview mode: ${
      review.source
    }\n\nFINDINGS\n${findings || "No issues flagged."}\n\nREVISED DRAFT\n${
      review.revisedText
    }\n\nAdvisory output only. An authorized employee must verify requirements and approve changes.`;
    const url = URL.createObjectURL(new Blob([report], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${review.caseId.toLowerCase()}-review.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const selected = review.issues.find((issue) => issue.id === selectedIssue);
  const reviewLabel =
    review.source === "gpt-5.6"
      ? "GPT-5.6 assisted review"
      : review.source === "local-rules"
        ? "Rules-based review"
        : "Demonstration review";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="CivicNotice QA home">
          CivicNotice QA
        </a>
        <button
          className="trust-pill"
          onClick={() => document.getElementById("guardrail-note")?.scrollIntoView({ behavior: "smooth" })}
          type="button"
        >
          <span aria-hidden="true">✓</span> Human-reviewed AI
        </button>
        <div className="case-meta" aria-label={`Current case ${review.caseId}`}>
          <span>{review.caseId}</span>
          <span className="avatar" aria-hidden="true">GR</span>
        </div>
      </header>

      <div className="page" id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <p className="eyebrow">Public-service quality control</p>
            <h1 id="hero-title">Find notice problems before residents do</h1>
            <p className="hero-copy">
              Review clarity, completeness, and procedural details so residents
              receive information they can understand and act on.
            </p>
          </div>
          <div className="hero-actions">
            <button className="button button-primary" onClick={loadSample} type="button">
              Load sample case
            </button>
            <button
              className="button button-secondary"
              onClick={() => fileInput.current?.click()}
              type="button"
            >
              Upload text draft
            </button>
            <button className="text-action" onClick={() => setShowPaste(true)} type="button">
              or paste notice text
            </button>
            <input
              accept=".txt,.md,text/plain,text/markdown"
              className="visually-hidden"
              onChange={handleFile}
              ref={fileInput}
              type="file"
            />
          </div>
        </section>

        {showPaste && (
          <section className="paste-panel" aria-labelledby="paste-title">
            <div className="paste-heading">
              <div>
                <p className="eyebrow">New review</p>
                <h2 id="paste-title">Paste a draft notice</h2>
              </div>
              <button aria-label="Close paste panel" className="close-button" onClick={() => setShowPaste(false)} type="button">×</button>
            </div>
            <textarea
              autoFocus
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="Paste the complete draft notice here. Do not use confidential or personally identifiable information in this prototype."
              value={pasteText}
            />
            <div className="paste-actions">
              <span>{pasteText.length.toLocaleString()} characters</span>
              <button className="button button-primary compact" onClick={reviewPastedNotice} type="button">
                Review notice
              </button>
            </div>
          </section>
        )}

        {status === "error" && (
          <div className="error-banner" role="alert">
            <strong>Review paused.</strong> {error}
          </div>
        )}

        <section className={`workspace ${status === "reviewing" ? "is-loading" : ""}`} aria-busy={status === "reviewing"}>
          <aside className="metrics-column" aria-label="Review summary">
            <article className="metric-card score-card">
              <div className="metric-heading">
                <h2>Clarity score</h2>
                <span className="mode-dot" title={reviewLabel} aria-label={reviewLabel} />
              </div>
              <div className="score-number">{status === "reviewing" ? "—" : review.score}</div>
              <div className="score-rule" />
              <p>Score reflects how easy this notice may be to understand and act on.</p>
            </article>

            <article className="metric-card progress-card">
              <h2>Checks complete</h2>
              <div
                className="progress-ring"
                style={{
                  "--progress": `${(review.completedChecks / review.totalChecks) * 360}deg`,
                } as React.CSSProperties}
                aria-label={`${review.completedChecks} of ${review.totalChecks} checks complete`}
                role="img"
              >
                <div>{status === "reviewing" ? "…" : `${review.completedChecks} / ${review.totalChecks}`}</div>
              </div>
              <p>Resolve or document each finding before approving this notice.</p>
            </article>

            <article className="metric-card review-mode-card">
              <p className="eyebrow">Review mode</p>
              <strong>{reviewLabel}</strong>
              <p>{review.summary}</p>
            </article>
          </aside>

          <article className="document-panel" aria-label="Notice document">
            <div className="document-toolbar">
              <div className="tabs" role="tablist" aria-label="Notice versions">
                <button
                  aria-selected={activeTab === "original"}
                  className={activeTab === "original" ? "active" : ""}
                  onClick={() => setActiveTab("original")}
                  role="tab"
                  type="button"
                >
                  Original
                </button>
                <button
                  aria-selected={activeTab === "revised"}
                  className={activeTab === "revised" ? "active" : ""}
                  onClick={() => setActiveTab("revised")}
                  role="tab"
                  type="button"
                >
                  Revised
                </button>
              </div>
              <button className="download-button" onClick={downloadReport} type="button">
                Download report <span aria-hidden="true">↓</span>
              </button>
            </div>

            <div className="document-body" role="tabpanel">
              {status === "reviewing" ? (
                <div className="reviewing-state">
                  <div className="scanner" aria-hidden="true" />
                  <strong>Reviewing the notice…</strong>
                  <span>Checking dates, instructions, clarity, and review rights.</span>
                </div>
              ) : activeTab === "original" ? (
                <HighlightedNotice
                  issues={review.issues}
                  notice={noticeText}
                  onSelect={setSelectedIssue}
                  selectedIssue={selectedIssue}
                />
              ) : (
                <div className="notice-copy revised-copy">{review.revisedText}</div>
              )}
            </div>

            {selected && activeTab === "original" && (
              <div className="evidence-footer">
                <span className="finding-index">{review.issues.findIndex((item) => item.id === selected.id) + 1}</span>
                <div>
                  <strong>{selected.title}</strong>
                  <p>{selected.suggestion}</p>
                </div>
              </div>
            )}
          </article>

          <aside className="issues-panel" aria-label="Issues to resolve">
            <div className="issues-heading">
              <div>
                <p className="eyebrow">Triage queue</p>
                <h2>Issues to resolve <span>({review.issues.length})</span></h2>
              </div>
              <span className="review-count">{review.completedChecks}/{review.totalChecks}</span>
            </div>

            <div className="issue-list">
              {status === "reviewing" ? (
                [1, 2, 3].map((item) => <div className="issue-skeleton" key={item} />)
              ) : review.issues.length ? (
                review.issues.map((issue, index) => (
                  <button
                    className={`issue-card ${selectedIssue === issue.id ? "is-selected" : ""}`}
                    key={issue.id}
                    onClick={() => {
                      setSelectedIssue(issue.id);
                      setActiveTab("original");
                    }}
                    type="button"
                  >
                    <span className="alert-icon" aria-hidden="true">!</span>
                    <span className="issue-content">
                      <span className="issue-title-row">
                        <strong>{issue.title}</strong>
                        <SeverityBadge severity={issue.severity} />
                      </span>
                      <span className="issue-description">{issue.description}</span>
                      <span className="review-link">Review finding {index + 1} <span aria-hidden="true">→</span></span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="all-clear">
                  <span aria-hidden="true">✓</span>
                  <strong>No issues flagged</strong>
                  <p>Complete a human review before approving the notice.</p>
                </div>
              )}
            </div>
          </aside>
        </section>

        <footer className="guardrail-note" id="guardrail-note">
          <div className="guardrail-icon" aria-hidden="true">i</div>
          <div>
            <strong>Decision support—not an adjudication system.</strong>
            <p>
              CivicNotice QA flags possible communication and process issues. It does not determine legal compliance, eligibility, or agency action. An authorized employee must verify every requirement and approve all changes.
            </p>
          </div>
          <span>Prototype · Synthetic data only</span>
        </footer>
      </div>
    </main>
  );
}
