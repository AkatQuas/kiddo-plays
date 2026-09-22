import json

from common.config import get_server_config
from common.logger_config import logger
from voxmesh.llm.client import LLMClientConfig, create_openai_client


def summary_title(text: str, pre_titles: list[str] = []) -> dict:
    """
    输入一段文字和历史主题列表，返回核心内容主题和是否需要建议点。
    - 如果主题与pre_titles高度相似，则advice=false且不返回title。
    - 否则返回advice、content、title。
    """
    knowledge_config = get_server_config().knowledge_config
    client = create_openai_client(
        LLMClientConfig(
            api_url=knowledge_config.api_url,
            api_key=knowledge_config.api_key,
            model=knowledge_config.model,
            max_tokens=knowledge_config.max_tokens,
        )
    )
    if client is None:
        return {"advice": False}
    pre_titles_str = "，".join(pre_titles) if pre_titles else "无"
    prompt = f"""
你是一个专业的内容总结与建议AI。
请对用户输入的内容进行如下处理：

1. 总结出这段内容的核心主题，输出为title字段。
2. 判断内容中是否存在你可以提供建议或优化的点，包括但不限于：
   - 用户明确提出疑问、请求帮助或解释（如包含“为什么”、“如何”、“怎样”、“什么是”、“请解释”等关键词）
   - 涉及明确的专业技术名词、缩写、行业术语且未提供解释（仅当能确定术语含义时才触发建议）
   - 存在明显的知识缺口、潜在误解或需要进一步澄清的内容（仅当能明确提供补充信息时才触发建议）
   - 包含需要具体步骤、示例或代码才能理解的技术问题
   - 当用户有检索意图时，比如明确查询动词 + 具体查询对象：
    - 数据/事实查询："是多少"、"有多少"、"达到多少"、"占比是"、"增长率"、"完成情况"
    - 信息请求："请查"、"查一下"、"提供"、"给我"、"找到"、"获取"
    - 解释说明："解释"、"说明"、"介绍"、"什么是"、"如何理解"
    - 状态查询："当前状态"、"最新情况"、"进展如何"、"完成没有"
    - 对比分析："对比"、"比较"、"差异"、"优劣"、"哪个更好"
    - 流程咨询："怎么操作"、"流程是什么"、"步骤"、"如何执行"
3. 如果有建议点，请以Json格式输出：{{"advice": true, "content": "建议提示词", "title": "主题"}}，其中content为详细的建议提示词，title为当前内容的简要主题。
4. 如果没有建议点，请以Json格式输出：{{"advice": false, "title": "主题"}}。
5. 【特别要求】如果你总结出的主题与历史主题列表（pre_titles）中任意一个主题相似（意思接近或重复），则直接输出：{{"advice": false}}，不要返回title和content。

历史主题列表（pre_titles）：{pre_titles_str}

【特别注意】：
- 只要用户内容中出现疑问、求解释、技术名词、缩写、专有名词、或以“是什么”、“怎么做”、“如何”、“请解释”等为开头的句子，且AI能明确理解并提供具体建议时，才设置 advice=true 并给出明确的建议提示词。
- 当遇到无法确定含义的术语、可能的拼写错误、模糊不清的表述或上下文信息不足时，即使存在疑问词，也必须直接设置 advice=false，不生成任何需要用户确认的建议。
- 建议提示词需要详细具体，包含以下要素：
     1. 明确指出需要解释或建议的具体内容
  2. 提供相关背景知识或上下文
  3. 列出需要涵盖的要点（至少2-3点）
  4. 建议适当的解释方式（如举例、步骤说明、对比分析等）
  5. 确保建议是100%确定性的，完全基于现有知识，不包含任何需要用户确认、澄清或补充信息的内容

【示例】：
- 用户内容：“MCP是什么？” pre_titles=["MCP介绍"] → 输出：{{"advice": false}}
- 用户内容：“MCP是什么？” pre_titles=["天气"] → 输出：{{"advice": true, "content": "请详细解释MCP的定义和应用场景", "title": "MCP定义"}}
- 用户内容：“今天天气不错，适合出去玩。” pre_titles=["天气"] → 输出：{{"advice": false}}
  - 用户内容包含未知术语“Muka”且无上下文时 → 输出：{{"advice": false}}
  - 用户内容出现“mality faced artists”等疑似拼写错误且无法推断时 → 输出：{{"advice": false}}
  - 用户内容：“请问如何优化模型推理速度？” pre_titles=["模型推理优化"] → 输出：{{"advice": false}}
- 用户内容：“请问如何优化模型推理速度？” pre_titles=["模型推理优化"] → 输出：{{"advice": true, "content": "请从以下方面提供模型推理优化建议：1. 模型结构优化（如剪枝、量化）；2. 推理引擎选择（如TensorRT、ONNX Runtime）；3. 硬件加速方案；4. 批处理策略优化", "title": "模型推理优化"}}

用户内容："""
    prompt += text
    prompt += "\n请严格按照Json格式输出，不要输出多余内容。"

    response = client.chat.completions.create(
        model=get_server_config().knowledge_config.model,
        messages=[
            {"role": "system", "content": "你是一个专业的内容总结与建议AI。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=get_server_config().knowledge_config.max_tokens,
        extra_body={
            "chat_template_kwargs": {"enable_thinking": False}
        },
    )
    if hasattr(response, 'choices') and response.choices:
        content = response.choices[0].message.content.strip()
        try:
            return json.loads(content)
        except Exception:
            logger.error(f"AI输出格式错误: {content}")
            return {"advice": False, "error": "AI输出格式错误", "raw": content}
    return {"advice": False, "error": "无AI回复"}

# 测试
if __name__ == "__main__":
    text = "今天天气不错，适合出去玩。"
    result = summary_title(text, pre_titles=["天气"])
    print(result)
    text = "MCP是什么?我需要帮助和建议"
    result = summary_title(text, pre_titles=["MCP介绍"])
    print(result)
    text = "话说你们对Qwen3和Qwen3.5的性能有什么看法？"
    result = summary_title(text, pre_titles=["天气"])
    print(result)
    text = "今天待的好没意思"
    result = summary_title(text, pre_titles=["天气"])
    print(result)
