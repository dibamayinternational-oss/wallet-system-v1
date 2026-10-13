
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserResponse, UserLogin, TokenResponse
from app.core.auth import get_current_user
from decimal import Decimal

from app.models.wallet import Wallet
from app.core.wallet import generate_wallet_number

# from app.core.security import verify_password, create_access_token
# from app.schemas.user import UserLogin, TokenResponse
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    email = str(user_data.email).lower()

    existing_user = db.scalar(
        select(User).where(User.email == email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=user_data.full_name.strip(),
        email=email,
        hashed_password=hash_password(user_data.password),
    )


    try:
        db.add(user)
        db.flush()  # Get the newly created user's ID.

        wallet = Wallet(
            user_id=user.id,
            # wallet_number=f"WAL-{100000 + user.id}",
            wallet_number=generate_wallet_number(user.id),
            balance=Decimal("0.00"),
            status="active",
        )

        db.add(wallet)
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create the account. This email may already exist.",
        )

    return user
    
    



@router.post(
        "/login", 
        response_model=TokenResponse
)
def login_user(
    login_data: UserLogin,
    db: Session = Depends(get_db),
):
    email = str(login_data.email).lower()

    user = db.scalar(
        select(User).where(User.email == email)
    )

    if user is None or not verify_password(
        login_data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive.",
        )

    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return current_user