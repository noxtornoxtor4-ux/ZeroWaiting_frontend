const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../src/api/endpoints');
const files = fs
	.readdirSync(dir)
	.filter((f) => f.endsWith('.ts') && f !== 'index.ts')
	.sort();

// Parse each module for create* functions with optional params callbacks
const PARAMS_RE =
	/export function (create\w+)<.+>\(\n\s*params\?\: \(\) =>\s+(\w+)/g;

const wrappers = []; // { fnName, paramsType, moduleIdx }
const paramsTypes = new Set();

for (const [i, file] of files.entries()) {
	const src = fs.readFileSync(path.join(dir, file), 'utf8');
	let match;
	while ((match = PARAMS_RE.exec(src)) !== null) {
		wrappers.push({ fnName: match[1], paramsType: match[2], moduleIdx: i });
		paramsTypes.add(match[2]);
	}
}

// --- Generate ---

const imports = files
	.map((f, i) => `import * as _m${i} from './${f.replace('.ts', '')}';`)
	.join('\n');

const typeImports = paramsTypes.size
	? `import type { ${[...paramsTypes].sort().join(', ')} } from '../model';`
	: '';

const baseType = files.map((_, i) => `typeof _m${i}`).join(' & ');
const spread = files.map((_, i) => `..._m${i}`).join(', ');

// Generate wrapper functions — TypeScript infers return type from body
const wrapperFns = wrappers
	.map(
		({ fnName, moduleIdx }, i) =>
			`const _w${i} = (...a: any[]) => _m${moduleIdx}.${fnName}(...a);`
	)
	.join('\n');

// Overloads: callback (generic strict check) + direct (standard excess check)
const overrideEntries = wrappers
	.map(
		({ fnName, paramsType }, i) =>
			`\t${fnName}: {\n` +
			`\t\t<R extends ${paramsType}>(params: _StrictCb<R, ${paramsType}>, ...args: any[]): ReturnType<typeof _w${i}>;\n` +
			`\t\t(params?: ${paramsType}, ...args: any[]): ReturnType<typeof _w${i}>;\n` +
			`\t};`
	)
	.join('\n');

// Generate runtime wrappers in the object
const wrapEntries = wrappers
	.map(({ fnName }, i) => `\t${fnName}: _wrap(_w${i})`)
	.join(',\n');

const content = `${imports}
${typeImports}

type _StrictCb<R, Shape> = () => {
\t[K in keyof R]: K extends keyof Shape ? R[K] : \`\$\{K & string\} is not a valid param\`;
};

type _Base = ${baseType};

${wrapperFns}

type _Overrides = {
${overrideEntries}
};

const _raw = { ${spread} };

const _wrap = (fn: (...args: any[]) => any) => (params?: unknown, ...args: any[]) =>
\tfn(typeof params === 'function' ? params : params != null ? () => params : undefined, ...args);

export const crmQueryApi = {
\t..._raw,
${wrapEntries},
} as Omit<_Base, keyof _Overrides> & _Overrides;
`;

fs.writeFileSync(path.join(dir, 'index.ts'), content);
console.log(
	`Generated barrel with ${files.length} files, ${wrappers.length} strict wrappers.`
);
