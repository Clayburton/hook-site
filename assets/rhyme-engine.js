/* Hook rhyme engine — a faithful port of the app's RhymeAnalyzer / RhymeDictionary /
   Phonetics / RhymePalette (Swift). Same dictionaries, same multisyllabic rime, same
   consonante + asonante keys, same per-paragraph grouping, same bilingual bridge, same
   12-hue palette. Not an approximation — the real engine, running in the browser.

   analyze(text) -> [{ start, end, group }]  (char offsets into text; group = colour index) */

// ===== Phonetics (port of enum Phonetics) =====
const PLOSIVES = new Set(["P","B","T","D","K","G"]);
const FRICATIVES = new Set(["F","V","TH","DH","S","Z","SH","ZH","HH","CH","JH"]);
const NASALS = new Set(["M","N","NG"]);
function family(c){ if(PLOSIVES.has(c))return"P"; if(FRICATIVES.has(c))return"F"; if(NASALS.has(c))return"N"; if(c==="L")return"L"; if(c==="R")return"R"; return c; }
function familyCoda(coda){ return coda.map(family); }
function rhymeCoda(coda){ let c=coda.slice(); if(c.length>1){const last=c[c.length-1]; if(last==="S"||last==="Z")c.pop();} return familyCoda(c); }
function rhymeKeyCoda(coda){ let c=rhymeCoda(coda); if(c.length>=2 && c[c.length-1]==="P"){const prev=c[c.length-2]; if(prev==="N"||prev==="L"||prev==="R")c.pop();} return c; }

// ===== Rime helpers =====
const GLIDES = new Set(["J","W"]);
const stressedVowelOf = r => (r.vowels[0] ?? "AH");

// ===== Dictionaries =====
// word -> { vowels:[], coda:[], lang:"en"|"es" }
let EN = null, ES = null;

function mergeCotCaught(vowels, coda){ if(coda[0]==="R") return vowels; return vowels.map(v=>v==="AO"?"AA":v); }

export function parseDict(text, lang){
  const table = new Map();
  const lines = text.split("\n");
  for(let i=0;i<lines.length;i++){
    const line = lines[i];
    if(!line) continue;
    const t1 = line.indexOf("\t");
    if(t1 < 0) continue;
    const word = line.slice(0, t1);
    const t2 = line.indexOf("\t", t1+1);
    const vowelsStr = t2 < 0 ? line.slice(t1+1) : line.slice(t1+1, t2);
    const codaStr = t2 < 0 ? "" : line.slice(t2+1);
    const vowels = vowelsStr.length ? vowelsStr.split(" ") : [];
    if(!vowels.length) continue;
    const coda = codaStr.length ? codaStr.split(" ") : [];
    table.set(word, lang==="es"
      ? { vowels, coda, lang:"es" }
      : { vowels: mergeCotCaught(vowels, coda), coda, lang:"en" });
  }
  return table;
}

export function setEnglish(table){ EN = table; }
export function setSpanish(table){ ES = table; }
export function englishReady(){ return EN !== null; }
export function spanishReady(){ return ES !== null; }

