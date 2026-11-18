import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

from build_report_helpers import (
    set_cell_margins,
    set_cell_background,
    set_cell_borders,
)

def create_poster_docx():
    doc = docx.Document()

    # Configure Landscape Orientation for Poster
    section = doc.sections[0]
    section.page_width = Inches(14.0)   # Large presentation / poster width
    section.page_height = Inches(11.0)  # Landscape height
    section.top_margin = Inches(0.5)
    section.bottom_margin = Inches(0.5)
    section.left_margin = Inches(0.6)
    section.right_margin = Inches(0.6)

    logo_path = r"extracted_template\image1.png"

    # ── HEADER BANNER ──────────────────────────────────────────────────────────
    t_hdr = doc.add_table(rows=1, cols=3)
    t_hdr.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_logo, c_title, c_meta = t_hdr.rows[0].cells
    c_logo.width = Inches(2.2)
    c_title.width = Inches(7.8)
    c_meta.width = Inches(2.8)

    for c in (c_logo, c_title, c_meta):
        set_cell_background(c, "0F172A")  # Deep Navy / Slate
        set_cell_margins(c, top=140, bottom=140, left=140, right=140)
        set_cell_borders(c, bottom={'val':'single','sz':12,'color':'DC2626'})  # Red accent line

    # Logo cell
    if os.path.exists(logo_path):
        p_l = c_logo.paragraphs[0]
        p_l.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_l.add_run().add_picture(logo_path, width=Inches(1.9))

    # Title cell
    p_t = c_title.paragraphs[0]
    p_t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_t = p_t.add_run("MULTIMODAL STEP-UP AUTHENTICATION SYSTEM (MSAS)\n")
    r_t.font.name = "Times New Roman"
    r_t.font.size = Pt(18)
    r_t.font.bold = True
    r_t.font.color.rgb = RGBColor(255, 255, 255)

    r_sub = p_t.add_run("Adaptive Risk Engine · Active 3D Head-Pose Liveness · Whisper ASR · KYC Cross-Verification · Gemini Decision Fusion")
    r_sub.font.name = "Times New Roman"
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(248, 113, 113)  # Soft red accent

    # Author & Guide meta cell
    p_m = c_meta.paragraphs[0]
    p_m.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_auth = p_m.add_run("AUTHOR:\n")
    r_auth.font.bold = True
    r_auth.font.size = Pt(10)
    r_auth.font.color.rgb = RGBColor(226, 232, 240)
    
    r_n = p_m.add_run("Snigdha Dwivedi\nRoll: 2023BTCSE018 | JLU ID: JLU08236\nB.Tech (CSE) · 7th Sem · Dec 2026\n\n")
    r_n.font.size = Pt(9.5)
    r_n.font.color.rgb = RGBColor(203, 213, 225)

    r_sup_lbl = p_m.add_run("PROJECT GUIDE & SUPERVISOR:\n")
    r_sup_lbl.font.bold = True
    r_sup_lbl.font.size = Pt(10)
    r_sup_lbl.font.color.rgb = RGBColor(226, 232, 240)

    r_sup = p_m.add_run("Dr. Dileep Kumar\nProject Guide and Coordinator\nProfessor and head, JSEN\nJagran Lakecity University, Bhopal")
    r_sup.font.size = Pt(9.5)
    r_sup.font.color.rgb = RGBColor(203, 213, 225)

    # Spacer
    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(8)
    p_sp.paragraph_format.space_after = Pt(8)

    # ── THREE-COLUMN POSTER BODY ───────────────────────────────────────────────
    t_body = doc.add_table(rows=1, cols=3)
    t_body.alignment = WD_TABLE_ALIGNMENT.CENTER
    col1, col2, col3 = t_body.rows[0].cells
    col1.width = Inches(4.1)
    col2.width = Inches(4.6)
    col3.width = Inches(4.1)

    for col in (col1, col2, col3):
        set_cell_margins(col, top=80, bottom=80, left=100, right=100)
        set_cell_borders(col, 
                         left={'val':'single','sz':4,'color':'CBD5E1'},
                         right={'val':'single','sz':4,'color':'CBD5E1'},
                         top={'val':'single','sz':4,'color':'CBD5E1'},
                         bottom={'val':'single','sz':4,'color':'CBD5E1'})
        set_cell_background(col, "FAFAFA")

    # ── HELPER FOR POSTER CARDS ──
    def add_card(cell, title_text, bullet_items=[], paragraph_text="", color_hex="DC2626"):
        p_hdr = cell.add_paragraph()
        p_hdr.paragraph_format.space_before = Pt(6)
        p_hdr.paragraph_format.space_after = Pt(4)
        run_h = p_hdr.add_run(f"■ {title_text}")
        run_h.font.name = "Times New Roman"
        run_h.font.size = Pt(12)
        run_h.font.bold = True
        run_h.font.color.rgb = RGBColor(15, 23, 42)

        if paragraph_text:
            p_txt = cell.add_paragraph()
            p_txt.paragraph_format.space_after = Pt(4)
            p_txt.paragraph_format.line_spacing = 1.15
            run_t = p_txt.add_run(paragraph_text)
            run_t.font.name = "Times New Roman"
            run_t.font.size = Pt(9.5)

        for b in bullet_items:
            p_b = cell.add_paragraph()
            p_b.paragraph_format.space_after = Pt(3)
            p_b.paragraph_format.left_indent = Inches(0.15)
            p_b.paragraph_format.line_spacing = 1.15
            run_dot = p_b.add_run("• ")
            run_dot.font.bold = True
            run_dot.font.color.rgb = RGBColor(220, 38, 38)
            run_b = p_b.add_run(b)
            run_b.font.name = "Times New Roman"
            run_b.font.size = Pt(9.5)

    def add_poster_box(cell, caption_title):
        t_box = cell.add_table(rows=1, cols=1)
        t_box.alignment = WD_TABLE_ALIGNMENT.CENTER
        c = t_box.rows[0].cells[0]
        c.width = Inches(3.8)
        set_cell_background(c, "FFFFFF")
        set_cell_borders(c, 
                         top={'val':'dashed','sz':4,'color':'94A3B8'},
                         bottom={'val':'dashed','sz':4,'color':'94A3B8'},
                         left={'val':'dashed','sz':4,'color':'94A3B8'},
                         right={'val':'dashed','sz':4,'color':'94A3B8'})
        set_cell_margins(c, top=80, bottom=80, left=80, right=80)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r1 = p.add_run("📷 SCREENSHOT INSERT ZONE\n")
        r1.font.bold = True
        r1.font.size = Pt(9)
        r1.font.color.rgb = RGBColor(100, 116, 139)
        r2 = p.add_run(caption_title)
        r2.font.italic = True
        r2.font.size = Pt(8.5)
        r2.font.color.rgb = RGBColor(148, 163, 184)
        
        p_spacer = cell.add_paragraph()
        p_spacer.paragraph_format.space_after = Pt(4)

    # ── COLUMN 1: MOTIVATION & ARCHITECTURE ──
    add_card(col1, "1. PROBLEM & MOTIVATION", [
        "SMS OTP Vulnerabilities: Susceptible to SIM swapping, SS7 attacks, and automated reverse-proxy phishing kits (e.g. Evilginx2).",
        "Biometric Spoofing: Generative AI deepfakes and 2D replay videos subvert static facial and fingerprint recognition.",
        "Static Security Friction: Unnecessary verification on routine ₹500 transactions, but inadequate assurance on ₹50,000 transfers.",
    ])

    add_card(col1, "2. CONTEXTUAL RISK ENGINE", [
        "Risk Score R ∈ [0.0, 1.0] calculated via weighted heuristics.",
        "Evaluates: Transfer Value (w=0.45), Payee History (w=0.25), Balance Impact (w=0.15), Velocity Anomalies (w=0.15).",
        "Threshold Execution: R ≤ 0.40 → Instant Passthrough; R > 0.40 → Mandatory Multimodal Step-Up Challenge.",
    ])

    add_poster_box(col1, "Fig 1: ZephyrBank Dashboard & Step-Up Interception Trigger")

    add_card(col1, "3. SYSTEM BOUNDARY & SPECS", [
        "Frontend: Next.js 16, React 19, Tailwind CSS, MediaPipe WASM.",
        "Backend: Django 6.1, Django REST Framework, SimpleJWT SSO.",
        "Models: OpenAI Whisper (base ASR), Google Gemini 3.8 Flash LLM.",
    ])

    # ── COLUMN 2: MULTIMODAL VERIFICATION CORE ──
    add_card(col2, "4. ACTIVE 3D SPATIAL LIVENESS", [
        "MediaPipe FaceMesh extracts 468 3D landmarks in real time (30 fps).",
        "Calculates horizontal Yaw using temple-to-nose offset: yawNorm = noseOffset / templeWidth (Threshold: |yaw| > 0.12).",
        "Dynamic Head Prompts: Randomly assigns 'Turn Head Left' / 'Turn Head Right' to defeat pre-recorded video replays.",
    ])

    add_poster_box(col2, "Fig 2: Active 3D Head-Pose Alignment & Landmark Overlay")

    add_card(col2, "5. ACOUSTIC OTP & SPEAKER VERIFICATION", [
        "Dynamic 6-Digit Code: Time-synchronized code vocalized by claimant.",
        "OpenAI Whisper ASR: Transcribes spoken digits with karaoke sync.",
        "MFCC Cosine Distance: Verifies acoustic timbre against enrolled voiceprint.",
        "Deepfake Detection: Analyzes spectral flatness, zero-crossing rate, and rolloff variance to flag synthetic voice clones.",
    ])

    add_poster_box(col2, "Fig 3: Audio OTP Challenge with Real-Time Karaoke UI")

    # ── COLUMN 3: CROSS-VERIFICATION, FUSION & RESULTS ──
    add_card(col3, "6. KYC SELFIE CROSS-VERIFICATION", [
        "Ground-Truth Identity Binding: Compares live webcam crop against approved KYC selfie image stored during onboarding.",
        "Photometric Feature Match: CIE-LAB 3-channel color histogram (Bhattacharyya) + Structural Similarity (SSIM).",
        "Composite Metric: 0.60 * hist_sim + 0.40 * ssim ≥ 0.60 → MATCH.",
    ])

    add_poster_box(col3, "Fig 4: OpenCV Texture Anti-Spoof & Gemini Decision Fusion")

    add_card(col3, "7. LLM MULTIMODAL DECISION FUSION", [
        "Google Gemini 3.8 Flash synthesizes multimodal telemetry:",
        "Inputs: Active Liveness, Audio Match, Voice Timbre, Anti-Spoof Texture, KYC Face Match, and Risk Score.",
        "Outputs: Transparent explainable ALLOW / DENY / ESCALATE verdict.",
        "Fail-Closed Fallback: Enforces deterministic deny on any signal defect.",
    ])

    add_card(col3, "8. KEY RESULTS & REPOSITORY", [
        "100% rejection rate against 50 simulated 2D print & replay spoofs.",
        "Sub-two-second end-to-end verification round-trip latency.",
        "Zero SMS OTP dependency; IEEE 830 compliant architecture.",
        "GitHub Repo: https://github.com/snigdhadwiv/AuthenticationMSAS.git",
    ])

    poster_path = r"d:\Snigdha\majorprojectv1\MSAS_Project_Poster_Snigdha_Dwivedi.docx"
    doc.save(poster_path)
    print(f"Poster DOCX saved successfully to: {poster_path}")

if __name__ == "__main__":
    create_poster_docx()
