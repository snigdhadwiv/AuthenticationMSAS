import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, Ellipse, Polygon
import numpy as np

os.makedirs(r"d:\Snigdha\majorprojectv1\backend\diagrams", exist_ok=True)

# ═══════════════════════════════════════════════════════════════════════════════
# 1. SYSTEM ARCHITECTURE DIAGRAM
# ═══════════════════════════════════════════════════════════════════════════════
def generate_system_architecture():
    fig, ax = plt.subplots(figsize=(12, 7.5), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    # Background
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_facecolor('#F8FAFC')

    # Title
    ax.text(50, 96, "MULTIMODAL STEP-UP AUTHENTICATION SYSTEM (MSAS) — SYSTEM ARCHITECTURE", 
            ha='center', va='center', fontsize=14, fontweight='bold', color='#0F172A', fontfamily='serif')
    ax.text(50, 92.5, "Decoupled 3-Tier Security Middleware for Adaptive Financial Risk Mitigation", 
            ha='center', va='center', fontsize=9.5, color='#475569', fontfamily='serif', style='italic')

    # Container 1: Client Tier
    rect_client = FancyBboxPatch((3, 10), 28, 77, boxstyle="round,pad=1,rounding_size=2", 
                                 facecolor='#EFF6FF', edgecolor='#3B82F6', linewidth=1.5, linestyle='-')
    ax.add_patch(rect_client)
    ax.text(17, 84, "CLIENT PRESENTATION TIER\n(Next.js 16 / React 19 / TypeScript)", 
            ha='center', va='center', fontsize=10, fontweight='bold', color='#1E40AF')

    # Client subcomponents
    components_client = [
        ("ZephyrBank UI", "Core Banking Portal & Transfer Initiation\n(Shared Session / SSO Bridge)", "#DBEAFE", 74),
        ("MediaPipe FaceMesh", "Client-Side 468 3D Landmark Tracking\nYaw & Pitch Pose Estimation (30 fps)", "#DBEAFE", 58),
        ("Audio & Voice Capture", "Web Audio API / MediaRecorder\nWeb Speech API Real-Time Karaoke UI", "#DBEAFE", 42),
        ("Challenge Controller", "Look & Speak Step-Up Orchestrator\nFail-Closed Exception Handling", "#DBEAFE", 26),
    ]
    for title, desc, bg, y in components_client:
        box = FancyBboxPatch((5, y-5), 24, 10, boxstyle="round,pad=0.5,rounding_size=1", 
                             facecolor=bg, edgecolor='#93C5FD', linewidth=1)
        ax.add_patch(box)
        ax.text(17, y+2, title, ha='center', va='center', fontsize=9, fontweight='bold', color='#1E3A8A')
        ax.text(17, y-1.5, desc, ha='center', va='center', fontsize=7, color='#1E293B')

    # Container 2: Security Middleware Tier
    rect_mid = FancyBboxPatch((36, 10), 28, 77, boxstyle="round,pad=1,rounding_size=2", 
                              facecolor='#FEF2F2', edgecolor='#EF4444', linewidth=1.5, linestyle='-')
    ax.add_patch(rect_mid)
    ax.text(50, 84, "MSAS SECURITY MIDDLEWARE\n(Django 6.1 / Django REST Framework)", 
            ha='center', va='center', fontsize=10, fontweight='bold', color='#991B1B')

    components_mid = [
        ("Contextual Risk Engine", "Evaluates Amount, Payee, Velocity, Time\nComputes Adaptive Risk Score R in [0, 1]", "#FEE2E2", 74),
        ("OpenCV Anti-Spoofing", "Laplacian Variance (Micro-Texture Sharpness)\nLBP Shannon Entropy & DCT High-Freq", "#FEE2E2", 58),
        ("OpenCV Face Matcher", "128x128 Central Face Region Crop\nCIE-LAB Histogram + SSIM Cross-Check", "#FEE2E2", 42),
        ("Whisper ASR & Voiceprint", "Patched FFmpeg Whisper (base) Model\nMFCC 20-dim Cosine Speaker Verification", "#FEE2E2", 26),
    ]
    for title, desc, bg, y in components_mid:
        box = FancyBboxPatch((38, y-5), 24, 10, boxstyle="round,pad=0.5,rounding_size=1", 
                             facecolor=bg, edgecolor='#FCA5A5', linewidth=1)
        ax.add_patch(box)
        ax.text(50, y+2, title, ha='center', va='center', fontsize=9, fontweight='bold', color='#7F1D1D')
        ax.text(50, y-1.5, desc, ha='center', va='center', fontsize=7, color='#1E293B')

    # Container 3: Intelligence & Persistence Tier
    rect_int = FancyBboxPatch((69, 10), 28, 77, boxstyle="round,pad=1,rounding_size=2", 
                              facecolor='#F0FDF4', edgecolor='#22C55E', linewidth=1.5, linestyle='-')
    ax.add_patch(rect_int)
    ax.text(83, 84, "COGNITIVE & DATA PERSISTENCE\n(Google Gemini LLM / SQLite Database)", 
            ha='center', va='center', fontsize=10, fontweight='bold', color='#166534')

    components_int = [
        ("Gemini Decision Fusion", "Google Gemini 3.8 Flash Reasoning Agent\nSynthesizes All Biometrics -> ALLOW/DENY", "#DCFCE7", 74),
        ("Automated eKYC OCR", "Gemini Multimodal Document Extraction\nAadhaar, PAN, Passport, DL Verification", "#DCFCE7", 58),
        ("Tamper-Evident Audit", "Immutable Transaction Lifecycles\nEvent Logging for Forensic Regulatory Audit", "#DCFCE7", 42),
        ("Relational SQLite Store", "UserProfile, Transactions, KYCApplication\nEncrypted Biometrics & JWT SSO Session", "#DCFCE7", 26),
    ]
    for title, desc, bg, y in components_int:
        box = FancyBboxPatch((71, y-5), 24, 10, boxstyle="round,pad=0.5,rounding_size=1", 
                             facecolor=bg, edgecolor='#86EFAC', linewidth=1)
        ax.add_patch(box)
        ax.text(83, y+2, title, ha='center', va='center', fontsize=9, fontweight='bold', color='#14532D')
        ax.text(83, y-1.5, desc, ha='center', va='center', fontsize=7, color='#1E293B')

    # Communication Arrows between Tiers
    arrow_props_right = dict(arrowstyle="->", color="#DC2626", lw=2, mutation_scale=15)
    arrow_props_left = dict(arrowstyle="->", color="#2563EB", lw=2, mutation_scale=15)
    arrow_props_bi = dict(arrowstyle="<->", color="#059669", lw=2, mutation_scale=15)

    # Client <-> Middleware
    ax.annotate("", xy=(37, 74), xytext=(30, 74), arrowprops=arrow_props_right)
    ax.text(33.5, 76, "POST /initiate", fontsize=6.5, ha='center', color='#DC2626', fontweight='bold')

    ax.annotate("", xy=(30, 58), xytext=(37, 58), arrowprops=arrow_props_left)
    ax.text(33.5, 60, "Challenge Modal", fontsize=6.5, ha='center', color='#2563EB', fontweight='bold')

    ax.annotate("", xy=(37, 42), xytext=(30, 42), arrowprops=arrow_props_right)
    ax.text(33.5, 44, "Frame & Audio", fontsize=6.5, ha='center', color='#DC2626', fontweight='bold')

    ax.annotate("", xy=(30, 26), xytext=(37, 26), arrowprops=arrow_props_left)
    ax.text(33.5, 28, "ALLOW/DENY", fontsize=6.5, ha='center', color='#2563EB', fontweight='bold')

    # Middleware <-> Cloud / DB
    ax.annotate("", xy=(70, 74), xytext=(63, 74), arrowprops=arrow_props_right)
    ax.text(66.5, 76, "Fusion Prompt", fontsize=6.5, ha='center', color='#DC2626', fontweight='bold')

    ax.annotate("", xy=(63, 58), xytext=(70, 58), arrowprops=arrow_props_left)
    ax.text(66.5, 60, "OCR Telemetry", fontsize=6.5, ha='center', color='#2563EB', fontweight='bold')

    ax.annotate("", xy=(70, 42), xytext=(63, 42), arrowprops=arrow_props_bi)
    ax.text(66.5, 44, "Audit Stream", fontsize=6.5, ha='center', color='#059669', fontweight='bold')

    ax.annotate("", xy=(70, 26), xytext=(63, 26), arrowprops=arrow_props_bi)
    ax.text(66.5, 28, "ORM Queries", fontsize=6.5, ha='center', color='#059669', fontweight='bold')

    # Bottom Protocol Bar
    bar = FancyBboxPatch((3, 2), 94, 5, boxstyle="round,pad=0.5,rounding_size=1", 
                         facecolor='#1E293B', edgecolor='#0F172A', linewidth=1)
    ax.add_patch(bar)
    ax.text(50, 4.5, "SECURITY & PROTOCOLS: HTTPS / WSS · SimpleJWT Bearer Authentication · Fail-Closed State Machine · IEEE 830 Aligned", 
            ha='center', va='center', fontsize=8, color='#F8FAFC', fontweight='bold')

    out_file = r"d:\Snigdha\majorprojectv1\backend\diagrams\fig3_1_system_architecture.png"
    plt.tight_layout()
    plt.savefig(out_file, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"Generated: {out_file}")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. STEP-UP AUTHENTICATION FLOWCHART
# ═══════════════════════════════════════════════════════════════════════════════
def generate_flowchart():
    fig, ax = plt.subplots(figsize=(10, 11), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')

    fig.patch.set_facecolor('#F8FAFC')
    ax.set_facecolor('#F8FAFC')

    # Title
    ax.text(50, 97.5, "MULTIMODAL STEP-UP VERIFICATION — EXECUTION FLOWCHART", 
            ha='center', va='center', fontsize=13, fontweight='bold', color='#0F172A', fontfamily='serif')
    ax.text(50, 95, "Dynamic Context-Aware Risk Escalation & Multimodal Challenge Lifecycle", 
            ha='center', va='center', fontsize=9, color='#475569', fontfamily='serif', style='italic')

    # Helper function for shapes
    def draw_box(x, y, w, h, text, subtext="", bg="#EFF6FF", border="#3B82F6", shape="rect"):
        if shape == "rect":
            p = FancyBboxPatch((x-w/2, y-h/2), w, h, boxstyle="round,pad=0.5,rounding_size=1.5", 
                               facecolor=bg, edgecolor=border, linewidth=1.5)
            ax.add_patch(p)
        elif shape == "diamond":
            diamond = Polygon([(x, y+h/2), (x+w/2, y), (x, y-h/2), (x-w/2, y)], 
                              facecolor=bg, edgecolor=border, linewidth=1.5)
            ax.add_patch(diamond)
        elif shape == "oval":
            p = FancyBboxPatch((x-w/2, y-h/2), w, h, boxstyle="round,pad=0.5,rounding_size=3", 
                               facecolor=bg, edgecolor=border, linewidth=1.5)
            ax.add_patch(p)
            
        ax.text(x, y + (1.2 if subtext else 0), text, ha='center', va='center', fontsize=8.5, fontweight='bold', color='#0F172A')
        if subtext:
            ax.text(x, y - 1.8, subtext, ha='center', va='center', fontsize=7, color='#475569')

    def draw_arrow(x1, y1, x2, y2, label=""):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1), 
                    arrowprops=dict(arrowstyle="->", color="#334155", lw=1.5, mutation_scale=12))
        if label:
            mx, my = (x1+x2)/2, (y1+y2)/2
            ax.text(mx + 2, my, label, fontsize=7.5, fontweight='bold', color='#DC2626')

    # Flowchart Nodes
    # 1. Start
    draw_box(50, 90, 30, 5, "1. USER INITIATES TRANSACTION", "ZephyrBank Transfer (Amount, Payee)", bg="#E0E7FF", border="#4338CA", shape="oval")

    # 2. Risk Engine
    draw_arrow(50, 87.5, 50, 83)
    draw_box(50, 80.5, 42, 5.5, "2. CONTEXTUAL RISK SCORING ENGINE", "Calculates R in [0.0, 1.0] via Weighted Heuristics", bg="#FEF3C7", border="#D97706")

    # 3. Decision 1: Risk Threshold
    draw_arrow(50, 77.7, 50, 73)
    draw_box(50, 69, 32, 8, "Risk Score R > 0.40 ?", "(High Risk vs Low Risk)", bg="#FEE2E2", border="#DC2626", shape="diamond")

    # Low Risk branch (right)
    ax.plot([66, 85, 85], [69, 69, 20], color="#16A34A", lw=1.5, linestyle='--')
    ax.annotate("", xy=(85, 17), xytext=(85, 20), arrowprops=dict(arrowstyle="->", color="#16A34A", lw=1.5, mutation_scale=12))
    ax.text(72, 70.5, "NO (R <= 0.40)", fontsize=7.5, fontweight='bold', color='#16A34A')
    draw_box(85, 14, 26, 6, "AUTO-PASSTHROUGH", "Instant Low-Risk Approval", bg="#DCFCE7", border="#16A34A")

    # High Risk branch (down)
    draw_arrow(50, 65, 50, 60, "YES (High Risk)")
    draw_box(50, 57, 44, 5.5, "3. TRIGGER 'LOOK & SPEAK' STEP-UP", "Intercepts Transfer; Launches Active Challenge", bg="#FEE2E2", border="#EF4444")

    # 4. Phase 1: 3D Spatial Head Pose
    draw_arrow(50, 54.2, 50, 50)
    draw_box(50, 47, 48, 6, "4. ACTIVE 3D HEAD-POSE LIVENESS", "MediaPipe: Random Head Turn (Left/Right/Up/Down)", bg="#DBEAFE", border="#2563EB")

    # Decision 2: Liveness Pass?
    draw_arrow(50, 44, 50, 39.5)
    draw_box(50, 36, 28, 7, "Liveness Passed ?", "(Within 15 Seconds)", bg="#FEF2F2", border="#DC2626", shape="diamond")

    # Deny Branch (left)
    ax.plot([36, 15, 15], [36, 36, 17], color="#DC2626", lw=1.5, linestyle='-')
    ax.annotate("", xy=(15, 14), xytext=(15, 17), arrowprops=dict(arrowstyle="->", color="#DC2626", lw=1.5, mutation_scale=12))
    ax.text(22, 37.5, "FAIL / TIMEOUT", fontsize=7.5, fontweight='bold', color='#DC2626')
    draw_box(15, 11, 26, 6, "FAIL-CLOSED (DENY)", "Transaction Blocked; Alert Logged", bg="#FEE2E2", border="#DC2626")

    # 5. Phase 2: Dual Verification (Face Match + Acoustic OTP)
    draw_arrow(50, 32.5, 50, 27.5, "PASS")
    draw_box(50, 24.5, 46, 6, "5. MULTIMODAL FEATURE VERIFICATION", "Acoustic OTP (Whisper ASR) + KYC Face Cross-Match (LAB/SSIM)", bg="#E0E7FF", border="#4F46E5")

    # 6. Decision Fusion
    draw_arrow(50, 21.5, 50, 16.5)
    draw_box(50, 13.5, 36, 6, "6. GEMINI LLM DECISION FUSION", "Multimodal Reasoning & Explainable Rationale", bg="#FEF3C7", border="#D97706")

    # Decision 3: Fusion Output
    draw_arrow(50, 10.5, 50, 6)
    draw_box(50, 3.5, 40, 5, "7. OUTCOME: ALLOW / ESCALATE / DENY", "Commit Funds & Record Tamper-Evident Audit Log", bg="#DCFCE7", border="#16A34A", shape="oval")

    out_file = r"d:\Snigdha\majorprojectv1\backend\diagrams\fig3_2_stepup_flowchart.png"
    plt.tight_layout()
    plt.savefig(out_file, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"Generated: {out_file}")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. CHEN'S NOTATION ER DIAGRAM (STRICT CHEN'S NOTATION)
