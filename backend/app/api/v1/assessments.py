from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.dependencies import get_current_user, require_roles
from backend.app.db.session import get_db
from backend.app.models.entities import (
    Assessment,
    AssessmentSubmission,
    QuestionBankItem,
    Document,
    Student,
    StudentCompetencySnapshot,
    User,
    AuditEvent,
    Notification,
    utc_now,
)
from backend.app.schemas.assessments import (
    AssessmentCreate,
    AssessmentOut,
    SubmissionCreate,
    SubmissionOut,
    GenerateQuestionsRequest,
    RegenerateQuestionRequest,
    QuestionUpdateRequest,
)
from backend.app.services.llm_service import llm_service

router = APIRouter(tags=["Assessments"])


@router.get("/assessments", response_model=List[AssessmentOut])
async def list_all_assessments(
    class_id: Optional[str] = None,
    school_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Assessment)
    if class_id:
        query = query.filter(Assessment.class_id == class_id)
    if school_id:
        query = query.filter(Assessment.school_id == school_id)
    if subject_id:
        query = query.filter(Assessment.subject_id == subject_id)
    res = await db.execute(query.order_by(Assessment.cycle_number))
    return res.scalars().all()


@router.get("/classes/{class_id}/assessments", response_model=List[AssessmentOut])
async def list_class_assessments(
    class_id: str,
    subject_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Assessment).filter(Assessment.class_id == class_id)
    if subject_id:
        query = query.filter(Assessment.subject_id == subject_id)
    res = await db.execute(query.order_by(Assessment.cycle_number))
    return res.scalars().all()


@router.post("/classes/{class_id}/assessments", response_model=AssessmentOut, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    class_id: str,
    req: AssessmentCreate,
    db: AsyncSession = Depends(get_db),
    educator: User = Depends(require_roles("admin", "principal", "teacher"))
):
    asm = Assessment(
        school_id=educator.school_id or "school-1",
        class_id=class_id,
        subject_id=req.subject_id,
        title=req.title,
        cycle_number=req.cycle_number,
        date=req.date,
        duration_minutes=req.duration_minutes,
        total_marks=req.total_marks,
        status="scheduled",
        competency_focus_json=req.competency_focus,
        questions_json=[q.model_dump() for q in req.questions]
    )
    db.add(asm)

    audit = AuditEvent(
        timestamp=utc_now().strftime("%Y-%m-%d %H:%M"),
        user_id=educator.id,
        user_name=educator.name,
        action="Created Assessment Cycle",
        details=f"Created assessment: '{asm.title}' (Cycle {asm.cycle_number})",
        category="assessment"
    )
    db.add(audit)
    await db.commit()
    await db.refresh(asm)
    return asm


def _serialize_qb_item(item: QuestionBankItem) -> Dict[str, Any]:
    return {
        "id": item.id,
        "subject_id": item.subject_id,
        "text": item.text,
        "type": item.type,
        "options": item.options_json or [],
        "correct_answer": item.correct_answer,
        "marking_rubric": item.marking_rubric or item.correct_answer,
        "marks": item.marks,
        "competency": item.competency,
        "bloom_level": item.bloom_level,
        "source_document_ids": item.source_document_ids_json or [],
        "source_document_names": item.source_document_names_json or [],
        "is_ai_generated": item.is_ai_generated,
    }


