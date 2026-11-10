from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from .models import Supplier

User = get_user_model()


class SupplierAPITests(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_test',
            password='password123',
            role='Admin'
        )

        self.stock_manager = User.objects.create_user(
            username='stock_test',
            password='password123',
            role='STOCK_Manager'
        )

        self.pharmacist = User.objects.create_user(
            username='pharmacist_test',
            password='password123',
            role='PHARMASIST'
        )

        self.cashier = User.objects.create_user(
            username='cashier_test',
            password='password123',
            role='Cashier'
        )

        self.supplier = Supplier.objects.create(
            name='Fournisseur Burundi',
            contact_person='Jean',
            phone='+257 79000000',
            email='contact@example.com',
            address='Bujumbura'
        )

        self.url = '/api/suppliers/suppliers/'

    def test_authenticated_user_can_list_suppliers(self):
        self.client.force_authenticate(user=self.pharmacist)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_can_create_supplier(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.url,
            {
                'name': 'Pharma Distribution',
                'contact_person': 'Paul',
                'phone': '+257 79111111',
                'email': 'pharma@example.com',
                'address': 'Bujumbura'
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Supplier.objects.filter(name='Pharma Distribution').exists()
        )

    def test_stock_manager_can_create_supplier(self):
        self.client.force_authenticate(user=self.stock_manager)

        response = self.client.post(
            self.url,
            {
                'name': 'Medical Supply',
                'phone': '+257 79222222'
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_cashier_cannot_create_supplier(self):
        self.client.force_authenticate(user=self.cashier)

        response = self.client.post(
            self.url,
            {
                'name': 'New Supplier',
                'phone': '+257 79333333'
            }
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_user_cannot_list_suppliers(self):
        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED
        )

    def test_stock_manager_can_update_supplier(self):
        self.client.force_authenticate(user=self.stock_manager)

        response = self.client.patch(
            f'{self.url}{self.supplier.id}/',
            {'phone': '+257 79999999'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.supplier.refresh_from_db()
        self.assertEqual(self.supplier.phone, '+257 79999999')
