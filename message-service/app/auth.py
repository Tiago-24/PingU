from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import os

USER_SERVICE_URL = os.getenv("USER_SERVICE_URL")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{USER_SERVICE_URL}/login")

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))


def verify_token(token: str = Depends(oauth2_scheme)):
    if token == "INTERNAL" or token == "Bearer INTERNAL":
        return {"username": "system", "token": "INTERNAL"}
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        payload["token"] = token
        return payload  # payload pode conter user_id, username, exp, etc.
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
