const fs = require('fs');
const files = fs.readdirSync('public/assets/Enter Eden Splash');
const nums = files.map(f => parseInt(f.match(/\d+/)[0])).sort((a,b) => a-b);
console.log('Count:', nums.length);
console.log('Min:', nums[0]);
console.log('Max:', nums[nums.length-1]);
console.log('All:', nums.join(', '));
