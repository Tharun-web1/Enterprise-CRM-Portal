from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
import datetime

class User(AbstractUser):
    ROLE_CHOICES = (
        ('MANAGER', 'Manager / Admin'),
        ('TEAM_LEAD', 'Team Lead'),
        ('EMPLOYEE', 'Employee'),
    )
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='EMPLOYEE')
    phone = models.CharField(max_length=20, blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    skills = models.CharField(max_length=255, blank=True, null=True)
    experience_years = models.IntegerField(default=1)
    is_available = models.BooleanField(default=True)
    is_first_login = models.BooleanField(default=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    
    @property
    def is_online(self):
        if not self.last_seen:
            return False
        return (timezone.now() - self.last_seen) < datetime.timedelta(seconds=70)
    
    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"


class Client(models.Model):
    STATUS_CHOICES = (
        ('LEAD', 'New Lead'),
        ('ACTIVE', 'Active Client'),
        ('INACTIVE', 'Inactive Client'),
    )
    
    name = models.CharField(max_length=150)
    company = models.CharField(max_length=150, blank=True, null=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='LEAD')
    address = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.company or 'Individual'})"


class Project(models.Model):
    STATUS_CHOICES = (
        ('PLANNING', 'Planning'),
        ('ACTIVE', 'Active'),
        ('COMPLETED', 'Completed'),
        ('ON_HOLD', 'On Hold'),
    )
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    team_lead = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='assigned_lead_projects',
        limit_choices_to={'role': 'TEAM_LEAD'}
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PLANNING')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    budget = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    pdf_file = models.FileField(upload_to='project_pdfs/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class ProjectImage(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='images')
    image = models.FileField(upload_to='project_images/')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image for {self.project.title}"


class ProjectMember(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='members')
    employee = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='project_assignments',
        limit_choices_to={'role': 'EMPLOYEE'}
    )
    role_in_team = models.CharField(max_length=100, default='Team Member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'employee')

    def __str__(self):
        return f"{self.employee.username} in {self.project.title}"


class Task(models.Model):
    STATUS_CHOICES = (
        ('TODO', 'To Do'),
        ('IN_PROGRESS', 'In Progress'),
        ('IN_REVIEW', 'In Review'),
        ('NEEDS_REVISION', 'Needs Revision'),
        ('COMPLETED', 'Completed'),
    )
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )
    
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    assigned_to = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='tasks_assigned',
        limit_choices_to={'role': 'EMPLOYEE'}
    )
    assigned_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='tasks_created'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='TODO')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    due_date = models.DateField(null=True, blank=True)
    completion_report = models.TextField(blank=True, null=True)
    review_feedback = models.TextField(blank=True, null=True)
    hours_logged = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    requirements_needed = models.TextField(blank=True, null=True)
    selfie_image = models.FileField(upload_to='task_selfies/', null=True, blank=True)
    reporter_name = models.CharField(max_length=150, blank=True, null=True)
    reporter_email = models.EmailField(blank=True, null=True)
    reporter_phone = models.CharField(max_length=30, blank=True, null=True)
    visited_person_name = models.CharField(max_length=150, blank=True, null=True)
    visited_person_email = models.EmailField(blank=True, null=True)
    visited_person_phone = models.CharField(max_length=30, blank=True, null=True)
    visited_person_company = models.CharField(max_length=150, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.status})"


class Invoice(models.Model):
    STATUS_CHOICES = (
        ('DRAFT', 'Draft'),
        ('UNPAID', 'Unpaid'),
        ('PAID', 'Paid'),
        ('OVERDUE', 'Overdue'),
    )
    
    invoice_number = models.CharField(max_length=50, unique=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='invoices')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='UNPAID')
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()

    def save(self, *args, **kwargs):
        if not self.total_amount:
            self.total_amount = self.amount + (self.amount * (self.tax_rate / 100))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Invoice #{self.invoice_number} - {self.client.name}"


class Payment(models.Model):
    METHOD_CHOICES = (
        ('CREDIT_CARD', 'Credit Card'),
        ('BANK_TRANSFER', 'Bank Transfer'),
        ('PAYPAL', 'PayPal'),
        ('CASH', 'Cash'),
    )
    
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=30, choices=METHOD_CHOICES, default='BANK_TRANSFER')
    payment_date = models.DateField(auto_now_add=True)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Payment of ${self.amount} for #{self.invoice.invoice_number}"


class SupportRequest(models.Model):
    PRIORITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('URGENT', 'Urgent'),
    )
    STATUS_CHOICES = (
        ('OPEN', 'Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
    )
    
    ticket_id = models.CharField(max_length=50, unique=True)
    subject = models.CharField(max_length=200)
    description = models.TextField()
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='support_tickets')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tickets')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='MEDIUM')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[{self.ticket_id}] {self.subject}"


import uuid

