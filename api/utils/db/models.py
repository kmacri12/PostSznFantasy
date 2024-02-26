from werkzeug.security import generate_password_hash, check_password_hash
from api.app import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(64), unique=True, nullable=False)

    def __init__(self, username, password, email):
        self.username = username
        self.set_password(password)
        self.email = email

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return '<User {}>'.format(self.username)

class League(db.Model):
    __tablename__ = 'leagues'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    commissioner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    drafts = db.relationship('draft', backref='league', lazy=True)
    settings = db.relationship('settings', backref='league', lazy=True)


    def __init__(self, name, commissioner_id, settings_id, draft_id):
        self.name = name
        self.commissioner_id = commissioner_id
        self.settings_id = settings_id
        self.draft_id = draft_id

    def __repr__(self):
        return f'<League: {self.name}>'