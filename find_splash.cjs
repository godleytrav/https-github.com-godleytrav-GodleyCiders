const cp = require('child_process');
try {
  console.log(cp.execSync('find / -type d -name "*Splash*" 2>/dev/null').toString());
  console.log(cp.execSync('find /app -type d -name "*Splash*" 2>/dev/null').toString());
} catch(e){}
