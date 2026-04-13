from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Delivery, Driver, DriverLocation, User, WarehouseDepot
from .serializers import (
    AdminLoginSerializer,
    AssignDeliverySerializer,
    AuthUserSerializer,
    ChangePasswordSerializer,
    CreateDeliverySerializer,
    CreateDriverSerializer,
    DriverSerializer,
    DriverLoginSerializer,
    LocationUpdateSerializer,
    UpdateDeliverySerializer,
    UpdateDeliveryStatusSerializer,
    UpdateDriverSerializer,
    WarehouseDepotSerializer,
    delivery_to_camel,
    location_to_camel,
    user_display_name,
)
from .permissions import IsAdminUser, IsDriverUser


def _tokens_for_user(user: User):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


def _error_message(data) -> str:
    if isinstance(data, dict):
        # Prefer specific "message" or "detail" keys
        for key in ["message", "detail", "non_field_errors"]:
            if key in data:
                m = data[key]
                if isinstance(m, list) and m:
                    return str(m[0])
                return m if isinstance(m, str) else str(m)
        
        # Fallback: join other field errors
        parts = []
        for k, v in data.items():
            if isinstance(v, list) and v:
                parts.append(f"{k}: {v[0]}")
            elif isinstance(v, str):
                parts.append(f"{k}: {v}")
        if parts:
            return "; ".join(parts)
    return "Request failed."


class AdminLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = AdminLoginSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = ser.validated_data["user"]
        token = _tokens_for_user(user)
        return Response(
            {
                "accessToken": token,
                "user": AuthUserSerializer(user).data,
            }
        )


class DriverLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = DriverLoginSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = ser.validated_data["user"]
        token = _tokens_for_user(user)
        return Response(
            {
                "accessToken": token,
                "user": AuthUserSerializer(user).data,
                "driverId": str(user.driver_profile.id),
            }
        )


class AuthMeView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        return Response(AuthUserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data, context={"request": request})
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(ser.validated_data["new_password"])
        request.user.save()
        return Response({"ok": True})


class DriverListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        qs = Driver.objects.select_related("user").all()
        return Response(DriverSerializer(qs, many=True).data)

    def post(self, request):
        ser = CreateDriverSerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        driver = ser.save()
        return Response(DriverSerializer(driver).data, status=status.HTTP_201_CREATED)


class DriverDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_object(self, pk):
        return Driver.objects.select_related("user").get(pk=pk)

    def patch(self, request, pk):
        try:
            driver = self.get_object(pk)
        except Driver.DoesNotExist:
            return Response({"message": "Driver not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = UpdateDriverSerializer(driver, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser.save()
        driver.refresh_from_db()
        return Response(DriverSerializer(driver).data)

    def delete(self, request, pk):
        try:
            driver = self.get_object(pk)
        except Driver.DoesNotExist:
            return Response({"message": "Driver not found."}, status=status.HTTP_404_NOT_FOUND)
        uid = driver.user_id
        with transaction.atomic():
            Delivery.objects.filter(assigned_driver=driver).update(
                assigned_driver=None, sequence_order=None
            )
            DriverLocation.objects.filter(driver=driver).delete()
            driver.delete()
            User.objects.filter(pk=uid, role=User.Role.DRIVER).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeliveryListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        qs = Delivery.objects.select_related("assigned_driver").all()
        return Response([delivery_to_camel(d) for d in qs])

    def post(self, request):
        ser = CreateDeliverySerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        d = ser.save()
        return Response(delivery_to_camel(d), status=status.HTTP_201_CREATED)


class DeliveryAssignView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        try:
            delivery = Delivery.objects.get(pk=pk)
        except Delivery.DoesNotExist:
            return Response({"message": "Delivery not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = AssignDeliverySerializer(data=request.data)
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            driver = Driver.objects.get(pk=ser.validated_data["driverId"])
        except Driver.DoesNotExist:
            return Response({"message": "Driver not found."}, status=status.HTTP_404_NOT_FOUND)
        if not driver.is_active:
            return Response(
                {"message": "Cannot assign to an inactive driver."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        delivery.assigned_driver = driver
        delivery.sequence_order = ser.validated_data["sequenceOrder"]
        if delivery.status == Delivery.Status.COMPLETED:
            pass
        else:
            delivery.status = Delivery.Status.PENDING
        delivery.save()
        return Response(delivery_to_camel(delivery))


class DeliveryUnassignView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        try:
            delivery = Delivery.objects.get(pk=pk)
        except Delivery.DoesNotExist:
            return Response({"message": "Delivery not found."}, status=status.HTTP_404_NOT_FOUND)
        delivery.assigned_driver = None
        delivery.sequence_order = None
        delivery.save()
        return Response(delivery_to_camel(delivery))


class DeliveryDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_object(self, pk):
        return Delivery.objects.get(pk=pk)

    def patch(self, request, pk):
        try:
            delivery = self.get_object(pk)
        except Delivery.DoesNotExist:
            return Response({"message": "Delivery not found."}, status=status.HTTP_404_NOT_FOUND)
        ser = UpdateDeliverySerializer(delivery, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser.save()
        delivery.refresh_from_db()
        return Response(delivery_to_camel(delivery))

    def delete(self, request, pk):
        try:
            delivery = self.get_object(pk)
        except Delivery.DoesNotExist:
            return Response({"message": "Delivery not found."}, status=status.HTTP_404_NOT_FOUND)
        delivery.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DriverLocationsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        qs = DriverLocation.objects.select_related("driver").filter(
            driver__is_active=True, driver__on_duty=True
        )
        return Response([location_to_camel(loc) for loc in qs])


class DriverAppMeView(APIView):
    permission_classes = [IsAuthenticated, IsDriverUser]

    def get(self, request):
        driver = request.user.driver_profile
        return Response(
            {
                "driverId": str(driver.id),
                "name": user_display_name(request.user),
                "email": request.user.email,
                "vehicleLabel": driver.vehicle_label,
                "onDuty": driver.on_duty,
            }
        )

    def patch(self, request):
        driver = request.user.driver_profile
        on = request.data.get("onDuty")
        if on is None or not isinstance(on, bool):
            return Response(
                {"message": "Provide onDuty as a boolean."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        driver.on_duty = on
        driver.save(update_fields=["on_duty"])
        return Response(
            {
                "driverId": str(driver.id),
                "name": user_display_name(request.user),
                "email": request.user.email,
                "vehicleLabel": driver.vehicle_label,
                "onDuty": driver.on_duty,
            }
        )


class DriverAppChangePasswordView(APIView):
    permission_classes = [IsAuthenticated, IsDriverUser]

    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data, context={"request": request})
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(ser.validated_data["new_password"])
        request.user.save()
        return Response({"ok": True})


class DriverAppAcceptRouteView(APIView):
    permission_classes = [IsAuthenticated, IsDriverUser]

    def post(self, request):
        driver = request.user.driver_profile
        pending = Delivery.objects.filter(
            assigned_driver=driver,
            status=Delivery.Status.PENDING,
        )
        count = pending.count()
        if count == 0:
            return Response({"acceptedCount": 0, "message": "No new stops to accept."})
        pending.update(status=Delivery.Status.ACCEPTED)
        return Response({"acceptedCount": count})


class DriverAppDeliveriesView(APIView):
    permission_classes = [IsAuthenticated, IsDriverUser]

    def get(self, request):
        if not hasattr(request.user, "driver_profile"):
            return Response([])
        driver = request.user.driver_profile
        qs = Delivery.objects.filter(assigned_driver=driver).order_by("sequence_order", "created_at")
        return Response([delivery_to_camel(d) for d in qs])


class DriverAppDeliveryStatusView(APIView):
    permission_classes = [IsAuthenticated, IsDriverUser]

    def patch(self, request, pk):
        try:
            delivery = Delivery.objects.get(pk=pk, assigned_driver=request.user.driver_profile)
        except Delivery.DoesNotExist:
            return Response({"message": "Delivery not found or not assigned to you."}, status=status.HTTP_404_NOT_FOUND)

        ser = UpdateDeliveryStatusSerializer(
            delivery,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        if not ser.is_valid():
            return Response({"message": _error_message(ser.errors)}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            ser.save()
            delivery.refresh_from_db()
        return Response(delivery_to_camel(delivery))


class DriverAppWarehouseView(APIView):
    """Read-only depot coordinates for in-app navigation maps."""

    permission_classes = [IsAuthenticated, IsDriverUser]

    def get(self, request):
        depot = _get_or_create_warehouse_depot()
        return Response(WarehouseDepotSerializer(depot).data)


class DriverAppLocationView(APIView):
    permission_classes = [IsAuthenticated, IsDriverUser]

    def put(self, request):
        try:
            driver = request.user.driver_profile
        except AttributeError:
            return Response({"message": "Driver profile missing."}, status=status.HTTP_400_BAD_REQUEST)
        
        loc, created = DriverLocation.objects.get_or_create(driver=driver, defaults={'lat': 0, 'lng': 0})
        ser = LocationUpdateSerializer(loc, data=request.data, partial=True)
        if not ser.is_valid():
             return Response({"message": _error_message(ser.errors)}, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(location_to_camel(loc))


def _get_or_create_warehouse_depot() -> WarehouseDepot:
    d = WarehouseDepot.objects.order_by("pk").first()
    if d is None:
        d = WarehouseDepot.objects.create()
    return d


class WarehouseDepotView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        depot = _get_or_create_warehouse_depot()
        return Response(WarehouseDepotSerializer(depot).data)

    def patch(self, request):
        depot = _get_or_create_warehouse_depot()
        ser = WarehouseDepotSerializer(depot, data=request.data, partial=True)
        if not ser.is_valid():
            return Response(
                {"message": _error_message(ser.errors)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser.save()
        return Response(ser.data)
