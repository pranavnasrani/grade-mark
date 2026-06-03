/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface QuestionResult {
  questionNumber: number;
  correctAnswer: string;
  studentAnswer: string | null;
  isCorrect: boolean;
  pageNumber: number;
  questionTitle: string;
  optionsText?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  aiExplanation?: string;
}

export interface GradingResponse {
  scorePercentage: number;
  totalQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalOmitted: number;
  questions: QuestionResult[];
}
