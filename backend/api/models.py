from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    """Extended profile linked to Django's built-in User model."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, blank=True)
    is_enrolled = models.BooleanField(default=False)
    enrollment_date = models.DateTimeField(null=True, blank=True)
    
    # Stores the 20-dimensional MFCC voiceprint vector
    voiceprint = models.JSONField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Profile({self.user.username})"


class Transaction(models.Model):
    """Represents a single financial transaction with risk assessment and auth result."""

    class Status(models.TextChoices):
        PENDING   = 'PENDING',   'Pending'
        ALLOWED   = 'ALLOWED',   'Allowed'
        ESCALATED = 'ESCALATED', 'Escalated'
        DENIED    = 'DENIED',    'Denied'

    user              = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    amount            = models.DecimalField(max_digits=12, decimal_places=2)
    payee_name        = models.CharField(max_length=200)
    payee_account     = models.CharField(max_length=50, blank=True)
    description       = models.CharField(max_length=500, blank=True)
    status            = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    # Risk engine output
    risk_score        = models.FloatField(default=0.0)
    risk_factors      = models.JSONField(default=dict)
    challenge_required = models.BooleanField(default=False)

    # Challenge results (filled after step-up)
    liveness_passed   = models.BooleanField(null=True, blank=True)
    audio_matched     = models.BooleanField(null=True, blank=True)
    transcription     = models.TextField(blank=True)
    decision_rationale = models.TextField(blank=True)

    # Admin review (for ESCALATED transactions)
    reviewed_by       = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_transactions'
    )
    review_note       = models.TextField(blank=True)
    reviewed_at       = models.DateTimeField(null=True, blank=True)

    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Txn#{self.pk} {self.user.username} ₹{self.amount} → {self.payee_name} [{self.status}]"


class AuditLog(models.Model):
    """Tamper-evident event log. One row per event in a transaction lifecycle."""

    class EventType(models.TextChoices):
        TRANSACTION_CREATED  = 'TRANSACTION_CREATED',  'Transaction Created'
        RISK_ASSESSED        = 'RISK_ASSESSED',         'Risk Assessed'
        CHALLENGE_STARTED    = 'CHALLENGE_STARTED',     'Challenge Started'
        LIVENESS_PASS        = 'LIVENESS_PASS',         'Liveness Passed'
        LIVENESS_FAIL        = 'LIVENESS_FAIL',         'Liveness Failed'
        AUDIO_MATCH          = 'AUDIO_MATCH',           'Audio Code Matched'
        AUDIO_FAIL           = 'AUDIO_FAIL',            'Audio Code Failed'
        DECISION_ALLOW       = 'DECISION_ALLOW',        'Decision: Allow'
        DECISION_DENY        = 'DECISION_DENY',         'Decision: Deny'
        DECISION_ESCALATE    = 'DECISION_ESCALATE',     'Decision: Escalate'
        ADMIN_APPROVED       = 'ADMIN_APPROVED',        'Admin Approved'
        ADMIN_REJECTED       = 'ADMIN_REJECTED',        'Admin Rejected'
        LOW_RISK_PASSTHROUGH = 'LOW_RISK_PASSTHROUGH',  'Low-Risk Auto-Passthrough'

    transaction  = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name='audit_logs')
    event_type   = models.CharField(max_length=40, choices=EventType.choices)
    detail       = models.JSONField(default=dict)
    timestamp    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"[{self.timestamp:%H:%M:%S}] Txn#{self.transaction_id} — {self.event_type}"
