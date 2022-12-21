export function calculate(
  operand1: number,
  operand2: number,
  operator: '+' | '-'
): number {
  switch (operator) {
    case '+':
      return operand1 + operand2;
    case '-':
      return operand1 - operand2;
    default:
      throw new Error('Unknown operator');
  }
}
