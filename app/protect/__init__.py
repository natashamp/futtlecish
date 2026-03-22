from flask import Blueprint

bp = Blueprint('protect', __name__, template_folder='templates')

from app.protect import routes
