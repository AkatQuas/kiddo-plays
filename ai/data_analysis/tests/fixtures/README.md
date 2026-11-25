# S0：现有解析与计算基线

这里只提交生成器、规格和独立校验代码。XLSX、逐行指纹和运行报告动态生成，必须输出到仓库外的新目录，不覆盖历史运行。没有安装 Docker，也不连接业务库。

```sh
# 在仓库根使用已安装本项目依赖的 Python 环境；OUT 为仓外新目录
python -m tests.fixtures.generate --profile small --out "$OUT/fixture"
python -m tests.fixtures.baseline --profile large --repeat 3 --threads 2 --out "$OUT/baseline"
python -m tests.fixtures.baseline --profile stress --repeat 1 --threads 2 --out "$OUT/stress"
# Reuse immutable generated data without generating another million-row workbook
python -m tests.fixtures.baseline --profile stress --repeat 1 --fixture-dir "$OUT/stress/fixture" --out "$OUT/stress-repeat"
python -m pytest tests/test_s0_fixtures.py
```

| 规格 | 行数 × 列数 | 重复额外行 / 空对象编码 / 金额错误 |
|---|---|---|
| tiny | 10 × 12 | 1 / 1 / 1 |
| small | 300 × 12 | 3 / 4 / 2 |
| large | 100,000 × 12 | 100 / 120 / 80 |
| stress | 1,000,000 × 12 | 1,000 / 1,200 / 800 |

字段是通用事件、对象编码和数值，不包含 ERP 规则。每行有稳定 row_id、事件键与行号；重复是事件键+行号重复，不是整行重复。原始总金额包含错误和重复行，不代表可以正式导入的金额。

独立标准答案使用 Python Decimal/整数分计算，不调用解析器、Arrow 或 SQL。每行保存全字段 SHA256、Excel 行号及问题标识；不仅核对三种错误，还逐行核对完整解析结果，未申报的第四处修改也会报错。manifest 保存文件哈希、尺寸、种子、规格和完整性；这些是测试校验数据，不是已实现的数据集版本缓存或导入恢复协议。

baseline 跑真实解析、会话注册、六条全量 SQL、热复用、两个独立会话并发，以及真实 ASGI 上传/预览/异主 API Key 拒绝。冷 SQL 是新会话第一次执行，不是冷进程/冷操作系统缓存；热 SQL 是同一会话再次执行。P95 随样本数一并记录，少量样本只作诊断。API 计时没有网络/CGW/对象存储开销；零模型调用不能证明自然语言理解准确。

输出 baseline.json 包含源提交、工作区是否修改、依赖版本、资源配置、阶段样本、进程整体内存峰值和未测阶段。API Key 仅为进程内显式测试值；此基线不证明业务租户与数据范围权限，也不进行业务写入。释放所有创建的会话，原始测试文件和报告保留人工审核。

运行前后校验源文件指纹及数据文件哈希，期间修改源码/文件就拒绝发布成功基线。复用样本不复用解析结果：仍测试真实冷解析，只省重复生成和保存大文件的空间。

生成器流式写 XLSX，但校验器的重复键集合、现有解析器和 Arrow 仍占用内存。百万行须显式运行 stress；普通 pytest 不生成大文件。
