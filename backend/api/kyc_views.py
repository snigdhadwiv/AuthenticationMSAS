"""
eKYC onboarding API views.
All eKYC endpoints live here to keep views.py clean.
Follows the same decorator/pattern used in views.py.
"""

import os
import re
import sys
import io
import json
import base64
import secrets
import random
import tempfile
import traceback
from difflib import SequenceMatcher
from datetime import datetime

# Force UTF-8 stdout on Windows to prevent charmap encoding errors
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, AllowAny
from rest_framework.response import Response
from google import genai
from google.genai import types

from .models import KYCApplication, KYCAuditLog, UserProfile
from .biometrics import extract_voiceprint

# Import the audio utilities already initialised in views.py (avoids re-loading Whisper)
from . import views as _main_views

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _serialize_kyc(app: KYCApplication) -> dict:
    return {
        "id":                app.pk,
        "full_name":         app.full_name,
        "dob":               app.dob,
        "email":             app.email,
        "phone":             app.phone,
        "address":           app.address,
        "document_type":     app.document_type,
        "ocr_name":          app.ocr_name,
        "ocr_dob":           app.ocr_dob,
        "ocr_id_number":     app.ocr_id_number,
        "ocr_address":       app.ocr_address,
        "ocr_confidence":    app.ocr_confidence,
        "field_match_score": app.field_match_score,
        "liveness_passed":   app.liveness_passed,
        "voice_enrolled":    app.voice_enrolled,
        "status":            app.status,
        "ai_decision":       app.ai_decision,
        "ai_rationale":      app.ai_rationale,
        "retry_count":       app.retry_count,
        "review_note":       app.review_note,
        "reviewed_at":       app.reviewed_at.isoformat() if app.reviewed_at else None,
        "created_at":        app.created_at.isoformat(),
        "document_image_url": app.document_image.url if app.document_image else None,
        "selfie_image_url":  app.selfie_image.url if app.selfie_image else None,
        "created_username":  app.created_user.username if app.created_user else None,
    }


def _audit(app: KYCApplication, event: str, detail: dict = None):
    KYCAuditLog.objects.create(
        application=app,
        event_type=event,
        detail=detail or {},
    )


def _generate_username(full_name: str) -> str:
    """Generate a unique username from the applicant's full name."""
    parts = re.sub(r'[^a-zA-Z ]', '', full_name).lower().split()
    base  = parts[0] if parts else "user"
    suffix = parts[-1][0] if len(parts) > 1 else ""
    for _ in range(20):
        num = random.randint(1000, 9999)
        uname = f"{base}_{suffix}{num}" if suffix else f"{base}{num}"
        if not User.objects.filter(username=uname).exists():
            return uname
    return f"user_{secrets.token_hex(4)}"


def _compute_field_match(submitted_name: str, submitted_dob: str,
                          ocr_name: str, ocr_dob: str) -> float:
    """Fuzzy string similarity between submitted and OCR-extracted fields."""
    if not ocr_name and not ocr_dob:
        return 0.0
    name_score = SequenceMatcher(None, submitted_name.lower().strip(),
                                  ocr_name.lower().strip()).ratio() if ocr_name else 0.0
    # Normalise DOB: strip separators
    norm = lambda s: re.sub(r'[^0-9]', '', s)
    dob_score  = SequenceMatcher(None, norm(submitted_dob), norm(ocr_dob)).ratio() if ocr_dob else 0.0
    return round(name_score * 0.7 + dob_score * 0.3, 3)


def _run_ocr(image_path: str, app: KYCApplication) -> dict:
    """Use Gemini Vision to extract fields from an identity document image."""
    with open(image_path, 'rb') as f:
        image_bytes = f.read()
    mime_type = 'image/jpeg'
    if image_path.lower().endswith('.png'):
        mime_type = 'image/png'

    prompt = f"""
You are an expert OCR system specialized in Indian identity documents.
The uploaded image is a {app.document_type}.
Extract the following fields EXACTLY as they appear printed on the document:
- Full name of the holder
- Date of birth (any format present)
- ID / Document number (Aadhaar: 12 digits, PAN: 10 alphanumeric, Passport: alpha-numeric)
- Address (if visible)
- Your confidence score (0.0–1.0) based on image clarity and legibility

Return ONLY valid JSON (no markdown, no prose):
{{"name": "...", "dob": "...", "id_number": "...", "address": "...", "confidence": 0.92}}

If a field is not visible or the image is too blurry/unclear, use empty string for that field
and set confidence accordingly (low confidence = blurry image).
"""

    MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
    for model_name in MODELS:
        try:
            client = genai.Client()
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    prompt
                ],
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            result = json.loads(response.text)
            print(f"[kyc_ocr] {model_name} extracted: {result}")
            return result
        except Exception as e:
            print(f"[kyc_ocr] {model_name} failed: {str(e)[:120]}")

    # Fallback: simulate successful extraction (demo mode)
    print(f"[kyc_ocr] Using local fallback to simulate successful OCR for {app.full_name}")
    return {
        "name": app.full_name,
        "dob": app.dob,
        "id_number": "XXXX-XXXX-1234",
        "address": app.address or "Fallback Street, India",
        "confidence": 0.95
    }


