import re
from config import NUMBER_MAP, KIDNAP_KEYWORDS, KIDNAP_KEYWORDS_NON_CIVILIAN, COMBATANT_TERMS, SECURITY_TERMS, CIVILIAN_TERMS


def _is_cattle_rustling(note_lower: str) -> bool:
    """Check if 'rustled' refers to livestock, not people."""
    return bool(re.search(r"rustled\s+\d+\s*(?:cows?|cattle|goats?|sheep|livestock|animals?)", note_lower))


def _is_protest_about_kidnap(note_lower: str) -> bool:
    """Check if the event is a protest/demo ABOUT a kidnapping, not a kidnap event itself."""
    return bool(re.search(
        r"(?:protest|demonstrat|rally|march)\s+.*\b(?:abduct|kidnap|abduction|kidnapping)",
        note_lower
    )) or bool(re.search(
        r"\b(?:abduct|kidnap|abduction|kidnapping)\s+.*\b(?:protest|demonstrat|rally|march)",
        note_lower
    ))


def _expand_word_numbers(text: str) -> str:
    """Replace word-based numbers (several, dozens, etc.) with digits for pattern matching."""
    result = text.lower()
    for word, num in sorted(NUMBER_MAP.items(), key=lambda x: -len(x[0])):
        result = re.sub(rf'\b{re.escape(word)}\b', str(num), result)
    return result


def extract_kidnappings(note: str, civilian_targeting: bool = True) -> tuple[bool, int]:
    if not note or not isinstance(note, str):
        return False, 0

    note_lower = note.lower()

    # Skip weapons/ammunition seizures (false positive for "seized")
    if re.search(r"seized\s+\d+\s*(?:live\s+)?(?:rounds?|ammunition|weapons?|guns?|rifles?|rockets?|grenades?|explosives?|bombs?)", note_lower):
        return False, 0

    # Skip cattle rustling (false positive for "rustled")
    if _is_cattle_rustling(note_lower):
        return False, 0

    # Always-skip patterns: court cases, historical references, former hostages
    hard_skip_patterns = [
        r"\b(?:court|trial|sentenced|convict|appeal|verdict)\b",
        r"\b(?:in ?the ?past|last\s+(?:month|year|week|decade)|historical|formerly)\b",
        r"\b(?:former|ex-)\s+(?:hostage|captive)\b",
    ]
    for pattern in hard_skip_patterns:
        if re.search(pattern, note_lower):
            return False, 0

    # For non-civilian-targeting events, use stricter keyword set
    if not civilian_targeting:
        keywords = KIDNAP_KEYWORDS_NON_CIVILIAN
        # Skip protests about kidnappings (not new kidnap events)
        if _is_protest_about_kidnap(note_lower):
            return False, 0
    else:
        keywords = KIDNAP_KEYWORDS

    has_kidnap = any(kw in note_lower for kw in keywords)
    if not has_kidnap:
        return False, 0

    if re.search(r"\b(?:military|troops|soldiers|police|security)\s+(?:rescue|rescued|freed|stormed|recovered?)\b", note_lower):
        if not re.search(r"\b(?:abducted|kidnapped|seized|whisked|captured)\s+\d+", note_lower):
            return False, 0

    note_clean = re.sub(r"\b(?:19|20)\d{2}\b", "", note_lower)
    note_clean = re.sub(
        r"\b(?:gunmen|attackers|bandits|insurgents|terrorists|militants)\s*(?:numbering|about|approximately|around|over|more than)\s*\w+",
        "", note_clean
    )
    note_clean = re.sub(
        r"\b(?:suspected)\s+(?:gunmen|bandits|terrorists|militants)\s*(?:numbering|about|approximately|around|over|more than)\s*\w+",
        "", note_clean
    )

    note_clean = _expand_word_numbers(note_clean)

    note_clean = re.sub(r",?\s*including\s+[^.]*?(?=\.|$)", "", note_clean)

    note_clean = re.sub(
        r"\b(?:killed|killing)\s+\d+(?:\s+(?:and|,))?",
        "killed", note_clean
    )
    note_clean = re.sub(
        r"\b(\d+)\s+(?:\w+\s+)?(?:person|people)\s+(?:was|were|have been|had been)\s+killed",
        "killed", note_clean
    )

    summary_patterns = [
        r"(\d+)\s+(?:persons?|people|individuals?|victims?)\s+(?:were|have been|had been)\s+(?:abducted|kidnapped)",
        r"(?:abducted|kidnapped)\s+(?:a\s+)?total\s+of\s+(\d+)\s+(?:persons?|people|individuals?|victims?)",
        r"total\s+of\s+(\d+)\s+(?:persons?|people|individuals?|victims?)\s+(?:were|have been|had been)\s+(?:abducted|kidnapped)",
    ]
    summary_matches = []
    for pattern in summary_patterns:
        for m in re.finditer(pattern, note_clean):
            summary_matches.append(int(m.group(1)))
    if summary_matches:
        return True, max(summary_matches)

    VICTIM_TYPES = (
        r"girls?|boys?|women|men|children|persons?|people|"
        r"villagers|residents|commuters|passengers|students|pupils|"
        r"teachers|worshippers|farmers|herders|victims?|hostages?|captives?|"
        r"corps?\s*members?|corpers|nysc\s*members?|"
        r"devotees|parishioners|congregants|mourners|"
        r"patients|officials|staff|workers|labourers|laborers|employees|"
        r"motorists|travellers|travelers|pilgrims|disciples"
    )

    total = 0
    breakdown_patterns = [
        rf"(\d+)\s*(?:{VICTIM_TYPES})",
        rf"(?:{VICTIM_TYPES})\s*(?:and|,)\s*(\d+)\s*(?:{VICTIM_TYPES})",
    ]
    for pattern in breakdown_patterns:
        matches = re.findall(pattern, note_clean)
        for m in matches:
            num = int(m) if m.isdigit() else 0
            total += num

    if total > 0:
        return True, total

    official_patterns = [
        r"(?:police|officials|authorities|military|army|commissioner|spokesman|\w+\s+police)\s+(?:said|confirmed|reported|stated|announced)\s+(?:\w+\s+){0,3}(?:abducted|kidnapped|captured|seized|rustled|whisked|spirited|carted)\s+(\d+)",
        rf"(\d+)\s+(?:persons?|people|individuals?|victims?|hostages?|captives?|villagers?|residents?|commuters?|passengers?|students?|corps?\s*members?|corpers?|workers?|labourers?|employees?|patients?|officials?)\s+(?:abducted|kidnapped|captured|seized|rustled|whisked|spirited|carted)",
        r"(?:abducted|kidnapped|captured|seized|rustled|whisked|spirited|carted)\s+(?:about|approximately|around|over|more than|some\s+)?(\d+)",
    ]
    for pattern in official_patterns:
        match = re.search(pattern, note_clean)
        if match:
            count_str = match.group(1)
            if count_str.isdigit():
                return True, int(count_str)

    word_pattern = r"\b(?:abducted|kidnapped|captured|seized|rustled|whisked|spirited|carted)\s+(\w+)"
    match = re.search(word_pattern, note_clean)
    if match:
        word = match.group(1)
        if word in NUMBER_MAP:
            return True, NUMBER_MAP[word]

    total_pattern = r"(?:abducted|kidnapped|captured|seized|rustled|spirited|carted)\s+(?:a\s+)?total\s+of\s+(\d+)"
    match = re.search(total_pattern, note_clean)
    if match:
        return True, int(match.group(1))

    simple_abduct = re.search(r"(\d+)\s+(?:persons?|people|individuals?)\s+(?:abducted|kidnapped)", note_clean)
    if simple_abduct:
        return True, int(simple_abduct.group(1))

    return True, 0


