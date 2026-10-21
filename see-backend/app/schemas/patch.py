from pydantic import BaseModel, model_validator
from typing import ClassVar

class RequiredPatch(BaseModel):
    required_fields: ClassVar[set[str]] = set()
    @model_validator(mode="before")
    @classmethod
    def reject_null(cls, values):
        if isinstance(values, dict):
            for field in cls.required_fields:
                if field in values and values[field] is None:
                    raise ValueError(f"{field} cannot be null")
        return values