// ===== normalization (port of RhymeDictionary.normalized) =====
function normalized(raw){
  return raw.toLowerCase().replace(/’/g,"'").replace(/[^\p{L}']/gu,"");
}

// ===== compound-tail rhyme (port) =====
const STRONG_TAILS = new Set(["way","day","night","light","time","side","line","one","self","fire","home","down","out","up","back","world","land","sea","sky","star","sun","moon","rain","storm","wind","snow","cloud","wood","stone","rock","road","street","town","house","room","hall","hill","field","shore","beach","gate","door","wall","floor","roof","yard","bridge","heart","hand","head","face","eye","mind","soul","life","bone","skin","hair","foot","arm","bird","girl","boy","child","friend","fall","break","wake","take","make","throw","blow","flow","know","grow","show","glow","hold","ride","drive","how","now","where","here","there","love","game","name","gold","cold","cake","lake","date","late","wait","tale","ground","round","end","work","word","half","off","print","ache","while","noon","dawn","tide","wave","mate","plate","space","place","race","grace","state","fate"]);
function isStrongTail(suffix){
  if(STRONG_TAILS.has(suffix)) return true;
  if(suffix.length>3 && suffix.endsWith("s")) return STRONG_TAILS.has(suffix.slice(0,-1));
  return false;
}
const arrEq = (a,b) => a.length===b.length && a.every((x,i)=>x===b[i]);
function tailMatches(tail, full){
  if(!arrEq(tail.coda, full.coda)) return false;
  if(tail.vowels.length >= full.vowels.length) return false;
  return arrEq(full.vowels.slice(full.vowels.length - tail.vowels.length), tail.vowels);
}
function compoundTail(word, full){
  if(word.length<5 || full.vowels.length<2) return full;
  for(let start=2; start<=word.length-2; start++){
    const head = word.slice(0,start), suffix = word.slice(start);
    if(isStrongTail(suffix) && EN.has(head) && EN.has(suffix)){
      const tail = EN.get(suffix);
      if(tailMatches(tail, full)) return tail;
    }
  }
  return full;
}
function compoundSuffixRime(word){
  if(word.length<5) return null;
  for(let start=2; start<=word.length-2; start++){
    const head = word.slice(0,start), suffix = word.slice(start);
    if(isStrongTail(suffix) && EN.has(head) && EN.has(suffix)) return EN.get(suffix);
  }
  return null;
}

// ===== dict lookups (port) =====
function englishDictRime(raw){
  if(!EN) return null;
  const word = normalized(raw);
  if(!word) return null;
  if(EN.has(word)) return compoundTail(word, EN.get(word));
  const noApos = word.replace(/'/g,"");
  if(noApos!==word && EN.has(noApos)) return compoundTail(word, EN.get(noApos));
  const c = compoundSuffixRime(word);
  return c || null;
}
function spanishDictRime(raw){
  if(!ES) return null;
  const word = normalized(raw);
  return word ? (ES.get(word) || null) : null;
}

// ===== spelling heuristic (port of heuristicRime) =====
const VOWEL_LETTERS = new Set("aeiouy");
function vowelClass(run){
  switch(run){
    case "ee": case "ea": case "ie": case "ey": return "IY";
    case "ay": case "ai": return "EY";
    case "igh": return "AY";
    case "ow": case "ou": return "AW";
    case "oo": return "UW";
    case "oa": return "OW";
    case "oi": case "oy": return "OY";
    default:
      switch(run[0]){
        case "a": return "AE"; case "e": return "EH"; case "i": return "IH";
        case "o": return "AA"; case "u": return "AH"; case "y": return "AY";
        default: return "AH";
      }
  }
}
function codaPhonemes(letters){
  let s = letters, out = [];
  const digraphs = { th:"TH", sh:"SH", ch:"CH", ng:"NG", ck:"K", ph:"F", gh:"" };
  while(s.length){
    const two = s.slice(0,2);
    if(Object.prototype.hasOwnProperty.call(digraphs, two)){
      const p = digraphs[two]; if(p) out.push(p); s = s.slice(2); continue;
    }
    const c = s[0]; s = s.slice(1);
    switch(c){
      case "c": out.push("K"); break;
      case "x": out.push("K","S"); break;
      case "q": out.push("K"); break;
      case "j": out.push("JH"); break;
      case "y": case "w": case "h": break;
      default: out.push(c.toUpperCase());
    }
  }
  return out;
}
function heuristic(raw){
  const word = normalized(raw);
  if(!word) return null;
  const chars = [...word];
  let lastVowelEnd = -1;
  for(let i=chars.length-1;i>=0;i--){ if(VOWEL_LETTERS.has(chars[i])){ lastVowelEnd=i; break; } }
  if(lastVowelEnd<0) return null;
  let start = lastVowelEnd;
  while(start>0 && VOWEL_LETTERS.has(chars[start-1])) start--;
  const vowelRun = chars.slice(start, lastVowelEnd+1).join("");
  const codaLetters = chars.slice(lastVowelEnd+1).join("");
  const coda = codaPhonemes(codaLetters);
  return { vowels: mergeCotCaught([vowelClass(vowelRun)], coda), coda, lang:"en" };
}

// ===== cross-language keys (port) =====
function unifiedVowel(token){
  switch(token){
    case "IY": case "IH": return "i";
    case "EY": case "EH": return "e";
    case "AE": case "AA": case "AW": case "AY": case "AH": return "a";
    case "AO": case "OW": case "OY": return "o";
    case "UW": case "UH": return "u";
    case "ER": return "a";
    case "A": case "E": case "I": case "O": case "U": return token.toLowerCase();
    default: return token.toLowerCase();
  }
}
function asonanteKey(r){
  return r.vowels.filter(v=>!GLIDES.has(v)).map(unifiedVowel).join("-");
}
function vowelColorant(coda){
  if(coda[0]==="R") return "r";
  if(coda[0]==="L") return "l";
  return "";
}

// ===== analyzer skip / signal sets (port) =====
const SKIP = new Set(["a","an","the","of","i","oh","and","but","or","nor","as","at","in","on","it","if"]);
const ES_SKIP = new Set(["de","del","al","el","la","lo","los","las","un","una","unos","unas","y","e","o","u","que","en","con","por","para","su","sus","se","mi","mis","tu","tus","te","le","les","nos"]);
const ES_FUNCTION = new Set(["el","los","las","una","unos","unas","del","al","que","por","para","sus","tus","mis","muy","pero","porque","cuando","donde","como","hacia","hasta","desde","entre","sobre","según","aunque","hoy","este","esta","estos","estas","ese","esa","esos","esas","eso","esto"]);
const ES_ACCENTS = new Set(["á","é","í","ó","ú","ü","ñ"]);
const MIN_ASS = 3, MAX_ASS = 3, MIN_ASS_BI = 3, MAX_ASS_BI = 4;

const WORD_RE = /[\p{L}][\p{L}'’]*/gu;

// paragraphs = runs separated by a blank line (\n [ \t]* \n), with char offsets preserved
function paragraphRanges(text){
  const ranges = [];
  const re = /\n[ \t]*\n/g;
  let loc = 0, m;
  while((m = re.exec(text)) !== null){
    ranges.push([loc, m.index]);
    loc = m.index + m[0].length;
  }
  ranges.push([loc, text.length]);
  return ranges.filter(([s,e]) => e > s);
}

/** Analyze the whole text; returns [{start,end,group}] sorted by start. group = colour index. */
export function analyze(text){
  if(!text) return [];
  const spans = [];
  let colorIndex = 0;

  for(const [pStart, pEnd] of paragraphRanges(text)){
    const para = text.slice(pStart, pEnd);

    // 1) candidate words with both readings
    const entries = [];
    let wm;
    WORD_RE.lastIndex = 0;
    while((wm = WORD_RE.exec(para)) !== null){
      const word = wm[0];
      const lower = word.toLowerCase();
      if(SKIP.has(lower)) continue;
      entries.push({ start: pStart + wm.index, end: pStart + wm.index + word.length,
                     lower, en: englishDictRime(word), es: spanishDictRime(word) });
    }
    if(!entries.length) continue;

    // 2) bilingual?
    const hasAccent = entries.some(e => [...e.lower].some(c => ES_ACCENTS.has(c)));
    const hasEsFunction = entries.some(e => ES_FUNCTION.has(e.lower));
    const esExclusive = entries.filter(e => e.es && !e.en && e.lower.length>=4).length;
    const bilingual = hasAccent || hasEsFunction || esExclusive>=1;

    // 3) resolve each word to a rime + consonante key + asonante key
    const words = [];
    for(const e of entries){
      if(bilingual && ES_SKIP.has(e.lower)) continue;
      const primary = bilingual ? (e.es || e.en || heuristic(e.lower))
                                : (e.en || heuristic(e.lower));
      if(!primary) continue;
      const coda = primary.vowels.length===1 ? rhymeKeyCoda(primary.coda) : rhymeCoda(primary.coda);
      const key = primary.vowels.join("-") + "|" + coda.join("-");
      const vowel = bilingual ? asonanteKey(primary)
        : (stressedVowelOf(primary) + "/" + primary.vowels.length + "/" + vowelColorant(rhymeCoda(primary.coda)));
      words.push({ start:e.start, end:e.end, key, vowel });
    }

    // full rhymes
    const order = [], rangesOf = new Map(), vowelOfKey = new Map();
    for(const w of words){
      if(!rangesOf.has(w.key)){ order.push(w.key); vowelOfKey.set(w.key, w.vowel); rangesOf.set(w.key, []); }
      rangesOf.get(w.key).push([w.start, w.end]);
    }
    const connected = new Set(order.filter(k => rangesOf.get(k).length >= 2));

    // asonante join
    const vowelHost = new Map();
    for(const key of order){ if(connected.has(key)){ const v = vowelOfKey.get(key); if(v!==undefined && !vowelHost.has(v)) vowelHost.set(v, key); } }
    const looseOrder = [], looseRanges = new Map();
    for(const w of words){
      if(connected.has(w.key)) continue;
      const host = vowelHost.get(w.vowel);
      if(host !== undefined){ rangesOf.get(host).push([w.start, w.end]); }
      else {
        if(!looseRanges.has(w.vowel)){ looseOrder.push(w.vowel); looseRanges.set(w.vowel, []); }
        looseRanges.get(w.vowel).push([w.start, w.end]);
      }
    }

    // paint connected (merge in bilingual)
    const paintKey = k => bilingual ? (vowelOfKey.get(k) ?? k) : k;
    const paintOrder = [], paintRanges = new Map();
    for(const key of order){
      if(!connected.has(key)) continue;
      const pk = paintKey(key);
      if(!paintRanges.has(pk)){ paintOrder.push(pk); paintRanges.set(pk, []); }
      for(const r of rangesOf.get(key)) paintRanges.get(pk).push(r);
    }
    for(const pk of paintOrder){ paint(paintRanges.get(pk), colorIndex++, spans); }

    // loose assonance, rationed
    const minAss = bilingual ? MIN_ASS_BI : MIN_ASS;
    const maxAss = bilingual ? MAX_ASS_BI : MAX_ASS;
    const ranked = looseOrder
      .map((key, idx) => ({ ranges: looseRanges.get(key), order: idx }))
      .filter(g => g.ranges.length >= minAss)
      .sort((a,b) => a.ranges.length !== b.ranges.length ? b.ranges.length - a.ranges.length : a.order - b.order)
      .slice(0, maxAss);
    for(const g of ranked){ paint(g.ranges, colorIndex++, spans); }
  }

  spans.sort((a,b) => a.start - b.start);
  return spans;
}

function paint(ranges, group, spans){
  for(const [start, end] of ranges) spans.push({ start, end, group });
}
