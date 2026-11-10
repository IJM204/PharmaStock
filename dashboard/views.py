
from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from medicines.models import Medicine, Category
from suppliers.models import Supplier
from sales.models import Sale
from inventory.models import Batch
from purchases.models import Purchase
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.views import LoginView, LogoutView
from django.urls import reverse_lazy
from django.views.generic import TemplateView


class DashboardLoginView(LoginView):
    template_name = 'dashboard/login.html'
    redirect_authenticated_user = True

    def get_success_url(self):
        return reverse_lazy('dashboard-page')


class DashboardLogoutView(LogoutView):
    next_page = reverse_lazy('dashboard-login')


class DashboardPageView(LoginRequiredMixin, TemplateView):
    template_name = 'dashboard/overview.html'
    login_url = reverse_lazy('dashboard-login')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        user = self.request.user
        role = user.role

        is_admin = user.is_superuser or role == 'Admin'

        context['is_admin'] = is_admin
        context['is_stock_manager'] = role == 'STOCK_Manager'
        context['is_pharmacist'] = role == 'PHARMASIST'
        context['is_cashier'] = role == 'Cashier'

        return context

User = get_user_model()


class DashboardOverviewView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        today = timezone.localdate()
        expiration_limit = today + timedelta(days=30)

        role = request.user.role
        is_admin = request.user.is_superuser or role == 'Admin'

        data = {
            'date': today,
        }

        # 1. ADMIN : statistiques des utilisateurs
        if is_admin:

            users = User.objects.all()

            data['users'] = {
                'total': users.count(),
                'active': users.filter(is_active=True).count(),
                'inactive': users.filter(is_active=False).count(),
                'by_role': {
                    'Admin': users.filter(role='Admin').count(),
                    'STOCK_Manager': users.filter(
                        role='STOCK_Manager'
                    ).count(),
                    'PHARMASIST': users.filter(
                        role='PHARMASIST'
                    ).count(),
                    'Cashier': users.filter(role='Cashier').count(),
                },
            }

        # 2. ADMIN et PHARMASIST : statistiques des médicaments
        if is_admin or role == 'PHARMASIST':

            data['medicines'] = {
                'total': Medicine.objects.count(),
                'active': Medicine.objects.filter(
                    is_active=True
                ).count(),
            }

            data['categories'] = {
                'total': Category.objects.count(),
            }

        # 3. ADMIN : statistiques des fournisseurs
        if is_admin:

            suppliers = Supplier.objects.all()

            data['suppliers'] = {
                'total': suppliers.count(),
                'active': suppliers.filter(
                    is_active=True
                ).count(),
                'inactive': suppliers.filter(
                    is_active=False
                ).count(),
            }

        # 4. STOCK_Manager, PHARMASIST et ADMIN : statistiques du stock
        if is_admin or role in ['STOCK_Manager', 'PHARMASIST']:

            total_batches = Batch.objects.count()

            total_stock = Batch.objects.aggregate(
                total=Sum('quantity_available')
            )['total'] or 0

            low_stock_batches = Batch.objects.filter(
                quantity_available__lte=10,
                quantity_available__gt=0,
                expiry_date__gte=today
            ).count()

            expired_batches = Batch.objects.filter(
                expiry_date__lt=today,
                quantity_available__gt=0
            ).count()

            expiring_soon_batches = Batch.objects.filter(
                expiry_date__gte=today,
                expiry_date__lte=expiration_limit,
                quantity_available__gt=0
            ).count()

            data['stock'] = {
                'total_batches': total_batches,
                'total_available': total_stock,
                'low_stock_batches': low_stock_batches,
            }

            data['expiration'] = {
                'expired_batches': expired_batches,
                'expiring_soon_batches': expiring_soon_batches,
            }

        # 5. STOCK_Manager et ADMIN : statistiques des achats
        if is_admin or role == 'STOCK_Manager':

            purchases = Purchase.objects.exclude(
                status='CANCELLED'
            )

            purchase_total = purchases.aggregate(
                total=Sum('total_amount')
            )['total'] or 0

            data['purchases'] = {
                'total': purchases.count(),
                'pending': purchases.filter(
                    status='PENDING'
                ).count(),
                'partial': purchases.filter(
                    status='PARTIAL'
                ).count(),
                'received': purchases.filter(
                    status='RECEIVED'
                ).count(),
                'total_amount': purchase_total,
            }

        # 6. PHARMASIST, CASHIER et ADMIN : statistiques des ventes
        if is_admin or role in ['PHARMASIST', 'Cashier']:

            today_sales = Sale.objects.filter(
                status='COMPLETED',
                sale_date__date=today
            )

            # Le caissier consulte uniquement ses propres ventes
            if role == 'Cashier' and not is_admin:

                today_sales = today_sales.filter(
                    sold_by=request.user
                )

            sales_count = today_sales.count()

            today_revenue = today_sales.aggregate(
                total=Sum('total_amount')
            )['total'] or 0

            data['sales'] = {
                'today_count': sales_count,
                'today_revenue': today_revenue,
            }

        return Response(data)
