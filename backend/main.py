import os
import uuid
import json
import base64
import io
import secrets
import hashlib
from dotenv import load_dotenv

load_dotenv()
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./parkease_demo.db")
SECRET_KEY = os.getenv("JWT_SECRET", "hackathon-super-secret-key-change-in-prod")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# =====================================================================
# 1. CORE RELATIONAL DATA MODEL
# =====================================================================

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, nullable=False)  # "CUSTOMER" | "OPERATOR"
    phone = Column(String, default="+91 98765 43210")

class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    nickname = Column(String, nullable=False)
    make_model = Column(String, nullable=False)
    color = Column(String, nullable=False)
    plate_number = Column(String, nullable=False)
    category = Column(String, nullable=False)  # "BIKE" | "CAR" | "EV"
    ocr_source = Column(String, default="MANUAL")  # "MANUAL" | "SIMULATED_OCR"

class Destination(Base):
    __tablename__ = "destinations"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # Mall, Hospital, Landmark, Hotel (Destination-only)
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    public_parking_note = Column(String, nullable=False)

class Facility(Base):
    __tablename__ = "facilities"
    id = Column(String, primary_key=True, index=True)
    operator_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    address = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    operating_hours = Column(String, default="06:00 - 23:59")
    status = Column(String, default="PUBLISHED")  # "DRAFT" | "PUBLISHED" | "PAUSED" | "CLOSED"
    allow_standard_car_in_ev = Column(Boolean, default=False)
    allow_pay_at_exit = Column(Boolean, default=True)
    active_layout_version = Column(Integer, default=1)
    rate_bike_hr = Column(Float, default=20.0)
    rate_car_hr = Column(Float, default=40.0)
    rate_ev_hr = Column(Float, default=50.0)
    ev_charging_fee = Column(Float, default=30.0)
    grace_period_mins = Column(Integer, default=15)
    daily_cap = Column(Float, default=350.0)
    overstay_multiplier = Column(Float, default=1.5)

class ParkingSlot(Base):
    __tablename__ = "parking_slots"
    id = Column(String, primary_key=True, index=True)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False)
    layout_version = Column(Integer, default=1)
    code = Column(String, nullable=False)
    floor = Column(String, default="G")
    zone = Column(String, default="Zone A")
    slot_type = Column(String, nullable=False)  # "BIKE" | "CAR" | "EV"
    has_ev_charger = Column(Boolean, default=False)
    ev_charger_working = Column(Boolean, default=True)
    is_accessible = Column(Boolean, default=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    width = Column(Float, default=65.0)
    height = Column(Float, default=110.0)
    rotation = Column(Float, default=0.0)
    status = Column(String, default="AVAILABLE")  # AVAILABLE, OCCUPIED, RESERVED, BLOCKED, STALE
    data_source = Column(String, default="SIMULATED_DEMO")  # LIVE_IOT, OPERATOR_UPDATED, SIMULATED_DEMO, UNKNOWN_STALE
    last_updated = Column(DateTime, default=datetime.utcnow)
    ai_confidence = Column(Float, default=1.0)

class LayoutElement(Base):
    __tablename__ = "layout_elements"
    id = Column(String, primary_key=True)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False)
    element_type = Column(String, nullable=False)  # "ENTRANCE" | "EXIT" | "AISLE" | "OBSTACLE"
    label = Column(String, nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)

