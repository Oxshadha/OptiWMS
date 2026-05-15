import uuid

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from sqlalchemy.types import CHAR, TypeDecorator

from app.db.database import Base


class GUID(TypeDecorator):
    impl = CHAR(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(uuid.UUID(str(value)))

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return uuid.UUID(str(value))

class MaterialDB(Base):
    __tablename__ = "materials"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    material_code = Column(String, unique=True, index=True)
    description = Column(String)
    weight_kg = Column(Float)
    volume_cm3 = Column(Float)
    hazardous = Column(Boolean)
    temperature_controlled = Column(Boolean)
    # Using future_average as a proxy for 'velocity' or pick frequency
    future_average = Column(Float)
    storage_condition = Column(String) # Assumed based on naming convention
    preferred_zone = Column(String)


class LocationDB(Base):
    __tablename__ = "locations"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    warehouse_id = Column(GUID(), index=True)
    location_code = Column(String, unique=True, index=True)
    zone_type = Column(String)
    storage_condition = Column(String)
    max_weight_kg = Column(Float)
    capacity = Column(Float) # Assuming this represents volume capacity
    coordinate_x = Column(Float)
    coordinate_y = Column(Float)
    coordinate_z = Column(Float)
    
    # We can calculate distance_to_dispatch dynamically or assume dispatch is at (0,0)
