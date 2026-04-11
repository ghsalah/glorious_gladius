from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from .models import Delivery, Driver, DriverLocation, User, WarehouseDepot


def user_display_name(user: User) -> str:
    name = (user.first_name or "").strip()
    return name or user.email.split("@")[0]


class AuthUserSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "name", "email", "role")

    def get_id(self, obj: User) -> str:
        return str(obj.pk)

    def get_name(self, obj: User) -> str:
        return user_display_name(obj)


class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        from django.contrib.auth import authenticate

        email = attrs["email"].strip().lower()
        user = authenticate(username=email, password=attrs["password"])
        if not user or not user.is_active:
            raise serializers.ValidationError({"message": "Invalid email or password."})
        if user.role != User.Role.ADMIN:
            raise serializers.ValidationError(
                {
                    "message": (
                        "Driver accounts use the Glorious Gladius Driver app. "
                        "This console is for administrators only."
                    )
                }
            )
        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6)
    new_password_confirm = serializers.CharField(write_only=True, min_length=6)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Passwords do not match."})
        user: User = self.context["request"].user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        validate_password(attrs["new_password"], user=user)
        return attrs


class DriverSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    userId = serializers.SerializerMethodField()
    name = serializers.CharField(source="user.first_name", max_length=150)
    email = serializers.EmailField(source="user.email")
    vehicleLabel = serializers.CharField(source="vehicle_label", max_length=80)
    isActive = serializers.BooleanField(source="is_active")

    class Meta:
        model = Driver
        fields = ("id", "userId", "name", "email", "phone", "vehicleLabel", "isActive")

    def get_userId(self, obj: Driver) -> str:
        return str(obj.user_id)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_phone(self, value: str) -> str:
        v = value.strip()
        if len(v) < 5:
            raise serializers.ValidationError("Phone must be at least 5 characters.")
        return v

    def validate_vehicle_label(self, value: str) -> str:
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError("Vehicle label must be at least 2 characters.")
        return v

    def validate_name(self, value: str) -> str:
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters.")
        return v


class CreateDriverSerializer(DriverSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta(DriverSerializer.Meta):
        fields = DriverSerializer.Meta.fields + ("password",)

    def create(self, validated_data):
        password = validated_data.pop("password")
        user_nested = validated_data.pop("user")
        email = user_nested["email"].strip().lower()
        first_name = user_nested["first_name"].strip()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})
        with transaction.atomic():
            user = User.objects.create_user(
                email,
                email=email,
                password=password,
                first_name=first_name,
                role=User.Role.DRIVER,
            )
            driver = Driver.objects.create(user=user, **validated_data)
        return driver


class UpdateDriverSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="user.first_name", max_length=150, required=False)
    email = serializers.EmailField(source="user.email", required=False)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    vehicleLabel = serializers.CharField(source="vehicle_label", max_length=80, required=False)
    isActive = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model = Driver
        fields = ("name", "email", "phone", "vehicleLabel", "isActive", "new_password")

    def validate_email(self, value):
        if value is None:
            return value
        return value.strip().lower()

    def validate_phone(self, value):
        if value is None:
            return value
        v = value.strip()
        if len(v) < 5:
            raise serializers.ValidationError("Phone must be at least 5 characters.")
        return v

    def validate_vehicle_label(self, value):
        if value is None:
            return value
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError("Vehicle label must be at least 2 characters.")
        return v

    def validate_new_password(self, value):
        if value and len(value) < 6:
            raise serializers.ValidationError("New password must be at least 6 characters.")
        return value

    def update(self, instance, validated_data):
        new_pw = validated_data.pop("new_password", None)
        user_nested = validated_data.pop("user", {})
        email = user_nested.get("email")
        if email and User.objects.filter(email__iexact=email).exclude(pk=instance.user_id).exists():
            raise serializers.ValidationError({"email": "A driver with this email already exists."})
        if "first_name" in user_nested:
            instance.user.first_name = user_nested["first_name"].strip()
        if email is not None:
            instance.user.email = email
            instance.user.username = email
        if new_pw:
            validate_password(new_pw, user=instance.user)
            instance.user.set_password(new_pw)
        instance.user.save()
        return super().update(instance, validated_data)


def delivery_to_camel(instance: Delivery) -> dict:
    return {
        "id": str(instance.id),
        "address": instance.address,
        "lat": instance.lat,
        "lng": instance.lng,
        "status": instance.status,
        "assignedDriverId": str(instance.assigned_driver_id) if instance.assigned_driver_id else None,
        "sequenceOrder": instance.sequence_order,
        "recipientName": instance.recipient_name,
        "notes": instance.notes or None,
        "createdAt": instance.created_at.isoformat().replace("+00:00", "Z"),
    }


class CreateDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = Delivery
        fields = ("address", "lat", "lng", "recipient_name", "notes")

    def validate_address(self, value: str) -> str:
        v = value.strip()
        if len(v) < 8:
            raise serializers.ValidationError("Address must be at least 8 characters.")
        return v

    def validate_recipient_name(self, value: str) -> str:
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError("Recipient name must be at least 2 characters.")
        return v

    def validate_notes(self, value):
        if value is None:
            return ""
        return value.strip()

    def create(self, validated_data):
        d = Delivery.objects.create(**validated_data)
        return d


class AssignDeliverySerializer(serializers.Serializer):
    driverId = serializers.UUIDField()
    sequenceOrder = serializers.IntegerField(min_value=1, default=1)


class UpdateDeliverySerializer(serializers.ModelSerializer):
    recipientName = serializers.CharField(source="recipient_name", required=False)

    class Meta:
        model = Delivery
        fields = ("address", "lat", "lng", "recipientName", "notes", "status")

    def validate_address(self, value):
        if value is not None and len(value.strip()) < 8:
            raise serializers.ValidationError("Address must be at least 8 characters.")
        return value

    def validate_recipientName(self, value):
        if value is not None and len(value.strip()) < 2:
            raise serializers.ValidationError("Recipient name must be at least 2 characters.")
        return value


def location_to_camel(loc: DriverLocation) -> dict:
    return {
        "driverId": str(loc.driver_id),
        "lat": loc.lat,
        "lng": loc.lng,
        "updatedAt": loc.updated_at.isoformat().replace("+00:00", "Z"),
    }


class WarehouseDepotSerializer(serializers.ModelSerializer):
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = WarehouseDepot
        fields = ("label", "address", "lat", "lng", "updatedAt")

    def validate_label(self, value: str) -> str:
        v = value.strip()
        if len(v) < 2:
            raise serializers.ValidationError("Label must be at least 2 characters.")
        return v

    def validate_address(self, value: str) -> str:
        if value is None:
            return ""
        return value.strip()

    def validate_lat(self, value: float) -> float:
        if value < -90 or value > 90:
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_lng(self, value: float) -> float:
        if value < -180 or value > 180:
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value
