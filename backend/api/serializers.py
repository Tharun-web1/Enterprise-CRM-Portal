from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.utils import timezone
from .models import (
    User, Client, Project, ProjectImage, ProjectMember, Task, Invoice, Payment, SupportRequest,
    ChatGroup, ChatGroupMember, ChatMessage, CallSession,
    Notification, TaskComment, TaskAttachment, InvoiceItem, Attendance, LeaveRequest
)

from .utils import generate_next_employee_id, send_welcome_credentials_email

class UserSerializer(serializers.ModelSerializer):
    is_online = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'designation', 'department', 'skills', 'experience_years', 'is_available', 'is_first_login', 'is_online', 'last_seen')


class UserCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('id', 'username', 'password', 'email', 'first_name', 'last_name', 'role', 'phone', 'designation', 'department', 'skills', 'experience_years')

    def create(self, validated_data):
        password = validated_data.pop('password')
        username = validated_data.get('username')
        if not username or username.strip() == '':
            username = generate_next_employee_id()
            validated_data['username'] = username

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Send credentials email automatically
        send_welcome_credentials_email(user, password)
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        self.user.last_seen = timezone.now()
        self.user.save(update_fields=['last_seen'])
        data['user'] = UserSerializer(self.user).data
        return data


class ClientSerializer(serializers.ModelSerializer):
    active_projects_count = serializers.SerializerMethodField()
    total_invoices_amount = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = '__all__'

    def get_active_projects_count(self, obj):
        return obj.projects.filter(status='ACTIVE').count()

    def get_total_invoices_amount(self, obj):
        return sum(inv.total_amount for inv in obj.invoices.all())


class ProjectMemberSerializer(serializers.ModelSerializer):
    employee_details = UserSerializer(source='employee', read_only=True)
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role='EMPLOYEE'), 
        source='employee', 
        write_only=True
    )

    class Meta:
        model = ProjectMember
        fields = ('id', 'project', 'employee_id', 'employee_details', 'role_in_team', 'joined_at')


class ProjectImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectImage
        fields = ['id', 'image', 'image_url', 'created_at']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class ProjectSerializer(serializers.ModelSerializer):
    client_details = ClientSerializer(source='client', read_only=True)
    team_lead_details = UserSerializer(source='team_lead', read_only=True)
    members = ProjectMemberSerializer(many=True, read_only=True)
    images = ProjectImageSerializer(many=True, read_only=True)
    pdf_url = serializers.SerializerMethodField()
    task_count = serializers.SerializerMethodField()
    completed_task_count = serializers.SerializerMethodField()
    progress_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None

    def get_task_count(self, obj):
        return obj.tasks.count()

    def get_completed_task_count(self, obj):
        return obj.tasks.filter(status='COMPLETED').count()

    def get_progress_percentage(self, obj):
        if obj.status == 'COMPLETED':
            return 100
        total = obj.tasks.count()
        if total == 0:
            return 0
        completed = obj.tasks.filter(status='COMPLETED').count()
        return round((completed / total) * 100)


class TaskCommentSerializer(serializers.ModelSerializer):
    author_details = UserSerializer(source='author', read_only=True)

    class Meta:
        model = TaskComment
        fields = ('id', 'task', 'author', 'author_details', 'comment', 'created_at')
        read_only_fields = ('author', 'created_at')


class TaskAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_details = UserSerializer(source='uploaded_by', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TaskAttachment
        fields = ('id', 'task', 'uploaded_by', 'uploaded_by_details', 'file', 'file_url', 'file_name', 'file_size', 'uploaded_at')
        read_only_fields = ('uploaded_by', 'uploaded_at')

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    assigned_by_details = UserSerializer(source='assigned_by', read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True)
    selfie_url = serializers.SerializerMethodField()
    comments = TaskCommentSerializer(many=True, read_only=True)
    attachments = TaskAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = '__all__'

    def get_selfie_url(self, obj):
        if obj.selfie_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.selfie_image.url)
            return obj.selfie_image.url
        return None


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ('id', 'invoice', 'description', 'quantity', 'unit_price', 'total')
        read_only_fields = ('total',)


class InvoiceSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    client_company = serializers.CharField(source='client.company', read_only=True)
    project_title = serializers.CharField(source='project.title', read_only=True, allow_null=True)
    total_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    items = InvoiceItemSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = '__all__'

    def validate(self, attrs):
        amount = attrs.get('amount')
        tax_rate = attrs.get('tax_rate', 10.00)
        if amount is not None and not attrs.get('total_amount'):
            try:
                tax_val = float(tax_rate) if tax_rate is not None else 10.00
                attrs['total_amount'] = float(amount) + (float(amount) * (tax_val / 100))
            except (ValueError, TypeError):
                attrs['total_amount'] = float(amount)
        return attrs


class PaymentSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'


class SupportRequestSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)

    class Meta:
        model = SupportRequest
        fields = '__all__'


class ChatGroupMemberSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = ChatGroupMember
        fields = ('id', 'group', 'user', 'user_details', 'role', 'status', 'joined_at')


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_details = UserSerializer(source='sender', read_only=True)

    class Meta:
        model = ChatMessage
        fields = ('id', 'group', 'sender', 'sender_details', 'message_text', 'is_system_message', 'attachment_url', 'created_at')


class ChatGroupSerializer(serializers.ModelSerializer):
    members = ChatGroupMemberSerializer(many=True, read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)

    class Meta:
        model = ChatGroup
        fields = ('id', 'name', 'description', 'group_type', 'project', 'created_by', 'created_by_details', 'invite_token', 'created_at', 'members')


class CallSessionSerializer(serializers.ModelSerializer):
    caller_details = UserSerializer(source='caller', read_only=True)
    receiver_details = UserSerializer(source='receiver', read_only=True)

    class Meta:
        model = CallSession
        fields = ('id', 'caller', 'caller_details', 'receiver', 'receiver_details', 'group', 'call_type', 'status', 'sdp_offer', 'sdp_answer', 'created_at', 'updated_at')


class NotificationSerializer(serializers.ModelSerializer):
    sender_details = UserSerializer(source='sender', read_only=True)

    class Meta:
        model = Notification
        fields = ('id', 'recipient', 'sender', 'sender_details', 'title', 'message', 'notification_type', 'link_tab', 'reference_id', 'is_read', 'created_at')


class AttendanceSerializer(serializers.ModelSerializer):
    employee_details = UserSerializer(source='employee', read_only=True)
    is_clocked_in = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = ('id', 'employee', 'employee_details', 'date', 'clock_in', 'clock_out', 'total_hours', 'status', 'work_notes', 'is_clocked_in')
        read_only_fields = ('employee',)

    def get_is_clocked_in(self, obj):
        return obj.clock_in is not None and obj.clock_out is None


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_details = UserSerializer(source='employee', read_only=True)
    reviewed_by_details = UserSerializer(source='reviewed_by', read_only=True)

    class Meta:
        model = LeaveRequest
        fields = ('id', 'employee', 'employee_details', 'leave_type', 'start_date', 'end_date', 'days_count', 'reason', 'status', 'reviewed_by', 'reviewed_by_details', 'review_comments', 'created_at', 'updated_at')
        read_only_fields = ('employee', 'reviewed_by', 'created_at', 'updated_at')


