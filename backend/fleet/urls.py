from django.urls import path

from . import views

urlpatterns = [
    path("auth/login", views.AdminLoginView.as_view()),
    path("auth/me", views.AuthMeView.as_view()),
    path("auth/change-password", views.ChangePasswordView.as_view()),
    path("drivers", views.DriverListCreateView.as_view()),
    path("drivers/<uuid:pk>", views.DriverDetailView.as_view()),
    path("deliveries", views.DeliveryListCreateView.as_view()),
    path("deliveries/<uuid:pk>", views.DeliveryDetailView.as_view()),
    path("deliveries/<uuid:pk>/assign", views.DeliveryAssignView.as_view()),
    path("deliveries/<uuid:pk>/unassign", views.DeliveryUnassignView.as_view()),
    path("tracking/drivers/latest", views.DriverLocationsView.as_view()),
    path("settings/warehouse", views.WarehouseDepotView.as_view()),
]
