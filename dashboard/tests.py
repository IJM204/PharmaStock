from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework.test import APIClient

from medicines.models import Medicine, Category
from suppliers.models import Supplier
from inventory.models import Batch
from sales.models import Sale
from purchases.models import Purchase


User = get_user_model()


class DashboardOverviewTests(TestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_test',
            password='testpassword123',
            role='Admin'
        )

        self.stock_manager = User.objects.create_user(
            username='stock_test',
            password='testpassword123',
            role='STOCK_Manager'
        )

        self.pharmacist = User.objects.create_user(
            username='pharmacist_test',
            password='testpassword123',
            role='PHARMASIST'
        )

        self.cashier = User.objects.create_user(
            username='cashier_test',
            password='testpassword123',
            role='Cashier'
        )

        self.category = Category.objects.create(
            name='Antibiotiques'
        )

        self.medicine = Medicine.objects.create(
            category=self.category,
            name='Amoxicilline',
            dosage='500 mg',
            unit_price=Decimal('2500.00')
        )

        Supplier.objects.create(
            name='Fournisseur Test',
            phone='123456789'
        )

        self.today = timezone.localdate()

        self.batch = Batch.objects.create(
            medicine=self.medicine,
            batch_number='LOT-001',
            quantity_received=5,
            quantity_available=5,
            expiry_date=self.today + timedelta(days=60),
            purchase_price=Decimal('1500.00')
        )

        self.admin_client = self.make_client(self.admin)
        self.stock_client = self.make_client(self.stock_manager)
        self.pharmacist_client = self.make_client(self.pharmacist)
        self.cashier_client = self.make_client(self.cashier)

    def make_client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def get_dashboard(self, client):
        return client.get(reverse('dashboard-overview'))

    def test_admin_sees_all_statistics(self):

        response = self.get_dashboard(self.admin_client)

        self.assertEqual(response.status_code, 200)

        self.assertIn('medicines', response.data)
        self.assertIn('categories', response.data)
        self.assertIn('suppliers', response.data)
        self.assertIn('stock', response.data)
        self.assertIn('expiration', response.data)
        self.assertIn('sales', response.data)
        self.assertIn('purchases', response.data)

    def test_stock_manager_sees_stock_and_purchases(self):

        response = self.get_dashboard(self.stock_client)

        self.assertEqual(response.status_code, 200)

        self.assertIn('stock', response.data)
        self.assertIn('expiration', response.data)
        self.assertIn('purchases', response.data)

        self.assertNotIn('sales', response.data)
        self.assertNotIn('medicines', response.data)

    def test_pharmacist_sees_medicines_stock_and_sales(self):

        response = self.get_dashboard(self.pharmacist_client)

        self.assertEqual(response.status_code, 200)

        self.assertIn('stock', response.data)
        self.assertIn('expiration', response.data)
        self.assertIn('sales', response.data)

        self.assertNotIn('purchases', response.data)
        self.assertNotIn('suppliers', response.data)
        self.assertIn('medicines', response.data)
        self.assertIn('categories', response.data)

    def test_cashier_sees_only_sales(self):

        Sale.objects.create(
            sold_by=self.cashier,
            status='COMPLETED',
            total_amount=Decimal('10000.00')
        )

        Sale.objects.create(
            sold_by=self.pharmacist,
            status='COMPLETED',
            total_amount=Decimal('5000.00')
        )

        response = self.get_dashboard(self.cashier_client)

        self.assertEqual(response.status_code, 200)

        self.assertIn('sales', response.data)
        self.assertNotIn('stock', response.data)
        self.assertNotIn('expiration', response.data)
        self.assertNotIn('purchases', response.data)
        self.assertNotIn('medicines', response.data)

        self.assertEqual(
            response.data['sales']['today_count'], 1
        )

        self.assertEqual(
            response.data['sales']['today_revenue'],
            Decimal('10000.00')
        )

    def test_stock_and_expiration_statistics(self):

        Batch.objects.create(
            medicine=self.medicine,
            batch_number='LOT-002',
            quantity_received=5,
            quantity_available=0,
            expiry_date=self.today + timedelta(days=60),
            purchase_price=Decimal('1500.00')
        )

        Batch.objects.create(
            medicine=self.medicine,
            batch_number='LOT-003',
            quantity_received=10,
            quantity_available=3,
            expiry_date=self.today - timedelta(days=5),
            purchase_price=Decimal('1500.00')
        )

        Batch.objects.create(
            medicine=self.medicine,
            batch_number='LOT-004',
            quantity_received=8,
            quantity_available=8,
            expiry_date=self.today + timedelta(days=15),
            purchase_price=Decimal('1500.00')
        )

        response = self.get_dashboard(self.stock_client)

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            response.data['stock']['total_batches'], 4
        )

        self.assertEqual(
            response.data['stock']['total_available'], 16
        )

        self.assertEqual(
            response.data['stock']['low_stock_batches'], 2
        )

        self.assertEqual(
            response.data['expiration']['expired_batches'], 1
        )

        self.assertEqual(
            response.data['expiration']['expiring_soon_batches'], 1
        )

    def test_dashboard_requires_authentication(self):

        client = APIClient()

        response = self.get_dashboard(client)

        self.assertIn(response.status_code, [401, 403])