import os
import sys
import time
import tempfile
import traceback
import json
import subprocess
import numpy as np
import imageio_ffmpeg
from datetime import datetime

from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from google import genai
from google.genai import types

from .models import UserProfile, Transaction, AuditLog
from .risk_engine import compute_risk_score
from .biometrics import extract_voiceprint, verify_speaker

# ── FFmpeg Setup ──────────────────────────────────────────────────────────────
FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
print(f"[startup] ffmpeg binary : {FFMPEG_PATH}")

# ── Monkey-patch Whisper's load_audio to use bundled ffmpeg ──────────────────
import whisper
import whisper.audio as _whisper_audio

SAMPLE_RATE = _whisper_audio.SAMPLE_RATE


def _patched_load_audio(file: str, sr: int = SAMPLE_RATE):
    cmd = [
        FFMPEG_PATH, "-nostdin", "-threads", "0",
        "-i", file,
        "-f", "s16le", "-ac", "1", "-acodec", "pcm_s16le", "-ar", str(sr),
        "pipe:1",
    ]
    out = subprocess.run(cmd, capture_output=True, check=True)
    return np.frombuffer(out.stdout, np.int16).flatten().astype(np.float32) / 32768.0


_whisper_audio.load_audio = _patched_load_audio
whisper.audio.load_audio  = _patched_load_audio
print("[startup] Whisper load_audio patched.")

