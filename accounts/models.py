from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = [
        ('Admin','administrateur'),
        ('Cashier','caissier'),
        ('STOCK_Manager','gestionnaire de stock'),
        ('PHARMASIST','pharmacien'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='PHARMASIST')
    def __str__(self):
        return self.username
