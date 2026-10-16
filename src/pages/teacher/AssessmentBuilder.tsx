import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Question, CompetencyKey, BloomLevel, SourceDocument } from '../../types';
import { sampleQuestionBank } from '../../data/seedData';
import { apiClient } from '../../lib/apiClient';
import { Card, CardHeader, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  PlusCircle,
  CheckCircle2,
  Sparkles,
  Trash2,
  UploadCloud,
  FileText,
  RefreshCw,
  Edit3,
  Download,
  Printer,
  AlertTriangle,
  X,
  Check,
  BookOpen,
  Layers,
  Filter,
  FolderPlus,
  Wand2,
  FileCheck2,
  AlertCircle,
} from 'lucide-react';

const BLOOM_LEVELS: BloomLevel[] = [
  'Remember',
  'Understand',
  'Apply',
  'Analyze',
  'Evaluate',
  'Create',
];

const BLOOM_DESCRIPTIONS: Record<BloomLevel, string> = {
  Remember: 'Recall foundational facts, terminology, definitions, and standard formulas.',
  Understand: 'Explain core concepts, interpret relationships, and summarize principles in context.',
  Apply: 'Execute procedures, solve quantitative/contextual problems, and apply laws to new situations.',
  Analyze: 'Deconstruct multi-step problems, differentiate assumptions, and compare underlying mechanisms.',
  Evaluate: 'Critique arguments, justify methodological choices, and verify validity against criteria.',
  Create: 'Synthesize novel solutions, design experimental models, or formulate original proofs.',
};

