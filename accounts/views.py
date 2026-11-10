from django.contrib.auth import update_session_auth_hash
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .permissions import IsPharmaAdmin
from .serializers import (
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserAdminCreateSerializer,
    UserAdminUpdateSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        password_changed = bool(serializer.validated_data.get('password'))
        user = serializer.save()

        if password_changed:
            update_session_auth_hash(request, user)

        return Response(UserSerializer(user).data)


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsPharmaAdmin]

    def get_queryset(self):
        return User.objects.all().order_by('username')


class UserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserAdminCreateSerializer
    permission_classes = [IsPharmaAdmin]


class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    permission_classes = [IsPharmaAdmin]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return UserAdminUpdateSerializer

        return UserSerializer

    def perform_update(self, serializer):
        user = serializer.save()

        if self.request.user == user and self.request.data.get('password'):
            update_session_auth_hash(self.request, user)
