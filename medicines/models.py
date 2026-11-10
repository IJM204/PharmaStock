from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name
class Medicine(models.Model):
    FORM_CHOICES = [
        ('TABLET', 'comprimé'),
        ('SYRUP', 'sirop'),
        ('CAPSULE', 'cellule'),
        ('INJECTION', 'injectable'),
        ('CREAM', 'crème'),
        ('OTHERS', 'autres'),
    ]
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='medicines')
    name = models.CharField(max_length=100)
    generic_name = models.CharField(max_length=150, blank=True)
    dosage = models.CharField(max_length=100)
    form = models.CharField(max_length=20, choices=FORM_CHOICES, default='TABLET')
    description = models.TextField(blank=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self):
        return self.name
