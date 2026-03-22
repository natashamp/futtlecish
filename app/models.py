import uuid
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from app import db, login_manager


def gen_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    display_name = db.Column(db.String(120), nullable=False)
    dark_mode = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    portfolio = db.relationship('Portfolio', backref='user', uselist=False, cascade='all, delete-orphan')
    artworks = db.relationship('Artwork', backref='user', cascade='all, delete-orphan')
    character = db.relationship('Character', backref='user', uselist=False, cascade='all, delete-orphan')
    business_card = db.relationship('BusinessCard', backref='user', uselist=False, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Portfolio(db.Model):
    __tablename__ = 'portfolios'

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), unique=True, nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    objects = db.relationship('PortfolioObject', backref='portfolio', cascade='all, delete-orphan')


class PortfolioObject(db.Model):
    __tablename__ = 'portfolio_objects'

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    portfolio_id = db.Column(db.String(36), db.ForeignKey('portfolios.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # "image", "text", "link"
    content = db.Column(db.Text, nullable=False)
    x = db.Column(db.Float, default=0)
    y = db.Column(db.Float, default=0)
    width = db.Column(db.Float, default=100)
    height = db.Column(db.Float, default=100)
    z_index = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=utcnow)


class Artwork(db.Model):
    __tablename__ = 'artworks'

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    original_url = db.Column(db.String(500), nullable=False)
    protected_url = db.Column(db.String(500), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    watermark_hash = db.Column(db.String(64), nullable=True, index=True)  # SHA-256 hex
    encoded_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)


class Character(db.Model):
    __tablename__ = 'characters'

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), unique=True, nullable=False)
    frame_a = db.Column(db.JSON, nullable=True)  # 16x16 grid
    frame_b = db.Column(db.JSON, nullable=True)  # 16x16 grid
    created_at = db.Column(db.DateTime, default=utcnow)


class BusinessCard(db.Model):
    __tablename__ = 'business_cards'

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), unique=True, nullable=False)
    image_url = db.Column(db.String(500), nullable=True)
    show_character = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    objects = db.relationship('BusinessCardObject', backref='card', cascade='all, delete-orphan')


class BusinessCardObject(db.Model):
    __tablename__ = 'business_card_objects'

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    card_id = db.Column(db.String(36), db.ForeignKey('business_cards.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # "text", "link"
    content = db.Column(db.Text, nullable=False)
    x = db.Column(db.Float, default=0)
    y = db.Column(db.Float, default=0)
    width = db.Column(db.Float, default=100)
    height = db.Column(db.Float, default=40)
    z_index = db.Column(db.Integer, default=0)
