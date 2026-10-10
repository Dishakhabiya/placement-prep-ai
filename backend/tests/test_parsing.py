import io
import os
import pytest
import fitz
import docx

from module1.parsing.clean import clean_text
from module1.parsing.sections import split_into_sections
from module1.parsing.extract_text import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_text,
    DocumentExtractionError
)


def test_clean_text():
    dirty = "John Doe \u2022 Senior Developer\n\n\n\n- Python,   FastAPI   \t & Docker\n“Smart Quotes” – dashes"
    cleaned = clean_text(dirty)
    assert "John Doe" in cleaned
    assert "Python, FastAPI & Docker" in cleaned
    assert '"Smart Quotes"' in cleaned
    assert "- dashes" in cleaned
    assert "\n\n\n" not in cleaned


def test_section_splitting():
    sample_resume = """
John Doe
Software Engineer

TECHNICAL SKILLS
Python, JavaScript, React, FastAPI, SQL, Git

WORK EXPERIENCE
Software Engineer at Acme Corp (2022 - Present)
- Developed REST APIs using FastAPI and PostgreSQL
- Built interactive frontend dashboards in React

ACADEMIC PROJECTS
Task Tracker App
- Full-stack task management system with React and Node.js

EDUCATION
B.Tech in Computer Science, State University, 2022

CERTIFICATIONS
AWS Certified Solutions Architect
"""
    sections = split_into_sections(sample_resume)
    assert "skills" in sections
    assert "experience" in sections
    assert "projects" in sections
    assert "education" in sections
    assert "certifications" in sections
    assert "Python, JavaScript" in sections["skills"]
    assert "Acme Corp" in sections["experience"]


def test_pdf_extraction_in_memory():
    # Generate in-memory PDF
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), "Jane Smith\nTechnical Skills: Python, Machine Learning, PyTorch, Docker\nExperience: AI Researcher at OpenLab")
    pdf_bytes = doc.tobytes()
    doc.close()

    extracted = extract_text_from_pdf(pdf_bytes)
    assert "Jane Smith" in extracted
    assert "Technical Skills" in extracted
    assert "PyTorch" in extracted


def test_docx_extraction_in_memory():
    # Generate in-memory DOCX
    doc = docx.Document()
    doc.add_heading("Alex Rivera", 0)
    doc.add_paragraph("Skills: TypeScript, React Native, Node.js, GraphQL")
    stream = io.BytesIO()
    doc.save(stream)
    docx_bytes = stream.getvalue()

    extracted = extract_text_from_docx(docx_bytes)
    assert "Alex Rivera" in extracted
    assert "React Native" in extracted


def test_empty_and_corrupt_files():
    with pytest.raises(DocumentExtractionError):
        extract_text_from_pdf(b"")

    with pytest.raises(DocumentExtractionError):
        extract_text_from_docx(b"")

    with pytest.raises(DocumentExtractionError):
        extract_text(b"some content", filename="resume.txt")
