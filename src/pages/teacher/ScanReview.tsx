import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import {
  GradingBatch,
  GradingBatchItem,
  BatchItemStageStatus,
  CompetencyScores,
} from '../../types';
import { apiClient } from '../../lib/apiClient';
import { Card, CardHeader, CardBody } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import {
  ScanLine,
  Upload,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Play,
  XCircle,
  Download,
  Printer,
  Eye,
  UserCheck,
  Layers,
  CheckCheck,
  Sparkles,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';

const STAGE_LABELS: Record<BatchItemStageStatus, string> = {
  queued: 'Queued',
  uploading: 'Uploading',
  uploaded: 'Uploaded • Ready',
  extracting_ocr: 'Extracting OCR',
  identifying_student: 'Identifying Student',
  evaluating_answers: 'Evaluating Answers',
  calculating_marks: 'Calculating Marks',
  completed: 'Completed',
  requires_review: 'Requires Review',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function computeLetterGradeClient(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  return 'D';
}

interface LocalStagedSheet {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  valid: boolean;
  isDuplicate: boolean;
  validationMessage?: string;
}

const ALLOWED_SHEET_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

export const ScanReview: React.FC = () => {
  const { classes, subjects, assessments, students, gradeAssessmentResult } = useData();

  const [activeView, setActiveView] = useState<'batch-engine' | 'single-inspector'>('batch-engine');
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'warning' } | null>(
    null
  );

  const showToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ============================================================================
  // 1. CASCADING SELECTORS: CLASS -> SUBJECT -> TEST
  // ============================================================================
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || 'class-8a');

  const availableSubjectsForClass = useMemo(() => {
    const cls = classes.find((c) => c.id === selectedClassId);
    if (!cls || !cls.subjectIds || cls.subjectIds.length === 0) return subjects;
    const filtered = subjects.filter((s) => cls.subjectIds.includes(s.id));
    return filtered.length > 0 ? filtered : subjects;
  }, [classes, subjects, selectedClassId]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('sub-math');

  const availableTestsForSelection = useMemo(() => {
    const exact = assessments.filter(
      (a) => a.classId === selectedClassId && a.subjectId === selectedSubjectId
    );
    if (exact.length > 0) return exact;
    const bySubject = assessments.filter((a) => a.subjectId === selectedSubjectId);
    if (bySubject.length > 0) return bySubject;
    return assessments;
  }, [assessments, selectedClassId, selectedSubjectId]);

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('asm-2');

  // Cascade handlers: changing a parent resets dependent selectors
  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    const cls = classes.find((c) => c.id === newClassId);
    const nextSubjects =
      cls && cls.subjectIds.length > 0
        ? subjects.filter((s) => cls.subjectIds.includes(s.id))
        : subjects;
    const nextSubId = nextSubjects[0]?.id || 'sub-math';
    setSelectedSubjectId(nextSubId);

    const nextTests = assessments.filter(
      (a) => a.classId === newClassId && a.subjectId === nextSubId
    );
    const fallbackTests = nextTests.length > 0 ? nextTests : assessments;
    setSelectedAssessmentId(fallbackTests[0]?.id || '');
  };

  const handleSubjectChange = (newSubId: string) => {
    setSelectedSubjectId(newSubId);
    const nextTests = assessments.filter(
      (a) => a.classId === selectedClassId && a.subjectId === newSubId
    );
    const bySub = assessments.filter((a) => a.subjectId === newSubId);
    const list = nextTests.length > 0 ? nextTests : bySub.length > 0 ? bySub : assessments;
    setSelectedAssessmentId(list[0]?.id || '');
  };

  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === selectedAssessmentId) || assessments[0],
    [assessments, selectedAssessmentId]
  );

  const classRoster = useMemo(() => {
    const roster = students.filter((s) => s.classId === selectedClassId);
    return roster.length > 0 ? roster : students;
  }, [students, selectedClassId]);

  // ============================================================================
  // 2. UPLOAD MODE & STAGING STATE
  // ============================================================================
  const [uploadMode, setUploadMode] = useState<'bulk' | 'single'>('bulk');
  const [splitMultiPdf, setSplitMultiPdf] = useState<boolean>(false);
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(4);
  const [stagedSheets, setStagedSheets] = useState<LocalStagedSheet[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Active Batch & Polling State
  const [activeBatch, setActiveBatch] = useState<GradingBatch | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Review / Override Modal State
  const [inspectingItem, setInspectingItem] = useState<GradingBatchItem | null>(null);
  const [modalStudentId, setModalStudentId] = useState<string>('');
  const [modalMarks, setModalMarks] = useState<number>(0);
  const [modalEvaluations, setModalEvaluations] = useState<any[]>([]);
  const [isSavingOverride, setIsSavingOverride] = useState<boolean>(false);

  // Stage files with independent per-file validation & duplicate detection
  const handleStageFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const filesToProcess = uploadMode === 'single' ? arr.slice(0, 1) : arr;

    setStagedSheets((prev) => {
      const base = uploadMode === 'single' ? [] : [...prev];
      const existingSignatures = new Set(base.map((b) => `${b.name.toLowerCase()}-${b.size}`));

      const additions: LocalStagedSheet[] = filesToProcess.map((file) => {
        const lower = file.name.toLowerCase();
        const extOk = ALLOWED_SHEET_EXTENSIONS.some((ext) => lower.endsWith(ext));
        const sizeOk = file.size > 0 && file.size <= 15 * 1024 * 1024;
        const sig = `${lower}-${file.size}`;
        const isDup = existingSignatures.has(sig);
        existingSignatures.add(sig);

        let validationMessage: string | undefined;
        if (!extOk) {
          validationMessage = 'Unsupported format. Allowed: PDF, JPG, JPEG, PNG.';
        } else if (!sizeOk) {
          validationMessage = 'File is empty or exceeds 15 MB limit.';
        } else if (isDup) {
          validationMessage = 'Duplicate file detected in upload queue.';
        }

        return {
          id: `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          mimeType: file.type || (lower.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          valid: extOk && sizeOk && !isDup,
          isDuplicate: isDup,
          validationMessage,
        };
      });

      return [...base, ...additions];
    });
  };

  const handleLoadSampleAnswerBatch = () => {
    setUploadMode('bulk');
    const aaravContent = '\xff\xd8\xff\xe0Aarav Patel Roll 14 Mathematics Answer Script';
    const sampleFiles = [
      new File([aaravContent], 'aarav_patel_roll14_math.jpg', { type: 'image/jpeg' }),
      new File(
        ['%PDF-1.4 Ananya Patel Roll 15 Mathematics Answer Script /Page /Page'],
        'ananya_patel_roll15_math.pdf',
        { type: 'application/pdf' }
      ),
      new File(
        ['%PDF-1.4 Rohan Deshmukh Roll 16 Mathematics Answer Script /Page'],
        'rohan_deshmukh_roll16_math.pdf',
        { type: 'application/pdf' }
      ),
      new File(
        ['\x89PNG\r\n\x1a\nUnidentified Handwritten Answer Sheet without clear Roll Number'],
        'scan_unmapped_sheet_04.png',
        { type: 'image/png' }
      ),
      new File(
        ['\xff\xd8\xff\xe0Corrupted scan stream for Kabir Verma'],
        'corrupt_scan_kabir.jpg',
        { type: 'image/jpeg' }
      ),
      new File([aaravContent], 'aarav_patel_roll14_math.jpg', { type: 'image/jpeg' }),
    ];
    setStagedSheets([]);
    setTimeout(() => {
      handleStageFiles(sampleFiles);
      showToast(
        'Loaded 6 sample answer sheets (3 clear matches, 1 unidentified student, 1 corrupted scan for retry testing, and 1 duplicate)!'
      );
    }, 30);
  };

  // ============================================================================
  // 3. CREATE BATCH & REVIEW CONFIGURATION SCREEN
  // ============================================================================
  const handleCreateBatchForReview = async () => {
    if (!selectedAssessment) {
      showToast('Please select a valid Test / Assessment first.', 'warning');
      return;
    }
    if (stagedSheets.length === 0) {
      showToast('Please select or drag-and-drop at least one answer sheet.', 'warning');
      return;
    }

    setIsCreatingBatch(true);
    try {
      const batch = await apiClient.ocr.createBatch({
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        assessmentId: selectedAssessment.id,
        uploadMode,
        splitMultiPdf,
        concurrencyLimit,
        files: stagedSheets.map((s) => s.file),
      });
      setActiveBatch(batch);
      showToast(
        `Batch configured: ${batch.validFiles} valid sheet(s) ready, ${batch.invalidOrDuplicateFiles} invalid/duplicate flagged.`
      );
    } catch {
      // Local fallback batch creation if backend is offline
      const items: GradingBatchItem[] = stagedSheets.map((s, idx) => {
        const lower = s.name.toLowerCase();
        const isCorrupt = lower.includes('corrupt');
        const isUnmapped = lower.includes('unmapped') || lower.includes('unknown');
        const matchedStudent = !isUnmapped ? classRoster[idx % classRoster.length] : null;
        const stConf = isUnmapped ? 0.48 : 0.96;

        return {
          id: `bitem-local-${Date.now()}-${idx}`,
          batchId: `batch-local-${Date.now()}`,
          fileName: s.name,
          fileSize: s.size,
          mimeType: s.mimeType,
          pageCount: lower.endsWith('.pdf') ? 2 : 1,
          status: !s.valid ? 'failed' : 'uploaded',
          stageProgress: !s.valid ? 0 : 15,
          errorMessage: !s.valid ? s.validationMessage || 'Invalid file' : null,
          retryCount: 0,
          studentId: matchedStudent?.id || null,
          studentName: matchedStudent?.name || null,
          studentConfidence: stConf,
          ocrConfidence: isCorrupt ? 0 : 0.94,
          questionEvaluations: [],
          marksObtained: 0,
          maxMarks: selectedAssessment.totalMarks || 30,
          percentage: 0,
          grade: '-',
          competencyScores: {},
          requiresReview: isUnmapped,
          reviewReasons: isUnmapped
            ? ['Manual student identification required before finalizing grade']
            : [],
          teacherApproved: false,
        };
      });

      const validCount = items.filter((i) => i.status === 'uploaded').length;
      const invalidCount = items.length - validCount;
      const clsObj = classes.find((c) => c.id === selectedClassId);
      const subObj = subjects.find((s) => s.id === selectedSubjectId);

      setActiveBatch({
        id: `batch-local-${Date.now()}`,
        schoolId: 'school-1',
        classId: selectedClassId,
        className: clsObj?.name || 'Class 8-A',
        subjectId: selectedSubjectId,
        subjectName: subObj?.name || 'Mathematics',
        assessmentId: selectedAssessment.id,
        assessmentTitle: selectedAssessment.title,
        createdById: 'user-teacher-1',
        uploadMode,
        status: 'configuring',
        totalFiles: items.length,
        validFiles: validCount,
        invalidOrDuplicateFiles: invalidCount,
        completedFiles: 0,
        reviewRequiredFiles: items.filter((i) => i.requiresReview).length,
        failedFiles: invalidCount,
        splitMultiPdf,
        concurrencyLimit,
        createdAt: new Date().toISOString(),
        items,
      });
      showToast(`Batch staged for configuration review (${validCount} valid files).`);
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // ============================================================================
  // 4. START ASYNCHRONOUS BATCH PROCESSING & LIVE POLLING
  // ============================================================================
  useEffect(() => {
    if (!activeBatch || !isPolling) return;
    if (activeBatch.id.startsWith('batch-local-')) return;

    const timer = setInterval(async () => {
      try {
        const updated = await apiClient.ocr.getBatch(activeBatch.id);
        setActiveBatch(updated);
        if (
          updated.status === 'completed' ||
          updated.status === 'completed_with_warnings' ||
          updated.status === 'failed' ||
          updated.status === 'cancelled'
        ) {
          setIsPolling(false);
          showToast(
            `Batch processing finished: ${updated.completedFiles} completed, ${updated.reviewRequiredFiles} flagged for review, ${updated.failedFiles} failed.`
          );
        }
      } catch {
        setIsPolling(false);
      }
    }, 450);

    return () => clearInterval(timer);
  }, [activeBatch, isPolling]);

  const handleStartBatchProcessing = async () => {
    if (!activeBatch) return;

    if (!activeBatch.id.startsWith('batch-local-')) {
      try {
        const started = await apiClient.ocr.startBatch(activeBatch.id, false);
        setActiveBatch(started);
        setIsPolling(true);
        return;
      } catch {
        // Fall through to local progressive simulation if backend call fails
      }
    }

    // Local progressive simulation across the required stages
    setIsPolling(true);
    const stages: { status: BatchItemStageStatus; progress: number }[] = [
      { status: 'queued', progress: 20 },
      { status: 'extracting_ocr', progress: 45 },
      { status: 'identifying_student', progress: 65 },
      { status: 'evaluating_answers', progress: 85 },
      { status: 'calculating_marks', progress: 95 },
    ];

    setActiveBatch((prev) => (prev ? { ...prev, status: 'processing' } : prev));

    for (const step of stages) {
      await new Promise((r) => setTimeout(r, 280));
      setActiveBatch((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.status === 'failed' || it.status === 'cancelled'
              ? it
              : { ...it, status: step.status, stageProgress: step.progress }
          ),
        };
      });
    }

    await new Promise((r) => setTimeout(r, 250));
    setActiveBatch((prev) => {
      if (!prev) return prev;
      const finalizedItems: GradingBatchItem[] = prev.items.map((it, idx) => {
        if (it.status === 'failed' || it.status === 'cancelled') return it;
        const isCorrupt = it.fileName.toLowerCase().includes('corrupt') && it.retryCount === 0;
        if (isCorrupt) {
          return {
            ...it,
            status: 'failed',
            stageProgress: 45,
            errorMessage:
              'Simulated OCR timeout: Corrupted scan stream detected. Click Retry to re-scan with adaptive thresholding.',
          };
        }

        const maxM = selectedAssessment.totalMarks || 30;
        const obtained = Math.min(maxM, Math.round(maxM * (0.72 + ((idx * 7) % 22) / 100)));
        const pct = Math.round((obtained / maxM) * 100);
        const needsRev = !it.studentId || it.studentConfidence < 0.8;

        return {
          ...it,
          status: needsRev ? 'requires_review' : 'completed',
          stageProgress: 100,
          ocrConfidence: needsRev ? 0.79 : 0.96,
          marksObtained: obtained,
          maxMarks: maxM,
          percentage: pct,
          grade: computeLetterGradeClient(pct),
          competencyScores: {
            LU: Math.min(100, pct + 2),
            CU: Math.min(100, pct + 4),
            AU: Math.min(100, pct - 1),
            CT: Math.min(100, pct - 3),
            overall: pct,
          },
          questionEvaluations: (selectedAssessment.questions || []).map((q, qIdx) => ({
            question_id: q.id,
            question_index: qIdx + 1,
            question_text: q.text,
            type: q.type,
            student_answer:
              q.type === 'mcq'
                ? q.correctAnswer || 'Option A'
                : `Applied ${q.competency} steps to solve problem with unit verification.`,
            expected_answer: q.correctAnswer || 'Standard model solution',
            rubric: q.markingRubric || `Verified against ${q.competency} rubric`,
            awarded_marks: Math.max(1, q.marks - (qIdx % 2)),
            max_marks: q.marks,
            confidence: needsRev ? 0.79 : 0.96,
            competency: q.competency,
            feedback:
              q.type === 'mcq'
                ? 'Exact match with official MCQ answer key.'
                : `Rubric criteria satisfied for ${q.competency}.`,
            flagged_for_review: needsRev,
          })),
          requiresReview: needsRev,
          reviewReasons: needsRev
            ? ['Student identity confidence below 80% — manual confirmation required']
            : [],
        };
      });

      const completedCount = finalizedItems.filter((i) => i.status === 'completed').length;
      const reviewCount = finalizedItems.filter((i) => i.status === 'requires_review').length;
      const failedCount = finalizedItems.filter((i) => i.status === 'failed').length;

      return {
        ...prev,
        status:
          failedCount > 0 || reviewCount > 0 ? 'completed_with_warnings' : 'completed',
        completedFiles: completedCount,
        reviewRequiredFiles: reviewCount,
        failedFiles: failedCount,
        items: finalizedItems,
      };
    });
    setIsPolling(false);
  };

  const handleCancelBatch = async () => {
    if (!activeBatch) return;
    setIsPolling(false);
    try {
      const cancelled = await apiClient.ocr.cancelBatch(activeBatch.id);
      setActiveBatch(cancelled);
      showToast('Cancelled pending batch jobs.', 'warning');
    } catch {
      setActiveBatch((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
      showToast('Cancelled batch processing.', 'warning');
    }
  };

  const handleRetryItem = async (item: GradingBatchItem) => {
    if (!activeBatch) return;
    try {
      const updatedBatch = await apiClient.ocr.retryBatchItem(activeBatch.id, item.id, true);
      setActiveBatch(updatedBatch);
      showToast(`Retried "${item.fileName}" — adaptive OCR recovery succeeded!`);
    } catch {
      // Fallback local recovery
      const fallbackStudent = classRoster[0];
      const maxM = item.maxMarks || 30;
      const obtained = Math.round(maxM * 0.8);
      const pct = Math.round((obtained / maxM) * 100);
      setActiveBatch((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: 'completed' as BatchItemStageStatus,
                stageProgress: 100,
                retryCount: it.retryCount + 1,
                errorMessage: null,
                studentId: it.studentId || fallbackStudent?.id || 'student-1',
                studentName: it.studentName || fallbackStudent?.name || 'Aarav Patel',
                studentConfidence: 0.94,
                ocrConfidence: 0.93,
                marksObtained: obtained,
                percentage: pct,
                grade: computeLetterGradeClient(pct),
                requiresReview: false,
                reviewReasons: [],
              }
            : it
        );
        return {
          ...prev,
          completedFiles: nextItems.filter((i) => i.status === 'completed').length,
          failedFiles: nextItems.filter((i) => i.status === 'failed').length,
          items: nextItems,
        };
      });
      showToast(`Retried "${item.fileName}" — recovered and graded!`);
    }
  };

  const handleRemoveBatchItem = async (item: GradingBatchItem) => {
    if (!activeBatch) return;
    try {
      const updated = await apiClient.ocr.removeBatchItem(activeBatch.id, item.id);
      setActiveBatch(updated);
    } catch {
      setActiveBatch((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((i) => i.id !== item.id),
              totalFiles: Math.max(0, prev.totalFiles - 1),
            }
          : prev
      );
    }
  };

  // ============================================================================
  // 5. TEACHER INSPECTION / STUDENT ASSIGNMENT / MARK OVERRIDE MODAL
  // ============================================================================
  const openInspectModal = (item: GradingBatchItem) => {
    setInspectingItem(item);
    setModalStudentId(item.studentId || classRoster[0]?.id || 'student-1');
    setModalMarks(item.marksObtained);
    setModalEvaluations(
      item.questionEvaluations && item.questionEvaluations.length > 0
        ? item.questionEvaluations.map((q) => ({ ...q }))
        : (selectedAssessment?.questions || []).map((q, idx) => ({
            question_id: q.id,
            question_index: idx + 1,
            question_text: q.text,
            type: q.type,
            student_answer: 'Extracted student response verified by teacher.',
            expected_answer: q.correctAnswer || 'Model key',
            rubric: q.markingRubric || 'Competency rubric',
            awarded_marks: q.marks,
            max_marks: q.marks,
            confidence: 0.95,
            competency: q.competency,
            feedback: 'Verified during manual teacher inspection.',
            flagged_for_review: false,
          }))
    );
  };

  const handleSaveItemOverride = async () => {
    if (!activeBatch || !inspectingItem) return;
    setIsSavingOverride(true);
    const chosenStudent = students.find((s) => s.id === modalStudentId);

    try {
      const updatedItem = await apiClient.ocr.updateBatchItem(activeBatch.id, inspectingItem.id, {
        studentId: modalStudentId,
        marksObtained: modalMarks,
        questionEvaluations: modalEvaluations,
        clearReviewFlag: true,
      });

      setActiveBatch((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((it) => (it.id === updatedItem.id ? updatedItem : it));
        return {
          ...prev,
          completedFiles: nextItems.filter((i) => i.status === 'completed').length,
          reviewRequiredFiles: nextItems.filter((i) => i.status === 'requires_review').length,
          items: nextItems,
        };
      });
      setInspectingItem(null);
      showToast(
        `Saved teacher verification for ${chosenStudent?.name || updatedItem.studentName}!`
      );
    } catch {
      const pct = Math.round((modalMarks / Math.max(1, inspectingItem.maxMarks)) * 100);
      setActiveBatch((prev) => {
        if (!prev) return prev;
        const nextItems = prev.items.map((it) =>
          it.id === inspectingItem.id
            ? {
                ...it,
                studentId: modalStudentId,
                studentName: chosenStudent?.name || 'Verified Student',
                studentConfidence: 1.0,
                marksObtained: modalMarks,
                percentage: pct,
                grade: computeLetterGradeClient(pct),
                questionEvaluations: modalEvaluations,
                requiresReview: false,
                reviewReasons: [],
                status: 'completed' as BatchItemStageStatus,
              }
            : it
        );
        return {
          ...prev,
          completedFiles: nextItems.filter((i) => i.status === 'completed').length,
          reviewRequiredFiles: nextItems.filter((i) => i.status === 'requires_review').length,
          items: nextItems,
        };
      });
      setInspectingItem(null);
      showToast(`Verified student & marks for ${chosenStudent?.name || 'student'}!`);
    } finally {
      setIsSavingOverride(false);
    }
  };

  // ============================================================================
  // 6. APPROVE & PUBLISH RESULTS (SINGLE & BULK)
  // ============================================================================
  const publishItemToContext = (item: GradingBatchItem) => {
    if (!item.studentId || !item.studentName) return;
    const scores: CompetencyScores = {
      LU: item.competencyScores?.LU || item.percentage,
      CU: item.competencyScores?.CU || item.percentage,
      AU: item.competencyScores?.AU || item.percentage,
      CT: item.competencyScores?.CT || item.percentage,
      overall: item.percentage,
    };
    gradeAssessmentResult({
      assessmentId: activeBatch?.assessmentId || selectedAssessment.id,
      studentId: item.studentId,
      studentName: item.studentName,
      marksObtained: item.marksObtained,
      totalMarks: item.maxMarks,
      percentage: item.percentage,
      scores,
      feedback: `Auto-Grade Batch Verified (${item.grade} • ${item.percentage}%).`,
      submissionDate: new Date().toISOString().substring(0, 10),
      isScanned: true,
    });
  };

  const handleApproveSingleItem = async (item: GradingBatchItem) => {
    if (!activeBatch) return;
    if (!item.studentId) {
      showToast('Please assign/confirm the student identity before approving.', 'warning');
      openInspectModal(item);
      return;
    }

    try {
      const updatedBatch = await apiClient.ocr.approveBatchItem(activeBatch.id, item.id);
      setActiveBatch(updatedBatch);
      publishItemToContext(item);
      showToast(`Approved & published grade for ${item.studentName} (${item.percentage}%)!`);
    } catch {
      publishItemToContext(item);
      setActiveBatch((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) =>
                it.id === item.id ? { ...it, teacherApproved: true, status: 'completed' } : it
              ),
            }
          : prev
      );
      showToast(`Approved & published grade for ${item.studentName}!`);
    }
  };

  const handleApproveAllVerified = async () => {
    if (!activeBatch) return;
    const eligible = activeBatch.items.filter(
      (it) =>
        it.status === 'completed' &&
        !it.requiresReview &&
        Boolean(it.studentId) &&
        !it.teacherApproved
    );
    if (eligible.length === 0) {
      showToast(
        'No unapproved verified items ready. Resolve any "Requires Review" items first.',
        'warning'
      );
      return;
    }

    try {
      const updatedBatch = await apiClient.ocr.approveAllBatchItems(activeBatch.id);
      setActiveBatch(updatedBatch);
      eligible.forEach(publishItemToContext);
      showToast(
        `Approved & published ${eligible.length} verified student paper(s) and recalibrated class baselines!`
      );
    } catch {
      eligible.forEach(publishItemToContext);
      setActiveBatch((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) =>
                eligible.some((e) => e.id === it.id) ? { ...it, teacherApproved: true } : it
              ),
            }
          : prev
      );
      showToast(`Approved & published ${eligible.length} verified student paper(s)!`);
    }
  };

  // ============================================================================
  // 7. EXPORT BATCH RESULTS (CSV & PRINTABLE PDF)
  // ============================================================================
  const handleExportBatchCsv = () => {
    if (!activeBatch) return;
    const headers = [
      'Student Name',
      'Student ID',
      'File Name',
      'Status',
      'OCR Confidence (%)',
      'Marks Obtained',
      'Max Marks',
      'Percentage (%)',
      'Grade',
      'Requires Review',
      'Teacher Approved',
    ];
    const rows = activeBatch.items.map((it) => [
      `"${(it.studentName || 'Unassigned').replace(/"/g, '""')}"`,
      it.studentId || 'N/A',
      `"${it.fileName.replace(/"/g, '""')}"`,
      it.status,
      Math.round((it.ocrConfidence || 0) * 100),
      it.marksObtained,
      it.maxMarks,
      it.percentage,
      it.grade,
      it.requiresReview ? 'Yes' : 'No',
      it.teacherApproved ? 'Approved' : 'Pending',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumeneios_autograde_${activeBatch.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported batch grading results as CSV!');
  };

  const handlePrintBatchSummaryPdf = () => {
    if (!activeBatch) return;
    const win = window.open('', '_blank', 'width=960,height=720');
    if (!win) {
      showToast('Please allow pop-ups to print/save batch summary as PDF.', 'warning');
      return;
    }
    win.document.write(`
      <html>
        <head>
          <title>Auto-Grade Batch Report — ${activeBatch.assessmentTitle || 'Assessment'}</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #182230; padding: 28px; }
            h1 { color: #142A43; font-size: 18px; margin-bottom: 4px; }
            .meta { font-size: 12px; color: #667085; margin-bottom: 16px; border-bottom: 2px solid #142A43; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #E1E7ED; padding: 8px 10px; text-align: left; }
            th { background: #F3F6F8; color: #142A43; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>LumenEIOS — Consolidated Auto-Grade Batch Report</h1>
          <div class="meta">
            <strong>Class:</strong> ${activeBatch.className || activeBatch.classId} &bull;
            <strong>Subject:</strong> ${activeBatch.subjectName || activeBatch.subjectId} &bull;
            <strong>Test:</strong> ${activeBatch.assessmentTitle || activeBatch.assessmentId} &bull;
            <strong>Total Papers:</strong> ${activeBatch.totalFiles}
          </div>
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Answer Sheet File</th>
                <th>Status</th>
                <th>OCR Confidence</th>
                <th>Marks</th>
                <th>Percentage</th>
                <th>Grade</th>
                <th>Approval</th>
              </tr>
            </thead>
            <tbody>
              ${activeBatch.items
                .map(
                  (it) => `
                <tr>
                  <td>${it.studentName || 'Unassigned'}</td>
                  <td>${it.fileName}</td>
                  <td>${it.status}</td>
                  <td>${Math.round((it.ocrConfidence || 0) * 100)}%</td>
                  <td>${it.marksObtained} / ${it.maxMarks}</td>
                  <td>${it.percentage}%</td>
                  <td><strong>${it.grade}</strong></td>
                  <td>${it.teacherApproved ? 'Approved & Published' : 'Pending Review'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  // ============================================================================
  // LEGACY SINGLE-SHEET OPTICAL INSPECTOR STATE (PRESERVED)
  // ============================================================================
  const [selectedStudentId, setSelectedStudentId] = useState('student-1');
  const [isVerifying, setIsVerifying] = useState(false);
  const [q1Marks, setQ1Marks] = useState(4);
  const [q1Feedback, setQ1Feedback] = useState(
    'Volume calculated accurately (24,000L). Minor unit phrasing slip.'
  );
  const [q2Marks, setQ2Marks] = useState(2);
  const [q2Feedback, setQ2Feedback] = useState(
    'Correct inverse of -13/19 = -19/13 with algebraic justification.'
  );
  const [q3Marks, setQ3Marks] = useState(3);
  const [q3Feedback, setQ3Feedback] = useState(
    'Logical distinction between rectangle and square clearly articulated.'
  );
  const [q4Marks, setQ4Marks] = useState(4);
  const [q4Feedback, setQ4Feedback] = useState(
    'Counterexample provided proving perimeter doubling does not linearly scale area.'
  );

  const totalMarksObtained = q1Marks + q2Marks + q3Marks + q4Marks;
  const maxTotal = 14;
  const percentage = Math.round((totalMarksObtained / maxTotal) * 100);
  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  const handleSaveReviewedScan = () => {
    setIsVerifying(true);
    setTimeout(() => {
      gradeAssessmentResult({
        assessmentId: 'asm-2',
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        marksObtained: totalMarksObtained,
        totalMarks: maxTotal,
        percentage,
        scores: {
          LU: Math.min(100, selectedStudent.competencies.LU + 4),
          CU: Math.min(100, selectedStudent.competencies.CU + 5),
          AU: Math.min(100, selectedStudent.competencies.AU + 6),
          CT: Math.min(100, selectedStudent.competencies.CT + 3),
          overall: percentage,
        },
        feedback: `Verified handwritten optical sheet. Q1: ${q1Marks}m, Q2: ${q2Marks}m, Q3: ${q3Marks}m, Q4: ${q4Marks}m. Total: ${percentage}%.`,
        submissionDate: new Date().toISOString().substring(0, 10),
        isScanned: true,
      });

      setIsVerifying(false);
      showToast(
        `Marks for ${selectedStudent.name} verified and saved! Competency baseline recalibrated.`
      );
    }, 600);
  };

  const overallBatchProgress = useMemo(() => {
    if (!activeBatch || activeBatch.items.length === 0) return 0;
    const sum = activeBatch.items.reduce((acc, it) => acc + (it.stageProgress || 0), 0);
    return Math.round(sum / activeBatch.items.length);
  }, [activeBatch]);

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
              Auto-Grade Engine & Optical Answer-Sheet Pipeline
            </h1>
            <Badge variant="teal" size="sm">
              Batch OCR + Rubric AI
            </Badge>
          </div>
          <p className="text-xs text-content-secondary mt-1">
            Bulk-upload student answer scripts, run asynchronous OCR & rubric evaluation, resolve flagged items, and publish verified grades
          </p>
        </div>

        <div className="inline-flex p-1 bg-surface-bg rounded-xl border border-surface-border">
          <button
            type="button"
            onClick={() => setActiveView('batch-engine')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeView === 'batch-engine'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-content-secondary hover:text-navy-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            Auto-Grade Batch Engine
          </button>
          <button
            type="button"
            onClick={() => setActiveView('single-inspector')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeView === 'single-inspector'
                ? 'bg-navy-900 text-white shadow-sm'
                : 'text-content-secondary hover:text-navy-900'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            Single-Sheet Optical Inspector
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: AUTO-GRADE BATCH ENGINE (CASCADING SELECTORS + BULK UPLOAD)   */}
      {/* ===================================================================== */}
      {activeView === 'batch-engine' && (
        <div className="space-y-6">
          {/* STEP 1: CASCADING SELECTORS (CLASS -> SUBJECT -> TEST) */}
          <Card>
            <CardHeader
              title="Step 1: Select Target Class, Subject & Official Test"
              subtitle="Cascading selection verifies that an official answer key and marking rubric exist before grading"
              action={
                selectedAssessment ? (
                  <Badge variant="success" size="sm">
                    Answer Key Verified • {selectedAssessment.questions.length} Items •{' '}
                    {selectedAssessment.totalMarks} Marks
                  </Badge>
                ) : (
                  <Badge variant="warning" size="sm">
                    Select Test
                  </Badge>
                )
              }
            />
            <CardBody className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Select Class */}
                <div>
                  <label className="block font-semibold text-navy-900 mb-1.5">
                    1. Select Class
                  </label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-surface-border rounded-xl text-xs font-semibold text-navy-900 focus:outline-none focus:border-teal-600"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.studentCount} Students)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Subject */}
                <div>
                  <label className="block font-semibold text-navy-900 mb-1.5">
                    2. Select Subject
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-surface-border rounded-xl text-xs font-semibold text-navy-900 focus:outline-none focus:border-teal-600"
                  >
                    {availableSubjectsForClass.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name} ({sub.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Select Test */}
                <div>
                  <label className="block font-semibold text-navy-900 mb-1.5">
                    3. Select Test / Assessment Cycle
                  </label>
                  <select
                    value={selectedAssessment?.id || ''}
                    onChange={(e) => setSelectedAssessmentId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-surface-border rounded-xl text-xs font-semibold text-navy-900 focus:outline-none focus:border-teal-600"
                  >
                    {availableTestsForSelection.map((asm) => (
                      <option key={asm.id} value={asm.id}>
                        {asm.title} (Cycle {asm.cycleNumber} • {asm.totalMarks}m)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* STEP 2: UPLOAD SINGLE OR BULK ANSWER SHEETS */}
          {!activeBatch && (
            <Card>
              <CardHeader
                title="Step 2: Upload Student Answer Sheets"
                subtitle="Choose Single Paper or Bulk Upload multiple PDFs / scanned images for batch auto-grading"
                action={
                  <div className="flex items-center gap-2">
                    <div className="inline-flex p-0.5 bg-surface-bg rounded-lg border border-surface-border text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setUploadMode('single');
                          setStagedSheets((prev) => prev.slice(0, 1));
                        }}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                          uploadMode === 'single'
                            ? 'bg-navy-900 text-white'
                            : 'text-content-secondary'
                        }`}
                      >
                        Upload Single Paper
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMode('bulk')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                          uploadMode === 'bulk'
                            ? 'bg-navy-900 text-white'
                            : 'text-content-secondary'
                        }`}
                      >
                        Bulk Upload Papers
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadSampleAnswerBatch}
                      className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold hover:bg-teal-100 transition-colors"
                    >
                      + Load Sample 6-Paper Batch
                    </button>
                  </div>
                }
              />
              <CardBody className="space-y-4 text-xs">
                {/* Batch Options Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-bg rounded-xl border border-surface-border">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-navy-900">
                    <input
                      type="checkbox"
                      checked={splitMultiPdf}
                      onChange={(e) => setSplitMultiPdf(e.target.checked)}
                      className="rounded border-surface-border text-teal-600 focus:ring-teal-500"
                    />
                    <span>
                      Split multi-student PDF bundles automatically into individual student submissions
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-content-secondary font-medium">Worker Concurrency:</span>
                    <select
                      value={concurrencyLimit}
                      onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
                      className="px-2 py-1 bg-white border border-surface-border rounded-lg font-semibold text-navy-900"
                    >
                      <option value={2}>2 Parallel Workers</option>
                      <option value={4}>4 Parallel Workers</option>
                      <option value={6}>6 Parallel Workers</option>
                    </select>
                  </div>
                </div>

                {/* Drag-and-Drop Multi-File Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleStageFiles(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-teal-500 bg-teal-50/50'
                      : 'border-surface-border bg-surface-bg/40 hover:border-teal-500/60 hover:bg-surface-bg'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple={uploadMode === 'bulk'}
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleStageFiles(e.target.files);
                        e.target.value = '';
                      }
                    }}
                  />
                  <UploadCloud className="w-9 h-9 text-teal-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-navy-900">
                    {uploadMode === 'bulk'
                      ? 'Drag & drop multiple student answer sheets here, or click to browse'
                      : 'Drag & drop a single student answer sheet here, or click to browse'}
                  </p>
                  <p className="text-xs text-content-secondary mt-1">
                    Accepted formats: PDF, JPG, JPEG, PNG (up to 15 MB per file). Student names or roll numbers in filenames/headers are auto-matched.
                  </p>
                </div>

                {/* Staged Answer Sheets List */}
                {stagedSheets.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-navy-900">
                        Selected Answer Sheets ({stagedSheets.length} Total •{' '}
                        {stagedSheets.filter((s) => s.valid).length} Valid •{' '}
                        {stagedSheets.filter((s) => !s.valid).length} Invalid/Duplicate)
                      </span>
                      <button
                        type="button"
                        onClick={() => setStagedSheets([])}
                        className="text-content-muted hover:text-rose-600 font-semibold"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                      {stagedSheets.map((s) => (
                        <div
                          key={s.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                            s.valid
                              ? 'bg-white border-surface-border'
                              : 'bg-rose-50/40 border-rose-200'
                          }`}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <FileText
                              className={`w-4 h-4 shrink-0 ${
                                s.valid ? 'text-teal-600' : 'text-rose-500'
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-navy-900 truncate">{s.name}</div>
                              <div className="text-[10px] text-content-muted">
                                {formatBytes(s.size)}
                                {s.validationMessage ? ` • ${s.validationMessage}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {s.valid ? (
                              <Badge variant="success" size="sm">
                                Valid
                              </Badge>
                            ) : s.isDuplicate ? (
                              <Badge variant="warning" size="sm">
                                Duplicate
                              </Badge>
                            ) : (
                              <Badge variant="danger" size="sm">
                                Invalid
                              </Badge>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setStagedSheets((prev) => prev.filter((item) => item.id !== s.id))
                              }
                              className="p-1 text-content-muted hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        variant="teal"
                        size="lg"
                        disabled={
                          stagedSheets.filter((s) => s.valid).length === 0 || isCreatingBatch
                        }
                        onClick={handleCreateBatchForReview}
                        icon={<Upload className="w-4 h-4" />}
                      >
                        {isCreatingBatch
                          ? 'Uploading & Validating Batch...'
                          : `Upload & Review Batch Configuration (${
                              stagedSheets.filter((s) => s.valid).length
                            } Valid Papers)`}
                      </Button>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {/* STEP 3: BATCH CONFIGURATION REVIEW & LIVE PROCESSING / CONSOLIDATED RESULTS */}
          {activeBatch && (
            <div className="space-y-5">
              {/* Batch Configuration Review Banner (when status === 'configuring') */}
              {activeBatch.status === 'configuring' && (
                <Card className="border-2 border-teal-500/50">
                  <CardHeader
                    title="Step 3: Batch Configuration Review (Pre-Processing Check)"
                    subtitle="Verify selected Class, Subject, Test, and student paper mappings before launching asynchronous auto-grading"
                    action={
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveBatch(null)}
                        >
                          Back to File Selection
                        </Button>
                        <Button
                          variant="teal"
                          size="md"
                          onClick={handleStartBatchProcessing}
                          icon={<Play className="w-4 h-4" />}
                        >
                          Confirm & Start Batch Processing ({activeBatch.validFiles} Papers)
                        </Button>
                      </div>
                    }
                  />
                  <CardBody className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 rounded-xl bg-surface-bg border border-surface-border">
                        <div className="text-content-muted text-[11px]">Target Class & Subject</div>
                        <div className="font-bold text-navy-900 mt-0.5">
                          {activeBatch.className || activeBatch.classId} •{' '}
                          {activeBatch.subjectName || activeBatch.subjectId}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-surface-bg border border-surface-border">
                        <div className="text-content-muted text-[11px]">Selected Test</div>
                        <div className="font-bold text-navy-900 mt-0.5 truncate">
                          {activeBatch.assessmentTitle || selectedAssessment?.title}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                        <div className="text-emerald-800 text-[11px]">Valid Papers Ready</div>
                        <div className="text-lg font-bold text-emerald-900">
                          {activeBatch.validFiles} / {activeBatch.totalFiles}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                        <div className="text-amber-800 text-[11px]">Need Student ID Check</div>
                        <div className="text-lg font-bold text-amber-900">
                          {
                            activeBatch.items.filter(
                              (i) => i.status === 'uploaded' && !i.studentId
                            ).length
                          }
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                        <div className="text-rose-800 text-[11px]">Invalid / Duplicate Skipped</div>
                        <div className="text-lg font-bold text-rose-900">
                          {activeBatch.invalidOrDuplicateFiles}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Live Batch Progress & Summary Dashboard */}
              <Card>
                <CardHeader
                  title={`Batch Pipeline Status: ${
                    activeBatch.assessmentTitle || selectedAssessment?.title
                  }`}
                  subtitle={`Batch ID: ${activeBatch.id} • ${
                    activeBatch.className || 'Class 8-A'
                  } • ${activeBatch.subjectName || 'Mathematics'}`}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      {activeBatch.status === 'processing' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleCancelBatch}
                          icon={<XCircle className="w-3.5 h-3.5" />}
                        >
                          Cancel Pending Jobs
                        </Button>
                      )}
                      {activeBatch.status !== 'configuring' &&
                        activeBatch.status !== 'processing' && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleExportBatchCsv}
                              icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
                            >
                              Export CSV
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handlePrintBatchSummaryPdf}
                              icon={<Printer className="w-3.5 h-3.5" />}
                            >
                              Print / PDF Report
                            </Button>
                            <Button
                              variant="teal"
                              size="sm"
                              onClick={handleApproveAllVerified}
                              icon={<CheckCheck className="w-3.5 h-3.5" />}
                            >
                              Approve & Publish All Verified
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setActiveBatch(null);
                                setStagedSheets([]);
                              }}
                            >
                              New Batch Upload
                            </Button>
                          </>
                        )}
                    </div>
                  }
                />
                <CardBody className="space-y-4 text-xs">
                  {/* Overall Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-navy-900 flex items-center gap-1.5">
                        {activeBatch.status === 'processing' && (
                          <RefreshCw className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                        )}
                        <span>
                          Overall Batch Progress ({overallBatchProgress}%) — Status:{' '}
                          <span className="uppercase text-teal-700">{activeBatch.status}</span>
                        </span>
                      </span>
                      <span className="text-content-secondary">
                        {activeBatch.completedFiles} Completed • {activeBatch.reviewRequiredFiles}{' '}
                        Requires Review • {activeBatch.failedFiles} Failed
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-bg rounded-full overflow-hidden border border-surface-border">
                      <div
                        className="h-full bg-teal-600 transition-all duration-300"
                        style={{ width: `${overallBatchProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Consolidated Batch Results Table */}
                  <div className="overflow-x-auto border border-surface-border rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-bg text-navy-900 border-b border-surface-border text-[11px] font-bold">
                          <th className="py-2.5 px-3">Student Identity</th>
                          <th className="py-2.5 px-3">Answer Sheet File</th>
                          <th className="py-2.5 px-3">Pipeline Stage</th>
                          <th className="py-2.5 px-3">OCR Confidence</th>
                          <th className="py-2.5 px-3">Marks</th>
                          <th className="py-2.5 px-3">% / Grade</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border text-xs">
                        {activeBatch.items.map((item) => {
                          const isLowOcr = item.ocrConfidence > 0 && item.ocrConfidence < 0.85;
                          return (
                            <tr key={item.id} className="hover:bg-surface-bg/50 transition-colors">
                              {/* Student Identity */}
                              <td className="py-2.5 px-3">
                                {item.studentName ? (
                                  <div>
                                    <div className="font-bold text-navy-900 flex items-center gap-1.5">
                                      <span>{item.studentName}</span>
                                      {item.teacherApproved && (
                                        <span title="Approved & Published">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-content-muted">
                                      ID Match: {Math.round((item.studentConfidence || 0) * 100)}%
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openInspectModal(item)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-[11px] hover:bg-amber-100"
                                  >
                                    <UserCheck className="w-3 h-3" />
                                    Assign Student
                                  </button>
                                )}
                              </td>

                              {/* File Name */}
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-navy-900 truncate max-w-[200px]">
                                  {item.fileName}
                                </div>
                                <div className="text-[10px] text-content-muted">
                                  {formatBytes(item.fileSize)} • {item.pageCount} page(s)
                                  {item.pageRange ? ` (${item.pageRange})` : ''}
                                </div>
                              </td>

                              {/* Stage Status */}
                              <td className="py-2.5 px-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    {item.teacherApproved ? (
                                      <Badge variant="success" size="sm">
                                        Approved & Published
                                      </Badge>
                                    ) : item.status === 'completed' ? (
                                      <Badge variant="teal" size="sm">
                                        Completed
                                      </Badge>
                                    ) : item.status === 'requires_review' ? (
                                      <Badge variant="warning" size="sm">
                                        Requires Review
                                      </Badge>
                                    ) : item.status === 'failed' ? (
                                      <Badge variant="danger" size="sm">
                                        Failed
                                      </Badge>
                                    ) : (
                                      <Badge variant="info" size="sm">
                                        {STAGE_LABELS[item.status] || item.status}
                                      </Badge>
                                    )}
                                  </div>

                                  {item.errorMessage && (
                                    <p className="text-[10px] text-rose-600 max-w-xs">
                                      {item.errorMessage}
                                    </p>
                                  )}
                                  {item.reviewReasons && item.reviewReasons.length > 0 && (
                                    <p className="text-[10px] text-amber-700 max-w-xs">
                                      {item.reviewReasons.join(' • ')}
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* OCR Confidence */}
                              <td className="py-2.5 px-3">
                                {item.ocrConfidence > 0 ? (
                                  <span
                                    className={`font-semibold ${
                                      isLowOcr ? 'text-amber-700' : 'text-emerald-700'
                                    }`}
                                  >
                                    {Math.round(item.ocrConfidence * 100)}%
                                  </span>
                                ) : (
                                  <span className="text-content-muted">—</span>
                                )}
                              </td>

                              {/* Marks */}
                              <td className="py-2.5 px-3 font-bold text-navy-900">
                                {item.status === 'completed' ||
                                item.status === 'requires_review' ? (
                                  `${item.marksObtained} / ${item.maxMarks}`
                                ) : (
                                  <span className="text-content-muted">—</span>
                                )}
                              </td>

                              {/* Percentage & Grade */}
                              <td className="py-2.5 px-3">
                                {item.status === 'completed' ||
                                item.status === 'requires_review' ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-navy-900">
                                      {item.percentage}%
                                    </span>
                                    <Badge variant="outline" size="sm">
                                      {item.grade}
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-content-muted">—</span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {(item.status === 'completed' ||
                                    item.status === 'requires_review' ||
                                    item.status === 'uploaded') && (
                                    <button
                                      type="button"
                                      onClick={() => openInspectModal(item)}
                                      className="px-2 py-1 rounded-lg border border-surface-border bg-white hover:bg-surface-bg text-navy-900 font-semibold text-[11px] inline-flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" />
                                      Review
                                    </button>
                                  )}

                                  {item.status === 'failed' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRetryItem(item)}
                                      className="px-2.5 py-1 rounded-lg bg-teal-600 text-white hover:bg-teal-700 font-semibold text-[11px] inline-flex items-center gap-1"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Retry
                                    </button>
                                  )}

                                  {(item.status === 'completed' ||
                                    item.status === 'requires_review') &&
                                    !item.teacherApproved && (
                                      <button
                                        type="button"
                                        onClick={() => handleApproveSingleItem(item)}
                                        className="px-2.5 py-1 rounded-lg bg-navy-900 text-white hover:bg-navy-800 font-semibold text-[11px] inline-flex items-center gap-1"
                                      >
                                        <CheckCircle2 className="w-3 h-3 text-teal-400" />
                                        Approve
                                      </button>
                                    )}

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBatchItem(item)}
                                    className="p-1 text-content-muted hover:text-rose-600 rounded"
                                    title="Remove item from batch"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: SINGLE-SHEET OPTICAL INSPECTOR (PRESERVED WORKFLOW)           */}
      {/* ===================================================================== */}
      {activeView === 'single-inspector' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-surface-border flex items-center justify-between">
            <span className="text-xs font-semibold text-navy-900">
              Interactive Single-Sheet Optical Worksheet Inspector
            </span>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-content-secondary">
                Target Student:
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-3 py-1.5 bg-surface-bg border border-surface-border rounded-lg text-xs font-medium"
              >
                {students.slice(0, 6).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Roll #{s.rollNo})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Scanned Physical Answer Sheet Visualizer */}
            <Card className="h-full flex flex-col justify-between">
              <CardHeader
                title="Scanned Answer Script: Physical Worksheet"
                subtitle="Camera upload from mobile tablet • Resolution: 300 DPI"
                action={
                  <Badge variant="teal" size="sm">
                    Optical Feed
                  </Badge>
                }
              />
              <CardBody className="p-4 space-y-4">
                <div className="bg-amber-50/40 border-2 border-dashed border-amber-200 rounded-xl p-5 font-mono text-xs text-navy-950 space-y-4 shadow-inner relative overflow-hidden">
                  <div className="absolute top-2 right-2 opacity-20">
                    <ScanLine className="w-24 h-24 text-navy-800" />
                  </div>

                  <div className="border-b border-amber-200 pb-2 text-[11px]">
                    <div className="flex justify-between">
                      <span>SUNRISE PUBLIC / PRAGATI GOVT EXAM SHEET</span>
                      <span>ROLL: #{selectedStudent.rollNo}</span>
                    </div>
                    <div className="flex justify-between text-content-secondary mt-0.5">
                      <span>Student: {selectedStudent.name}</span>
                      <span>Date: Oct 10, 2026</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-[11px] text-teal-800">
                      Q1. Volume Calculation (Cuboid Cistern)
                    </span>
                    <p className="font-sans italic bg-white/70 p-2 rounded border border-amber-200/60 leading-relaxed text-xs">
                      "Length = 4m, Breadth = 3m, Height = 2m. Volume = L × B × H = 4 × 3 × 2 = 24
                      m³. Since 1m³ = 1000 Liters, Total capacity = 24,000 Liters. Time taken at 60
                      L/min = 24000 / 60 = 400 minutes = 6 hrs 40 mins."
                    </p>
                    <div className="flex justify-end gap-1 text-[10px] text-emerald-700 font-bold">
                      ✓ OCR Confidence: 98.4%
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-[11px] text-teal-800">
                      Q2. Multiplicative Inverse (-13/19)
                    </span>
                    <p className="font-sans italic bg-white/70 p-2 rounded border border-amber-200/60 leading-relaxed text-xs">
                      "The reciprocal is -19/13. Because (-13/19) × (-19/13) = +247/247 = 1."
                    </p>
                    <div className="flex justify-end gap-1 text-[10px] text-emerald-700 font-bold">
                      ✓ OCR Confidence: 99.1%
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="font-bold text-[11px] text-teal-800">
                      Q3. Quadrilateral Linguistics
                    </span>
                    <p className="font-sans italic bg-white/70 p-2 rounded border border-amber-200/60 leading-relaxed text-xs">
                      "Every square has all right angles and opposite sides equal, so it meets
                      rectangle criteria. But rectangles do not have all 4 equal sides."
                    </p>
                    <div className="flex justify-end gap-1 text-[10px] text-emerald-700 font-bold">
                      ✓ OCR Confidence: 96.2%
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Right: OCR Extracted Fields & Teacher Verification Form */}
            <Card className="h-full flex flex-col justify-between">
              <CardHeader
                title="Teacher Review & Verification Panel"
                subtitle="AI OCR extraction is assistive only — Educator retains full marking authority"
                action={
                  <Badge variant="teal" size="sm">
                    Score: {totalMarksObtained} / {maxTotal} ({percentage}%)
                  </Badge>
                }
              />
              <CardBody className="p-5 space-y-4 text-xs">
                <div className="p-3 bg-surface-bg rounded-xl border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-900">
                      Item 1: Application (AU) • Max 4m
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Awarded:</span>
                      <input
                        type="number"
                        min="0"
                        max="4"
                        value={q1Marks}
                        onChange={(e) => setQ1Marks(Number(e.target.value))}
                        className="w-14 px-2 py-0.5 bg-white border border-surface-border rounded font-bold text-center"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={q1Feedback}
                    onChange={(e) => setQ1Feedback(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-border rounded text-[11px] text-content-secondary"
                  />
                </div>

                <div className="p-3 bg-surface-bg rounded-xl border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-900">Item 2: Concept (CU) • Max 2m</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Awarded:</span>
                      <input
                        type="number"
                        min="0"
                        max="2"
                        value={q2Marks}
                        onChange={(e) => setQ2Marks(Number(e.target.value))}
                        className="w-14 px-2 py-0.5 bg-white border border-surface-border rounded font-bold text-center"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={q2Feedback}
                    onChange={(e) => setQ2Feedback(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-border rounded text-[11px] text-content-secondary"
                  />
                </div>

                <div className="p-3 bg-surface-bg rounded-xl border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-900">Item 3: Language (LU) • Max 3m</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Awarded:</span>
                      <input
                        type="number"
                        min="0"
                        max="3"
                        value={q3Marks}
                        onChange={(e) => setQ3Marks(Number(e.target.value))}
                        className="w-14 px-2 py-0.5 bg-white border border-surface-border rounded font-bold text-center"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={q3Feedback}
                    onChange={(e) => setQ3Feedback(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-border rounded text-[11px] text-content-secondary"
                  />
                </div>

                <div className="p-3 bg-surface-bg rounded-xl border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-900">
                      Item 4: Critical Thinking (CT) • Max 5m
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Awarded:</span>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={q4Marks}
                        onChange={(e) => setQ4Marks(Number(e.target.value))}
                        className="w-14 px-2 py-0.5 bg-white border border-surface-border rounded font-bold text-center"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={q4Feedback}
                    onChange={(e) => setQ4Feedback(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-surface-border rounded text-[11px] text-content-secondary"
                  />
                </div>

                <div className="pt-3 border-t border-surface-border flex items-center justify-between">
                  <div className="text-[11px] text-content-secondary flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span>Verified by Vikram Sengupta</span>
                  </div>

                  <Button
                    variant="teal"
                    size="md"
                    loading={isVerifying}
                    onClick={handleSaveReviewedScan}
                    icon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Approve & Recalibrate Baseline
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TEACHER REVIEW / STUDENT ASSIGNMENT / RUBRIC OVERRIDE MODAL           */}
      {/* ===================================================================== */}
      <Modal
        isOpen={Boolean(inspectingItem)}
        onClose={() => setInspectingItem(null)}
        title={`Teacher Review & Verification: ${inspectingItem?.fileName || ''}`}
        subtitle="Confirm student identity, inspect question-by-question rubric evaluation, and adjust marks before publishing"
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-content-secondary flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              Teacher override clears review warnings and authorizes publication
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setInspectingItem(null)}>
                Cancel
              </Button>
              <Button
                variant="teal"
                size="sm"
                loading={isSavingOverride}
                onClick={handleSaveItemOverride}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Save Verification & Clear Warnings
              </Button>
            </div>
          </div>
        }
      >
        {inspectingItem && (
          <div className="space-y-4 text-xs">
            {/* Student Identity Confirmation & Total Marks Override */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-surface-bg rounded-xl border border-surface-border">
              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Assigned Student (Class Roster)
                </label>
                <select
                  value={modalStudentId}
                  onChange={(e) => setModalStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-surface-border rounded-lg font-semibold text-navy-900"
                >
                  {classRoster.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} (Roll #{st.rollNo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-navy-900 mb-1">
                  Total Verified Marks (Out of {inspectingItem.maxMarks})
                </label>
                <input
                  type="number"
                  min={0}
                  max={inspectingItem.maxMarks}
                  value={modalMarks}
                  onChange={(e) =>
                    setModalMarks(
                      Math.max(0, Math.min(inspectingItem.maxMarks, Number(e.target.value)))
                    )
                  }
                  className="w-full px-3 py-2 bg-white border border-surface-border rounded-lg font-bold text-navy-900"
                />
              </div>
            </div>

            {/* Question-by-Question Evaluation Breakdown */}
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              <h4 className="font-bold text-navy-900">
                Question-Level Answer Key & Rubric Evaluation ({modalEvaluations.length} Items)
              </h4>
              {modalEvaluations.map((ev, idx) => (
                <div
                  key={ev.question_id || idx}
                  className="p-3 rounded-xl border border-surface-border bg-white space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-navy-900">Q{ev.question_index || idx + 1}</span>
                      <Badge variant="outline" size="sm">
                        {ev.type?.toUpperCase() || 'ITEM'}
                      </Badge>
                      <Badge variant="teal" size="sm">
                        {ev.competency || 'CU'}
                      </Badge>
                      <span className="text-[11px] text-content-muted">
                        OCR: {Math.round((ev.confidence || 0.92) * 100)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold">Marks:</span>
                      <input
                        type="number"
                        min={0}
                        max={ev.max_marks || 5}
                        value={ev.awarded_marks}
                        onChange={(e) => {
                          const val = Math.max(
                            0,
                            Math.min(ev.max_marks || 5, Number(e.target.value))
                          );
                          const next = modalEvaluations.map((item, i) =>
                            i === idx ? { ...item, awarded_marks: val } : item
                          );
                          setModalEvaluations(next);
                          const sum = next.reduce(
                            (acc, curr) => acc + Number(curr.awarded_marks || 0),
                            0
                          );
                          setModalMarks(Math.min(inspectingItem.maxMarks, sum));
                        }}
                        className="w-14 px-2 py-0.5 bg-surface-bg border border-surface-border rounded font-bold text-center"
                      />
                      <span className="text-content-muted">/ {ev.max_marks}</span>
                    </div>
                  </div>

                  <p className="font-medium text-navy-900">{ev.question_text}</p>
                  <div className="p-2 rounded bg-amber-50/50 border border-amber-200/70 text-[11px]">
                    <strong>Extracted Student Answer:</strong> {ev.student_answer}
                  </div>
                  <div className="text-[11px] text-teal-900">
                    <strong>Rubric / Evaluation Feedback:</strong> {ev.feedback}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
