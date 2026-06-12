import pytest
from app.services.parse_service import ParseService
from app.models import ContentType

def test_classify_content_vocabulary():
    parser = ParseService()
    vocab_text = (
        "1. apple 蘋果\n"
        "2. banana (n.) 香蕉\n"
        "3. cherry [n.] 櫻桃\n"
        "4. date 棗子\n"
    )
    classification = parser.classify_content(vocab_text)
    assert classification == ContentType.VOCABULARY

def test_classify_content_article():
    parser = ParseService()
    article_text = (
        "This is an English paragraph explaining a concept.\n"
        "這是一段解釋概念的英文段落。\n"
        "Here is the second paragraph in English.\n"
        "這是第二段英文。"
    )
    classification = parser.classify_content(article_text)
    assert classification == ContentType.ARTICLE

def test_classify_content_uncertain():
    parser = ParseService()
    uncertain_text = "Some random text that doesn't fit list or alternating paragraphs cleanly."
    classification = parser.classify_content(uncertain_text)
    assert classification == ContentType.UNCERTAIN

def test_parse_vocabulary_with_typos():
    parser = ParseService()
    ocr_typo_text = (
        "l. apple 蘋果\n"       # 'l' instead of '1'
        "2, banana 香蕉\n"       # comma instead of period
        "3. orange (n.) 柳橙\n"
        "i. melon 哈密瓜"        # 'i' instead of '4' / index
    )
    items = parser.parse_vocabulary(ocr_typo_text)
    
    assert len(items) == 4
    assert items[0].english == "apple"
    assert items[0].chinese == "蘋果"
    assert items[1].english == "banana"
    assert items[1].chinese == "香蕉"
    assert items[2].english == "orange (n.)"
    assert items[2].chinese == "柳橙"
    assert items[3].english == "melon"
    assert items[3].chinese == "哈密瓜"

def test_parse_article_alternating():
    parser = ParseService()
    text = (
        "Hello class. Welcome back.\n"
        "同學們好。歡迎回來。\n"
        "Please open your book to page ten.\n"
        "請打開書到第十頁。"
    )
    segments = parser.parse_article(text)
    
    assert len(segments) == 2
    assert segments[0].sequence == 1
    assert segments[0].english == "Hello class. Welcome back."
    assert segments[0].chinese == "同學們好。歡迎回來。"
    assert segments[1].sequence == 2
    assert segments[1].english == "Please open your book to page ten."
    assert segments[1].chinese == "請打開書到第十頁。"
