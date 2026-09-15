"""Notes-based fatality classification.

ACLED exports a single `fatalities` total per incident.  The supporting notes
usually describe how those deaths were split between civilians, the country's
security forces and non-state combatants (e.g. "the troops killed 9 militants
and lost 3 of their own").  This module parses the notes text deterministically
to derive that split, then falls back to event-level defaults when the notes do
not describe a breakdown.

The logic is intentionally transparent so it can be documented in plain
language in the data dictionary:

1. Any number tied to a security-force term (soldiers, troops, police
   officers, security operatives/personnel, members of the Civilian Joint
   Task Force / JTF, NSCDC) counts as security-force deaths.
2. Any number tied to a combatant term (militants, bandits, terrorists,
   insurgents, fighters, gunmen, cultists, members of a communal militia /
   armed group) counts as combatant deaths.
3. Any number tied to a civilian term (civilians, villagers/residents)
   counts as civilian deaths.
4. Where the notes give a partial split, the unaccounted remainder of the
   source `fatalities` total is added to:
     - civilians, when the incident was coded as civilian targeting or is a
       protest/riot/violence-against-civilians; otherwise
     - combatants.
5. When the notes give no usable split, the full total is assigned to the
   default category using the same rule as (4).
6. If the parsed counts ever exceed the source total they are scaled down so
   the three categories always sum exactly to the source `fatalities` value.
"""

import re

SECURITY_TERMS = [
    r"soldiers?", r"troops?", r"police\s+officers?", r"policemen?",
    r"security\s+(?:operatives?|personnel|forces?|agents?|men\b)",
    r"members?\s+of\s+(?:the\s+)?(?:civilian\s+)?(?:joint\s+)?(?:task\s+force|jtf|cjtf)",
    r"nscdc",
]
COMBATANT_TERMS = [
    r"militants?", r"bandits?", r"terrorists?", r"insurgents?", r"fighters?",
    r"gunmen?", r"cultists?", r"rioters?",
    r"members?\s+of\s+(?:the\s+)?(?:armed\s+)?(?:group|gang)s?",
    r"members?\s+of\s+(?:\w+\s+)?(?:communal\s+)?militia",
    r"militia\s+members?",
]
CIVILIAN_TERMS = [
    r"civilians?", r"villagers?", r"townspeople?", r"commuters?",
    r"school\s+children?", r"pupils?", r"students?",
]

_killed_verb = r"(?:killed|shot\s+dead|gunned\s+down|martyred?|fell\s+in\s+combat|died|deaths?|fatalities?|casualties?)"
_poss = r"(?:[\'\-]|\s)?"


def _build_patterns(term):
    return [
        # "killed 9 militants", "killed 1 member of the group"
        re.compile(r"(?:killed|shot\s+dead|gunned\s+down)\s+(?:at\s+least\s+)?(?:an\s+)?(\d+)\s+" + term + r"\b", re.I),
        # "9 militants were killed", "3 members of the CJTF were killed"
        re.compile(r"(\d+)\s+" + term + r"\b(?:\s*\([^)]{0,30}\))?" + _poss + r"(?:\s+(?:were|was|have\s+been))?\s*" + _killed_verb, re.I),
        # "9 militants' fatalities", "2 soldiers were killed"
        re.compile(r"(\d+)\s+" + term + r"[\' ]+" + _killed_verb, re.I),
        # "fatalities ... are 3 (government forces)", "unspecified coded as 3"
        re.compile(term + r"\b[^.]{0,80}?" + _killed_verb + r"[^.]{0,40}?coded\s+as\s+(?:about\s+)?(\d+)", re.I),
        # "X soldiers/killed ... N" contexts, e.g. "lost 3 soldiers"
        re.compile(r"(?:lost|suffered|sustained)\s+(\d+)\s+" + term + r"\b", re.I),
    ]


