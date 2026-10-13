import pytest
from src.job_discovery.boolean_parser import BooleanSearchParser

def test_boolean_and_operator():
    query = 'React AND TypeScript'
    assert BooleanSearchParser.matches(query, "We are looking for a React and TypeScript engineer.")
    assert not BooleanSearchParser.matches(query, "Looking for a React developer with Python.")

def test_boolean_or_operator():
    query = 'React OR Vue'
    assert BooleanSearchParser.matches(query, "Looking for a Vue developer")
    assert BooleanSearchParser.matches(query, "Looking for a React developer")
    assert not BooleanSearchParser.matches(query, "Looking for an Angular developer")

def test_boolean_parentheses_and_quotes():
    query = '("React" OR "Next.js") AND (intern OR internship) AND (remote OR "Bangalore")'
    
    text_match = "We have an opening for a Next.js Intern based in Bangalore or Remote."
    assert BooleanSearchParser.matches(query, text_match)

    text_no_role = "Senior React Architect in Bangalore."
    assert not BooleanSearchParser.matches(query, text_no_role)

def test_boolean_not_operator():
    query = 'Python AND NOT Senior'
    assert BooleanSearchParser.matches(query, "Junior Python Developer")
    assert not BooleanSearchParser.matches(query, "Senior Python Developer")

def test_build_query_from_profile():
    query = BooleanSearchParser.build_query_from_profile(
        skills=["React", "Node.js"],
        target_role="Frontend Intern",
        locations=["Remote", "Bangalore"]
    )
    assert '("React" OR "Node.js")' in query
    assert "Remote" in query
