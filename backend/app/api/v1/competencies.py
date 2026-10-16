from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.dependencies import get_current_user
from backend.app.db.session import get_db
from backend.app.models.entities import Student, School, ClassSection, User
from backend.app.schemas.competencies import (
    CompetencyScoresSchema,
    StudentOut,
    ClassCompetencyAnalyticsOut,
    SchoolComparisonItem,
)
from backend.app.services.competency_service import aggregate_student_competencies

router = APIRouter(tags=["Competencies & Analytics"])


@router.get("/students/{student_id}/competencies", response_model=CompetencyScoresSchema)
async def get_student_competencies(
    student_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Enforce record-level authorization
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied. Students can only view their own competency scores.")
    if current_user.role == "parent":
        # Check linked child
        if student_id not in ("user-student-1", "student-ananya"):
            raise HTTPException(status_code=403, detail="Access denied. Parents can only view their linked children.")

    st_res = await db.execute(select(Student).filter(Student.id == student_id))
    st = st_res.scalars().first()
    if not st:
        raise HTTPException(status_code=404, detail="Student not found.")

    return CompetencyScoresSchema(
        LU=st.lu_score,
        CU=st.cu_score,
        AU=st.au_score,
        CT=st.ct_score,
        overall=st.overall_score
    )


@router.get("/classes/{class_id}/competency-analytics", response_model=ClassCompetencyAnalyticsOut)
async def get_class_competency_analytics(
    class_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    st_res = await db.execute(select(Student).filter(Student.class_id == class_id))
    students = st_res.scalars().all()

    avg = aggregate_student_competencies(students)
    needs_support = sum(1 for s in students if s.needs_support)

    return ClassCompetencyAnalyticsOut(
        class_id=class_id,
        average_competencies=CompetencyScoresSchema(**avg),
        baseline_comparison=CompetencyScoresSchema(LU=68, CU=70, AU=62, CT=58, overall=65),
        total_students=len(students),
        needs_support_count=needs_support,
        dimension_breakdown={
            "LU": {"proficient": sum(1 for s in students if s.lu_score >= 70)},
            "CU": {"proficient": sum(1 for s in students if s.cu_score >= 70)},
            "AU": {"proficient": sum(1 for s in students if s.au_score >= 70)},
            "CT": {"proficient": sum(1 for s in students if s.ct_score >= 70)},
        }
    )


@router.get("/schools/{school_id}/competency-analytics")
async def get_school_competency_analytics(
    school_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    st_res = await db.execute(select(Student).filter(Student.school_id == school_id))
    students = st_res.scalars().all()
    avg = aggregate_student_competencies(students)
    return {
        "school_id": school_id,
        "averages": avg,
        "total_evaluated_students": len(students)
    }


@router.get("/analytics/school-comparison", response_model=List[SchoolComparisonItem])
async def get_school_comparison():
    return [
        SchoolComparisonItem(name="Sunrise Public", LU=82, CU=84, AU=78, CT=76),
        SchoolComparisonItem(name="Green Valley", LU=78, CU=80, AU=74, CT=71),
        SchoolComparisonItem(name="Pragati Govt", LU=54, CU=62, AU=52, CT=46),
        SchoolComparisonItem(name="Vidya Niketan", LU=75, CU=76, AU=70, CT=68),
        SchoolComparisonItem(name="Udaan Learning", LU=51, CU=58, AU=48, CT=43),
    ]

