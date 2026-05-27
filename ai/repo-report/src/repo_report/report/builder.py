from __future__ import annotations

from datetime import date

from repo_report.models import RepoResult, RepoStatus


class ReportBuilder:
    def build(self, results: list[RepoResult], stat_period: str) -> tuple[str, str]:
        total = len(results)
        success = [r for r in results if r.status == RepoStatus.SUCCESS]
        empty = [r for r in results if r.status == RepoStatus.EMPTY]
        errors = [r for r in results if r.status == RepoStatus.ERROR]
        updated = len(success)

        if total > 0 and updated == 0 and not errors:
            content = (
                f"【AI 代码日报】团队多仓库迭代汇总｜统计周期：{stat_period} 当日增量更新\n"
                "📊 迭代概览：当日全仓库无新增代码迭代更新\n"
            )
            return "【AI 代码日报】", content

        lines = [
            f"【AI 代码日报】团队多仓库迭代汇总｜统计周期：{stat_period} 当日增量更新",
            f"📊 迭代概览：本次统计仓库{total}个，正常更新仓库{updated}个，"
            f"无更新仓库{len(empty)}个，异常/故障仓库{len(errors)}个",
            "",
        ]

        section_num = 1
        summaries: list[str] = []
        for result in success:
            cn_num = _cn_section(section_num)
            lines.append(f"{cn_num}、{result.name} 迭代明细")
            lines.append(result.analysis.strip())
            lines.append("")
            summaries.append(_extract_summary(result.analysis))
            section_num += 1

        for result in empty:
            cn_num = _cn_section(section_num)
            lines.append(f"{cn_num}、{result.name} 迭代明细")
            lines.append("本轮无新增代码更新。")
            lines.append("")
            section_num += 1

        lines.append(f"{_cn_section(section_num)}、全局整体迭代总结")
        if summaries:
            lines.append(
                "今日团队整体迭代涵盖以下仓库工作："
                + "；".join(summaries[:5])
                + "。各仓库迭代节奏稳定，详见上文分仓库明细。"
            )
        elif not errors:
            lines.append("今日各仓库均无新增有效提交，团队迭代处于平稳期。")
        else:
            lines.append("部分仓库分析异常，请查看异常备注并人工复核。")

        if errors:
            lines.append("")
            lines.append("异常仓库备注：")
            for r in errors:
                lines.append(f"- {r.name} ({r.branch}): {r.error}")

        content = "\n".join(lines)
        return "【AI 代码日报】", content


def _cn_section(n: int) -> str:
    nums = "零一二三四五六七八九十"
    if n <= 10:
        return nums[n]
    return str(n)


def _extract_summary(analysis: str) -> str:
    for line in analysis.splitlines():
        if "仓库小结" in line or "小结" in line:
            return line.strip()
    return analysis.splitlines()[-1][:80] if analysis.strip() else ""
