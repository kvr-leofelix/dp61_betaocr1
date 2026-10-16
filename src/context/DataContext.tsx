import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  School,
  ClassSection,
  Subject,
  Student,
  Assessment,
  AssessmentResult,
  CurriculumDay,
  LostTeachingDay,
  CrossCurricularProposal,
  HomeworkRemediation,
  AuditLog,
  NotificationItem,
  SourceDocument,
  Question,
} from '../types';
import {
  initialSchools,
  initialClasses,
  initialSubjects,
  initialStudents,
  initialAssessments,
  initialAssessmentResults,
  initialCurriculumDays,
  initialLostTeachingDays,
  initialCrossCurricularProposals,
  initialHomeworkRemediations,
  initialAuditLogs,
  initialNotifications,
} from '../data/seedData';
import { CompressionPlanProposal } from '../lib/calculations';
import { apiClient } from '../lib/apiClient';

const initialSourceDocuments: SourceDocument[] = [
  {
    id: 'doc-src-math-1',
    schoolId: 'school-1',
    subjectId: 'sub-math',
    uploadedBy: 'user-teacher-1',
    fileName: 'NCERT_Grade8_Ch9_Algebraic_Expressions_&_Identities.pdf',
    mimeType: 'application/pdf',
    fileSize: 1452800,
    pageCount: 18,
    docType: 'source_material',
    status: 'ready',
    extractedTextPreview:
      'Algebraic expressions are formed from variables and constants. Standard identities: (a+b)^2 = a^2 + 2ab + b^2, (a-b)^2 = a^2 - 2ab + b^2, (a+b)(a-b) = a^2 - b^2. Mensuration applications include area of rectangles and polynomials.',
  },
  {
    id: 'doc-src-math-2',
    schoolId: 'school-1',
    subjectId: 'sub-math',
    uploadedBy: 'user-teacher-1',
    fileName: 'CBSE_NEP2020_Mensuration_&_Quadrilaterals_Workbook.pdf',
    mimeType: 'application/pdf',
    fileSize: 984120,
    pageCount: 12,
    docType: 'source_material',
    status: 'ready',
    extractedTextPreview:
      'Properties of Quadrilaterals: sum of interior angles is 360 degrees. Parallelogram opposite sides and angles are equal; diagonals bisect each other. Trapezium area = 1/2 * h * (a + b). Cylinder surface area = 2*pi*r*(r+h) and volume = pi*r^2*h.',
  },
  {
    id: 'doc-src-sci-1',
    schoolId: 'school-1',
    subjectId: 'sub-sci',
    uploadedBy: 'user-teacher-2',
    fileName: 'NCERT_Grade8_Ch11_Force_Pressure_&_Friction_Module.pdf',
    mimeType: 'application/pdf',
    fileSize: 1842000,
    pageCount: 22,
    docType: 'source_material',
    status: 'ready',
    extractedTextPreview:
      'Force is a push or pull resulting from interaction. Pressure = Force / Area (N/m^2 or Pascal). Liquids and gases exert pressure on container walls. Atmospheric pressure and sliding vs rolling friction in mechanical systems.',
  },
  {
    id: 'doc-src-eng-1',
    schoolId: 'school-1',
    subjectId: 'sub-eng',
    uploadedBy: 'user-teacher-1',
    fileName: 'NEP_Reading_Comprehension_&_Critical_Discourse_Anthology.pdf',
    mimeType: 'application/pdf',
    fileSize: 762400,
    pageCount: 14,
    docType: 'source_material',
    status: 'ready',
    extractedTextPreview:
      'Analytical reading, inference from context, active vs passive voice transformation, persuasive essay structure, and critical synthesis of environmental and civic narratives.',
  },
];

const initialQuestionBank: Question[] = initialAssessments.flatMap((asm) =>
  asm.questions.map((q) => ({
    ...q,
    assessmentId: asm.id,
    subjectId: asm.subjectId,
    markingRubric:
      q.markingRubric ||
      (q.type === 'mcq'
        ? `100% marks for selecting exact option: ${q.correctAnswer || 'Option A'}`
        : `Award 40% for conceptual setup (${q.competency}), 40% for analytical reasoning/steps, and 20% for final conclusion (${q.marks}m total).`),
    sourceDocumentIds: ['doc-src-math-1'],
    sourceDocumentNames: ['NCERT_Grade8_Ch9_Algebraic_Expressions_&_Identities.pdf'],
    isAiGenerated: false,
  }))
);

