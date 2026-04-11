from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Delivery, Driver, DriverLocation, User, WarehouseDepot


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "first_name", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active")
    search_fields = ("email", "first_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("first_name", "last_name", "role")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "first_name", "role", "password1", "password2", "is_staff", "is_active"),
            },
        ),
    )

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if "email" in form.base_fields:
            form.base_fields["email"].required = True
        if "first_name" in form.base_fields:
            form.base_fields["first_name"].required = True
            form.base_fields["first_name"].help_text = "Display name for the admin or driver."
        return form


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ("id", "display_name", "user", "phone", "vehicle_label", "is_active")
    list_filter = ("is_active",)
    search_fields = ("user__email", "user__first_name", "vehicle_label")
    raw_id_fields = ("user",)


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ("id", "recipient_name", "status", "assigned_driver", "created_at")
    list_filter = ("status",)
    search_fields = ("recipient_name", "address")


@admin.register(DriverLocation)
class DriverLocationAdmin(admin.ModelAdmin):
    list_display = ("driver", "lat", "lng", "updated_at")


@admin.register(WarehouseDepot)
class WarehouseDepotAdmin(admin.ModelAdmin):
    list_display = ("label", "lat", "lng", "updated_at")
