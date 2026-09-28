import logging
from django.core.mail import get_connection, EmailMultiAlternatives
from django.conf import settings
from .models import User

logger = logging.getLogger(__name__)

def generate_next_employee_id():
    """Generates next unique Employee ID e.g. EMP-1001, EMP-1002..."""
    total_users = User.objects.count()
    next_num = 1001 + total_users
    
    emp_id = f"EMP-{next_num}"
    while User.objects.filter(username=emp_id).exists():
        next_num += 1
        emp_id = f"EMP-{next_num}"
        
    return emp_id


def dispatch_email_with_fallback(subject, plain_message, recipient_list, html_message=None):
    """
    Sends email with automatic dual-port fallback (Port 465 SSL <-> Port 587 TLS).
    This ensures emails are reliably delivered on production servers (cPanel, Hostinger, etc.)
    where hosting firewalls routinely block outbound Port 587 or Port 465.
    """
    if not recipient_list or not any(recipient_list):
        logger.warning("No recipient list provided for email dispatch.")
        return False

    valid_recipients = [r.strip() for r in recipient_list if r and r.strip()]
    if not valid_recipients:
        return False

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'CRM Operations <noreply@crmportal.com>'
    host_user = getattr(settings, 'EMAIL_HOST_USER', None)
    host_password = getattr(settings, 'EMAIL_HOST_PASSWORD', None)
    host = getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com')
    primary_port = getattr(settings, 'EMAIL_PORT', 465)
    primary_ssl = getattr(settings, 'EMAIL_USE_SSL', True)
    primary_tls = getattr(settings, 'EMAIL_USE_TLS', False)

    # If SMTP credentials are not configured, use Django's configured backend (e.g. console)
    if not host_user or not host_password:
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=from_email,
                to=valid_recipients
            )
            if html_message:
                msg.attach_alternative(html_message, "text/html")
            msg.send(fail_silently=False)
            logger.info(f"Email '{subject}' sent via default backend to {valid_recipients}")
            return True
        except Exception as default_err:
            logger.warning(f"Email dispatch via default backend failed: {default_err}")
            return False

    # Attempt 1: Primary configured connection
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain_message,
            from_email=from_email,
            to=valid_recipients
        )
        if html_message:
            msg.attach_alternative(html_message, "text/html")
        msg.send(fail_silently=False)
        print(f"[EMAIL SUCCESS] Delivered to {valid_recipients} via primary port {primary_port}")
        logger.info(f"Email '{subject}' successfully dispatched to {valid_recipients} via port {primary_port}")
        return True
    except Exception as err1:
        print(f"[EMAIL WARNING] Primary dispatch on port {primary_port} failed: {err1}. Attempting alternate port fallback...")
        logger.warning(f"Primary dispatch on port {primary_port} failed: {err1}. Attempting alternate port fallback...")

    # Attempt 2: Alternate port fallback (if primary is 465 SSL, try 587 TLS; if 587 TLS, try 465 SSL)
    alt_port = 587 if primary_port == 465 else 465
    alt_ssl = (alt_port == 465)
    alt_tls = (alt_port == 587)

    try:
        alt_connection = get_connection(
            backend='django.core.mail.backends.smtp.EmailBackend',
            host=host,
            port=alt_port,
            username=host_user,
            password=host_password,
            use_ssl=alt_ssl,
            use_tls=alt_tls,
            timeout=10
        )
        msg_alt = EmailMultiAlternatives(
            subject=subject,
            body=plain_message,
            from_email=from_email,
            to=valid_recipients,
            connection=alt_connection
        )
        if html_message:
            msg_alt.attach_alternative(html_message, "text/html")
        msg_alt.send(fail_silently=False)
        print(f"[EMAIL SUCCESS] Delivered to {valid_recipients} via fallback port {alt_port}")
        logger.info(f"Email '{subject}' successfully dispatched to {valid_recipients} via fallback port {alt_port}")
        return True
    except Exception as err2:
        print(f"[EMAIL ERROR] Fallback dispatch also failed on port {alt_port}: {err2}")
        logger.error(f"Fallback email dispatch failed on port {alt_port}: {err2}")
        return False


