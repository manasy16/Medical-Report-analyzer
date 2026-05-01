from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models.models import User
from auth.utils import get_password_hash, verify_password, create_access_token
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])

class UserSignup(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

@router.post("/signup")
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_data.password)
    new_user = User(email=user_data.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.email, "id": new_user.id})
    return {"access_token": access_token, "token_type": "bearer", "user": {"email": new_user.email, "id": new_user.id}}

@router.post("/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user.email, "id": user.id})
    return {"access_token": access_token, "token_type": "bearer", "user": {"email": user.email, "id": user.id}}
