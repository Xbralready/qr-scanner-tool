const sharp = require('sharp');
const jsQR = require('jsqr');
const QrCode = require('qrcode-reader');
const Jimp = require('jimp');

async function testQRRecognition() {
  const imageBuffer = require('fs').readFileSync('debug_qr.png');

  console.log('Testing QR recognition with different libraries...\n');

  // 测试1: jsQR 库
  try {
    console.log('=== 测试 jsQR 库 ===');
    const { data, info } = await sharp(imageBuffer)
      .toColorspace('srgb')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    console.log(`图片信息: ${info.width}x${info.height}, channels: ${info.channels}`);

    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (code && code.data) {
      console.log('✓ jsQR 成功识别:', code.data);
    } else {
      console.log('✗ jsQR 识别失败');
    }
  } catch (error) {
    console.log('✗ jsQR 错误:', error.message);
  }

  // 测试2: qrcode-reader + Jimp
  try {
    console.log('\n=== 测试 qrcode-reader 库 ===');

    // 尝试读取 Jimp 不同方式
    const image = await new Promise((resolve, reject) => {
      new Jimp(imageBuffer, (err, img) => {
        if (err) reject(err);
        else resolve(img);
      });
    });

    const qr = new QrCode();

    const result = await new Promise((resolve, reject) => {
      qr.callback = (err, value) => {
        if (err) {
          reject(err);
        } else if (value && value.result) {
          resolve(value.result);
        } else {
          reject(new Error('No QR code found'));
        }
      };
      qr.decode(image.bitmap);
    });

    console.log('✓ qrcode-reader 成功识别:', result);
  } catch (error) {
    console.log('✗ qrcode-reader 识别失败:', error.message);
  }

  // 测试3: 带LOGO遮盖的 jsQR
  try {
    console.log('\n=== 测试 LOGO遮盖方法 ===');
    const { data, info } = await sharp(imageBuffer)
      .toColorspace('srgb')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 复制数据
    const maskedData = new Uint8ClampedArray(data);

    // 遮盖中心区域
    const centerX = Math.floor(info.width / 2);
    const centerY = Math.floor(info.height / 2);
    const maskSize = Math.floor(Math.min(info.width, info.height) * 0.15);

    for (let y = centerY - maskSize; y < centerY + maskSize; y++) {
      for (let x = centerX - maskSize; x < centerX + maskSize; x++) {
        if (x >= 0 && x < info.width && y >= 0 && y < info.height) {
          const pixelIndex = (y * info.width + x) * 4;
          maskedData[pixelIndex] = 255;     // R - 白色
          maskedData[pixelIndex + 1] = 255; // G - 白色
          maskedData[pixelIndex + 2] = 255; // B - 白色
          maskedData[pixelIndex + 3] = 255; // A - 不透明
        }
      }
    }

    const code = jsQR(maskedData, info.width, info.height);
    if (code && code.data) {
      console.log('✓ LOGO遮盖方法成功识别:', code.data);
    } else {
      console.log('✗ LOGO遮盖方法识别失败');
    }
  } catch (error) {
    console.log('✗ LOGO遮盖方法错误:', error.message);
  }
}

// 安装jimp
const { execSync } = require('child_process');
try {
  execSync('npm list jimp', { stdio: 'ignore' });
} catch {
  console.log('安装 jimp...');
  execSync('npm install jimp@0.22.12', { stdio: 'inherit' });
}

testQRRecognition().catch(console.error);