"""Calculator Tool"""

import ast
import math
import operator
from typing import Any, Dict

from ..base import Tool, ToolParameter
from ..errors import ToolErrorCode
from ..response import ToolResponse


class CalculatorTool(Tool):
    """Python Calculator Tool"""

    # Supported operators
    OPERATORS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.BitXor: operator.xor,
        ast.USub: operator.neg,
    }

    # Supported functions and constants
    FUNCTIONS = {
        'abs': abs,
        'round': round,
        'max': max,
        'min': min,
        'sum': sum,
        'sqrt': math.sqrt,
        'sin': math.sin,
        'cos': math.cos,
        'tan': math.tan,
        'log': math.log,
        'exp': math.exp,
        'pi': math.pi,
        'e': math.e,
    }

    def __init__(self):
        super().__init__(
            name="python_calculator",
            description="Perform mathematical calculations. Supports basic operations, math functions, etc. Example: 2+3*4, sqrt(16), sin(pi/2)."
        )

    def run(self, parameters: Dict[str, Any]) -> ToolResponse:
        """
        Execute calculation

        Args:
            parameters: Dictionary containing input parameter

        Returns:
            ToolResponse: Standardized tool response object
        """
        # Support two parameter formats: input and expression
        expression = parameters.get("input", "") or parameters.get("expression", "")

        if not expression:
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_PARAM,
                message="Calculation expression cannot be empty"
            )

        print(f"🧮 Calculating: {expression}")

        try:
            # Parse expression
            node = ast.parse(expression, mode='eval')
            result = self._eval_node(node.body)
            result_str = str(result)

            print(f"✅ Result: {result_str}")

            return ToolResponse.success(
                text=f"Result: {result_str}",
                data={
                    "expression": expression,
                    "result": result,
                    "result_str": result_str,
                    "result_type": type(result).__name__
                }
            )
        except SyntaxError as e:
            error_msg = f"Expression syntax error: {str(e)}"
            print(f"❌ {error_msg}")
            return ToolResponse.error(
                code=ToolErrorCode.INVALID_FORMAT,
                message=error_msg,
                context={"expression": expression}
            )
        except Exception as e:
            error_msg = f"Calculation failed: {str(e)}"
            print(f"❌ {error_msg}")
            return ToolResponse.error(
                code=ToolErrorCode.EXECUTION_ERROR,
                message=error_msg,
                context={"expression": expression}
            )

    def _eval_node(self, node):
        """Evaluate AST node recursively"""
        if isinstance(node, ast.Constant):  # Python 3.8+
            return node.value
        elif isinstance(node, ast.Num):  # Python < 3.8
            return node.n
        elif isinstance(node, ast.BinOp):
            return self.OPERATORS[type(node.op)](
                self._eval_node(node.left),
                self._eval_node(node.right)
            )
        elif isinstance(node, ast.UnaryOp):
            return self.OPERATORS[type(node.op)](self._eval_node(node.operand))
        elif isinstance(node, ast.Call):
            func_name = node.func.id
            if func_name in self.FUNCTIONS:
                args = [self._eval_node(arg) for arg in node.args]
                return self.FUNCTIONS[func_name](*args)
            else:
                raise ValueError(f"Unsupported function: {func_name}")
        elif isinstance(node, ast.Name):
            if node.id in self.FUNCTIONS:
                return self.FUNCTIONS[node.id]
            else:
                raise ValueError(f"Undefined variable: {node.id}")
        else:
            raise ValueError(f"Unsupported expression type: {type(node)}")

    def get_parameters(self):
        """Get tool parameter definitions"""
        return [
            ToolParameter(
                name="input",
                type="string",
                description="Mathematical expression to calculate, supports basic operations and math functions",
                required=True
            )
        ]

# Convenience function
def calculate(expression: str) -> ToolResponse:
    """
    Perform mathematical calculation

    Args:
        expression: Mathematical expression

    Returns:
        Calculation result string
    """
    tool = CalculatorTool()
    return tool.run({"input": expression})
