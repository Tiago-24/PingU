from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Postgres connection URL → same DB container from docker-compose
SQLALCHEMY_DATABASE_URL = "postgresql://groupuser:grouppass@group-db:5432/groupdb"


# Create engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()