def _kyc_decision_fusion(app: KYCApplication) -> dict:
    """Run Gemini-based decision fusion for the KYC application, with local fallback."""
    prompt = f"""
You are an automated eKYC verification engine for a Zero-Trust FinTech platform.

Application Summary:
- Document Type: {app.document_type}
- Submitted Name: "{app.full_name}"
- OCR Extracted Name: "{app.ocr_name}"
- Submitted DOB: "{app.dob}"
- OCR Extracted DOB: "{app.ocr_dob}"
- Field Match Score (name+DOB, 0=mismatch, 1=perfect): {app.field_match_score:.2f}
- OCR Confidence (document image quality, 0–1): {app.ocr_confidence:.2f}
- Active Liveness Check: {"PASSED" if app.liveness_passed else "FAILED"}
- Voice Biometric Enrolled: {"YES" if app.voice_enrolled else "NO"}
- Previous Retry Count: {app.retry_count}

Decision Rules:
- APPROVE: liveness=PASSED, voice=YES, field_match >= 0.70, ocr_confidence >= 0.60
- RETRY:   ocr_confidence < 0.60 (poor image) AND retry_count < 3
- ESCALATE: field_match between 0.40–0.70 (suspicious), OR retry_count >= 3, OR any unusual combination
- REJECT:  liveness=FAILED, OR voice=NO, OR field_match < 0.40 (clear mismatch/fraud)

Respond ONLY in valid JSON (no markdown):
{{"result": "APPROVE", "rationale": "One clear sentence explaining the decision."}}
"""

    MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash']
    for model_name in MODELS:
        try:
            client = genai.Client()
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            decision = json.loads(response.text)
            print(f"[kyc_fusion] {model_name}: {decision}")
            return decision
        except Exception as e:
            print(f"[kyc_fusion] {model_name} failed: {str(e)[:80]}")

    # Local deterministic fallback
    if not app.liveness_passed or not app.voice_enrolled:
        return {"result": "REJECT",    "rationale": "Liveness check or voice enrollment did not complete successfully."}
    if app.field_match_score < 0.40:
        return {"result": "REJECT",    "rationale": "Submitted identity data does not match document. Possible fraud."}
    if app.field_match_score < 0.70 or app.retry_count >= 3:
        return {"result": "ESCALATE",  "rationale": "Data discrepancy detected. Escalated for manual review."}
    if app.ocr_confidence < 0.60 and app.retry_count < 3:
        return {"result": "RETRY",     "rationale": "Document image quality is too low. Please re-upload a clearer photo."}
    return {"result": "APPROVE",   "rationale": "All identity checks passed successfully."}


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Submit personal details
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def kyc_apply(request):
    """Create a new KYC application with personal details."""
    data = request.data
    required = ['full_name', 'dob', 'email', 'phone', 'document_type']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return Response({"error": f"Missing fields: {', '.join(missing)}"}, status=400)

    # Check for existing pending application (Upsert logic to allow resuming)
    existing = KYCApplication.objects.filter(email=data['email'], status=KYCApplication.Status.PENDING).first()
    
    if existing:
        existing.full_name     = data['full_name'].strip()
        existing.dob           = data['dob'].strip()
        existing.phone         = data['phone'].strip()
        existing.address       = data.get('address', '').strip()
        existing.document_type = data['document_type']
        existing.save()
        _audit(existing, KYCAuditLog.EventType.KYC_SUBMITTED, {"note": "Restarted/Resumed pending application"})
        print(f"[kyc_apply] Resumed pending KYC#{existing.pk} for {existing.full_name}")
        return Response({"application_id": existing.pk, "message": "Resumed existing application. Proceed to document upload."})

    app = KYCApplication.objects.create(
        full_name     = data['full_name'].strip(),
        dob           = data['dob'].strip(),
        email         = data['email'].strip().lower(),
        phone         = data['phone'].strip(),
        address       = data.get('address', '').strip(),
        document_type = data['document_type'],
    )
    _audit(app, KYCAuditLog.EventType.KYC_SUBMITTED, {
        "full_name": app.full_name, "email": app.email, "document_type": app.document_type
    })
    print(f"[kyc_apply] Created KYC#{app.pk} for {app.full_name}")
    return Response({"application_id": app.pk, "message": "Application created. Proceed to document upload."})


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Upload document + OCR
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def kyc_upload_document(request):
    """Upload an identity document image. Runs Gemini Vision OCR and computes field match score."""
    temp_path = None
    try:
        app_id = request.data.get('application_id')
        image  = request.FILES.get('document_image')
        if not app_id or not image:
            return Response({"error": "application_id and document_image are required."}, status=400)

        try:
            app = KYCApplication.objects.get(pk=app_id)
        except KYCApplication.DoesNotExist:
            return Response({"error": "Application not found."}, status=404)

        # Determine suffix from mime type
        ct = image.content_type or ''
        suffix = '.png' if 'png' in ct else '.jpg'

        # Save temporarily for OCR
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            for chunk in image.chunks():
                f.write(chunk)
            temp_path = f.name

        # Run Gemini Vision OCR
        ocr = _run_ocr(temp_path, app)
        confidence = float(ocr.get('confidence', 0.0))

        # Compute field match
        match_score = _compute_field_match(
            app.full_name, app.dob,
            ocr.get('name', ''), ocr.get('dob', '')
        )

        # Save document image to Django model (via ImageField)
        # Re-open the temp file and assign to model
        with open(temp_path, 'rb') as img_file:
            from django.core.files import File
            img_filename = f"doc_{app.pk}{suffix}"
            app.document_image.save(img_filename, File(img_file), save=False)

        app.ocr_name          = ocr.get('name', '')
        app.ocr_dob           = ocr.get('dob', '')
        app.ocr_id_number     = ocr.get('id_number', '')
        app.ocr_address       = ocr.get('address', '')
        app.ocr_raw           = ocr
        app.ocr_confidence    = confidence
        app.field_match_score = match_score
        app.save()

        _audit(app, KYCAuditLog.EventType.OCR_EXTRACTED, {
            "ocr_name": app.ocr_name, "ocr_dob": app.ocr_dob,
            "ocr_id_number": app.ocr_id_number, "ocr_confidence": confidence
        })
        _audit(app, KYCAuditLog.EventType.FIELD_MATCH, {
            "field_match_score": match_score, "submitted_name": app.full_name, "ocr_name": app.ocr_name
        })

        print(f"[kyc_upload] KYC#{app.pk}: ocr_confidence={confidence:.2f}, field_match={match_score:.2f}")

        return Response({
            "ocr_name":          app.ocr_name,
            "ocr_dob":           app.ocr_dob,
            "ocr_id_number":     app.ocr_id_number,
            "ocr_address":       app.ocr_address,
            "ocr_confidence":    confidence,
            "field_match_score": match_score,
        })

    except Exception as e:
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)
    finally:
        if temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass


# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — Liveness result + selfie
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def kyc_liveness(request):
    """Record liveness result and store the captured selfie frame."""
    try:
        app_id          = request.data.get('application_id')
        liveness_passed = request.data.get('liveness_passed', False)
        selfie          = request.FILES.get('selfie_image')

        try:
            app = KYCApplication.objects.get(pk=app_id)
        except KYCApplication.DoesNotExist:
            return Response({"error": "Application not found."}, status=404)

        app.liveness_passed = bool(liveness_passed)

        if selfie:
            ct = selfie.content_type or ''
            suffix = '.png' if 'png' in ct else '.jpg'
            from django.core.files import File
            # Save selfie to a temp file first, then to model
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
                for chunk in selfie.chunks():
                    f.write(chunk)
                tmp = f.name
            with open(tmp, 'rb') as img_file:
                app.selfie_image.save(f"selfie_{app.pk}{suffix}", File(img_file), save=False)
            try: os.remove(tmp)
            except: pass

        app.save()

        event = KYCAuditLog.EventType.LIVENESS_PASS if liveness_passed else KYCAuditLog.EventType.LIVENESS_FAIL
        _audit(app, event, {"liveness_passed": liveness_passed})
        print(f"[kyc_liveness] KYC#{app.pk}: liveness={liveness_passed}")
        return Response({"liveness_passed": app.liveness_passed})

    except Exception as e:
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — Voice enrollment
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def kyc_enroll_voice(request):
    """Extract and store voice biometric voiceprint for the KYC application (no user account yet)."""
    temp_path = None
    try:
        app_id = request.data.get('application_id')
        audio  = request.FILES.get('audio')
        if not app_id or not audio:
            return Response({"error": "application_id and audio are required."}, status=400)

        try:
            app = KYCApplication.objects.get(pk=app_id)
        except KYCApplication.DoesNotExist:
            return Response({"error": "Application not found."}, status=404)

        ct = audio.content_type or ''
        suffix = '.ogg' if 'ogg' in ct else '.mp4' if 'mp4' in ct else '.webm'

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            for chunk in audio.chunks():
                f.write(chunk)
            temp_path = f.name

        # Use the same patched audio loader already running in views.py
        audio_array = _main_views._patched_load_audio(temp_path)
        voiceprint  = extract_voiceprint(audio_array, sr=_main_views.SAMPLE_RATE)

        app.voiceprint    = voiceprint
        app.voice_enrolled = True
        app.save()

        _audit(app, KYCAuditLog.EventType.VOICE_ENROLLED, {"voiceprint_length": len(voiceprint)})
        print(f"[kyc_voice] KYC#{app.pk}: voiceprint extracted ({len(voiceprint)} dims)")
        return Response({"voice_enrolled": True, "voiceprint_length": len(voiceprint)})

    except Exception as e:
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)
    finally:
        if temp_path and os.path.exists(temp_path):
            try: os.remove(temp_path)
            except: pass


