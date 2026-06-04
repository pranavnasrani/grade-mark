/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Configure body-parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure multer to parse multipart file uploads into memory buffers
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 45 * 1024 * 1024, // 45MB max file size (IGCSE PDF papers can be large)
  },
});

// Lazy-initialize Gemini SDK to fail gracefully if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not defined.");
      throw new Error("GEMINI_API_KEY is not configured on the server. Please add it via Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// ---------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------

/**
 * Health check endpoint
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * Endpoint to grade the uploaded exam against the mark scheme
 */
app.post("/api/grade-exam", upload.fields([
  { name: 'markScheme', maxCount: 1 },
  { name: 'studentScript', maxCount: 1 }
]), async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const markSchemeFile = files?.['markScheme']?.[0];
    const studentScriptFile = files?.['studentScript']?.[0];

    if (!markSchemeFile) {
      res.status(400).json({ error: "Missing official Mark Scheme asset file." });
      return;
    }
    if (!studentScriptFile) {
      res.status(400).json({ error: "Missing Student Exam Script asset file." });
      return;
    }

    const ai = getGeminiClient();

    // Prepare files into Gemini InlineParts
    const markSchemePart = {
      inlineData: {
        data: markSchemeFile.buffer.toString("base64"),
        mimeType: markSchemeFile.mimetype,
      },
    };

    const studentScriptPart = {
      inlineData: {
        data: studentScriptFile.buffer.toString("base64"),
        mimeType: studentScriptFile.mimetype,
      },
    };

    console.log("Analyzing and extracting accurate answers from Mark Scheme using gemini-3.1-flash-lite...");
    
    // Extract correct solutions from Mark Scheme
    const markSchemePrompt = `You are a high-precision Cambridge IGCSE grading evaluator. Please scan this official MCQ Mark Scheme.
Identify each question number and the single corresponding correct option capital letter (A, B, C, or D).
Extract all official question keys present in the paper. Make sure to map them accurately.`;

    const markSchemeResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: {
        parts: [
          markSchemePart,
          { text: markSchemePrompt }
        ]
      },
      config: {
        systemInstruction: "You are an expert examiner logic module. Extract IGCSE correct keys as raw structural tables. Answer option letters must be single characters (A, B, C, or D).",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "List of correct options parsed from the mark scheme document.",
          items: {
            type: Type.OBJECT,
            properties: {
              questionNumber: {
                type: Type.INTEGER,
                description: "The integer index of the exam question (e.g., 1, 2, 3)."
              },
              correctAnswer: {
                type: Type.STRING,
                description: "The correct upper-cased choice letter (A, B, C, or D)."
              }
            },
            required: ["questionNumber", "correctAnswer"]
          }
        },
        temperature: 0.1,
      }
    });

    const parsedMarkSchemeText = markSchemeResponse.text;
    if (!parsedMarkSchemeText) {
      throw new Error("Could not extract answer key list from the Mark Scheme document.");
    }
    const markSchemeAnswers: Array<{ questionNumber: number; correctAnswer: string }> = JSON.parse(parsedMarkSchemeText);

    console.log("Mark Scheme parsed successfully. Total questions parsed:", markSchemeAnswers.length);

    console.log("Analyzing student's circled choices inside Student Exam paper using gemini-3.1-flash-lite...");

    // Extract student's written/circled/tickmarked options from Student Script
    const studentPrompt = `You are an expert Cambridge IGCSE visual evaluation model. Examine this Student's submitted MCQ Exam script.
Identify what option selection (A, B, C, or D) is currently circled, checkmarked, crossed, annotated, or filled in by the student for each question.
Pay close, analytical attention to Apple Pencil markings, hand annotations, custom ink symbols, colored pen circles, or other selection marks around option letters A, B, C, and D.

In addition, document:
- The exact physical page number of the student script where the question is visible.
- The title or topic summary of the question (e.g., "Finding kinetic energy of a falling object").

If no option has any mark, or if the student has left the question blank, return null for studentAnswer.`;

    const studentResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: {
        parts: [
          studentScriptPart,
          { text: studentPrompt }
        ]
      },
      config: {
        systemInstruction: "You are a state-of-the-art computer vision scoring model for Apple Pencil circles. Identify selection targets with extreme localized visual scrutiny.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Details extracted indicating student answer options checked on the test paper.",
          items: {
            type: Type.OBJECT,
            properties: {
              questionNumber: {
                type: Type.INTEGER,
                description: "The integer index of this question."
              },
              studentAnswer: {
                type: Type.STRING,
                description: "The option letter (A, B, C, or D) selected or circled by the student. Set to null if completely blank or omitted.",
                nullable: true
              },
              pageNumber: {
                type: Type.INTEGER,
                description: "The page of this document (1-indexed) where this specific question resides."
              },
              questionTitle: {
                type: Type.STRING,
                description: "A short human-friendly subject sentence describing what this question tests."
              }
            },
            required: ["questionNumber", "studentAnswer", "pageNumber", "questionTitle"]
          }
        },
        temperature: 0.1,
      }
    });

    const parsedStudentText = studentResponse.text;
    if (!parsedStudentText) {
      throw new Error("Could not extract student answers from the student script document.");
    }
    const studentAnswers: Array<{
      questionNumber: number;
      studentAnswer: string | null;
      pageNumber: number;
      questionTitle: string;
    }> = JSON.parse(parsedStudentText);

    console.log("Student paper parsed successfully. Answers extracted:", studentAnswers.length);

    // Python-like comparison logic: match question pairs and identify discrepancies deterministically on the server
    const gradedQuestions = studentAnswers.map(studentAns => {
      const match = markSchemeAnswers.find(m => Number(m.questionNumber) === Number(studentAns.questionNumber));
      const correctAnswer = match ? match.correctAnswer.trim().toUpperCase() : "N/A";
      const rawStudentAns = studentAns.studentAnswer ? studentAns.studentAnswer.trim().toUpperCase() : null;
      const studentAnswer = rawStudentAns === "" ? null : rawStudentAns;
      
      const isOmitted = studentAnswer === null;
      const isCorrect = !isOmitted && studentAnswer === correctAnswer;

      return {
        questionNumber: studentAns.questionNumber,
        correctAnswer,
        studentAnswer,
        isCorrect,
        pageNumber: studentAns.pageNumber || 1,
        questionTitle: studentAns.questionTitle || `Question ${studentAns.questionNumber}`
      };
    });

    // Sort questions numerically
    gradedQuestions.sort((a, b) => a.questionNumber - b.questionNumber);

    // Compute descriptive statistics
    const totalQuestions = gradedQuestions.length;
    const totalCorrect = gradedQuestions.filter(q => q.isCorrect).length;
    const totalOmitted = gradedQuestions.filter(q => q.studentAnswer === null).length;
    const totalIncorrect = totalQuestions - totalCorrect - totalOmitted;
    const scorePercentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    res.json({
      scorePercentage,
      totalQuestions,
      totalCorrect,
      totalIncorrect,
      totalOmitted,
      questions: gradedQuestions,
    });

  } catch (error: any) {
    console.error("Grading execution pipeline failure:", error);
    res.status(500).json({ error: error?.message || "An unexpected error occurred during grading processing." });
  }
});

