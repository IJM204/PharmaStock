"""URLs des pages HTML du module Médicaments."""

from django.urls import path

from .page_views import CategoryPageView, MedicinePageView


urlpatterns = [
    path('', MedicinePageView.as_view(), name='medicines-page'),
    path(
        'categories/',
        CategoryPageView.as_view(),
        name='medicine-categories-page',
    ),
]
