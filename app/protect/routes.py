import os
import uuid
from datetime import datetime, timezone
from flask import render_template, redirect, url_for, request, jsonify, current_app, send_file, abort
from flask_login import login_required, current_user
from app.protect import bp
from app.models import Artwork, User
from app import db
from app.protect.watermark import encode_watermark, decode_watermark, compare_hashes, apply_visible_watermark


@bp.route('/portfolio/<username>/protect')
@login_required
def index(username):
    if current_user.username != username:
        return redirect(url_for('feed.index'))
    artworks = Artwork.query.filter_by(user_id=current_user.id)\
        .order_by(Artwork.created_at.desc()).all()
    return render_template('protect.html', artworks=artworks, username=username)


@bp.route('/portfolio/<username>/protect/encode', methods=['POST'])
@login_required
def encode(username):
    if current_user.username != username:
        abort(403)

    if 'image' not in request.files:
        return jsonify({'error': 'no file'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'no file selected'}), 400

    title = request.form.get('title', '').strip()
    if not title:
        return jsonify({'error': 'title required'}), 400

    add_visible = request.form.get('add_visible') == 'on'
    visible_x = float(request.form.get('visible_x', 2)) / 100
    visible_y = float(request.form.get('visible_y', 92)) / 100
    visible_size = float(request.form.get('visible_size', 6)) / 100

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.png', '.jpg', '.jpeg', '.webp'):
        return jsonify({'error': 'unsupported file type. use png, jpg, or webp.'}), 400

    artwork_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    user_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], current_user.id, 'protect')
    os.makedirs(user_dir, exist_ok=True)

    # Save original
    original_filename = f'{artwork_id}_original{ext}'
    original_path = os.path.join(user_dir, original_filename)
    file.save(original_path)

    # Encode invisible watermark
    protected_filename = f'{artwork_id}_protected.png'
    protected_path = os.path.join(user_dir, protected_filename)

    try:
        payload, wm_hash = encode_watermark(original_path, protected_path,
                                            current_user.id, artwork_id, timestamp)
    except Exception as e:
        return jsonify({'error': f'encoding failed: {str(e)}'}), 500

    # Apply visible watermark if requested
    if add_visible:
        logo_path = os.path.join(os.path.dirname(current_app.root_path), 'futtlecish-logo.png')
        if os.path.exists(logo_path):
            try:
                apply_visible_watermark(
                    protected_path, logo_path, protected_path,
                    x_pct=visible_x, y_pct=visible_y, size_pct=visible_size
                )
            except Exception:
                pass  # Visible failed but invisible is applied

    # Save to DB
    artwork = Artwork(
        id=artwork_id,
        user_id=current_user.id,
        original_url=f'/uploads/{current_user.id}/protect/{original_filename}',
        protected_url=f'/uploads/{current_user.id}/protect/{protected_filename}',
        title=title,
        watermark_hash=wm_hash,
        encoded_at=datetime.now(timezone.utc)
    )
    db.session.add(artwork)
    db.session.commit()

    return jsonify({
        'ok': True,
        'artwork': {
            'id': artwork.id,
            'title': artwork.title,
            'encoded_at': artwork.encoded_at.isoformat(),
            'protected_url': artwork.protected_url
        }
    })


@bp.route('/portfolio/<username>/protect/verify', methods=['POST'])
@login_required
def verify_owner(username):
    """Owner verify — from the protect page."""
    if current_user.username != username:
        abort(403)
    return _do_verify(request)


def _do_verify(req):
    """Shared verify logic for both public and owner endpoints."""
    if 'image' not in req.files:
        return jsonify({'status': 'error', 'message': 'no image uploaded'}), 400

    file = req.files['image']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'no file selected'}), 400

    # Save temp file
    temp_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], '_temp')
    os.makedirs(temp_dir, exist_ok=True)
    temp_filename = f'{uuid.uuid4()}{os.path.splitext(file.filename)[1]}'
    temp_path = os.path.join(temp_dir, temp_filename)
    file.save(temp_path)

    try:
        extracted_hex = decode_watermark(temp_path)
    except Exception:
        extracted_hex = None
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

    if not extracted_hex:
        return jsonify({'status': 'none', 'message': 'no watermark found'})

    # Search all artworks for the best hash match
    artworks = Artwork.query.filter(Artwork.watermark_hash.isnot(None)).all()

    best_match = None
    best_certainty = 0

    for artwork in artworks:
        certainty = compare_hashes(extracted_hex, artwork.watermark_hash)
        if certainty > best_certainty:
            best_certainty = certainty
            best_match = artwork

    # Thresholds
    if best_certainty >= 90 and best_match:
        user = User.query.get(best_match.user_id)
        return jsonify({
            'status': 'strong',
            'username': user.username if user else None,
            'display_name': user.display_name if user else None,
            'title': best_match.title,
            'encoded_at': best_match.encoded_at.isoformat() if best_match.encoded_at else None
        })
    elif best_certainty >= 60 and best_match:
        user = User.query.get(best_match.user_id)
        return jsonify({
            'status': 'degraded',
            'certainty': best_certainty,
            'username': user.username if user else None,
            'display_name': user.display_name if user else None
        })
    else:
        return jsonify({'status': 'none', 'message': 'no watermark found'})


@bp.route('/portfolio/<username>/protect/download/<artwork_id>')
@login_required
def download(username, artwork_id):
    if current_user.username != username:
        abort(403)

    artwork = Artwork.query.filter_by(id=artwork_id, user_id=current_user.id).first_or_404()
    if not artwork.protected_url:
        abort(404)

    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'],
                             current_user.id, 'protect',
                             os.path.basename(artwork.protected_url))
    return send_file(file_path, as_attachment=True,
                     download_name=f'{artwork.title}_protected.png')


@bp.route('/portfolio/<username>/protect/<artwork_id>', methods=['DELETE'])
@login_required
def delete_artwork(username, artwork_id):
    if current_user.username != username:
        abort(403)

    artwork = Artwork.query.filter_by(id=artwork_id, user_id=current_user.id).first_or_404()
    db.session.delete(artwork)
    db.session.commit()
    return jsonify({'ok': True})
