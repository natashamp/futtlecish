import os
import uuid
from flask import render_template, abort, request, redirect, url_for, jsonify, current_app
from flask_login import current_user, login_required
from app.portfolio import bp
from app.models import User, Portfolio, PortfolioObject
from app import db


@bp.route('/portfolio/<username>')
def view(username):
    user = User.query.filter_by(username=username).first_or_404()
    portfolio = Portfolio.query.filter_by(user_id=user.id).first_or_404()

    is_owner = current_user.is_authenticated and current_user.id == user.id
    if not portfolio.is_public and not is_owner:
        abort(404)

    return render_template('portfolio.html', artist=user, portfolio=portfolio, is_owner=is_owner)


@bp.route('/portfolio/<username>/settings', methods=['POST'])
@login_required
def settings(username):
    if current_user.username != username:
        abort(403)

    portfolio = Portfolio.query.filter_by(user_id=current_user.id).first_or_404()

    action = request.form.get('action')
    if action == 'toggle_public':
        portfolio.is_public = not portfolio.is_public
    elif action == 'toggle_dark':
        current_user.dark_mode = not current_user.dark_mode

    db.session.commit()
    return redirect(request.referrer or url_for('portfolio.view', username=username))


@bp.route('/portfolio/<username>/objects', methods=['GET'])
@login_required
def get_objects(username):
    if current_user.username != username:
        abort(403)

    portfolio = Portfolio.query.filter_by(user_id=current_user.id).first_or_404()
    objects = [{'id': o.id, 'type': o.type, 'content': o.content,
                'x': o.x, 'y': o.y, 'width': o.width, 'height': o.height,
                'z_index': o.z_index} for o in portfolio.objects]
    return jsonify(objects)


@bp.route('/portfolio/<username>/objects', methods=['POST'])
@login_required
def add_object(username):
    if current_user.username != username:
        abort(403)

    portfolio = Portfolio.query.filter_by(user_id=current_user.id).first_or_404()
    data = request.get_json()

    obj = PortfolioObject(
        portfolio_id=portfolio.id,
        type=data.get('type', 'text'),
        content=data.get('content', ''),
        x=data.get('x', 50),
        y=data.get('y', 50),
        width=data.get('width', 150),
        height=data.get('height', 40),
        z_index=data.get('z_index', 0)
    )
    db.session.add(obj)
    portfolio.updated_at = db.func.now()
    db.session.commit()

    return jsonify({'id': obj.id, 'type': obj.type, 'content': obj.content,
                    'x': obj.x, 'y': obj.y, 'width': obj.width,
                    'height': obj.height, 'z_index': obj.z_index})


@bp.route('/portfolio/<username>/objects/<obj_id>', methods=['PUT'])
@login_required
def update_object(username, obj_id):
    if current_user.username != username:
        abort(403)

    portfolio = Portfolio.query.filter_by(user_id=current_user.id).first_or_404()
    obj = PortfolioObject.query.filter_by(id=obj_id, portfolio_id=portfolio.id).first_or_404()

    data = request.get_json()
    if 'x' in data:
        obj.x = data['x']
    if 'y' in data:
        obj.y = data['y']
    if 'width' in data:
        obj.width = data['width']
    if 'height' in data:
        obj.height = data['height']
    if 'z_index' in data:
        obj.z_index = data['z_index']
    if 'content' in data:
        obj.content = data['content']

    portfolio.updated_at = db.func.now()
    db.session.commit()

    return jsonify({'id': obj.id, 'type': obj.type, 'content': obj.content,
                    'x': obj.x, 'y': obj.y, 'width': obj.width,
                    'height': obj.height, 'z_index': obj.z_index})


@bp.route('/portfolio/<username>/objects/<obj_id>', methods=['DELETE'])
@login_required
def delete_object(username, obj_id):
    if current_user.username != username:
        abort(403)

    portfolio = Portfolio.query.filter_by(user_id=current_user.id).first_or_404()
    obj = PortfolioObject.query.filter_by(id=obj_id, portfolio_id=portfolio.id).first_or_404()

    db.session.delete(obj)
    portfolio.updated_at = db.func.now()
    db.session.commit()

    return jsonify({'ok': True})


@bp.route('/portfolio/<username>/upload', methods=['POST'])
@login_required
def upload_image(username):
    if current_user.username != username:
        abort(403)

    if 'image' not in request.files:
        return jsonify({'error': 'no file'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'no file selected'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.png', '.jpg', '.jpeg', '.gif', '.webp'):
        return jsonify({'error': 'unsupported file type'}), 400

    upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], current_user.id)
    os.makedirs(upload_dir, exist_ok=True)

    filename = str(uuid.uuid4()) + ext
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    url = f'/uploads/{current_user.id}/{filename}'
    return jsonify({'url': url})


@bp.route('/portfolio/<username>/save', methods=['POST'])
@login_required
def save_layout(username):
    """Batch save all object positions."""
    if current_user.username != username:
        abort(403)

    portfolio = Portfolio.query.filter_by(user_id=current_user.id).first_or_404()
    data = request.get_json()

    for item in data.get('objects', []):
        obj = PortfolioObject.query.filter_by(id=item['id'], portfolio_id=portfolio.id).first()
        if obj:
            obj.x = item.get('x', obj.x)
            obj.y = item.get('y', obj.y)
            obj.width = item.get('width', obj.width)
            obj.height = item.get('height', obj.height)
            obj.z_index = item.get('z_index', obj.z_index)

    portfolio.updated_at = db.func.now()
    db.session.commit()
    return jsonify({'ok': True})