def _filter_injured(text: str) -> str:
    """Remove numbers that refer to injuries (not fatalities)."""
    return re.sub(r"\b(\d+)\s+\w*\s*injured\b", "", text)


def _dedup_numbers(text: str) -> str:
    """Remove duplicate numbers from alternative-source sentences.
    Keeps the first mention of each number+unit pair, drops later repeats."""
    lines = re.split(r'(?<=[.!])\s+', text)
    kept_lines = []
    seen_pairs = set()
    for line in lines:
        low = line.lower()
        if any(w in low for w in ['stated that', 'said that', 'reported that', 'according to',
                                    'other sources', 'international outlets', 'other reports']):
            continue
        nums = re.findall(r'(\d+)\s+(\w+)', line)
        key = tuple(nums)
        if key and key not in seen_pairs:
            seen_pairs.add(key)
            kept_lines.append(line)
        elif not key:
            kept_lines.append(line)
    return ' '.join(kept_lines)


def partition_fatalities(note: str, total_fatalities: int) -> tuple[int, int, int]:
    if not note or not isinstance(note, str) or total_fatalities <= 0:
        return 0, 0, 0

    note_lower = note.lower()
    note_lower = _filter_injured(note_lower)
    note_lower = _dedup_numbers(note_lower)
    note_lower = _expand_word_numbers(note_lower)

    combatants, security, civilians = 0, 0, 0

    combatant_pattern = (
        r"(\d+)\s*(?:"
        + "|".join(re.escape(t) for t in COMBATANT_TERMS)
        + r")"
    )
    for match in re.finditer(combatant_pattern, note_lower):
        combatants += int(match.group(1))

    security_pattern = (
        r"(\d+)\s*(?:"
        + "|".join(re.escape(t) for t in SECURITY_TERMS)
        + r")"
    )
    for match in re.finditer(security_pattern, note_lower):
        security += int(match.group(1))

    civilian_pattern = (
        r"(\d+)\s*(?:"
        + "|".join(re.escape(t) for t in CIVILIAN_TERMS)
        + r")"
    )
    for match in re.finditer(civilian_pattern, note_lower):
        civilians += int(match.group(1))

    parsed_total = combatants + security + civilians
    if parsed_total == 0:
        return 0, 0, total_fatalities

    if parsed_total > total_fatalities:
        scale = total_fatalities / parsed_total
        combatants = round(combatants * scale)
        security = round(security * scale)
        civilians = max(0, total_fatalities - combatants - security)
        diff = total_fatalities - combatants - security - civilians
        if diff > 0:
            civilians += diff
    elif parsed_total < total_fatalities:
        civilians = max(0, total_fatalities - combatants - security)

    return combatants, security, civilians


