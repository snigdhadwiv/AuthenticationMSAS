from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from . import kyc_views

urlpatterns = [
    # ── Auth ─────────────────────────────────────────────────────────────────
    path('auth/login/',   views.login_view,    name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/',      views.me_view,       name='me'),
    path('enroll-voice/', views.enroll_voice,  name='enroll_voice'),

    # ── Admin ─────────────────────────────────────────────────────────────────
    path('admin/analytics/',                  views.admin_analytics,   name='admin_analytics'),
    path('admin/users/',                      views.admin_list_users,  name='admin_list_users'),
    path('admin/users/create/',               views.admin_create_user, name='admin_create_user'),
    path('admin/users/<int:user_id>/delete/', views.admin_delete_user, name='admin_delete_user'),
    path('admin/escalations/',                views.admin_escalations, name='admin_escalations'),
    path('admin/review/<int:txn_id>/',        views.admin_review,      name='admin_review'),
    path('admin/audit-log/',                  views.admin_audit_log,   name='admin_audit_log'),

    # ── Admin KYC ─────────────────────────────────────────────────────────────
    path('admin/kyc/',                        kyc_views.admin_kyc_list,   name='admin_kyc_list'),
    path('admin/kyc/<int:app_id>/review/',    kyc_views.admin_kyc_review, name='admin_kyc_review'),

    # ── User ─────────────────────────────────────────────────────────────────
    path('transactions/',                             views.user_transactions,    name='user_transactions'),
    path('transactions/initiate/',                    views.initiate_transaction, name='initiate_transaction'),
    path('transactions/<int:txn_id>/audit/',          views.transaction_audit_log, name='transaction_audit_log'),
    path('transactions/save-decision/',               views.save_decision,        name='save_decision'),

    # ── ML Core ───────────────────────────────────────────────────────────────
    path('verify-audio/',    views.verify_audio,    name='verify_audio'),
    path('decision-fusion/', views.decision_fusion, name='decision_fusion'),

    # ── eKYC Onboarding (public — no auth required) ────────────────────────
    path('kyc/apply/',            kyc_views.kyc_apply,           name='kyc_apply'),
    path('kyc/upload-document/',  kyc_views.kyc_upload_document, name='kyc_upload_document'),
    path('kyc/liveness/',         kyc_views.kyc_liveness,        name='kyc_liveness'),
    path('kyc/enroll-voice/',     kyc_views.kyc_enroll_voice,    name='kyc_enroll_voice'),
    path('kyc/submit/',           kyc_views.kyc_submit,          name='kyc_submit'),
    path('kyc/status/<int:app_id>/', kyc_views.kyc_status,       name='kyc_status'),
    path('kyc/my-docs/',          kyc_views.kyc_my_docs,         name='kyc_my_docs'),
    path('kyc/admin/list/',       kyc_views.admin_kyc_list,      name='kyc_admin_list'),
]