SECURITY_PATTERNS = [p for t in SECURITY_TERMS for p in _build_patterns(t)]
# "1 Nigerian soldier/killed", "killed 2 Nigerian soldiers", "2 soldiers of the Nigerian Army"
SECURITY_PATTERNS += [
    re.compile(r"(?:killed|shot\s+dead|gunned\s+down)\s+(?:at\s+least\s+)?(\d+)\s+(?:nigerian\s+)?(?:soldiers?|troops?|police\s+officers?|security\s+(?:operatives?|personnel)|servicemen?)", re.I),
    re.compile(r"(\d+)\s+(?:nigerian\s+)?soldiers?\s+(?:of\s+the\s+nigerian\s+army|claimed\s+(?:to\s+have\s+)?been\s+(?:shot|killed))", re.I),
    re.compile(r"soldiers?\s+(?:were|was)\s+(?:killed|shot\s+dead|gunned\s+down)", re.I),
]
COMBATANT_PATTERNS = [p for t in COMBATANT_TERMS for p in _build_patterns(t)]
CIVILIAN_PATTERNS = [p for t in CIVILIAN_TERMS for p in _build_patterns(t)]

SECURITY_SPECIAL = [
    re.compile(r"(?:government|security)\s+forces?[\' ]+(?:fatalities?|casualties?|deaths?)[^.]{0,40}?coded\s+as\s+(\d+)", re.I),
    re.compile(r"(?:fatalities?|deaths?|casualties?)\s+(?:of|among)\s+(?:the\s+)?(?:government|security)\s+forces?[^.]{0,40}?coded\s+as\s+(\d+)", re.I),
]


def _capture_with_positions(text):
    out = []
    for pat in SECURITY_PATTERNS + SECURITY_SPECIAL:
        for m in pat.finditer(text):
            try:
                out.append((m.start(), "security", int(m.group(1))))
            except (ValueError, TypeError, IndexError):
                continue
    for pat in COMBATANT_PATTERNS:
        for m in pat.finditer(text):
            try:
                out.append((m.start(), "combatants", int(m.group(1))))
            except (ValueError, TypeError, IndexError):
                continue
    for pat in CIVILIAN_PATTERNS:
        for m in pat.finditer(text):
            try:
                out.append((m.start(), "civilians", int(m.group(1))))
            except (ValueError, TypeError, IndexError):
                continue
    return _dedupe_adjacent(sorted(out, key=lambda x: (x[0], x[1])))


def _dedupe_adjacent(ordered):
    """Merge overlapping captures so one sentence isn't double-counted."""
    if not ordered:
        return []
    merged = []
    last_start = -100
    for start, cat, val in ordered:
        if start - last_start <= 8:
            continue
        merged.append((start, cat, val))
        last_start = start
    return merged


def split_fatalities(fatalities, event_type="", civilian_targeting=False,
                     notes=""):
    """Return (civilians, security_forces, combatants) summing to `fatalities`.

    All values are floats.  `fatalities` may be an int, float or numeric string.
    """
    try:
        total = float(fatalities)
    except (TypeError, ValueError):
        total = 0.0
    if total <= 0:
        return 0.0, 0.0, 0.0

    text = (notes or "").strip()

    caps = _capture_with_positions(text)
    counts = {"civilians": 0.0, "security": 0.0, "combatants": 0.0}
    for _, cat, val in caps:
        counts[cat] += float(val)

    parsed_total = sum(counts.values())

    civilian_default = (
        civilian_targeting
        or event_type in ("Violence against civilians", "Protests", "Riots")
    )

    if parsed_total <= 0:
        if civilian_default:
            return total, 0.0, 0.0
        return 0.0, 0.0, total

    if parsed_total > total:
        scale = total / parsed_total
        for k in counts:
            counts[k] = round(counts[k] * scale, 4)
        parsed_total = total

    remainder = total - parsed_total
    if remainder > 0:
        target = "civilians" if civilian_default else "combatants"
        counts[target] = round(counts[target] + remainder, 4)

    civ = round(counts["civilians"], 4)
    sec = round(counts["security"], 4)
    comb = round(counts["combatants"], 4)

    diff = round(total - (civ + sec + comb), 4)
    if diff != 0:
        comb = round(comb + diff, 4)

    return civ, sec, comb