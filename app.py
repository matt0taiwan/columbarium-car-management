import os
from datetime import datetime, date
from flask import Flask, render_template, request, jsonify
from models import db, Registration

app = Flask(__name__)

database_path = os.environ.get('DATABASE_PATH', 'data/database.db')
os.makedirs(os.path.dirname(database_path), exist_ok=True)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{database_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()
    # 資料庫遷移：為舊資料庫加上 deceased_name 欄位
    try:
        with db.engine.connect() as conn:
            conn.execute(db.text("ALTER TABLE registrations ADD COLUMN deceased_name TEXT DEFAULT ''"))
            conn.commit()
    except Exception:
        pass  # 欄位已存在，忽略


# ─── 頁面路由 ───

@app.route('/')
def index():
    return render_template('admin.html')


@app.route('/admin')
def admin_page():
    return render_template('admin.html')


@app.route('/guard')
def guard_page():
    return render_template('guard.html')


@app.route('/health')
def health():
    return jsonify({'status': 'ok'})


# ─── API 路由 ───

@app.route('/api/registrations', methods=['GET'])
def get_registrations():
    """取得指定日期的登記列表，預設今天"""
    query_date = request.args.get('date', date.today().isoformat())
    try:
        target_date = date.fromisoformat(query_date)
    except ValueError:
        return jsonify({'error': '日期格式錯誤'}), 400

    registrations = Registration.query.filter_by(date=target_date)\
        .order_by(Registration.visit_time.asc(), Registration.created_at.asc()).all()
    return jsonify([r.to_dict() for r in registrations])


@app.route('/api/registrations', methods=['POST'])
def create_registration():
    """新增車輛登記"""
    data = request.get_json()
    if not data:
        return jsonify({'error': '無效的請求'}), 400

    plate_number = data.get('plate_number', '').strip().upper()
    applicant_name = data.get('applicant_name', '').strip()

    if not plate_number or not applicant_name:
        return jsonify({'error': '車牌號碼和申請人姓名為必填'}), 400

    reg_date = data.get('date', date.today().isoformat())
    try:
        target_date = date.fromisoformat(reg_date)
    except ValueError:
        target_date = date.today()

    reg = Registration(
        date=target_date,
        applicant_name=applicant_name,
        deceased_name=data.get('deceased_name', '').strip(),
        service_type=data.get('service_type', '').strip(),
        plate_number=plate_number,
        visit_time=data.get('visit_time', '').strip(),
        source=data.get('source', '').strip(),
    )
    db.session.add(reg)
    db.session.commit()
    return jsonify(reg.to_dict()), 201


@app.route('/api/registrations/<int:reg_id>', methods=['PUT'])
def update_registration(reg_id):
    """更新車輛登記"""
    reg = Registration.query.get_or_404(reg_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': '無效的請求'}), 400

    if 'date' in data:
        try:
            reg.date = date.fromisoformat(data['date'])
        except ValueError:
            pass
    if 'applicant_name' in data:
        reg.applicant_name = data['applicant_name'].strip()
    if 'deceased_name' in data:
        reg.deceased_name = data['deceased_name'].strip()
    if 'service_type' in data:
        reg.service_type = data['service_type'].strip()
    if 'plate_number' in data:
        reg.plate_number = data['plate_number'].strip().upper()
    if 'visit_time' in data:
        reg.visit_time = data['visit_time'].strip()
    if 'source' in data:
        reg.source = data['source'].strip()

    db.session.commit()
    return jsonify(reg.to_dict())


@app.route('/api/registrations/<int:reg_id>', methods=['DELETE'])
def delete_registration(reg_id):
    """刪除車輛登記"""
    reg = Registration.query.get_or_404(reg_id)
    db.session.delete(reg)
    db.session.commit()
    return jsonify({'message': '已刪除'})


@app.route('/api/registrations/<int:reg_id>/arrive', methods=['POST'])
def mark_arrived(reg_id):
    """標記車輛已到達"""
    reg = Registration.query.get_or_404(reg_id)
    reg.arrived = True
    reg.arrived_at = datetime.now()
    db.session.commit()
    return jsonify(reg.to_dict())


@app.route('/api/registrations/<int:reg_id>/unarrive', methods=['POST'])
def mark_unarrived(reg_id):
    """取消已到達標記"""
    reg = Registration.query.get_or_404(reg_id)
    reg.arrived = False
    reg.arrived_at = None
    db.session.commit()
    return jsonify(reg.to_dict())


@app.route('/api/search', methods=['GET'])
def search_plate():
    """搜尋車牌（今日）"""
    plate = request.args.get('plate', '').strip().upper()
    if not plate:
        return jsonify([])

    today = date.today()
    results = Registration.query.filter(
        Registration.date == today,
        Registration.plate_number.contains(plate)
    ).all()
    return jsonify([r.to_dict() for r in results])


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """取得指定日期統計，預設今天"""
    query_date = request.args.get('date', date.today().isoformat())
    try:
        target_date = date.fromisoformat(query_date)
    except ValueError:
        target_date = date.today()

    total = Registration.query.filter_by(date=target_date).count()
    arrived = Registration.query.filter_by(date=target_date, arrived=True).count()

    # 佛事項目分佈
    service_stats = db.session.query(
        Registration.service_type,
        db.func.count(Registration.id)
    ).filter_by(date=target_date).group_by(Registration.service_type).all()

    return jsonify({
        'total': total,
        'arrived': arrived,
        'not_arrived': total - arrived,
        'services': [{'name': s[0] or '未指定', 'count': s[1]} for s in service_stats],
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