interface DataContextType {
  schools: School[];
  classes: ClassSection[];
  subjects: Subject[];
  students: Student[];
  assessments: Assessment[];
  assessmentResults: AssessmentResult[];
  curriculumDays: CurriculumDay[];
  lostTeachingDays: LostTeachingDay[];
  crossCurricularProposals: CrossCurricularProposal[];
  homeworkRemediations: HomeworkRemediation[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  sourceDocuments: SourceDocument[];
  questionBank: Question[];

  // Mutators
  addSchool: (school: Partial<School>) => void;
  updateSchool: (id: string, updates: Partial<School>) => void;
  assignTeacherToClass: (classId: string, teacherId: string, teacherName: string) => void;
  recordLostTeachingDay: (item: Omit<LostTeachingDay, 'id'>) => void;
  addAssessment: (assessment: Omit<Assessment, 'id'>) => void;
  gradeAssessmentResult: (result: Omit<AssessmentResult, 'id'>) => void;
  applySyllabusCompression: (plan: CompressionPlanProposal) => void;
  acceptCrossCurricularProposal: (id: string) => void;
  rejectCrossCurricularProposal: (id: string) => void;
  assignHomeworkRemediation: (item: Omit<HomeworkRemediation, 'id'>) => void;
  submitStudentHomework: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  addSourceDocuments: (docs: SourceDocument[]) => void;
  removeSourceDocument: (id: string) => void;
  addQuestionsToBank: (questions: Question[]) => void;
  updateBankQuestion: (id: string, updates: Partial<Question>) => void;
  deleteBankQuestion: (id: string) => void;
  attachQuestionsToAssessment: (assessmentId: string, questions: Question[]) => void;
  resetDemoData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

function loadStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(`lumeneios_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`lumeneios_${key}`, JSON.stringify(value));
  } catch (err) {
    console.error('Failed to save to localStorage', err);
  }
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [schools, setSchools] = useState<School[]>(() => loadStorage('schools', initialSchools));
  const [classes, setClasses] = useState<ClassSection[]>(() => loadStorage('classes', initialClasses));
  const [subjects] = useState<Subject[]>(initialSubjects);
  const [students, setStudents] = useState<Student[]>(() => loadStorage('students', initialStudents));
  const [assessments, setAssessments] = useState<Assessment[]>(() => loadStorage('assessments', initialAssessments));
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>(() =>
    loadStorage('assessmentResults', initialAssessmentResults)
  );
  const [curriculumDays, setCurriculumDays] = useState<CurriculumDay[]>(() =>
    loadStorage('curriculumDays', initialCurriculumDays)
  );
  const [lostTeachingDays, setLostTeachingDays] = useState<LostTeachingDay[]>(() =>
    loadStorage('lostTeachingDays', initialLostTeachingDays)
  );
  const [crossCurricularProposals, setCrossCurricularProposals] = useState<CrossCurricularProposal[]>(() =>
    loadStorage('crossCurricularProposals', initialCrossCurricularProposals)
  );
  const [homeworkRemediations, setHomeworkRemediations] = useState<HomeworkRemediation[]>(() =>
    loadStorage('homeworkRemediations', initialHomeworkRemediations)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadStorage('auditLogs', initialAuditLogs));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    loadStorage('notifications', initialNotifications)
  );
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocument[]>(() =>
    loadStorage('sourceDocuments', initialSourceDocuments)
  );
  const [questionBank, setQuestionBank] = useState<Question[]>(() =>
    loadStorage('questionBank', initialQuestionBank)
  );

  // Sync to local storage on changes
  useEffect(() => saveStorage('schools', schools), [schools]);
  useEffect(() => saveStorage('classes', classes), [classes]);
  useEffect(() => saveStorage('students', students), [students]);
  useEffect(() => saveStorage('assessments', assessments), [assessments]);
  useEffect(() => saveStorage('assessmentResults', assessmentResults), [assessmentResults]);
  useEffect(() => saveStorage('curriculumDays', curriculumDays), [curriculumDays]);
  useEffect(() => saveStorage('lostTeachingDays', lostTeachingDays), [lostTeachingDays]);
  useEffect(() => saveStorage('crossCurricularProposals', crossCurricularProposals), [crossCurricularProposals]);
  useEffect(() => saveStorage('homeworkRemediations', homeworkRemediations), [homeworkRemediations]);
  useEffect(() => saveStorage('auditLogs', auditLogs), [auditLogs]);
  useEffect(() => saveStorage('notifications', notifications), [notifications]);
  useEffect(() => saveStorage('sourceDocuments', sourceDocuments), [sourceDocuments]);
  useEffect(() => saveStorage('questionBank', questionBank), [questionBank]);

  // Hydrate source documents and question bank from backend when token is available
  useEffect(() => {
    const token = localStorage.getItem('lumeneios_token');
    if (!token) return;
    apiClient.documents
      .list(undefined, 'source_material')
      .then((docs) => {
        if (docs && docs.length > 0) {
          setSourceDocuments(docs);
        }
      })
      .catch(() => {});
    apiClient.assessments
      .getQuestionBank()
      .then((items) => {
        if (items && items.length > 0) {
          setQuestionBank(items);
        }
      })
      .catch(() => {});
  }, []);

  const addSchool = (schoolData: Partial<School>) => {
    const newSchool: School = {
      id: `school-${Date.now()}`,
      name: schoolData.name || 'New Affiliated School',
      location: schoolData.location || 'New Delhi',
      state: schoolData.state || 'Delhi',
      infrastructureTier: schoolData.infrastructureTier || 'standard',
      academicYear: '2026-2027',
      principalId: `user-pr-${Date.now()}`,
      principalName: schoolData.principalName || 'Principal Assigned',
      studentCount: schoolData.studentCount || 250,
      teacherCount: schoolData.teacherCount || 16,
      classCount: schoolData.classCount || 8,
      pacingRisk: 'low',
      description: schoolData.description || 'Newly onboarded institution in LumenEIOS network.',
      officialWorkingDays: 220,
    };
    setSchools((prev) => [newSchool, ...prev]);

    addAuditLog('Onboarded New School', `Added ${newSchool.name} to state network.`, 'system');
  };

  const updateSchool = (id: string, updates: Partial<School>) => {
    setSchools((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    addAuditLog('Updated School Metadata', `Modified configuration for school ID: ${id}.`, 'system');
  };

  const assignTeacherToClass = (classId: string, teacherId: string, teacherName: string) => {
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? { ...c, classTeacherId: teacherId, classTeacherName: teacherName }
          : c
      )
    );
    addAuditLog(
      'Teacher Reassignment',
      `Assigned ${teacherName} as Lead Teacher for Class ID ${classId}.`,
      'curriculum'
    );
  };

  const recordLostTeachingDay = (item: Omit<LostTeachingDay, 'id'>) => {
    const newItem: LostTeachingDay = {
      ...item,
      id: `ltd-${Date.now()}`,
    };
    setLostTeachingDays((prev) => [newItem, ...prev]);

    addAuditLog(
      'Recorded Lost Instructional Days',
      `Logged ${newItem.daysLost} lost day(s) due to ${newItem.reason}.`,
      'curriculum'
    );

    // Sync with FastAPI backend
    apiClient.calendar
      .recordDisruption(newItem.schoolId, {
        date: newItem.date,
        reason: newItem.reason,
        days_lost: newItem.daysLost,
        notes: newItem.notes,
      })
      .catch((err) => {
        console.warn('Backend disruption sync notice:', err.message);
      });

    // Auto add notification to Principal and Teacher
    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: 'user-teacher-1',
      title: 'Teaching Calendar Updated',
      message: `${newItem.daysLost} teaching days deducted for ${newItem.reason}. Buffer recalculated.`,
      type: 'warning',
      read: false,
      createdAt: 'Just now',
      link: '/teacher/time-aware',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const addAssessment = (assessmentData: Omit<Assessment, 'id'>) => {
    const newAsm: Assessment = {
      ...assessmentData,
      id: `asm-${Date.now()}`,
    };
    setAssessments((prev) => [newAsm, ...prev]);
    addAuditLog('Created Assessment Cycle', `Created assessment: "${newAsm.title}".`, 'assessment');

    // Sync with backend API
    apiClient.assessments
      .create(newAsm.classId, {
        subject_id: newAsm.subjectId,
        title: newAsm.title,
        cycle_number: newAsm.cycleNumber,
        date: newAsm.date,
        duration_minutes: newAsm.durationMinutes,
        total_marks: newAsm.totalMarks,
        competency_focus: newAsm.competencyFocus,
        questions: newAsm.questions,
      })
      .catch((err) => {
        console.warn('Backend assessment sync notice:', err.message);
      });
  };

  const gradeAssessmentResult = (resultData: Omit<AssessmentResult, 'id'>) => {
    const newResult: AssessmentResult = {
      ...resultData,
      id: `res-${Date.now()}`,
    };
    setAssessmentResults((prev) => [newResult, ...prev]);

    // Recalibrate student's current competencies
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === newResult.studentId) {
          return {
            ...s,
            competencies: newResult.scores,
            needsSupport: newResult.percentage < 65,
          };
        }
        return s;
      })
    );

    addAuditLog(
      'Recalibrated Student Baseline',
      `Updated competency baselines for ${newResult.studentName} following graded assessment.`,
      'assessment'
    );

    // Sync with backend API
    apiClient.assessments
      .submitGrade(newResult.assessmentId, {
        student_id: newResult.studentId,
        marks_obtained: newResult.marksObtained,
        total_marks: newResult.totalMarks,
        lu_score: newResult.scores.LU,
        cu_score: newResult.scores.CU,
        au_score: newResult.scores.AU,
        ct_score: newResult.scores.CT,
        feedback: newResult.feedback,
        is_scanned: false,
      })
      .catch((err) => {
        console.warn('Backend grade sync notice:', err.message);
      });
  };

  const applySyllabusCompression = (plan: CompressionPlanProposal) => {
    const reassignedIds = new Set(plan.reassignedTopics.map((t) => t.id));
    const integratedIds = new Set(plan.integratedTopics.map((t) => t.id));

    setCurriculumDays((prev) =>
      prev.map((day) => {
        if (reassignedIds.has(day.id)) {
          return { ...day, status: 'compressed_to_homework' };
        }
        if (integratedIds.has(day.id)) {
          return { ...day, status: 'integrated' };
        }
        return day;
      })
    );

    // Asynchronously call backend compression preview and approval
    apiClient.timeAware
      .previewCompression('class-8a', {
        total_official_days: 220,
        current_day: 104,
      })
      .then((proposal) => {
        if (proposal && proposal.proposal_id) {
          return apiClient.timeAware.approveProposal(proposal.proposal_id);
        }
      })
      .catch((err) => {
        console.warn('Backend syllabus compression sync notice:', err.message);
      });

    addAuditLog(
      'Approved Time-Aware Syllabus Compression',
      `Applied 60/40 compacting strategy recovering ${plan.daysSaved} instructional days. Preserved ${plan.preservedCoreCount} core objectives.`,
      'curriculum'
    );

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userId: 'user-principal-1',
      title: 'Syllabus Compression Approved',
      message: `Vikram Sengupta approved plan recovering ${plan.daysSaved} days. Pacing buffer restored to safe threshold.`,
      type: 'success',
      read: false,
      createdAt: 'Just now',
      link: '/principal/dashboard',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const acceptCrossCurricularProposal = (id: string) => {
    setCrossCurricularProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'accepted' } : p))
    );
    addAuditLog('Cross-Curricular Synergy Approved', `Merged integrated lesson proposal #${id}.`, 'curriculum');
  };

  const rejectCrossCurricularProposal = (id: string) => {
    setCrossCurricularProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'rejected' } : p))
    );
    addAuditLog('Cross-Curricular Proposal Rejected', `Proposal #${id} declined by teacher.`, 'curriculum');
  };

  const assignHomeworkRemediation = (item: Omit<HomeworkRemediation, 'id'>) => {
    const newHw: HomeworkRemediation = {
      ...item,
      id: `hwr-${Date.now()}`,
    };
    setHomeworkRemediations((prev) => [newHw, ...prev]);
    addAuditLog(
      'Assigned Differentiated Remediation',
      `Targeted ${newHw.competencyTarget} gap for ${newHw.studentName}: "${newHw.title}".`,
      'curriculum'
    );
  };

  const submitStudentHomework = (id: string) => {
    setHomeworkRemediations((prev) =>
      prev.map((h) => (h.id === id ? { ...h, status: 'submitted', score: 92 } : h))
    );
    addAuditLog('Student Homework Submitted', `Student completed remediation task #${id}.`, 'assessment');
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const addSourceDocuments = (docs: SourceDocument[]) => {
    setSourceDocuments((prev) => {
      const existingIds = new Set(prev.map((d) => d.id));
      const newOnes = docs.filter((d) => !existingIds.has(d.id));
      return [...newOnes, ...prev];
    });
    if (docs.length > 0) {
      addAuditLog(
        'Bulk Uploaded Source Documents',
        `Added ${docs.length} source document(s) to curriculum repository.`,
        'curriculum'
      );
    }
  };

  const removeSourceDocument = (id: string) => {
    setSourceDocuments((prev) => prev.filter((d) => d.id !== id));
    apiClient.documents.delete(id).catch(() => {});
  };

  const addQuestionsToBank = (questions: Question[]) => {
    setQuestionBank((prev) => {
      const existingIds = new Set(prev.map((q) => q.id));
      const newOnes = questions.filter((q) => !existingIds.has(q.id));
      return [...newOnes, ...prev];
    });
    if (questions.length > 0) {
      addAuditLog(
        'AI Question Bank Updated',
        `Saved ${questions.length} generated question(s) to Question Bank.`,
        'assessment'
      );
    }
  };

  const updateBankQuestion = (id: string, updates: Partial<Question>) => {
    setQuestionBank((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)));
    setAssessments((prev) =>
      prev.map((asm) => ({
        ...asm,
        questions: asm.questions.map((q) => (q.id === id ? { ...q, ...updates } : q)),
      }))
    );
    apiClient.assessments.updateQuestion(id, updates).catch(() => {});
  };

  const deleteBankQuestion = (id: string) => {
    setQuestionBank((prev) => prev.filter((q) => q.id !== id));
    setAssessments((prev) =>
      prev.map((asm) => ({
        ...asm,
        questions: asm.questions.filter((q) => q.id !== id),
      }))
    );
    apiClient.assessments.deleteQuestion(id).catch(() => {});
  };

  const attachQuestionsToAssessment = (assessmentId: string, questions: Question[]) => {
    setAssessments((prev) =>
      prev.map((asm) => {
        if (asm.id !== assessmentId) return asm;
        const existingIds = new Set(asm.questions.map((q) => q.id));
        const toAdd = questions.filter((q) => !existingIds.has(q.id));
        const merged = [...asm.questions, ...toAdd];
        const totalMarks = merged.reduce((sum, q) => sum + (q.marks || 0), 0);
        return {
          ...asm,
          questions: merged,
          totalMarks: Math.max(asm.totalMarks, totalMarks),
        };
      })
    );
    addAuditLog(
      'Attached Questions to Assessment',
      `Added ${questions.length} question(s) to assessment ID ${assessmentId}.`,
      'assessment'
    );
  };

  const addAuditLog = (action: string, details: string, category: 'curriculum' | 'assessment' | 'user' | 'system') => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      userId: 'user-active',
      userName: 'Current Operator',
      action,
      details,
      category,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const resetDemoData = () => {
    localStorage.clear();
    setSchools(initialSchools);
    setClasses(initialClasses);
    setStudents(initialStudents);
    setAssessments(initialAssessments);
    setAssessmentResults(initialAssessmentResults);
    setCurriculumDays(initialCurriculumDays);
    setLostTeachingDays(initialLostTeachingDays);
    setCrossCurricularProposals(initialCrossCurricularProposals);
    setHomeworkRemediations(initialHomeworkRemediations);
    setAuditLogs(initialAuditLogs);
    setNotifications(initialNotifications);
    setSourceDocuments(initialSourceDocuments);
    setQuestionBank(initialQuestionBank);
  };

  return (
    <DataContext.Provider
      value={{
        schools,
        classes,
        subjects,
        students,
        assessments,
        assessmentResults,
        curriculumDays,
        lostTeachingDays,
        crossCurricularProposals,
        homeworkRemediations,
        auditLogs,
        notifications,
        sourceDocuments,
        questionBank,
        addSchool,
        updateSchool,
        assignTeacherToClass,
        recordLostTeachingDay,
        addAssessment,
        gradeAssessmentResult,
        applySyllabusCompression,
        acceptCrossCurricularProposal,
        rejectCrossCurricularProposal,
        assignHomeworkRemediation,
        submitStudentHomework,
        markNotificationAsRead,
        addSourceDocuments,
        removeSourceDocument,
        addQuestionsToBank,
        updateBankQuestion,
        deleteBankQuestion,
        attachQuestionsToAssessment,
        resetDemoData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};


