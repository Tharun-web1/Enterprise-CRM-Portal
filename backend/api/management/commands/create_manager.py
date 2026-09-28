import getpass
from django.core.management.base import BaseCommand, CommandError
from api.models import User

class Command(BaseCommand):
    help = 'Creates a new Manager / Admin user account for CRM Portal'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, help='Username for the Manager account')
        parser.add_argument('--email', type=str, help='Email address for the Manager account')
        parser.add_argument('--password', type=str, help='Password for the Manager account')
        parser.add_argument('--first_name', type=str, default='Admin', help='First name')
        parser.add_argument('--last_name', type=str, default='Manager', help='Last name')

    def handle(self, *args, **options):
        username = options.get('username')
        email = options.get('email')
        password = options.get('password')
        first_name = options.get('first_name') or 'Admin'
        last_name = options.get('last_name') or 'Manager'

        self.stdout.write(self.style.MIGRATE_HEADING("--- CRM Portal Manager Account Creator ---"))

        # Interactive Mode if missing required parameters
        if not username:
            username = input("Enter Manager Username [e.g. manager]: ").strip()
            if not username:
                raise CommandError("Username is required.")

        if User.objects.filter(username=username).exists():
            raise CommandError(f"User with username '{username}' already exists.")

        if not email:
            email = input("Enter Manager Email [e.g. manager@domain.com]: ").strip()
            if not email:
                email = f"{username}@crm.com"

        if not password:
            password = getpass.getpass("Enter Manager Password: ").strip()
            confirm_password = getpass.getpass("Confirm Manager Password: ").strip()
            if password != confirm_password:
                raise CommandError("Passwords do not match.")

        if not password:
            raise CommandError("Password cannot be empty.")

        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                role='MANAGER',
                phone='+1-555-0100',
                designation='General Manager',
                department='Executive'
            )
            user.is_staff = True
            user.is_superuser = True
            user.save()

            self.stdout.write(self.style.SUCCESS(
                f"\n[SUCCESS] Manager account '{username}' ({email}) created successfully!"
            ))
            self.stdout.write(self.style.WARNING(
                "You can now log into the CRM Portal dashboard using these credentials.\n"
            ))
        except Exception as e:
            raise CommandError(f"Failed to create Manager user: {str(e)}")
