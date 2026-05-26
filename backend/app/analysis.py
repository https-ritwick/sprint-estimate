"""
Vote analysis helpers.

Given a story's votes, compute the statistics the UI needs after a reveal:
average, median, min, max, distribution, consensus and a suggested final estimate.

Non-numeric cards ("?", "Pass", "Coffee") are tracked for display but excluded
from the numeric calculations. T-shirt sizes are mapped onto an ordinal scale so
they can still be averaged, and the suggested estimate is mapped back to a size.
"""
from __future__ import annotations

import statistics
from typing import Optional

from .models import NON_NUMERIC_CARDS, TSHIRT_SCALE, Story


_TSHIRT_REVERSE = {v: k for k, v in TSHIRT_SCALE.items()}


def _numeric_value(card: str) -> Optional[float]:
    """Return a numeric value for a card, or None for neutral cards.
    T-shirt sizes are projected onto their ordinal scale."""
    if card in NON_NUMERIC_CARDS:
        return None
    if card in TSHIRT_SCALE:
        return float(TSHIRT_SCALE[card])
    try:
        return float(card)
    except (TypeError, ValueError):
        return None


def _nearest_card(value: float, deck: list[str]) -> str:
    """Snap an arbitrary numeric value to the closest numeric card on the deck.
    Used to turn a raw average into a 'suggested' card the team can actually pick."""
    numeric_cards = [(c, _numeric_value(c)) for c in deck]
    numeric_cards = [(c, v) for c, v in numeric_cards if v is not None]
    if not numeric_cards:
        return ""
    best = min(numeric_cards, key=lambda cv: abs(cv[1] - value))
    return best[0]


def analyze_story(story: Story, users: dict, deck: list[str]) -> dict:
    """Build a full analysis payload for a story.

    `users` is the room's user_id -> User map, used to label votes with names.
    `deck` is the room's active card deck.
    """
    detailed = []
    for user_id, card in story.votes.items():
        user = users.get(user_id)
        detailed.append({
            "userId": user_id,
            "userName": user.name if user else "Unknown",
            "team": user.team if user else "",
            "corporateId": user.corporate_id if user else "",
            "card": card,
        })

    numeric_values = [
        v for v in (_numeric_value(c) for c in story.votes.values()) if v is not None
    ]

    # Distribution across every card in the deck (including 0 counts → useful for charts).
    distribution = {card: 0 for card in deck}
    for card in story.votes.values():
        distribution[card] = distribution.get(card, 0) + 1

    special_counts = {c: distribution.get(c, 0) for c in NON_NUMERIC_CARDS if c in distribution or distribution.get(c)}

    is_tshirt = any(c in TSHIRT_SCALE for c in deck)

    result = {
        "votes": detailed,
        "totalVotes": len(story.votes),
        "numericVoteCount": len(numeric_values),
        "distribution": distribution,
        "specialCounts": special_counts,
        "average": None,
        "averageLabel": None,
        "median": None,
        "min": None,
        "max": None,
        "consensus": False,
        "agreementPct": 0.0,
        "suggestedEstimate": None,
    }

    if numeric_values:
        avg = statistics.mean(numeric_values)
        med = statistics.median(numeric_values)
        lo = min(numeric_values)
        hi = max(numeric_values)

        # Consensus: everyone who cast a numeric vote chose the same value.
        consensus = len(set(numeric_values)) == 1

        try:
            mode_val = statistics.mode(numeric_values)
        except statistics.StatisticsError:
            mode_val = numeric_values[0]
        agreement = sum(1 for v in numeric_values if v == mode_val) / len(numeric_values)

        suggested = _nearest_card(avg, deck)

        # For T-shirt decks, present min/max/median as labels rather than numbers.
        def lbl(v: float) -> str:
            if is_tshirt:
                return _TSHIRT_REVERSE.get(int(round(v)), str(v))
            return str(int(v)) if float(v).is_integer() else str(v)

        result.update({
            "average": round(avg, 2),
            "averageLabel": _nearest_card(avg, deck) if is_tshirt else round(avg, 2),
            "median": lbl(med) if is_tshirt else med,
            "min": lbl(lo) if is_tshirt else lo,
            "max": lbl(hi) if is_tshirt else hi,
            "consensus": consensus,
            "agreementPct": round(agreement * 100, 1),
            "suggestedEstimate": suggested,
        })

    return result