class VideoDigitisationJob(Base):
    __tablename__ = "video_jobs"
    id = Column(String, primary_key=True)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False)
    filename = Column(String, nullable=False)
    status = Column(String, default="REVIEW_REQUIRED")
    frames_extracted = Column(Integer, default=14)
    candidate_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(String, primary_key=True, index=True)
    booking_ref = Column(String, unique=True, index=True)
    customer_id = Column(String, ForeignKey("users.id"), nullable=False)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False)
    slot_id = Column(String, ForeignKey("parking_slots.id"), nullable=False)
    vehicle_id = Column(String, ForeignKey("vehicles.id"), nullable=False)
    snapshot_slot_code = Column(String, nullable=False)
    snapshot_plate = Column(String, nullable=False)
    snapshot_vehicle_type = Column(String, nullable=False)
    snapshot_hourly_rate = Column(Float, nullable=False)
    booking_type = Column(String, default="ADVANCE")
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    duration_hours = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    payment_mode = Column(String, default="PREPAID")
    payment_status = Column(String, default="PENDING")
    status = Column(String, default="HOLD")
    hold_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ParkingSession(Base):
    __tablename__ = "parking_sessions"
    id = Column(String, primary_key=True)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=False)
    facility_id = Column(String, ForeignKey("facilities.id"), nullable=False)
    slot_id = Column(String, ForeignKey("parking_slots.id"), nullable=False)
    presented_plate = Column(String, nullable=False)
    plate_verified = Column(Boolean, default=True)
    operator_override_note = Column(String, nullable=True)
    entry_time = Column(DateTime, default=datetime.utcnow)
    exit_time = Column(DateTime, nullable=True)
    final_charge = Column(Float, default=0.0)
    status = Column(String, default="ACTIVE")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True)
    booking_id = Column(String, ForeignKey("bookings.id"), nullable=False)
    idempotency_key = Column(String, unique=True, index=True)
    amount = Column(Float, nullable=False)
    method = Column(String, nullable=False)
    status = Column(String, default="SUCCESS")
    created_at = Column(DateTime, default=datetime.utcnow)

class ParkingPass(Base):
    __tablename__ = "parking_passes"
    id = Column(String, primary_key=True)
    booking_id = Column(String, ForeignKey("bookings.id"), unique=True, nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True)
    facility_id = Column(String, nullable=False)
    actor_role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# =====================================================================
# 2. SEED CHANDIGARH / MOHALI DEMO ENVIRONMENT
# =====================================================================

