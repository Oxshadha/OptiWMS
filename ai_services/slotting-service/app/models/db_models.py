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
    material_type = Column(String)  # FG or RM
    category = Column(String)
    storage_type = Column(String)   # PALLET, DRUM, CARTON, BAG, IBC, ROLL, REEL
    length_cm = Column(Float)
    width_cm = Column(Float)
    height_cm = Column(Float)
    weight_kg = Column(Float)
    volume_cm3 = Column(Float)
    units_per_pallet = Column(Integer)
    hazardous = Column(Boolean)
    hazard_class = Column(String)
    temperature_controlled = Column(Boolean)
    future_average = Column(Float)
    abc_class = Column(String)      # A, B, C
    fms_class = Column(String)      # Fast, Medium, Slow
    forecast_p50 = Column(Float)
    forecast_p10 = Column(Float)
    forecast_p90 = Column(Float)
    storage_condition = Column(String)
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