def send_welcome_credentials_email(user, plain_password):
    """Dispatches welcome email with login credentials to employee's email address"""
    if not user.email:
        logger.warning(f"No email address found for user {user.username}. Email dispatch skipped.")
        return False

    full_name = user.get_full_name() or user.username
    role_display = user.get_role_display() if hasattr(user, 'get_role_display') else user.role

    subject = f"Welcome to CRM Portal - Your Account Credentials ({user.username})"
    plain_message = f"""Dear {full_name},

Welcome to the Team! Your account has been registered successfully on the CRM Relationship Portal.

Here are your account login credentials:
--------------------------------------------------
Employee ID (Username): {user.username}
Email Address:         {user.email}
Temporary Password:    {plain_password}
System Role:           {role_display}
Designation:           {user.designation or 'Team Member'}
Department:            {user.department or 'General'}
--------------------------------------------------

Portal Sign-In Page: http://demo.ygrgobalitservices.com/login

Please log in to your dashboard and change your password upon your first sign-in for security.

Best regards,
HR Operations & Management Team
CRM Relationship Portal
"""

    html_message = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #1e293b; }}
  .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
  .header {{ background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); color: #ffffff; padding: 28px 24px; text-align: center; }}
  .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }}
  .content {{ padding: 28px 24px; }}
  .lead {{ font-size: 15px; color: #475569; line-height: 1.6; margin-top: 0; }}
  .card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 20px; margin: 20px 0; }}
  .card-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 14px; }}
  .card-row:last-child {{ border-bottom: none; }}
  .label {{ color: #64748b; font-weight: 500; }}
  .val {{ font-weight: 600; color: #0f172a; word-break: break-all; }}
  .btn {{ display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 15px 0; }}
  .footer {{ background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>CRM Relationship Portal</h1>
  </div>
  <div class="content">
    <p class="lead">Dear <strong>{full_name}</strong>,</p>
    <p class="lead">Welcome aboard! Your employee account has been created successfully. Below are your official login credentials to access the portal:</p>
    
    <div class="card">
      <div class="card-row"><span class="label">Employee ID:</span><span class="val">{user.username}</span></div>
      <div class="card-row"><span class="label">Email Address:</span><span class="val">{user.email}</span></div>
      <div class="card-row"><span class="label">Temporary Password:</span><span class="val" style="color: #2563eb; font-size: 15px;">{plain_password}</span></div>
      <div class="card-row"><span class="label">Assigned Role:</span><span class="val">{role_display}</span></div>
      <div class="card-row"><span class="label">Designation:</span><span class="val">{user.designation or 'Team Member'}</span></div>
      <div class="card-row"><span class="label">Department:</span><span class="val">{user.department or 'General Operations'}</span></div>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="http://demo.ygrgobalitservices.com/login" class="btn" target="_blank">Sign In to Portal</a>
    </div>

    <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
      <em>Security Notice:</em> Please sign in and update your temporary password immediately upon your first login.
    </p>
  </div>
  <div class="footer">
    HR Operations &bull; CRM Relationship Portal &bull; All rights reserved.
  </div>
</div>
</body>
</html>
"""

    return dispatch_email_with_fallback(subject, plain_message, [user.email], html_message=html_message)



def send_team_allocation_email(project, employee, role_in_team, team_lead):
    """Dispatches formal team allocation email to employee when hired into a project team"""
    recipient_email = employee.email or f"{employee.username.lower()}@crm.com"
    emp_name = employee.get_full_name() or employee.username
    lead_name = team_lead.get_full_name() or team_lead.username if team_lead else "Team Lead"
    lead_email = team_lead.email if team_lead and team_lead.email else "N/A"
    client_name = project.client.name if project.client else "N/A"

    subject = f"You have been assigned to Project Team: {project.title} | Apex CRM"
    message = f"""Dear {emp_name},

Congratulations! You have been officially allocated to a project team by your Team Lead ({lead_name}).

Project Allocation Details:
--------------------------------------------------
Project Title:        {project.title}
Client Company:       {client_name}
Your Role in Team:    {role_in_team}
Team Lead Name:       {lead_name}
Team Lead Email:      {lead_email}
--------------------------------------------------

What's Next?
Please log into your Employee Workspace on the CRM Portal to view your project overview, delegated tasks, and join your Project Team Chat Channel on Teams Messenger.

Portal Sign-In: http://demo.ygrgobalitservices.com/login

Best regards,
{lead_name} & Project Operations Team
Apex CRM Platform
"""

    return dispatch_email_with_fallback(subject, message, [recipient_email])


def send_group_invite_email(group, invited_user, inviter, invite_url):
    """Dispatches email notification when a user is invited to a Teams Messenger Group"""
    recipient_email = invited_user.email or f"{invited_user.username.lower()}@crm.com"
    user_name = invited_user.get_full_name() or invited_user.username
    inviter_name = inviter.get_full_name() or inviter.username if inviter else "Team Member"

    subject = f"Group Invitation: Join '{group.name}' on Teams Messenger | Apex CRM"
    message = f"""Dear {user_name},

You have been invited by {inviter_name} to join the group chat room '{group.name}' on Teams Messenger.

Group Invitation Summary:
--------------------------------------------------
Group Name:      {group.name}
Description:     {group.description or 'No description provided.'}
Invited By:      {inviter_name}
Direct Join Link: {invite_url}
--------------------------------------------------

Click the link above (or log in to your CRM Portal) to accept the invitation and join your team in real-time discussion.

Best regards,
Teams Messenger Bot
Apex CRM Platform
"""

    return dispatch_email_with_fallback(subject, message, [recipient_email])


def send_invoice_issued_email(invoice):
    """Dispatches formal invoice statement & billing details to client via email when issued"""
    client = invoice.client
    if not client or not client.email:
        logger.warning(f"No client email found for invoice #{invoice.invoice_number}. Email skipped.")
        return False

    client_name = client.name
    client_company = f" ({client.company})" if client.company else ""
    project_info = f"\nProject Name:           {invoice.project.title}" if invoice.project else ""

    subject = f"Invoice Issued: #{invoice.invoice_number} | SS CHAKRAVARTHY CRM"
    message = f"""Dear {client_name}{client_company},

Your official invoice #{invoice.invoice_number} has been generated and issued by SS CHAKRAVARTHY CRM.

Invoice Details:
--------------------------------------------------
Invoice Number:         #{invoice.invoice_number}
Client Name:            {client_name}
Issue Date:             {invoice.issue_date or 'Today'}{project_info}
Due Date:               {invoice.due_date}
Payment Status:         {invoice.get_status_display()}
--------------------------------------------------

Financial Breakdown:
--------------------------------------------------
Subtotal Base Amount:   ${float(invoice.amount):,.2f}
Tax Rate:               {invoice.tax_rate}%
Total Amount Due:       ${float(invoice.total_amount):,.2f}
--------------------------------------------------

Please process payment on or before the due date ({invoice.due_date}).
If you have any questions or require payment assistance, please reply to this email or contact your account manager.

Thank you for your business!

Best regards,
Billing & Finance Team
SS CHAKRAVARTHY CRM
"""

    return dispatch_email_with_fallback(subject, message, [client.email])


def create_notification(recipient, title, message, notification_type='SYSTEM', sender=None, link_tab=None, reference_id=None):
    """
    Creates an in-app notification for a user.
    """
    from .models import Notification
    try:
        if not recipient:
            return None
        return Notification.objects.create(
            recipient=recipient,
            sender=sender,
            title=title,
            message=message,
            notification_type=notification_type,
            link_tab=link_tab,
            reference_id=str(reference_id) if reference_id else None
        )
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        return None



