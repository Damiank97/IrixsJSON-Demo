export type Cell = string | number | boolean | null;
type Node = { kind: "literal"; value: Cell } | { kind: "field"; name: string } | { kind: "unary"; op: string; child: Node } | { kind: "binary"; op: string; left: Node; right: Node } | { kind: "call"; name: string; args: Node[] };
type Token = { kind: string; value: string };
const FUNCTIONS: Record<string, string> = { IF: "IF", ALS: "IF", ROUND: "ROUND", AFRONDEN: "ROUND", ABS: "ABS", MIN: "MIN", MAX: "MAX", COALESCE: "COALESCE" };

// Small, bounded expression language. Never eval(), Function(), script or external calls.
export function compileFormula(expression: string): { fields: string[]; evaluate: (row: Record<string, Cell>) => Cell } {
  if (!expression.trim() || expression.length > 500) throw new Error("Gebruik een formule van 1 t/m 500 tekens.");
  const input = expression.trim().replace(/^=/, ""), tokens: Token[] = [];
  let pos = 0;
  while (pos < input.length) {
    const rest = input.slice(pos);
    const space = /^\s+/.exec(rest); if (space) { pos += space[0].length; continue; }
    const field = /^\[([^\[\]]{1,100})\]/.exec(rest);
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    const quoted = /^"((?:[^"\\]|\\["\\])*)"/.exec(rest);
    const name = /^[A-Za-z_]+/.exec(rest), op = /^(?:<=|>=|<>|!=|[+\-*/^=<>(),;])/.exec(rest);
    if (field) { tokens.push({kind:"field",value:field[1]}); pos += field[0].length; }
    else if (number) { tokens.push({kind:"number",value:number[0]}); pos += number[0].length; }
    else if (quoted) { tokens.push({kind:"string",value:quoted[1].replace(/\\(["\\])/g,"$1")}); pos += quoted[0].length; }
    else if (name) { tokens.push({kind:"name",value:name[0].toUpperCase()}); pos += name[0].length; }
    else if (op) { tokens.push({kind:op[0],value:op[0]}); pos += op[0].length; }
    else throw new Error(`Onbekend teken op positie ${pos + 1}. Gebruik [veldnamen], getallen en toegestane functies.`);
    if (tokens.length > 250) throw new Error("Deze formule bevat te veel onderdelen.");
  }
  let at = 0;
  const fields = new Set<string>();
  const peek = () => tokens[at]?.kind;
  function take(kind: string) { if (peek() !== kind) throw new Error(`Verwacht '${kind}' in de formule.`); return tokens[at++]; }
  function primary(depth: number): Node {
    if (depth > 32) throw new Error("De formule is te diep genest.");
    const token = tokens[at++]; if (!token) throw new Error("De formule is niet compleet.");
    if (token.kind === "number") { const value = Number(token.value); if (!Number.isFinite(value)) throw new Error("Ongeldig getal."); return {kind:"literal",value}; }
    if (token.kind === "string") return {kind:"literal",value:token.value};
    if (token.kind === "field") { fields.add(token.value); return {kind:"field",name:token.value}; }
    if (token.kind === "+" || token.kind === "-") return {kind:"unary",op:token.kind,child:parse(4,depth+1)};
    if (token.kind === "(") { const node = parse(0,depth+1); take(")"); return node; }
    if (token.kind === "name") {
      if (["TRUE","WAAR","FALSE","ONWAAR","NULL"].includes(token.value)) return {kind:"literal",value:token.value === "NULL" ? null : ["TRUE","WAAR"].includes(token.value)};
      const name = FUNCTIONS[token.value]; if (!name) throw new Error(`Functie ${token.value} is niet toegestaan.`);
      take("("); const args: Node[] = [];
      if (peek() !== ")") { args.push(parse(0,depth+1)); while (peek() === "," || peek() === ";") { at++; args.push(parse(0,depth+1)); } }
      take(")");
      if ((name === "IF" && args.length !== 3) || (name === "ABS" && args.length !== 1) || (name === "ROUND" && (args.length < 1 || args.length > 2)) || !args.length || args.length > 20) throw new Error(`Verkeerd aantal argumenten voor ${name}.`);
      return {kind:"call",name,args};
    }
    throw new Error("Ongeldige formule. Gebruik bijvoorbeeld [revenue] - [costs].");
  }
  const priority: Record<string, number> = {"=":1,"!=":1,"<>":1,"<":1,">":1,"<=":1,">=":1,"+":2,"-":2,"*":3,"/":3,"^":4};
  function parse(min: number, depth: number): Node {
    let left = primary(depth);
    while (peek() && (priority[peek()] ?? -1) >= min) {
      const op = tokens[at++].kind, right = parse(priority[op] + (op === "^" ? 0 : 1),depth+1);
      left = {kind:"binary",op,left,right};
    }
    return left;
  }
  const tree = parse(0,0); if (at !== tokens.length) throw new Error("Er staan onverwachte onderdelen achter de formule.");
  return {fields:[...fields],evaluate:(row) => evaluate(tree,row)};
}
function numeric(value: Cell): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function finite(value: number): number | null { return Number.isFinite(value) ? value : null; }
function evaluate(node: Node, row: Record<string, Cell>): Cell {
  if (node.kind === "literal") return node.value;
  if (node.kind === "field") return Object.hasOwn(row,node.name) ? row[node.name] : null;
  if (node.kind === "unary") { const n = numeric(evaluate(node.child,row)); return n === null ? null : finite(node.op === "-" ? -n : n); }
  if (node.kind === "call") {
    if (node.name === "IF") return evaluate(node.args[0],row) ? evaluate(node.args[1],row) : evaluate(node.args[2],row);
    const values = node.args.map((arg)=>evaluate(arg,row));
    if (node.name === "COALESCE") return values.find((value)=>value !== null) ?? null;
    const nums = values.map(numeric); if (nums.some((n)=>n === null)) return null;
    const ns = nums as number[];
    if (node.name === "ABS") return Math.abs(ns[0]);
    if (node.name === "MIN") return Math.min(...ns);
    if (node.name === "MAX") return Math.max(...ns);
    const digits = ns[1] ?? 0; if (!Number.isInteger(digits) || Math.abs(digits)>10) return null;
    return finite(Math.round((ns[0]+Number.EPSILON)*10**digits)/10**digits);
  }
  const left=evaluate(node.left,row),right=evaluate(node.right,row);
  if (["=","!=","<>"].includes(node.op)) return node.op === "=" ? left === right : left !== right;
  if (left === null || right === null) return null;
  if (["<",">","<=",">="].includes(node.op)) {
    if (typeof left !== typeof right || (typeof left !== "number" && typeof left !== "string")) return null;
    const other = right as string | number;
    if (node.op === "<") return left < other; if (node.op === ">") return left > other;
    return node.op === "<=" ? left <= other : left >= other;
  }
  const a=numeric(left),b=numeric(right); if(a===null||b===null)return null;
  if(node.op==="+")return finite(a+b);if(node.op==="-")return finite(a-b);if(node.op==="*")return finite(a*b);
  if(node.op==="/")return b===0?null:finite(a/b);return finite(a**b);
}
