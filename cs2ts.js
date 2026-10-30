// Paste your C# between the backticks below, then run:
//   node cs2ts.js
const CAMEL_CASE = false; // true => PascalCase names become camelCase

const CSHARP = String.raw`
public enum Car(string Make, string Model, int Year);
`;

// ---------------------------------------------------------------------------
const PRIMS = {
  string: 'string', char: 'string', Guid: 'string', DateTime: 'string', DateTimeOffset: 'string',
  TimeSpan: 'string', bool: 'boolean', object: 'any', dynamic: 'any', void: 'void',
  Task: 'Promise<void>', ValueTask: 'Promise<void>',
  byte: 'number', sbyte: 'number', short: 'number', ushort: 'number', int: 'number', uint: 'number',
  long: 'number', ulong: 'number', float: 'number', double: 'number', decimal: 'number',
};
const LISTS = /^(List|IList|IEnumerable|ICollection|IReadOnlyList|IReadOnlyCollection|HashSet|ISet|ImmutableArray)$/;
const DICTS = /^(Dictionary|IDictionary|IReadOnlyDictionary)$/;
const id = n => (CAMEL_CASE ? n[0].toLowerCase() + n.slice(1) : n);

// Split "A, B<C, D>" on top-level commas only
function splitArgs(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '<' || ch === '(') depth++;
    if (ch === '>' || ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function mapType(t) {
  t = t.trim().replace(/\s+/g, ' ');
  if (t.endsWith('?')) return `${mapType(t.slice(0, -1))} | null`;
  const arr = (x) => (x.includes(' | ') ? `(${x})[]` : `${x}[]`);
  if (t.endsWith('[]')) return arr(mapType(t.slice(0, -2)));
  const g = t.match(/^([\w.]+)<(.+)>$/);
  if (g) {
    const name = g[1].split('.').pop(), args = splitArgs(g[2]).map(mapType);
    if (LISTS.test(name)) return arr(args[0]);
    if (DICTS.test(name)) return `Record<${args[0]}, ${args[1]}>`;
    if (name === 'Nullable') return `${args[0]} | null`;
    if (name === 'Task' || name === 'ValueTask') return `Promise<${args[0]}>`;
    return `${name}<${args.join(', ')}>`;
  }
  return PRIMS[t] || t.split('.').pop();
}

function parseParam(p) {
  p = p.replace(/^\s*\[[^\]]*\]\s*/, '').replace(/^(?:this|params|ref|out|in|readonly)\s+/, '');
  const [decl, def] = p.split(/\s*=\s*/);
  const m = decl.trim().match(/^(.+?)\s+(\w+)$/);
  return m && { type: mapType(m[1]), name: id(m[2]), optional: def !== undefined };
}

const MODS = '((?:(?:static|virtual|override|async|required|abstract|sealed|readonly|new)\\s+)*)';
const TYPE = '([\\w<>\\[\\],.?\\s]+?)';
const propRe = new RegExp(`public\\s+${MODS}${TYPE}\\s+(\\w+)\\s*(\\{[^{}]*\\}|=>)`, 'g');
const methodRe = new RegExp(`public\\s+${MODS}${TYPE}\\s+(\\w+)\\s*(<[^<>()]*>)?\\s*\\(([^)]*)\\)`, 'g');
const header = /\b(record(?:\s+(?:class|struct))?|class|struct)\s+(\w+)\s*(<[\w\s,]+>)?\s*(?:\(([^;{]*?)\))?([^{;]*?)(\{|;)/g;

const src = CSHARP.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
const out = [];
let m;
while ((m = header.exec(src))) {
  const [, kind, name, generics = '', ctor = '', rest, end] = m;

  let body = '';
  if (end === '{') { // find matching closing brace
    let depth = 1, i = header.lastIndex;
    for (; depth && i < src.length; i++) depth += src[i] === '{' ? 1 : src[i] === '}' ? -1 : 0;
    body = src.slice(header.lastIndex, i - 1);
  }

  const members = [];

  // Positional record parameters become properties
  if (kind.startsWith('record')) {
    for (const p of splitArgs(ctor).map(parseParam).filter(Boolean)) members.push(`${p.name}: ${p.type};`);
  }

  // Properties (auto, get-only, expression-bodied)
  for (const [, mods, type, pname, acc] of body.matchAll(propRe)) {
    if (/static/.test(mods)) continue;
    const readonly = !/(?<!private\s|protected\s|internal\s)\b(?:set|init)\b/.test(acc);
    members.push(`${readonly ? 'readonly ' : ''}${id(pname)}: ${mapType(type)};`);
  }

  // Method signatures (bodies are not translated)
  for (const [, mods, ret, mname, gen = '', ps] of body.matchAll(methodRe)) {
    if (/static|override/.test(mods)) continue;
    const params = splitArgs(ps).map(parseParam).filter(Boolean)
      .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`);
    members.push(`${id(mname)}${gen}(${params.join(', ')}): ${mapType(ret)};`);
  }

  const bases = splitArgs(rest.split(/\bwhere\b/)[0].replace(/^\s*:/, ''))
    .map(b => b.replace(/\(.*\)$/, '').trim())
    .filter(b => b && !/^I[A-Z]/.test(b)) // skip interfaces
    .map(mapType);
  const ext = bases.length ? ` extends ${bases.join(', ')}` : '';
  const text = members.length ? `\n${members.map(x => `  ${x}`).join('\n')}\n` : '';
  out.push(`export interface ${name}${generics}${ext} {${text}}`);
}

console.log(out.join('\n\n'));
