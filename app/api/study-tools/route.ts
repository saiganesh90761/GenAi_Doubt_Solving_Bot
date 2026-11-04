import { openrouter } from "@/lib/openrouter";
import { config } from "@/lib/config";

export const maxDuration = 60;

interface StudyToolRequest {
  action: "simplify" | "derive" | "example" | "summary" | "flashcards" | "mcqs";
  topic: string;
  answerContent: string;
  documentName?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StudyToolRequest;
    const { action, topic, answerContent } = body;

    if (!answerContent || !action) {
      return Response.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const model = config.models.chatModel;
    if (!model) {
      return Response.json({ error: "MODEL_NAME not configured" }, { status: 500 });
    }

    const systemPrompt = "You are an expert engineering tutor who explains complex concepts with precision, rigorous mathematics, and clear pedagogical intuition.";
    let userPrompt = "";

    switch (action) {
      case "simplify":
        userPrompt = `Please re-explain the following engineering answer in simpler, more intuitive language. Use an everyday analogy first, then introduce the core technical terms gently. Keep any essential formulas properly formatted in LaTeX ($...$).
Topic: ${topic}
Answer:
${answerContent}`;
        break;

      case "derive":
        userPrompt = `Please provide a thorough, step-by-step mathematical derivation for the formulas and principles in the following answer. Show every intermediate algebraic transition, boundary condition, and physical meaning of the variables in LaTeX ($$...$$).
Topic: ${topic}
Answer:
${answerContent}`;
        break;

      case "example":
        userPrompt = `Please give a detailed, practical real-world engineering system example (e.g. automotive, aerospace, power grid, HVAC, or computing architecture) illustrating the principles in this answer. Include realistic operating numbers and step-by-step calculations where appropriate.
Topic: ${topic}
Answer:
${answerContent}`;
        break;

      case "summary":
        userPrompt = `Please provide a concise, high-yield engineering revision summary of this answer. Structure it with:
1. Core Principle (1-2 sentences)
2. Governing Equations (LaTeX)
3. Critical Assumptions & Limitations
4. 3 Quick Exam Revision Takeaways
Topic: ${topic}
Answer:
${answerContent}`;
        break;

      case "flashcards":
        userPrompt = `Based on the following engineering explanation, generate 3 high-yield revision flashcards for exam preparation.
Format each card clearly as:
**Card [Number]: [Concept Title]**
- **Front (Prompt/Question):** [Clear concept or formula question]
- **Back (Answer & Formula):** [Precise answer with LaTeX formula]
Topic: ${topic}
Answer:
${answerContent}`;
        break;

      case "mcqs":
        userPrompt = `Based on the following answer, generate 3 challenging, university exam-style Multiple Choice Questions (MCQs) testing conceptual and calculation understanding.
Format each as:
**Question [Number]:** [Problem statement]
A) [Option]
B) [Option]
C) [Option]
D) [Option]
**Correct Answer:** [Letter]
**Explanation:** [Step-by-step reason with formulas in LaTeX]
Topic: ${topic}
Answer:
${answerContent}`;
        break;
    }

    const completion = await openrouter.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const part of completion) {
            const text = part.choices[0]?.delta?.content;
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Error generating study tool response";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal study tool error";
    return Response.json({ error: message }, { status: 500 });
  }
}
