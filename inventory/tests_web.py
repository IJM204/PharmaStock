"""Tests des pages HTML du module Stock."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from medicines.models import Category, Medicine
from .models import Batch


User = get_user_model()


class InventoryPageTests(TestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='inventory_admin',
            password='TestPassword123!',
            role='Admin',
        )
        self.stock_manager = User.objects.create_user(
            username='inventory_stock',
            password='TestPassword123!',
            role='STOCK_Manager',
        )
        self.pharmacist = User.objects.create_user(
            username='inventory_pharmacist',
            password='TestPassword123!',
            role='PHARMASIST',
        )
        self.cashier = User.objects.create_user(
            username='inventory_cashier',
            password='TestPassword123!',
            role='Cashier',
        )

        self.category = Category.objects.create(name='Antibiotiques')
        self.medicine = Medicine.objects.create(
            category=self.category,
            name='Amoxicilline',
            dosage='500 mg',
            unit_price='5000.00',
        )
        self.batch = Batch.objects.create(
            medicine=self.medicine,
            batch_number='LOT-PAGE-001',
            quantity_received=50,
            quantity_available=50,
            expiry_date=timezone.localdate() + timedelta(days=365),
            purchase_price='3000.00',
        )

    def test_anonymous_user_is_redirected_to_login(self):
        response = self.client.get(reverse('inventory-page'))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('dashboard-login'), response.url)

    def test_admin_can_access_inventory_page(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse('inventory-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Lots de stock')
        self.assertContains(response, 'Nouveau mouvement')

    def test_stock_manager_can_access_inventory_page(self):
        self.client.force_login(self.stock_manager)

        response = self.client.get(reverse('inventory-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Lots de stock')

    def test_pharmacist_can_access_inventory_page(self):
        self.client.force_login(self.pharmacist)

        response = self.client.get(reverse('inventory-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Lots de stock')

    def test_cashier_cannot_access_inventory_page(self):
        self.client.force_login(self.cashier)

        response = self.client.get(reverse('inventory-page'))

        self.assertEqual(response.status_code, 403)

    def test_movement_page_is_accessible(self):
        self.client.force_login(self.stock_manager)

        response = self.client.get(reverse('inventory-movements-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Historique des mouvements')
        self.assertContains(response, 'Nouveau mouvement de stock')

    def test_low_stock_page_is_accessible(self):
        self.client.force_login(self.stock_manager)

        response = self.client.get(reverse('inventory-low-stock-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Lots en stock faible')

    def test_expired_page_is_accessible(self):
        self.client.force_login(self.stock_manager)

        response = self.client.get(reverse('inventory-expired-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Lots expirés')