def seed_demo_data(db: Session):
    if db.query(User).count() > 0:
        return

    cust = User(id="usr-cust-1", name="Aarav Sharma", email="customer@parkease.demo", role="CUSTOMER", phone="+91 98150 11223")
    oper = User(id="usr-oper-1", name="Vikramjeet Singh (TriCity Parking Ops)", email="operator@parkease.demo", role="OPERATOR", phone="+91 98140 99887")
    db.add_all([cust, oper])

    v1 = Vehicle(id="veh-1", user_id=cust.id, nickname="Daily Commuter", make_model="Tata Nexon EV", color="Teal Blue", plate_number="CH01EV2026", category="EV", ocr_source="SIMULATED_OCR")
    v2 = Vehicle(id="veh-2", user_id=cust.id, nickname="Family Hatch", make_model="Maruti Swift", color="Pearl White", plate_number="CH01AB1045", category="CAR", ocr_source="MANUAL")
    v3 = Vehicle(id="veh-3", user_id=cust.id, nickname="City Rider", make_model="Royal Enfield Classic 350", color="Stealth Black", plate_number="PB65BK8821", category="BIKE", ocr_source="MANUAL")
    db.add_all([v1, v2, v3])

    destinations = [
        Destination(id="dest-1", name="Nexus Elante Mall", category="Shopping Mall", address="Industrial Area Phase I, Chandigarh", lat=30.7055, lng=76.8013, public_parking_note="Use Authorised Elante East Smart Annex across the service road."),
        Destination(id="dest-2", name="Sector 17 Plaza", category="Commercial Hub", address="Sector 17, Chandigarh", lat=30.7398, lng=76.7827, public_parking_note="Use Authorised MC Sector 17 Multi-Level Smart Lot."),
        Destination(id="dest-3", name="CP67 Mall Mohali", category="Shopping Mall", address="Sector 67, Airport Road, Mohali", lat=30.6792, lng=76.7285, public_parking_note="Use Authorised Airport Road Smart Deck."),
        Destination(id="dest-4", name="JW Marriott Chandigarh (Destination Only)", category="Luxury Hotel", address="Plot 6, Sector 35B, Chandigarh", lat=30.7267, lng=76.7664, public_parking_note="Private hotel premises. Not a publicly bookable ParkEase facility; book nearby Sector 35 Municipal Smart Lot."),
        Destination(id="dest-5", name="PGIMER Chandigarh", category="Hospital", address="Sector 12, Chandigarh", lat=30.7649, lng=76.7750, public_parking_note="Public institutional campus."),
        Destination(id="dest-6", name="Sukhna Lake", category="Landmark", address="Sector 1, Chandigarh", lat=30.7421, lng=76.8188, public_parking_note="Public promenade.")
    ]
    db.add_all(destinations)

    fac1 = Facility(
        id="fac-elante-east",
        operator_id=oper.id,
        name="Elante East Smart Annex (Authorised Demo Lot)",
        description="AI-digitised surface & covered lot 120m from Nexus Elante Gate 3. Dedicated EV fast chargers, 2W bays, and Smart Gate QR entry.",
        address="Plot 178-A Service Lane, Industrial Area Phase I, Chandigarh",
        lat=30.7062, lng=76.8025,
        operating_hours="06:00 - 23:59",
        status="PUBLISHED",
        allow_standard_car_in_ev=False,
        allow_pay_at_exit=True,
        active_layout_version=2,
        rate_bike_hr=20.0, rate_car_hr=40.0, rate_ev_hr=50.0, ev_charging_fee=35.0
    )
    fac2 = Facility(
        id="fac-sec17-mlcp",
        operator_id=oper.id,
        name="Sector 17 South Smart Deck (Authorised Demo Lot)",
        description="Automated demo facility serving Sector 17 Plaza and Rose Garden visitors.",
        address="Sector 17-C Bank Square Approach, Chandigarh",
        lat=30.7385, lng=76.7839,
        operating_hours="00:00 - 23:59",
        status="PUBLISHED",
        allow_standard_car_in_ev=True,
        allow_pay_at_exit=True,
        active_layout_version=1,
        rate_bike_hr=15.0, rate_car_hr=30.0, rate_ev_hr=45.0, ev_charging_fee=25.0
    )
    db.add_all([fac1, fac2])

    elements = [
        LayoutElement(id="el-1", facility_id=fac1.id, element_type="ENTRANCE", label="ENTRY GATE 1 (North Lane)", x=20, y=210, width=90, height=45),
        LayoutElement(id="el-2", facility_id=fac1.id, element_type="EXIT", label="EXIT GATE 2 (South Lane)", x=690, y=210, width=90, height=45),
        LayoutElement(id="el-3", facility_id=fac1.id, element_type="AISLE", label="Main Two-Way Drive Aisle (6m Wide)", x=120, y=195, width=560, height=75),
        LayoutElement(id="el-4", facility_id=fac1.id, element_type="OBSTACLE", label="Structural Pillar P1", x=375, y=60, width=45, height=95)
    ]
    db.add_all(elements)

    slots_data = [
        ("A-01", "Zone A (EV & Accessible)", "EV", True, True, True, 130, 55, 65, 110, "AVAILABLE", "SIMULATED_DEMO", 0.96),
        ("A-02", "Zone A (EV & Accessible)", "EV", True, True, False, 205, 55, 65, 110, "AVAILABLE", "SIMULATED_DEMO", 0.94),
        ("A-03", "Zone A (EV & Accessible)", "EV", True, False, False, 280, 55, 65, 110, "AVAILABLE", "OPERATOR_UPDATED", 0.91),
        ("A-04", "Zone B (Standard Car)", "CAR", False, False, True, 435, 55, 65, 110, "OCCUPIED", "SIMULATED_DEMO", 0.95),
        ("A-05", "Zone B (Standard Car)", "CAR", False, False, False, 510, 55, 65, 110, "AVAILABLE", "SIMULATED_DEMO", 0.98),
        ("A-06", "Zone B (Standard Car)", "CAR", False, False, False, 585, 55, 65, 110, "STALE", "UNKNOWN_STALE", 0.89),
        ("B-01", "Zone C (Two-Wheeler)", "BIKE", False, False, False, 130, 300, 48, 95, "AVAILABLE", "SIMULATED_DEMO", 0.92),
        ("B-02", "Zone C (Two-Wheeler)", "BIKE", False, False, False, 190, 300, 48, 95, "OCCUPIED", "SIMULATED_DEMO", 0.93),
        ("B-03", "Zone B (Standard Car)", "CAR", False, False, False, 260, 300, 65, 110, "AVAILABLE", "SIMULATED_DEMO", 0.97),
        ("B-04", "Zone B (Standard Car)", "CAR", False, False, False, 335, 300, 65, 110, "RESERVED", "SIMULATED_DEMO", 0.95),
        ("B-05", "Zone B (Standard Car)", "CAR", False, False, False, 410, 300, 65, 110, "AVAILABLE", "SIMULATED_DEMO", 0.96),
        ("B-06", "Zone B (Standard Car)", "CAR", False, False, False, 485, 300, 65, 110, "BLOCKED", "OPERATOR_UPDATED", 0.88),
    ]
    for idx, (code, zone, stype, has_ev, ev_ok, acc, x, y, w, h, st, src, conf) in enumerate(slots_data):
        db.add(ParkingSlot(
            id=f"slot-elante-{idx+1}",
            facility_id=fac1.id,
            layout_version=2,
            code=code,
            floor="Ground Floor (G)",
            zone=zone,
            slot_type=stype,
            has_ev_charger=has_ev,
            ev_charger_working=ev_ok,
            is_accessible=acc,
            x=x, y=y, width=w, height=h,
            status=st,
            data_source=src,
            ai_confidence=conf,
            last_updated=datetime.utcnow() - timedelta(minutes=45 if st == "STALE" else 2)
        ))

    for idx in range(1, 7):
        db.add(ParkingSlot(
            id=f"slot-sec17-{idx}",
            facility_id=fac2.id,
            layout_version=1,
            code=f"S-{idx:02d}",
            floor="Level 1",
            zone="Main Deck",
            slot_type="EV" if idx == 1 else ("BIKE" if idx == 6 else "CAR"),
            has_ev_charger=(idx == 1),
            ev_charger_working=True,
            is_accessible=(idx == 2),
            x=100 + idx * 80, y=80, width=65, height=110,
            status="AVAILABLE" if idx != 3 else "OCCUPIED",
            data_source="SIMULATED_DEMO",
            ai_confidence=0.95
        ))

    now = datetime.utcnow()
    b1 = Booking(
        id="bk-demo-101",
        booking_ref="PK-ELANTE-8821",
        customer_id=cust.id,
        facility_id=fac1.id,
        slot_id="slot-elante-10",
        vehicle_id=v2.id,
        snapshot_slot_code="B-04",
        snapshot_plate="CH01AB1045",
        snapshot_vehicle_type="CAR",
        snapshot_hourly_rate=40.0,
        booking_type="ADVANCE",
        start_time=now + timedelta(minutes=15),
        end_time=now + timedelta(hours=2, minutes=15),
        duration_hours=2.0,
        total_amount=80.0,
        payment_mode="PREPAID",
        payment_status="PAID",
        status="CONFIRMED"
    )
    p1 = Payment(
        id="pay-demo-101",
        booking_id=b1.id,
        idempotency_key="idem-seed-101",
        amount=80.0,
        method="SIMULATED_UPI",
        status="SUCCESS"
    )
    db.add_all([b1, p1])
    db.commit()

