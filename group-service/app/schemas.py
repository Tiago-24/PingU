from pydantic import BaseModel, ConfigDict
from typing import List

class GroupCreate(BaseModel):
    name: str
    member_ids: List[int]

class GroupOut(BaseModel):
    id: int
    name: str
    # owner is useful on the client
    owner_id: int | None = None
    model_config = ConfigDict(from_attributes=True)


class GroupInfoOut(BaseModel):
    id: int
    name: str
    owner_username: str

class GroupMemberOut(BaseModel):
    id: int
    user_id: int
    group_id: int

    model_config = ConfigDict(from_attributes=True)
