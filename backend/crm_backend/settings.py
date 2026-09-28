import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env if present
possible_env_files = [
    BASE_DIR / '.env',
    Path.cwd() / '.env',
    Path(__file__).resolve().parent.parent / '.env',
]
for env_f in possible_env_files:
    if env_f.exists():
        with open(env_f, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))
        break

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-crm-secret-key-change-in-production-random-hash')

DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = [
    'demo.rrgobalitservices.com',
    'www.demo.rrgobalitservices.com',
    'rrgobalitservices.com',
    'www.rrgobalitservices.com',
    'demo.ygrgobalitservices.com',
    'www.demo.ygrgobalitservices.com',
    'ygrgobalitservices.com',
    '127.0.0.1',
    'localhost',
    '*'
]

extra_hosts = os.environ.get('ALLOWED_HOSTS')
if extra_hosts:
    for host in extra_hosts.split(','):
        h = host.strip()
        if h and h not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(h)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    
    # Local apps
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'api.middleware.UpdateLastSeenMiddleware',
]

ROOT_URLCONF = 'crm_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'crm_backend.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

AUTH_USER_MODEL = 'api.User'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 4}
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LOGIN_REDIRECT_URL = '/admin/'


CORS_ALLOW_ALL_ORIGINS = True

CORS_ALLOWED_ORIGINS = [
    'https://demo.rrgobalitservices.com',
    'http://demo.rrgobalitservices.com',
    'https://rrgobalitservices.com',
    'http://rrgobalitservices.com',
    'https://demo.ygrgobalitservices.com',
    'http://demo.ygrgobalitservices.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]

CSRF_TRUSTED_ORIGINS = [
    'https://demo.rrgobalitservices.com',
    'http://demo.rrgobalitservices.com',
    'https://rrgobalitservices.com',
    'http://rrgobalitservices.com',
    'https://demo.ygrgobalitservices.com',
    'http://demo.ygrgobalitservices.com',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Email Backend Configuration (Gmail SMTP & Resilient Fallback via Environment)
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '').strip()
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '').strip()
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 465))

if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = EMAIL_PORT
    EMAIL_USE_SSL = (EMAIL_PORT == 465)
    EMAIL_USE_TLS = (EMAIL_PORT == 587)
    EMAIL_TIMEOUT = 10
    DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', f"CRM Operations <{EMAIL_HOST_USER}>")
else:
    # Development Fallback (Console output when credentials are not configured)
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@crmportal.com')

# Media files configuration (Uploaded images and PDF files)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


