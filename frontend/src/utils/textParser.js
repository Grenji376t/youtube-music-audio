/**
 * Offline text parser logic (matches the Python backend parsing rules)
 */

export function cleanOcrLine(line) {
  let cleaned = line.trim();
  // Fix index typo like 'l. Hello', 'i. Hello', '1, Hello' -> '1. Hello'
  cleaned = cleaned.replace(/^[liI1][.,\-\s]+/, (match) => {
    if (!match.includes('.')) {
      return match.replace('l', '1').replace('i', '1').replace('I', '1').replace(',', '.');
    }
    return match;
  });
  // Ensure there is a period after the starting digit if followed by text
  cleaned = cleaned.replace(/^(\d+)\s+([a-zA-Z])/, '$1. $2');
  // Normalize spaces
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned;
}

export function classifyContent(text) {
  const lines = text.split('\n').map(cleanOcrLine).filter(l => l.length > 0);
  if (lines.length === 0) return 'uncertain';

  let vocabMatches = 0;
  let enParagraphs = 0;
  let zhParagraphs = 0;

  // Regex for vocab: matches index (optional) followed by English chars, then Chinese chars
  const vocabPattern = /^(\d+[\.\-\s]+)?[a-zA-Z\s'\-\(\)\[\]\.\,\,]+[\u4e00-\u9fff]/;

  lines.forEach(line => {
    if (vocabPattern.test(line)) {
      vocabMatches++;
    }

    const chineseCount = (line.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishCount = (line.match(/[a-zA-Z]/g) || []).length;

    if (chineseCount > 0 && englishCount === 0) {
      zhParagraphs++;
    } else if (englishCount > line.length * 0.1 && chineseCount === 0) {
      enParagraphs++;
    }
  });

  const vocabRatio = vocabMatches / lines.length;

  if (vocabRatio >= 0.4) {
    return 'vocabulary';
  } else if (enParagraphs >= 1 && zhParagraphs >= 1) {
    return 'article';
  } else {
    return 'uncertain';
  }
}

export function parseVocabulary(text) {
  const lines = text.split('\n').map(cleanOcrLine).filter(l => l.length > 0);
  const items = [];

  lines.forEach(line => {
    // Pattern: index (optional), English term with pos labels, Chinese meaning
    const pattern = /^(?:(\d+)[\.\-\s]+)?([a-zA-Z\s'\-\(\)\[\]\.\,\:\?]+?)([\u4e00-\u9fff].*)$/;
    const match = line.match(pattern);

    if (match) {
      const index = match[1] || null;
      let english = match[2].trim();
      const chinese = match[3].trim();
      english = english.replace(/[\-\:\s]+$/, '').trim();
      items.push({ index, english, chinese });
    } else {
      // Split by first Chinese character
      const zhMatch = line.match(/[\u4e00-\u9fff]/);
      if (zhMatch) {
        const idx = zhMatch.index;
        let engPart = line.substring(0, idx).trim();
        const zhPart = line.substring(idx).trim();

        // Check index
        const idxMatch = engPart.match(/^(\d+)[\.\-\s]+/);
        let indexVal = null;
        if (idxMatch) {
          indexVal = idxMatch[1];
          engPart = engPart.substring(idxMatch[0].length).trim();
        }

        engPart = engPart.replace(/[\-\:\s]+$/, '').trim();
        items.push({ index: indexVal, english: engPart, chinese: zhPart });
      } else {
        items.push({ index: null, english: line, chinese: '' });
      }
    }
  });

  return items;
}

export function parseArticle(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const segments = [];
  
  let tempEn = [];
  let tempZh = [];
  let sequence = 1;

  lines.forEach(line => {
    const hasChinese = /[\u4e00-\u9fff]/.test(line);
    const englishMatch = line.match(/[a-zA-Z]/g);
    const hasEnglish = englishMatch && englishMatch.length > line.length * 0.1;

    if (hasChinese && !hasEnglish) {
      if (tempEn.length > 0) {
        if (tempZh.length > 0) {
          segments.push({
            sequence,
            english: tempEn.join(' '),
            chinese: tempZh.join(' ')
          });
          sequence++;
          tempEn = [];
          tempZh = [];
        }
        tempZh.push(line);
      } else {
        tempZh.push(line);
      }
    } else {
      if (tempZh.length > 0) {
        segments.push({
          sequence,
          english: tempEn.length > 0 ? tempEn.join(' ') : '...',
          chinese: tempZh.join(' ')
        });
        sequence++;
        tempEn = [];
        tempZh = [];
      }
      tempEn.push(line);
    }
  });

  if (tempEn.length > 0 || tempZh.length > 0) {
    segments.push({
      sequence,
      english: tempEn.length > 0 ? tempEn.join(' ') : '...',
      chinese: tempZh.length > 0 ? tempZh.join(' ') : '...'
    });
  }

  return segments;
}
