from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status

from .models import Category, Medicine

User = get_user_model()


class MedicineAPITests(APITestCase):

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

        self.category = Category.objects.create(
            name='Antibiotiques',
            description='Médicaments antibiotiques'
        )

        self.medicine = Medicine.objects.create(
            category=self.category,
            name='Amoxicilline',
            dosage='500 mg',
            unit_price=5000
        )

        self.category_url = '/api/medicines/categories/'
        self.medicine_url = '/api/medicines/medicines/'

    def test_admin_can_create_category(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.category_url,
            {
                'name': 'Antalgiques',
                'description': 'Médicaments contre la douleur'
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_authenticated_user_can_list_categories(self):
        self.client.force_authenticate(user=self.pharmacist)

        response = self.client.get(self.category_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_cashier_cannot_create_category(self):
        self.client.force_authenticate(user=self.cashier)

        response = self.client.post(
            self.category_url,
            {'name': 'Nouvelle catégorie'}
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cashier_cannot_create_medicine(self):
        self.client.force_authenticate(user=self.cashier)

        response = self.client.post(
            self.medicine_url,
            {
                'category': self.category.id,
                'name': 'Paracétamol',
                'dosage': '500 mg',
                'unit_price': 3000
            }
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_stock_manager_can_create_medicine(self):
        self.client.force_authenticate(user=self.stock_manager)

        response = self.client.post(
            self.medicine_url,
            {
                'category': self.category.id,
                'name': 'Paracétamol',
                'dosage': '500 mg',
                'unit_price': 3000
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_negative_price_is_rejected(self):
        self.client.force_authenticate(user=self.stock_manager)

        response = self.client.post(
            self.medicine_url,
            {
                'category': self.category.id,
                'name': 'Médicament test',
                'dosage': '250 mg',
                'unit_price': -100
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_category_medicines_count(self):
        self.client.force_authenticate(user=self.pharmacist)

        response = self.client.get(self.category_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['medicines_count'], 1)

    def test_anonymous_user_cannot_list_medicines(self):
        response = self.client.get(self.medicine_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED
        )