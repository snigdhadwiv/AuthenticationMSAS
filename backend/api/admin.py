from django.contrib.auth.models import User
from django.contrib import admin
from .models import UserProfile, Transaction, AuditLog


# ── Inline audit log in Transaction admin ─────────────────────────────────────
class AuditLogInline(admin.TabularInline):
    model = AuditLog
    extra = 0
    readonly_fields = ('event_type', 'detail', 'timestamp')
    can_delete = False


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone', 'is_enrolled', 'enrollment_date', 'created_at')
    list_filter = ('is_enrolled',)
    search_fields = ('user__username', 'user__email')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'amount', 'payee_name', 'status',
        'risk_score', 'challenge_required', 'created_at'
    )
    list_filter = ('status', 'challenge_required')
    search_fields = ('user__username', 'payee_name')
    readonly_fields = ('created_at', 'updated_at', 'risk_factors')
    inlines = [AuditLogInline]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'event_type', 'timestamp')
    list_filter = ('event_type',)
    readonly_fields = ('transaction', 'event_type', 'detail', 'timestamp')
