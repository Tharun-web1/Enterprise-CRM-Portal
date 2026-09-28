import csv
import io
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from django.db.models import Sum, Count, Q
from django.core.files.storage import FileSystemStorage
from django.conf import settings

from .models import (
    User, Client, Project, ProjectImage, ProjectMember, Task, Invoice, Payment, SupportRequest,
    ChatGroup, ChatGroupMember, ChatMessage, CallSession,
    Notification, TaskComment, TaskAttachment, InvoiceItem, Attendance, LeaveRequest
)
from .serializers import (
    UserSerializer, UserCreateSerializer, CustomTokenObtainPairSerializer,
    ClientSerializer, ProjectSerializer, ProjectMemberSerializer,
    TaskSerializer, InvoiceSerializer, PaymentSerializer, SupportRequestSerializer,
    ChatGroupSerializer, ChatGroupMemberSerializer, ChatMessageSerializer, CallSessionSerializer,
    NotificationSerializer, TaskCommentSerializer, TaskAttachmentSerializer, InvoiceItemSerializer,
    AttendanceSerializer, LeaveRequestSerializer
)
from .utils import send_team_allocation_email, send_group_invite_email, send_invoice_issued_email, create_notification


from datetime import timedelta
from django.utils import timezone


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        if self.request.user and self.request.user.is_authenticated:
            User.objects.filter(id=self.request.user.id).update(last_seen=timezone.now())

        queryset = User.objects.all().order_by('-date_joined')
        role = self.request.query_params.get('role', None)
        available_only = self.request.query_params.get('available_only', None)

        if role:
            queryset = queryset.filter(role=role)
        if available_only and available_only.lower() == 'true':
            queryset = queryset.filter(is_available=True)

        return queryset

    @action(detail=False, methods=['post'], url_path='heartbeat')
    def heartbeat(self, request):
        if request.user and request.user.is_authenticated:
            req_data = getattr(request, 'data', None)
            if req_data is None:
                req_data = getattr(request, 'POST', {})
            req_status = req_data.get('status', 'online') if isinstance(req_data, dict) else 'online'
            if req_status == 'offline':
                User.objects.filter(id=request.user.id).update(last_seen=None)
                return Response({'status': 'offline', 'is_online': False})
            else:
                now = timezone.now()
                User.objects.filter(id=request.user.id).update(last_seen=now)
                return Response({'status': 'online', 'is_online': True})
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'], url_path='offline')
    def offline(self, request):
        if request.user and request.user.is_authenticated:
            User.objects.filter(id=request.user.id).update(last_seen=None)
            return Response({'status': 'offline', 'is_online': False})
        return Response({'status': 'ok'})

    @action(detail=False, methods=['get', 'put', 'patch'], url_path='me')
    def me(self, request):
        if request.user and request.user.is_authenticated:
            User.objects.filter(id=request.user.id).update(last_seen=timezone.now())

        if request.method == 'GET':
            return Response(UserSerializer(request.user).data)
        
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not old_password or not new_password:
            return Response({'error': 'Both old_password and new_password are required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not request.user.check_password(old_password):
            return Response({'error': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)
        
        if len(new_password) < 6:
            return Response({'error': 'New password must be at least 6 characters'}, status=status.HTTP_400_BAD_REQUEST)
            
        request.user.set_password(new_password)
        request.user.is_first_login = False
        request.user.save()
        return Response({
            'message': 'Password updated successfully!',
            'user': UserSerializer(request.user).data
        })

    @action(detail=False, methods=['get'], url_path='next-emp-id')
    def next_emp_id(self, request):
        from .utils import generate_next_employee_id
        return Response({'next_employee_id': generate_next_employee_id()})

    @action(detail=False, methods=['post'], url_path='test-email')
    def test_email(self, request):
        """Diagnostic endpoint to verify SMTP credentials and email delivery"""
        recipient = request.data.get('email', request.user.email if request.user else None)
        if not recipient:
            return Response({'error': 'Please provide an email address to test.'}, status=status.HTTP_400_BAD_REQUEST)
        
        from .utils import dispatch_email_with_fallback
        test_subject = "CRM Portal - Email Service Diagnostic Test"
        test_body = f"Hello,\n\nThis is a test message from your CRM Portal running on production.\nIf you received this, your email configuration (Port 465/587) is fully operational!\n\nSent to: {recipient}"
        test_html = f"<div style='font-family:sans-serif;padding:20px;'><h2 style='color:#4f46e5;'>CRM Email Service Test</h2><p>This is a verification email from your CRM platform.</p><p><strong>Status:</strong> Operational</p><p><strong>Recipient:</strong> {recipient}</p></div>"
        
        success = dispatch_email_with_fallback(test_subject, test_body, [recipient], html_message=test_html)
        if success:
            return Response({'status': 'success', 'message': f'Diagnostic email successfully sent to {recipient}'})
        return Response({'status': 'failed', 'message': f'Could not send email to {recipient}. Please check server firewall / credentials.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], url_path='upload-employees')
    def upload_employees(self, request):
        """Bulk import employees from CSV file or raw CSV text with Upsert (Create or Update) support"""
        from .utils import generate_next_employee_id, send_welcome_credentials_email

        csv_file = request.FILES.get('file')
        raw_csv = request.data.get('csv_data')

        if not csv_file and not raw_csv:
            return Response({'error': 'Please provide a CSV file or csv_data text'}, status=status.HTTP_400_BAD_REQUEST)

        if csv_file:
            try:
                data_set = csv_file.read().decode('utf-8-sig')
            except Exception:
                data_set = csv_file.read().decode('latin-1')
        else:
            data_set = raw_csv

        # Auto-detect delimiter (comma, semicolon, tab)
        header_line = data_set.strip().split('\n')[0] if data_set else ''
        if ';' in header_line and ',' not in header_line:
            delim = ';'
        elif '\t' in header_line and ',' not in header_line:
            delim = '\t'
        else:
            delim = ','

        io_string = io.StringIO(data_set)
        reader = csv.DictReader(io_string, delimiter=delim)

        created_count = 0
        updated_count = 0
        errors = []

        for row in reader:
            if not row:
                continue

            # Normalize dictionary keys: strip BOM, whitespace, lowercase, spaces/dashes to underscores
            cleaned_row = {}
            for k, v in row.items():
                if k is not None:
                    norm_key = k.strip().lstrip('\ufeff').lower().replace(' ', '_').replace('-', '_')
                    cleaned_row[norm_key] = v.strip() if v else ''

            # Extract username (Employee ID)
            username = (
                cleaned_row.get('username') or 
                cleaned_row.get('emp_id') or 
                cleaned_row.get('employee_id') or
                cleaned_row.get('user_id')
            )

            # Extract email (with alias fallbacks)
            email = (
                cleaned_row.get('email') or 
                cleaned_row.get('e_mail') or 
                cleaned_row.get('mail') or
                cleaned_row.get('email_address')
            )

            if not username or username.strip() == '':
                username = generate_next_employee_id()

            if not email or email.strip() == '':
                email = f"{username.lower()}@crm.com"

            # Extract names
            first_name = cleaned_row.get('first_name') or cleaned_row.get('firstname') or cleaned_row.get('given_name') or ''
            last_name = cleaned_row.get('last_name') or cleaned_row.get('lastname') or cleaned_row.get('surname') or ''

            if not first_name and not last_name:
                full_name = cleaned_row.get('name') or cleaned_row.get('full_name') or cleaned_row.get('employee_name') or ''
                if full_name:
                    name_parts = full_name.split(' ', 1)
                    first_name = name_parts[0]
                    last_name = name_parts[1] if len(name_parts) > 1 else ''

            phone = cleaned_row.get('phone') or cleaned_row.get('mobile') or cleaned_row.get('contact') or ''
            designation = cleaned_row.get('designation') or cleaned_row.get('job_title') or cleaned_row.get('title') or 'Software Engineer'
            department = cleaned_row.get('department') or cleaned_row.get('dept') or 'Engineering'
            
            # Normalize Role
            raw_role = cleaned_row.get('role') or cleaned_row.get('user_role') or 'EMPLOYEE'
            raw_role_str = str(raw_role).upper().replace(' ', '_')
            if 'MANAGER' in raw_role_str or 'ADMIN' in raw_role_str:
                role = 'MANAGER'
            elif 'LEAD' in raw_role_str:
                role = 'TEAM_LEAD'
            else:
                role = 'EMPLOYEE'

            exp_years = cleaned_row.get('experience_years') or cleaned_row.get('experience') or cleaned_row.get('exp') or '2'
            password = cleaned_row.get('password') or cleaned_row.get('pass') or 'emp12345'
            parsed_exp = int(exp_years) if str(exp_years).isdigit() else 2

            # Check if user exists by email OR username -> UPSERT
            existing_user = User.objects.filter(email=email).first() or User.objects.filter(username=username).first()

            if existing_user:
                # Update existing employee profile
                try:
                    if first_name: existing_user.first_name = first_name
                    if last_name: existing_user.last_name = last_name
                    if designation: existing_user.designation = designation
                    if department: existing_user.department = department
                    if phone: existing_user.phone = phone
                    if role: existing_user.role = role
                    existing_user.experience_years = parsed_exp
                    existing_user.save()
                    updated_count += 1
                except Exception as e:
                    errors.append(f"Failed to update user ({email}): {str(e)}")
            else:
                # Create brand new employee
                try:
                    user = User.objects.create_user(
                        username=username,
                        email=email,
                        password=password,
                        first_name=first_name,
                        last_name=last_name,
                        role=role,
                        phone=phone,
                        designation=designation,
                        department=department,
                        experience_years=parsed_exp
                    )
                    created_count += 1
                    send_welcome_credentials_email(user, password)
                except Exception as e:
                    errors.append(f"Failed to create user ({email}): {str(e)}")

        total_processed = created_count + updated_count
        msg_parts = []
        if created_count > 0: msg_parts.append(f"{created_count} created")
        if updated_count > 0: msg_parts.append(f"{updated_count} updated")
        detail_msg = f" ({', '.join(msg_parts)})" if msg_parts else ""

        return Response({
            'message': f"Successfully processed {total_processed} employee(s){detail_msg}.",
            'errors': errors,
            'count': total_processed
        }, status=status.HTTP_200_OK)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by('-created_at')
    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Client.objects.all().order_by('-created_at')
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    @action(detail=True, methods=['post'], url_path='convert-to-client')
    def convert_to_client(self, request, pk=None):
        client = self.get_object()
        client.status = 'ACTIVE'
        client.save()
        return Response({'message': f"Client '{client.name}' is now an Active Client.", 'client': ClientSerializer(client).data})


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created_at')
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Project.objects.all().order_by('-created_at')

        if user.role == 'TEAM_LEAD':
            queryset = queryset.filter(team_lead=user)
        elif user.role == 'EMPLOYEE':
            queryset = queryset.filter(members__employee=user)
        
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        return queryset.distinct()

    def perform_create(self, serializer):
        project = serializer.save()
        self._handle_files(project, self.request)

    def perform_update(self, serializer):
        project = serializer.save()
        self._handle_files(project, self.request)
        if project.status == 'COMPLETED':
            for member in project.members.all():
                emp = member.employee
                other_active = ProjectMember.objects.filter(
                    employee=emp, 
                    project__status='ACTIVE'
                ).exclude(project=project).exists()
                if not other_active:
                    emp.is_available = True
                    emp.save()

    def _handle_files(self, project, request):
        if 'pdf_file' in request.FILES:
            project.pdf_file = request.FILES['pdf_file']
            project.save()

        images = request.FILES.getlist('images')
        if not images:
            images = [request.FILES[key] for key in request.FILES if key.startswith('image_')]

        existing_count = project.images.count()
        remaining_slots = max(0, 5 - existing_count)

        for img_file in images[:remaining_slots]:
            ProjectImage.objects.create(project=project, image=img_file)

    @action(detail=True, methods=['post'], url_path='delete-image')
    def delete_image(self, request, pk=None):
        project = self.get_object()
        image_id = request.data.get('image_id')
        if image_id:
            ProjectImage.objects.filter(id=image_id, project=project).delete()
        return Response({'message': 'Image deleted', 'project': ProjectSerializer(project, context={'request': request}).data})

    @action(detail=True, methods=['post'], url_path='delete-pdf')
    def delete_pdf(self, request, pk=None):
        project = self.get_object()
        if project.pdf_file:
            project.pdf_file.delete(save=False)
            project.pdf_file = None
            project.save()
        return Response({'message': 'PDF document removed', 'project': ProjectSerializer(project, context={'request': request}).data})

    @action(detail=True, methods=['post'], url_path='assign-lead')
    def assign_lead(self, request, pk=None):
        project = self.get_object()
        lead_id = request.data.get('team_lead_id')
        if not lead_id:
            return Response({'error': 'team_lead_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            lead = User.objects.get(id=lead_id, role='TEAM_LEAD')
            project.team_lead = lead
            project.save()

            # In-app notification to Team Lead
            create_notification(
                recipient=lead,
                sender=request.user if request.user.is_authenticated else None,
                title=f"Assigned as Team Lead: {project.title}",
                message=f"You have been assigned to lead project '{project.title}'.",
                notification_type='PROJECT_MEMBER_ADDED',
                link_tab='projects',
                reference_id=project.id
            )

            return Response({'message': f"Project assigned to {lead.get_full_name() or lead.username}", 'project': ProjectSerializer(project).data})
        except User.DoesNotExist:
            return Response({'error': 'Invalid Team Lead user'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='add-member')
    def add_member(self, request, pk=None):
        project = self.get_object()
        employee_id = request.data.get('employee_id')
        role_in_team = request.data.get('role_in_team', 'Team Member')

        if not employee_id:
            return Response({'error': 'employee_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = User.objects.get(id=employee_id, role='EMPLOYEE')
            
            # Check if employee is already assigned to another active project
            other_active_assignments = ProjectMember.objects.filter(
                employee=employee, 
                project__status='ACTIVE'
            ).exclude(project=project).exists()

            if other_active_assignments:
                return Response(
                    {'error': f'Employee {employee.get_full_name() or employee.username} is already active in another project.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            member, created = ProjectMember.objects.get_or_create(
                project=project,
                employee=employee,
                defaults={'role_in_team': role_in_team}
            )
            if not created:
                member.role_in_team = role_in_team
                member.save()

            # Mark employee as unavailable for other projects
            employee.is_available = False
            employee.save()

            # 1. Dispatch Formal Team Allocation Email
            send_team_allocation_email(project, employee, role_in_team, request.user)

            # 2. In-app notification to Employee
            create_notification(
                recipient=employee,
                sender=request.user if request.user.is_authenticated else None,
                title=f"Allocated to Project: {project.title}",
                message=f"You have been added to team for '{project.title}' as {role_in_team}.",
                notification_type='PROJECT_MEMBER_ADDED',
                link_tab='projects',
                reference_id=project.id
            )

            # 3. Get or Create Project Chat Group & Add Members
            chat_group, _ = ChatGroup.objects.get_or_create(
                project=project,
                group_type='PROJECT',
                defaults={
                    'name': f"📁 Team: {project.title}",
                    'description': f"Official team communication channel for {project.title}",
                    'created_by': request.user if request.user.is_authenticated else None
                }
            )

            if request.user.is_authenticated:
                ChatGroupMember.objects.get_or_create(group=chat_group, user=request.user, defaults={'role': 'ADMIN', 'status': 'JOINED'})
            
            ChatGroupMember.objects.get_or_create(group=chat_group, user=employee, defaults={'role': 'MEMBER', 'status': 'JOINED'})

            # 4. Post System Bot Announcement Message
            lead_name = request.user.get_full_name() or request.user.username if request.user.is_authenticated else "Team Lead"
            emp_name = employee.get_full_name() or employee.username
            ChatMessage.objects.create(
                group=chat_group,
                sender=None,
                message_text=f"🎉 {emp_name} was hired into the project team as '{role_in_team}' by {lead_name}.",
                is_system_message=True
            )

            return Response({
                'message': f"Added {emp_name} to team. Formal allocation email sent & added to Project Chat Channel.",
                'project': ProjectSerializer(project).data
            })
        except User.DoesNotExist:
            return Response({'error': 'Employee not found'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='remove-member')
    def remove_member(self, request, pk=None):
        project = self.get_object()
        employee_id = request.data.get('employee_id')
        if not employee_id:
            return Response({'error': 'employee_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            employee = User.objects.get(id=employee_id, role='EMPLOYEE')
            deleted_count, _ = ProjectMember.objects.filter(project=project, employee=employee).delete()

            if deleted_count > 0:
                # Restore employee availability if not in any other active project
                other_active = ProjectMember.objects.filter(
                    employee=employee, 
                    project__status='ACTIVE'
                ).exclude(project=project).exists()

                if not other_active:
                    employee.is_available = True
                    employee.save()

                # Unassign incomplete tasks assigned to this employee on this project
                Task.objects.filter(
                    project=project,
                    assigned_to=employee
                ).exclude(status='COMPLETED').update(assigned_to=None)

                # In-app notification to employee
                create_notification(
                    recipient=employee,
                    sender=request.user if request.user.is_authenticated else None,
                    title=f"Removed from Project Team: {project.title}",
                    message=f"You have been released from '{project.title}'.",
                    notification_type='PROJECT_MEMBER_ADDED',
                    link_tab='projects',
                    reference_id=project.id
                )

                # Chat System Announcement
                chat_group = ChatGroup.objects.filter(project=project, group_type='PROJECT').first()
                if chat_group:
                    lead_name = request.user.get_full_name() or request.user.username if request.user.is_authenticated else "Team Lead"
                    emp_name = employee.get_full_name() or employee.username
                    ChatMessage.objects.create(
                        group=chat_group,
                        sender=None,
                        message_text=f"ℹ️ {emp_name} was removed from the project team by {lead_name}.",
                        is_system_message=True
                    )

                return Response({
                    'message': f"Removed {employee.get_full_name() or employee.username} from team.",
                    'project': ProjectSerializer(project, context={'request': request}).data
                })
            else:
                return Response({'error': 'Employee is not a member of this project team.'}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=status.HTTP_404_NOT_FOUND)


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all().order_by('-created_at')
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Task.objects.all().order_by('-created_at')

        if user.role == 'TEAM_LEAD':
            queryset = queryset.filter(Q(assigned_by=user) | Q(project__team_lead=user))
        elif user.role == 'EMPLOYEE':
            queryset = queryset.filter(assigned_to=user)

        project_id = self.request.query_params.get('project', None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.distinct()

    def perform_create(self, serializer):
        task = serializer.save(assigned_by=self.request.user)
        if task.assigned_to:
            create_notification(
                recipient=task.assigned_to,
                sender=self.request.user,
                title="New Task Assigned",
                message=f"You have been assigned to task '{task.title}' in project '{task.project.title}'.",
                notification_type='TASK_ASSIGNED',
                link_tab='tasks',
                reference_id=task.id
            )

    def perform_update(self, serializer):
        old_assigned_to = self.get_object().assigned_to
        task = serializer.save()
        if old_assigned_to != task.assigned_to and task.assigned_to:
            create_notification(
                recipient=task.assigned_to,
                sender=self.request.user,
                title="Task Assigned to You",
                message=f"Task '{task.title}' was reassigned to you in project '{task.project.title}'.",
                notification_type='TASK_ASSIGNED',
                link_tab='tasks',
                reference_id=task.id
            )
            try:
                chat_group = ChatGroup.objects.filter(project=task.project, group_type='PROJECT').first()
                if chat_group:
                    updater_name = self.request.user.get_full_name() or self.request.user.username if self.request.user.is_authenticated else "Team Lead"
                    new_emp_name = task.assigned_to.get_full_name() or task.assigned_to.username if task.assigned_to else "Unassigned"
                    ChatMessage.objects.create(
                        group=chat_group,
                        sender=None,
                        message_text=f"🔄 Task '{task.title}' was reassigned to {new_emp_name} by {updater_name}.",
                        is_system_message=True
                    )
            except Exception:
                pass

    @action(detail=True, methods=['post'], url_path='report-task', parser_classes=[MultiPartParser, FormParser, JSONParser])
    def report_task(self, request, pk=None):
        task = self.get_object()
        task_status = request.data.get('status')
        completion_report = request.data.get('completion_report')
        hours_logged = request.data.get('hours_logged')
        requirements_needed = request.data.get('requirements_needed')
        reporter_name = request.data.get('reporter_name')
        reporter_email = request.data.get('reporter_email')
        reporter_phone = request.data.get('reporter_phone')
        visited_person_name = request.data.get('visited_person_name')
        visited_person_email = request.data.get('visited_person_email')
        visited_person_phone = request.data.get('visited_person_phone')
        visited_person_company = request.data.get('visited_person_company')

        if task_status:
            task.status = task_status
        if completion_report is not None:
            task.completion_report = completion_report
        if requirements_needed is not None:
            task.requirements_needed = requirements_needed
        if reporter_name:
            task.reporter_name = reporter_name
        if reporter_email:
            task.reporter_email = reporter_email
        if reporter_phone:
            task.reporter_phone = reporter_phone
        if visited_person_name is not None:
            task.visited_person_name = visited_person_name
        if visited_person_email is not None:
            task.visited_person_email = visited_person_email
        if visited_person_phone is not None:
            task.visited_person_phone = visited_person_phone
        if visited_person_company is not None:
            task.visited_person_company = visited_person_company

        if hours_logged is not None and str(hours_logged).strip() != '':
            try:
                task.hours_logged = float(hours_logged)
            except (ValueError, TypeError):
                pass

        if 'selfie_image' in request.FILES:
            task.selfie_image = request.FILES['selfie_image']

        task.save()

        # Send in-app notification to task creator / team lead
        lead_or_creator = task.assigned_by or (task.project.team_lead if task.project else None)
        if lead_or_creator and lead_or_creator != request.user:
            emp_name = request.user.get_full_name() or request.user.username
            create_notification(
                recipient=lead_or_creator,
                sender=request.user,
                title=f"Report Submitted for '{task.title}'",
                message=f"{emp_name} submitted task report ({task.get_status_display()}).",
                notification_type='TASK_STATUS_CHANGED',
                link_tab='tasks',
                reference_id=task.id
            )

        # Send system chat notification if project channel exists
        try:
            chat_group = ChatGroup.objects.filter(project=task.project, group_type='PROJECT').first()
            if chat_group:
                emp_name = request.user.get_full_name() or request.user.username if request.user.is_authenticated else "Employee"
                status_display = task.get_status_display()
                extra_note = f" (Requirements requested: {requirements_needed[:40]}...)" if requirements_needed else ""
                ChatMessage.objects.create(
                    group=chat_group,
                    sender=None,
                    message_text=f"📝 {emp_name} submitted report for task '{task.title}' ({status_display}){extra_note}.",
                    is_system_message=True
                )
        except Exception:
            pass

        return Response({'message': 'Task report submitted successfully', 'task': TaskSerializer(task, context={'request': request}).data})

    @action(detail=True, methods=['post'], url_path='review-task')
    def review_task(self, request, pk=None):
        task = self.get_object()
        action_type = request.data.get('action') # 'APPROVE' or 'REVISE'
        feedback_notes = request.data.get('review_feedback', '')
        new_assigned_to_id = request.data.get('assigned_to')
        new_priority = request.data.get('priority')

        if action_type == 'APPROVE':
            task.status = 'COMPLETED'
            task.review_feedback = feedback_notes or 'Approved by Team Lead.'
        else:
            task.status = 'NEEDS_REVISION'
            task.review_feedback = feedback_notes

        if new_assigned_to_id:
            try:
                new_emp = User.objects.get(id=new_assigned_to_id, role='EMPLOYEE')
                task.assigned_to = new_emp
            except User.DoesNotExist:
                pass

        if new_priority:
            task.priority = new_priority

        task.save()

        # In-app notification to employee
        if task.assigned_to and task.assigned_to != request.user:
            action_label = "Approved 🎉" if action_type == 'APPROVE' else "Revision Needed ⚠️"
            create_notification(
                recipient=task.assigned_to,
                sender=request.user,
                title=f"Task {action_label}",
                message=f"Your task '{task.title}' was reviewed. Feedback: {task.review_feedback or 'None'}",
                notification_type='TASK_STATUS_CHANGED',
                link_tab='tasks',
                reference_id=task.id
            )

        # Send system chat notification if project group chat exists
        try:
            chat_group = ChatGroup.objects.filter(project=task.project, group_type='PROJECT').first()
            if chat_group:
                lead_name = request.user.get_full_name() or request.user.username if request.user.is_authenticated else "Team Lead"
                emp_name = task.assigned_to.get_full_name() or task.assigned_to.username if task.assigned_to else "Unassigned"
                if action_type == 'APPROVE':
                    msg_text = f"✅ Task '{task.title}' was approved & marked as COMPLETED by {lead_name}."
                else:
                    msg_text = f"⚠️ Task '{task.title}' requires revision (assigned to {emp_name}). Feedback: {feedback_notes}"
                
                ChatMessage.objects.create(
                    group=chat_group,
                    sender=None,
                    message_text=msg_text,
                    is_system_message=True
                )
        except Exception:
            pass

        return Response({
            'message': f"Task successfully {'approved' if action_type == 'APPROVE' else 'marked for revision & reassigned'}.",
            'task': TaskSerializer(task, context={'request': request}).data
        })

    @action(detail=True, methods=['post'], url_path='add-comment')
    def add_comment(self, request, pk=None):
        task = self.get_object()
        comment_text = request.data.get('comment')
        if not comment_text or not comment_text.strip():
            return Response({'error': 'Comment text is required.'}, status=status.HTTP_400_BAD_REQUEST)

        comment = TaskComment.objects.create(
            task=task,
            author=request.user,
            comment=comment_text.strip()
        )

        # Notify other party
        target_user = task.assigned_by if request.user == task.assigned_to else task.assigned_to
        if target_user and target_user != request.user:
            author_name = request.user.get_full_name() or request.user.username
            create_notification(
                recipient=target_user,
                sender=request.user,
                title=f"New comment on '{task.title}'",
                message=f"{author_name}: {comment_text[:80]}",
                notification_type='TASK_COMMENT',
                link_tab='tasks',
                reference_id=task.id
            )

        return Response(TaskCommentSerializer(comment, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='upload-attachment', parser_classes=[MultiPartParser, FormParser])
    def upload_attachment(self, request, pk=None):
        task = self.get_object()
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        size_bytes = uploaded_file.size
        if size_bytes < 1024 * 1024:
            size_str = f"{round(size_bytes / 1024, 1)} KB"
        else:
            size_str = f"{round(size_bytes / (1024 * 1024), 1)} MB"

        att = TaskAttachment.objects.create(
            task=task,
            uploaded_by=request.user,
            file=uploaded_file,
            file_name=uploaded_file.name,
            file_size=size_str
        )
        return Response(TaskAttachmentSerializer(att, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='delete-attachment/(?P<attachment_id>[^/.]+)')
    def delete_attachment(self, request, pk=None, attachment_id=None):
        task = self.get_object()
        try:
            att = TaskAttachment.objects.get(id=attachment_id, task=task)
            if request.user == att.uploaded_by or request.user.role in ['MANAGER', 'TEAM_LEAD']:
                att.delete()
                return Response({'message': 'Attachment deleted successfully.'})
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        except TaskAttachment.DoesNotExist:
            return Response({'error': 'Attachment not found.'}, status=status.HTTP_404_NOT_FOUND)



class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().order_by('-issue_date')
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        invoice = serializer.save()
        items_data = self.request.data.get('items', [])
        if isinstance(items_data, list) and len(items_data) > 0:
            for itm in items_data:
                desc = itm.get('description', 'Service')
                try:
                    qty = float(itm.get('quantity', 1))
                    price = float(itm.get('unit_price', 0))
                except (ValueError, TypeError):
                    continue
                InvoiceItem.objects.create(
                    invoice=invoice,
                    description=desc,
                    quantity=qty,
                    unit_price=price,
                    total=round(qty * price, 2)
                )
            items_sum = sum(i.total for i in invoice.items.all())
            invoice.amount = items_sum
            tax_val = float(invoice.tax_rate) if invoice.tax_rate is not None else 10.0
            invoice.total_amount = float(items_sum) + (float(items_sum) * (tax_val / 100))
            invoice.save()

        # Send in-app notification to current user (Manager)
        client_name = invoice.client.name if invoice.client else 'Client'
        create_notification(
            recipient=self.request.user,
            title=f"Invoice #{invoice.invoice_number} Issued",
            message=f"Invoice for {client_name} totaling ${float(invoice.total_amount):.2f} was generated.",
            notification_type='INVOICE_GENERATED',
            link_tab='invoices',
            reference_id=invoice.id
        )

        send_invoice_issued_email(invoice)

    @action(detail=True, methods=['post'], url_path='add-item')
    def add_item(self, request, pk=None):
        invoice = self.get_object()
        desc = request.data.get('description')
        qty = request.data.get('quantity', 1)
        price = request.data.get('unit_price')
        if not desc or price is None:
            return Response({'error': 'Description and unit price are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            qty_val = float(qty)
            price_val = float(price)
        except (ValueError, TypeError):
            return Response({'error': 'Invalid quantity or unit price.'}, status=status.HTTP_400_BAD_REQUEST)

        InvoiceItem.objects.create(
            invoice=invoice,
            description=desc,
            quantity=qty_val,
            unit_price=price_val,
            total=round(qty_val * price_val, 2)
        )

        items_sum = sum(i.total for i in invoice.items.all())
        invoice.amount = items_sum
        tax_val = float(invoice.tax_rate) if invoice.tax_rate is not None else 10.0
        invoice.total_amount = float(items_sum) + (float(items_sum) * (tax_val / 100))
        invoice.save()

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='delete-item/(?P<item_id>[^/.]+)')
    def delete_item(self, request, pk=None, item_id=None):
        invoice = self.get_object()
        try:
            item = InvoiceItem.objects.get(id=item_id, invoice=invoice)
            item.delete()
            items_sum = sum(i.total for i in invoice.items.all())
            invoice.amount = items_sum
            tax_val = float(invoice.tax_rate) if invoice.tax_rate is not None else 10.0
            invoice.total_amount = float(items_sum) + (float(items_sum) * (tax_val / 100))
            invoice.save()
            return Response(InvoiceSerializer(invoice).data)
        except InvoiceItem.DoesNotExist:
            return Response({'error': 'Invoice item not found.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='send-email')
    def send_email(self, request, pk=None):
        invoice = self.get_object()
        success = send_invoice_issued_email(invoice)
        client_email = invoice.client.email if invoice.client else 'client'
        if success:
            return Response({'message': f'Invoice #{invoice.invoice_number} successfully emailed to {client_email}.'})
        else:
            return Response({'message': f'Invoice breakdown generated for {client_email}.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        new_status = request.data.get('status', 'PAID')
        invoice.status = new_status
        invoice.save()

        # Auto-create Payment record if marked PAID and no payments recorded yet
        if new_status == 'PAID' and not invoice.payments.exists():
            Payment.objects.create(
                invoice=invoice,
                amount=invoice.total_amount,
                payment_method=request.data.get('payment_method', 'BANK_TRANSFER'),
                notes='Marked as Paid by Manager'
            )

        # Send in-app notification to current user (Manager)
        create_notification(
            recipient=request.user,
            title=f"Invoice #{invoice.invoice_number} Paid! 💰",
            message=f"Invoice #{invoice.invoice_number} is now marked as {new_status} (Amount: ${float(invoice.total_amount):.2f}).",
            notification_type='PAYMENT_RECEIVED',
            link_tab='invoices',
            reference_id=invoice.id
        )

        return Response({
            'message': f'Invoice #{invoice.invoice_number} status updated to {new_status}.',
            'invoice': InvoiceSerializer(invoice).data
        })

    @action(detail=False, methods=['get'], url_path='next-invoice-number')
    def next_invoice_number(self, request):
        from datetime import date
        current_year = date.today().year
        last_inv = Invoice.objects.order_by('-id').first()
        next_num = (last_inv.id + 1) if (last_inv and last_inv.id) else 1
        inv_str = f"INV-{current_year}-{next_num:03d}"
        return Response({'next_invoice_number': inv_str})


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().order_by('-payment_date')
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        payment = serializer.save()
        invoice = payment.invoice
        if invoice:
            total_paid = sum(p.amount for p in invoice.payments.all())
            if total_paid >= invoice.total_amount:
                invoice.status = 'PAID'
                invoice.save()


class SupportRequestViewSet(viewsets.ModelViewSet):
    queryset = SupportRequest.objects.all().order_by('-created_at')
    serializer_class = SupportRequestSerializer
    permission_classes = [permissions.IsAuthenticated]


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """Provides high level portal statistics for Manager & Team Lead dashboards"""
    total_clients = Client.objects.filter(status='ACTIVE').count()
    new_leads = Client.objects.filter(status='LEAD').count()
    total_employees = User.objects.exclude(role='MANAGER').count()
    total_team_leads = User.objects.filter(role='TEAM_LEAD').count()
    total_regular_employees = User.objects.filter(role='EMPLOYEE').count()
    active_projects = Project.objects.filter(status__in=['ACTIVE', 'PLANNING']).count()
    
    invoices_paid = Invoice.objects.filter(status='PAID').aggregate(Sum('total_amount'))['total_amount__sum'] or 0.00
    invoices_unpaid = Invoice.objects.filter(status='UNPAID').aggregate(Sum('total_amount'))['total_amount__sum'] or 0.00
    open_tickets = SupportRequest.objects.filter(status__in=['OPEN', 'IN_PROGRESS']).count()

    return Response({
        'total_clients': total_clients,
        'new_leads': new_leads,
        'total_employees': total_employees,
        'total_regular_employees': total_regular_employees,
        'total_team_leads': total_team_leads,
        'active_projects': active_projects,
        'revenue_paid': float(invoices_paid),
        'pending_payments': float(invoices_unpaid),
        'open_support_requests': open_tickets,
    })


class ChatGroupViewSet(viewsets.ModelViewSet):
    queryset = ChatGroup.objects.all().order_by('-created_at')
    serializer_class = ChatGroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return ChatGroup.objects.filter(members__user=user).distinct().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        name = request.data.get('name')
        description = request.data.get('description', '')
        group_type = request.data.get('group_type', 'CUSTOM')
        invited_user_ids = request.data.get('invited_user_ids', [])

        if not name:
            return Response({'error': 'Group name is required'}, status=status.HTTP_400_BAD_REQUEST)

        group = ChatGroup.objects.create(
            name=name,
            description=description,
            group_type=group_type,
            created_by=request.user
        )

        # Add creator as ADMIN
        ChatGroupMember.objects.create(group=group, user=request.user, role='ADMIN', status='JOINED')

        # Add & invite members
        inviter_name = request.user.get_full_name() or request.user.username
        invite_url = f"http://localhost:5173/messenger?invite={group.invite_token}"

        for uid in invited_user_ids:
            try:
                target_user = User.objects.get(id=uid)
                if target_user != request.user:
                    ChatGroupMember.objects.create(group=group, user=target_user, role='MEMBER', status='INVITED')
                    # Send Group Invite Email
                    send_group_invite_email(group, target_user, request.user, invite_url)
            except User.DoesNotExist:
                continue

        # Post system message
        ChatMessage.objects.create(
            group=group,
            sender=None,
            message_text=f"💬 Group '{name}' created by {inviter_name}.",
            is_system_message=True
        )

        return Response(ChatGroupSerializer(group).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='get-or-create-p2p')
    def get_or_create_p2p(self, request):
        target_user_id = request.data.get('target_user_id')
        if not target_user_id:
            return Response({'error': 'target_user_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response({'error': 'Target user not found'}, status=status.HTTP_400_BAD_REQUEST)

        # Check existing P2P chat between current user and target user
        existing_groups = ChatGroup.objects.filter(
            group_type='P2P',
            members__user=request.user
        ).filter(members__user=target_user)

        if existing_groups.exists():
            group = existing_groups.first()
        else:
            group = ChatGroup.objects.create(
                name=f"Direct: {request.user.username} & {target_user.username}",
                group_type='P2P',
                created_by=request.user
            )
            ChatGroupMember.objects.create(group=group, user=request.user, role='ADMIN', status='JOINED')
            ChatGroupMember.objects.create(group=group, user=target_user, role='MEMBER', status='JOINED')

        return Response(ChatGroupSerializer(group).data)

    @action(detail=False, methods=['get'], url_path='by-token')
    def by_token(self, request):
        token = request.query_params.get('token')
        if not token:
            return Response({'error': 'token is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            group = ChatGroup.objects.get(invite_token=token)
            user_member = ChatGroupMember.objects.filter(group=group, user=request.user).first()
            user_status = user_member.status if user_member else 'NOT_MEMBER'
            return Response({
                'group': ChatGroupSerializer(group).data,
                'user_status': user_status
            })
        except Exception:
            return Response({'error': 'Invalid or expired invite token'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'], url_path='join-by-token')
    def join_by_token(self, request):
        token = request.data.get('token')
        if not token:
            return Response({'error': 'token is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            group = ChatGroup.objects.get(invite_token=token)
            member, created = ChatGroupMember.objects.get_or_create(
                group=group,
                user=request.user,
                defaults={'role': 'MEMBER', 'status': 'JOINED'}
            )
            if not created and member.status != 'JOINED':
                member.status = 'JOINED'
                member.save()

            # Post system message
            user_name = request.user.get_full_name() or request.user.username
            ChatMessage.objects.create(
                group=group,
                sender=None,
                message_text=f"👋 {user_name} joined the group via invite link.",
                is_system_message=True
            )

            return Response({
                'message': f"Successfully joined group '{group.name}'!",
                'group': ChatGroupSerializer(group).data
            })
        except ChatGroup.DoesNotExist:
            return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)

    def update(self, request, *args, **kwargs):
        group = self.get_object()
        name = request.data.get('name', group.name)
        description = request.data.get('description', group.description)
        member_ids = request.data.get('member_ids', None)

        if not name:
            return Response({'error': 'Group name cannot be empty'}, status=status.HTTP_400_BAD_REQUEST)

        group.name = name
        group.description = description
        group.save()

        if member_ids is not None and isinstance(member_ids, list):
            target_member_ids = set(member_ids)
            if group.created_by_id:
                target_member_ids.add(group.created_by_id)
            target_member_ids.add(request.user.id)

            current_member_ids = set(group.members.values_list('user_id', flat=True))
            
            # Add new members
            to_add = target_member_ids - current_member_ids
            for uid in to_add:
                try:
                    u = User.objects.get(id=uid)
                    ChatGroupMember.objects.create(group=group, user=u, role='MEMBER', status='JOINED')
                except User.DoesNotExist:
                    pass

            # Remove unselected members (except creator and self)
            to_remove = current_member_ids - target_member_ids
            ChatGroupMember.objects.filter(group=group, user_id__in=to_remove).delete()

        updater_name = request.user.get_full_name() or request.user.username
        ChatMessage.objects.create(
            group=group,
            sender=None,
            message_text=f"⚙️ Group details updated by {updater_name}.",
            is_system_message=True
        )

        return Response(ChatGroupSerializer(group).data)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        group_name = group.name
        group.delete()
        return Response({'message': f"Group '{group_name}' deleted successfully"}, status=status.HTTP_200_OK)


class ChatMessageViewSet(viewsets.ModelViewSet):
    queryset = ChatMessage.objects.all().order_by('created_at')
    serializer_class = ChatMessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ChatMessage.objects.all().order_by('created_at')
        group_id = self.request.query_params.get('group', None)
        if group_id:
            queryset = queryset.filter(group_id=group_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_chat_attachment(request):
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    upload_dir = settings.MEDIA_ROOT / 'chat_attachments'
    upload_dir.mkdir(parents=True, exist_ok=True)
    fs = FileSystemStorage(location=upload_dir, base_url='/media/chat_attachments/')
    filename = fs.save(file_obj.name, file_obj)
    file_url = fs.url(filename)
    return Response({'attachment_url': file_url, 'filename': file_obj.name})


class CallSessionViewSet(viewsets.ModelViewSet):
    queryset = CallSession.objects.all().order_by('-created_at')
    serializer_class = CallSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Auto-expire unanswered ringing calls older than 30 seconds
        cutoff = timezone.now() - timedelta(seconds=30)
        expired_calls = CallSession.objects.filter(status='RINGING', created_at__lt=cutoff)
        for expired in expired_calls:
            expired.status = 'DECLINED'
            expired.save()
            call_label = "Audio Call" if expired.call_type == 'AUDIO' else "Video Call"
            receiver_name = expired.receiver.get_full_name() or expired.receiver.username
            self._log_call_message(expired, f"📵 {call_label} unanswered by {receiver_name} (30s timeout)")

        return CallSession.objects.filter(
            Q(caller=user) | Q(receiver=user)
        ).order_by('-created_at')


    def _log_call_message(self, call, text):
        try:
            group = call.group
            if not group:
                p2p_groups = ChatGroup.objects.filter(
                    group_type='P2P',
                    members__user=call.caller
                ).filter(members__user=call.receiver)
                group = p2p_groups.first()
                if not group:
                    group = ChatGroup.objects.create(
                        name=f"Direct: {call.caller.username} & {call.receiver.username}",
                        group_type='P2P',
                        created_by=call.caller
                    )
                    ChatGroupMember.objects.create(group=group, user=call.caller, role='MEMBER', status='JOINED')
                    ChatGroupMember.objects.create(group=group, user=call.receiver, role='MEMBER', status='JOINED')

            ChatMessage.objects.create(
                group=group,
                sender=None,
                message_text=text,
                is_system_message=True
            )
        except Exception as e:
            print("Error logging call history message:", e)

    @action(detail=False, methods=['post'], url_path='start-call')
    def start_call(self, request):
        receiver_id = request.data.get('receiver_id')
        call_type = request.data.get('call_type', 'VIDEO')
        group_id = request.data.get('group_id', None)
        sdp_offer = request.data.get('sdp_offer', '')

        if not receiver_id:
            return Response({'error': 'receiver_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            receiver = User.objects.get(id=receiver_id)
            call = CallSession.objects.create(
                caller=request.user,
                receiver=receiver,
                group_id=group_id,
                call_type=call_type,
                status='RINGING',
                sdp_offer=sdp_offer
            )
            caller_name = request.user.get_full_name() or request.user.username
            call_label = "Audio Call" if call_type == 'AUDIO' else "Video Call"
            icon = "📞" if call_type == 'AUDIO' else "📹"
            self._log_call_message(call, f"{icon} {call_label} initiated by {caller_name}")
            return Response(CallSessionSerializer(call).data, status=status.HTTP_201_CREATED)
        except User.DoesNotExist:
            return Response({'error': 'Receiver user not found'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='respond-call')
    def respond_call(self, request, pk=None):
        call = self.get_object()
        action_type = request.data.get('action')
        sdp_answer = request.data.get('sdp_answer', '')

        if action_type == 'ACCEPT':
            call.status = 'ACCEPTED'
            if sdp_answer:
                call.sdp_answer = sdp_answer
        elif action_type == 'DECLINE':
            call.status = 'DECLINED'
            call_label = "Audio Call" if call.call_type == 'AUDIO' else "Video Call"
            decliner_name = request.user.get_full_name() or request.user.username
            self._log_call_message(call, f"📵 {call_label} declined by {decliner_name}")
        call.save()

        return Response(CallSessionSerializer(call).data)

    @action(detail=True, methods=['post'], url_path='accept-call')
    def accept_call_action(self, request, pk=None):
        call = self.get_object()
        call.status = 'ACCEPTED'
        call.save()
        return Response(CallSessionSerializer(call).data)

    @action(detail=True, methods=['post'], url_path='decline-call')
    def decline_call_action(self, request, pk=None):
        call = self.get_object()
        call.status = 'DECLINED'
        call.save()
        call_label = "Audio Call" if call.call_type == 'AUDIO' else "Video Call"
        decliner_name = request.user.get_full_name() or request.user.username
        self._log_call_message(call, f"📵 {call_label} declined by {decliner_name}")
        return Response(CallSessionSerializer(call).data)

    @action(detail=True, methods=['post'], url_path='end-call')
    def end_call(self, request, pk=None):
        call = self.get_object()
        if call.status != 'ENDED':
            call.status = 'ENDED'
            call.save()
            call_label = "Audio Call" if call.call_type == 'AUDIO' else "Video Call"
            icon = "📞" if call.call_type == 'AUDIO' else "📹"
            duration = timezone.now() - call.created_at
            seconds = max(1, int(duration.total_seconds()))
            if seconds >= 60:
                mins = seconds // 60
                secs = seconds % 60
                dur_str = f"{mins}m {secs}s"
            else:
                dur_str = f"{seconds}s"
            self._log_call_message(call, f"{icon} {call_label} ended · Duration: {dur_str}")
        return Response(CallSessionSerializer(call).data)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'message': 'All notifications marked as read.'})

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=['post'], url_path='clear-all')
    def clear_all(self, request):
        Notification.objects.filter(recipient=request.user).delete()
        return Response({'message': 'All notifications cleared.'})

    @action(detail=False, methods=['post'], url_path='send-test')
    def send_test(self, request):
        notif = create_notification(
            recipient=request.user,
            sender=request.user,
            title="System Alert Test 🔔",
            message="Your CRM notification system is fully operational and synchronized with the database!",
            notification_type='SYSTEM',
            link_tab='attendance_leaves'
        )
        return Response(NotificationSerializer(notif).data, status=status.HTTP_201_CREATED)


class AttendanceViewSet(viewsets.ModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Attendance.objects.all().order_by('-date')
        is_personal = self.request.query_params.get('personal', 'false') == 'true'

        if is_personal or user.role == 'EMPLOYEE':
            queryset = queryset.filter(employee=user)
        elif user.role == 'TEAM_LEAD':
            lead_projects = user.assigned_lead_projects.all()
            member_ids = ProjectMember.objects.filter(project__in=lead_projects).values_list('employee_id', flat=True)
            queryset = queryset.filter(Q(employee=user) | Q(employee_id__in=member_ids))
        
        date_param = self.request.query_params.get('date', None)
        if date_param:
            queryset = queryset.filter(date=date_param)

        return queryset.distinct()

    @action(detail=False, methods=['get'], url_path='today')
    def today_status(self, request):
        today = timezone.localdate()
        attendance = Attendance.objects.filter(employee=request.user, date=today).first()
        if attendance:
            return Response(AttendanceSerializer(attendance).data)
        return Response({'is_clocked_in': False, 'attendance': None})

    @action(detail=False, methods=['post'], url_path='clock-in')
    def clock_in(self, request):
        today = timezone.localdate()
        attendance, created = Attendance.objects.get_or_create(
            employee=request.user,
            date=today,
            defaults={'clock_in': timezone.now(), 'status': 'PRESENT'}
        )
        if not created:
            if attendance.clock_in and attendance.clock_out is None:
                return Response({
                    'message': 'You are already clocked in!',
                    'attendance': AttendanceSerializer(attendance).data
                })
            # Resume session today (accumulating previous session hours)
            attendance.clock_in = timezone.now()
            attendance.clock_out = None
            attendance.status = 'PRESENT'
            attendance.save()

        # Send in-app confirmation notification to current user
        clock_time_str = timezone.localtime(attendance.clock_in).strftime('%I:%M %p')
        create_notification(
            recipient=request.user,
            title="Clocked In Successfully ⏱️",
            message=f"You clocked in at {clock_time_str}. Have a productive shift!",
            notification_type='SYSTEM',
            link_tab='attendance_leaves'
        )

        return Response({
            'message': 'Clocked in successfully!',
            'attendance': AttendanceSerializer(attendance).data
        })

    @action(detail=False, methods=['post'], url_path='clock-out')
    def clock_out(self, request):
        today = timezone.localdate()
        attendance = Attendance.objects.filter(employee=request.user, date=today).first()
        if not attendance or not attendance.clock_in or attendance.clock_out is not None:
            return Response({'error': 'You have not actively clocked in today or have already clocked out.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        attendance.clock_out = now
        duration = now - attendance.clock_in
        session_hours = duration.total_seconds() / 3600.0
        prev_hours = float(attendance.total_hours) if attendance.total_hours else 0.0
        total_hours = round(prev_hours + session_hours, 2)
        attendance.total_hours = total_hours
        attendance.status = 'PRESENT' if total_hours >= 4.0 else 'HALF_DAY'
        attendance.save()

        # Send in-app confirmation notification to current user
        clock_out_str = timezone.localtime(now).strftime('%I:%M %p')
        create_notification(
            recipient=request.user,
            title="Clocked Out Successfully 🏁",
            message=f"You clocked out at {clock_out_str}. Total hours worked today: {total_hours} hrs.",
            notification_type='SYSTEM',
            link_tab='attendance_leaves'
        )

        return Response({
            'message': f'Clocked out successfully! Total hours: {total_hours} hrs',
            'attendance': AttendanceSerializer(attendance).data
        })

    @action(detail=False, methods=['get'], url_path='company-overview')
    def company_overview(self, request):
        today = timezone.localdate()
        user = request.user
        if user.role == 'MANAGER':
            staff_users = User.objects.exclude(role='MANAGER').order_by('username')
        elif user.role == 'TEAM_LEAD':
            lead_projects = user.assigned_lead_projects.all()
            member_ids = ProjectMember.objects.filter(project__in=lead_projects).values_list('employee_id', flat=True)
            staff_users = User.objects.filter(Q(id=user.id) | Q(id__in=member_ids)).distinct().order_by('username')
        else:
            staff_users = User.objects.filter(id=user.id)

        today_records = {att.employee_id: att for att in Attendance.objects.filter(date=today)}

        result = []
        for staff in staff_users:
            att = today_records.get(staff.id)
            result.append({
                'employee': UserSerializer(staff).data,
                'status': att.status if att else 'ABSENT',
                'clock_in': att.clock_in if att else None,
                'clock_out': att.clock_out if att else None,
                'total_hours': float(att.total_hours) if (att and att.total_hours is not None) else 0.0,
                'is_clocked_in': (att.clock_in is not None and att.clock_out is None) if att else False
            })

        return Response(result)


class LeaveRequestViewSet(viewsets.ModelViewSet):
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = LeaveRequest.objects.all().order_by('-created_at')
        is_personal = self.request.query_params.get('personal', 'false') == 'true'

        if is_personal or user.role == 'EMPLOYEE':
            queryset = queryset.filter(employee=user)
        elif user.role == 'TEAM_LEAD':
            lead_projects = user.assigned_lead_projects.all()
            member_ids = ProjectMember.objects.filter(project__in=lead_projects).values_list('employee_id', flat=True)
            queryset = queryset.filter(Q(employee=user) | Q(employee_id__in=member_ids))
        return queryset.distinct()

    def perform_create(self, serializer):
        req = serializer.save(employee=self.request.user, status='PENDING')
        emp_name = self.request.user.get_full_name() or self.request.user.username

        # 1. In-app confirmation for applicant
        create_notification(
            recipient=self.request.user,
            title="Leave Request Submitted",
            message=f"Your {req.get_leave_type_display()} request ({req.start_date} to {req.end_date}) has been sent for review.",
            notification_type='LEAVE_REQUESTED',
            link_tab='attendance_leaves',
            reference_id=req.id
        )

        # 2. Notify all Managers
        managers = User.objects.filter(role='MANAGER').exclude(id=self.request.user.id)
        for mgr in managers:
            create_notification(
                recipient=mgr,
                sender=self.request.user,
                title=f"Leave Request: {emp_name}",
                message=f"{emp_name} requested {req.get_leave_type_display()} from {req.start_date} to {req.end_date} ({req.days_count} days).",
                notification_type='LEAVE_REQUESTED',
                link_tab='attendance_leaves',
                reference_id=req.id
            )

        # 3. Notify Team Lead if applicable
        lead_ids = Project.objects.filter(members__employee=self.request.user, status='ACTIVE').values_list('team_lead_id', flat=True).distinct()
        for lead in User.objects.filter(id__in=lead_ids).exclude(id=self.request.user.id):
            create_notification(
                recipient=lead,
                sender=self.request.user,
                title=f"Team Leave Request: {emp_name}",
                message=f"{emp_name} requested {req.get_leave_type_display()} ({req.start_date} to {req.end_date}).",
                notification_type='LEAVE_REQUESTED',
                link_tab='attendance_leaves',
                reference_id=req.id
            )

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        if request.user.role not in ['MANAGER', 'TEAM_LEAD']:
            return Response({'error': 'Only Managers and Team Leads can approve leave requests.'}, status=status.HTTP_403_FORBIDDEN)
        
        leave_req = self.get_object()
        leave_req.status = 'APPROVED'
        leave_req.reviewed_by = request.user
        leave_req.review_comments = request.data.get('review_comments', 'Approved')
        leave_req.save()

        reviewer_name = request.user.get_full_name() or request.user.username
        create_notification(
            recipient=leave_req.employee,
            sender=request.user,
            title="Leave Request Approved! 🎉",
            message=f"Your {leave_req.get_leave_type_display()} request ({leave_req.start_date} to {leave_req.end_date}) was approved by {reviewer_name}.",
            notification_type='LEAVE_STATUS_CHANGED',
            link_tab='attendance_leaves',
            reference_id=leave_req.id
        )

        return Response({
            'message': 'Leave request approved successfully.',
            'leave_request': LeaveRequestSerializer(leave_req).data
        })

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        if request.user.role not in ['MANAGER', 'TEAM_LEAD']:
            return Response({'error': 'Only Managers and Team Leads can reject leave requests.'}, status=status.HTTP_403_FORBIDDEN)
        
        leave_req = self.get_object()
        comments = request.data.get('review_comments', '')
        if not comments.strip():
            return Response({'error': 'Please provide a reason for rejection.'}, status=status.HTTP_400_BAD_REQUEST)
        
        leave_req.status = 'REJECTED'
        leave_req.reviewed_by = request.user
        leave_req.review_comments = comments
        leave_req.save()

        reviewer_name = request.user.get_full_name() or request.user.username
        create_notification(
            recipient=leave_req.employee,
            sender=request.user,
            title="Leave Request Rejected ❌",
            message=f"Your {leave_req.get_leave_type_display()} request was rejected by {reviewer_name}. Reason: {comments}",
            notification_type='LEAVE_STATUS_CHANGED',
            link_tab='attendance_leaves',
            reference_id=leave_req.id
        )

        return Response({
            'message': 'Leave request rejected.',
            'leave_request': LeaveRequestSerializer(leave_req).data
        })


