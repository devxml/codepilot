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

MAX_FILE_SIZE_BYTES = 1_000_000  # 1 MB per source file
MAX_SUPPORTED_FILES = 2_000
MAX_EXTRACTED_SIZE_BYTES = 100 * 1_000_000  # 100 MB
MAX_ZIP_SIZE_BYTES = 25 * 1_000_000  # 25 MB


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


def validate_zip_size(size_bytes: int) -> str | None:
    if size_bytes > MAX_ZIP_SIZE_BYTES:
        mb = MAX_ZIP_SIZE_BYTES / 1_000_000
        return f"ZIP file exceeds the {mb:.0f} MB limit."
    return None


def validate_extracted_repo(root_dir: str) -> str | None:
    """Validate extracted/cloned repo size and file count before indexing."""
    total_size = 0
    file_count = 0
    oversized_files: list[str] = []

    root = Path(root_dir)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]

        for filename in filenames:
            full_path = Path(dirpath) / filename
            ext = full_path.suffix.lower()

            if ext not in SUPPORTED_EXTENSIONS:
                continue

            try:
                size = full_path.stat().st_size
            except OSError:
                continue

            if size > MAX_FILE_SIZE_BYTES:
                oversized_files.append(str(full_path.relative_to(root)))
                continue

            total_size += size
            file_count += 1

            if file_count > MAX_SUPPORTED_FILES:
                return f"Repository exceeds the {MAX_SUPPORTED_FILES:,} supported file limit."

    if total_size > MAX_EXTRACTED_SIZE_BYTES:
        mb = MAX_EXTRACTED_SIZE_BYTES / 1_000_000
        return f"Extracted repository size exceeds the {mb:.0f} MB limit."

    if oversized_files:
        sample = ", ".join(oversized_files[:3])
        suffix = f" and {len(oversized_files) - 3} more" if len(oversized_files) > 3 else ""
        return f"Source files exceed the 1 MB limit: {sample}{suffix}."

    if file_count == 0:
        return "No supported source files found in the repository."

    return None


def walk_repo(root_dir: str) -> Generator[dict, None, None]:
    """
    Yields dicts with keys: filepath, filename, language, content.
    Skips unsupported, binary, and oversized files.
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

            # Skip oversized files
            try:
                if full_path.stat().st_size > MAX_FILE_SIZE_BYTES:
                    continue
            except OSError:
                continue

            # Read content, skip binary files
            try:
                content = full_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            if not content.strip():
                continue

            relative_path = str(full_path.relative_to(root))

            yield {
                "filepath": relative_path,
                "filename": filename,
                "language": detect_language(filename),
                "content": content,
            }
