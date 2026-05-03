const fs = require('fs');
const path = require('path');

const dirs = ['src/api/endpoints', 'src/api/model'];

for (const dir of dirs) {
	const resolved = path.resolve(__dirname, '..', dir);
	try {
		fs.rmSync(resolved, { recursive: true });
		console.log(`Deleted: ${dir}`);
	} catch {
		// Directory doesn't exist — nothing to clean
	}
}
