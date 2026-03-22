from flask import Blueprint

bp = Blueprint('character', __name__, template_folder='templates')

from app.character import routes
