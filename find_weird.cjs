const fs = require('fs');
const files = fs.readdirSync('.');
const weirdFiles = files.filter(f => f.includes('EnterEden'));
console.log("Weird files count:", weirdFiles.length);
if (weirdFiles.length > 0) console.log("Example:", weirdFiles[0]);
