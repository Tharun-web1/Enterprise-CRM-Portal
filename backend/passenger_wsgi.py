import os
import sys

# Add the project root directory to sys.path
cwd = os.path.dirname(os.path.abspath(__file__))
if cwd not in sys.path:
    sys.path.insert(0, cwd)

# Set up Django settings module environment variable
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'crm_backend.settings')

# Load Django WSGI Application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()

