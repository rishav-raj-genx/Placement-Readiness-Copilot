import re
from typing import List


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
            pattern = r"(?:\b|_)" + re.escape(term_clean) + r"(?:\b|_)"
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
            while (
                index < len(tokens)
                and tokens[index] in ("AND",)
                or (index < len(tokens) and tokens[index] not in ("OR", ")"))
            ):
                if tokens[index] == "AND":
                    index += 1
                right_val, index = parse_factor(index)
                left_val = left_val and right_val
            return left_val, index

        def parse_factor(index: int):
            if index >= len(tokens):
                raise ValueError("Unexpected end of boolean query expression.")

            token = tokens[index]

            if token == "NOT":
                val, next_idx = parse_factor(index + 1)
                return (not val), next_idx

            if token == "(":
                val, next_idx = parse_expression(index + 1)
                if next_idx >= len(tokens) or tokens[next_idx] != ")":
                    raise ValueError("Mismatched parentheses: expected ')'")
                return val, next_idx + 1

            if token == ")":
                raise ValueError("Unexpected ')' token in boolean expression.")

            if token in ("AND", "OR"):
                raise ValueError(f"Unexpected operator '{token}' at position {index}.")

            # Terminal literal keyword
            term_val = match_term(token)
            return term_val, index + 1

        cls.validate_syntax(query)
        result, next_idx = parse_expression(0)
        if next_idx < len(tokens):
            raise ValueError(
                f"Invalid Boolean query syntax: unparsed tokens {tokens[next_idx:]} in '{query}'"
            )
        return bool(result)

    @classmethod
    def validate_syntax(cls, query: str) -> None:
        """Validates that query syntax is well-formed with balanced parentheses and valid operator placement."""
        if not query or not query.strip():
            return
        tokens = cls.tokenize(query)
        if not tokens:
            return

        paren_depth = 0
        prev_token = None
        for i, t in enumerate(tokens):
            if t == "(":
                paren_depth += 1
                if prev_token not in (None, "AND", "OR", "NOT", "("):
                    raise ValueError(f"Invalid query: keyword directly preceding '(' without operator at '{query}'")
            elif t == ")":
                paren_depth -= 1
                if paren_depth < 0:
                    raise ValueError(f"Invalid query: unexpected ')' in '{query}'")
                if prev_token in ("AND", "OR", "NOT", "("):
                    raise ValueError(f"Invalid query: empty parentheses or operator before ')' in '{query}'")
            elif t in ("AND", "OR"):
                if prev_token is None or prev_token in ("AND", "OR", "NOT", "("):
                    raise ValueError(f"Invalid query: misplaced operator '{t}' at token {i} in '{query}'")
            elif t == "NOT":
                if prev_token not in (None, "AND", "OR", "("):
                    raise ValueError(f"Invalid query: 'NOT' must follow an operator or '(' at token {i} in '{query}'")
            prev_token = t

        if paren_depth != 0:
            raise ValueError(f"Invalid query: unclosed '(' in '{query}'")
        if tokens[-1] in ("AND", "OR", "NOT"):
            raise ValueError(f"Invalid query: trailing operator '{tokens[-1]}' in '{query}'")

    @staticmethod
    def build_query_from_profile(
        skills: List[str], target_role: str, locations: List[str] = None
    ) -> str:
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
            role_terms = [target_role]
            words = target_role.split()
            if len(words) > 1:
                role_terms.append(" ".join(words[:2]))
                for w in words:
                    if len(w) > 3 and w.lower() not in ("intern", "junior", "level"):
                        role_terms.append(w)
            role_terms.extend(["Intern", "Internship", "Associate", "Junior", "Engineer", "Developer"])
            seen_terms = set()
            clean_terms = []
            for r in role_terms:
                r_clean = r.strip()
                if r_clean.lower() not in seen_terms:
                    seen_terms.add(r_clean.lower())
                    clean_terms.append(r_clean)
            role_clause = " OR ".join([f'"{r}"' for r in clean_terms[:6]])
            parts.append(f"({role_clause})")
        else:
            role_clause = " OR ".join([f'"{k}"' for k in role_keywords])
            parts.append(f"({role_clause})")

        if locations:
            loc_clause = " OR ".join([f'"{loc.strip()}"' for loc in locations])
            parts.append(f"({loc_clause})")

        return " AND ".join(parts)
