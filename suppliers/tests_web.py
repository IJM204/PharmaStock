"""Tests des pages HTML du module Fournisseurs."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from suppliers.models import Supplier


User = get_user_model()


class SupplierPageTests(TestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='supplier_admin',
            password='TestPassword123!',
            role='Admin',
        )
        self.stock_manager = User.objects.create_user(
            username='supplier_stock',
            password='TestPassword123!',
            role='STOCK_Manager',
        )
        self.pharmacist = User.objects.create_user(
            username='supplier_pharmacist',
            password='TestPassword123!',
            role='PHARMASIST',
        )
        self.cashier = User.objects.create_user(
            username='supplier_cashier',
            password='TestPassword123!',
            role='Cashier',
        )

        Supplier.objects.create(
            name='Pharma Distribution',
            contact_person='Jean Dupont',
            phone='+257 79000000',
            email='contact@example.com',
            address='Bujumbura',
        )

    def test_anonymous_user_is_redirected_to_login(self):
        response = self.client.get(reverse('suppliers-page'))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('dashboard-login'), response.url)

    def test_admin_can_access_suppliers_page(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse('suppliers-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Liste des fournisseurs')
        self.assertContains(response, 'Nouveau fournisseur')

    def test_stock_manager_can_access_suppliers_page(self):
        self.client.force_login(self.stock_manager)

        response = self.client.get(reverse('suppliers-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Nouveau fournisseur')

    def test_pharmacist_cannot_access_suppliers_page(self):
        self.client.force_login(self.pharmacist)

        response = self.client.get(reverse('suppliers-page'))

        self.assertEqual(response.status_code, 403)

    def test_cashier_cannot_access_suppliers_page(self):
        self.client.force_login(self.cashier)

        response = self.client.get(reverse('suppliers-page'))

        self.assertEqual(response.status_code, 403)
