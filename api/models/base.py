from typing import Any

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

# https://stackoverflow.com/questions/67995510/how-to-inflect-from-snake-case-to-camel-case-post-the-pydantic-schema-validation


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, from_attributes=True
    )

    def model_dump(self, **kwargs: Any) -> dict[str, Any]:
        kwargs["by_alias"] = kwargs.get("by_alias", True)
        return super().model_dump(**kwargs)

    def model_dump_json(self, **kwargs: Any) -> str:
        kwargs["by_alias"] = kwargs.get("by_alias", True)
        return super().model_dump_json(**kwargs)
