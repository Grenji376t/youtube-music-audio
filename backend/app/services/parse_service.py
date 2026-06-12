import re
import logging
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from ..models import ContentType, VocabularyItem, ArticleSegment

logger = logging.getLogger(__name__)

class ParseService:
    def clean_ocr_line(self, line: str) -> str:
        """
        Fixes common OCR errors and cleans text.
        """
        line = line.strip()
        # Fix index typo like 'l. Hello', 'i. Hello', '1, Hello' -> '1. Hello'
        line = re.sub(r'^[liI1][\.,\-\s]+', lambda m: m.group(0).replace('l', '1').replace('i', '1').replace('I', '1').replace(',', '.') if '.' not in m.group(0) else m.group(0), line)
        # Ensure there is a period after the starting digit if followed by text
        line = re.sub(r'^(\d+)\s+([a-zA-Z])', r'\1. \2', line)
        # Normalize spaces
        line = re.sub(r'\s+', ' ', line)
        return line

    def clean_text(self, text: str) -> str:
        """
        Cleans URLs, consecutive spaces, and invalid Unicode control characters.
        """
        # Remove URLs
        text = re.sub(r'https?://\S+|www\.\S+', '', text)
        # Normalize spaces/newlines
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n\s*\n+', '\n\n', text)
        return text.strip()

    def parse_epub(self, epub_path: Path) -> str:
        """
        Extracts raw text from an EPUB file.
        """
        try:
            import ebooklib
            from ebooklib import epub
            from bs4 import BeautifulSoup
        except ImportError:
            raise ImportError("ebooklib and beautifulsoup4 are required for EPUB parsing.")

        book = epub.read_epub(str(epub_path))
        text_content = []
        
        # Sort items to maintain reading order
        items = list(book.get_items())
        for item in items:
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                text = soup.get_text()
                if text.strip():
                    text_content.append(text.strip())
                    
        return "\n\n".join(text_content)

    def identify_chapters(self, text: str) -> List[Dict[str, str]]:
        """
        Splits a text into chapters using Regex detection.
        Returns a list of dicts: [{"title": "Chapter Title", "content": "..."}]
        """
        lines = text.split("\n")
        chapters = []
        current_title = "Introduction"
        current_content = []
        
        # Regex patterns for chapters
        chapter_patterns = [
            re.compile(r'^#\s+(.+)$'), # Markdown H1
            re.compile(r'^(第\s*[一二三四五六七八九十百千0-9]+\s*[章回篇課])\s*(.*)$', re.IGNORECASE), # Chinese Chapter
            re.compile(r'^(Chapter\s+[0-9]+)\s*(.*)$', re.IGNORECASE), # English Chapter
            re.compile(r'^(Part\s+[0-9]+)\s*(.*)$', re.IGNORECASE) # English Part
        ]
        
        for line in lines:
            line_stripped = line.strip()
            is_header = False
            matched_title = ""
            
            for pattern in chapter_patterns:
                m = pattern.match(line_stripped)
                if m:
                    is_header = True
                    if len(m.groups()) == 2:
                        # e.g., "第1章" and "音樂的起源" -> "第1章 音樂的起源"
                        g1, g2 = m.group(1).strip(), m.group(2).strip()
                        matched_title = f"{g1} {g2}".strip() if g2 else g1
                    else:
                        matched_title = m.group(1).strip()
                    break
            
            if is_header:
                if current_content or current_title != "Introduction":
                    chapters.append({
                        "title": current_title,
                        "content": "\n".join(current_content).strip()
                    })
                current_title = matched_title
                current_content = []
            else:
                current_content.append(line)
                
        # Add last chapter
        if current_content or current_title != "Introduction":
            chapters.append({
                "title": current_title,
                "content": "\n".join(current_content).strip()
            })
            
        return chapters

    def split_smart_chunks(self, text: str, max_chars: int = 350) -> List[str]:
        """
        Intelligently splits text using sentence boundaries (。, ！, ？, ., !, ?) and newlines.
        Ensures chunks do not exceed max_chars while keeping sentences together.
        """
        # Split by punctuation, keeping punctuation marks
        parts = re.split(r'([。！？；.!?;\n]+)', text)
        chunks = []
        current_chunk = ""
        
        for i in range(0, len(parts), 2):
            sentence = parts[i]
            punctuation = parts[i+1] if i+1 < len(parts) else ""
            full_sentence = (sentence + punctuation).strip()
            if not full_sentence:
                continue
                
            if len(current_chunk) + len(full_sentence) > max_chars:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                current_chunk = full_sentence
            else:
                current_chunk = f"{current_chunk} {full_sentence}".strip() if current_chunk else full_sentence
                
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
            
        return chunks

    def classify_content(self, text: str) -> ContentType:
        """
        Classifies raw text into vocabulary or article.
        """
        lines = [self.clean_ocr_line(l) for l in text.split("\n") if l.strip()]
        if not lines:
            return ContentType.UNCERTAIN

        vocab_matches = 0
        article_matches = 0
        
        vocab_pattern = re.compile(r'^(\d+[\.\-\s]+)?[a-zA-Z\s\'\-\(\)\[\]\.\,]+[\u4e00-\u9fff]')
        
        for line in lines:
            if vocab_pattern.match(line):
                vocab_matches += 1

        en_paragraphs = 0
        zh_paragraphs = 0
        for line in lines:
            has_chinese = len(re.findall(r'[\u4e00-\u9fff]', line)) > 0
            has_english = len(re.findall(r'[a-zA-Z]', line)) > len(line) * 0.1
            
            if has_chinese and not has_english:
                zh_paragraphs += 1
            elif has_english and not has_chinese:
                en_paragraphs += 1

        vocab_ratio = vocab_matches / len(lines)
        
        logger.info(f"Classification details - Lines: {len(lines)}, Vocab matches: {vocab_matches} ({vocab_ratio:.2f}), EN paragraphs: {en_paragraphs}, ZH paragraphs: {zh_paragraphs}")

        if vocab_ratio >= 0.4:
            return ContentType.VOCABULARY
        elif en_paragraphs >= 1 and zh_paragraphs >= 1:
            return ContentType.ARTICLE
        else:
            return ContentType.UNCERTAIN

    def parse_vocabulary(self, text: str) -> List[VocabularyItem]:
        """
        Parses text lines into structured VocabularyItems.
        """
        items = []
        lines = [self.clean_ocr_line(l) for l in text.split("\n") if l.strip()]
        
        for line in lines:
            pattern = r'^(?:(\d+)[\.\-\s]+)?([a-zA-Z\s\'\-\(\)\[\]\.\,\:\?]+?)([\u4e00-\u9fff].*)$'
            match = re.match(pattern, line)
            if match:
                index = match.group(1)
                english = match.group(2).strip()
                chinese = match.group(3).strip()
                
                english = re.sub(r'[\-\:\s]+$', '', english).strip()
                items.append(VocabularyItem(index=index, english=english, chinese=chinese))
            else:
                zh_start_match = re.search(r'[\u4e00-\u9fff]', line)
                if zh_start_match:
                    idx = zh_start_match.start()
                    eng_part = line[:idx].strip()
                    zh_part = line[idx:].strip()
                    
                    idx_match = re.match(r'^(\d+)[\.\-\s]+', eng_part)
                    index_val = None
                    if idx_match:
                        index_val = idx_match.group(1)
                        eng_part = eng_part[idx_match.end():].strip()
                    
                    eng_part = re.sub(r'[\-\:\s]+$', '', eng_part).strip()
                    items.append(VocabularyItem(index=index_val, english=eng_part, chinese=zh_part))
                else:
                    items.append(VocabularyItem(index=None, english=line, chinese=""))
                    
        return items

    def parse_article(self, text: str) -> List[ArticleSegment]:
        """
        Parses text paragraphs into alternating English and Chinese ArticleSegments.
        """
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        segments = []
        
        temp_en = []
        temp_zh = []
        sequence = 1
        
        for line in lines:
            has_chinese = len(re.findall(r'[\u4e00-\u9fff]', line)) > 0
            has_english = len(re.findall(r'[a-zA-Z]', line)) > len(line) * 0.1
            
            if has_chinese and not has_english:
                if temp_en:
                    if temp_zh:
                        segments.append(ArticleSegment(
                            sequence=sequence,
                            english=" ".join(temp_en),
                            chinese=" ".join(temp_zh)
                        ))
                        sequence += 1
                        temp_en = []
                        temp_zh = []
                    temp_zh.append(line)
                else:
                    temp_zh.append(line)
            else:
                if temp_zh:
                    segments.append(ArticleSegment(
                        sequence=sequence,
                        english=" ".join(temp_en) if temp_en else "...",
                        chinese=" ".join(temp_zh)
                    ))
                    sequence += 1
                    temp_en = []
                    temp_zh = []
                temp_en.append(line)
                
        if temp_en or temp_zh:
            segments.append(ArticleSegment(
                sequence=sequence,
                english=" ".join(temp_en) if temp_en else "...",
                chinese=" ".join(temp_zh) if temp_zh else "..."
            ))
            
        return segments
