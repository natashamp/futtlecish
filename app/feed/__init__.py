from flask import Blueprint

bp = Blueprint('feed', __name__, template_folder='templates')

from app.feed import routes
