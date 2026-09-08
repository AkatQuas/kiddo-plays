from contextlib import contextmanager

from sqlalchemy import (
    BIGINT,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
    or_,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

from common.config import get_server_config
from common.exceptions import DuplicateVoiceError
from common.log import logger

Base = declarative_base()


def _is_duplicate_voice_name(error: IntegrityError) -> bool:
    orig = str(getattr(error, "orig", error)).lower()
    return "uq_voice_owner_name" in orig or ("voices.owner_id" in orig and "voice_name" in orig)


class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, comment="Unique user ID")
    voices = relationship(
        "Voice",
        back_populates="owner",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<User(id={self.id})>"


class Voice(Base):
    __tablename__ = "voices"

    id = Column(
        BIGINT().with_variant(Integer, "sqlite"),
        autoincrement=True,
        primary_key=True,
        comment="Auto-increment voice ID",
    )
    is_public = Column(
        Boolean, nullable=False, default=False, comment="True=public voice, False=private voice"
    )
    owner_id = Column(
        String(50),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Owner user ID",
    )
    voice_name = Column(String(100), nullable=False, comment="Voice name")
    voice_content = Column(Text, nullable=False, comment="Reference text content")
    voice_path = Column(Text, nullable=False, comment="Audio file storage path")
    created_at = Column(DateTime, server_default=func.now(), comment="Creation time")
    updated_at = Column(
        DateTime, server_default=func.now(), onupdate=func.now(), comment="Update time"
    )

    owner = relationship("User", back_populates="voices")

    __table_args__ = (UniqueConstraint("owner_id", "voice_name", name="uq_voice_owner_name"),)

    def __repr__(self):
        return (
            f"<Voice(id={self.id}, name={self.voice_name}, "
            f"owner={self.owner_id}, is_public={self.is_public})>"
        )


class VoiceMetaModel:
    def __init__(
        self,
        db_url,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=3600,
        pool_pre_ping=True,
    ):
        engine_kwargs: dict = {
            "pool_pre_ping": pool_pre_ping,
        }
        if not str(db_url).startswith("sqlite"):
            engine_kwargs.update(
                pool_size=pool_size,
                max_overflow=max_overflow,
                pool_timeout=pool_timeout,
                pool_recycle=pool_recycle,
            )
        self.engine = create_engine(db_url, **engine_kwargs)
        self.session_factory = sessionmaker(bind=self.engine)

    @contextmanager
    def session_scope(self):
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def create_table(self):
        Base.metadata.create_all(self.engine)

    def _ensure_user_exists(self, session, user_id):
        user = session.query(User).filter_by(id=user_id).first()
        if user is None:
            user = User(id=user_id)
            session.add(user)
            session.flush()
        return user

    def _expunge(self, session, voice: Voice | None) -> Voice | None:
        if voice is not None:
            session.expunge(voice)
        return voice

    def create_voice_meta(self, user_id, voice_name, voice_path, voice_content, is_public=False):
        with self.session_scope() as session:
            try:
                self._ensure_user_exists(session, user_id)
                voice = Voice(
                    owner_id=user_id,
                    voice_name=voice_name,
                    voice_path=voice_path,
                    voice_content=voice_content,
                    is_public=is_public,
                )
                session.add(voice)
                session.flush()
                session.refresh(voice)
                return self._expunge(session, voice)
            except IntegrityError as e:
                if _is_duplicate_voice_name(e):
                    logger.error(f"duplicate voice (voice_name={voice_name}): {e}")
                    raise DuplicateVoiceError(voice_name) from e
                logger.error(f"failed to create voice (voice_name={voice_name}): {e}")
                raise
            except Exception as e:
                logger.error(f"failed to create voice (voice_name={voice_name}): {e}")
                raise

    def get_voice_by_id(self, voice_id, user_id, *, is_public: bool | None = None):
        with self.session_scope() as session:
            try:
                query = session.query(Voice).filter(Voice.id == voice_id)
                if is_public is True:
                    query = query.filter(Voice.is_public.is_(True))
                elif is_public is False:
                    query = query.filter(Voice.owner_id == user_id, Voice.is_public.is_(False))
                else:
                    query = query.filter(or_(Voice.is_public.is_(True), Voice.owner_id == user_id))
                return self._expunge(session, query.first())
            except Exception as e:
                logger.error(f"failed to get voice by id={voice_id}: {e}")
                raise

    def _list_voices(self, query, *, offset: int, limit: int):
        total = query.count()
        voices = query.order_by(Voice.id.desc()).offset(offset).limit(limit).all()
        session = query.session
        for voice in voices:
            session.expunge(voice)
        return voices, total

    def list_voices_by_user(self, user_id, *, offset: int = 0, limit: int = 50):
        with self.session_scope() as session:
            try:
                query = session.query(Voice).filter_by(owner_id=user_id, is_public=False)
                return self._list_voices(query, offset=offset, limit=limit)
            except Exception as e:
                logger.error(f"failed to list voices (user_id={user_id}): {e}")
                raise

    def list_public_voices(self, *, offset: int = 0, limit: int = 50):
        with self.session_scope() as session:
            try:
                query = session.query(Voice).filter_by(is_public=True)
                return self._list_voices(query, offset=offset, limit=limit)
            except Exception as e:
                logger.error(f"failed to list public voices: {e}")
                raise

    def delete_private_voice(self, voice_id, user_id):
        with self.session_scope() as session:
            try:
                voice = (
                    session.query(Voice)
                    .filter(
                        Voice.id == voice_id,
                        Voice.owner_id == user_id,
                        Voice.is_public.is_(False),
                    )
                    .first()
                )
                if voice is None:
                    raise ValueError(f"Private voice not found or no permission: id={voice_id}")
                session.delete(voice)
                logger.info(f"Private voice deleted (voice_id={voice_id})")
            except Exception as e:
                logger.error(f"failed to delete private voice by id={voice_id}: {e}")
                raise

    def delete_public_voice(self, voice_id):
        with self.session_scope() as session:
            try:
                voice = (
                    session.query(Voice)
                    .filter(
                        Voice.id == voice_id,
                        Voice.is_public.is_(True),
                    )
                    .first()
                )
                if voice is None:
                    raise ValueError(f"Public voice not found: id={voice_id}")
                session.delete(voice)
                logger.info(f"Public voice deleted (voice_id={voice_id})")
            except Exception as e:
                logger.error(f"failed to delete public voice by id={voice_id}: {e}")
                raise


def init_db():
    db_config = get_server_config().database_config
    model = VoiceMetaModel(
        db_url=db_config.url,
        pool_size=db_config.pool_size,
        max_overflow=db_config.max_overflow,
        pool_timeout=db_config.pool_timeout,
        pool_recycle=db_config.pool_recycle,
        pool_pre_ping=db_config.pool_pre_ping,
    )
    model.create_table()
    return model


voice_db = None


def get_db() -> VoiceMetaModel:
    global voice_db
    if voice_db is None:
        voice_db = init_db()
    return voice_db


def reset_db() -> None:
    global voice_db
    voice_db = None
