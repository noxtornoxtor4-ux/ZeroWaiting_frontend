import { defineConfig } from 'orval';

const OPENAPI_BASE_URL =
	process.env.OPENAPI_BASE_URL ?? 'https://api-zerowaiting.elcho.dev';

const fetchPatchedSpec = async () => {
	const res = await fetch(`${OPENAPI_BASE_URL}/api/docs/json`);
	const spec = await res.json();
	// Fix: bearerAuth HTTP scheme has invalid `name`/`in` fields (only valid for apiKey).
	const bearerAuth = spec.components?.securitySchemes?.bearerAuth;
	if (bearerAuth?.type === 'http') {
		delete bearerAuth.name;
		delete bearerAuth.in;
	}

	// Fix: some operations are missing path parameter declarations for params used in the URL.
	type PathParam = {
		name: string;
		in: string;
		required: boolean;
		schema: object;
	};
	type Operation = { parameters?: PathParam[] };
	type PathItem = Record<string, Operation | undefined>;

	const HTTP_METHODS = [
		'get',
		'put',
		'post',
		'delete',
		'patch',
		'options',
		'head',
		'trace'
	];
	// Fix: "Bearer Token" key contains a space, which is invalid per the OpenAPI spec.
	// Rename to "BearerToken" and update all operation-level security references.
	if (spec.components?.securitySchemes?.['Bearer Token']) {
		spec.components.securitySchemes['BearerToken'] =
			spec.components.securitySchemes['Bearer Token'];
		delete spec.components.securitySchemes['Bearer Token'];

		for (const pathItem of Object.values(spec.paths ?? {}) as PathItem[]) {
			for (const method of HTTP_METHODS) {
				const operation = pathItem[method] as
					| (Operation & { security?: Record<string, string[]>[] })
					| undefined;
				if (!operation?.security) continue;
				for (const secReq of operation.security) {
					if ('Bearer Token' in secReq) {
						secReq['BearerToken'] = secReq['Bearer Token'];
						delete secReq['Bearer Token'];
					}
				}
			}
		}
	}

	for (const [path, pathItem] of Object.entries(spec.paths ?? {}) as [
		string,
		PathItem
	][]) {
		const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
		if (pathParams.length === 0) continue;

		for (const method of HTTP_METHODS) {
			const operation = pathItem[method];
			if (!operation) continue;

			operation.parameters ??= [];
			for (const param of pathParams) {
				const declared = operation.parameters.some(
					(p) => p.name === param && p.in === 'path'
				);
				if (!declared) {
					operation.parameters.push({
						name: param,
						in: 'path',
						required: true,
						schema: { type: 'string' }
					});
				}
			}
		}
	}
	// Fix: responses declared as application/octet-stream or */* cause orval to generate
	// Blob return types. Replace with application/json so types are correctly inferred.
	type ResponseContent = Record<string, { schema?: object }>;
	type ResponseItem = { content?: ResponseContent };
	type OperationWithResponses = { responses?: Record<string, ResponseItem> };
	type PathItemWithResponses = Record<
		string,
		OperationWithResponses | undefined
	>;

	for (const pathItem of Object.values(
		spec.paths ?? {}
	) as PathItemWithResponses[]) {
		for (const method of HTTP_METHODS) {
			const operation = pathItem[method];
			if (!operation?.responses) continue;

			for (const response of Object.values(operation.responses)) {
				const content = response?.content;
				if (!content) continue;

				for (const mimeType of ['*/*', 'application/octet-stream']) {
					if (mimeType in content) {
						content['application/json'] ??= content[mimeType];
						delete content[mimeType];
					}
				}
			}
		}
	}

	return spec;
};

export default defineConfig({
	zerowaiting: {
		input: {
			target: await fetchPatchedSpec()
		},
		output: {
			mode: 'tags',
			target: 'src/api/endpoints/index.ts',
			schemas: 'src/api/model',
			client: 'svelte-query',
			httpClient: 'axios',
			prettier: false,
			override: {
				mutator: {
					path: './src/api/mutator/custom-instance.ts',
					name: 'customInstance'
				},
				operationName: (_operation, route, verb) => {
					// Extract API version (v1, v2, etc.) and move to the end
					const withoutApi = route.replace(/^\/api\//, '');
					const versionMatch = withoutApi.match(/^(v\d+)\//);
					const version = versionMatch ? versionMatch[1] : '';
					const withoutVersion = version
						? withoutApi.replace(`${version}/`, '')
						: withoutApi;

					const path = withoutVersion
						.replace(/\{(\w+)\}/g, '/by-$1')
						.split('/')
						.filter(Boolean)
						.map((s, i) =>
							i === 0
								? s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
								: s[0].toUpperCase() +
									s
										.slice(1)
										.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
						)
						.join('');

					const versionSuffix = version
						? version[0].toUpperCase() + version.slice(1)
						: '';

					const isMutation = ['post', 'put', 'patch', 'delete'].includes(verb);
					const mutationSuffix = isMutation ? 'Mutation' : '';

					return `${verb}${path[0].toUpperCase()}${path.slice(1)}${versionSuffix}${mutationSuffix}`;
				},
				query: {
					// Это включит генерацию thunks (() => options) для Svelte 5
					version: 6 as any
				}
			}
		}
	}
});
