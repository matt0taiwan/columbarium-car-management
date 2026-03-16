from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, date

db = SQLAlchemy()


class Registration(db.Model):
    __tablename__ = 'registrations'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    applicant_name = db.Column(db.String(100), nullable=False)
    deceased_name = db.Column(db.String(100), nullable=True, default='')
    service_type = db.Column(db.String(100), nullable=False)
    plate_number = db.Column(db.String(20), nullable=False)
    visit_time = db.Column(db.String(50), nullable=True)
    source = db.Column(db.String(200), nullable=True)
    arrived = db.Column(db.Boolean, default=False)
    arrived_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.isoformat(),
            'applicant_name': self.applicant_name,
            'deceased_name': self.deceased_name or '',
            'service_type': self.service_type,
            'plate_number': self.plate_number,
            'visit_time': self.visit_time or '',
            'source': self.source or '',
            'arrived': self.arrived,
            'arrived_at': self.arrived_at.strftime('%H:%M') if self.arrived_at else None,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else None,
        }
