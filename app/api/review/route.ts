import { analyzeNoticeLocally, normalizeModelReview } from "../../../lib/review";

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "caseId",
    "score",
    "completedChecks",
    "summary",
    "issues",
    "revisedText",
  ],
  properties: {
    caseId: { type: "string" },
    score: { type: "number", minimum: 0, maximum: 100 },
    completedChecks: { type: "integer", minimum: 0, maximum: 9 },
    summary: { type: "string" },
    issues: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "severity", "description", "evidence", "suggestion"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          description: { type: "string" },
          evidence: { type: "string" },
          suggestion: { type: "string" },
        },
      },
    },
    revisedText: { type: "string" },
  },
};

function outputText(response: Record<string, unknown>): string {
  const output = Array.isArray(response.output) ? response.output : [];
  return output
    .flatMap((item) => {
      const content = Array.isArray((item as Record<string, unknown>).content)
        ? ((item as Record<string, unknown>).content as Array<Record<string, unknown>>)
        : [];
      return content
        .filter((part) => part.type === "output_text")
        .map((part) => String(part.text ?? ""));
    })
    .join("");
}

export async function POST(request: Request) {
  let notice = "";
  try {
    const body = (await request.json()) as { notice?: unknown };
    notice = typeof body.notice === "string" ? body.notice.trim() : "";
  } catch {
    return Response.json({ error: "Submit the notice as JSON text." }, { status: 400 });
  }

  if (notice.length < 80) {
    return Response.json({ error: "The notice must contain at least 80 characters." }, { status: 400 });
  }
  if (notice.length > 20_000) {
    return Response.json({ error: "The notice must contain fewer than 20,000 characters." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json(analyzeNoticeLocally(notice));

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6",
        store: false,
        reasoning: { effort: "low" },
        instructions: `You are a quality-assurance assistant for public-sector notices. Analyze communication quality, internal consistency, dates, factual explanation, contact information, accessibility cues, and whether stated review or appeal rights include usable instructions. Do not determine legal compliance, eligibility, or the validity of an agency action. Do not invent legal requirements, authorities, deadlines, facts, or dates. When information is absent, use a bracketed reviewer placeholder. Every evidence value must be an exact continuous substring from the submitted notice. Return at most six distinct findings. The score measures clarity and actionability, not legality. The revised draft must preserve the action while making the language clearer and visibly flagging every unresolved fact for human verification.`,
        input: `Review this draft government notice:\n\n${notice}`,
        text: {
          format: {
            type: "json_schema",
            name: "civic_notice_review",
            strict: true,
            schema: reviewSchema,
          },
        },
      }),
    });

    if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}.`);
    const payload = (await response.json()) as Record<string, unknown>;
    const text = outputText(payload);
    if (!text) throw new Error("The model returned no structured text.");
    return Response.json(normalizeModelReview(JSON.parse(text), notice));
  } catch {
    return Response.json(analyzeNoticeLocally(notice));
  }
}
