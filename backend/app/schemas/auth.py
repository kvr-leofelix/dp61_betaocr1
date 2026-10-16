from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr
from backend.app.schemas.common import BaseSchema


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseSchema):
    id: str
    email: str
    name: str
    role: str
    school_id: Optional[str] = None
    designation: Optional[str] = None
    avatar: Optional[str] = None
    assigned_class_ids: List[str] = []
    assigned_subject_ids: List[str] = []
    linked_child_ids: List[str] = []


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class SwitchSchoolRequest(BaseModel):
    school_id: str


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str
    school_id: Optional[str] = None
    designation: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    school_id: Optional[str] = None
    designation: Optional[str] = None
    avatar: Optional[str] = None

