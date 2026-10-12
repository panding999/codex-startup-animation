import { execSync } from 'node:child_process';

const ffmpeg = 'D:\\Data\\ffmpeg-8.1.2-essentials_build\\bin\\ffmpeg.exe';
for (let s = 6; s <= 12; s += 0.5) {
  const ss = s.toFixed(1);
  execSync(`"${ffmpeg}" -y -ss ${ss} -i video-animation/elaina-sleepy-wandering-witch-moewalls-com.mp4 -vframes 1 -vf scale=480:-1 assets/wake_${ss}.jpg`, { stdio: 'ignore' });
}
console.log('Extracted wake sequence 6s to 12s');
