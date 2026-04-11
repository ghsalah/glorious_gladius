from django.core.management.base import BaseCommand

from fleet.models import User


class Command(BaseCommand):
    help = "Create the default administrator if missing."

    def handle(self, *args, **options):
        email = "admin@flower-distribution.local"
        if User.objects.filter(email__iexact=email).exists():
            self.stdout.write(self.style.WARNING(f"User {email} already exists — skipped."))
            return
        User.objects.create_user(
            email,
            email=email,
            password="admin@123",
            first_name="Operations Admin",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
        )
        self.stdout.write(self.style.SUCCESS(f"Created admin: {email}"))
