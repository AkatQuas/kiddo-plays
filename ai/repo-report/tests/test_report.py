from repo_report.models import RepoResult, RepoStatus
from repo_report.report.builder import ReportBuilder


def test_empty_report():
    results = [
        RepoResult(name="a", branch="main", status=RepoStatus.EMPTY),
    ]
    title, content = ReportBuilder().build(results, "2026-05-27")
    assert title == "【AI 代码日报】"
    assert "无新增" in content or "无更新" in content


def test_success_report():
    results = [
        RepoResult(
            name="ordering",
            branch="main",
            status=RepoStatus.SUCCESS,
            analysis="👤 Alice\n- 功能新增：test\n仓库小结：stable",
        ),
    ]
    _, content = ReportBuilder().build(results, "2026-05-27")
    assert "ordering" in content
    assert "Alice" in content