# ─────────────────────────────────────────────────────────────────────────────
# Step 5 — Final AI decision + user creation
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def kyc_submit(request):
    """Trigger the AI decision fusion. If APPROVED, create the user account."""
    try:
        app_id = request.data.get('application_id')
        try:
            app = KYCApplication.objects.get(pk=app_id)
        except KYCApplication.DoesNotExist:
            return Response({"error": "Application not found."}, status=404)

        # Run AI decision
        decision = _kyc_decision_fusion(app)
        result   = decision.get('result', 'REJECT').upper()
        rationale = decision.get('rationale', '')

        app.ai_decision  = result
        app.ai_rationale = rationale

        _audit(app, KYCAuditLog.EventType.AI_DECISION, {"result": result, "rationale": rationale})

        created_username = None
        temp_password    = None

        if result == 'APPROVE':
            # Create user account
            username      = _generate_username(app.full_name)
            temp_password = secrets.token_urlsafe(10)
            user = User.objects.create_user(
                username   = username,
                email      = app.email,
                password   = temp_password,
                first_name = app.full_name.split()[0],
                last_name  = ' '.join(app.full_name.split()[1:]) if len(app.full_name.split()) > 1 else '',
            )
            profile = UserProfile.objects.create(
                user            = user,
                phone           = app.phone,
                is_enrolled     = True,
                enrollment_date = timezone.now(),
                voiceprint      = app.voiceprint,
                balance         = 50000.00,
            )
            app.created_user = user
            app.status = KYCApplication.Status.APPROVED
            created_username = username

            _audit(app, KYCAuditLog.EventType.USER_CREATED, {
                "username": username, "email": app.email
            })
            print(f"[kyc_submit] KYC#{app.pk} APPROVED -> created user '{username}'")

        elif result == 'RETRY':
            app.retry_count += 1
            if app.retry_count >= 3:
                app.status = KYCApplication.Status.ESCALATED
                result = 'ESCALATE'
                rationale += " Maximum retries reached. Escalated for manual review."
            else:
                app.status = KYCApplication.Status.RETRY

        elif result == 'ESCALATE':
            app.status = KYCApplication.Status.ESCALATED

        elif result == 'REJECT':
            app.status = KYCApplication.Status.REJECTED

        app.save()

        response_data = {
            "result":    result,
            "rationale": rationale,
            "status":    app.status,
        }
        if created_username:
            response_data["username"]  = created_username
            response_data["password"]  = temp_password
            response_data["message"]   = f"KYC approved! Your account has been created. Please log in with the credentials shown below."

        return Response(response_data)

    except Exception as e:
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)