# =====================================================================
# 3. FASTAPI APP & MIDDLEWARE
# =====================================================================

app = FastAPI(title="ParkEase AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        seed_demo_data(db)
        yield db
    finally:
        db.close()

def cleanup_expired_holds(db: Session):
    now = datetime.utcnow()
    expired_bookings = db.query(Booking).filter(
        Booking.status == "HOLD",
        Booking.hold_expires_at != None,
        Booking.hold_expires_at < now
    ).all()
    for b in expired_bookings:
        b.status = "EXPIRED"
        slot = db.query(ParkingSlot).filter(ParkingSlot.id == b.slot_id).first()
        if slot and slot.status == "RESERVED":
            slot.status = "AVAILABLE"
    if expired_bookings:
        db.commit()

# =====================================================================
# 4. API ENDPOINTS
# =====================================================================

class HoldRequest(BaseModel):
    customer_id: str
    facility_id: str
    slot_id: str
    vehicle_id: str
    duration_hours: float
    booking_type: str = "ADVANCE"
    payment_mode: str = "PREPAID"

class ConfirmBookingRequest(BaseModel):
    booking_id: str
    payment_method: str = "SIMULATED_UPI"
    idempotency_key: str

class GateEntryRequest(BaseModel):
    booking_ref: str
    presented_plate: str
    pass_token: Optional[str] = None
    operator_override: bool = False
    override_note: Optional[str] = None

class GateExitRequest(BaseModel):
    booking_ref: str
    payment_method: str = "SIMULATED_UPI"

class ManualPaymentVerifyRequest(BaseModel):
    booking_ref: str
    transaction_reference: str
    operator_note: Optional[str] = None

class SlotUpdateRequest(BaseModel):
    code: Optional[str] = None
    slot_type: Optional[str] = None
    status: Optional[str] = None
    has_ev_charger: Optional[bool] = None
    ev_charger_working: Optional[bool] = None
    is_accessible: Optional[bool] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None

@app.get("/api/bootstrap")
def get_bootstrap_state(db: Session = Depends(get_db)):
    cleanup_expired_holds(db)
    return {
        "users": db.query(User).all(),
        "destinations": db.query(Destination).all(),
        "facilities": db.query(Facility).all(),
        "slots": db.query(ParkingSlot).all(),
        "layout_elements": db.query(LayoutElement).all(),
        "vehicles": db.query(Vehicle).all(),
        "bookings": db.query(Booking).order_by(Booking.created_at.desc()).all(),
        "sessions": db.query(ParkingSession).all(),
        "payments": db.query(Payment).order_by(Payment.created_at.desc()).all(),
        "audit_logs": db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(25).all()
    }

@app.post("/api/bookings/hold")
def create_slot_hold(req: HoldRequest, db: Session = Depends(get_db)):
    cleanup_expired_holds(db)
    facility = db.query(Facility).filter(Facility.id == req.facility_id).first()
    if not facility or facility.status != "PUBLISHED":
        raise HTTPException(status_code=400, detail="Facility is not published or open for bookings.")

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == req.slot_id).with_for_update().first()
    if not slot or slot.status != "AVAILABLE":
        raise HTTPException(status_code=409, detail=f"Slot {slot.code if slot else ''} is not available.")

    vehicle = db.query(Vehicle).filter(Vehicle.id == req.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")

    if vehicle.category == "BIKE" and slot.slot_type != "BIKE":
        raise HTTPException(status_code=400, detail="Bikes can only book Bike-compatible bays.")
    if vehicle.category == "CAR":
        if slot.slot_type == "BIKE":
            raise HTTPException(status_code=400, detail="Cars cannot fit in Bike bays.")
        if slot.slot_type == "EV" and not facility.allow_standard_car_in_ev:
            raise HTTPException(status_code=400, detail="Facility policy prohibits standard ICE cars from taking EV-exclusive bays.")
    if vehicle.category == "EV" and slot.slot_type == "BIKE":
        raise HTTPException(status_code=400, detail="EV cars cannot book Bike bays.")

    hourly_rate = (
        facility.rate_bike_hr if vehicle.category == "BIKE"
        else facility.rate_ev_hr if vehicle.category == "EV"
        else facility.rate_car_hr
    )
    ev_addon = facility.ev_charging_fee if (vehicle.category == "EV" and slot.has_ev_charger and slot.ev_charger_working) else 0.0
    raw_total = (hourly_rate * req.duration_hours) + ev_addon
    total = min(raw_total, facility.daily_cap)

    now = datetime.utcnow()
    booking = Booking(
        id=f"bk-{uuid.uuid4().hex[:8]}",
        booking_ref=f"PK-{uuid.uuid4().hex[:6].upper()}",
        customer_id=req.customer_id,
        facility_id=facility.id,
        slot_id=slot.id,
        vehicle_id=vehicle.id,
        snapshot_slot_code=slot.code,
        snapshot_plate=vehicle.plate_number,
        snapshot_vehicle_type=vehicle.category,
        snapshot_hourly_rate=hourly_rate,
        booking_type=req.booking_type,
        start_time=now,
        end_time=now + timedelta(hours=req.duration_hours),
        duration_hours=req.duration_hours,
        total_amount=total,
        payment_mode=req.payment_mode,
        payment_status="PENDING",
        status="HOLD",
        hold_expires_at=now + timedelta(minutes=5)
    )
    slot.status = "RESERVED"
    slot.last_updated = now
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

@app.post("/api/bookings/confirm")
def confirm_booking(req: ConfirmBookingRequest, db: Session = Depends(get_db)):
    cleanup_expired_holds(db)
    booking = db.query(Booking).filter(Booking.id == req.booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    existing_payment = db.query(Payment).filter(
        Payment.idempotency_key == req.idempotency_key,
        Payment.booking_id == booking.id
    ).first()
    if existing_payment:
        return {"booking": booking, "payment": existing_payment, "idempotent_replay": True}

    if booking.status == "EXPIRED":
        raise HTTPException(status_code=400, detail="Temporary slot hold expired. Please select a slot again.")

    if booking.payment_mode == "PREPAID" and os.getenv("PAYMENT_MODE", "demo").lower() != "upi":
        payment = Payment(
            id=f"pay-{uuid.uuid4().hex[:8]}",
            booking_id=booking.id,
            idempotency_key=req.idempotency_key,
            amount=booking.total_amount,
            method=req.payment_method,
            status="SUCCESS"
        )
        booking.payment_status = "PAID"
        db.add(payment)

    booking.status = "CONFIRMED"
    booking.hold_expires_at = None
    db.commit()
    return {"booking": booking}


def create_qr_data_uri(payload: str) -> str:
    import qrcode
    image = qrcode.make(payload)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")

@app.get("/api/bookings/{booking_id}/qrs")
def get_booking_qrs(booking_id: str, customer_id: str, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.customer_id != customer_id:
        raise HTTPException(status_code=403, detail="This booking does not belong to the requested customer.")
    if booking.status not in ["CONFIRMED", "ACTIVE_SESSION"]:
        raise HTTPException(status_code=400, detail="A parking pass is available only for a confirmed booking.")

    parking_pass = db.query(ParkingPass).filter(ParkingPass.booking_id == booking.id).first()
    if parking_pass and not parking_pass.active:
        raise HTTPException(status_code=400, detail="This parking pass has already been used or deactivated.")

    # Store only a SHA-256 digest. The one-time raw bearer token is returned to the customer.
    pass_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(pass_token.encode("utf-8")).hexdigest()
    if not parking_pass:
        parking_pass = ParkingPass(
            id=f"pass-{uuid.uuid4().hex[:10]}",
            booking_id=booking.id,
            token_hash=token_hash,
            active=True
        )
        db.add(parking_pass)
    else:
        parking_pass.token_hash = token_hash
    db.commit()

    parking_payload = f"PARKEASE|PASS|{booking.booking_ref}|{pass_token}"
    result = {
        "booking_id": booking.id,
        "booking_ref": booking.booking_ref,
        "parking_qr_data": create_qr_data_uri(parking_payload),
        "pass_token": pass_token,
        "payment_qr_data": None,
        "upi_uri": None,
        "payment_status": booking.payment_status,
        "amount": booking.total_amount,
        "payment_note": "This booking is already marked PAID. No payment is due." if booking.payment_status == "PAID" else "Payment is not verified by scanning a QR code."
    }

    upi_id = os.getenv("UPI_ID", "").strip()
    if booking.payment_status != "PAID" and upi_id:
        from urllib.parse import quote
        payee_name = quote("ParkEase")
        transaction_note = quote(f"Parking {booking.booking_ref}")
        upi_uri = (
            f"upi://pay?pa={quote(upi_id)}&pn={payee_name}"
            f"&am={booking.total_amount:.2f}&cu=INR&tn={transaction_note}"
        )
        result["upi_uri"] = upi_uri
        result["payment_qr_data"] = create_qr_data_uri(upi_uri)
    elif booking.payment_status != "PAID":
        result["payment_note"] = "Set the UPI_ID environment variable on the backend to enable the payment QR. Payment verification remains manual until a gateway integration is configured."

    return result


@app.post("/api/payments/manual-verify")
def manual_verify_payment(req: ManualPaymentVerifyRequest, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.booking_ref == req.booking_ref.strip()).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.payment_status == "PAID":
        raise HTTPException(status_code=409, detail="This booking is already marked as paid.")

    transaction_reference = req.transaction_reference.strip().upper()
    if len(transaction_reference) < 6 or len(transaction_reference) > 80:
        raise HTTPException(status_code=400, detail="Enter a valid UPI transaction reference (6–80 characters).")

    reference_hash = hashlib.sha256(transaction_reference.encode("utf-8")).hexdigest()
    idempotency_key = f"upi-utr-{reference_hash}"
    duplicate = db.query(Payment).filter(Payment.idempotency_key == idempotency_key).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="This UPI transaction reference has already been used.")

    payment = Payment(
        id=f"pay-{uuid.uuid4().hex[:8]}",
        booking_id=booking.id,
        idempotency_key=idempotency_key,
        amount=booking.total_amount,
        method="UPI_MANUAL",
        status="SUCCESS"
    )
    booking.payment_status = "PAID"
    db.add(payment)
    db.add(AuditLog(
        id=f"aud-{uuid.uuid4().hex[:8]}",
        facility_id=booking.facility_id,
        actor_role="OPERATOR_MANUAL_PAYMENT_VERIFY",
        action="UPI_PAYMENT_MANUALLY_VERIFIED",
        details=f"Booking {booking.booking_ref} verified against UPI reference {transaction_reference}. {req.operator_note or ''}".strip()
    ))
    db.commit()
    return {"booking": booking, "payment": payment, "message": "Payment marked paid after manual operator verification."}

@app.post("/api/sessions/entry")
def smart_gate_entry(req: GateEntryRequest, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.booking_ref == req.booking_ref).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Invalid QR / Booking Reference.")
    supplied_hash = hashlib.sha256((req.pass_token or "").encode("utf-8")).hexdigest()
    supplied_pass = db.query(ParkingPass).filter(
        ParkingPass.booking_id == booking.id,
        ParkingPass.token_hash == supplied_hash,
        ParkingPass.active == True
    ).first()
    if not supplied_pass or not req.pass_token:
        raise HTTPException(status_code=403, detail="A valid, active ParkEase parking-pass QR is required.")
    if booking.payment_mode == "PREPAID" and booking.payment_status != "PAID":
        raise HTTPException(status_code=402, detail="Payment must be verified before entry.")
    if booking.status == "ACTIVE_SESSION":
        raise HTTPException(status_code=400, detail="Duplicate Entry Rejected: An active session already exists for this pass.")
    if booking.status != "CONFIRMED":
        raise HTTPException(status_code=400, detail=f"Booking cannot enter in state: {booking.status}")

    clean_expected = booking.snapshot_plate.replace(" ", "").upper()
    clean_presented = req.presented_plate.replace(" ", "").upper()

    if clean_expected != clean_presented and not req.operator_override:
        raise HTTPException(
            status_code=403,
            detail=f"PLATE_MISMATCH: Expected {clean_expected}, OCR/Gate read {clean_presented}. Manual Operator Verification Required."
        )

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).first()
    slot.status = "OCCUPIED"
    slot.data_source = "OPERATOR_UPDATED" if req.operator_override else "SIMULATED_DEMO"
    slot.last_updated = datetime.utcnow()
    booking.status = "ACTIVE_SESSION"

    session = ParkingSession(
        id=f"sess-{uuid.uuid4().hex[:8]}",
        booking_id=booking.id,
        facility_id=booking.facility_id,
        slot_id=booking.slot_id,
        presented_plate=clean_presented,
        plate_verified=(clean_expected == clean_presented),
        operator_override_note=req.override_note
    )
    db.add(session)
    db.add(AuditLog(
        id=f"aud-{uuid.uuid4().hex[:8]}",
        facility_id=booking.facility_id,
        actor_role="OPERATOR" if req.operator_override else "SMART_GATE_SIM",
        action="GATE_ENTRY_APPROVED",
        details=f"Ref {booking.booking_ref} entered slot {slot.code} with plate {clean_presented}"
    ))
    db.commit()
    return {"session": session, "booking": booking, "slot": slot}

@app.post("/api/sessions/exit")
def smart_gate_exit(req: GateExitRequest, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.booking_ref == req.booking_ref).first()
    if not booking or booking.status != "ACTIVE_SESSION":
        raise HTTPException(status_code=400, detail="No active parking session found for this Booking Reference.")

    session = db.query(ParkingSession).filter(
        ParkingSession.booking_id == booking.id,
        ParkingSession.status == "ACTIVE"
    ).first()
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == booking.slot_id).first()

    if booking.payment_mode == "PREPAID" and booking.payment_status != "PAID":
        raise HTTPException(status_code=402, detail="Prepaid booking must be verified as paid before exit.")

    if booking.payment_status != "PAID":
        payment = Payment(
            id=f"pay-{uuid.uuid4().hex[:8]}",
            booking_id=booking.id,
            idempotency_key=f"exit-{booking.id}",
            amount=booking.total_amount,
            method=req.payment_method,
            status="SUCCESS"
        )
        db.add(payment)
        booking.payment_status = "PAID"

    session.exit_time = datetime.utcnow()
    session.final_charge = booking.total_amount
    session.status = "CLOSED"
    booking.status = "COMPLETED"
    parking_pass = db.query(ParkingPass).filter(ParkingPass.booking_id == booking.id).first()
    if parking_pass:
        parking_pass.active = False

    slot.status = "AVAILABLE"
    slot.last_updated = datetime.utcnow()

    db.add(AuditLog(
        id=f"aud-{uuid.uuid4().hex[:8]}",
        facility_id=booking.facility_id,
        actor_role="SMART_GATE_SIM",
        action="GATE_EXIT_COMPLETED",
        details=f"Ref {booking.booking_ref} exited. Slot {slot.code} released to AVAILABLE."
    ))
    db.commit()
    return {"session": session, "booking": booking, "slot": slot}

