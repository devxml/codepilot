from typing import List
import tiktoken

_tokenizer = tiktoken.get_encoding("cl100k_base")


def _count_tokens(text: str) -> int:
    return len(_tokenizer.encode(text))


def _line_offsets(content: str) -> List[int]:
    """Returns character offset of each line start."""
    offsets = [0]
    for i, ch in enumerate(content):
        if ch == "\n":
            offsets.append(i + 1)
    return offsets


def chunk_file(
    content: str,
    filepath: str,
    language: str,
    chunk_size: int = 512,
    overlap: int = 50,
) -> List[dict]:
    """
    Splits `content` into chunks of ~chunk_size tokens with `overlap` token overlap.
    Returns a list of chunk dicts:
        text, filepath, language, start_line, end_line, chunk_index
    """
    lines = content.split("\n")
    chunks = []
    current_lines: List[str] = []
    current_tokens = 0
    chunk_index = 0
    start_line = 1

    for line_num, line in enumerate(lines, start=1):
        line_tokens = _count_tokens(line + "\n")

        # If adding this line would exceed chunk_size, flush current chunk
        if current_tokens + line_tokens > chunk_size and current_lines:
            chunk_text = "\n".join(current_lines)
            chunks.append({
                "text": chunk_text,
                "filepath": filepath,
                "language": language,
                "start_line": start_line,
                "end_line": line_num - 1,
                "chunk_index": chunk_index,
            })
            chunk_index += 1

            # Roll back `overlap` tokens worth of lines for the next chunk
            overlap_lines: List[str] = []
            overlap_tokens = 0
            for prev_line in reversed(current_lines):
                t = _count_tokens(prev_line + "\n")
                if overlap_tokens + t > overlap:
                    break
                overlap_lines.insert(0, prev_line)
                overlap_tokens += t

            # Recalculate start_line for the overlap section
            start_line = (line_num - 1) - len(overlap_lines) + 1
            current_lines = overlap_lines
            current_tokens = overlap_tokens

        current_lines.append(line)
        current_tokens += line_tokens

    # Flush the last remaining chunk
    if current_lines:
        chunks.append({
            "text": "\n".join(current_lines),
            "filepath": filepath,
            "language": language,
            "start_line": start_line,
            "end_line": len(lines),
            "chunk_index": chunk_index,
        })

    return chunks
