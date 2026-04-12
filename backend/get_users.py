import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

user = User.objects.get(email="akash@gmail.com")
user.set_password("akash123")
user.save()
print("Password updated for akash@gmail.com")