/**
 * Dynamic dynamic tutoring explanation generator on-demand
 */
app.post("/api/explain-question", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { questionNumber, questionTitle, studentAnswer, correctAnswer } = req.body;

    if (!questionNumber) {
      res.status(400).json({ error: "Missing questionNumber index." });
      return;
    }

    const ai = getGeminiClient();

    const explanationPrompt = `You are an expert Cambridge IGCSE school tutor specializing in MCQ exams.
Provide a clear, detailed, step-by-step educational analysis for the following wrong or challenging question on an exam script.

Question Details:
- Question Number: ${questionNumber}
- Subject/Topic of Question: ${questionTitle || "IGCSE Concept"}
- Correct Option: ${correctAnswer}
- Student's Selected Option: ${studentAnswer || "No answer chosen (Omitted)"}

Please write an exceptionally clear and supportive explanation formatted beautifully with:
1. **Core Concept**: Explain the underlying scientific, chemical, or mathematical laws or keywords.
2. **Step-by-Step Derivation**: Walk through the logic on how to reason or calculate to get option ${correctAnswer}.
3. **Student Pitfall**: Suggest why a student might mistakenly select ${studentAnswer || "leave the question blank"}, and what memory cues or techniques they can use in the future to avoid this mistake.

Keep your response in structured reader-friendly Markdown. Do not praise yourself; keep it focused strictly on the topic and students learning.`;

    console.log(`Generating visual step explanation for Question #${questionNumber}...`);
    const explanationResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: explanationPrompt,
    });

    const explanationText = explanationResponse.text;
    res.json({ explanation: explanationText || "Explanations could not be formulated for this item." });

  } catch (error: any) {
    console.error("Explanation generation failed:", error);
    res.status(500).json({ error: error?.message || "An error occurred while creating AI tutorials." });
  }
});


// ---------------------------------------------------------
// VITE OR STATIC HANDLING FOR THE FRONTEND PORT
// ---------------------------------------------------------

const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    // Development mode server
    const { createServer: createViteServer } = await eval('import("vite")');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware connected.");
  } else {
    // Production statics
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static build folder in production mode.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched successfully and listening on http://0.0.0.0:${PORT}`);
  });
};

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Critical server launch error:", err);
  });
}

export default app;
