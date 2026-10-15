from scoring.schemas import InterviewResult, contract_markdown


def test_result_keeps_required_top_level_fields():
    result = InterviewResult(interview_score=82)

    assert result.contract_version == "v0"
    assert result.interview_score == 82


def test_score_range_is_enforced():
    for invalid_score in (-1, 101):
        try:
            InterviewResult(interview_score=invalid_score)
        except ValueError:
            pass
        else:
            raise AssertionError("out-of-range score was accepted")


def test_decimal_score_is_supported():
    result = InterviewResult(interview_score=78.5)

    assert result.interview_score == 78.5


def test_contract_is_generated_from_schema():
    contract = contract_markdown()

    assert contract.startswith("# Mock Interview Contract")
    assert "DRAFT v0, not agreed with teammates" in contract
    assert '"interview_score"' in contract
    assert '"contract_version"' in contract
