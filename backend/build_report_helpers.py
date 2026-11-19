import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set inner cell padding in twips."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_cell_background(cell, fill_hex):
    """Set background color of a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_borders(cell, top=None, bottom=None, left=None, right=None):
    """Set cell borders with specific styling."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    
    borders = {'w:top': top, 'w:bottom': bottom, 'w:left': left, 'w:right': right}
    for b_name, b_val in borders.items():
        if b_val:
            node = OxmlElement(b_name)
            node.set(qn('w:val'), b_val.get('val', 'single'))
            node.set(qn('w:sz'), str(b_val.get('sz', 4)))
            node.set(qn('w:space'), '0')
            node.set(qn('w:color'), b_val.get('color', 'auto'))
            tcBorders.append(node)
        else:
            node = OxmlElement(b_name)
            node.set(qn('w:val'), 'none')
            tcBorders.append(node)
    tcPr.append(tcBorders)

def add_page_number_to_section(section):
    """Add 'Page X of Y' style footer to section."""
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    # Clear paragraph runs
    p.text = "Page "
    run1 = p.runs[0]
    run1.font.name = "Times New Roman"
    run1.font.size = Pt(10)
    run1.font.color.rgb = RGBColor(100, 100, 100)
    
    # Add PAGE field
    fldSimple1 = OxmlElement('w:fldSimple')
    fldSimple1.set(qn('w:instr'), 'PAGE')
    p._p.append(fldSimple1)
    
    # Add ' of '
    run2 = p.add_run(" of ")
    run2.font.name = "Times New Roman"
    run2.font.size = Pt(10)
    run2.font.color.rgb = RGBColor(100, 100, 100)
    
    # Add NUMPAGES field
    fldSimple2 = OxmlElement('w:fldSimple')
    fldSimple2.set(qn('w:instr'), 'NUMPAGES')
    p._p.append(fldSimple2)

def add_code_block(doc, title, code_str, language="Python"):
    """
    Renders a beautifully formatted code listing block in a Word document.
    Includes a caption, syntax box with shaded background, left accent border,
    and monospace font (Consolas).
    """
    # Caption paragraph
    p_cap = doc.add_paragraph()
    p_cap.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p_cap.paragraph_format.space_before = Pt(8)
    p_cap.paragraph_format.space_after = Pt(3)
    
    run_lbl = p_cap.add_run(f"Listing: ")
    run_lbl.font.name = "Times New Roman"
    run_lbl.font.size = Pt(10.5)
    run_lbl.font.bold = True
    run_lbl.font.color.rgb = RGBColor(15, 23, 42)
    
    run_title = p_cap.add_run(title)
    run_title.font.name = "Times New Roman"
    run_title.font.size = Pt(10.5)
    run_title.font.italic = True
    
    run_lang = p_cap.add_run(f" [{language}]")
    run_lang.font.name = "Times New Roman"
    run_lang.font.size = Pt(9.5)
    run_lang.font.bold = True
    run_lang.font.color.rgb = RGBColor(220, 38, 38)

    # Table container for code
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.rows[0].cells[0]
    cell.width = Inches(5.8)
    
    set_cell_background(cell, "F8FAFC")
    set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
    set_cell_borders(cell,
                     top={'val':'single','sz':4,'color':'CBD5E1'},
                     bottom={'val':'single','sz':4,'color':'CBD5E1'},
                     left={'val':'single','sz':16,'color':'DC2626'},  # Thick red accent on left
                     right={'val':'single','sz':4,'color':'CBD5E1'})
    
    lines = code_str.strip().split('\n')
    p_first = cell.paragraphs[0]
    p_first.paragraph_format.space_before = Pt(0)
    p_first.paragraph_format.space_after = Pt(0)
    p_first.paragraph_format.line_spacing = 1.0
    
    if lines:
        r0 = p_first.add_run(lines[0])
        r0.font.name = "Consolas"
        r0.font.size = Pt(8.5)
        r0.font.color.rgb = RGBColor(15, 23, 42)
        
    for line in lines[1:]:
        p_line = cell.add_paragraph()
        p_line.paragraph_format.space_before = Pt(0)
        p_line.paragraph_format.space_after = Pt(0)
        p_line.paragraph_format.line_spacing = 1.0
        r = p_line.add_run(line if line else " ")
        r.font.name = "Consolas"
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(15, 23, 42)
        
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)

def add_diagram_image(doc, fig_num, title, img_path, description="", width_inches=5.5):
    """
    Inserts a high-resolution diagram image into the document with a centered caption
    and explanatory descriptive paragraph.
    """
    if not os.path.exists(img_path):
        print(f"[Warning] Diagram file not found: {img_path}")
        return

    # Image container paragraph
    p_img = doc.add_paragraph()
    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_img.paragraph_format.space_before = Pt(12)
    p_img.paragraph_format.space_after = Pt(4)
    run_img = p_img.add_run()
    run_img.add_picture(img_path, width=Inches(width_inches))

    # Caption paragraph
    p_cap = doc.add_paragraph()
    p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cap.paragraph_format.space_before = Pt(2)
    p_cap.paragraph_format.space_after = Pt(8)
    
    run_num = p_cap.add_run(f"Figure {fig_num}: ")
    run_num.font.name = "Times New Roman"
    run_num.font.size = Pt(10.5)
    run_num.font.bold = True
    
    run_title = p_cap.add_run(title)
    run_title.font.name = "Times New Roman"
    run_title.font.size = Pt(10.5)
    run_title.font.italic = True

    # Description paragraph
    if description:
        p_desc = doc.add_paragraph()
        p_desc.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p_desc.paragraph_format.space_before = Pt(0)
        p_desc.paragraph_format.space_after = Pt(10)
        p_desc.paragraph_format.line_spacing = 1.15
        run_desc = p_desc.add_run(description)
        run_desc.font.name = "Times New Roman"
        run_desc.font.size = Pt(10)
        run_desc.font.color.rgb = RGBColor(71, 85, 105)

print("Helper script initialized.")
