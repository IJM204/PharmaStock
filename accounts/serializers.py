from rest_framework import serializers

from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'password',
        ]

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(
        source='get_role_display',
        read_only=True,
    )

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'role_display',
            'is_active',
            'date_joined',
            'last_login',
        ]
        read_only_fields = [
            'id',
            'username',
            'role',
            'role_display',
            'date_joined',
            'last_login',
        ]


class UserAdminCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'is_active',
            'password',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        return User.objects.create_user(
            password=password,
            **validated_data,
        )


class UserAdminUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'is_active',
            'password',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        request = self.context.get('request')
        instance = self.instance
        password = attrs.get('password')

        if password and len(password) < 8:
            raise serializers.ValidationError({
                'password': 'Le mot de passe doit contenir au moins 8 caractères.',
            })

        if not instance or not request:
            return attrs

        new_role = attrs.get('role', instance.role)
        new_is_active = attrs.get('is_active', instance.is_active)

        if instance == request.user:
            if 'role' in attrs and attrs['role'] != instance.role:
                raise serializers.ValidationError({
                    'role': 'Vous ne pouvez pas modifier votre propre rôle.',
                })

            if attrs.get('is_active') is False:
                raise serializers.ValidationError({
                    'is_active': 'Vous ne pouvez pas désactiver votre propre compte.',
                })

        if instance.role == 'Admin' and (
            new_role != 'Admin'
            or not new_is_active
        ):
            other_active_admins = User.objects.filter(
                role='Admin',
                is_active=True,
            ).exclude(pk=instance.pk).exists()

            if not other_active_admins:
                raise serializers.ValidationError({
                    'role': (
                        'Impossible de retirer le dernier administrateur actif.'
                    ),
                })

        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', '')

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


class ProfileUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = User
        fields = [
            'email',
            'first_name',
            'last_name',
            'password',
        ]

    def validate_password(self, value):
        if value and len(value) < 8:
            raise serializers.ValidationError(
                'Le mot de passe doit contenir au moins 8 caractères.'
            )

        return value

    def update(self, instance, validated_data):
        password = validated_data.pop('password', '')

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance
