import numpy as np

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.nlg.narrative_builder import NarrativeBuilder
from data_analysis.operators.spss.hypothesis import run_spss_hypothesis_test
from data_analysis.operators.spss.regression import run_spss_regression


def test_spss_t_test_and_anova():
    mgr = SessionManager()
    sess = mgr.get_or_create_session("test_spss_sess")
    con = sess.get_duckdb_conn()

    np.random.seed(42)
    gA = np.random.normal(100, 15, 100)
    gB = np.random.normal(120, 15, 100)
    gC = np.random.normal(140, 15, 100)

    con.execute("CREATE TABLE ab_test (group_name VARCHAR, score DOUBLE)")
    for v in gA:
        con.execute(f"INSERT INTO ab_test VALUES ('GroupA', {v})")
    for v in gB:
        con.execute(f"INSERT INTO ab_test VALUES ('GroupB', {v})")

    t_res = run_spss_hypothesis_test(
        session_id="test_spss_sess",
        dataset_name="ab_test",
        test_type="independent_t_test",
        dependent_var="score",
        group_var="group_name",
    )
    assert t_res["significant"] is True
    assert t_res["p_value"] < 0.001
    assert "effect_size_cohens_d" in t_res

    for v in gC:
        con.execute(f"INSERT INTO ab_test VALUES ('GroupC', {v})")

    anova_res = run_spss_hypothesis_test(
        session_id="test_spss_sess",
        dataset_name="ab_test",
        test_type="one_way_anova",
        dependent_var="score",
        group_var="group_name",
    )
    assert anova_res["significant"] is True
    assert len(anova_res["post_hoc_tukey_hsd"]) > 0

    narrative = NarrativeBuilder.generate_spss_narrative(anova_res)
    assert "SPSS 统计推断" in narrative


def test_spss_ols_regression():
    mgr = SessionManager()
    sess = mgr.get_or_create_session("test_reg_sess")
    con = sess.get_duckdb_conn()

    np.random.seed(42)
    x1 = np.linspace(1, 50, 100)
    x2 = np.random.normal(10, 2, 100)
    y = 5.0 + 2.5 * x1 - 1.2 * x2 + np.random.normal(0, 1, 100)

    con.execute("CREATE TABLE reg_data (y DOUBLE, x1 DOUBLE, x2 DOUBLE)")
    for i in range(100):
        con.execute(f"INSERT INTO reg_data VALUES ({y[i]}, {x1[i]}, {x2[i]})")

    reg_res = run_spss_regression(
        session_id="test_reg_sess",
        dataset_name="reg_data",
        dependent_var="y",
        independent_vars=["x1", "x2"],
    )

    assert reg_res["r_squared"] > 0.95
    assert reg_res["f_p_value"] < 0.0001
    assert len(reg_res["coefficients"]) == 3
    assert reg_res["multicollinearity_vif"][0]["vif"] < 5.0

    narrative = NarrativeBuilder.generate_regression_narrative(reg_res)
    assert "多元线性回归模型诊断" in narrative
