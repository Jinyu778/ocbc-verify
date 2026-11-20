from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """DateTime that always comes back timezone-aware (UTC), also on SQLite."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


MONEY = Numeric(14, 2)

TRANSFER_STATUSES = (
    "draft",
    "checking",
    "sent",
    "paused",
    "saved_for_later",
    "waiting_trusted_contact",
    "in_verification_call",
    "under_staff_review",
    "cancelled",
    "escalated",
    "approved_by_staff",
)
FINAL_STATUSES = {"sent", "cancelled", "approved_by_staff", "escalated"}
HELD_STATUSES = {
    "paused",
    "saved_for_later",
    "waiting_trusted_contact",
    "in_verification_call",
    "under_staff_review",
    "escalated",
}


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(20))  # customer | trusted_contact | staff
    display_name: Mapped[str] = mapped_column(String(120))
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(4), default="en")
    easy_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_masked: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # bcrypt hash of the family code word (customer accounts). Never returned, logged or shown.
    family_code_word_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)

    account: Mapped[Account | None] = relationship(back_populates="user", uselist=False)


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    balance: Mapped[Decimal] = mapped_column(MONEY)
    typical_transfer_mean: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"))
    typical_transfer_std: Mapped[Decimal] = mapped_column(MONEY, default=Decimal("0"))

    user: Mapped[User] = relationship(back_populates="account")


class Payee(Base):
    __tablename__ = "payees"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    account_ref: Mapped[str] = mapped_column(String(40))
    first_added_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class TrustedContact(Base):
    __tablename__ = "trusted_contacts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    contact_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    relationship_type: Mapped[str] = mapped_column("relationship", String(20))
    active_from: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    pending_removal_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    contact: Mapped[User] = relationship(foreign_keys=[contact_user_id])
    customer: Mapped[User] = relationship(foreign_keys=[customer_user_id])


class Transfer(Base):
    __tablename__ = "transfers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    payee_id: Mapped[int] = mapped_column(ForeignKey("payees.id"))
    amount: Mapped[Decimal] = mapped_column(MONEY)
    status: Mapped[str] = mapped_column(String(32), default="checking", index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_tier: Mapped[str] = mapped_column(String(8), default="none")
    signals_json: Mapped[dict] = mapped_column(JSON, default=dict)
    answers_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reasons_json: Mapped[list] = mapped_column(JSON, default=list)
    wait_until: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    pause_shown_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    trusted_requested_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    trusted_decision: Mapped[str | None] = mapped_column(String(8), nullable=True)  # ok | stop
    trusted_decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    false_positive: Mapped[bool] = mapped_column(Boolean, default=False)
    is_seed_history: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    payee: Mapped[Payee] = relationship()
    customer: Mapped[User] = relationship()


class EvidenceEvent(Base):
    """Append-only. Updates and deletes are refused by the ORM hooks below."""

    __tablename__ = "evidence_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transfer_id: Mapped[int | None] = mapped_column(ForeignKey("transfers.id"), index=True, nullable=True)
    actor: Mapped[str] = mapped_column(String(40))
    event_type: Mapped[str] = mapped_column(String(48))
    detail_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class EvidenceImmutableError(RuntimeError):
    pass


@event.listens_for(EvidenceEvent, "before_update")
def _block_evidence_update(mapper, connection, target):
    raise EvidenceImmutableError("evidence_events is append-only")


@event.listens_for(EvidenceEvent, "before_delete")
def _block_evidence_delete(mapper, connection, target):
    raise EvidenceImmutableError("evidence_events is append-only")


class CallSession(Base):
    __tablename__ = "call_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    staff_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    transfer_id: Mapped[int | None] = mapped_column(ForeignKey("transfers.id"), nullable=True)
    initiated_by: Mapped[str] = mapped_column(String(10), default="customer")  # customer | staff
    status: Mapped[str] = mapped_column(String(10), default="ringing")  # ringing | active | ended
    mode: Mapped[str] = mapped_column(String(10), default="voice")  # voice | text
    signed_token: Mapped[str] = mapped_column(String(128))
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    staff: Mapped[User | None] = relationship(foreign_keys=[staff_user_id])
    customer: Mapped[User] = relationship(foreign_keys=[customer_user_id])


class MessageCheck(Base):
    __tablename__ = "message_checks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    text_redacted: Mapped[str] = mapped_column(Text)
    flags_json: Mapped[list] = mapped_column(JSON, default=list)
    ml_probability: Mapped[float] = mapped_column()
    verdict: Mapped[str] = mapped_column(String(16))  # likely_scam | be_careful | no_signs | not_sure
    reported: Mapped[bool] = mapped_column(Boolean, default=False)
    review_status: Mapped[str] = mapped_column(String(12), default="none")  # none | pending | reviewed | escalated
    source_channel: Mapped[str | None] = mapped_column(String(16), nullable=True)  # sms | whatsapp | ... as the customer chose
    claimed_sender: Mapped[str | None] = mapped_column(String(120), nullable=True)
    scam_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # checker's guess; staff may correct it
    rule_pack_version: Mapped[str | None] = mapped_column(String(16), nullable=True)
    user_feedback: Mapped[str | None] = mapped_column(String(16), nullable=True)  # helpful | not_helpful
    training_candidate: Mapped[bool] = mapped_column(Boolean, default=False)  # exported for OFFLINE review only
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)

    user: Mapped[User] = relationship()


class StaffAction(Base):
    __tablename__ = "staff_actions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    staff_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    transfer_id: Mapped[int | None] = mapped_column(ForeignKey("transfers.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(32))
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    staff: Mapped[User] = relationship()
