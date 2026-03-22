from flask import render_template, redirect, url_for, request, jsonify
from flask_login import login_required, current_user
from app.character import bp
from app.models import Character
from app import db


@bp.route('/portfolio/<username>/character')
@login_required
def index(username):
    if current_user.username != username:
        return redirect(url_for('feed.index'))

    character = Character.query.filter_by(user_id=current_user.id).first()
    frame_a = character.frame_a if character and character.frame_a else None
    frame_b = character.frame_b if character and character.frame_b else None

    return render_template('character.html', frame_a=frame_a, frame_b=frame_b, username=username)


@bp.route('/portfolio/<username>/character/save', methods=['POST'])
@login_required
def save(username):
    if current_user.username != username:
        return jsonify({'error': 'forbidden'}), 403

    data = request.get_json()
    character = Character.query.filter_by(user_id=current_user.id).first()

    if not character:
        character = Character(user_id=current_user.id)
        db.session.add(character)

    character.frame_a = data.get('frame_a')
    character.frame_b = data.get('frame_b')
    db.session.commit()

    return jsonify({'ok': True})