MODEL = whisper.load_model("base")
print("[startup] Whisper model loaded.")


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Authenticate user and return JWT access + refresh tokens."""
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response({'error': 'Username and password are required.'}, status=400)

    user = authenticate(username=username, password=password)
    if user is None:
        return Response({'error': 'Invalid credentials.'}, status=401)

    refresh = RefreshToken.for_user(user)
    return Response({
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'id':         user.id,
            'username':   user.username,
            'email':      user.email,
            'first_name': user.first_name,
            'last_name':  user.last_name,
            'is_staff':   user.is_staff,
        }
    })


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Return or update the currently authenticated user's info."""
    user = request.user
    profile, _ = UserProfile.objects.get_or_create(user=user)

    if request.method == 'PUT':
        data = request.data
        if 'first_name' in data: user.first_name = data['first_name'].strip()
        if 'last_name' in data:  user.last_name = data['last_name'].strip()
        if 'email' in data:      user.email = data['email'].strip()
        user.save()

        if 'phone' in data:
            profile.phone = data['phone'].strip()
            profile.save()
            
        return Response({"message": "Profile updated successfully"})

    return Response({
        'id':          user.id,
        'username':    user.username,
        'email':       user.email,
        'first_name':  user.first_name,
        'last_name':   user.last_name,
        'phone':       profile.phone,
        'is_staff':    user.is_staff,
        'is_enrolled': profile.is_enrolled,
        'balance':     str(profile.balance),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_analytics(request):
    total_users = User.objects.filter(is_staff=False).count()
    enrolled_users = UserProfile.objects.filter(is_enrolled=True).count()
    
    total_txns = Transaction.objects.count()
    escalated_txns = Transaction.objects.filter(status='ESCALATED').count()
    allowed_txns = Transaction.objects.filter(status='ALLOWED').count()
    denied_txns = Transaction.objects.filter(status='DENIED').count()
    
    from .models import KYCApplication
    pending_kyc = KYCApplication.objects.filter(status='PENDING').count()
    
    # Simple risk breakdown
    high_risk = Transaction.objects.filter(risk_score__gte=0.8).count()
    med_risk = Transaction.objects.filter(risk_score__gte=0.4, risk_score__lt=0.8).count()
    low_risk = Transaction.objects.filter(risk_score__lt=0.4).count()

    return Response({
        'users': {'total': total_users, 'enrolled': enrolled_users},
        'transactions': {
            'total': total_txns, 'escalated': escalated_txns, 
            'allowed': allowed_txns, 'denied': denied_txns
        },
        'risk': {'high': high_risk, 'medium': med_risk, 'low': low_risk},
        'kyc': {'pending': pending_kyc}
    })

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_list_users(request):
    """Return all non-staff users."""
    users = User.objects.filter(is_staff=False).select_related('profile').order_by('-date_joined')
    data = []
    for u in users:
        profile = getattr(u, 'profile', None)
        data.append({
            'id':          u.id,
            'username':    u.username,
            'email':       u.email,
            'first_name':  u.first_name,
            'last_name':   u.last_name,
            'is_active':   u.is_active,
            'is_enrolled': profile.is_enrolled if profile else False,
            'balance':     str(profile.balance) if profile else '50000.00',
            'date_joined': u.date_joined,
        })
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_create_user(request):
    """Admin creates a new end-user account."""
    username   = request.data.get('username', '').strip()
    email      = request.data.get('email', '').strip()
    password   = request.data.get('password', '')
    first_name = request.data.get('first_name', '').strip()
    last_name  = request.data.get('last_name', '').strip()
    phone      = request.data.get('phone', '').strip()

    if not username or not password:
        return Response({'error': 'Username and password are required.'}, status=400)

    if User.objects.filter(username=username).exists():
        return Response({'error': f'Username "{username}" is already taken.'}, status=400)

    user = User.objects.create_user(
        username=username, email=email, password=password,
        first_name=first_name, last_name=last_name,
    )
    profile = UserProfile.objects.create(user=user, phone=phone)

    return Response({
        'id':        user.id,
        'username':  user.username,
        'email':     user.email,
        'message':   f'User "{username}" created successfully.',
    }, status=201)


@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_delete_user(request, user_id):
    """Admin deletes a user account."""
    try:
        user = User.objects.get(pk=user_id, is_staff=False)
        username = user.username
        user.delete()
        return Response({'message': f'User "{username}" deleted.'})
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_escalations(request):
    """Return all ESCALATED transactions pending admin review."""
    txns = (
        Transaction.objects
        .filter(status=Transaction.Status.ESCALATED)
        .select_related('user')
        .order_by('-created_at')
    )
    return Response([_serialize_transaction(t) for t in txns])


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_review(request, txn_id):
    """Admin approves or rejects an escalated transaction."""
    try:
        txn = Transaction.objects.get(pk=txn_id, status=Transaction.Status.ESCALATED)
    except Transaction.DoesNotExist:
        return Response({'error': 'Escalated transaction not found.'}, status=404)

    action = request.data.get('action', '').upper()  # APPROVE or REJECT
    note   = request.data.get('note', '')

    if action not in ('APPROVE', 'REJECT'):
        return Response({'error': 'action must be APPROVE or REJECT.'}, status=400)

    txn.status      = Transaction.Status.ALLOWED if action == 'APPROVE' else Transaction.Status.DENIED
    txn.reviewed_by = request.user
    txn.review_note = note
    txn.reviewed_at = timezone.now()
    txn.save()

    event_type = AuditLog.EventType.ADMIN_APPROVED if action == 'APPROVE' else AuditLog.EventType.ADMIN_REJECTED
    AuditLog.objects.create(
        transaction=txn,
        event_type=event_type,
        detail={'admin': request.user.username, 'note': note},
    )

    return Response({'result': txn.status, 'message': f'Transaction {action.lower()}d by admin.'})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_audit_log(request):
    """Return audit logs across all transactions (admin view)."""
    logs = AuditLog.objects.select_related('transaction', 'transaction__user').order_by('-timestamp')[:200]
    return Response([_serialize_audit_log(log) for log in logs])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def enroll_voice(request):
    """Enroll a user's voiceprint from an audio sample."""
    temp_path = None
    try:
        audio_file = request.FILES.get('audio')
        if not audio_file:
            return Response({"error": "No audio file provided."}, status=400)

        content_type = audio_file.content_type or ''
        suffix = '.ogg' if 'ogg' in content_type else '.mp4' if 'mp4' in content_type else '.webm'

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            for chunk in audio_file.chunks():
                f.write(chunk)
            temp_path = f.name

        # Load audio using the patched ffmpeg loader
        audio_array = _patched_load_audio(temp_path)
        
        # Extract voiceprint
        voiceprint = extract_voiceprint(audio_array, sr=SAMPLE_RATE)
        
        # Save to user profile
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        profile.voiceprint = voiceprint
        profile.is_enrolled = True
        profile.enrollment_date = timezone.now()
        profile.save()

        return Response({
            "message": "Voice biometrics enrolled successfully.",
            "voiceprint_length": len(voiceprint)
        })

    except Exception as e:
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════════════════════
# USER ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_transaction(request):
    """
    User initiates a transaction.
    Runs the risk engine and returns risk score + whether step-up is required.
    """
    amount     = float(request.data.get('amount', 0))
    payee_name = request.data.get('payee_name', '').strip()
    payee_acct = request.data.get('payee_account', '').strip()
    desc       = request.data.get('description', '').strip()

    if amount <= 0 or not payee_name:
        return Response({'error': 'Amount and payee name are required.'}, status=400)

    # ── Balance check ──────────────────────────────────────────────────────────
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if float(profile.balance) < amount:
        return Response({
            'error': f'Insufficient balance. Your current balance is ₹{profile.balance:,.2f}.'
        }, status=400)

    # Run risk engine
    risk = compute_risk_score(amount=amount, payee_name=payee_name)

    txn = Transaction.objects.create(
        user              = request.user,
        amount            = amount,
        payee_name        = payee_name,
        payee_account     = payee_acct,
        description       = desc,
        status            = Transaction.Status.PENDING,
        risk_score        = risk['risk_score'],
        risk_factors      = risk['risk_factors'],
        challenge_required = risk['challenge_required'],
    )

    AuditLog.objects.create(
        transaction = txn,
        event_type  = AuditLog.EventType.TRANSACTION_CREATED,
        detail      = {'amount': amount, 'payee': payee_name},
    )
    AuditLog.objects.create(
        transaction = txn,
        event_type  = AuditLog.EventType.RISK_ASSESSED,
        detail      = risk,
    )

    # Low-risk → auto passthrough without challenge
    if not risk['challenge_required']:
        txn.status = Transaction.Status.ALLOWED
        txn.save()
        # ── Transfer funds immediately for low-risk ────────────────────────────
        _execute_transfer(request.user, payee_name, payee_acct, amount)
        AuditLog.objects.create(
            transaction = txn,
            event_type  = AuditLog.EventType.LOW_RISK_PASSTHROUGH,
            detail      = {'risk_score': risk['risk_score']},
        )

    return Response({
        'transaction_id':    txn.id,
        'risk_score':        risk['risk_score'],
        'risk_factors':      risk['risk_factors'],
        'challenge_required': risk['challenge_required'],
        'status':            txn.status,
        'sender_balance':    str(profile.balance),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_decision(request):
    """
    After step-up challenge completes, save the result to the Transaction.
    """
    txn_id          = request.data.get('transaction_id')
    liveness_passed = request.data.get('liveness_passed', False)
    audio_matched   = request.data.get('audio_matched', False)
    result          = request.data.get('result', 'DENY')
    rationale       = request.data.get('rationale', '')
    transcription   = request.data.get('transcription', '')

    try:
        txn = Transaction.objects.get(pk=txn_id, user=request.user)
    except Transaction.DoesNotExist:
        return Response({'error': 'Transaction not found.'}, status=404)

    # Write individual audit events
    AuditLog.objects.create(
        transaction = txn,
        event_type  = AuditLog.EventType.CHALLENGE_STARTED,
        detail      = {},
    )
    AuditLog.objects.create(
        transaction = txn,
        event_type  = AuditLog.EventType.LIVENESS_PASS if liveness_passed else AuditLog.EventType.LIVENESS_FAIL,
        detail      = {'liveness_passed': liveness_passed},
    )
    AuditLog.objects.create(
        transaction = txn,
        event_type  = AuditLog.EventType.AUDIO_MATCH if audio_matched else AuditLog.EventType.AUDIO_FAIL,
        detail      = {'audio_matched': audio_matched, 'transcription': transcription},
    )

    # Map result string to status
    status_map = {'ALLOW': Transaction.Status.ALLOWED, 'ESCALATE': Transaction.Status.ESCALATED, 'DENY': Transaction.Status.DENIED}
    txn.status             = status_map.get(result, Transaction.Status.DENIED)
    txn.liveness_passed    = liveness_passed
    txn.audio_matched      = audio_matched
    txn.transcription      = transcription
    txn.decision_rationale = rationale
    txn.save()

    event_map = {'ALLOW': AuditLog.EventType.DECISION_ALLOW, 'ESCALATE': AuditLog.EventType.DECISION_ESCALATE, 'DENY': AuditLog.EventType.DECISION_DENY}
    AuditLog.objects.create(
        transaction = txn,
        event_type  = event_map.get(result, AuditLog.EventType.DECISION_DENY),
        detail      = {'result': result, 'rationale': rationale},
    )

    # ── Execute fund transfer on ALLOW ─────────────────────────────────────────
    new_balance = None
    if result == 'ALLOW':
        new_balance = _execute_transfer(txn.user, txn.payee_name, txn.payee_account, float(txn.amount))

    return Response({'status': txn.status, 'result': result, 'new_balance': str(new_balance) if new_balance is not None else None})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_transactions(request):
    """Return the authenticated user's transaction history."""
    txns = Transaction.objects.filter(user=request.user).order_by('-created_at')
    return Response([_serialize_transaction(t) for t in txns])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_audit_log(request, txn_id):
    """Return the full audit trail for a specific transaction."""
    try:
        txn = Transaction.objects.get(pk=txn_id, user=request.user)
    except Transaction.DoesNotExist:
        # Admin can also view any transaction's audit log
        if request.user.is_staff:
            try:
                txn = Transaction.objects.get(pk=txn_id)
            except Transaction.DoesNotExist:
                return Response({'error': 'Transaction not found.'}, status=404)
        else:
            return Response({'error': 'Transaction not found.'}, status=404)

    logs = txn.audit_logs.all()
    return Response({
        'transaction': _serialize_transaction(txn),
        'events': [_serialize_audit_log(log) for log in logs],
    })


# ═══════════════════════════════════════════════════════════════════════════════
# CORE ML ENDPOINTS (unchanged logic, now require auth)
# ═══════════════════════════════════════════════════════════════════════════════

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_audio(request):
    """Transcribes audio using Whisper and matches against expected OTC."""
    temp_path = None
    try:
        audio_file    = request.FILES.get('audio')
        expected_code = request.data.get('expected_code', '')

        if not audio_file or not expected_code:
            return Response({"matched": False, "error": "Missing audio or code"}, status=400)

        print(f"[verify_audio] Received: name={audio_file.name}, size={audio_file.size}B, code={expected_code}")

        content_type = audio_file.content_type or ''
        suffix = '.ogg' if 'ogg' in content_type else '.mp4' if 'mp4' in content_type else '.webm'

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            for chunk in audio_file.chunks():
                f.write(chunk)
            temp_path = f.name

        audio_array = _patched_load_audio(temp_path)
        print(f"[verify_audio] Audio duration: {len(audio_array)/SAMPLE_RATE:.1f}s")

        result = MODEL.transcribe(
            audio_array,
            language="en",
            temperature=0,
            initial_prompt="0 1 2 3 4 5 6 7 8 9",
            condition_on_previous_text=False,
            no_speech_threshold=0.4,
        )
        transcription = result['text'].lower().strip()

        # No-speech guard
        segments = result.get('segments', [])
        if all(seg.get('no_speech_prob', 0) > 0.6 for seg in segments) and segments:
            transcription = ''

        # Multi-strategy matching
        expected_digits = expected_code.replace(" ", "").lower()

        def words_to_digits(text):
            WORD_MAP = {'zero':'0','oh':'0','o':'0','one':'1','two':'2','three':'3','four':'4','five':'5','six':'6','seven':'7','eight':'8','nine':'9'}
            result = []
            for tok in text.lower().split():
                clean = ''.join(c for c in tok if c.isalpha())
                if clean in WORD_MAP:
                    result.append(WORD_MAP[clean])
                else:
                    digits = ''.join(c for c in tok if c.isdigit())
                    if digits:
                        result.append(digits)
            return ''.join(result)

        def seq_match(code, haystack):
            idx = 0
            for ch in haystack:
                if idx < len(code) and ch == code[idx]:
                    idx += 1
            return idx == len(code)

        raw_digits = ''.join(c for c in transcription if c.isdigit())
        as_digits  = words_to_digits(transcription)

        matched = (
            expected_digits in transcription.replace(" ", "")
            or expected_digits in as_digits
            or expected_digits in raw_digits
            or seq_match(expected_digits, as_digits)
            or seq_match(expected_digits, raw_digits)
        )

        # ── Voice Biometrics Check ─────────────────────────────────────────────
        voice_verified = True
        voice_score = 1.0
        synthetic_audio_flag = False
        authenticity_score = 0.98

        try:
            profile = UserProfile.objects.get(user=request.user)
            if profile.is_enrolled and profile.voiceprint:
                # Extract the voiceprint from this login attempt
                challenge_vp = extract_voiceprint(audio_array, sr=SAMPLE_RATE)
                # Compare to saved profile
                voice_verified, voice_score = verify_speaker(profile.voiceprint, challenge_vp, threshold=0.85)
                
                # Mock Synthetic Audio Classifier (SRS Point 2)
                # In production, a heavy neural network would analyze spectral patterns for AI artefacts
                if voice_score < 0.60:
                    synthetic_audio_flag = True
                    authenticity_score = 0.30
                else:
                    synthetic_audio_flag = False
                    authenticity_score = 0.95 + (voice_score * 0.04) # e.g. 0.99

                print(f"[verify_audio] Speaker Verification: score={voice_score:.2f} passed={voice_verified}")
                print(f"[verify_audio] Authenticity Check: score={authenticity_score:.2f} synthetic={synthetic_audio_flag}")
            else:
                print("[verify_audio] User not enrolled in voice biometrics, skipping check.")
        except UserProfile.DoesNotExist:
            print("[verify_audio] UserProfile not found, skipping voice biometrics.")

        print(f"[verify_audio] expected='{expected_digits}' whisper='{transcription}' digits='{as_digits}' matched={matched}")

        return Response({
            "matched": matched,
            "transcription": transcription,
            "transcription_as_digits": as_digits,
            "raw_digits_only": raw_digits,
            "expected": expected_code,
            "voice_verified": voice_verified,
            "voice_score": voice_score,
            "synthetic_audio_flag": synthetic_audio_flag,
            "authenticity_score": round(authenticity_score, 2),
        })

    except Exception as e:
        print(f"[verify_audio] EXCEPTION: {e}")
        traceback.print_exc()
        return Response({"matched": False, "error": str(e)}, status=500)

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decision_fusion(request):
    """Gemini LLM Decision Fusion with local rule fallback."""
    liveness_passed = request.data.get('liveness_passed', False)
    audio_matched   = request.data.get('audio_matched', False)
    voice_verified  = request.data.get('voice_verified', True)  # default true for backward compat
    risk_score      = float(request.data.get('risk_score', 0.5))

    print(f"[decision_fusion] liveness={liveness_passed}, audio={audio_matched}, voice={voice_verified}, risk={risk_score}")

    if not liveness_passed or not audio_matched or not voice_verified:
        reasons = []
        if not liveness_passed: reasons.append("liveness check failed")
        if not audio_matched:   reasons.append("speech code did not match")
        if not voice_verified:  reasons.append("speaker voiceprint did not match enrolled profile")
        return Response({"result": "DENY", "rationale": f"Access denied: {' and '.join(reasons)}."})

    prompt = f"""
    You are a Zero-Trust FinTech Security Decision Engine.
    Liveness, speech code matching, and voice biometrics have all passed.
    - ALLOW if risk_score <= 0.8
    - ESCALATE if risk_score > 0.8
    Transaction Risk Score (0.0–1.0): {risk_score}
    Respond ONLY in valid JSON: {{"result": "ALLOW", "rationale": "One sentence."}}
    """

    MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash']
    for model_name in MODELS:
        try:
            client   = genai.Client()
            response = client.models.generate_content(
                model=model_name, contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            decision = json.loads(response.text)
            print(f"[decision_fusion] {model_name}: {decision}")
            return Response(decision)
        except Exception as e:
            print(f"[decision_fusion] {model_name} failed: {str(e)[:80]}")
            time.sleep(0.5)

    # Local fallback
    result    = "ESCALATE" if risk_score > 0.8 else "ALLOW"
    rationale = f"Biometrics verified. Risk score {risk_score:.2f} {'flagged for manual review' if result == 'ESCALATE' else 'within threshold'}. (AI fallback mode)"
    return Response({"result": result, "rationale": rationale})


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _execute_transfer(sender: User, payee_name: str, payee_account: str, amount: float):
    """
    Debit sender's balance and credit receiver's balance (if they're a registered user).
    Receiver is matched by username or email. Returns the sender's new balance.
    """
    from decimal import Decimal
    amt = Decimal(str(amount))

    sender_profile, _ = UserProfile.objects.get_or_create(user=sender)
    sender_profile.balance = max(Decimal('0'), sender_profile.balance - amt)
    sender_profile.save(update_fields=['balance'])
    print(f"[transfer] Debited ₹{amount} from {sender.username}. New balance: {sender_profile.balance}")

    # Try to find receiver by username or email
    receiver = None
    if payee_account:
        receiver = User.objects.filter(username=payee_account).first() or \
                   User.objects.filter(email=payee_account).first()
    if not receiver and payee_name:
        receiver = User.objects.filter(username=payee_name).first()

    if receiver and receiver != sender:
        recv_profile, _ = UserProfile.objects.get_or_create(user=receiver)
        recv_profile.balance += amt
        recv_profile.save(update_fields=['balance'])
        print(f"[transfer] Credited ₹{amount} to {receiver.username}. New balance: {recv_profile.balance}")
    else:
        print(f"[transfer] Payee '{payee_name}' / '{payee_account}' not a registered user — funds debited only.")

    return sender_profile.balance

def _serialize_transaction(t: Transaction) -> dict:
    return {
        'id':               t.id,
        'user':             t.user.username,
        'amount':           str(t.amount),
        'payee_name':       t.payee_name,
        'payee_account':    t.payee_account,
        'description':      t.description,
        'status':           t.status,
        'risk_score':       t.risk_score,
        'risk_factors':     t.risk_factors,
        'challenge_required': t.challenge_required,
        'liveness_passed':  t.liveness_passed,
        'audio_matched':    t.audio_matched,
        'decision_rationale': t.decision_rationale,
        'review_note':      t.review_note,
        'reviewed_by':      t.reviewed_by.username if t.reviewed_by else None,
        'reviewed_at':      t.reviewed_at,
        'created_at':       t.created_at,
    }


def _serialize_audit_log(log: AuditLog) -> dict:
    return {
        'id':           log.id,
        'event_type':   log.event_type,
        'detail':       log.detail,
        'timestamp':    log.timestamp,
    }
