"""Tests des pages HTML du module Médicaments."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from medicines.models import Category, Medicine


User = get_user_model()


class MedicinePageTests(TestCase):
    """Vérifie l'accès aux pages et le rendu des templates."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='page_admin',
            password='TestPassword123!',
            role='Admin',
        )
        self.stock_manager = User.objects.create_user(
            username='page_stock',
            password='TestPassword123!',
            role='STOCK_Manager',
        )
        self.pharmacist = User.objects.create_user(
            username='page_pharmacist',
            password='TestPassword123!',
            role='PHARMASIST',
        )
        self.cashier = User.objects.create_user(
            username='page_cashier',
            password='TestPassword123!',
            role='Cashier',
        )

        self.category = Category.objects.create(
            name='Antalgiques',
            description='Médicaments contre la douleur',
        )
        self.medicine = Medicine.objects.create(
            category=self.category,
            name='Paracétamol',
            generic_name='Paracétamol',
            dosage='500 mg',
            form='TABLET',
            unit_price='1000.00',
        )

    def test_anonymous_user_is_redirected_to_login(self):
        response = self.client.get(reverse('medicines-page'))

        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('dashboard-login'), response.url)

    def test_admin_can_access_medicine_page(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse('medicines-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Catalogue des médicaments')
        self.assertContains(response, 'Nouveau médicament')

    def test_stock_manager_can_access_medicine_page(self):
        self.client.force_login(self.stock_manager)

        response = self.client.get(reverse('medicines-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Nouveau médicament')

    def test_pharmacist_can_view_medicine_page_without_write_buttons(self):
        self.client.force_login(self.pharmacist)

        response = self.client.get(reverse('medicines-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Catalogue des médicaments')
        self.assertNotContains(response, 'Nouveau médicament')

    def test_cashier_cannot_access_medicine_page(self):
        self.client.force_login(self.cashier)

        response = self.client.get(reverse('medicines-page'))

        self.assertEqual(response.status_code, 403)

    def test_admin_can_access_category_page(self):
        self.client.force_login(self.admin)

        response = self.client.get(reverse('medicine-categories-page'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Catégories de médicaments')

    def test_cashier_cannot_access_category_page(self):
        self.client.force_login(self.cashier)

        response = self.client.get(reverse('medicine-categories-page'))

        self.assertEqual(response.status_code, 403)
