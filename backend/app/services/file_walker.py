import os
from pathlib import Path
from typing import Generator

# File extensions we care about
SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx",
    ".java", ".go", ".rs", ".cpp", ".c", ".h",
    ".rb", ".php", ".cs", ".swift", ".kt",
    ".md", ".txt", ".yaml", ".yml", ".json",
    ".html", ".css", ".scss",
    ".sh", ".bash", ".env.example",
}

# Directories to always skip
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "coverage",
    ".mypy_cache", ".pytest_cache", "target", "vendor",
    ".idea", ".vscode",
}

def detect_language(filepath: str) -> str:
    ext = Path(filepath).suffix.lower()
    mapping = {
        ".py": "python", ".js": "javascript", ".ts": "typescript",
        ".tsx": "typescript", ".jsx": "javascript",
        ".java": "java", ".go": "go", ".rs": "rust",
        ".cpp": "cpp", ".c": "c", ".h": "c",
        ".rb": "ruby", ".php": "php", ".cs": "csharp",
        ".swift": "swift", ".kt": "kotlin",
        ".md": "markdown", ".txt": "text",
        ".yaml": "yaml", ".yml": "yaml",
        ".json": "json", ".html": "html",
        ".css": "css", ".scss": "scss",
        ".sh": "bash", ".bash": "bash",
    }
    return mapping.get(ext, "unknown")


def validate_extracted_repo(root_dir: str) -> str | None:
    """Check that a repository contains at least one supported source file."""
    file_count = 0

    root = Path(root_dir)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]

        for filename in filenames:
            full_path = Path(dirpath) / filename
            ext = full_path.suffix.lower()

            if ext not in SUPPORTED_EXTENSIONS:
                continue

            file_count += 1

    if file_count == 0:
        return "No supported source files found in the repository."

    return None


def walk_repo(root_dir: str) -> Generator[dict, None, None]:
    """
    Yields dicts with keys: filepath, filename, language, content.
    Skips unsupported and binary files.
    """
    root = Path(root_dir)
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune skip dirs in-place so os.walk doesn't recurse into them
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]

        for filename in filenames:
            full_path = Path(dirpath) / filename
            ext = full_path.suffix.lower()

            if ext not in SUPPORTED_EXTENSIONS:
                continue

            # Read content, skip binary files
            try:
                content = full_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            if not content.strip():
                continue

            # Store repository paths consistently across Windows and Linux. This is
            # consumed by report folder analysis, the frontend tree, and vector IDs.
            relative_path = full_path.relative_to(root).as_posix()

            yield {
                "filepath": relative_path,
                "filename": filename,
                "language": detect_language(filename),
                "content": content,
            }
