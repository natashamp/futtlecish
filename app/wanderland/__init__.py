from flask import Blueprint

bp = Blueprint('wanderland', __name__, template_folder='templates')

from app.wanderland import events