interface StagedSourceFile {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  status: 'ready' | 'uploading' | 'uploaded' | 'duplicate' | 'failed';
  progress: number;
  errorMessage?: string;
  documentId?: string;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.txt', '.md', '.docx'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateSourceFileClient(file: File): string | null {
  const lower = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!hasAllowedExt) {
    return `Unsupported format. Allowed: PDF, JPG, PNG, TXT, DOCX.`;
  }
  if (file.size === 0) {
    return 'File is empty (0 bytes).';
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Exceeds 15 MB limit (${formatBytes(file.size)}).`;
  }
  return null;
}

export const AssessmentBuilder: React.FC = () => {
  const {
    assessments,
    subjects,
    classes,
    sourceDocuments,
    questionBank,
    addAssessment,
    addSourceDocuments,
    removeSourceDocument,
    addQuestionsToBank,
    updateBankQuestion,
    deleteBankQuestion,
    attachQuestionsToAssessment,
  } = useData();

  const [activeTab, setActiveTab] = useState<'ai-generator' | 'cycles' | 'question-bank'>('ai-generator');
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ============================================================================
  // AI QUESTION GENERATION & BULK SOURCE UPLOAD STATE
  // ============================================================================
  const [genSubjectId, setGenSubjectId] = useState<string>('sub-math');
  const [showAllSubjectDocs, setShowAllSubjectDocs] = useState<boolean>(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(['doc-src-math-1', 'doc-src-math-2']);
  const [mcqCount, setMcqCount] = useState<number>(3);
  const [theoryCount, setTheoryCount] = useState<number>(2);
  const [bloomIndex, setBloomIndex] = useState<number>(3); // 'Analyze'
  const [topicHint, setTopicHint] = useState<string>('');
  const [targetAssessmentId, setTargetAssessmentId] = useState<string>('asm-2');

  // Bulk Upload Drawer / Zone State
  const [showBulkUploadZone, setShowBulkUploadZone] = useState<boolean>(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false);
  const [stagedFiles, setStagedFiles] = useState<StagedSourceFile[]>([]);
  const [isUploadingBatch, setIsUploadingBatch] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generation & Preview State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>(() =>
    questionBank.slice(0, 4)
  );

  // Inline Edit Question State
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Question>>({});

  // Question Bank Filter State
  const [bankSubjectFilter, setBankSubjectFilter] = useState<string>('all');
  const [bankBloomFilter, setBankBloomFilter] = useState<string>('all');
  const [bankSearch, setBankSearch] = useState<string>('');

  // Create Assessment Cycle Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('class-8a');
  const [subjectId, setSubjectId] = useState('sub-math');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [cycleNumber, setCycleNumber] = useState(3);
  const [questions, setQuestions] = useState<Question[]>(sampleQuestionBank.slice(0, 4));
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState<'mcq' | 'short' | 'descriptive' | 'practical'>('practical');
  const [newMarks, setNewMarks] = useState(4);
  const [newCompetency, setNewCompetency] = useState<CompetencyKey>('AU');
  const [newBloom, setNewBloom] = useState<BloomLevel>('Apply');

  const currentBloomLevel = BLOOM_LEVELS[bloomIndex] || 'Analyze';

  // Filter repository documents by subject unless "Show all subjects" is enabled
  const availableSourceDocs = useMemo(() => {
    if (showAllSubjectDocs) return sourceDocuments;
    const filtered = sourceDocuments.filter((d) => !d.subjectId || d.subjectId === genSubjectId);
    return filtered.length > 0 ? filtered : sourceDocuments;
  }, [sourceDocuments, genSubjectId, showAllSubjectDocs]);

  const handleSubjectChange = (newSubId: string) => {
    setGenSubjectId(newSubId);
    const matchingDocs = sourceDocuments.filter((d) => d.subjectId === newSubId);
    if (matchingDocs.length > 0) {
      setSelectedDocIds(matchingDocs.map((d) => d.id));
    }
  };

  const toggleSourceDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // ============================================================================
  // BULK SOURCE DOCUMENT UPLOAD HANDLERS
  // ============================================================================
  const addFilesToStaging = (incomingFiles: FileList | File[]) => {
    const fileArray = Array.from(incomingFiles);
    const existingKeys = new Set(stagedFiles.map((s) => `${s.name}-${s.size}`));

    const nextItems: StagedSourceFile[] = [];
    for (const file of fileArray) {
      const key = `${file.name}-${file.size}`;
      if (existingKeys.has(key)) {
        nextItems.push({
          id: `stg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          status: 'duplicate',
          progress: 0,
          errorMessage: 'Duplicate file already in staging queue.',
        });
        continue;
      }
      existingKeys.add(key);

      const validationErr = validateSourceFileClient(file);
      nextItems.push({
        id: `stg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/pdf',
        status: validationErr ? 'failed' : 'ready',
        progress: 0,
        errorMessage: validationErr || undefined,
      });
    }

    setStagedFiles((prev) => [...prev, ...nextItems]);
    setShowBulkUploadZone(true);
  };

  const handleLoadSampleSourceFiles = () => {
    const f1 = new File(
      [
        '%PDF-1.4 NCERT Grade 8 Chapter 13 Direct and Inverse Proportions, Compound Interest, and Linear Graphs reference notes /Page /Page /Page',
      ],
      'NCERT_Ch13_Direct_&_Inverse_Proportions_Notes.pdf',
      { type: 'application/pdf' }
    );
    const f2 = new File(
      [
        'CBSE Competency Focused Practice Bank: Factorisation of Algebraic Expressions, Surface Area of Cuboid & Cylinder, Practical Geometry Applications.',
      ],
      'CBSE_Competency_Practice_Workbook_Unit4.txt',
      { type: 'text/plain' }
    );
    const f3 = new File(
      ['\x89PNG\r\n\x1a\nVisual Diagram: Quadrilateral Hierarchy & Angle Sum Proof Chart'],
      'Quadrilateral_Properties_Diagram_Sheet.png',
      { type: 'image/png' }
    );
    const fInvalid = new File(['MZ_executable_macro'], 'unverified_macro_plugin.exe', {
      type: 'application/x-msdownload',
    });

    addFilesToStaging([f1, f2, f3, fInvalid]);
    showToast('Loaded 3 valid curriculum files + 1 invalid file to demonstrate independent validation.');
  };

  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const executeBulkUpload = async (targetItems: StagedSourceFile[]) => {
    if (targetItems.length === 0) return;
    setIsUploadingBatch(true);

    const targetIds = new Set(targetItems.map((t) => t.id));
    setStagedFiles((prev) =>
      prev.map((item) =>
        targetIds.has(item.id)
          ? { ...item, status: 'uploading', progress: 35, errorMessage: undefined }
          : item
      )
    );

    await new Promise((r) => setTimeout(r, 250));
    setStagedFiles((prev) =>
      prev.map((item) => (targetIds.has(item.id) ? { ...item, progress: 75 } : item))
    );

    try {
      const res = await apiClient.documents.bulkUpload(
        targetItems.map((t) => t.file),
        genSubjectId,
        'source_material'
      );

      const newDocs: SourceDocument[] = [];
      setStagedFiles((prev) =>
        prev.map((item) => {
          if (!targetIds.has(item.id)) return item;
          const serverMatch = res.items.find((ri: any) => ri.fileName === item.name);
          if (!serverMatch) return item;

          if (serverMatch.status === 'uploaded' && serverMatch.documentId) {
            newDocs.push({
              id: serverMatch.documentId,
              schoolId: 'school-1',
              subjectId: genSubjectId,
              uploadedBy: 'user-teacher-1',
              fileName: serverMatch.fileName,
              mimeType: serverMatch.mimeType,
              fileSize: serverMatch.fileSize,
              pageCount: serverMatch.pageCount || 1,
              docType: 'source_material',
              status: 'ready',
              extractedTextPreview:
                serverMatch.extractedTextPreview ||
                `Extracted curriculum concepts from ${serverMatch.fileName}`,
            });
          }

          return {
            ...item,
            status: serverMatch.status,
            progress: serverMatch.status === 'uploaded' ? 100 : 0,
            documentId: serverMatch.documentId,
            errorMessage: serverMatch.errorMessage,
          };
        })
      );

      if (newDocs.length > 0) {
        addSourceDocuments(newDocs);
        setSelectedDocIds((prev) => Array.from(new Set([...prev, ...newDocs.map((d) => d.id)])));
        showToast(
          `Uploaded ${newDocs.length} source document(s) and selected them for AI Question Generation!`
        );
      } else if (res.duplicateCount > 0 || res.failedCount > 0) {
        showToast(
          `Batch finished: ${res.uploadedCount} uploaded, ${res.duplicateCount} duplicate, ${res.failedCount} failed.`,
          'warning'
        );
      }
    } catch {
      // Offline / local fallback upload handling
      const fallbackDocs: SourceDocument[] = [];
      setStagedFiles((prev) =>
        prev.map((item) => {
          if (!targetIds.has(item.id)) return item;
          const err = validateSourceFileClient(item.file);
          if (err) {
            return { ...item, status: 'failed', progress: 0, errorMessage: err };
          }
          const docId = `doc-local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          fallbackDocs.push({
            id: docId,
            schoolId: 'school-1',
            subjectId: genSubjectId,
            uploadedBy: 'user-teacher-1',
            fileName: item.name,
            mimeType: item.mimeType,
            fileSize: item.size,
            pageCount: Math.max(1, Math.round(item.size / 42000)),
            docType: 'source_material',
            status: 'ready',
            extractedTextPreview: `Curriculum source content extracted from ${item.name} for ${genSubjectId}.`,
          });
          return { ...item, status: 'uploaded', progress: 100, documentId: docId };
        })
      );

      if (fallbackDocs.length > 0) {
        addSourceDocuments(fallbackDocs);
        setSelectedDocIds((prev) =>
          Array.from(new Set([...prev, ...fallbackDocs.map((d) => d.id)]))
        );
        showToast(`Uploaded ${fallbackDocs.length} document(s) to repository!`);
      }
    } finally {
      setIsUploadingBatch(false);
    }
  };

  const handleUploadAllReady = () => {
    const readyItems = stagedFiles.filter((f) => f.status === 'ready');
    executeBulkUpload(readyItems);
  };

  const handleRetryFailedUploads = () => {
    const retryable = stagedFiles.filter(
      (f) => f.status === 'failed' && !validateSourceFileClient(f.file)
    );
    if (retryable.length === 0) {
      showToast('Remaining failed files have unsupported file formats or sizes.', 'warning');
      return;
    }
    executeBulkUpload(retryable);
  };

  // ============================================================================
  // AI QUESTION GENERATION HANDLERS
  // ============================================================================
  const handleGenerateQuestions = async () => {
    if (mcqCount + theoryCount <= 0) {
      showToast('Please specify at least 1 MCQ or 1 Theory question to generate.', 'warning');
      return;
    }
    if (selectedDocIds.length === 0) {
      showToast('Please select at least one source document to ground generation.', 'warning');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await apiClient.assessments.generateQuestions({
        subjectId: genSubjectId,
        sourceDocumentIds: selectedDocIds,
        mcqCount,
        theoryCount,
        bloomLevel: currentBloomLevel,
        topicHint: topicHint.trim() || undefined,
        saveToBank: true,
      });

      if (response.questions && response.questions.length > 0) {
        setGeneratedQuestions(response.questions);
        addQuestionsToBank(response.questions);
        showToast(
          `Synthesized ${response.questions.length} ${currentBloomLevel}-level questions grounded in ${selectedDocIds.length} source document(s)!`
        );
      }
    } catch {
      // Deterministic client fallback if backend is unreachable
      const chosenDocs = sourceDocuments.filter((d) => selectedDocIds.includes(d.id));
      const docNames =
        chosenDocs.length > 0
          ? chosenDocs.map((d) => d.fileName)
          : ['NCERT_Grade8_Ch9_Algebraic_Expressions_&_Identities.pdf'];
      const subjectObj = subjects.find((s) => s.id === genSubjectId);
      const subName = subjectObj?.name || 'Mathematics';

      const fallbackQuestions: Question[] = [];
      const competencies: CompetencyKey[] = ['CU', 'AU', 'CT', 'LU'];

      for (let i = 0; i < mcqCount; i++) {
        const comp = competencies[i % competencies.length];
        const srcName = docNames[i % docNames.length];
        fallbackQuestions.push({
          id: `q-ai-mcq-${Date.now()}-${i}`,
          subjectId: genSubjectId,
          text: `[${currentBloomLevel} • ${subName}] Grounded in "${srcName}": Which of the following statements accurately demonstrates the ${comp} principle for ${
            topicHint || 'core curriculum problem solving'
          } (Item #${i + 1})?`,
          type: 'mcq',
          options: [
            `A. Applies the verified ${subName} conservation identity with complete dimensional consistency`,
            `B. Assumes linear proportionality without checking boundary conditions`,
            `C. Neglects secondary interaction terms in the governing equation`,
            `D. Reverses the causal relationship between independent variables`,
          ],
          correctAnswer: `A. Applies the verified ${subName} conservation identity with complete dimensional consistency`,
          markingRubric: `1 mark for selecting Option A; 0 marks for distractors B, C, or D.`,
          marks: 2,
          competency: comp,
          bloomLevel: currentBloomLevel,
          sourceDocumentIds: selectedDocIds,
          sourceDocumentNames: [srcName],
          isAiGenerated: true,
        });
      }

      for (let j = 0; j < theoryCount; j++) {
        const comp = competencies[(j + 1) % competencies.length];
        const srcName = docNames[j % docNames.length];
        fallbackQuestions.push({
          id: `q-ai-th-${Date.now()}-${j}`,
          subjectId: genSubjectId,
          text: `[${currentBloomLevel} • ${subName}] Referring to "${srcName}", formulate a step-by-step analytical justification and real-world application for ${
            topicHint || 'multi-variable relationships'
          } (Theory Problem #${j + 1}).`,
          type: 'descriptive',
          correctAnswer: `Complete derivation establishing the governing principle, step-by-step substitution with appropriate SI/metric units, and critical interpretation of edge cases.`,
          markingRubric: `Award 2 marks for conceptual setup (${comp}), 2 marks for analytical derivation & intermediate steps, and 1 mark for final verified conclusion with units (5 marks total).`,
          marks: 5,
          competency: comp,
          bloomLevel: currentBloomLevel,
          sourceDocumentIds: selectedDocIds,
          sourceDocumentNames: [srcName],
          isAiGenerated: true,
        });
      }

      setGeneratedQuestions(fallbackQuestions);
      addQuestionsToBank(fallbackQuestions);
      showToast(
        `Generated ${fallbackQuestions.length} ${currentBloomLevel}-level questions from ${selectedDocIds.length} source document(s)!`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateSingle = async (q: Question) => {
    setRegeneratingId(q.id);
    try {
      const updated = await apiClient.assessments.regenerateQuestion(
        q.id,
        currentBloomLevel,
        topicHint || undefined
      );
      setGeneratedQuestions((prev) => prev.map((item) => (item.id === q.id ? updated : item)));
      updateBankQuestion(q.id, updated);
      showToast(`Regenerated question with fresh ${currentBloomLevel}-level framing!`);
    } catch {
      const refreshed: Question = {
        ...q,
        bloomLevel: currentBloomLevel,
        text: `${q.text.replace(/\s*\(Regenerated Variant.*?\)$/i, '')} (Regenerated Variant • ${currentBloomLevel})`,
      };
      setGeneratedQuestions((prev) => prev.map((item) => (item.id === q.id ? refreshed : item)));
      updateBankQuestion(q.id, refreshed);
      showToast(`Regenerated question variant (${currentBloomLevel})!`);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleStartEditQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditDraft({
      text: q.text,
      marks: q.marks,
      competency: q.competency,
      bloomLevel: q.bloomLevel,
      correctAnswer: q.correctAnswer || '',
      markingRubric: q.markingRubric || '',
      options: q.options ? [...q.options] : undefined,
    });
  };

  const handleSaveEditQuestion = (id: string) => {
    setGeneratedQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...editDraft } : q))
    );
    updateBankQuestion(id, editDraft);
    setEditingQuestionId(null);
    showToast('Saved question edits to Question Bank.');
  };

  const handleDeleteGeneratedQuestion = (id: string) => {
    setGeneratedQuestions((prev) => prev.filter((q) => q.id !== id));
    deleteBankQuestion(id);
    showToast('Removed question from preview and Question Bank.');
  };

  const handleAttachToAssessment = () => {
    if (!targetAssessmentId || generatedQuestions.length === 0) return;
    attachQuestionsToAssessment(targetAssessmentId, generatedQuestions);
    const targetAsm = assessments.find((a) => a.id === targetAssessmentId);
    showToast(
      `Attached ${generatedQuestions.length} generated questions to "${
        targetAsm?.title || 'Assessment'
      }"!`
    );
  };

  // ============================================================================
  // EXPORT PAPER (PRINTABLE PDF & WORD .DOCX/.DOC)
  // ============================================================================
  const handleExportWordDoc = (questionsToExport: Question[], paperTitle: string) => {
    const subjectObj = subjects.find((s) => s.id === genSubjectId);
    const totalMarks = questionsToExport.reduce((s, q) => s + q.marks, 0);

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>${paperTitle}</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; color: #182230; line-height: 1.5; padding: 24px; }
          h1 { color: #142A43; font-size: 20pt; margin-bottom: 4px; }
          .meta { color: #667085; font-size: 10pt; margin-bottom: 18px; border-bottom: 2px solid #142A43; padding-bottom: 10px; }
          .q-box { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #E1E7ED; }
          .q-header { font-weight: bold; color: #142A43; font-size: 11pt; }
          .badge { background: #E6F4F1; color: #16A085; padding: 2px 6px; font-size: 9pt; border-radius: 4px; margin-right: 6px; }
          .options { margin-left: 20px; margin-top: 6px; }
          .rubric { background: #F3F6F8; padding: 8px; font-size: 9.5pt; color: #142A43; margin-top: 6px; border-left: 3px solid #16A085; }
        </style>
      </head>
      <body>
        <h1>LumenEIOS — ${paperTitle}</h1>
        <div class="meta">
          <strong>Subject:</strong> ${subjectObj?.name || 'Mathematics'} &nbsp;|&nbsp;
          <strong>Bloom Target:</strong> ${currentBloomLevel} &nbsp;|&nbsp;
          <strong>Total Questions:</strong> ${questionsToExport.length} &nbsp;|&nbsp;
          <strong>Total Marks:</strong> ${totalMarks}
        </div>
        ${questionsToExport
          .map(
            (q, i) => `
          <div class="q-box">
            <div class="q-header">
              Q${i + 1}. [${q.type.toUpperCase()} • ${q.marks} Marks • Competency: ${q.competency} • Bloom: ${q.bloomLevel}]
            </div>
            <p>${q.text}</p>
            ${
              q.options && q.options.length > 0
                ? `<div class="options">${q.options.map((opt) => `<div>${opt}</div>`).join('')}</div>`
                : ''
            }
            <div class="rubric">
              <strong>Official Answer Key:</strong> ${q.correctAnswer || 'See rubric'}<br/>
              <strong>Marking Rubric:</strong> ${q.markingRubric || 'Standard competency rubric applies.'}<br/>
              ${
                q.sourceDocumentNames && q.sourceDocumentNames.length > 0
                  ? `<strong>Grounded Source(s):</strong> ${q.sourceDocumentNames.join(', ')}`
                  : ''
              }
            </div>
          </div>
        `
          )
          .join('')}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${paperTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported "${paperTitle}" as Word document (.doc)!`);
  };

  const handlePrintPaperPdf = (questionsToExport: Question[], paperTitle: string) => {
    const subjectObj = subjects.find((s) => s.id === genSubjectId);
    const totalMarks = questionsToExport.reduce((s, q) => s + q.marks, 0);
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) {
      showToast('Pop-up blocked. Please allow pop-ups to print/save as PDF.', 'warning');
      return;
    }
    printWin.document.write(`
      <html>
        <head>
          <title>${paperTitle} — LumenEIOS</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #182230; padding: 32px; line-height: 1.5; }
            h1 { font-size: 20px; color: #142A43; margin: 0 0 4px 0; }
            .sub { font-size: 12px; color: #667085; border-bottom: 2px solid #142A43; padding-bottom: 12px; margin-bottom: 20px; }
            .q-card { margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #E1E7ED; page-break-inside: avoid; }
            .q-meta { font-size: 11px; font-weight: 700; color: #16A085; margin-bottom: 4px; }
            .q-text { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
            .opts { margin-left: 16px; font-size: 12px; margin-bottom: 8px; }
            .key { background: #F3F6F8; border-left: 3px solid #142A43; padding: 8px 12px; font-size: 11px; }
          </style>
        </head>
        <body>
          <h1>LumenEIOS Adaptive EdTech Ecosystem — ${paperTitle}</h1>
          <div class="sub">
            Subject: <strong>${subjectObj?.name || 'Mathematics'}</strong> &bull;
            Cognitive Target: <strong>${currentBloomLevel}</strong> &bull;
            Items: <strong>${questionsToExport.length}</strong> &bull;
            Max Marks: <strong>${totalMarks}</strong>
          </div>
          ${questionsToExport
            .map(
              (q, i) => `
            <div class="q-card">
              <div class="q-meta">
                QUESTION ${i + 1} &bull; ${q.type.toUpperCase()} &bull; ${q.marks} MARKS &bull; COMPETENCY: ${q.competency} &bull; BLOOM: ${q.bloomLevel}
              </div>
              <div class="q-text">${q.text}</div>
              ${
                q.options && q.options.length > 0
                  ? `<div class="opts">${q.options.map((o) => `<div>${o}</div>`).join('')}</div>`
                  : ''
              }
              <div class="key">
                <div><strong>Answer Key:</strong> ${q.correctAnswer || 'Refer to rubric'}</div>
                <div><strong>Marking Rubric:</strong> ${q.markingRubric || 'Standard NEP 2020 competency rubric'}</div>
              </div>
            </div>
          `
            )
            .join('')}
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => printWin.print(), 250);
  };

  // ============================================================================
  // ASSESSMENT CYCLE CREATION HANDLERS
  // ============================================================================
  const handleAddQuestion = () => {
    if (!newText.trim()) return;
    const q: Question = {
      id: `q-${Date.now()}`,
      text: newText,
      type: newType,
      marks: Number(newMarks),
      competency: newCompetency,
      bloomLevel: newBloom,
    };
    setQuestions([...questions, q]);
    setNewText('');
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handlePublishAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const focusDims = Array.from(new Set(questions.map((q) => q.competency))) as CompetencyKey[];

    addAssessment({
      schoolId: 'school-1',
      classId,
      subjectId,
      title,
      cycleNumber,
      date: new Date().toISOString().substring(0, 10),
      durationMinutes,
      totalMarks: totalMarks || 25,
      questions,
      status: 'scheduled',
      competencyFocus: focusDims,
    });

    setIsModalOpen(false);
    setTitle('');
    showToast(`Assessment "${title}" published for ${classId.toUpperCase()}!`);
  };

  // Filtered Question Bank
  const filteredBank = useMemo(() => {
    return questionBank.filter((q) => {
      if (bankSubjectFilter !== 'all' && q.subjectId && q.subjectId !== bankSubjectFilter) {
        return false;
      }
      if (bankBloomFilter !== 'all' && q.bloomLevel !== bankBloomFilter) {
        return false;
      }
      if (bankSearch.trim()) {
        const needle = bankSearch.toLowerCase();
        const inText = q.text.toLowerCase().includes(needle);
        const inSource = (q.sourceDocumentNames || []).some((n) =>
          n.toLowerCase().includes(needle)
        );
        return inText || inSource;
      }
      return true;
    });
  }, [questionBank, bankSubjectFilter, bankBloomFilter, bankSearch]);

  const stagedSummary = useMemo(() => {
    return {
      total: stagedFiles.length,
      ready: stagedFiles.filter((f) => f.status === 'ready').length,
      uploaded: stagedFiles.filter((f) => f.status === 'uploaded').length,
      failed: stagedFiles.filter((f) => f.status === 'failed').length,
      duplicate: stagedFiles.filter((f) => f.status === 'duplicate').length,
    };
  }, [stagedFiles]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-900 text-white px-4 py-3 rounded-xl shadow-modal border border-teal-500/40 text-xs flex items-center gap-2.5">
          {toast.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header & Mode Switcher */}
      <div className="bg-white p-5 rounded-2xl border border-surface-border shadow-subtle flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-navy-900 tracking-tight">
              AI Question Generation & Competency Assessment Studio
            </h1>
            <Badge variant="teal" size="sm">
              NEP 2020 Grounded
            </Badge>
          </div>
          <p className="text-xs text-content-secondary mt-0.5">
            Bulk-upload curriculum source documents, synthesize Bloom-calibrated MCQs & theory rubrics, and assemble diagnostic cycles
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-surface-bg rounded-xl border border-surface-border">
            <button
              type="button"
              onClick={() => setActiveTab('ai-generator')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'ai-generator'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-content-secondary hover:text-navy-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              AI Question Generator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cycles')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'cycles'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-content-secondary hover:text-navy-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Assessment Cycles ({assessments.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('question-bank')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'question-bank'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-content-secondary hover:text-navy-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Question Bank ({questionBank.length})
            </button>
          </div>

          <Button
            variant="teal"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            New Cycle
          </Button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: AI QUESTION GENERATION & BULK SOURCE UPLOAD (TWO-COLUMN)       */}
      {/* ===================================================================== */}
      {activeTab === 'ai-generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: GENERATION CONTROLS & BULK SOURCE UPLOAD (5 COLS) */}
          <div className="lg:col-span-5 space-y-5">
            <Card>
              <CardHeader
                title="1. Curriculum Grounding & Bulk Sources"
                subtitle="Select subject and ground AI generation in one or multiple verified documents"
                action={
                  <button
                    type="button"
                    onClick={() => setShowBulkUploadZone((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    {showBulkUploadZone ? 'Hide Bulk Uploader' : 'Bulk Upload Docs'}
                  </button>
                }
              />
              <CardBody className="space-y-4 text-xs">
                {/* Subject Dropdown */}
                <div>
                  <label className="block font-semibold text-navy-900 mb-1.5">
                    Target Subject
                  </label>
                  <select
                    value={genSubjectId}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-surface-border rounded-xl text-xs font-medium text-navy-900 focus:outline-none focus:border-teal-600"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.code} • Grade {sub.grade})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source Document Repository Multi-Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-semibold text-navy-900">
                      Source Document Repository ({selectedDocIds.length} Selected)
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-content-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showAllSubjectDocs}
                        onChange={(e) => setShowAllSubjectDocs(e.target.checked)}
                        className="rounded border-surface-border text-teal-600 focus:ring-teal-500"
                      />
                      Show all subjects
                    </label>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {availableSourceDocs.map((doc) => {
                      const isSelected = selectedDocIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => toggleSourceDocSelection(doc.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                            isSelected
                              ? 'bg-teal-50/60 border-teal-500 shadow-sm'
                              : 'bg-surface-bg/60 border-surface-border hover:border-navy-300'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="mt-0.5 rounded border-surface-border text-teal-600 focus:ring-teal-500"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-navy-900 truncate flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span className="truncate">{doc.fileName}</span>
                              </div>
                              <div className="text-[11px] text-content-muted mt-0.5 flex items-center gap-2">
                                <span>{doc.pageCount} pages</span>
                                <span>•</span>
                                <span>{formatBytes(doc.fileSize)}</span>
                                <span>•</span>
                                <span className="text-emerald-700 font-medium">Indexed</span>
                              </div>
                              {doc.extractedTextPreview && (
                                <p className="text-[11px] text-content-secondary line-clamp-1 mt-1">
                                  {doc.extractedTextPreview}
                                </p>
                              )}
                            </div>
                          </div>

                          {!doc.id.startsWith('doc-src-') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSourceDocument(doc.id);
                                setSelectedDocIds((prev) => prev.filter((id) => id !== doc.id));
                              }}
                              className="p-1 text-content-muted hover:text-rose-600 rounded"
                              title="Remove document from repository"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bulk Source-Document Upload Panel */}
                {showBulkUploadZone && (
                  <div className="p-3.5 rounded-xl bg-surface-bg border border-surface-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-navy-900 flex items-center gap-1.5">
                        <UploadCloud className="w-4 h-4 text-teal-600" />
                        Bulk Source-Document Upload
                      </span>
                      <button
                        type="button"
                        onClick={handleLoadSampleSourceFiles}
                        className="text-[11px] font-semibold text-teal-700 hover:underline"
                      >
                        + Load Demo Multi-File Bundle
                      </button>
                    </div>

                    {/* Drag and Drop Area */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingFiles(true);
                      }}
                      onDragLeave={() => setIsDraggingFiles(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingFiles(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          addFilesToStaging(e.dataTransfer.files);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
                        isDraggingFiles
                          ? 'border-teal-500 bg-teal-50/50'
                          : 'border-surface-border bg-white hover:border-teal-500/60'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.txt,.md,.docx"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            addFilesToStaging(e.target.files);
                            e.target.value = '';
                          }
                        }}
                      />
                      <UploadCloud className="w-6 h-6 text-teal-600 mx-auto mb-1" />
                      <p className="font-semibold text-navy-900">
                        Drag & drop multiple PDFs, images, or notes here
                      </p>
                      <p className="text-[11px] text-content-muted mt-0.5">
                        Supports PDF, JPG, PNG, TXT, DOCX (up to 15 MB per file • independent validation)
                      </p>
                    </div>

                    {/* Staged Files Queue */}
                    {stagedFiles.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-content-secondary">
                          <span>
                            Staged: <strong>{stagedSummary.total}</strong> ({stagedSummary.ready}{' '}
                            ready, {stagedSummary.uploaded} uploaded, {stagedSummary.failed} failed)
                          </span>
                          <button
                            type="button"
                            onClick={() => setStagedFiles([])}
                            className="text-content-muted hover:text-navy-900"
                          >
                            Clear List
                          </button>
                        </div>

                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {stagedFiles.map((sf) => (
                            <div
                              key={sf.id}
                              className="p-2 bg-white rounded-lg border border-surface-border flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex items-center gap-2">
                                  <FileText className="w-3.5 h-3.5 text-navy-700 shrink-0" />
                                  <span className="font-medium text-navy-900 truncate">
                                    {sf.name}
                                  </span>
                                  <span className="text-[10px] text-content-muted shrink-0">
                                    ({formatBytes(sf.size)})
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {sf.status === 'ready' && (
                                    <Badge variant="info" size="sm">
                                      Ready
                                    </Badge>
                                  )}
                                  {sf.status === 'uploading' && (
                                    <Badge variant="teal" size="sm">
                                      Uploading {sf.progress}%
                                    </Badge>
                                  )}
                                  {sf.status === 'uploaded' && (
                                    <Badge variant="success" size="sm">
                                      Uploaded
                                    </Badge>
                                  )}
                                  {sf.status === 'duplicate' && (
                                    <Badge variant="warning" size="sm">
                                      Duplicate
                                    </Badge>
                                  )}
                                  {sf.status === 'failed' && (
                                    <Badge variant="danger" size="sm">
                                      Failed
                                    </Badge>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStagedFile(sf.id)}
                                    className="p-0.5 text-content-muted hover:text-rose-600"
                                    title="Remove file"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {sf.status === 'uploading' && (
                                <div className="w-full h-1.5 bg-surface-bg rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-teal-600 transition-all duration-300"
                                    style={{ width: `${sf.progress}%` }}
                                  />
                                </div>
                              )}

                              {sf.errorMessage && (
                                <p className="text-[10px] text-rose-600 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span>{sf.errorMessage}</span>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            variant="teal"
                            size="sm"
                            disabled={stagedSummary.ready === 0 || isUploadingBatch}
                            onClick={handleUploadAllReady}
                            icon={<UploadCloud className="w-3.5 h-3.5" />}
                          >
                            {isUploadingBatch
                              ? 'Uploading Batch...'
                              : `Upload All Valid (${stagedSummary.ready})`}
                          </Button>
                          {stagedSummary.failed > 0 && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleRetryFailedUploads}
                              icon={<RefreshCw className="w-3.5 h-3.5" />}
                            >
                              Retry Failed
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* GENERATION PARAMETERS CARD */}
            <Card>
              <CardHeader
                title="2. Cognitive & Item Configuration"
                subtitle="Configure MCQ/Theory counts and Bloom's Taxonomy level"
              />
              <CardBody className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-navy-900 mb-1">
                      Number of MCQs (2m each)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={15}
                      value={mcqCount}
                      onChange={(e) => setMcqCount(Math.max(0, Math.min(15, Number(e.target.value))))}
                      className="w-full px-3 py-2 bg-white border border-surface-border rounded-xl text-sm font-bold text-navy-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-navy-900 mb-1">
                      Theory Questions (5m each)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={theoryCount}
                      onChange={(e) =>
                        setTheoryCount(Math.max(0, Math.min(10, Number(e.target.value))))
                      }
                      className="w-full px-3 py-2 bg-white border border-surface-border rounded-xl text-sm font-bold text-navy-900 focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </div>

                {/* Bloom's Taxonomy Difficulty Slider */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-navy-900">
                      Bloom's Taxonomy Cognitive Slider
                    </label>
                    <Badge variant="teal" size="sm">
                      Level {bloomIndex + 1}: {currentBloomLevel}
                    </Badge>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={BLOOM_LEVELS.length - 1}
                    step={1}
                    value={bloomIndex}
                    onChange={(e) => setBloomIndex(Number(e.target.value))}
                    className="w-full accent-teal-600 cursor-pointer"
                  />

                  <div className="grid grid-cols-6 gap-1">
                    {BLOOM_LEVELS.map((lvl, idx) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setBloomIndex(idx)}
                        className={`py-1 px-1 rounded-lg text-[10px] font-semibold text-center transition-all ${
                          bloomIndex === idx
                            ? 'bg-navy-900 text-white shadow-sm'
                            : 'bg-surface-bg text-content-secondary hover:bg-surface-border/60'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>

                  <p className="p-2.5 rounded-xl bg-surface-bg border border-surface-border text-[11px] text-content-secondary">
                    <strong className="text-navy-900">{currentBloomLevel}:</strong>{' '}
                    {BLOOM_DESCRIPTIONS[currentBloomLevel]}
                  </p>
                </div>

                {/* Optional Topic / Concept Focus */}
                <div>
                  <label className="block font-semibold text-navy-900 mb-1">
                    Specific Sub-Topic or Pedagogical Focus (Optional)
                  </label>
                  <input
                    type="text"
                    value={topicHint}
                    onChange={(e) => setTopicHint(e.target.value)}
                    placeholder="e.g. Mensuration of Cylinders, Algebraic Identities, or Force & Pressure"
                    className="w-full px-3 py-2 bg-white border border-surface-border rounded-xl text-xs text-navy-900 focus:outline-none focus:border-teal-600"
                  />
                </div>

                {/* Primary Generate Questions Button */}
                <Button
                  variant="teal"
                  size="lg"
                  className="w-full"
                  disabled={isGenerating}
                  onClick={handleGenerateQuestions}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  {isGenerating
                    ? 'Synthesizing Grounded Questions...'
                    : `Generate Questions (${mcqCount} MCQ + ${theoryCount} Theory)`}
                </Button>
              </CardBody>
            </Card>
          </div>

          {/* RIGHT COLUMN: GENERATED QUESTIONS PREVIEW & PAPER ACTIONS (7 COLS) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Top Action Bar */}
            <Card>
              <CardBody className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-teal-600" />
                    Generated Question Paper Preview ({generatedQuestions.length} Items •{' '}
                    {generatedQuestions.reduce((s, q) => s + q.marks, 0)} Marks)
                  </h2>
                  <p className="text-[11px] text-content-secondary mt-0.5">
                    Review, edit inline, regenerate individual items, attach to an assessment cycle, or export paper
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={generatedQuestions.length === 0}
                    onClick={() =>
                      handlePrintPaperPdf(
                        generatedQuestions,
                        `${subjects.find((s) => s.id === genSubjectId)?.name || 'Diagnostic'} Assessment Paper`
                      )
                    }
                    icon={<Printer className="w-3.5 h-3.5" />}
                  >
                    Export PDF
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={generatedQuestions.length === 0}
                    onClick={() =>
                      handleExportWordDoc(
                        generatedQuestions,
                        `${subjects.find((s) => s.id === genSubjectId)?.name || 'Diagnostic'} Assessment Paper`
                      )
                    }
                    icon={<Download className="w-3.5 h-3.5" />}
                  >
                    Export Word (.doc)
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Attach to Assessment Cycle Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-surface-border shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="font-semibold text-navy-900">Assign to Assessment Cycle:</span>
                <select
                  value={targetAssessmentId}
                  onChange={(e) => setTargetAssessmentId(e.target.value)}
                  className="px-2.5 py-1.5 bg-surface-bg border border-surface-border rounded-lg text-xs font-medium text-navy-900"
                >
                  {assessments.map((asm) => (
                    <option key={asm.id} value={asm.id}>
                      {asm.title} (Cycle {asm.cycleNumber})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={generatedQuestions.length === 0}
                onClick={handleAttachToAssessment}
                icon={<FileCheck2 className="w-3.5 h-3.5" />}
              >
                Attach {generatedQuestions.length} Questions to Cycle
              </Button>
            </div>

            {/* SKELETON LOADING STATE */}
            {isGenerating ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <Card key={n}>
                    <CardBody className="space-y-3 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-16 bg-slate-200 rounded-md" />
                          <div className="h-5 w-24 bg-slate-200 rounded-md" />
                          <div className="h-5 w-32 bg-teal-100 rounded-md" />
                        </div>
                        <div className="h-5 w-14 bg-slate-200 rounded-md" />
                      </div>
                      <div className="h-4 w-11/12 bg-slate-200 rounded" />
                      <div className="h-4 w-3/4 bg-slate-200 rounded" />
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="h-8 bg-slate-100 rounded-lg" />
                        <div className="h-8 bg-slate-100 rounded-lg" />
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            ) : generatedQuestions.length === 0 ? (
              <Card>
                <CardBody className="py-12 text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-teal-600 mx-auto" />
                  <h3 className="text-sm font-bold text-navy-900">No Questions in Preview</h3>
                  <p className="text-xs text-content-secondary max-w-md mx-auto">
                    Select one or more source documents on the left, adjust the Bloom's Taxonomy slider, and click <strong>Generate Questions</strong>.
                  </p>
                </CardBody>
              </Card>
            ) : (
              <div className="space-y-3.5">
                {generatedQuestions.map((q, idx) => {
                  const isEditing = editingQuestionId === q.id;
                  const isRegeneratingThis = regeneratingId === q.id;

                  return (
                    <Card
                      key={q.id}
                      className={`transition-all ${
                        isRegeneratingThis ? 'opacity-60 pointer-events-none' : ''
                      }`}
                    >
                      <CardBody className="space-y-3 text-xs">
                        {/* Question Card Top Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-navy-900 text-white font-bold text-[11px]">
                              Q{idx + 1}
                            </span>
                            <Badge variant={q.type === 'mcq' ? 'info' : 'teal'} size="sm">
                              {q.type === 'mcq' ? 'MCQ' : 'THEORY / DESCRIPTIVE'}
                            </Badge>
                            <Badge variant="outline" size="sm">
                              Competency: {q.competency}
                            </Badge>
                            <Badge variant="outline" size="sm">
                              Bloom: {q.bloomLevel}
                            </Badge>
                            {q.sourceDocumentNames &&
                              q.sourceDocumentNames.map((srcName) => (
                                <span
                                  key={srcName}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-medium max-w-[210px] truncate"
                                  title={`Grounded in: ${srcName}`}
                                >
                                  <FileText className="w-3 h-3 shrink-0 text-teal-600" />
                                  <span className="truncate">{srcName}</span>
                                </span>
                              ))}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-navy-900 px-2 py-0.5 bg-surface-bg rounded-md border border-surface-border">
                              {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                isEditing ? handleSaveEditQuestion(q.id) : handleStartEditQuestion(q)
                              }
                              className="p-1.5 rounded-lg border border-surface-border bg-white hover:bg-surface-bg text-navy-800 transition-colors"
                              title={isEditing ? 'Save Changes' : 'Edit Question'}
                            >
                              {isEditing ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Edit3 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRegenerateSingle(q)}
                              className="p-1.5 rounded-lg border border-surface-border bg-white hover:bg-teal-50 text-teal-700 transition-colors"
                              title="Regenerate Question"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  isRegeneratingThis ? 'animate-spin' : ''
                                }`}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteGeneratedQuestion(q.id)}
                              className="p-1.5 rounded-lg border border-surface-border bg-white hover:bg-rose-50 text-rose-600 transition-colors"
                              title="Delete Question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* INLINE EDITOR OR QUESTION DISPLAY */}
                        {isEditing ? (
                          <div className="space-y-2.5 p-3 bg-surface-bg rounded-xl border border-surface-border">
                            <div>
                              <label className="block font-semibold text-navy-900 mb-1">
                                Question Text
                              </label>
                              <textarea
                                rows={3}
                                value={editDraft.text || ''}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, text: e.target.value }))
                                }
                                className="w-full px-3 py-2 bg-white border border-surface-border rounded-lg text-xs"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block font-semibold text-navy-900 mb-1">
                                  Marks
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={editDraft.marks || 2}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({ ...d, marks: Number(e.target.value) }))
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-surface-border rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <label className="block font-semibold text-navy-900 mb-1">
                                  Competency
                                </label>
                                <select
                                  value={editDraft.competency || 'CU'}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      competency: e.target.value as CompetencyKey,
                                    }))
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-surface-border rounded-lg text-xs"
                                >
                                  <option value="LU">LU</option>
                                  <option value="CU">CU</option>
                                  <option value="AU">AU</option>
                                  <option value="CT">CT</option>
                                </select>
                              </div>
                              <div>
                                <label className="block font-semibold text-navy-900 mb-1">
                                  Bloom Level
                                </label>
                                <select
                                  value={editDraft.bloomLevel || 'Analyze'}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      bloomLevel: e.target.value as BloomLevel,
                                    }))
                                  }
                                  className="w-full px-2.5 py-1.5 bg-white border border-surface-border rounded-lg text-xs"
                                >
                                  {BLOOM_LEVELS.map((b) => (
                                    <option key={b} value={b}>
                                      {b}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block font-semibold text-navy-900 mb-1">
                                Official Answer Key / Model Response
                              </label>
                              <input
                                type="text"
                                value={editDraft.correctAnswer || ''}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, correctAnswer: e.target.value }))
                                }
                                className="w-full px-3 py-1.5 bg-white border border-surface-border rounded-lg text-xs"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-navy-900 mb-1">
                                Marking Rubric
                              </label>
                              <input
                                type="text"
                                value={editDraft.markingRubric || ''}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, markingRubric: e.target.value }))
                                }
                                className="w-full px-3 py-1.5 bg-white border border-surface-border rounded-lg text-xs"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingQuestionId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="teal"
                                size="sm"
                                onClick={() => handleSaveEditQuestion(q.id)}
                              >
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-navy-900 leading-relaxed">
                              {q.text}
                            </p>

                            {/* MCQ Options */}
                            {q.options && q.options.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {q.options.map((opt, oIdx) => {
                                  const isCorrect =
                                    q.correctAnswer &&
                                    (opt === q.correctAnswer ||
                                      opt.startsWith(q.correctAnswer.slice(0, 4)));
                                  return (
                                    <div
                                      key={oIdx}
                                      className={`p-2.5 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                                        isCorrect
                                          ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 font-semibold'
                                          : 'bg-surface-bg/60 border-surface-border text-content-secondary'
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      {isCorrect && (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Official Answer Key & Rubric Box */}
                            <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-200/70 space-y-1 text-[11px]">
                              {q.correctAnswer && (
                                <div className="text-navy-900">
                                  <strong className="text-teal-900">
                                    {q.type === 'mcq' ? 'Official Answer Key:' : 'Model Answer:'}
                                  </strong>{' '}
                                  {q.correctAnswer}
                                </div>
                              )}
                              {q.markingRubric && (
                                <div className="text-content-secondary">
                                  <strong className="text-navy-900">Marking Rubric:</strong>{' '}
                                  {q.markingRubric}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ASSESSMENT CYCLES                                              */}
      {/* ===================================================================== */}
      {activeTab === 'cycles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessments.map((asm) => (
            <Card key={asm.id} className="flex flex-col justify-between">
              <CardHeader
                title={asm.title}
                subtitle={`Cycle ${asm.cycleNumber} • ${asm.classId.toUpperCase()} • ${asm.date}`}
                action={
                  <Badge variant={asm.status === 'graded' ? 'success' : 'teal'} size="sm">
                    {asm.status === 'graded' ? 'Graded & Recalibrated' : 'Scheduled'}
                  </Badge>
                }
              />
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between text-xs text-content-secondary">
                  <span>Duration: {asm.durationMinutes} mins</span>
                  <span className="font-bold text-navy-900">Total Marks: {asm.totalMarks}</span>
                  <span>Questions: {asm.questions.length}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-surface-border">
                  <span className="text-[11px] text-content-muted font-medium">
                    Competency Dimensions:
                  </span>
                  {asm.competencyFocus.map((dim) => (
                    <Badge key={dim} variant="outline" size="sm">
                      {dim}
                    </Badge>
                  ))}
                </div>

                {asm.questions.length > 0 && (
                  <div className="p-3 bg-surface-bg rounded-lg border border-surface-border text-xs text-content-secondary line-clamp-2">
                    Sample Item: {asm.questions[0].text}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePrintPaperPdf(asm.questions, asm.title)}
                    icon={<Printer className="w-3.5 h-3.5" />}
                  >
                    Print Paper
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleExportWordDoc(asm.questions, asm.title)}
                    icon={<Download className="w-3.5 h-3.5" />}
                  >
                    Export .doc
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: QUESTION BANK REPOSITORY                                       */}
      {/* ===================================================================== */}
      {activeTab === 'question-bank' && (
        <Card>
          <CardHeader
            title={`Central Question Bank Repository (${filteredBank.length} Items)`}
            subtitle="Standardized NEP 2020 and AI-generated items tagged with LU, CU, AU, CT, Bloom's Taxonomy, and source documents"
            action={
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExportWordDoc(filteredBank, 'LumenEIOS Question Bank Export')}
                  icon={<Download className="w-3.5 h-3.5" />}
                >
                  Export Bank (.doc)
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <input
                type="text"
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                placeholder="Search question text or source document..."
                className="px-3 py-2 bg-surface-bg border border-surface-border rounded-xl"
              />
              <select
                value={bankSubjectFilter}
                onChange={(e) => setBankSubjectFilter(e.target.value)}
                className="px-3 py-2 bg-surface-bg border border-surface-border rounded-xl"
              >
                <option value="all">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={bankBloomFilter}
                onChange={(e) => setBankBloomFilter(e.target.value)}
                className="px-3 py-2 bg-surface-bg border border-surface-border rounded-xl"
              >
                <option value="all">All Bloom's Levels</option>
                {BLOOM_LEVELS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-surface-border max-h-[540px] overflow-y-auto pr-1">
              {filteredBank.map((q) => (
                <div key={q.id} className="py-3.5 first:pt-0 last:pb-0 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="teal" size="sm">
                        {q.competency}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        Bloom: {q.bloomLevel}
                      </Badge>
                      <Badge variant="info" size="sm">
                        {q.type.toUpperCase()}
                      </Badge>
                      {q.isAiGenerated && (
                        <Badge variant="success" size="sm">
                          AI Grounded
                        </Badge>
                      )}
                      {q.sourceDocumentNames?.map((src) => (
                        <span
                          key={src}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-bg border border-surface-border text-[10px] text-content-secondary"
                        >
                          <FileText className="w-3 h-3 text-teal-600" />
                          {src}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-navy-900">{q.marks} Marks</span>
                      <button
                        type="button"
                        onClick={() => deleteBankQuestion(q.id)}
                        className="p-1 text-content-muted hover:text-rose-600 rounded"
                        title="Delete from Question Bank"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-content-primary font-medium leading-relaxed">{q.text}</p>
                  {(q.correctAnswer || q.markingRubric) && (
                    <div className="text-[11px] text-teal-900 bg-teal-50/60 p-2.5 rounded-lg border border-teal-200/60 space-y-1">
                      {q.correctAnswer && (
                        <div>
                          <strong>Answer Key:</strong> {q.correctAnswer}
                        </div>
                      )}
                      {q.markingRubric && (
                        <div>
                          <strong>Rubric:</strong> {q.markingRubric}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Create Assessment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Construct New Assessment Cycle"
        subtitle="Specify parameters and assemble tagged competency questions"
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button variant="secondary" size="md" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="teal" size="md" onClick={handlePublishAssessment}>
              Publish Assessment
            </Button>
          </div>
        }
      >
        <form onSubmit={handlePublishAssessment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-content-primary mb-1">
              Assessment Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cycle 3 Diagnostic: Mensuration & Spatial Reasoning"
              className="w-full px-3 py-2 bg-white border border-surface-border rounded-lg text-sm text-content-primary focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-content-primary mb-1">Cycle Number</label>
              <select
                value={cycleNumber}
                onChange={(e) => setCycleNumber(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-surface-border rounded-lg"
              >
                <option value={1}>Cycle 1 (Baseline)</option>
                <option value={2}>Cycle 2 (Mid-Term)</option>
                <option value={3}>Cycle 3 (4-Week Recalibration)</option>
                <option value={4}>Cycle 4 (Summative)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-content-primary mb-1">Duration (Mins)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-surface-border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-content-primary mb-1">Class Section</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-surface-border rounded-lg"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Current Questions in Assessment */}
          <div className="pt-3 border-t border-surface-border">
            <h4 className="font-bold text-navy-900 mb-2">
              Assembled Questions ({questions.length} Items • Total{' '}
              {questions.reduce((sum, q) => sum + q.marks, 0)} Marks)
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-2.5 bg-surface-bg rounded-lg border border-surface-border flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate">
                    <span className="font-bold mr-1.5">Q{idx + 1}.</span>
                    <span>{q.text}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="teal" size="sm">
                      {q.competency}
                    </Badge>
                    <span className="font-semibold text-navy-800">{q.marks}m</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(q.id)}
                      className="p-1 text-content-muted hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Item form */}
          <div className="p-3 bg-surface-bg/70 rounded-xl border border-surface-border space-y-2">
            <span className="font-bold text-content-primary block">Add Custom Question</span>
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Enter question text..."
              className="w-full px-3 py-1.5 bg-white border border-surface-border rounded-lg text-xs"
            />
            <div className="grid grid-cols-4 gap-2">
              <select
                value={newCompetency}
                onChange={(e) => setNewCompetency(e.target.value as any)}
                className="px-2 py-1 bg-white border border-surface-border rounded-lg text-xs"
              >
                <option value="LU">LU (Language)</option>
                <option value="CU">CU (Concept)</option>
                <option value="AU">AU (Application)</option>
                <option value="CT">CT (Critical)</option>
              </select>
              <select
                value={newBloom}
                onChange={(e) => setNewBloom(e.target.value as any)}
                className="px-2 py-1 bg-white border border-surface-border rounded-lg text-xs"
              >
                {BLOOM_LEVELS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                max="10"
                value={newMarks}
                onChange={(e) => setNewMarks(Number(e.target.value))}
                placeholder="Marks"
                className="px-2 py-1 bg-white border border-surface-border rounded-lg text-xs"
              />
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3 py-1 bg-navy-800 text-white rounded-lg font-semibold hover:bg-navy-900"
              >
                Add Item
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
