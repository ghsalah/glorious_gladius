import uuid

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        DRIVER = "driver", "Driver"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.DRIVER)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    def save(self, *args, **kwargs):
        self.username = self.email
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.email


class Driver(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    phone = models.CharField(max_length=40)
    vehicle_label = models.CharField(max_length=80)
    is_active = models.BooleanField(default=True)
    on_duty = models.BooleanField(default=False)

    class Meta:
        ordering = ["user__first_name", "user__email"]

    def __str__(self) -> str:
        return self.display_name

    @property
    def display_name(self) -> str:
        name = (self.user.first_name or "").strip()
        return name or self.user.email


class Delivery(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "pending"
        ACCEPTED = "accepted", "accepted"
        IN_PROGRESS = "in_progress", "in_progress"
        COMPLETED = "completed", "completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    address = models.TextField()
    lat = models.FloatField()
    lng = models.FloatField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    assigned_driver = models.ForeignKey(
        Driver,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="deliveries",
    )
    sequence_order = models.PositiveIntegerField(null=True, blank=True)
    recipient_name = models.CharField(max_length=200)
    recipient_phone = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        super().clean()
        if self.lat < -90 or self.lat > 90:
            raise ValidationError({"lat": "Latitude must be between -90 and 90."})
        if self.lng < -180 or self.lng > 180:
            raise ValidationError({"lng": "Longitude must be between -180 and 180."})


class DriverLocation(models.Model):
    driver = models.OneToOneField(Driver, on_delete=models.CASCADE, related_name="location")
    lat = models.FloatField()
    lng = models.FloatField()
    updated_at = models.DateTimeField(auto_now=True)


class WarehouseDepot(models.Model):
    """
    Operational start point (warehouse / shop). Single logical row — API uses get-or-create.
    Update here when the business moves; routes and maps use these coordinates.
    """

    label = models.CharField(max_length=200, default="Warehouse")
    address = models.TextField(blank=True)
    lat = models.FloatField(default=52.3676)
    lng = models.FloatField(default=4.9041)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        if self.lat < -90 or self.lat > 90:
            raise ValidationError({"lat": "Latitude must be between -90 and 90."})
        if self.lng < -180 or self.lng > 180:
            raise ValidationError({"lng": "Longitude must be between -180 and 180."})

    def __str__(self) -> str:
        return self.label
