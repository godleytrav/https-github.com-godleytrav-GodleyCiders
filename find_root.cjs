const fs = require('fs');
const cp = require('child_process');
try {
  console.log(cp.execSync('find /public -name "*EnterEden*" 2>/dev/null').toString());
} catch(e) {}