# ═══════════════════════════════════════════════════════════════════════════════
def generate_chen_er_diagram():
    fig, ax = plt.subplots(figsize=(14, 9), dpi=300)
    ax.set_xlim(0, 140)
    ax.set_ylim(0, 100)
    ax.axis('off')

    fig.patch.set_facecolor('#F8FAFC')
    ax.set_facecolor('#F8FAFC')

    # Title
    ax.text(70, 96.5, "ENTITY-RELATIONSHIP (ER) DIAGRAM — CHEN'S NOTATION", 
            ha='center', va='center', fontsize=14, fontweight='bold', color='#0F172A', fontfamily='serif')
    ax.text(70, 93.5, "Core Data Model: Rectangles (Entities), Ovals (Attributes), Diamonds (Relationships), Underlines (Primary Keys)", 
            ha='center', va='center', fontsize=9.5, color='#475569', fontfamily='serif', style='italic')

    # Draw Chen's components helpers
    def draw_entity(x, y, w, h, name):
        """Chen Entity: Strong Rectangle"""
        rect = patches.Rectangle((x-w/2, y-h/2), w, h, facecolor='#E2E8F0', edgecolor='#1E293B', linewidth=2)
        ax.add_patch(rect)
        ax.text(x, y, name, ha='center', va='center', fontsize=9.5, fontweight='bold', color='#0F172A')

    def draw_relationship(x, y, w, h, name):
        """Chen Relationship: Diamond"""
        pts = [(x, y+h/2), (x+w/2, y), (x, y-h/2), (x-w/2, y)]
        diamond = Polygon(pts, facecolor='#FEE2E2', edgecolor='#DC2626', linewidth=2)
        ax.add_patch(diamond)
        ax.text(x, y, name, ha='center', va='center', fontsize=8, fontweight='bold', color='#991B1B')

    def draw_attribute(x, y, w, h, name, is_pk=False, parent_x=None, parent_y=None):
        """Chen Attribute: Oval with Underline for Primary Key"""
        if parent_x is not None and parent_y is not None:
            ax.plot([parent_x, x], [parent_y, y], color='#64748B', lw=1.2, zorder=1)
        ellipse = Ellipse((x, y), w, h, facecolor='#EFF6FF', edgecolor='#3B82F6', linewidth=1.2, zorder=2)
        ax.add_patch(ellipse)
        t = ax.text(x, y, name, ha='center', va='center', fontsize=7.2, color='#1E293B', zorder=3)
        if is_pk:
            t.set_fontweight('bold')
            # Add underline for primary key in Chen's notation
            ax.plot([x - len(name)*0.55, x + len(name)*0.55], [y - 1.2, y - 1.2], color='#1E293B', lw=1.2, zorder=4)

    # ── ENTITY 1: USER (Central Django User) ──────────────────────────────────
    user_x, user_y = 70, 72
    draw_entity(user_x, user_y, 20, 9, "USER")
    
    # User Attributes
    draw_attribute(50, 84, 14, 5.5, "id", is_pk=True, parent_x=user_x, parent_y=user_y)
    draw_attribute(66, 86, 17, 5.5, "username", parent_x=user_x, parent_y=user_y)
    draw_attribute(86, 85, 17, 5.5, "email", parent_x=user_x, parent_y=user_y)
    draw_attribute(91, 75, 17, 5.5, "is_active", parent_x=user_x, parent_y=user_y)

    # ── ENTITY 2: USER_PROFILE (Extended MSAS Profile) ────────────────────────
    prof_x, prof_y = 22, 72
    draw_entity(prof_x, prof_y, 22, 9, "USER_PROFILE")

    # UserProfile Attributes
    draw_attribute(10, 84, 13, 5.5, "id", is_pk=True, parent_x=prof_x, parent_y=prof_y)
    draw_attribute(10, 73, 14, 5.5, "phone", parent_x=prof_x, parent_y=prof_y)
    draw_attribute(13, 62, 17, 5.5, "voiceprint", parent_x=prof_x, parent_y=prof_y)
    draw_attribute(28, 58, 16, 5.5, "balance", parent_x=prof_x, parent_y=prof_y)
    draw_attribute(36, 84, 17, 5.5, "is_enrolled", parent_x=prof_x, parent_y=prof_y)

    # Relationship: USER <-> USER_PROFILE (1:1 HAS_PROFILE)
    draw_relationship(46, 72, 14, 8, "HAS")
    ax.plot([prof_x + 11, 39], [prof_y, 72], color='#1E293B', lw=1.5)
    ax.plot([53, user_x - 10], [72, user_y], color='#1E293B', lw=1.5)
    ax.text(36, 74, "1", fontsize=9, fontweight='bold', color='#DC2626')
    ax.text(56, 74, "1", fontsize=9, fontweight='bold', color='#DC2626')

    # ── ENTITY 3: TRANSACTION (Financial Transactions) ────────────────────────
    txn_x, txn_y = 70, 38
    draw_entity(txn_x, txn_y, 22, 9, "TRANSACTION")

    # Transaction Attributes
    draw_attribute(47, 48, 13, 5.5, "id", is_pk=True, parent_x=txn_x, parent_y=txn_y)
    draw_attribute(46, 38, 16, 5.5, "amount", parent_x=txn_x, parent_y=txn_y)
    draw_attribute(47, 28, 17, 5.5, "payee_name", parent_x=txn_x, parent_y=txn_y)
    draw_attribute(63, 24, 16, 5.5, "risk_score", parent_x=txn_x, parent_y=txn_y)
    draw_attribute(77, 24, 15, 5.5, "status", parent_x=txn_x, parent_y=txn_y)
    draw_attribute(93, 28, 17, 5.5, "liveness_ok", parent_x=txn_x, parent_y=txn_y)
    draw_attribute(94, 38, 17, 5.5, "audio_ok", parent_x=txn_x, parent_y=txn_y)

    # Relationship: USER <-> TRANSACTION (1:N INITIATES)
    draw_relationship(70, 55, 16, 8, "INITIATES")
    ax.plot([user_x, 70], [user_y - 4.5, 59], color='#1E293B', lw=1.5)
    ax.plot([70, txn_x], [51, txn_y + 4.5], color='#1E293B', lw=1.5)
    ax.text(72, 63, "1", fontsize=9, fontweight='bold', color='#DC2626')
    ax.text(72, 48, "N", fontsize=9, fontweight='bold', color='#DC2626')

    # ── ENTITY 4: AUDIT_LOG (Tamper-Evident Audit Log) ────────────────────────
    log_x, log_y = 120, 38
    draw_entity(log_x, log_y, 20, 9, "AUDIT_LOG")

    # AuditLog Attributes
    draw_attribute(110, 51, 13, 5.5, "id", is_pk=True, parent_x=log_x, parent_y=log_y)
    draw_attribute(128, 51, 17, 5.5, "event_type", parent_x=log_x, parent_y=log_y)
    draw_attribute(132, 38, 15, 5.5, "detail", parent_x=log_x, parent_y=log_y)
    draw_attribute(122, 26, 17, 5.5, "timestamp", parent_x=log_x, parent_y=log_y)

    # Relationship: TRANSACTION <-> AUDIT_LOG (1:N GENERATES)
    draw_relationship(95, 38, 16, 8, "GENERATES")
    ax.plot([txn_x + 11, 87], [txn_y, 38], color='#1E293B', lw=1.5)
    ax.plot([103, log_x - 10], [38, log_y], color='#1E293B', lw=1.5)
    ax.text(84, 40, "1", fontsize=9, fontweight='bold', color='#DC2626')
    ax.text(106, 40, "N", fontsize=9, fontweight='bold', color='#DC2626')

    # ── ENTITY 5: KYC_APPLICATION (eKYC Onboarding Records) ───────────────────
    kyc_x, kyc_y = 120, 72
    draw_entity(kyc_x, kyc_y, 22, 9, "KYC_APPLICATION")

    # KYCApplication Attributes
    draw_attribute(115, 85, 13, 5.5, "id", is_pk=True, parent_x=kyc_x, parent_y=kyc_y)
    draw_attribute(131, 84, 16, 5.5, "full_name", parent_x=kyc_x, parent_y=kyc_y)
    draw_attribute(134, 73, 17, 5.5, "doc_type", parent_x=kyc_x, parent_y=kyc_y)
    draw_attribute(132, 62, 17, 5.5, "selfie_img", parent_x=kyc_x, parent_y=kyc_y)
    draw_attribute(115, 60, 17, 5.5, "ocr_id_num", parent_x=kyc_x, parent_y=kyc_y)

    # Relationship: USER <-> KYC_APPLICATION (1:1 SUBMITS)
    draw_relationship(95, 72, 16, 8, "SUBMITS")
    ax.plot([user_x + 10, 87], [user_y, 72], color='#1E293B', lw=1.5)
    ax.plot([103, kyc_x - 11], [72, kyc_y], color='#1E293B', lw=1.5)
    ax.text(84, 74, "1", fontsize=9, fontweight='bold', color='#DC2626')
    ax.text(106, 74, "1", fontsize=9, fontweight='bold', color='#DC2626')

    # Notation Legend Box (Bottom Left)
    legend_rect = FancyBboxPatch((4, 4), 60, 16, boxstyle="round,pad=0.5,rounding_size=1", 
                                 facecolor='#FFFFFF', edgecolor='#CBD5E1', linewidth=1)
    ax.add_patch(legend_rect)
    ax.text(6, 17, "CHEN'S NOTATION CONVENTIONS:", fontsize=8, fontweight='bold', color='#0F172A')
    
    # Legend items
    ax.add_patch(patches.Rectangle((7, 10), 8, 4, facecolor='#E2E8F0', edgecolor='#1E293B', lw=1.5))
    ax.text(17, 12, "Entity Set (Table)", fontsize=7.5, color='#334155')

    pts_d = [(35, 14), (39, 12), (35, 10), (31, 12)]
    ax.add_patch(Polygon(pts_d, facecolor='#FEE2E2', edgecolor='#DC2626', lw=1.5))
    ax.text(41, 12, "Relationship", fontsize=7.5, color='#334155')

    ax.add_patch(Ellipse((7, 6.5), 8, 3.5, facecolor='#EFF6FF', edgecolor='#3B82F6', lw=1))
    ax.text(13, 6.5, "Attribute", fontsize=7.5, color='#334155')

    ax.add_patch(Ellipse((35, 6.5), 8, 3.5, facecolor='#EFF6FF', edgecolor='#3B82F6', lw=1.5))
    ax.text(35, 6.5, "PK", fontsize=7, fontweight='bold', ha='center', va='center')
    ax.plot([33, 37], [5.5, 5.5], color='#1E293B', lw=1.5)
    ax.text(41, 6.5, "Primary Key (Underlined)", fontsize=7.5, color='#334155')

    out_file = r"d:\Snigdha\majorprojectv1\backend\diagrams\fig3_3_chen_er_diagram.png"
    plt.tight_layout()
    plt.savefig(out_file, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none', bbox_inches='tight')
    plt.close()
    print(f"Generated: {out_file}")

if __name__ == "__main__":
    generate_system_architecture()
    generate_flowchart()
    generate_chen_er_diagram()
