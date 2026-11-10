from django.urls import path

from .views import (
    DashboardOverviewView,
    DashboardLoginView,
    DashboardLogoutView,
    DashboardPageView,
)

urlpatterns = [
    # Interface HTML
    path('', DashboardPageView.as_view(), name='dashboard-page'),
    path('login/', DashboardLoginView.as_view(), name='dashboard-login'),
    path('logout/', DashboardLogoutView.as_view(), name='dashboard-logout'),

    # API existante
    path(
        'overview/',
        DashboardOverviewView.as_view(),
        name='dashboard-overview'
    ),
]