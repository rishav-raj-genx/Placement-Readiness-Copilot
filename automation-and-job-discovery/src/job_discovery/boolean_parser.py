import re
from typing import List, Union

class BooleanSearchParser:
    """
    Evaluates boolean expressions with AND, OR, NOT, parentheses, and quoted phrases.
    Example: '("React" OR "Next.js") AND (intern OR internship) AND (remote OR "Bangalore")'
    """

    @staticmethod
    def tokenize(query: str) -> List[str]:
        """Tokenize a boolean search query string."""
        pattern = r'\(|\)|\bAND\b|\bOR\b|\bNOT\b|"[^"]+"|[^\s()]+'
        tokens = re.findall(pattern, query, flags=re.IGNORECASE)
        # Normalize operator tokens
        normalized = []
        for t in tokens:
            t_upper = t.upper()
            if t_upper in ("AND", "OR", "NOT"):
                normalized.append(t_upper)
            elif t.startswith('"') and t.endswith('"'):
                normalized.append(t[1:-1].strip())
            else:
                normalized.append(t.strip())
        return [t for t in normalized if t]

    @classmethod
    def matches(cls, query: str, text: str) -> bool:
        """
        Returns True if `text` satisfies the boolean `query`.
        Case-insensitive evaluation.
        """
        if not query or not query.strip():
            return True

        tokens = cls.tokenize(query)
        if not tokens:
            return True

        normalized_text = " " + text.lower() + " "

        def match_term(term: str) -> bool:
            term_clean = term.lower().strip()
            # Boundary search for clean keyword matching
            pattern = r'(?:\b|_)' + re.escape(term_clean) + r'(?:\b|_)'
            return bool(re.search(pattern, normalized_text))

        # Recursive-descent boolean evaluator
        def parse_expression(index: int):
            left_val, index = parse_term(index)
            while index < len(tokens) and tokens[index] == "OR":
                index += 1
                right_val, index = parse_term(index)
                left_val = left_val or right_val
            return left_val, index

        def parse_term(index: int):
            left_val, index = parse_factor(index)
            while index < len(tokens) and tokens[index] in ("AND",) or (index < len(tokens) and tokens[index] not in ("OR", ")")):
                if tokens[index] == "AND":
                    index += 1
                right_val, index = parse_factor(index)
                left_val = left_val and right_val
            return left_val, index

        def parse_factor(index: int):
            if index >= len(tokens):
                return False, index

            token = tokens[index]

            if token == "NOT":
                val, next_idx = parse_factor(index + 1)
                return (not val), next_idx

            if token == "(":
                val, next_idx = parse_expression(index + 1)
                if next_idx < len(tokens) and tokens[next_idx] == ")":
                    next_idx += 1
                return val, next_idx

            if token == ")":
                return False, index

            # Terminal literal keyword
            term_val = match_term(token)
            return term_val, index + 1

        try:
            result, _ = parse_expression(0)
            return bool(result)
        except Exception:
            # Fallback to simple all-terms check if complex nested syntax has typos
            raw_terms = [t.lower() for t in tokens if t not in ("AND", "OR", "NOT", "(", ")")]
            return any(t in normalized_text for t in raw_terms)

    @staticmethod
    def build_query_from_profile(skills: List[str], target_role: str, locations: List[str] = None) -> str:
        """
        Builds a standard compliant boolean query from student profile.
        Example output:
        '("React" OR "TypeScript") AND ("intern" OR "internship" OR "entry level") AND ("remote" OR "Bangalore")'
        """
        parts = []

        if skills:
            skill_clause = " OR ".join([f'"{s.strip()}"' for s in skills[:6]])
            parts.append(f"({skill_clause})")

        role_keywords = ["intern", "internship", "graduate", "junior", "associate"]
        if target_role:
            role_terms = [target_role] + [f"{target_role} {k}" for k in ["Intern", "Internship", "Junior"]]
            role_clause = " OR ".join([f'"{r.strip()}"' for r in role_terms[:4]])
            parts.append(f"({role_clause})")
        else:
            role_clause = " OR ".join([f'"{k}"' for k in role_keywords])
            parts.append(f"({role_clause})")

        if locations:
            loc_clause = " OR ".join([f'"{loc.strip()}"' for loc in locations])
            parts.append(f"({loc_clause})")

        return " AND ".join(parts)