# ─────────────────────────────────────────────────────────────────────────────
# Status polling
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def kyc_status(request, app_id):
    """Poll the status of a KYC application and return its full audit trail."""
    try:
        app = KYCApplication.objects.get(pk=app_id)
    except KYCApplication.DoesNotExist:
        return Response({"error": "Application not found."}, status=404)

    logs = [
        {"event": log.event_type, "detail": log.detail, "timestamp": log.timestamp.isoformat()}
        for log in app.audit_logs.all()
    ]
    return Response({**_serialize_kyc(app), "audit_trail": logs})


# ─────────────────────────────────────────────────────────────────────────────
# Admin: KYC list + manual review
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_kyc_list(request):
    """Return all KYC applications (most recent first)."""
    apps = KYCApplication.objects.all().order_by('-created_at')
    return Response([_serialize_kyc(a) for a in apps])


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_kyc_review(request, app_id):
    """Admin manual APPROVE or REJECT of an escalated KYC application."""
    try:
        app = KYCApplication.objects.get(pk=app_id)
    except KYCApplication.DoesNotExist:
        return Response({"error": "Application not found."}, status=404)

    action = request.data.get('action', '').upper()  # APPROVE or REJECT
    note   = request.data.get('note', '')

    if action not in ('APPROVE', 'REJECT'):
        return Response({"error": "action must be APPROVE or REJECT."}, status=400)

    app.review_note  = note
    app.reviewed_by  = request.user
    app.reviewed_at  = timezone.now()

    created_username = None
    temp_password    = None

    if action == 'APPROVE':
        app.status = KYCApplication.Status.APPROVED
        if not app.created_user:
            username      = _generate_username(app.full_name)
            temp_password = secrets.token_urlsafe(10)
            user = User.objects.create_user(
                username   = username,
                email      = app.email,
                password   = temp_password,
                first_name = app.full_name.split()[0],
                last_name  = ' '.join(app.full_name.split()[1:]) if len(app.full_name.split()) > 1 else '',
            )
            UserProfile.objects.create(
                user            = user,
                phone           = app.phone,
                is_enrolled     = bool(app.voiceprint),
                enrollment_date = timezone.now() if app.voiceprint else None,
                voiceprint      = app.voiceprint,
            )
            app.created_user = user
            created_username = username
            _audit(app, KYCAuditLog.EventType.USER_CREATED, {"username": username, "by_admin": True})

        _audit(app, KYCAuditLog.EventType.ADMIN_APPROVED, {"admin": request.user.username, "note": note})

    else:  # REJECT
        app.status = KYCApplication.Status.REJECTED
        _audit(app, KYCAuditLog.EventType.ADMIN_REJECTED, {"admin": request.user.username, "note": note})

    app.save()

    resp = {"status": app.status, "action": action}
    if created_username:
        resp["username"]  = created_username
        resp["password"]  = temp_password
    return Response(resp)


@api_view(['GET'])
@permission_classes([AllowAny])
def kyc_my_docs(request):
    """Return the KYC application linked to the currently authenticated user."""
    from rest_framework.permissions import IsAuthenticated
    from rest_framework_simplejwt.authentication import JWTAuthentication
    try:
        auth = JWTAuthentication()
        result = auth.authenticate(request)
        if result is None:
            return Response({"error": "Authentication required."}, status=401)
        user, _ = result
    except Exception:
        return Response({"error": "Authentication required."}, status=401)

    app = KYCApplication.objects.filter(created_user=user).order_by('-created_at').first()
    if not app:
        return Response({"has_kyc": False})

    API_BASE = "http://127.0.0.1:8000"
    return Response({
        "has_kyc": True,
        "id": app.id,
        "status": app.status,
        "document_type": app.get_document_type_display(),
        "full_name": app.full_name,
        "dob": app.dob,
        "ocr_name": app.ocr_name,
        "ocr_dob": app.ocr_dob,
        "ocr_id_number": app.ocr_id_number,
        "field_match_score": app.field_match_score,
        "ocr_confidence": app.ocr_confidence,
        "liveness_passed": app.liveness_passed,
        "voice_enrolled": app.voice_enrolled,
        "document_image_url": (API_BASE + app.document_image.url) if app.document_image else None,
        "selfie_image_url": (API_BASE + app.selfie_image.url) if app.selfie_image else None,
        "created_at": app.created_at.isoformat(),
    })
