from django.template import response
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

from .models import User


class AccountsAPITests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='TestPassword123!'
        )

    def test_user_registration(self):
        """Tester l'inscription d'un nouvel utilisateur."""
        response = self.client.post(
            reverse('register'),
            {
                'username': 'nouveauuser',
                'email': 'nouveau@example.com',
                'password': 'Password123!'
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            User.objects.filter(username='nouveauuser').exists()
        )

        user = User.objects.get(username='nouveauuser')
        self.assertEqual(user.role, 'PHARMASIST')
        self.assertNotIn('password', response.data)

    def test_user_login(self):
        """Tester la connexion et la génération des tokens JWT."""
        response = self.client.post(
            reverse('token_obtain_pair'),
            {
                'username': 'testuser',
                'password': 'TestPassword123!'
            }
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_profile_requires_authentication(self):
        """Un utilisateur non connecté ne peut pas voir son profil."""
        response = self.client.get(reverse('profile'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_can_view_profile(self):
        """Un utilisateur connecté peut consulter son profil."""
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse('profile'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')

    def test_normal_user_cannot_list_users(self):
        """Un utilisateur non administrateur ne peut pas lister les comptes."""
        self.client.force_authenticate(user=self.user)

        response = self.client.get(reverse('user-list'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_users(self):
        """Un administrateur PharmaStock peut lister les comptes."""
        admin_user = User.objects.create_user(
            username='admin',
            password='AdminPassword123!',
            role='Admin'
    )

        self.client.force_authenticate(user=admin_user)

        response = self.client.get(reverse('user-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)