import re
import unicodedata


def clean_text(text: str) -> str:
    """
    Cleans raw extracted text from resumes or job descriptions.
    - Normalizes unicode characters
    - Unifies bullet points and dashes
    - Normalizes horizontal whitespace while preserving paragraph line breaks
    - Removes excessive blank lines
    - Preserves technical symbols (C++, C#, .NET, Node.js)
    """
    if not text:
        return ""

    # Normalize unicode (e.g. smart quotes, non-breaking spaces)
    text = unicodedata.normalize("NFKC", text)

    # Standardize bullet points
    text = re.sub(r"[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25CF\u25CB\u25BA\u25A0]", "\n- ", text)

    # Standardize dashes and quotes
    text = text.replace("“", "\"").replace("”", "\"").replace("‘", "'").replace("’", "'")
    text = text.replace("–", "-").replace("—", "-")

    # Replace weird whitespace characters (tabs, non-breaking space) with standard space
    text = re.sub(r"[ \t\f\v\r]+", " ", text)

    # Fix multiple newlines (keep maximum of 2)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)

    # Clean leading/trailing spaces on each line
    lines = [line.strip() for line in text.split("\n")]
    cleaned_text = "\n".join(lines).strip()

    return cleaned_text
