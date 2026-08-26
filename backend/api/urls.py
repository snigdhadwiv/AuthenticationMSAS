from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # ── Auth ─────────────────────────────────────────────────────────────────
    path('auth/login/',   views.login_view,    name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/',      views.me_view,       name='me'),
    path('enroll-voice/', views.enroll_voice,  name='enroll_voice'),

    # ── Admin ─────────────────────────────────────────────────────────────────
    path('admin/users/',                  views.admin_list_users,  name='admin_list_users'),
    path('admin/users/create/',           views.admin_create_user, name='admin_create_user'),
    path('admin/users/<int:user_id>/delete/', views.admin_delete_user, name='admin_delete_user'),
    path('admin/escalations/',            views.admin_escalations, name='admin_escalations'),
    path('admin/review/<int:txn_id>/',    views.admin_review,      name='admin_review'),
    path('admin/audit-log/',              views.admin_audit_log,   name='admin_audit_log'),

    # ── User ─────────────────────────────────────────────────────────────────
    path('transactions/',                             views.user_transactions,    name='user_transactions'),
    path('transactions/initiate/',                    views.initiate_transaction, name='initiate_transaction'),
    path('transactions/<int:txn_id>/audit/',          views.transaction_audit_log, name='transaction_audit_log'),
    path('transactions/save-decision/',               views.save_decision,        name='save_decision'),

    # ── ML Core ───────────────────────────────────────────────────────────────
    path('verify-audio/',    views.verify_audio,    name='verify_audio'),
    path('decision-fusion/', views.decision_fusion, name='decision_fusion'),
]