class ChatGroup(models.Model):
    GROUP_TYPE_CHOICES = (
        ('P2P', 'Peer to Peer Direct Chat'),
        ('PROJECT', 'Project Team Channel'),
        ('CUSTOM', 'Custom Group Chat'),
    )
    
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    group_type = models.CharField(max_length=20, choices=GROUP_TYPE_CHOICES, default='CUSTOM')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='chat_groups')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_groups')
    invite_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.group_type})"


class ChatGroupMember(models.Model):
    ROLE_CHOICES = (
        ('ADMIN', 'Group Admin'),
        ('MEMBER', 'Member'),
    )
    STATUS_CHOICES = (
        ('INVITED', 'Invited'),
        ('JOINED', 'Joined'),
    )

    group = models.ForeignKey(ChatGroup, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='MEMBER')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='JOINED')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.group.name} [{self.status}]"


class ChatMessage(models.Model):
    group = models.ForeignKey(ChatGroup, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_messages')
    message_text = models.TextField()
    is_system_message = models.BooleanField(default=False)
    attachment_url = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        sender_name = self.sender.username if self.sender else "SYSTEM"
        return f"[{self.group.name}] {sender_name}: {self.message_text[:30]}"


class CallSession(models.Model):
    CALL_TYPE_CHOICES = (
        ('AUDIO', 'Audio Call'),
        ('VIDEO', 'Video Call'),
    )
    STATUS_CHOICES = (
        ('RINGING', 'Ringing'),
        ('ACCEPTED', 'Accepted'),
        ('DECLINED', 'Declined'),
        ('ENDED', 'Ended'),
    )

    caller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='outgoing_calls')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='incoming_calls')
    group = models.ForeignKey(ChatGroup, on_delete=models.CASCADE, null=True, blank=True, related_name='call_sessions')
    call_type = models.CharField(max_length=10, choices=CALL_TYPE_CHOICES, default='VIDEO')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='RINGING')
    sdp_offer = models.TextField(blank=True, null=True)
    sdp_answer = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.call_type} from {self.caller.username} to {self.receiver.username} [{self.status}]"


class Notification(models.Model):
    NOTIFICATION_TYPES = (
        ('TASK_ASSIGNED', 'Task Assigned'),
        ('TASK_STATUS_CHANGED', 'Task Status Updated'),
        ('TASK_COMMENT', 'New Task Comment'),
        ('PROJECT_MEMBER_ADDED', 'Added to Project'),
        ('INVOICE_GENERATED', 'Invoice Generated'),
        ('PAYMENT_RECEIVED', 'Payment Received'),
        ('LEAVE_REQUESTED', 'New Leave Request'),
        ('LEAVE_STATUS_CHANGED', 'Leave Request Updated'),
        ('SYSTEM', 'System Alert'),
    )

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_notifications')
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES, default='SYSTEM')
    link_tab = models.CharField(max_length=50, blank=True, null=True)
    reference_id = models.CharField(max_length=100, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] for {self.recipient.username}: {self.title}"


class TaskComment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_comments')
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.username} on Task #{self.task_id}"


class TaskAttachment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='attachments')
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_attachments')
    file = models.FileField(upload_to='task_attachments/')
    file_name = models.CharField(max_length=255)
    file_size = models.CharField(max_length=50, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.file_name} on Task #{self.task_id}"


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1.00)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    def save(self, *args, **kwargs):
        self.total = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} ({self.quantity} x {self.unit_price}) for Invoice #{self.invoice.invoice_number}"


class Attendance(models.Model):
    STATUS_CHOICES = (
        ('PRESENT', 'Present'),
        ('HALF_DAY', 'Half Day'),
        ('ABSENT', 'Absent'),
        ('ON_LEAVE', 'On Leave'),
    )

    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField(default=timezone.localdate)
    clock_in = models.DateTimeField(null=True, blank=True)
    clock_out = models.DateTimeField(null=True, blank=True)
    total_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PRESENT')
    work_notes = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('employee', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.employee.username} - {self.date} [{self.status}]"


class LeaveRequest(models.Model):
    LEAVE_TYPE_CHOICES = (
        ('CASUAL', 'Casual Leave'),
        ('SICK', 'Sick Leave'),
        ('ANNUAL', 'Annual Paid Leave'),
        ('MATERNITY_PATERNITY', 'Maternity / Paternity'),
        ('UNPAID', 'Loss of Pay (Unpaid)'),
    )
    STATUS_CHOICES = (
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    )

    employee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='leave_requests')
    leave_type = models.CharField(max_length=30, choices=LEAVE_TYPE_CHOICES, default='CASUAL')
    start_date = models.DateField()
    end_date = models.DateField()
    days_count = models.IntegerField(default=1)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_leaves'
    )
    review_comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee.username}: {self.leave_type} ({self.start_date} to {self.end_date}) [{self.status}]"


