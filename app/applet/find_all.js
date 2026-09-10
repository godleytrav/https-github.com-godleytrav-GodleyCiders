const { execSync } = require('child_process');
try {
  console.log(execSync('find /app/applet -name "*EnterEden*"').toString());
} catch(e) {
  console.log(e.stdout ? e.stdout.toString() : '');
}
