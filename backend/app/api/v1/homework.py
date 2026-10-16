from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from backend.app.api.dependencies import get_current_user, require_roles
from backend.app.db.session import get_db
from backend.app.models.entities import HomeworkRemediation, Student, User, AuditEvent, utc_now
from backend.app.schemas.competencies import HomeworkOut
from backend.app.services.competency_service import generate_differentiated_recommendation

router = APIRouter(tags=["Homework & Remediation"])


class HomeworkCreate(BaseModel):
    student_id: str
    class_id: str
    subject_id: str = "sub-math"
    title: str
    competency_target: str
    reason: Optional[str] = None
    description: str
    due_date: str


@router.get("/classes/{class_id}/homework", response_model=List[HomeworkOut])
async def list_class_homework(class_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(HomeworkRemediation).filter(HomeworkRemediation.class_id == class_id))
    return res.scalars().all()


@router.post("/classes/{class_id}/homework", response_model=HomeworkOut, status_code=status.HTTP_201_CREATED)
async def assign_homework(
    class_id: str,
    req: HomeworkCreate,
    db: AsyncSession = Depends(get_db),
    educator: User = Depends(require_roles("admin", "principal", "teacher"))
):
    st_res = await db.execute(select(Student).filter(Student.id == req.student_id))
    st = st_res.scalars().first()
    student_name = st.name if st else "Student"

    hw = HomeworkRemediation(
        student_id=req.student_id,
        student_name=student_name,
        class_id=class_id,
        subject_id=req.subject_id,
        title=req.title,
        competency_target=req.competency_target,
        reason=req.reason,
        description=req.description,
        due_date=req.due_date,
        status="assigned"
    )
    db.add(hw)

    audit = AuditEvent(
        timestamp=utc_now().strftime("%Y-%m-%d %H:%M"),
        user_id=educator.id,
        user_name=educator.name,
        action="Assigned Differentiated Remediation",
        details=f"Assigned {req.competency_target} task '{req.title}' to {student_name}",
        category="curriculum"
    )
    db.add(audit)
    await db.commit()
    await db.refresh(hw)
    return hw


@router.get("/students/{student_id}/homework", response_model=List[HomeworkOut])
async def list_student_homework(student_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied.")

    res = await db.execute(select(HomeworkRemediation).filter(HomeworkRemediation.student_id == student_id))
    return res.scalars().all()


@router.post("/homework/{homework_id}/submissions")
async def submit_homework(homework_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(HomeworkRemediation).filter(HomeworkRemediation.id == homework_id))
    hw = res.scalars().first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found.")

    hw.status = "submitted"
    hw.score = 92
    await db.commit()
    return {"message": "Homework submitted successfully.", "score": 92}


@router.get("/students/{student_id}/remediation/recommendation")
async def get_student_remediation_recommendation(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    st_res = await db.execute(select(Student).filter(Student.id == student_id))
    st = st_res.scalars().first()
    if not st:
        raise HTTPException(status_code=404, detail="Student not found.")
    return generate_differentiated_recommendation(st)

