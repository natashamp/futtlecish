from flask import render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, current_user
from app import db
from app.auth import bp
from app.models import User, Portfolio, BusinessCard


@bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('wanderland.index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip().lower()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        display_name = request.form.get('display_name', '').strip()

        if not all([username, email, password, display_name]):
            flash('all fields are required.', 'error')
            return render_template('register.html')

        if User.query.filter_by(username=username).first():
            flash('username already taken.', 'error')
            return render_template('register.html')

        if User.query.filter_by(email=email).first():
            flash('email already registered.', 'error')
            return render_template('register.html')

        user = User(username=username, email=email, display_name=display_name)
        user.set_password(password)
        db.session.add(user)

        portfolio = Portfolio(user=user)
        db.session.add(portfolio)

        card = BusinessCard(user=user)
        db.session.add(card)

        db.session.commit()
        login_user(user)
        return redirect(url_for('portfolio.view', username=user.username))

    return render_template('register.html')


@bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('wanderland.index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip().lower()
        password = request.form.get('password', '')

        user = User.query.filter_by(username=username).first()
        if user is None or not user.check_password(password):
            flash('invalid username or password.', 'error')
            return render_template('login.html')

        login_user(user)
        return redirect(url_for('wanderland.index'))

    return render_template('login.html')


@bp.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('feed.index'))
