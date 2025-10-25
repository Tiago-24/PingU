from pydantic import BaseModel
from typing import List

class GroupCreate(BaseModel):
    name: str
    member_ids: List[int]