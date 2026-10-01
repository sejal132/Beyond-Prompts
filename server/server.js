import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --------------------------------------------------
// Generate a new AI response
// --------------------------------------------------

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: "Prompt is required",
      });
    }

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: prompt,
    });

    res.json({
      text: response.output_text,
    });
  } catch (error) {
    console.error("Generate error:", error);

    res.status(500).json({
      error: "Failed to generate response",
    });
  }
});

// --------------------------------------------------
// Transform existing response with pinch
// --------------------------------------------------

app.post("/api/transform", async (req, res) => {
  try {
    const { text, action } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        error: "Text is required",
      });
    }

    if (action !== "condense" && action !== "expand") {
      return res.status(400).json({
        error: "Invalid action",
      });
    }

    const currentWordCount =
      text.trim().split(/\s+/).length;

    let instruction;

    // --------------------------------------------------
    // Condense
    // --------------------------------------------------

    if (action === "condense") {
      const targetWordCount = Math.max(
        5,
        Math.round(currentWordCount * 0.6)
      );

      instruction = `
Condense the following text substantially.

The current text is approximately ${currentWordCount} words.

Rewrite it in approximately ${targetWordCount} words.

The rewritten text MUST be noticeably shorter than the input.

Prioritize the most important information.

Remove secondary details, examples, explanations,
repetition, and lower-priority information when necessary.

Repeated condensation is intentional.

If the text has already been condensed before,
continue reducing it further.

If the text is already very short, keep only the
central idea.

Do not explain what you changed.

Return only the rewritten text.

TEXT:
${text}
`;
    }

    // --------------------------------------------------
    // Expand
    // --------------------------------------------------

    else {
      const targetWordCount = Math.round(
        currentWordCount * 1.6
      );

      instruction = `
Expand the following text with additional useful detail.

The current text is approximately ${currentWordCount} words.

Rewrite it in approximately ${targetWordCount} words.

The rewritten text MUST be noticeably more detailed
than the input.

Preserve the central meaning of the original text.

Add useful explanation, context, clarification,
or examples where appropriate.

Repeated expansion is intentional.

If the text has already been expanded before,
continue adding useful detail.

Do not introduce unrelated information.

Do not explain what you changed.

Return only the rewritten text.

TEXT:
${text}
`;
    }

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: instruction,
    });

    res.json({
      text: response.output_text,
    });
  } catch (error) {
    console.error("Transform error:", error);

    res.status(500).json({
      error: "Failed to transform response",
    });
  }
});

// --------------------------------------------------
// Elaborate on lassoed text
// --------------------------------------------------

app.post("/api/elaborate", async (req, res) => {
  try {
    const { selectedText, context } = req.body;

    if (!selectedText || !selectedText.trim()) {
      return res.status(400).json({
        error: "Selected text is required",
      });
    }

    if (!context || !context.trim()) {
      return res.status(400).json({
        error: "Context is required",
      });
    }

    const instruction = `
The user is reading an AI-generated response and has
lassoed a specific part because they want to understand
that part in more depth.

ORIGINAL RESPONSE:
${context}

SELECTED PART:
${selectedText}

Elaborate specifically on the selected part.

Use the original response as context so that references,
terms, or phrases in the selected text are interpreted
correctly.

Provide useful additional explanation, context, or an
example where appropriate.

Focus only on what the user selected.

Do not repeat the entire original response.

Do not mention that the user selected or lassoed text.

Keep the explanation concise enough to work as an
inline deep-dive card.

Return only the explanation.
`;

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: instruction,
    });

    res.json({
      text: response.output_text,
    });
  } catch (error) {
    console.error("Elaborate error:", error);

    res.status(500).json({
      error: "Failed to elaborate on selected text",
    });
  }
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});