from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import timedelta
import models
from database import get_db
from security import (
    verify_password,
    get_password_hash,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(prefix="/v1/auth", tags=["Authentication"])

class Token(BaseModel):
    access_token: str
    token_type: str

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

@router.post("/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(
        (models.User.username == user.username) | (models.User.email == user.email)
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
        
    hashed_password = get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        rating=500,
        rank="25k"
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(new_user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Authenticate by username or email
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

class ForgotPasswordRequest(BaseModel):
    email_or_username: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        (models.User.username == req.email_or_username) | 
        (models.User.email == req.email_or_username)
    ).first()
    
    if not user:
        # Prevent user enumeration by unconditionally mimicking success
        return {"msg": "If an account exists, a recovery link has been generated."}
        
    expires = timedelta(minutes=30)
    reset_token = create_access_token(data={"sub": str(user.id), "type": "reset"}, expires_delta=expires)
    
    # Developer convenience payload strictly simulating an email broadcast logic
    print("=" * 60, flush=True)
    print(f"🔐 PASSWORD RECOVERY TOKEN GENERATED FOR {user.username}:", flush=True)
    print(f"LOCAL: http://localhost:3000/reset-password?token={reset_token}", flush=True)
    print(f"PROD: http://89.167.122.76:3005/reset-password?token={reset_token}", flush=True)
    print("=" * 60, flush=True)
    
    return {"msg": "If an account exists, a recovery link has been generated."}

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    from security import SECRET_KEY, ALGORITHM, jwt, JWTError
    try:
        payload = jwt.decode(req.token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        token_type: str = payload.get("type", "")
        if user_id_str is None or token_type != "reset":
            raise HTTPException(status_code=400, detail="Invalid reset token.")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
        
    user = db.query(models.User).filter(models.User.id == user_id_str).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    user.hashed_password = get_password_hash(req.new_password)
    db.commit()
    
    return {"msg": "Password updated successfully."}
