"""URLs des pages HTML du module Ventes."""

from django.urls import path

from .page_views import SaleCreatePageView, SaleDetailPageView, SalesPageView


urlpatterns = [
    path('', SalesPageView.as_view(), name='sales-page'),
    path('create/', SaleCreatePageView.as_view(), name='sale-create-page'),
    path('<int:pk>/', SaleDetailPageView.as_view(), name='sale-detail-page'),
]