def extract_target_category(note: str) -> str:
    if not note or not isinstance(note, str):
        return "General/Unspecified"

    note_lower = note.lower()

    categories = [
        ("Place of Worship", [
            "church", "mosque", "pastor", "priest", "imam",
            "worshippers", "sunday service", "christian", "muslim",
            "catholic", "crusade", "revival", "shrine",
        ]),
        ("Educational Institution", [
            "school", "college", "university", "student", "teacher",
            "classroom", "boarding", "academy", "campus", "lecturer",
            "principal", "polytechnic", "primary school", "secondary school",
        ]),
        ("Oil & Gas Infrastructure", [
            "pipeline", "oil", "gas", "nnpc", "wellhead",
            "refinery", "platform", "petrol", "petroleum",
            "flow station", "crude",
        ]),
        ("Financial/Bank", [
            "bank", "atm", "financial institution", "microfinance",
            "credit", "savings", "banking",
        ]),
        ("Agricultural/Farm", [
            "farm", "farmer", "cattle", "livestock", "ranch",
            "grazing", "crop", "plantation", "agricultural",
            "herder", "herdsmen", "pasture",
        ]),
        ("Commercial/Market", [
            "market", "shop", "trader", "business", "mall",
            "store", "supermarket", "vendor", "commercial",
            "shopping", "butcher", "kiosk",
        ]),
        ("Transport/Transit", [
            "bus", "car", "vehicle", "road", "highway",
            "checkpoint", "railway", "airport", "taxi",
            "transport", "motorway", "roadblock", "conveyance",
            "motorcade", "convoy", "van", "lorry", "truck",
        ]),
        ("Government/Police", [
            "police station", "government building", "council",
            "govt office", "secretariat", "ministry", "embassy",
            "government", "prison", "court", "correctional",
            "police post", "police division", "security post",
        ]),
        ("Residential/Village", [
            "village", "community", "house", "home", "resident",
            "neighborhood", "settlement", "hamlet", "ward",
            "compound", "dwelling",
        ]),
    ]

    for category, keywords in categories:
        for kw in keywords:
            if kw in note_lower:
                return category

    return "General/Unspecified"


def classify_actor(actor_str: str) -> str:
    if not actor_str or not isinstance(actor_str, str):
        return "Other Armed Group / Others"

    actor_lower = actor_str.lower()

    if any(kw in actor_lower for kw in [
        "police", "military", "army", "soldiers", "troops",
        "jtf", "css", "cjtf", "vigilante", "nscdc",
        "security forces", "navy", "air force", "immigration",
        "customs", "civil defence", "correctional",
    ]):
        return "State Forces"

    if any(kw in actor_lower for kw in [
        "lakurawa", "issp", "islamic state sahel",
    ]):
        return "Lakurawa/IS-Sahel"

    if any(kw in actor_lower for kw in [
        "boko haram", "bh", "iswap", "iswa", "jas",
        "jamā'a ahl as-sunnah", "jama'atu", "islamic state",
    ]):
        return "Boko Haram/ISWAP"

    if any(kw in actor_lower for kw in [
        "bandits", "kidnappers", "gunmen", "armed men",
        "unknown gunmen", "hoodlums", "criminal",
        "robbers", "thieves", "cultists",
    ]):
        return "Bandits & Armed Gangs"

    if any(kw in actor_lower for kw in [
        "fulani", "herder", "militia", "mambilla", "tiv",
        "berom", "igbira", "yoruba", "hausa", "igbo",
        "ethnic", "tribal", "militant",
    ]):
        return "Sectarian/Ethnic Militia"

    if any(kw in actor_lower for kw in [
        "rioter", "protester", "student", "youth", "mob",
        "demonstrator", "activist",
    ]):
        return "Rioters/Protesters"

    if any(kw in actor_lower for kw in [
        "civilian", "farmer", "villager", "resident",
        "commuter", "worshipper", "person", "people",
    ]):
        return "Civilians"

    return "Other Armed Group / Others"


def get_administration(dt) -> str:
    if dt is None:
        return "Unknown"
    try:
        year = dt.year
        month = dt.month
        day = dt.day
    except AttributeError:
        return "Unknown"

    if year < 1999 or (year == 1999 and month < 5) or (year == 1999 and month == 5 and day < 29):
        return "Pre-Democracy"
    elif year < 2007 or (year == 2007 and month < 5) or (year == 2007 and month == 5 and day < 29):
        return "Obasanjo"
    elif year < 2010 or (year == 2010 and month < 5) or (year == 2010 and month == 5 and day < 6):
        return "Yar'Adua"
    elif year < 2015 or (year == 2015 and month < 5) or (year == 2015 and month == 5 and day < 29):
        return "Jonathan"
    elif year < 2023 or (year == 2023 and month < 5) or (year == 2023 and month == 5 and day < 29):
        return "Buhari"
    else:
        return "Tinubu"
