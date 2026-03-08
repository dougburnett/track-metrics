/**
 * Safe math expression evaluator using recursive descent parsing.
 * Supports: +, -, *, /, parentheses, variables a-z, decimal numbers.
 */

export function indexToVar(index: number): string {
  return String.fromCharCode(97 + index);
}

export function evaluateFormula(
  formula: string,
  values: Record<string, number>
): number {
  let pos = 0;
  const input = formula.replace(/\s+/g, "");

  function parseExpr(): number {
    let result = parseTerm();
    while (pos < input.length && (input[pos] === "+" || input[pos] === "-")) {
      const op = input[pos++];
      const right = parseTerm();
      result = op === "+" ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (pos < input.length && (input[pos] === "*" || input[pos] === "/")) {
      const op = input[pos++];
      const right = parseFactor();
      result = op === "*" ? result * right : result / right;
    }
    return result;
  }

  function parseFactor(): number {
    // Unary minus
    if (input[pos] === "-") {
      pos++;
      return -parseFactor();
    }
    // Parentheses
    if (input[pos] === "(") {
      pos++;
      const result = parseExpr();
      if (input[pos] === ")") pos++;
      return result;
    }
    // Number
    if (/[0-9.]/.test(input[pos])) {
      let numStr = "";
      while (pos < input.length && /[0-9.]/.test(input[pos])) {
        numStr += input[pos++];
      }
      return parseFloat(numStr);
    }
    // Variable (a-z)
    if (/[a-z]/.test(input[pos])) {
      const v = input[pos++];
      if (!(v in values)) throw new Error(`Unknown variable: ${v}`);
      return values[v];
    }
    throw new Error(`Unexpected character: ${input[pos]}`);
  }

  const result = parseExpr();
  return result;
}
