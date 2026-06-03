/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  FileCheck, 
  GraduationCap, 
  Sparkles, 
  RotateCcw, 
  Info, 
  ExternalLink,
  BookOpen,
  ArrowRight,
  Download
} from 'lucide-react';
import { QuestionResult, GradingResponse } from './types';

export default function App() {
  // Upload States
  const [markSchemeFile, setMarkSchemeFile] = useState<File | null>(null);
  const [studentScriptFile, setStudentScriptFile] = useState<File | null>(null);
  
  // Preview URLs
  const [markSchemePrev, setMarkSchemePrev] = useState<string | null>(null);
  const [studentScriptPrev, setStudentScriptPrev] = useState<string | null>(null);

  // Form Processing States
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [gradingProgress, setGradingProgress] = useState<string>("");
  
  // Response Results State
  const [result, setResult] = useState<GradingResponse | null>(null);
  
  // Filter and Accordion States
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'incorrect' | 'omitted'>('all');
  const [expandedQuestions, setExpandedQuestions] = useState<{ [key: number]: boolean }>({});
  
  // Loading Explanations Map
  const [explanationLoadingState, setExplanationLoadingState] = useState<{ [key: number]: boolean }>({});
  const [explanations, setExplanations] = useState<{ [key: number]: string }>({});

  // Dynamic status messages during API waiting times
  useEffect(() => {
    if (!isGrading) return;
    const progressSteps = [
      "Analyzing mark scheme...",
      "Extracting answer keys...",
      "Reading student answers...",
      "Grading exams...",
      "Generating results..."
    ];
    let step = 0;
    setGradingProgress(progressSteps[0]);
    const timer = setInterval(() => {
      step = (step + 1) % progressSteps.length;
      setGradingProgress(progressSteps[step]);
    }, 4500);

    return () => clearInterval(timer);
  }, [isGrading]);

  // Handle Mark Scheme selection
  const handleMarkSchemeChange = (file: File | null) => {
    if (markSchemePrev) URL.revokeObjectURL(markSchemePrev);
    if (!file) {
      setMarkSchemeFile(null);
      setMarkSchemePrev(null);
      return;
    }
    setMarkSchemeFile(file);
    if (file.type.startsWith("image/")) {
      setMarkSchemePrev(URL.createObjectURL(file));
    } else {
      setMarkSchemePrev("pdf");
    }
  };

  // Handle Student Script selection
  const handleStudentScriptChange = (file: File | null) => {
    if (studentScriptPrev) URL.revokeObjectURL(studentScriptPrev);
    if (!file) {
      setStudentScriptFile(null);
      setStudentScriptPrev(null);
      return;
    }
    setStudentScriptFile(file);
    if (file.type.startsWith("image/")) {
      setStudentScriptPrev(URL.createObjectURL(file));
    } else {
      setStudentScriptPrev("pdf");
    }
  };

  // Main Grading trigger
  const handleGradeExam = async () => {
    if (!markSchemeFile || !studentScriptFile) {
      setGradingError("Please supply both the Mark Scheme and the Student Script.");
      return;
    }

    setIsGrading(true);
    setGradingError(null);
    setResult(null);
    setExplanations({});

    try {
      const formData = new FormData();
      formData.append("markScheme", markSchemeFile);
      formData.append("studentScript", studentScriptFile);

      const response = await fetch("/api/grade-exam", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "An error occurred in the grading API pipeline.");
      }

      const scoreResult: GradingResponse = await response.json();
      setResult(scoreResult);
      
      // Auto-expand incorrectly answered questions initially to draw immediate focus!
      const initialAccordionState: { [key: number]: boolean } = {};
      scoreResult.questions.forEach(q => {
        if (!q.isCorrect) {
          initialAccordionState[q.questionNumber] = true;
        }
      });
      setExpandedQuestions(initialAccordionState);

    } catch (err: any) {
      setGradingError(err?.message || "Failed to communicate with your grading system. Please check your credentials.");
    } finally {
      setIsGrading(false);
    }
  };

  // Fetch individual step-by-step tutoring explanations on-demand
  const handleRequestExplanation = async (question: QuestionResult) => {
    const qNum = question.questionNumber;
    if (explanations[qNum] || explanationLoadingState[qNum]) return;

    setExplanationLoadingState(prev => ({ ...prev, [qNum]: true }));
    try {
      const response = await fetch("/api/explain-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionNumber: qNum,
          questionTitle: question.questionTitle,
          studentAnswer: question.studentAnswer,
          correctAnswer: question.correctAnswer
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Could not retrieve tutoring answer key tutorial.");
      }

      const data = await response.json();
      setExplanations(prev => ({ ...prev, [qNum]: data.explanation }));
    } catch (err: any) {
      setExplanations(prev => ({
        ...prev,
        [qNum]: `⚠️ Could not establish tutoring explanation: ${err?.message || "Internal Service Check"}`
      }));
    } finally {
      setExplanationLoadingState(prev => ({ ...prev, [qNum]: false }));
    }
  };

  const handleToggleAccordion = (qNum: number) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [qNum]: !prev[qNum]
    }));
  };

  const resetDashboard = () => {
    setMarkSchemeFile(null);
    setStudentScriptFile(null);
    setMarkSchemePrev(null);
    setStudentScriptPrev(null);
    setResult(null);
    setGradingError(null);
    setExplanations({});
    setExpandedQuestions({});
  };

  // Helper renderer for simulated markdown in our explanation modules
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-2.5 text-slate-700 text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h5 key={idx} className="text-sm font-semibold text-slate-900 mt-3 flex items-center gap-1.5 border-b border-slate-100 pb-1">
                <Sparkles className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                {line.replace('### ', '')}
              </h5>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h4 key={idx} className="text-base font-bold text-slate-800 mt-4 border-l-4 border-blue-500 pl-2">
                {line.replace('## ', '')}
              </h4>
            );
          }
          if (line.startsWith('* ') || line.startsWith('- ')) {
            const cleanLine = line.substring(2);
            return (
              <li key={idx} className="ml-4 list-disc pl-1 text-slate-600">
                {parseInlineBold(cleanLine)}
              </li>
            );
          }
          if (line.trim() === "") return <div key={idx} className="h-1.5" />;
          return <p key={idx}>{parseInlineBold(line)}</p>;
        })}
      </div>
    );
  };

  const parseInlineBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Filtering processed datasets
  const filteredQuestions = result 
    ? result.questions.filter(q => {
        if (filterType === 'all') return true;
        if (filterType === 'correct') return q.isCorrect;
        if (filterType === 'omitted') return q.studentAnswer === null;
        if (filterType === 'incorrect') return !q.isCorrect && q.studentAnswer !== null;
        return true;
      })
    : [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Header Banner */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl flex items-center justify-center shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">MCQ Auto-Grader</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                Paper Scoring
              </p>
            </div>
          </div>
          {result && (
            <div className="flex items-center gap-3 print:hidden">
              <button 
                id="btn_export_pdf"
                onClick={() => window.print()}
                className="text-white bg-blue-600 hover:bg-blue-700 text-sm font-medium flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button 
                id="btn_reset_header"
                onClick={resetDashboard}
                className="text-slate-600 hover:text-blue-600 text-sm font-medium flex items-center gap-2 border border-slate-200 px-3.5 py-1.5 rounded-xl hover:bg-slate-50 transition-colors bg-white"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Engine
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!result ? (
          /* SECTION A: UPLOADING PLATFORM */
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight sm:text-4xl">
                Grade test papers automatically
              </h2>
              <p className="text-slate-600 max-w-lg mx-auto text-sm leading-relaxed">
                Upload your official mark scheme along with the student's papers to calculate responses accurately.
              </p>
            </div>

            {/* Upload Boxes Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box 1: Official Mark Scheme */}
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6 transition-all hover:border-blue-400 flex flex-col justify-between shadow-sm relative">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span id="label_box_markscheme" className="text-xs font-bold text-blue-600 tracking-wider uppercase">STAGE 1</span>
                    <span className="text-xs text-slate-400">PDF, JPG, PNG</span>
                  </div>
                  <div className="text-center py-6 flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Official Mark Scheme</h3>
                      <p className="text-xs text-slate-500 mt-1">Upload keys or scoring script</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {markSchemeFile ? (
                    <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between border border-slate-100">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="text-left overflow-hidden">
                          <p className="text-xs font-semibold text-slate-700 truncate">{markSchemeFile.name}</p>
                          <p className="text-[10px] text-slate-400">{(markSchemeFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button 
                        id="btn_remove_markscheme"
                        onClick={() => handleMarkSchemeChange(null)}
                        className="text-[11px] text-red-500 font-medium hover:underline flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label id="upload_label_markscheme" className="block w-full py-2.5 px-4 bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium text-center rounded-xl cursor-pointer transition-colors shadow-sm">
                      Select Mark Scheme File
                      <input 
                        type="file" 
                        accept="application/pdf,image/*" 
                        onChange={(e) => handleMarkSchemeChange(e.target.files?.[0] || null)}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Box 2: Student Script */}
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-6 transition-all hover:border-blue-400 flex flex-col justify-between shadow-sm relative">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span id="label_box_student" className="text-xs font-bold text-indigo-600 tracking-wider uppercase">STAGE 2</span>
                    <span className="text-xs text-slate-400">PDF, JPG, PNG</span>
                  </div>
                  <div className="text-center py-6 flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Student Exam Script</h3>
                      <p className="text-xs text-slate-500 mt-1">Upload student's circled solution sheet</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {studentScriptFile ? (
                    <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between border border-slate-100">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                        <div className="text-left overflow-hidden">
                          <p className="text-xs font-semibold text-slate-700 truncate">{studentScriptFile.name}</p>
                          <p className="text-[10px] text-slate-400">{(studentScriptFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button 
                        id="btn_remove_student"
                        onClick={() => handleStudentScriptChange(null)}
                        className="text-[11px] text-red-500 font-medium hover:underline flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label id="upload_label_studentscript" className="block w-full py-2.5 px-4 bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium text-center rounded-xl cursor-pointer transition-colors shadow-sm">
                      Select Studied Script File
                      <input 
                        type="file" 
                        accept="application/pdf,image/*" 
                        onChange={(e) => handleStudentScriptChange(e.target.files?.[0] || null)}
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>
              </div>

            </div>

            {/* Error logs */}
            {gradingError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Error</p>
                  <p className="text-xs mt-0.5 text-red-600">{gradingError}</p>
                </div>
              </div>
            )}

            {/* Grade Button/Loader */}
            <div className="flex flex-col items-center justify-center pt-2">
              {isGrading ? (
                <div id="loader_state" className="space-y-4 text-center py-6 w-full max-w-md bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="relative w-12 h-12 mx-auto">
                    <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800 animate-pulse">Grading in Progress...</p>
                    <p className="text-[11px] text-slate-500 min-h-[16px] tracking-wide font-mono px-4">{gradingProgress}</p>
                  </div>
                  <div className="progressbar w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full animate-[progress_15s_ease-in-out_infinite]" style={{ width: '85%' }}></div>
                  </div>
                </div>
              ) : (
                <button 
                  id="btn_grade_exam_main"
                  onClick={handleGradeExam}
                  disabled={!markSchemeFile || !studentScriptFile}
                  className={`w-full sm:w-auto px-10 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 ${
                    markSchemeFile && studentScriptFile 
                      ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer active:scale-98"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Grade Exam
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* SECTION B: STATISTICS DASHBOARD & RESULTS EXPLAINER */
          <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
            
            {/* STATS OVERVIEW SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Card 1: Score & Dial */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-between">
                <div className="w-full text-left">
                  <h3 id="stat_header_score" className="text-xs font-bold text-slate-400 tracking-wider uppercase">Grading Summary</h3>
                  <p className="text-slate-800 text-lg font-bold mt-0.5">Score</p>
                </div>
                
                {/* Visual Dial */}
                <div className="relative w-44 h-44 my-6 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="88" cy="88" r="76" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                    <circle 
                      cx="88" 
                      cy="88" 
                      r="76" 
                      stroke={result.scorePercentage >= 75 ? "#10b981" : result.scorePercentage >= 50 ? "#f59e0b" : "#ef4444"} 
                      strokeWidth="12" 
                      fill="transparent" 
                      strokeDasharray={2 * Math.PI * 76}
                      strokeDashoffset={2 * Math.PI * 76 * (1 - result.scorePercentage / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span id="score_number_lg" className="text-4xl font-extrabold text-slate-900 tracking-tight">{result.scorePercentage}%</span>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">
                      {result.scorePercentage >= 75 ? "Excellent (A/B)" : result.scorePercentage >= 50 ? "Passable (C/D)" : "Needs Review"}
                    </p>
                  </div>
                </div>

                <div className="text-center w-full bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium">Overall score percentage.</p>
                </div>
              </div>

              {/* Card 2 && 3 Grid: Total stats cards */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Stat block 1 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Questions Answered</h4>
                      <p className="text-2xl font-bold text-slate-800 mt-1">{result.totalQuestions} Questions</p>
                    </div>
                    <div id="badge_total_questions" className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4 mt-4 text-xs text-slate-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Total MCQ Paper Count:</span>
                      <span className="font-semibold text-slate-700">{result.totalQuestions} items</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completion Rate:</span>
                      <span className="font-semibold text-slate-700">
                        {result.totalQuestions > 0 ? Math.round(((result.totalQuestions - result.totalOmitted) / result.totalQuestions) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stat block 2 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Correct Answers</h4>
                      <p id="stat_correct_count" className="text-2xl font-bold text-emerald-600 mt-1">{result.totalCorrect} / {result.totalQuestions}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4 mt-4 text-xs text-slate-500">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${result.scorePercentage}%` }}></div>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">Correct answers.</p>
                  </div>
                </div>

                {/* Stat block 3 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Incorrect Responses</h4>
                      <p id="stat_incorrect_count" className="text-2xl font-bold text-rose-600 mt-1">{result.totalIncorrect}</p>
                    </div>
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                      <XCircle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4 mt-4 text-xs text-slate-500">
                    <p className="text-[11px] text-rose-500 font-medium">Incorrect answers.</p>
                  </div>
                </div>

                {/* Stat block 4 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Omitted / Blank</h4>
                      <p id="stat_omitted_count" className="text-2xl font-bold text-slate-600 mt-1">{result.totalOmitted}</p>
                    </div>
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-4 mt-4 text-xs text-slate-500">
                    <p className="text-[11px] text-slate-500 font-medium">Omitted answers.</p>
                  </div>
                </div>

              </div>

            </div>

            {/* DETAILED RESULTS TABLE AREA */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              
              {/* Filter controls */}
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    Student Answer Matrix
                    <span className="hidden print:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                      Filter: {filterType}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 print:hidden">Filter questions to study specific conceptual errors.</p>
                </div>
                
                {/* Tabs */}
                <div className="flex p-1 bg-slate-100 rounded-xl space-x-1 self-start sm:self-auto print:hidden">
                  <button 
                    id="tab_filter_all"
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      filterType === 'all' ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    All ({result.totalQuestions})
                  </button>
                  <button 
                    id="tab_filter_incorrect"
                    onClick={() => setFilterType('incorrect')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      filterType === 'incorrect' ? "bg-white text-rose-600 shadow-xs" : "text-slate-500 hover:text-rose-600"
                    }`}
                  >
                    Mistakes Only ({result.totalIncorrect})
                  </button>
                  <button 
                    id="tab_filter_correct"
                    onClick={() => setFilterType('correct')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      filterType === 'correct' ? "bg-white text-emerald-600 shadow-xs" : "text-slate-500 hover:text-emerald-600"
                    }`}
                  >
                    Correct Only ({result.totalCorrect})
                  </button>
                  <button 
                    id="tab_filter_omitted"
                    onClick={() => setFilterType('omitted')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      filterType === 'omitted' ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Omitted ({result.totalOmitted})
                  </button>
                </div>
              </div>

              {/* Table list */}
              {filteredQuestions.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto stroke-1.5 mb-3" />
                  <p className="text-sm font-semibold">No questions fit this category filter.</p>
                  <p className="text-xs text-slate-400 mt-1">Try toggling other metrics tab options above.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredQuestions.map((q) => {
                    const isExpanded = !!expandedQuestions[q.questionNumber];
                    const hasExplanation = !!explanations[q.questionNumber];
                    const isExplLoading = !!explanationLoadingState[q.questionNumber];

                    return (
                      <div key={q.questionNumber} className="transition-colors hover:bg-slate-50/50">
                        {/* Summary Header of Row */}
                        <div 
                          id={`row_header_q_${q.questionNumber}`}
                          onClick={() => handleToggleAccordion(q.questionNumber)}
                          className="px-6 py-4 flex items-center justify-between cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-4 min-w-0 pr-4">
                            {/* Question Badge */}
                            <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 border border-slate-200">
                              Q{q.questionNumber}
                            </div>
                            
                            {/* Title info */}
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">QUESTION</h4>
                              <p className="text-sm font-semibold text-slate-800 truncate" title={q.questionTitle}>
                                {q.questionTitle}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 shrink-0">
                            {/* Score status indicators */}
                            <div className="hidden sm:flex items-center gap-6 text-xs text-slate-500 font-mono">
                              <div>
                                <span className="block text-[9px] font-semibold text-slate-400 tracking-wider">STUDENT</span>
                                <span className={`text-sm font-bold ${q.studentAnswer === null ? "text-slate-400" : q.isCorrect ? "text-emerald-600" : "text-rose-600"}`}>
                                  {q.studentAnswer || "OMITTED"}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[9px] font-semibold text-slate-400 tracking-wider">CORRECT KEY</span>
                                <span className="text-sm font-bold text-slate-700">
                                  {q.correctAnswer}
                                </span>
                              </div>
                            </div>

                            {/* Status Pill Badge */}
                            <div>
                              {q.studentAnswer === null ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                  Omitted
                                </span>
                              ) : q.isCorrect ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Correct
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Incorrect
                                </span>
                              )}
                            </div>

                            {/* Accordion toggle character */}
                            <div className="text-slate-400 print:hidden">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Accordion Panel Drawer Body */}
                        <div id={`row_body_q_${q.questionNumber}`} className={`${isExpanded ? "block animate-[slideDown_0.2s_ease-out]" : "hidden print:block"} px-6 pb-6 pt-1 bg-slate-50/70 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6`}>
                            
                            {/* Panel Left: Visual and Extracted Diagnostics */}
                            <div className="space-y-4">
                              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-slate-400" />
                                Diagnostics
                              </h5>

                              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="text-slate-400 block font-medium">Page Location:</span>
                                    <span className="text-slate-700 font-bold block mt-0.5">Page {q.pageNumber}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block font-medium">Result:</span>
                                    <span className={`font-bold block mt-0.5 ${q.isCorrect ? "text-emerald-600" : "text-rose-600"}`}>
                                      {q.studentAnswer === null ? "Omitted" : q.isCorrect ? "Correct" : "Incorrect"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-slate-500" />
                                  <span className="text-xs font-medium text-slate-600">Review Student PDF (page {q.pageNumber})</span>
                                </div>
                              </div>
                            </div>

                            {/* Panel Right: Tutorial Guidance & AI explanations */}
                            <div className="space-y-4 flex flex-col justify-between">
                              <div className="space-y-3">
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                  <span>Explanation</span>
                                </h5>

                                {hasExplanation ? (
                                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm max-h-[300px] overflow-y-auto print:max-h-none print:overflow-visible">
                                    {renderMarkdown(explanations[q.questionNumber])}
                                  </div>
                                ) : (
                                  <>
                                  <div className="hidden print:block bg-slate-50/50 border border-slate-200 rounded-xl p-4 text-center">
                                    <p className="text-xs text-slate-500 italic">No explanation generated for this diagnostic entry.</p>
                                  </div>
                                  <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-6 text-center space-y-4 print:hidden">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                                      <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div className="space-y-1">
                                      <h6 className="text-xs font-bold text-slate-800">Need an explanation?</h6>
                                      <p className="text-[11px] text-slate-500">Get a step-by-step explanation generated by AI.</p>
                                    </div>
                                    
                                    <button 
                                      id={`btn_explain_q_${q.questionNumber}`}
                                      onClick={() => handleRequestExplanation(q)}
                                      disabled={isExplLoading}
                                      className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 mx-auto transition-colors ${
                                        isExplLoading
                                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                          : "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                      }`}
                                    >
                                      {isExplLoading ? (
                                        <>
                                          <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                          Generating explanation...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-3.5 h-3.5" />
                                          Request Explanation
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  </>
                                )}
                              </div>
                            </div>

                          </div>
                        </div>
                    );
                  })}
                </div>
              )}

            </div>

          </div>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            © 2026 IGCSE Auto-Grader.
          </p>
          <div className="flex gap-4 text-xs text-slate-400 font-medium">
            <span>67</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
