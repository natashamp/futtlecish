import random
from flask import render_template, request
from flask_login import login_required, current_user
from flask_socketio import emit, join_room, leave_room
from app.wanderland import bp
from app import socketio
from app.models import Character

# In-memory state for connected characters
# { user_id: { username, display_name, x, y, target_x, target_y, frame_a, frame_b, idle } }
connected = {}
MAX_USERS = 100
WORLD_WIDTH = 2000
WORLD_HEIGHT = 1200


@bp.route('/wanderland')
@login_required
def index():
    character = Character.query.filter_by(user_id=current_user.id).first()
    has_character = character is not None and character.frame_a is not None
    return render_template('wanderland.html',
                           username=current_user.username,
                           user_id=current_user.id,
                           display_name=current_user.display_name,
                           has_character=has_character)


@socketio.on('join_wanderland')
def handle_join(data):
    user_id = data.get('user_id')
    username = data.get('username')
    display_name = data.get('display_name')

    if not user_id or not username:
        return

    if len(connected) >= MAX_USERS and user_id not in connected:
        emit('wanderland_full', {'message': 'wanderland is full (max 100 artists)'})
        return

    # Load character frames
    character = Character.query.filter_by(user_id=user_id).first()
    frame_a = character.frame_a if character else None
    frame_b = character.frame_b if character else None

    # Random starting position
    x = random.randint(100, WORLD_WIDTH - 100)
    y = random.randint(100, WORLD_HEIGHT - 100)

    connected[user_id] = {
        'username': username,
        'display_name': display_name,
        'x': x,
        'y': y,
        'target_x': x,
        'target_y': y,
        'frame_a': frame_a,
        'frame_b': frame_b,
        'sid': request.sid
    }

    join_room('wanderland')

    # Send current state to the joining user
    emit('wanderland_state', {
        'you': user_id,
        'characters': {uid: _public_state(uid) for uid, c in connected.items()},
        'world_width': WORLD_WIDTH,
        'world_height': WORLD_HEIGHT
    })

    # Notify others
    emit('character_joined', {
        'user_id': user_id,
        **_public_state(user_id)
    }, room='wanderland', include_self=False)


@socketio.on('move_to')
def handle_move(data):
    user_id = data.get('user_id')
    if user_id not in connected:
        return

    target_x = max(0, min(WORLD_WIDTH, data.get('x', 0)))
    target_y = max(0, min(WORLD_HEIGHT, data.get('y', 0)))

    connected[user_id]['target_x'] = target_x
    connected[user_id]['target_y'] = target_y

    emit('character_move', {
        'user_id': user_id,
        'target_x': target_x,
        'target_y': target_y
    }, room='wanderland')


@socketio.on('say_hi')
def handle_hi(data):
    user_id = data.get('user_id')
    if user_id not in connected:
        return

    emit('character_hi', {
        'user_id': user_id,
        'display_name': connected[user_id]['display_name']
    }, room='wanderland')


@socketio.on('idle_update')
def handle_idle(data):
    """Client reports its own idle wandering target."""
    user_id = data.get('user_id')
    if user_id not in connected:
        return

    connected[user_id]['target_x'] = data.get('target_x', connected[user_id]['x'])
    connected[user_id]['target_y'] = data.get('target_y', connected[user_id]['y'])

    emit('character_move', {
        'user_id': user_id,
        'target_x': connected[user_id]['target_x'],
        'target_y': connected[user_id]['target_y']
    }, room='wanderland', include_self=False)


@socketio.on('position_update')
def handle_position(data):
    """Client reports its actual position (for sync)."""
    user_id = data.get('user_id')
    if user_id not in connected:
        return

    connected[user_id]['x'] = data.get('x', connected[user_id]['x'])
    connected[user_id]['y'] = data.get('y', connected[user_id]['y'])


@socketio.on('disconnect')
def handle_disconnect():
    # Find and remove the disconnected user
    to_remove = None
    for uid, c in connected.items():
        if c.get('sid') == request.sid:
            to_remove = uid
            break

    if to_remove:
        del connected[to_remove]
        emit('character_left', {'user_id': to_remove}, room='wanderland')
        leave_room('wanderland')


def _public_state(user_id):
    c = connected[user_id]
    return {
        'username': c['username'],
        'display_name': c['display_name'],
        'x': c['x'],
        'y': c['y'],
        'target_x': c['target_x'],
        'target_y': c['target_y'],
        'frame_a': c['frame_a'],
        'frame_b': c['frame_b']
    }
