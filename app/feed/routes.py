import os
import uuid
from flask import render_template, request, jsonify, redirect, url_for, current_app, abort
from flask_login import login_required, current_user
from app.feed import bp
from app.models import Portfolio, BusinessCard, BusinessCardObject, Character, Artwork, User
from app import db

CARDS_PER_PAGE = 20
MAX_TEXTS = 4
MAX_LINKS = 5


@bp.route('/')
def index():
    portfolios = Portfolio.query.filter_by(is_public=True)\
        .order_by(Portfolio.updated_at.desc())\
        .limit(CARDS_PER_PAGE).all()
    return render_template('feed.html', portfolios=portfolios)


@bp.route('/feed/more')
def load_more():
    offset = request.args.get('offset', 0, type=int)
    portfolios = Portfolio.query.filter_by(is_public=True)\
        .order_by(Portfolio.updated_at.desc())\
        .offset(offset).limit(CARDS_PER_PAGE).all()

    cards = []
    for p in portfolios:
        card = BusinessCard.query.filter_by(user_id=p.user_id).first()
        card_objects = []
        character_data = None
        if card:
            card_objects = [{'type': o.type, 'content': o.content,
                             'x': o.x, 'y': o.y, 'width': o.width,
                             'height': o.height, 'z_index': o.z_index}
                            for o in card.objects]
            if card.show_character:
                char = Character.query.filter_by(user_id=p.user_id).first()
                if char and char.frame_a:
                    character_data = char.frame_a

        cards.append({
            'username': p.user.username,
            'display_name': p.user.display_name,
            'image_url': card.image_url if card else None,
            'show_character': card.show_character if card else False,
            'character': character_data,
            'objects': card_objects
        })

    return jsonify(cards)


@bp.route('/verify', methods=['POST'])
def verify():
    """Public verify — anyone can check image ownership."""
    from app.protect.routes import _do_verify
    return _do_verify(request)


# --- business card editor ---

@bp.route('/portfolio/<username>/card')
@login_required
def card_editor(username):
    if current_user.username != username:
        return redirect(url_for('feed.index'))

    card = BusinessCard.query.filter_by(user_id=current_user.id).first()
    character = Character.query.filter_by(user_id=current_user.id).first()
    has_character = character is not None and character.frame_a is not None

    text_count = 0
    link_count = 0
    if card:
        for o in card.objects:
            if o.type == 'text':
                text_count += 1
            elif o.type == 'link':
                link_count += 1

    return render_template('card_editor.html',
                           username=username, card=card,
                           has_character=has_character,
                           text_count=text_count, link_count=link_count,
                           max_texts=MAX_TEXTS, max_links=MAX_LINKS)


@bp.route('/portfolio/<username>/card/upload', methods=['POST'])
@login_required
def card_upload_image(username):
    if current_user.username != username:
        abort(403)

    card = BusinessCard.query.filter_by(user_id=current_user.id).first()
    if not card:
        abort(404)

    if 'image' not in request.files:
        return jsonify({'error': 'no file'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'no file selected'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.png', '.jpg', '.jpeg', '.gif', '.webp'):
        return jsonify({'error': 'unsupported file type'}), 400

    upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], current_user.id, 'card')
    os.makedirs(upload_dir, exist_ok=True)

    filename = str(uuid.uuid4()) + ext
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    card.image_url = f'/uploads/{current_user.id}/card/{filename}'
    db.session.commit()

    return jsonify({'url': card.image_url})


@bp.route('/portfolio/<username>/card/remove-image', methods=['POST'])
@login_required
def card_remove_image(username):
    if current_user.username != username:
        abort(403)

    card = BusinessCard.query.filter_by(user_id=current_user.id).first()
    if card:
        card.image_url = None
        db.session.commit()

    return jsonify({'ok': True})


@bp.route('/portfolio/<username>/card/toggle-character', methods=['POST'])
@login_required
def card_toggle_character(username):
    if current_user.username != username:
        abort(403)

    card = BusinessCard.query.filter_by(user_id=current_user.id).first()
    if card:
        card.show_character = not card.show_character
        db.session.commit()

    return jsonify({'show_character': card.show_character})


@bp.route('/portfolio/<username>/card/objects', methods=['POST'])
@login_required
def card_add_object(username):
    if current_user.username != username:
        abort(403)

    card = BusinessCard.query.filter_by(user_id=current_user.id).first()
    if not card:
        abort(404)

    data = request.get_json()
    obj_type = data.get('type', 'text')

    # enforce limits
    current_count = BusinessCardObject.query.filter_by(card_id=card.id, type=obj_type).count()
    if obj_type == 'text' and current_count >= MAX_TEXTS:
        return jsonify({'error': f'max {MAX_TEXTS} text blocks'}), 400
    if obj_type == 'link' and current_count >= MAX_LINKS:
        return jsonify({'error': f'max {MAX_LINKS} links'}), 400

    obj = BusinessCardObject(
        card_id=card.id,
        type=obj_type,
        content=data.get('content', ''),
        x=data.get('x', 10),
        y=data.get('y', 10),
        width=data.get('width', 120),
        height=data.get('height', 20),
        z_index=data.get('z_index', 0)
    )
    db.session.add(obj)
    db.session.commit()

    return jsonify({'id': obj.id, 'type': obj.type, 'content': obj.content,
                    'x': obj.x, 'y': obj.y, 'width': obj.width,
                    'height': obj.height, 'z_index': obj.z_index})


@bp.route('/portfolio/<username>/card/objects/<obj_id>', methods=['PUT'])
@login_required
def card_update_object(username, obj_id):
    if current_user.username != username:
        abort(403)

    card = BusinessCard.query.filter_by(user_id=current_user.id).first()
    obj = BusinessCardObject.query.filter_by(id=obj_id, card_id=card.id).first_or_404()

    data = request.get_json()
    for key in ('x', 'y', 'width', 'height', 'z_index', 'content'):
        if key in data:
            setattr(obj, key, data[key])

    db.session.commit()
    return jsonify({'id': obj.id, 'type': obj.type, 'content': obj.content,
                    'x': obj.x, 'y': obj.y, 'width': obj.width,
                    'height': obj.height, 'z_index': obj.z_index})


@bp.route('/portfolio/<username>/card/objects/<obj_id>', methods=['DELETE'])
@login_required
def card_delete_object(username, obj_id):
    if current_user.username != username:
        abort(403)

    card = BusinessCard.query.filter_by(user_id=current_user.id).first()
    obj = BusinessCardObject.query.filter_by(id=obj_id, card_id=card.id).first_or_404()

    db.session.delete(obj)
    db.session.commit()
    return jsonify({'ok': True})


@bp.route('/portfolio/<username>/card/save', methods=['POST'])
@login_required
def card_save(username):
    """Batch save all card object positions."""
    if current_user.username != username:
        abort(403)

    card = BusinessCard.query.filter_by(user_id=current_user.id).first()
    if not card:
        abort(404)

    data = request.get_json()
    for item in data.get('objects', []):
        obj = BusinessCardObject.query.filter_by(id=item['id'], card_id=card.id).first()
        if obj:
            for key in ('x', 'y', 'width', 'height', 'z_index'):
                if key in item:
                    setattr(obj, key, item[key])

    db.session.commit()
    return jsonify({'ok': True})
