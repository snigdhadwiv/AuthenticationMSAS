import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'msas_backend.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import UserProfile

# Create Admin User
if not User.objects.filter(username='admin').exists():
    admin = User.objects.create_superuser('admin', 'admin@example.com', 'admin')
    UserProfile.objects.create(user=admin)
    print("Created superuser: admin / admin")

# Create Regular User
if not User.objects.filter(username='user').exists():
    user = User.objects.create_user('user', 'user@example.com', 'user', first_name='Test', last_name='User')
    UserProfile.objects.create(user=user, is_enrolled=True)
    print("Created regular user: user / user")

print("User setup complete.")