@app.patch("/api/slots/{slot_id}")
def operator_update_slot(slot_id: str, req: SlotUpdateRequest, db: Session = Depends(get_db)):
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found.")

    active_sess = db.query(ParkingSession).filter(
        ParkingSession.slot_id == slot.id,
        ParkingSession.status == "ACTIVE"
    ).first()
    if active_sess and req.status and req.status != "OCCUPIED":
        raise HTTPException(
            status_code=400,
            detail="Cannot release or alter status of a slot while an active customer session is in progress."
        )

    for field, value in req.dict(exclude_unset=True).items():
        setattr(slot, field, value)
    slot.data_source = "OPERATOR_UPDATED"
    slot.last_updated = datetime.utcnow()
    db.commit()
    return slot

@app.post("/api/ai/parking-video/process-demo")
def process_walkthrough_video(facility_id: str, filename: str = "chandigarh_lot_walkthrough.mp4", db: Session = Depends(get_db)):
    candidates = [
        {"code": "C-01", "zone": "Zone D (AI Candidate)", "slot_type": "EV", "has_ev_charger": True, "is_accessible": True, "x": 130, "y": 55, "width": 65, "height": 110, "ai_confidence": 0.96, "frame_ref": "Frame #014 (00:02.4)"},
        {"code": "C-02", "zone": "Zone D (AI Candidate)", "slot_type": "EV", "has_ev_charger": True, "is_accessible": False, "x": 210, "y": 55, "width": 65, "height": 110, "ai_confidence": 0.92, "frame_ref": "Frame #028 (00:04.8)"},
        {"code": "C-03", "zone": "Zone D (AI Candidate)", "slot_type": "CAR", "has_ev_charger": False, "is_accessible": False, "x": 290, "y": 55, "width": 65, "height": 110, "ai_confidence": 0.64, "frame_ref": "Frame #042 (00:07.1) - Motion Blur / Pillar Occlusion"},
        {"code": "C-04", "zone": "Zone D (AI Candidate)", "slot_type": "CAR", "has_ev_charger": False, "is_accessible": False, "x": 440, "y": 55, "width": 65, "height": 110, "ai_confidence": 0.94, "frame_ref": "Frame #060 (00:10.0)"},
        {"code": "C-05", "zone": "Zone E (Bike Row)", "slot_type": "BIKE", "has_ev_charger": False, "is_accessible": False, "x": 130, "y": 300, "width": 48, "height": 95, "ai_confidence": 0.89, "frame_ref": "Frame #085 (00:14.2)"},
        {"code": "C-06", "zone": "Zone E (Bike Row)", "slot_type": "BIKE", "has_ev_charger": False, "is_accessible": False, "x": 190, "y": 300, "width": 48, "height": 95, "ai_confidence": 0.61, "frame_ref": "Frame #092 (00:15.5) - Low Paint Contrast"},
    ]
    job = VideoDigitisationJob(
        id=f"job-{uuid.uuid4().hex[:8]}",
        facility_id=facility_id,
        filename=filename,
        status="REVIEW_REQUIRED",
        frames_extracted=18,
        candidate_json=json.dumps(candidates)
    )
    db.add(job)
    db.commit()
    return {"job_id": job.id, "status": job.status, "frames_extracted": job.frames_extracted, "candidates": candidates}
