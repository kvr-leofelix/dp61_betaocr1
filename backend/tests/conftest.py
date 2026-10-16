import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.main import app
from backend.app.core.config import settings
from backend.app.core.security import create_access_token
from backend.app.db.session import init_db, AsyncSessionLocal
from backend.app.seed.seed_data import seed_database_if_empty


@pytest_asyncio.fixture(scope="session", autouse=True)
async def prepare_database():
    await init_db()
    async with AsyncSessionLocal() as session:
        await seed_database_if_empty(session)
    yield


@pytest_asyncio.fixture
async def db_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def admin_token() -> str:
    return create_access_token("user-admin", school_id="school-1", role="admin")


@pytest.fixture
def principal_token() -> str:
    return create_access_token("user-principal-1", school_id="school-1", role="principal")


@pytest.fixture
def teacher_token() -> str:
    return create_access_token("user-teacher-1", school_id="school-1", role="teacher")


@pytest.fixture
def student_token() -> str:
    return create_access_token("user-student-1", school_id="school-1", role="student")


@pytest.fixture
def parent_token() -> str:
    return create_access_token("user-parent-1", school_id="school-1", role="parent")


@pytest.fixture
def other_school_teacher_token() -> str:
    return create_access_token("user-teacher-3", school_id="school-3", role="teacher")

