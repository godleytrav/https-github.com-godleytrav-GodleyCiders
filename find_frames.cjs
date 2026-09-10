const fs = require('fs');
const cp = require('child_process');
try {
  const result = cp.execSync('find public/assets -name "*EnterEden*"').toString().split('\n').filter(Boolean);
  console.log("Total files found:", result.length);
  const first10 = result.slice(0, 10);
  console.log("First 10:\n" + first10.join('\n'));
} catch (e) {}
