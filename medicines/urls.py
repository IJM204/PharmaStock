from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, MedicineViewSet

router = DefaultRouter()

router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'medicines', MedicineViewSet, basename='medicine')

urlpatterns = router.urls