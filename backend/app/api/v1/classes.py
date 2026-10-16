from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.dependencies import get_current_user, require_roles
from backend.app.db.session import get_db
from backend.app.models.entities import ClassSection, Student, User, AuditEvent, utc_now
from backend.app.schemas.schools import ClassSectionOut, TeacherAssignmentRequest
from backend.app.schemas.competencies import StudentOut, CompetencyScoresSchema

router = APIRouter(prefix="/classes", tags=["Classes"])


@router.get("/{class_id}", response_model=ClassSectionOut)
async def get_class(class_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(ClassSection).filter(ClassSection.id == class_id))
    cls = result.scalars().first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found.")
    return cls


@router.post("/{class_id}/assignments", response_model=ClassSectionOut)
async def assign_teacher(
    class_id: str,
    req: TeacherAssignmentRequest,
    db: AsyncSession = Depends(get_db),
    admin_or_principal: User = Depends(require_roles("admin", "principal"))
):
    result = await db.execute(select(ClassSection).filter(ClassSection.id == class_id))
    cls = result.scalars().first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found.")

    cls.class_teacher_id = req.teacher_id
    cls.class_teacher_name = req.teacher_name

    audit = AuditEvent(
        timestamp=utc_now().strftime("%Y-%m-%d %H:%M"),
        user_id=admin_or_principal.id,
        user_name=admin_or_principal.name,
        action="Teacher Reassignment",
        details=f"Assigned {req.teacher_name} as lead teacher for {cls.name}",
        category="curriculum"
    )
    db.add(audit)
    await db.commit()
    await db.refresh(cls)
    return cls


@router.get("/{class_id}/students", response_model=List[StudentOut])
async def list_class_students(
    class_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Student).filter(Student.class_id == class_id).order_by(Student.roll_no))
    students = result.scalars().all()
    
    out = []
    for s in students:
        out.append(
            StudentOut(
                id=s.id,
                school_id=s.school_id,
                class_id=s.class_id,
                class_name=s.class_name,
                name=s.name,
                roll_no=s.roll_no,
                gender=s.gender,
                attendance_pct=s.attendance_pct,
                competencies=CompetencyScoresSchema(
                    LU=s.lu_score, CU=s.cu_score, AU=s.au_score, CT=s.ct_score, overall=s.overall_score
                ),
                baseline_competencies=CompetencyScoresSchema(
                    LU=s.baseline_lu, CU=s.baseline_cu, AU=s.baseline_au, CT=s.baseline_ct, overall=s.baseline_overall
                ),
                learning_modality=s.learning_modality,
                parent_id=s.parent_id,
                homework_completion_rate=s.homework_completion_rate,
                needs_support=s.needs_support,
                support_area=s.support_area,
            )
        )
    return out

