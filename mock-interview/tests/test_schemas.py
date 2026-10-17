from scoring.schemas import DimensionScore, InterviewResult, TranscriptTurn, contract_markdown


def test_result_keeps_required_top_level_fields():
    result = _result(82)

    assert result.contract_version == "v0"
    assert result.interview_score == 82


def test_score_range_is_enforced():
    for invalid_score in (-1, 101):
        try:
            _result(invalid_score)
        except ValueError:
            pass
        else:
            raise AssertionError("out-of-range score was accepted")


def test_decimal_score_is_supported():
    result = _result(78.5)

    assert result.interview_score == 78.5


def test_contract_is_generated_from_schema():
    contract = contract_markdown()

    assert contract.startswith("# Mock Interview Contract")
    assert "DRAFT v0, not agreed with teammates" in contract
    assert '"interview_score"' in contract
    assert '"contract_version"' in contract


def test_result_requires_full_secondary_scoring_output():
    try:
        InterviewResult(
            interview_score=80,
            transcript=[TranscriptTurn(speaker="student", text="Answer")],
            summary="Incomplete dimensions.",
            strengths=["Clear"],
            improvement_areas=["Add metrics"],
            dimensions={"communication": DimensionScore(score=80)},
        )
    except ValueError as exc:
        assert "at least 3 items" in str(exc) or "missing scoring dimensions" in str(exc)
    else:
        raise AssertionError("incomplete scoring output was accepted")


def _result(score):
    return InterviewResult(
        interview_score=score,
        transcript=[TranscriptTurn(speaker="student", text="A complete answer.")],
        summary="Complete result.",
        strengths=["Clear answer"],
        improvement_areas=["Add metrics"],
        dimensions={
            "communication": DimensionScore(score=80),
            "technical_depth": DimensionScore(score=80),
            "behavioral": DimensionScore(score=80),
        },
    )