@router.get("/assessments/question-bank")
async def get_question_bank(
    subject_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(QuestionBankItem)
    if subject_id:
        query = query.filter(QuestionBankItem.subject_id == subject_id)
    res = await db.execute(query.order_by(QuestionBankItem.created_at.desc()))
    items = list(res.scalars().all())
    if items:
        return [_serialize_qb_item(it) for it in items]

    # Fallback default items if table is empty
    return [
        {
            "id": "q-1",
            "subject_id": "sub-math",
            "text": "A water tank is in the shape of a cuboid with length 4m, breadth 3m, and depth 2m. If water is poured at the rate of 60 liters per minute, how many hours will it take to fill the tank completely? (1 m3 = 1000 liters)",
            "type": "practical",
            "options": [],
            "marks": 4,
            "competency": "AU",
            "bloom_level": "Apply",
            "correct_answer": "Volume = 24 m3 = 24,000 Liters. Time = 24000/60 = 400 mins = 6 hours and 40 minutes.",
            "marking_rubric": "1m for cuboid volume; 1m for Liter conversion; 1m for division; 1m for hours/mins.",
            "source_document_ids": ["doc-src-math-1"],
            "source_document_names": ["NCERT_Grade8_Maths_Ch11_Mensuration_&_Volumes.pdf"],
            "is_ai_generated": False,
        }
    ]


@router.post("/assessments/generate-questions")
async def generate_questions_ai(
    req: GenerateQuestionsRequest,
    db: AsyncSession = Depends(get_db),
    educator: User = Depends(require_roles("admin", "principal", "teacher")),
):
    """
    Generates MCQ and Theory questions grounded in one or multiple source documents.
    Saves generated items to the Question Bank and retains source document references.
    """
    if req.mcq_count < 0 or req.theory_count < 0 or (req.mcq_count + req.theory_count) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please request at least 1 MCQ or 1 Theory question.",
        )

    source_docs_data: List[Dict[str, Any]] = []
    if req.source_document_ids:
        doc_res = await db.execute(
            select(Document).filter(Document.id.in_(req.source_document_ids))
        )
        for doc in doc_res.scalars().all():
            source_docs_data.append(
                {
                    "id": doc.id,
                    "file_name": doc.file_name,
                    "extracted_text": doc.extracted_text or "",
                }
            )

    generated_items = await llm_service.generate_questions_from_sources(
        subject_id=req.subject_id,
        mcq_count=req.mcq_count,
        theory_count=req.theory_count,
        bloom_level=req.bloom_level,
        source_documents=source_docs_data,
        focus_topic=req.focus_topic,
    )

    saved_out = []
    for g in generated_items:
        qb_item = QuestionBankItem(
            id=g["id"],
            school_id=educator.school_id or "school-1",
            subject_id=req.subject_id,
            text=g["text"],
            type=g["type"],
            options_json=g.get("options", []),
            correct_answer=g.get("correct_answer"),
            marking_rubric=g.get("marking_rubric"),
            marks=g.get("marks", 2),
            competency=g.get("competency", "CU"),
            bloom_level=g.get("bloom_level", req.bloom_level),
            source_document_ids_json=g.get("source_document_ids", []),
            source_document_names_json=g.get("source_document_names", []),
            is_ai_generated=True,
            created_by=educator.id,
        )
        if req.save_to_bank:
            db.add(qb_item)
        saved_out.append(_serialize_qb_item(qb_item))

    audit = AuditEvent(
        timestamp=utc_now().strftime("%Y-%m-%d %H:%M"),
        user_id=educator.id,
        user_name=educator.name,
        action="AI Generated Competency Questions",
        details=(
            f"Generated {req.mcq_count} MCQs and {req.theory_count} Theory items "
            f"(Bloom: {req.bloom_level}) from {len(source_docs_data) or 1} source document(s)."
        ),
        category="assessment",
    )
    db.add(audit)
    await db.commit()

    return {
        "generated_count": len(saved_out),
        "subject_id": req.subject_id,
        "bloom_level": req.bloom_level,
        "source_documents": source_docs_data,
        "questions": saved_out,
    }


@router.post("/assessments/questions/{question_id}/regenerate")
async def regenerate_question_endpoint(
    question_id: str,
    req: RegenerateQuestionRequest,
    db: AsyncSession = Depends(get_db),
    educator: User = Depends(require_roles("admin", "principal", "teacher")),
):
    new_q = await llm_service.regenerate_single_question(
        subject_id=req.subject_id,
        question_type=req.question_type,
        bloom_level=req.bloom_level,
        competency=req.competency,
        source_document_ids=req.source_document_ids,
        source_document_names=req.source_document_names,
        current_text=req.current_text,
    )

    existing_res = await db.execute(select(QuestionBankItem).filter(QuestionBankItem.id == question_id))
    existing = existing_res.scalars().first()
    if existing:
        existing.text = new_q["text"]
        existing.options_json = new_q.get("options", [])
        existing.correct_answer = new_q.get("correct_answer")
        existing.marking_rubric = new_q.get("marking_rubric")
        existing.marks = new_q.get("marks", existing.marks)
        existing.bloom_level = new_q.get("bloom_level", existing.bloom_level)
        await db.commit()
        await db.refresh(existing)
        return _serialize_qb_item(existing)

    new_q["id"] = question_id
    return new_q


@router.put("/assessments/questions/{question_id}")
async def update_question_endpoint(
    question_id: str,
    req: QuestionUpdateRequest,
    db: AsyncSession = Depends(get_db),
    educator: User = Depends(require_roles("admin", "principal", "teacher")),
):
    res = await db.execute(select(QuestionBankItem).filter(QuestionBankItem.id == question_id))
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Question not found in bank.")

    if req.text is not None:
        item.text = req.text
    if req.type is not None:
        item.type = req.type
    if req.options is not None:
        item.options_json = req.options
    if req.correct_answer is not None:
        item.correct_answer = req.correct_answer
    if req.marking_rubric is not None:
        item.marking_rubric = req.marking_rubric
    if req.marks is not None:
        item.marks = req.marks
    if req.competency is not None:
        item.competency = req.competency
    if req.bloom_level is not None:
        item.bloom_level = req.bloom_level

    await db.commit()
    await db.refresh(item)
    return _serialize_qb_item(item)


