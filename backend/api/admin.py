from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Client, Project, ProjectMember, Task, Invoice, Payment, SupportRequest

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('CRM Extra Info', {'fields': ('role', 'phone', 'designation', 'department', 'is_available')}),
    )
    list_display = ('username', 'email', 'role', 'designation', 'department', 'is_available')
    list_filter = ('role', 'department', 'is_available')

admin.site.register(Client)
admin.site.register(Project)
admin.site.register(ProjectMember)
admin.site.register(Task)
admin.site.register(Invoice)
admin.site.register(Payment)
admin.site.register(SupportRequest)
