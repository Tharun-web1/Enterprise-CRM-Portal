import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'crm_backend.settings')
django.setup()

from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from api.models import User, Client, Project, ProjectMember, Task, Invoice, Payment, SupportRequest

# ==============================================================================
# SECURITY NOTICE:
# This script is strictly intended for local development and QA staging testing.
# Default demo credentials should NEVER be used in a live production environment.
# Passwords can be customized via SEED_ADMIN_PASSWORD, SEED_LEAD_PASSWORD,
# and SEED_DEV_PASSWORD environment variables.
# ==============================================================================

def seed_database():
    # Production Safety Guard
    if not settings.DEBUG and os.environ.get('ALLOW_SEED_DB', '').lower() not in ('1', 'true', 'yes'):
        print("\n[SECURITY ERROR] seed_db.py is disabled when DEBUG=False to protect live databases.")
        print("To override this guard on staging, set ALLOW_SEED_DB=true in your environment.\n")
        sys.exit(1)

    admin_password = os.environ.get('SEED_ADMIN_PASSWORD', '*******')
    lead_password = os.environ.get('SEED_LEAD_PASSWORD', '******')
    dev_password = os.environ.get('SEED_DEV_PASSWORD', '******')

    print("Resetting and seeding database with initial demo data...")
    
    # Clean existing data
    SupportRequest.objects.all().delete()
    Payment.objects.all().delete()
    Invoice.objects.all().delete()
    Task.objects.all().delete()
    ProjectMember.objects.all().delete()
    Project.objects.all().delete()
    Client.objects.all().delete()
    User.objects.exclude(is_superuser=True).delete()

    # 1. Create Users
    manager = User.objects.create_user(
        username='manager',
        email='manager@crm.com',
        password=admin_password,
        first_name='Alex',
        last_name='Morgan',
        role='MANAGER',
        phone='+1-555-0100',
        designation='General Manager',
        department='Executive'
    )
    manager.is_staff = True
    manager.is_superuser = True
    manager.save()

    lead1 = User.objects.create_user(
        username='teamlead1',
        email='lead@crm.com',
        password=lead_password,
        first_name='Sarah',
        last_name='Connor',
        role='TEAM_LEAD',
        phone='+1-555-0101',
        designation='Senior Tech Lead',
        department='Engineering'
    )

    lead2 = User.objects.create_user(
        username='teamlead2',
        email='lead2@crm.com',
        password=lead_password,
        first_name='David',
        last_name='Miller',
        role='TEAM_LEAD',
        phone='+1-555-0102',
        designation='Product Lead',
        department='Product'
    )

    emp1 = User.objects.create_user(
        username='employee1',
        email='dev1@crm.com',
        password=dev_password,
        first_name='James',
        last_name='Wilson',
        role='EMPLOYEE',
        phone='+1-555-0103',
        designation='Fullstack Engineer',
        department='Engineering'
    )

    emp2 = User.objects.create_user(
        username='employee2',
        email='dev2@crm.com',
        password=dev_password,
        first_name='Elena',
        last_name='Rostova',
        role='EMPLOYEE',
        phone='+1-555-0104',
        designation='Backend Engineer',
        department='Engineering'
    )

    emp3 = User.objects.create_user(
        username='employee3',
        email='designer1@crm.com',
        password=dev_password,
        first_name='Marcus',
        last_name='Vance',
        role='EMPLOYEE',
        phone='+1-555-0105',
        designation='UI/UX Specialist',
        department='Design'
    )

    print("Created 6 User accounts.")

    # 2. Create Clients & Leads
    client1 = Client.objects.create(
        name='Enterprise Acme Corp',
        company='Acme Global Inc.',
        email='contact@acme.com',
        phone='+1-800-555-2263',
        status='ACTIVE',
        address='100 Silicon Valley Way, CA',
        notes='Key enterprise client for cloud services.'
    )

    client2 = Client.objects.create(
        name='Global Tech Solutions',
        company='GlobalTech LLC',
        email='billing@globaltech.io',
        phone='+1-800-555-9988',
        status='ACTIVE',
        address='45 Wall Street, NY',
        notes='Long term client for mobile portal development.'
    )

    lead1_obj = Client.objects.create(
        name='Nexus Innovations',
        company='Nexus Labs',
        email='info@nexuslabs.ai',
        phone='+1-800-555-3344',
        status='LEAD',
        address='Austin Tech Hub, TX',
        notes='Inquired about web portal re-architecture.'
    )

    lead2_obj = Client.objects.create(
        name='Apex Retail Systems',
        company='Apex Retail',
        email='sales@apexretail.com',
        phone='+1-800-555-7711',
        status='LEAD',
        address='Chicago Commerce Center, IL',
        notes='Interested in CRM integration package.'
    )

    print("Created 4 Clients (2 Active, 2 Leads).")

    # 3. Create Projects
    proj1 = Project.objects.create(
        title='Cloud Portal Migration',
        description='Migrate legacy client infrastructure to containerized microservices and modern React dashboard.',
        client=client1,
        team_lead=lead1,
        status='ACTIVE',
        start_date=timezone.now().date() - timedelta(days=30),
        end_date=timezone.now().date() + timedelta(days=60),
        budget=45000.00
    )

    proj2 = Project.objects.create(
        title='Mobile CRM App Development',
        description='Cross-platform mobile client for sales field team with offline data sync.',
        client=client2,
        team_lead=lead1,
        status='ACTIVE',
        start_date=timezone.now().date() - timedelta(days=15),
        end_date=timezone.now().date() + timedelta(days=45),
        budget=32000.00
    )

    proj3 = Project.objects.create(
        title='E-Commerce Re-Platforming',
        description='Redesign checkout pipeline and payment gateway integrations.',
        client=lead1_obj,
        team_lead=lead2,
        status='PLANNING',
        start_date=timezone.now().date(),
        end_date=timezone.now().date() + timedelta(days=90),
        budget=58000.00
    )

    print("Created 3 Projects.")

    # 4. Project Team Allocations ("Hired to team")
    ProjectMember.objects.create(project=proj1, employee=emp1, role_in_team='Lead Frontend Developer')
    ProjectMember.objects.create(project=proj1, employee=emp3, role_in_team='UI/UX Designer')

    ProjectMember.objects.create(project=proj2, employee=emp2, role_in_team='Backend API Developer')

    print("Assigned employees to projects.")

    # 5. Create Tasks
    task1 = Task.objects.create(
        title='Design Authentication & JWT System',
        description='Implement Django REST Framework SimpleJWT endpoints with role token claims.',
        project=proj1,
        assigned_to=emp1,
        assigned_by=lead1,
        status='COMPLETED',
        priority='HIGH',
        due_date=timezone.now().date() - timedelta(days=5),
        completion_report='JWT auth endpoints implemented successfully with 100% test coverage.',
        hours_logged=12.50
    )

    task2 = Task.objects.create(
        title='Build Glassmorphic Dashboard Layout',
        description='Create responsive glassmorphic cards, dynamic sidebar navigation, and KPI badges in React.',
        project=proj1,
        assigned_to=emp1,
        assigned_by=lead1,
        status='IN_PROGRESS',
        priority='URGENT',
        due_date=timezone.now().date() + timedelta(days=3),
        completion_report='Sidebar and metric cards designed. Currently working on table filter tabs.',
        hours_logged=18.00
    )

    task3 = Task.objects.create(
        title='Figma Mockup for Client Portal',
        description='Prepare interactive wireframes and design tokens for client feedback.',
        project=proj1,
        assigned_to=emp3,
        assigned_by=lead1,
        status='IN_REVIEW',
        priority='MEDIUM',
        due_date=timezone.now().date() + timedelta(days=2),
        completion_report='Figma link sent to Team Lead for review.',
        hours_logged=14.00
    )

    task4 = Task.objects.create(
        title='Setup SQLite Database & Data Models',
        description='Configure Django models for Clients, Projects, Tasks, Invoices, and Support Requests.',
        project=proj2,
        assigned_to=emp2,
        assigned_by=lead1,
        status='COMPLETED',
        priority='HIGH',
        due_date=timezone.now().date() - timedelta(days=2),
        completion_report='Models and migrations executed.',
        hours_logged=10.00
    )

    print("Created 4 Tasks across projects.")

    # 6. Invoices & Payments
    inv1 = Invoice.objects.create(
        invoice_number='INV-2026-001',
        client=client1,
        project=proj1,
        amount=15000.00,
        tax_rate=10.00,
        total_amount=16500.00,
        status='PAID',
        due_date=timezone.now().date() - timedelta(days=10)
    )

    Payment.objects.create(
        invoice=inv1,
        amount=16500.00,
        payment_method='BANK_TRANSFER',
        transaction_id='TXN-9988112233',
        notes='Full payment received on time.'
    )

    inv2 = Invoice.objects.create(
        invoice_number='INV-2026-002',
        client=client2,
        project=proj2,
        amount=12000.00,
        tax_rate=10.00,
        total_amount=13200.00,
        status='UNPAID',
        due_date=timezone.now().date() + timedelta(days=15)
    )

    print("Created Invoices and Payment records.")

    # 7. Support Requests
    SupportRequest.objects.create(
        ticket_id='TICK-101',
        subject='SSL Certificate Renewal on Staging Server',
        description='Client reported browser security warning on test environment link.',
        client=client1,
        assigned_to=lead1,
        priority='HIGH',
        status='IN_PROGRESS'
    )

    SupportRequest.objects.create(
        ticket_id='TICK-102',
        subject='Request for Monthly Billing Export',
        description='Need automated PDF or CSV invoice statement generator.',
        client=client2,
        assigned_to=manager,
        priority='LOW',
        status='OPEN'
    )

    print("Created Support Tickets.")
    print("\nDatabase seeding completed successfully!")
    print("--------------------------------------------------")
    print("Demo User Credentials (Dev/Staging Only):")
    print(f"  Manager:   manager   / {admin_password}  (or manager@crm.com)")
    print(f"  Team Lead: teamlead1 / {lead_password}   (or lead@crm.com)")
    print(f"  Employee:  employee1 / {dev_password}    (or dev1@crm.com)")
    print("  Note: Passwords can be overridden via SEED_ADMIN_PASSWORD,")
    print("        SEED_LEAD_PASSWORD, and SEED_DEV_PASSWORD environment variables.")
    print("--------------------------------------------------")

if __name__ == '__main__':
    seed_database()