@router.delete("/assessments/questions/{question_id}")
async def delete_question_endpoint(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    educator: User = Depends(require_roles("admin", "principal", "teacher")),
):
    res = await db.execute(select(QuestionBankItem).filter(QuestionBankItem.id == question_id))
    item = res.scalars().first()
    if item:
        await db.delete(item)
        await db.commit()
    return {"status": "deleted", "id": question_id}



@router.post("/assessments/{assessment_id}/submissions", response_model=SubmissionOut)
async def submit_assessment_grade(
    assessment_id: str,
    req: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    asm_res = await db.execute(select(Assessment).filter(Assessment.id == assessment_id))
    asm = asm_res.scalars().first()
    if not asm:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    st_res = await db.execute(select(Student).filter(Student.id == req.student_id))
    student = st_res.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # Authorization guard: students can only submit for themselves
    if current_user.role == "student" and current_user.id != req.student_id:
        raise HTTPException(status_code=403, detail="Students cannot submit grades for other students.")

    percentage = round((req.marks_obtained / max(1, req.total_marks)) * 100)
    overall_comp = round((req.lu_score + req.cu_score + req.au_score + req.ct_score) / 4)

    sub = AssessmentSubmission(
        assessment_id=assessment_id,
        student_id=student.id,
        student_name=student.name,
        marks_obtained=req.marks_obtained,
        total_marks=req.total_marks,
        percentage=percentage,
        lu_score=req.lu_score,
        cu_score=req.cu_score,
        au_score=req.au_score,
        ct_score=req.ct_score,
        overall_score=overall_comp,
        feedback=req.feedback,
        submission_date=utc_now().strftime("%Y-%m-%d"),
        is_scanned=req.is_scanned
    )
    db.add(sub)

    # Recalibrate student's live competencies
    student.lu_score = req.lu_score
    student.cu_score = req.cu_score
    student.au_score = req.au_score
    student.ct_score = req.ct_score
    student.overall_score = overall_comp
    student.needs_support = percentage < 65

    # Record historical snapshot
    snapshot = StudentCompetencySnapshot(
        student_id=student.id,
        cycle_number=asm.cycle_number,
        lu_score=req.lu_score,
        cu_score=req.cu_score,
        au_score=req.au_score,
        ct_score=req.ct_score,
        overall_score=overall_comp,
        notes=f"Graded submission for assessment: {asm.title}"
    )
    db.add(snapshot)

    audit = AuditEvent(
        timestamp=utc_now().strftime("%Y-%m-%d %H:%M"),
        user_id=current_user.id,
        user_name=current_user.name,
        action="Graded Assessment Submission",
        details=f"Recorded {percentage}% for {student.name} in '{asm.title}'. Recalibrated baseline.",
        category="assessment"
    )
    db.add(audit)
    await db.commit()
    await db.refresh(sub)

    return SubmissionOut(
        id=sub.id,
        assessment_id=sub.assessment_id,
        student_id=sub.student_id,
        student_name=sub.student_name,
        marks_obtained=sub.marks_obtained,
        total_marks=sub.total_marks,
        percentage=sub.percentage,
        scores={
            "LU": sub.lu_score,
            "CU": sub.cu_score,
            "AU": sub.au_score,
            "CT": sub.ct_score,
            "overall": sub.overall_score
        },
        feedback=sub.feedback,
        submission_date=sub.submission_date,
        is_scanned=sub.is_scanned
    )


@router.get("/assessments/{assessment_id}/submissions", response_model=List[SubmissionOut])
async def list_assessment_submissions(
    assessment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(AssessmentSubmission).filter(AssessmentSubmission.assessment_id == assessment_id)
    if current_user.role == "student":
        query = query.filter(AssessmentSubmission.student_id == current_user.id)

    res = await db.execute(query)
    subs = res.scalars().all()
    return [
        SubmissionOut(
            id=s.id,
            assessment_id=s.assessment_id,
            student_id=s.student_id,
            student_name=s.student_name,
            marks_obtained=s.marks_obtained,
            total_marks=s.total_marks,
            percentage=s.percentage,
            scores={"LU": s.lu_score, "CU": s.cu_score, "AU": s.au_score, "CT": s.ct_score, "overall": s.overall_score},
            feedback=s.feedback,
            submission_date=s.submission_date,
            is_scanned=s.is_scanned
        ) for s in subs
    ]
