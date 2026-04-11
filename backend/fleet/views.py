from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Delivery, Driver, DriverLocation, User, WarehouseDepot
from .permissions import IsAdminUser
from .serializers import (
    AdminLoginSerializer,
    AssignDeliverySerializer,
    AuthUserSerializer,
    ChangePasswordSerializer,
    CreateDeliverySerializer,
    CreateDriverSerializer,
    DriverSerializer,
    UpdateDeliverySerializer,
    UpdateDriverSerializer,
    WarehouseDepotSerializer,
    delivery_to_camel,
    location_to_camel,
)


def _tokens_for_user(user: User):
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


def _error_message(data) -> str:
    if isinstance(data, dict):
        if "message" in data:
            m = data["message"]
            return m if isinstance(m, str) else str(m)
        if "detail" in data:
            return str(data["detail"])
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
        qs = DriverLocation.objects.select_related("driver").filter(driver__is_active=True)
        return Response([location_to_camel(loc) for loc in qs])


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
