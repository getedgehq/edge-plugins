// Edge prompt classifier v2 (funnel Step 1, FUNNEL-FIX-PLAN-AGREED-2026-10-04,
// Amendment 1). Local rules plus a score over feature families, English and
// German. No dependencies, no network, no filesystem, no logging: the prompt
// never leaves this function and nothing about it is kept.
//
// Precedence: explicit opt-out (hard veto of nudge and gate) -> explicit opt-in
// -> trivial bounded operation (vetoes the gate, strong negative for the nudge)
// -> chat, follow-ups, simple facts, arithmetic, explanations, non-work
// -> scored specialist evidence. The gate needs a higher score, an action
// (intent or analysis) and at least two independent families: nouns alone never
// cross it.

export const T_NUDGE = 3;
export const T_GATE = 6;
const MAX = 32_768;

const alt = list => list.join('|');
// Bounded input: at most 32 KB, and no token longer than 64 characters (real words,
// paths and URLs are shorter; a giant token would only slow the patterns down).
const bound = prompt => prompt.slice(0, MAX).replace(/\S{65,}/g, m => (/^https?:\/\//i.test(m) ? ' https://link ' : ' LONGTOKEN '));
// Word boundaries that also hold for German letters (\b does not).
const wb = (body, flags = 'iu') => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${body})(?![\\p{L}\\p{N}_])`, flags);

// ---------- explicit opt-out ------------------------------------------------
// "Edge" the product, not edge cases, edge functions, Microsoft Edge and so on.
const EDGE = String.raw`edge(?:\.find_skill|[- ]skills?|[- ]plugin)?(?![-\s]*(?:cases?|functions?|runtime|network|locations?|caching|cache|nodes?|devices?|detection|browser|computing|middleware|config|lambda|regions?|servers?|workers?)\b)(?<!\b(?:microsoft|leading|bleeding|cutting|sharp|rough|knife|trailing|hard|soft|left|right|top|bottom|outer|inner|vercel|cloudflare|supabase|netlify)[\s-]edge)`;
const TARGET = String.raw`(?:${EDGE}|find[_ ]?skills?|use[_ ]skill|skill[- ]?(?:search|suche|lookups?|suchen?|calls?|loading|marketplace|library|librar(?:y|ies)|bibliothek|store)|skills?|plugins?|plug-ins?|playbooks?|marketplace|erweiterungen?)`;
const NEG_EN = String.raw`(?:do\s*not|don'?t|dont|does\s*n[o']?t|doesn'?t|did\s*n[o']?t|never|no|not|without|w/o|skip(?:ping)?|avoid(?:ing)?|exclude|excluding|leave\s+out|leaving\s+out|disabl\w*|deactivat\w*|turn(?:ed)?\s+off|switch(?:ed)?\s+off|stop\s+(?:using|calling)|refrain\s+from|forget\s+about|forgo|ignore|no\s+need\s+(?:for|to)|nothing\s+from|bypass|zero|none\s+of)`;
const NEG_DE = String.raw`(?:ohne|kein(?:e[nmrs]?)?|nicht|nie(?:mals)?|verzicht\w*|lass\w*|weglassen|ausschalten|ausgeschaltet|abgeschaltet|deaktivier\w*|überspring\w*|ignorier\w*)`;
const OPT_OUT = [
  // negation ... target, inside one clause
  new RegExp(String.raw`(?<![\p{L}])(?:${NEG_EN}|${NEG_DE})(?![\p{L}])[^.!?\n;:]{0,48}?(?<![\p{L}])${TARGET}(?![\p{L}])`, 'iu'),
  // target ... negation: "Edge not needed", "skills off", "Skills brauche ich nicht"
  new RegExp(String.raw`(?<![\p{L}])${TARGET}(?![\p{L}])[^.!?\n;]{0,30}?(?<![\p{L}])(?:not\s+(?:needed|necessary|required|wanted|allowed)|unnecessary|off|aus|forbidden|verboten|disabled|banned|nicht\s+(?:nötig|nutzen|benutzen|verwenden|aufrufen|einsetzen|suchen|laden|gebraucht|notwendig|erforderlich)|nicht|kein\w*|brauch\w*\s+(?:ich|wir|es)?\s*nicht|weglassen|weg|raus|unnötig|no\s+thanks?|nein)(?![\p{L}])`, 'iu'),
  // "leave/keep Edge out (of this)", "lass Edge weg"
  new RegExp(String.raw`(?<![\p{L}])(?:leave|keep|lass\w*)\s+(?:the\s+|any\s+)?${TARGET}\s+(?:out|alone|aside|weg|raus|beiseite|außen\s+vor)`, 'iu'),
  // "no skill lookups", "keine Suche nach Skills"
  new RegExp(String.raw`(?<![\p{L}])(?:no|keine?|without|ohne|skip)\s+(?:external\s+|extra\s+|any\s+)?(?:skill\s+)?(?:look\s*ups?|searches|suche)(?![\p{L}])`, 'iu'),
];

/** True when the prompt explicitly asks not to use Edge, skills, plugins or find_skill. */
export function optOut(prompt) {
  if (typeof prompt !== 'string') return false;
  const text = bound(prompt);
  return OPT_OUT.some(re => re.test(text));
}

const OPT_IN = new RegExp(String.raw`(?<![\p{L}])(?:(?:use|try|call|ask|search|consult|via|load|nutze|verwende|benutze|frag|durchsuche)\s+(?:the\s+)?(?:edge(?:\.find_skill)?|find_skill)(?![-\s]*(?:cases?|functions?|runtime|caching|browser|network))|(?:find|search\s+for|look\s+for|look\s+up|suche?|finde)\s+(?:me\s+)?(?:a|an|the|einen?|passende[n]?)?\s*(?:edge\s+)?skills?\s+(?:for|on\s+edge|in\s+edge|für|auf\s+edge))`, 'iu');

// ---------- trivial bounded operations ---------------------------------------
const LEAD = String.raw`^(?:(?:please|pls|plz|bitte|kannst\s+du|could\s+you|can\s+you|can\s+u|would\s+you|quick(?:ly)?|just|now|ok(?:ay)?|hey|also)[\s,:]+)*(?:(?:in|im|in\s+der|in\s+dem|inside|for|on)\s+[\w./~-]+(?:\s+[\w./-]+){0,3}?\s*[,:]?\s+)?`;
const UI = String.raw`h[1-6]|heading|headings|title|titel|button|link|label|text|footer|header|navbar|nav|menu|logo|icon|image|bild|tab|card|modal|banner|tooltip|placeholder|font|schrift|border|margin|padding|column|spalte|row|zeile|cell|zelle|caption|subtitle|badge|section|abschnitt|paragraph|absatz|page\s+title|line|lines`;
const STYLE = String.raw`bold|fett|italic|kursiv|underlined?|bigger|smaller|larger|wider|narrower|taller|shorter|full[- ]width|centered|zentriert|left[- ]aligned|right[- ]aligned|hidden|visible|sticky|rounded|uppercase|lowercase|red|blue|green|black|white|gray|grey|darker|lighter|transparent|responsive|clickable|disabled|optional|required`;
const TRIVIAL_OPS = [
  String.raw`renam\w*|benenne|umbenenn\w*`,
  String.raw`(?:fix|correct|korrigier\w*|behebe?)\b[^\n]{0,90}?\b(?:typos?|grammar|spelling|misspelling|tippfehler|rechtschreib\w*|indent\w*|einrückung|syntax\s+error|missing\s+semicolon|capitali[sz]ation)`,
  String.raw`(?:swap|vertausch\w*|tausch\w*|reorder)`,
  String.raw`(?:move|put|verschieb\w*)\s+[^\n]{1,60}?\s+to\s+the\s+(?:top|bottom|end|start|beginning|front|back)\b`,
  String.raw`(?:[\w-]+\s+)?(?:fmt|prettier|black|gofmt|rustfmt)\b|(?:terraform|cargo|go|ruff|black|prettier|dotnet)\s+(?:fmt|format)\b`,
  String.raw`(?:add|insert|füg\w*)\s+(?:a\s+|an\s+|the\s+)?(?:page\s+numbers?|seitenzahlen|footer|header|border|shadow|divider|spacer|padding|margin|bullets?|numbering|watermark|date|datum|timestamp|line\s+numbers?|alt\s+text|favicon\s+link|tooltip)\b`,
  String.raw`(?:fix|resolve|silence)\s+(?:the\s+|this\s+|a\s+|that\s+)?(?:lint|linter|eslint|flake8|ruff|type|typescript|tsc|mypy|syntax|import|indentation)\s+(?:errors?|warnings?|issues?)\b`,
  String.raw`(?:move|verschieb\w*|put)\s+(?:the\s+)?(?:[\w'"‘’“”.-]+\s+){1,5}?(?:before|after|above|below|vor|nach|hinter|über|unter)\s+(?:the\s+)?["'“‘]?[\w-]+["'”’]?`,
  String.raw`(?:copy|kopier\w*|cp|move|mv|verschieb\w*)\s+(?:the\s+|die\s+|den\s+|das\s+|all\s+the\s+)?(?:[\w.*/-]+\s+){0,3}?(?:from\s+\S+\s+)?(?:to|into|nach|in|unter)\s+\S+\s*[.!]?$`,
  String.raw`(?:copy|kopier\w*|cp|move|mv|verschieb\w*)\s+[\w.-]+\.\w{1,5}\b`,
  String.raw`(?:bump|increment|erhöh\w*)\b[^.\n]{0,40}\bversion|(?:bump|update|set|change|upgrade|ändere|setze)\s+(?:the\s+|die\s+|den\s+)?(?:[\w@/.-]+\s+){0,3}(?:version|versionsnummer)\b|bump\s+[\w@/.-]+\s+to\b`,
  String.raw`(?:print|tail|head|cat|show(?:\s+me)?|zeig\w*|gib\s+mir)\s+(?:the\s+|die\s+)?(?:last|first|letzten|ersten|top)\s+\d+\s+(?:lines|zeilen|entries|rows|commits)`,
  String.raw`(?:tail|cat|head|less|ls|pwd|cd|git\s+(?:status|log|diff|add|commit|push|pull|stash|checkout|branch|rebase|fetch))\b`,
  String.raw`(?:run|start|restart|stop|kill|führ\w*|starte?\w*)\s+(?:the\s+|die\s+|den\s+|all\s+the\s+|whatever\s+is\s+running\s+on\s+)?(?:unit\s+|e2e\s+)?(?:tests?|linter|lint|build|formatter|dev\s*server|server|app|container|port\s+\d+|process|script|migrations?|tests?\s+again)\b[^.\n]{0,25}$`,
  String.raw`(?:open|öffne|install|uninstall|installier\w*|pull|push|commit|stash|rebuild|reinstall|redeploy|deploy\s+(?:it|this)\s+(?:to\s+\w+)?$)\b(?:[^.\n]|\.(?=\w)){0,50}[.!]?$`,
  String.raw`(?:show|zeig)\w*\s+(?:me\s+|mir\s+)?(?:the\s+|den\s+|die\s+)?(?:diff|log|logs|status|changes|änderungen|files|dateien|branches|output|errors?)\b[^.\n]{0,30}$`,
  String.raw`list\s+(?:all\s+|the\s+)?(?:files|branches|commits|tags|containers|processes|dependencies|env\s+vars)\b[^.\n]{0,40}$`,
  String.raw`(?:delete|remove|entfern\w*|lösch\w*|drop|strip)\s+(?:the\s+|this\s+|that\s+|a\s+|an\s+|all\s+(?:the\s+)?|die\s+|den\s+|das\s+)?(?:unused|extra|duplicate|trailing|empty|blank|commented|stray|old|last|first|überflüssig\w*|unbenutzt\w*|doppelt\w*|alten?)?\s*(?:import|line|comment|variable|console\.logs?|print|log|newline|whitespace|space|semicolon|word|zeile|kommentar|wort|leerzeile|file|datei|slide|folie|page|seite|row|column|spalte|cell|section|paragraph|todo|debug\w*)s?\b`,
  String.raw`(?:add|insert|append|prepend|put|füg\w*|ergänz\w*|setz\w*|schreib\w*)\s+(?:a\s+|an\s+|the\s+|one\s+|einen?\s+|ein\s+|das\s+|die\s+|den\s+)?(?:short\s+|brief\s+|small\s+|kurzen?\s+|trailing\s+|missing\s+|final\s+)?(?:comment|print(?:\s+statement)?|log(?:\s+line)?|console\.log|docstring|todo|import|newline|blank\s+line|semicolon|comma|period|word|line\s+break|kommentar|wort|leerzeile|type\s+hints?)\b`,
  String.raw`(?:add|insert|append|put|füg\w*)\s+(?:the\s+)?(?:word|text|string|phrase|line|label|link|button|badge|tag)?\s*(?:["'“‘\d]|(?<=(?:word|text|label|tag)\s+)\S)[^\n]{0,40}?\s(?:to|next\s+to|in|into|on|after|before|above|below|zu|in\s+die|neben)\s`,
  String.raw`(?:add|insert|put)\s+(?:the\s+|a\s+|an\s+)?[\w-]+\s+(?:link|button|label|badge|icon|tag)\s+(?:to|in|on|next\s+to)\s`,
  String.raw`(?:sort|sortier\w*)\b[^.\n]{0,60}\b(?:alphabetical\w*|alphabetisch|by\s+(?:name|date|size|length)|ascending|descending|aufsteigend|absteigend|numerically)`,
  String.raw`(?:replace|ersetz\w*|substitute|swap\s+out)\s+[^\n]{0,60}?\s+(?:with|by|durch|mit|for)\s+`,
  String.raw`(?:change|update|set|switch|ändere|änder|setze|setz|stell\w*|edit)\s+(?:only\s+)?(?:[\w.#'"@-]+\s+){0,6}?(?:to|auf|zu|=)\s+(?:["'“‘#$€@\d][^\n]{0,40}|[\w.:@/+-]*[\d_:@/.#-][\w.:@/+-]*|\w+)(?:\s+(?:in|im|on|for)\s+[^\n]{1,40})?\s*[.!]?$`,
  String.raw`(?:change|update|set|make|switch|turn|ändere|änder|setze|setz|mach|stell\w*|edit)\s+(?:only\s+)?(?:the\s+|this\s+|die\s+|den\s+|das\s+|der\s+)?(?:[\w.#'"-]+\s+){0,5}?(?:title|titel|seitentitel|heading|überschrift|text|label|colou?r|farbe|font(?:\s+size)?|schrift\w*|year|jahr|date|datum|name|link|url|href|margin|padding|width|height|size|größe|duration|dauer|value|wert|key|word|wort|header|footer|fußzeile|kopfzeile|caption|placeholder|message|meldung|button\s+text|button|port|timeout|limit|default|alt\s+text|icon|emoji|email\s+address|e-mail|number|nummer|price|preis|tooltip|copyright|greeting|variable|cell|zelle)\b[^\n]{0,80}?(?:\bfrom\b[^\n]{1,60}\bto\b|\bto\b\s*["'“‘#/\d$€]|\bto\s+\w+\s*[.!]?$|\binstead\s+of\b|\bauf\s+["'“‘\d#]|\bauf\s+\w+\s*[.!]?$|\bzu\s+["'“‘]|\bvon\b[^\n]{1,40}\bauf\b|\bin\s+["'“‘]|\bsay\s+["'“‘]|\b\d+(?:px|pt|em|rem|%|s|ms)\b)`,
  String.raw`(?:make|mach)\s+(?:the\s+|this\s+|that\s+|die\s+|den\s+|das\s+)?(?:[\w.#-]+\s+){0,3}?(?:${UI})\b[^\n]{0,40}?\b(?:${STYLE})\b`,
  String.raw`(?:capitali[sz]e|lowercase|uppercase|wrap|indent|dedent|trim|reformat|prettify|lint)\b`,
  String.raw`(?:translate|übersetz\w*)\s+["'“‘][^"'”’]{1,80}["'”’]`,
  String.raw`(?:uncomment|comment\s+out|kommentier\w*\s+aus)\b`,
];
const TRIVIAL = new RegExp(`${LEAD}(?:${alt(TRIVIAL_OPS)})`, 'iu');
// Evidence that a mechanical verb carries a broader task.
const SCOPE = [
  /\b\d{1,3}(?:[,.]\d{3})+\s+\w+|\b\d{3,}\s+(?:files|documents|docs|records|rows|pages|images|photos|invoices|receipts|dokumente|dateien|rechnungen|belege)\b/i,
  wb(String.raw`per|according\s+to|in\s+line\s+with|to\s+comply|complian(?:t|ce)|retention|regulat\w+|gemäß|entsprechend|aufbewahrung\w*|konform\w*|vorschrift\w*|richtlinien?|regeln`),
  wb(String.raw`reorgani[sz]\w*|restructur\w*|organi[sz]e\w*|categori[sz]\w*|classif\w*|sort\s+\w+\s+into|into\s+(?:folders|categories)|deductible|umstrukturier\w*|neu\s+organisier\w*|kategorisier\w*`),
  /\b(?:and|then|also|und|dann|danach|plus)\b[,\s]+(?:also\s+|then\s+)?(?:fix\s+(?:whatever|everything|anything|all)|migrat|refactor|redesign|design|audit|review|analy[sz]|write\s+(?:a|an|the|tests?|docs)|build|create|draft|implement|optimi[sz]|test\b|add\s+(?:tests?|a\s+\w+\s+(?:sheet|page|section|chart|report))|plan|research|überarbeit|prüf|analysier|erstell|schreib)/i,
  /\bwhatever\s+breaks\b|\beverything\s+that\s+breaks\b/i,
];

/** True for a bounded mechanical operation (rename, small text edit, swap, version bump,
 *  copy or move, typo fix, print or tail, literal substitution) with no sign of broader scope. */
export function trivial(prompt) {
  if (typeof prompt !== 'string') return false;
  const text = bound(prompt).trim();
  if (text.split(/\s+/).length > 30) return false;
  const first = text.split(/(?<=[.!?;])\s+|\n/)[0];
  if (!TRIVIAL.test(first)) return false;
  return !SCOPE.some(re => re.test(text));
}

// ---------- chat, follow-ups, facts, arithmetic, explanations, non-work ------
const CHAT = new RegExp(String.raw`^(?:hi|hello|hey|hallo|moin|servus|yo|thanks?|thank\s+you|thx|ty|danke|merci|ok(?:ay)?|cool|nice|great|perfect|perfekt|super|prima|awesome|sounds\s+good|looks\s+good|lgtm|got\s+it|makes\s+sense|yes|yeah|yep|ja|jo|no|nope|nein|sure|klar|alright|lol|haha|hmm+|wow|sorry|good\s+(?:morning|night|job|evening)|guten\s+(?:morgen|tag|abend)|how(?:'s|\s+is|\s+are)\s+(?:it\s+going|you|things)|wie\s+geht'?s|you(?:'re|\s+are)\s+(?:the\s+best|great|awesome|amazing)|passt|fair\s+enough|never\s+mind|egal|where\s+were\s+we|ready\s+when)\b`, 'iu');
const FOLLOW = new RegExp(String.raw`^(?:(?:please|pls|bitte|ok(?:ay)?|yes|ja|now|nun|jetzt|then|dann|and|und|can\s+you|could\s+you)[\s,]+)*(?:try\s+again|again|retry|nochmal|noch\s*mal|go\s+ahead|go\s+on|go\s+with|continue|keep\s+going|proceed|weiter(?:machen)?|mach\s+weiter|fahr\s+fort|do\s+(?:it|that|the\s+same|so|this)|same\s+(?:thing|for|with|again)|the\s+same\s+for|undo|revert|redo|rückgängig|(?:commit|push|merge|ship)(?:\s+(?:it|that|this|now|to\s+\w+|the\s+(?:branch|pr|changes)))?\s*[.!]?$|stop|halt|wait|cancel|abbrechen|repeat|wiederhol\w*|shorten|kürz\w*|summari[sz]e\s+(?:what|this\s+conversation|the\s+conversation|our)|fass\s+zusammen|what(?:'s|\s+is)\s+(?:your|the)\s+(?:status|progress)|status\??|show\s+me\s+what(?:'s|\s+is)\s+in|what\s+files\s+(?:did|have)|list\s+(?:the\s+)?files|which\s+files|use\s+the\s+(?:first|second|other|previous)|option\s+\d|pick\s+(?:the\s+)?(?:first|second|other)|looks\s+good|sounds\s+good|that\s+works|nimm\s+(?:die|den|das)\s+\w+)\b`, 'iu');
const QUESTION_START = /^(?:(?:so|and|also|ok(?:ay)?|hey|quick\s+question|question|btw)[\s,:]+)?(?:what|what's|whats|who|whom|whose|when|where|why|which|how|is|are|was|were|does|do|did|can(?!\s+(?:you|u|ya)\b)|could(?!\s+(?:you|u)\b)|should|would(?!\s+(?:you|u)\b)|will(?!\s+you\b)|has|have|am|wer|wie|was|wann|wo|warum|wieso|weshalb|welche[rsnm]?|ist|sind|gibt|kann(?!st\s+du)|muss|soll|hat|haben)\b/i;
const EXPLAIN = new RegExp(String.raw`^(?:(?:please|pls|bitte|can\s+you|could\s+you|kannst\s+du|könntest\s+du|quick(?:ly)?|briefly|kurz)[\s,]+)*(?:explain|erklär\w*|eli5|define|definier\w*|describe\s+(?:what|how)|tell\s+me\s+(?:what|how|why|about)|what\s+(?:is|are|was|does|do|did)\b|what's\s+(?:a|an|the\s+difference|the\s+meaning|the\s+point)|whats\s+(?:a|an|the\s+difference)|how\s+(?:does|do|did|is|are)\s+[^?]{1,60}(?:work|differ|compare)|why\s+(?:is|are|does|do|did|would)|was\s+(?:ist|sind|bedeutet|heißt|macht)|wie\s+funktionier\w*|was\s+(?:ist\s+)?der\s+unterschied|what'?s?\s+the\s+difference|difference\s+between|meaning\s+of|was\s+heißt|wofür\s+steht|what\s+does\s+\S+\s+stand\s+for|wofür\s+braucht\s+man)`, 'iu');
const ARITH = new RegExp(String.raw`(?:\d[\d,.]*\s*%\s*(?:of|von|on|auf)\s*[$€£]?\d|\b(?:convert|umrechn\w*|rechne)\s+[$€£]?[\d.,]+\s*(?:°|degrees?|grad)?\s*\w+\s+(?:to|into|in)\s+\w+|\bhow\s+(?:many|much)\s+(?:is\s+)?[$€£]?\d|\bhow\s+(?:many|much)\s+\w+\s+(?:are\s+)?(?:in|is|are)\s+(?:a|an|one|\d)|\bwie\s+viele?\s+\w+\s+(?:hat|haben|sind|in)|\bwie\s+viel\s+(?:sind|ist|kostet)\s+[\d]|\bsplit\s+(?:a|the)\s+[$€£]?\d+|\bwhat\s+(?:day|time|year|date)\b|\bis\s+\d+\s+(?:a\s+)?prime|\bdays?\s+between\b|^[\d\s+\-*/().,^%=x]+\??$)`, 'iu');
// Asks for something to be produced on top of a question ("write it up", "and draft...").
const WORK_CLAUSE = new RegExp(String.raw`(?:^|[.;!?]\s+|\b(?:and|then|und|dann)\s+)(?:please\s+)?(?:write|draft|make|create|build|prepare|turn|put|produce|generate|list|go\s+through|go\s+over|dig|look\s+at|audit|review|check|analy[sz]e|fix|plan|design|help\s+me|tell\s+me|show|zeig|schreib|erstell|mach|prüf|analysier|plane|gestalte|schau)\b`, 'iu');
// Ambiguous leisure words only count without a work request around them.
const LEISURE = wb(String.raw`cook\w*|recipe|rezept\w*|dinner|lunch|breakfast|abendessen|kochen|weekend|wochenende|vacation|urlaub|holiday|trip\s+to|road\s+trip|weather|wetter|restaurant|gift\s+ideas?|geschenk\w*|game\s+tonight`);
const NON_WORK = wb(alt([
  String.raw`jokes?|witz\w*|riddle`,
  String.raw`my\s+(?:new\s+)?(?:puppy|dog|cat|pet|kitten)|mein(?:em|en)?\s+(?:neuen\s+)?(?:hund|welpen?|kater)|meine[rnm]?\s+(?:neuen?\s+)?katze|puppy|welpe\w*`, String.raw`ausflugsziele?|ausflug`,
  String.raw`movies?|films?\s+to\s+watch|tv\s+shows?|netflix|series\s+to\s+watch|novel|sci-?fi\s+book|books?\s+(?:for|to\s+read)|songs?|playlist`,
  String.raw`birthday|geburtstag\w*|wedding|hochzeit|party|anniversary|date\s+night|valentine\w*`, String.raw`horoscope`,
  String.raw`workout|gym|stretch\w*|back\s+pain|rückenschmerz\w*|diet|abnehmen|sleep\s+better`,
  String.raw`my\s+(?:mom|mum|dad|sister|brother|wife|husband|girlfriend|boyfriend|kids?|son|daughter|grandma|grandpa)|meine[rnm]?\s+(?:mutter|mama|vater|papa|schwester|bruder|frau|freundin|kinder|oma|opa)|mein(?:em)?\s+(?:mann|freund|sohn|vater|bruder)`,
  String.raw`football|fußball|soccer|poem\s+for|gedicht\s+für|bedtime\s+story`,
]));

// ---------- feature families ------------------------------------------------
const INTENT_STRONG = [
  String.raw`threat[- ]?model\w*|storyboard\w*|mock\s*up|wirefram\w*|prototyp\w*|fine[- ]?tun\w*|train(?:ing)?\s+(?:a|an|the)\s+\w+|simulat\w*|forecast\w*|valu(?:e|ation)\s+(?:the|this|our)|size\s+the|dimensionier\w*`,
  String.raw`simulier\w*|profil(?:e|ing)\s+(?:the|our|my|this)|summari[sz]e\s+(?:the\s+)?(?:evidence|literature|research|findings|studies|trials)|zusammenfass\w*|reconcil\w*|triag\w*|harmoni[sz]\w*|calibrat\w*|attribut(?:e|ing)\s+\w+|benchmark\w*|redesign\w*|revamp\w*|overhaul\w*|rework\w*|redo|überarbeit\w*|entw[iu]rf\w*|entwerf\w*|gestalt\w*|konzipier\w*|ausleg\w*|berechn\w*|kalkulier\w*`,
  String.raw`plan(?:e|en)?\s+(?:a|an|the|our|my|einen?|eine|die|den|das|how|for|out)|plan\s+\w+|research\w*|investigat\w*|recherchier\w*|draft\w*|formulier\w*|design(?:e|en)?(?!\s+(?:doc\s+)?(?:system|tokens?)\b)`,
  String.raw`migrat\w*|(?:move|switch|port)\s+[^.]{1,40}?\s+from\s+[\w.-]+\s+to\s+\w+|port\s+(?:a|an|the|our|my|this)|umsteig\w*|umstell\w*|stell\w*\s+[^.]{1,40}\s+um|optimi[sz]\w*|optimier\w*|speed\s+(?:it\s+|this\s+|\w+\s+)?up|beschleunig\w*|harden\w*|lock\s+down|restructur\w*|refactor\w*|dedupe?\w*|deduplicat\w*|normali[sz]\w*|bereinig\w*|automat\w*`,
  String.raw`set\s+up|setup|einrichten|richte\s+\w+\s+ein|implement\w*|integrat\w*|integrier\w*|wire\s+up|hook\s+up|deploy\w*|configur\w*|konfigurier\w*|scrape\w*|extract\w*|parse(?=\s)|segment\w*|cluster\w*|estimat\w*|schätz\w*|fit\s+(?:a|an|the)\s+\w+|predict\w*|model\s+(?:the|our|how)|localis\w*|localiz\w*|lokalisier\w*`,
  String.raw`fill\s+(?:in|out)|ausfüll\w*|choose\s+(?:a|an|the|between)|pick\s+(?:a|an|the)\s+(?:statistical|method|approach|stack|architecture|estimator|model|analysis)|help\s+me\s+(?:pick|choose)\s+(?:a|an|the)\s+\w+|plot(?=\s)|chart\s+(?:the|our|my|monthly|weekly|daily)|visuali[sz]\w*|visualisier\w*`,
  String.raw`pen\s*test\w*|size\s+(?:a|an|the)|interpolat\w*|extrapolat\w*|format\s+\S+\s+(?:per|according\s+to|following|to\s+match|nach)|categori[sz]\w*|kategorisier\w*|classify|klassifizier\w*|reorgani[sz]\w*|complete\s+the\s+(?:task|assignment)|follow\s+the\s+instructions\s+in|compute|calculate|geocode\w*|transcrib\w*|subtitl\w*|burn\s+(?:them\s+|it\s+)?in|color[- ]grade|colour[- ]grade|ocr|map\s+(?:the|our|out|them)|figure\s+out|dig\s+(?:into|through)|poke\s+at|look\s+into|sanity[- ]check|proofread\w*|lektorier\w*|stress[- ]test`,
];
const INTENT_MID = [
  String.raw`write|rewrite|schreib\w*|build|baue?n?|create|erstell\w*|make\s+(?:a|an|me|us|the|our|my|some|\d)|mach\w*\s+(?:mir|uns|eine?n?|aus|ein\s+paar)|produce|generate|generier\w*|prepare|vorbereit\w*|put\s+(?:it\s+|this\s+|them\s+)?together|whip\s+up|come\s+up\s+with|develop\w*|entwickl\w*`,
  String.raw`turn\s+\S+(?:\s+\S+){0,6}\s+into|convert\w*\s+\S+(?:\s+\S+){0,6}\s+(?:to|into|in)\b|konvertier\w*|umwandel\w*|wandle|merge\s+\S+(?:\s+\S+){0,6}\s+into|polish\w*|improve\w*|verbesser\w*|upgrade\w*|aktualisier\w*|clean\s+up|cut\s+(?:the|this|my|it|down)|edit\s+(?:my|our|the|this|a)|schneid\w*`,
  String.raw`add\s+(?:[\w.-]+\s+){0,5}(?:policies|policy|auth\w*|login|sso|oauth|tests?|support|integration|webhooks?|billing|payments?|charges|checkout|subscriptions?|i18n|analytics|tracking|caching|rate\s+limit\w*|search|sheet|dashboard|chart|migration|endpoint|api|validation|encryption|monitoring|alerts?|logging|subtitles|captions|tracing|observability|metrics|instrumentation|telemetry|sso|2fa|mfa|i18n|localization|seo|schema\s+markup|structured\s+data|consent|cookie\s+consent)\b|fix\s+(?:them|it)\s+and|make\s+it\s+(?:tight|tighter|shorter|punchy|punchier|better|pop|clearer|crisp|crisper|professional|convincing)|(?:want|wants|needs)\s+(?:a|an)\s+\w+|cite\s+\w+`,
  String.raw`(?:^|\b(?:i|we)\s+)need\b|map\s+(?:them|it|these|those|\w+)\s+(?:to|onto)|make\s+\S+(?:\s+\S+){0,3}\s+look|master\s+(?:these|the|my|our)|route\s+(?:our|the|my|these)|propagat\w*|umsetzen|setz\w*\s+[^.]{1,30}\s+um|festleg\w*|definier\w*|aufsetz\w*|ausarbeit\w*|erarbeit\w*|zusammenstell\w*|ausrechn\w*|look\s+for|tidy\s+up|spruce\s+up|punch\s+up|tighten\s+up|help\s+me|hilf\s+mir|need\s+(?:a|an|some|to)|i\s+need|we\s+need|ich\s+brauche|wir\s+brauchen|brauche\s+(?:ein|eine)|give\s+me\s+(?:a|an|\d+|some|options)|tell\s+me\s+(?:which|why|what|whether|if|how)|look\s+at|go\s+(?:over|through)|sort\s+\S+(?:\s+\S+){0,4}\s+into|run\s+(?:a|an)\s+\w+|do\s+(?:a|an)\s+\w+|kannst\s+du|könntest\s+du`,
  String.raw`animat\w*|render\w*|record\w*|dub\w*|compose|layout|lay\s+out|illustrat\w*|outline|summari[sz]e\s+(?:the|this|these)\s+\w*\s*(?:papers?|reports?|pdfs?|documents?|studies|filings?|contracts?|interviews?)|announc\w*|launch\w*|propose|suggest\s+(?:a|an|some|\d)|recommend\s+(?:a|an)\s+(?:architecture|stack|approach|strategy)`,
];
const VERB_ANY = String.raw`^(?:(?:please|pls|bitte|now|just|also)\s+)?(?:add|update|change|fix|make|move|check|find|get|send|use|show|list|run|test|debug|handle|support|enable|allow|protect|secure|refactor|clean|split|combine|merge|map|match|track|log|store|save|load|fetch|sync|import|export|upload|download|publish|translate|review|scan|search|organi[sz]e|structure|prepare|finish|complete|mach|füg|änder|prüf|such|bau|schreib|erstell|zeig|teste?)\b`;

const DELIVERABLE_STRONG = alt([
  String.raw`(?:pitch\s+|slide\s+|investor\s+|board\s+|sales\s+)?decks?|slides?|slideshow|präsentation\w*|presentation|keynote|folien|powerpoint|pptx|docx|xlsx|word[- ]dokument\w*|word\s+document|excel(?:-\w+)?|spreadsheet|google\s+sheets?|tabellenkalkulation`,
  String.raw`financial\s+model|\w*-?modell|excel\s+model|cap\s+table|dashboard|report|bericht|whitepaper|white\s+paper|memo|brief|one[- ]pager|prd|spec(?:ification)?|proposal|antrag|angebot|tender|rfp|contract|vertrag\w*|nda|dpa|agreement|addendum|privacy\s+policy|datenschutzerklärung|terms\s+of\s+(?:service|use)|agb|impressum|policy|richtlinie|playbook|runbook|sop|postmortem|post-mortem|handbook|handbuch|manual|user\s+guide|guide|documentation|dokumentation|release\s+notes|changelog\s+for\s+customers|press\s+release|pressemitteilung|job\s+(?:ad|post\w*|description)|stellenanzeige`,
  String.raw`landing\s+page|homepage|website|webseite|pricing\s+page|signup\s+form|onboarding(?:\s+(?:flow|screens?|emails?))?|user\s+journey|screens?|ui\s+kit|design\s+system|style\s+guide|visual\s+identity|brand(?:ing)?|logo(?:\s+reveal)?|icons?|thumbnail|banner|carousel|infographic|poster|flyer|mockups?`,
  String.raw`video|videos|clips?|reel|explainer|trailer|teaser|animation|podcast|voice-?over|captions?|subtitles?|untertitel|storyboard|diagramm\w*|charts?|graphs?|plots?|diagram|heatmap|visuali[sz]ation|map\s+of`,
  String.raw`email\s+sequence|cold\s+emails?|newsletter|ad\s+copy|werbetext\w*|copy|headlines?|taglines?|positioning|messaging|blog\s+post|linkedin\s+posts?|posts?\s+for|article|artikel|case\s+study|app\s+store\s+description|description|survey|questionnaire|fragebogen|interview\s+script|diary\s+study|study|studie|lesson\s+plan|curriculum|course|grant|konzept|vorlage|template|invoice\s+template`,
  String.raw`notebook|pipeline|workflows?|harness|eval\w*\s+suite|rubric|alert\s+rules|terraform\s+module|helm\s+chart|ci\s+pipeline|api\s+(?:docs|reference)|openapi\s+spec|sdk|cli\s+tool|chatbot|agent|scheduler|configurator|thesis|paper|literature\s+review|evidence\s+table|cover\s+letter|resume|cv|lebenslauf|bewerbung|requirements\s+doc\w*|design\s+doc\w*|technical\s+doc\w*|forms?|formular\w*|pitch|loan\s+application|business\s+plan|letter|brief|anschreiben|exposé|expose|listing|bullet\s+points|product\s+descriptions?|headline|about\s+section|(?:methods|results|discussion|introduction|abstract)\s+section|abstract|budget|launch\s?plan|roadmap|strategy|strategie|backups?|prediction\s+model|model`,
  // German compounds: Liquiditätsplanung, Marketingkonzept, Wettbewerbsanalyse ...
  String.raw`\p{L}{3,}(?:planung|plan|konzept|analyse|bericht|vorlage|strategie|präsentation|richtlinie|vertrag|erklärung|anzeige|modell|kalkulation|übersicht|dokumentation|handbuch|beurteilung|bewertung|gutachten|aufstellung|abrechnung|nachweis|bescheinigung|anleitung|leitfaden|protokoll|design|text|texte|zeilen|aufruf|mailing|beitrag|beiträge|arbeit)`,
  String.raw`favicons?|og\s+images?|(?:image|icon|asset)\s+set|handout|journal\s+club|cheat\s*sheet|one\s+pager|subject\s+lines|email\s+copy|mail\s+text|checklist|readiness\s+(?:checklist|assessment|review)`,
]);
const DELIVERABLE_MID = alt([String.raw`server|mcp\s+server|integration|plugin|extension|generator|converter|parser|exporter|importer|validator|calculator|tracker|scraper|checklist|pdf|documents|dokumente|records|receipts|belege|table|tabelle|components?|komponente\w*|page|seite|app|widget|tool|script|bot|api|endpoint|service|database|schema|csvs?`]);
const FILE_EXT = /\.(?:pptx?|key|docx?|xlsx?|csv|tsv|parquet|ipynb|pdf|mp4|mov|wav|mp3|m4a|webm|fig|sketch|psd|ai|tex|bib|sav|dta|jsonl|sql|pdb|xml)\b/i;

const DOMAIN = alt([
  // security
  String.raw`exploit\w*|cves?|dependenc\w*|abhängigkeit\w*|misconfig\w*|public\s+buckets?|wildcard\s+polic\w*|security|secur(?:e|ing)|sicherheit\w*|vulnerab\w*|sicherheitslücke\w*|pentest\w*|penetration|owasp|cve|xss|csrf|sqli|injection|secrets?|credentials?|api\s+keys?|iam|rbac|privilege\w*|permissive|least\s+privilege|auth\s+flow|authenticat\w*|authori[sz]ation|auth|session\s+(?:handling|fixation)|account\s+takeover|threat|encryption|encrypted|bypass|rate\s+limit\w*|waf|firewall|malware|phishing|sast|dast|dependabot|codeql`,
  // legal and compliance
  String.raw`gdpr|dsgvo|ccpa|hipaa|soc\s*2|iso\s*27001|pci|eprivacy|ai\s+act|cookie\s+banner|consent|einwilligung|compliance|compliant|konform\w*|legal|rechtlich\w*|wirksam\w*|klausel\w*|clause|governing\s+law|liability|haftung|indemnif\w*|wettbewerbsklausel|arbeitsvertrag|ip\s+assignment|trademark|marke\w*|licen[cs]\w*|lizenz\w*|terms|datenschutz\w*|privacy|imprint|law|laws|gesetz\w*|recht|tenancy|landlord|lease|mietvertrag|vermieter\w*|mieter\w*|kaution|deposit|lawsuit|klage|court|gericht\w*|safety|hazard\w*|risk|risiko\w*|gefährdung\w*|arbeitsschutz|osha|schweiß\w*`,
  // finance, tax, accounting
  String.raw`tax|taxes|steuer\w*|umsatzsteuer\w*|vat|mwst|deduct\w*|absetz\w*|accounting|buchhaltung|bookkeeping|payroll|lohn\w*|invoices?|rechnung\w*|xrechnung|zugferd|reisekosten\w*|kilometerpauschale|kontoauszüge?|bank\s+statements?|liquidität\w*|cash\s*flow|budget\w*|expenses?|ausgaben|dcf|wacc|valuation|bewertung|ebitda|margin\w*|marge|revenue|umsatz|profit\w*|runway|burn|unit\s+economics|cac|ltv|payback|arpu|mrr|arr|cap\s+table|safe|dilution|term\s+sheet|freelancer|selbstständig\w*|financial|finanz\w*|loan|kredit\w*|repayment`,
  // growth, marketing, sales, product
  String.raw`churn|retention|cohorts?|funnel|conversion\w*|converts?|signups?|activation|engagement|pricing|tiers?|go[- ]to[- ]market|gtm|positioning|seo|sem|google\s+ads|ad\s+campaign|kampagne\w*|zielgruppe|target\s+audience|outbound|cold\s+outreach|leads?|crm|lifecycle|campaigns?|segments?|personas?|recruiters?|hiring|etsy|amazon|listing|launch\w*|market\s+sizing|tam|competitor\w*|competitive|wettbewerb\w*|customers?|kunden\w*|users?|investors?|investoren|seed\s+round|series\s+[abc]|fundrais\w*|pitch|story|narrative|kpis?|okrs?|qbr|roadmap|strategy|strategie|product\s+lines?|app\s+store|hooks|brand|tone\s+of\s+voice|copywriting|press`,
  // design and UX
  String.raw`accessib\w*|barrierefrei\w*|a11y|wcag|contrast|kontrast|voiceover|screen[- ]reader|dynamic\s+type|ux|ui|usability|user\s+journey|typography|typografie|hierarchy|hierarchie|colou?r\s+palette|visual\s+(?:identity|system|direction)|directions|look\s+and\s+feel|mobile\s+hierarchy|responsive|onboarding|aesthetic|earthy|modern|cluttered|tacky|stands\s+out`,
  // data, statistics, research
  String.raw`statistic\w*|statisti\w*|significan\w*|signifikan\w*|p-?values?|confidence\s+intervals?|sample\s+size|power|regression|a/b|ab\s+test|experiment\w*|hypothes\w*|anomal\w*|outliers?|time\s+series|seasonal\w*|bayes\w*|causal|effect\s+sizes?|within-subjects|between-subjects|conditions|n\s*=\s*\d+|rfm|umfrage\w*|survey\w*|likert|leading\s+questions|literature|peer[- ]reviewed|citations?|zitat\w*|methodolog\w*|meta-analysis|systematic\s+review|qualitative|quantitative|interviews?|nurses|participants|data\s+quality|dedupe|etl|events?\s+table|usage\s+logs?|telemetry|metrics|trends?`,
  // engineering and science
  String.raw`deflection|durchbiegung|beam|träger|span|cantilever|natural\s+frequenc\w*|load\s+case|kn/m|kw|heizlast|wärmepumpe|pufferspeicher|stress|strain|fea|fe\s+result|finite\s+element|pid|übertragungsfunktion|transfer\s+function|control\s+loop|regler\w*|filter|butterworth|frequency\s+response|dsp|signal\s+processing|fft|docking|ligands?|proteins?|molecul\w*|genom\w*|sequencing|rna|dna|assay|enzyme|kinetics|clinical|randomi[sz]ed|trials?|mortality|actuarial|life\s*tables?|epidemiolog\w*|r0|sir\s+model|diffusion|heat\s+transfer|thermodynamic\w*|cfd|simulation|monte\s+carlo|scheduling|battery|degradation|capacity|cycles|geocod\w*|addresses|coordinates|geodesic|gis`,
  // ML and AI
  String.raw`llms?|prompts?|evals?|evaluation|llm\s+judge|rag|retrieval|rerank\w*|embeddings?|hybrid\s+search|vector\s+search|fine-?tuning|lora|shap|classifier|machine\s+learning|ml|neural|transformer|model\s+training|features|ai\s+chatbot|chatbot|agents?`,
  // media
  String.raw`captions?|voiceover|loudness|lufs|color\s+grading|colou?r\s+grade|b-roll|vertical|9:16|16:9|motion\s+graphics|footage|recording|aufnahme|cameras?|cuts?|intro|outro|youtube|tiktok|reels?|thumbnail|keynote\s+recording|interview`,
  // logistics, healthcare, space, music, agriculture, real estate, education, HR, nonprofit, hospitality, games, construction, web3
  String.raw`delivery|deliveries|depots?|fleet|vans?|trucks?|routing|time\s+windows|warehouses?|pallets?|shipments?|inventory|logistics|supply\s+chain|edi|wms|tms|3pl|freight|forklift\w*|telematics`,
  String.raw`patients?|nurses?|icu|census|clinic\w*|hospital\w*|ehr|emr|hl7|fhir|dicom|icd-?10|snomed|loinc|medical|medizin\w*|pflege\w*|wait\s+times|triage|evidence|inhibitors?|cardio\w*|oncolog\w*|diagnos\w*|dosing|pharma\w*`,
  String.raw`orbit\w*|satellit\w*|cubesat|tle|ground\s+stations?|telescope|astronom\w*|physics|quantum`,
  String.raw`mixing|mastering|tracks|stems|chords?|chord\s+progression|bridge|modulat\w*|tempo|bpm|melod\w*|songwriting|musik\w*|music\w*`,
  String.raw`cattle|livestock|crops?|yield|soil|irrigation|harvest|herbstlese|weingut|winery|vineyard|farm\w*|landwirt\w*|agri\w*|feed\s+cost`,
  String.raw`real\s+estate|property|properties|immobilie\w*|eigentumswohnung|mortgage|hypothek\w*|rent|miete|tenants?|occupancy|listing`,
  String.raw`students?|schüler\w*|lesson|syllabus|curriculum|grading|teachers?|lehrer\w*|unterricht\w*|masterarbeit|bachelorarbeit|dissertation|thesis|forschungs\w*|mixed\s+methods`,
  String.raw`ats|applicants?|bewerber\w*|candidates?|interview\w*|performance\s+reviews?|compensation|salary|gehalt\w*|employees?|mitarbeiter\w*|headcount|offboarding|löschfristen|retention\s+periods?`,
  String.raw`donat\w*|donors?|spenden\w*|nonprofit|non-profit|ngo|verein|tierheim|charity|volunteers?|ehrenamt\w*`,
  String.raw`menus?|speisekarte|bookings?|reservations?|guests?|hotel\w*|restaurant\s+(?:website|menu|marketing)|hospitality`,
  String.raw`game\s+design|level\s+design|gameplay|shaders?|godot|players?|matchmaking|balancing|leaderboards?`,
  String.raw`bim|ifc|revit|autocad|takeoff|bill\s+of\s+quantities|leistungsverzeichnis|statik|bauantrag|construction|baustelle\w*`,
  String.raw`solidity|smart\s+contracts?|reentrancy|access\s+control|erc-?\d+|blockchain|defi|wallets?`,
  String.raw`vibration|bearing|fault\s+frequenc\w*|motor|sensors?|plc|scada|conveyor|predictive\s+maintenance`,
  // infra, data and platform
  String.raw`slos?|sli|latency|uptime|observability|alerting|on-?call|incident|outage|disaster\s+recovery|zero[- ]downtime|replication|failover|rollback|restore|offsite|nightly|scalab\w*|performance|load|oom\w*|requests\s+and\s+limits|autoscal\w*|hpa|caching\s+rules|static\s+assets|cdn|ci|ci/?cd|containers?|infrastructure|infra|cloud|reverse\s+proxy|tls|ssl|certificates?|dns|subdomains?|load\s+balanc\w*|schema|migration|database|datenbank\w*|kundendatenbank|row\s+level\s+security|rls|webhooks?|subscriptions?|metered\s+billing|billing|payments?|cron\s+jobs?|workflows|queues?|rest\s+api|graphql|trpc|search\s+console`,
]);
const DOMAIN_RE = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${DOMAIN})(?![\\p{L}\\p{N}_])`, 'giu');
const TECH_TOKEN = /\b[A-Z]{2,6}s?\b(?<!\b(?:I|OK|US|EU|UK|DE|AT|PS|AM|PM|OR|AND|THE|LOL|BTW|ASAP|FYI|TODO)\b)|\b\d+(?:[.,]\d+)?\s*(?:%|kn|kw|kwh|mb|gb|ms|hz|khz|mhz|°c|eur|usd|€|\$|k|m)\b|[$€£]\s?\d/;

const NAMED = alt([
  String.raw`reveal\.js|marp|remotion|hyperframes|figma|sketch|canva|framer|webflow|d3(?:\.js)?|three\.js|chart\.js|plotly|matplotlib|seaborn|ggplot2?|tableau|power\s*bi|looker|metabase|grafana|prometheus|datadog|sentry|opentelemetry`,
  String.raw`terraform|pulumi|cloudformation|ansible|kubernetes|k8s|helm|docker(?:-compose|file)?|nginx|caddy|traefik|let'?s\s*encrypt|letsencrypt|github\s+actions|gitlab\s+ci|circleci|jenkins|argo\s*cd|cloud\s+run|lambda|ecs|eks|gke|aks|fly\.io|vercel|netlify|heroku|cloudflare|aws|gcp|azure|s3|aurora|rds|dynamodb|bigquery|snowflake|redshift|databricks|spark|kafka|airflow|dbt|temporal|node-cron|dependabot|codeql|eslint`,
  String.raw`postgres(?:ql)?|mysql|mariadb|mongodb|redis|elasticsearch|opensearch|supabase|firebase|prisma|drizzle|sequelize|typeorm|django|flask|fastapi|rails|laravel|spring(?:\s+boot)?|express|nestjs|next(?:\.?js)?(?=\s+(?:app|backend|frontend|project|marketplace|site))|next\.js|nextjs|nuxt|sveltekit|svelte|react(?:\s+native)?|vue|angular|flutter|swiftui|jetpack\s+compose|kotlin|electron|tauri|vite|webpack|rollup|esbuild|tailwind|storybook|playwright|cypress|selenium|jest|vitest|pytest|graphql|grpc|trpc|openapi|swagger|json\s+schema`,
  String.raw`oauth\s*2?|oidc|saml|jwt|jwks|okta|auth0|clerk|keycloak|stripe(?:\s+connect)?|paypal|adyen|plaid|twilio|sinch|sendgrid|resend|mailchimp|hubspot|salesforce|zapier|n8n|notion\s+api|slack\s+api|shopify|woocommerce|wordpress|contentful|sanity|strapi`,
  String.raw`openai|anthropic|gpt-?\d*|gemini|llama|hugging\s*face|langchain|llamaindex|pytorch|tensorflow|keras|jax|scikit-learn|sklearn|xgboost|lightgbm|pandas|polars|numpy|scipy|statsmodels|pymc|stan|r\s+markdown|jupyter|latex|biblatex|bibtex|overleaf|pandoc|ocr|tesseract`,
  String.raw`xrechnung|zugferd|peppol|datev|elster|xbrl|ifrs|gaap|hgb|gdpr|dsgvo|soc\s*2|iso\s*\d{4,5}|pci[- ]dss|hipaa|wcag(?:\s*2\.\d)?|aria|voiceover|talkback|owasp|cis\s+benchmark|nist|mitre|stride|sbom|cyclonedx|spdx|s355|eurocode|din\s*\d+|ieee\s*\d+|pdf/?a|pdf/ua|tagged\s+pdf|epub|webgl|wasm|unity|unreal|blender|after\s+effects|premiere|davinci|final\s+cut|ffmpeg|obs|audacity|eu\s+ai\s+act|eprivacy|ccpa|delaware\s+law|michaelis-menten|rfm|safe|hl7|fhir|dicom|edi\s*\d{3}|geojson|mcp|pim|tle|solidity|vue|godot|revit|ifc|pci\s+dss|consort|prisma|strobe|apa\s*7?|mla|chicago\s+style|ipe\s*\d+|eurocode\s*\d*|eür|elster|etsy|amazon\s+seller`,
  String.raw`google\s+ads|meta\s+ads|linkedin(?:\s+ads)?|google\s+analytics|ga4|mixpanel|amplitude|posthog|search\s+console|ahrefs|semrush|excel|google\s+sheets?|word|powerpoint|keynote|sap|nsf|sbir|horizon\s+europe|ios|android|app\s+store|play\s+store|vba|power\s+query|pivot\s*tables?|vlookup|xlookup|youtube|tiktok|instagram|product\s+hunt|point\s+nine`,
]);
const NAMED_RE = wb(NAMED);
const ANALYSIS = alt([
  String.raw`audit\w*|analy[sz]\w*|analysier\w*|auswert\w*|evaluat\w*|assess\w*|review\w*|überprüf\w*|prüf\w*|begutacht\w*|threat[- ]?model\w*|compare|comparing|comparison|vergleich\w*|benchmark\w*|diagnos\w*|root\s+cause|triag\w*`,
  String.raw`flag\s+(?:anything|any|all|mismatches|risks|issues|the)|find\s+(?:the\s+|out\s+)?(?:anomal\w*|trends?|bottlenecks?|gaps|risks?|issues|vulnerab\w*|drivers?|outliers|patterns|what|why|which)|list\s+(?:the\s+)?(?:gaps|risks|findings|issues)|gaps?\s+analysis|risk\w*\s+assessment|due\s+diligence|validat\w*|verify|verifizier\w*|check\s+(?:whether|if|for|against|that|our|my|the\s+\w+\s+(?:for|against))|schau\w*\s+(?:ob|mal\s+ob|nach|dir)`,
  String.raw`is\s+(?:our|my|this|the)\s+[\w\s-]{1,40}(?:leaking|secure|compliant|correct|ready|safe|valid|enough|right)|are\s+(?:we|our|all\s+(?:my|our))\s+[\w\s-]{1,30}(?:ready|compliant|secure|safe|up|down|online|working|live)|is\s+n\s*=\s*\d+|ist\s+(?:die|der|das|unser\w*)\s+[\w\s-]{1,40}(?:wirksam|zulässig|rechtens|sicher|korrekt|konform)|brauchen\s+wir|do\s+we\s+need|what\s+do\s+(?:we|i)\s+need\s+to\s+do|which\s+of\s+(?:my|our|the)|can\s+(?:someone|anyone|an\s+attacker)`,
  String.raw`significant|signifikan\w*|explain\s+the\s+top\s+features|which\s+features\s+matter|what\s+drives|which\s+segments|unit\s+economics|what\s+sample\s+size|sample\s+size\s+(?:do|would)|how\s+(?:much|many|big|large)\s+[\w\s]{0,20}(?:do|would|should|must)\s+(?:i|we)\s+need|wie\s+groß\s+muss|what(?:'s|\s+is)\s+(?:our|my)\s+[\w\s-]{1,30}(?:scope|exposure|risk|liability|obligations?|posture|runway|burn(?:\s+multiple)?|margin|multiple|break-?even)|is\s+(?:that|this|it)\s+(?:bad|good|ok|okay|normal|healthy|enough|reasonable|too\s+\w+)|(?:bin|sind)\s+(?:ich|wir)\s+(?:noch\s+)?(?:ein\s+)?\p{L}*(?:unternehmer|pflichtig|befreit)|am\s+i\s+(?:still\s+)?(?:eligible|liable|exempt|required)|look\s+for\s+\w+|(?:take\s+a\s+)?look\s+(?:at|into)\s+why|why\s+(?:my|our|the)\s+[\w\s]{1,40}?(?:dips?|drops?|declin\w*|spikes?|falls?|rises?|increas\w*|decreas\w*|went\s+(?:up|down))|find\s+(?:the\s+)?(?:root\s+)?cause|how\s+(?:much|long)\s+(?:runway|cash|budget|capacity|time\s+until)|check\s+(?:this|these|the|our|my)\s+(?:[\w.-]+\s+){0,3}?(?:for|against)|check\s+(?:\S+\s+){0,4}?(?:for|against)\s+(?:anything|any|all|issues|problems|risks|vulnerab\w*|security|compliance|misconfig\w*|exploit\w*|leaks?|secrets?)|how\s+(?:do|should|can|would)\s+(?:i|we)\s+(?:handle|treat|account\s+for|book|structure|price|file|report|declare|depreciate|classify|deduct)|wie\s+(?:setze|buche|berechne|behandle|versteuere|melde|schreibe)\s+ich|estimate\s+\w+|investigat\w*|stress[- ]test\w*|sensitivity\s+analysis|interpret\w*|why\s+did\s+\w+|what(?:'s|\s+is)\s+(?:dragging|causing|driving|wrong\s+with\s+(?:our|my|the))|dragging|figure\s+(?:it\s+)?out|dig\s+(?:into|through)|overly\s+permissive|what'?s\s+risky`,
]);
const ANALYSIS_RE = wb(ANALYSIS);
const MATERIAL = /\bhttps?:\/\/\S+|\blocalhost:\d+|(?:^|[\s(`'"])(?:~|\.{1,2})?\/?[\w.-]+\/[\w./*-]*|\b[\w*-]+\.(?:txt|json|jsonl|csv|tsv|md|pdf|mbox|eml|log|html?|xml|ya?ml|sql|png|jpe?g|svg|zip|pptx?|docx?|xlsx?|parquet|ipynb|mov|mp4|wav|mp3|tf|py|ts|tsx|js|go|rs|pdb|tex)\b|\b(?:the|this|my|our|these|den|die|das|unser\w*|mein\w*)\s+[\w-]+\s+(?:folder|directory|repo|repository|ordner|verzeichnis)\b/i;

const INTENT_STRONG_RE = wb(alt(INTENT_STRONG));
const INTENT_MID_RE = wb(alt(INTENT_MID));
const VERB_ANY_RE = new RegExp(VERB_ANY, 'iu');
const DELIVERABLE_STRONG_RE = wb(DELIVERABLE_STRONG);
const DELIVERABLE_MID_RE = wb(DELIVERABLE_MID);

// A request phrased as a noun phrase: "DCF for a freight broker, ...",
// "landing page for a grooming van", "Newsletter-Text für unser Weingut".
const REQUEST_NOUN = alt([DELIVERABLE_STRONG, String.raw`check|gap\s+check|audit|review|analysis|analyse|regression|checklist|forecast|copy|text|\p{L}*text|breakdown|comparison|estimate|valuation|dcf|waterfall|teardown|critique|feedback|summary|outline|draft|rewrite|translation|übersetzung|calculation|berechnung|fft|anova|simulation|segmentation|clustering|checklist|readiness\s+\w+|generator|converter|parser|exporter|importer|validator|calculator|tracker|scraper|server|integration|plugin|extension|app|tool|bot|script|service|api|cli|website|site`]);
const HEADLESS = new RegExp(String.raw`^(?:(?:quick\s+one|quick\s+q|pls|please|bitte|need|i\s+need|we\s+need|brauche)[,\s:]+)?(?:\S+\s+){0,6}?(?:${REQUEST_NOUN})(?:-\p{L}+)?(?:(?:\s+\p{L}+ed)?\s+(?:for|on|of|from|across|to|that|which|with|für|fürs|zu|zur|zum|über|mit|von|die|der|das)(?![\p{L}])|\s*[,:])`, 'iu');
const POLITE_END = /(?:bitte|please|pls|plz|thx|thanks|danke)\s*[.!]?$/iu;
const DEBUG = wb(String.raw`error|errors|exception|warning|warnings|stack\s*trace|traceback|crash\w*|crashloop\w*|stuck|hangs?|hanging|fails?|failed|failing|broken|bug|throws?|undefined|segfault|permission\s+denied|not\s+working|doesn'?t\s+work|kaputt|fehler\w*|geht\s+nicht|funktioniert\s+nicht|rebas\w*|merge\s+conflicts?|is\s+missing|are\s+missing|fehlt|died|restart\s+it|rerun`);

function complexity(text, words) {
  let c = 0;
  if (words >= 9) c += 1;
  if (words >= 20) c += 1;
  if ((text.match(/,/g) || []).length >= 2 || /:\s*\S+.*,/.test(text)) c += 1;
  if (MATERIAL.test(text)) c += 1;
  return Math.min(c, 3);
}

const PATHS = /(?:[\w.~-]{2,}\/)+[\w.*-]*|\b[\w-]+\.(?:md|txt|csv|tsv|json|jsonl|ipynb|py|ts|tsx|yaml|yml|toml|sql|log|html|css|pdf|docx?|xlsx?|pptx?|tf|sol|go|rs|rb|java|kt|swift|png|jpe?g|svg|mp4|mov|wav|mp3|parquet|xml|env|config)\b/giu;

function families(raw) {
  const text = raw.replace(PATHS, ' FILE ');
  const domainHits = new Set([...text.matchAll(DOMAIN_RE)].map(m => m[0].toLowerCase()));
  return {
    intent: INTENT_STRONG_RE.test(text) ? 3 : INTENT_MID_RE.test(text) ? 2 : VERB_ANY_RE.test(text) ? 1 : 0,
    deliverable: DELIVERABLE_STRONG_RE.test(text) ? 3 : DELIVERABLE_MID_RE.test(text) ? 2 : FILE_EXT.test(raw) ? 1 : 0,
    domain: domainHits.size >= 2 ? 3 : domainHits.size === 1 ? 2 : TECH_TOKEN.test(text) ? 1 : 0,
    named: NAMED_RE.test(raw) ? 3 : 0,
    analysis: ANALYSIS_RE.test(text) ? 3 : 0,
  };
}

/** Classifies one prompt. Never throws; never retains or emits the prompt.
 *  The thresholds are overridable only for the dev threshold sweep. */
export function classify(prompt, { tNudge = T_NUDGE, tGate = T_GATE } = {}) {
  const out = { optOut: false, optIn: false, trivial: false, chat: false, score: 0, families: [], nudge: false, gate: false };
  try {
    if (typeof prompt !== 'string') return out;
    const text = bound(prompt).trim();
    if (!text) return out;
    out.optOut = optOut(text);
    if (out.optOut) return out;
    if (OPT_IN.test(text)) { out.optIn = true; out.nudge = true; out.gate = true; return out; }
    const words = text.split(/\s+/).length;
    out.trivial = trivial(text);

    const fam = families(text);
    // Request form without a verb counts as intent ("nouns alone" still need a second family).
    if (fam.intent < 2 && (HEADLESS.test(text) || (fam.deliverable + fam.analysis > 0 && POLITE_END.test(text)))) fam.intent = 2;
    const cx = complexity(text, words);
    out.families = Object.keys(fam).filter(k => fam[k] >= 2);
    if (cx >= 2) out.families.push('complexity');
    let score = Object.values(fam).reduce((a, b) => a + b, 0) + cx;
    // Routine debugging (an error, a stuck command) without a deliverable or an analysis.
    const debug = DEBUG.test(text) && fam.intent < 3 && fam.deliverable < 3 && fam.analysis === 0;
    if (debug) score -= 3;

    // Negative evidence. A question followed by a work request is a work request.
    const workClause = WORK_CLAUSE.test(text.replace(/^[^?]*\?\s*/, '. '));
    const chat = CHAT.test(text) && words <= 8;
    const follow = FOLLOW.test(text) && words <= 12;
    const explain = EXPLAIN.test(text) && !workClause;
    const arith = ARITH.test(text) && !workClause && words <= 25;
    const question = QUESTION_START.test(text) && (/\?\s*$/.test(text) || (words <= 10 && !/[.!;:]\s+\S/.test(text))) && !workClause;
    const nonWork = (NON_WORK.test(text) && ((fam.named === 0 && fam.domain < 2) || fam.intent < 2))
      || (LEISURE.test(text) && fam.named === 0 && fam.domain < 2 && fam.intent < 2 && fam.deliverable < 3);
    out.chat = chat || follow;
    if (out.trivial) score -= 12;
    if (chat || follow) score -= 8;
    if (explain) score -= 6;
    if (arith) score -= 8;
    if (nonWork) score -= 6;
    if (question) score -= MATERIAL.test(text) ? 1 : 3;
    if (words <= 3) score -= 3;
    out.score = Math.round(score * 10) / 10;

    out.nudge = score >= tNudge;
    const action = fam.intent >= 2 || fam.analysis > 0;
    out.gate = out.nudge && score >= tGate && action && out.families.length >= 2 && !debug
      && !out.trivial && !out.chat && !explain && !arith && !nonWork && !(question && !MATERIAL.test(text));
  } catch {
    out.nudge = false; out.gate = false; // fail open: never hold Claude on a classifier error
  }
  return out;
}
