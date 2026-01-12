/**
 * 针对 DV/MTS 优化的 iPhone 专用转码逻辑
 * 重点：修复像素格式兼容性、音频编码及隔行扫描问题
 */

const { createFFmpeg, fetchFile } = FFmpeg;

// 初始化 FFmpeg 实例
const ffmpeg = createFFmpeg({
    log: true,
    // 使用稳定的核心库地址
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

const uploader = document.getElementById('uploader');
const status = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const progBox = document.getElementById('prog-box');
const player = document.getElementById('player');

// 核心转换函数
async function transcode(file) {
    try {
        // 1. 加载引擎
        if (!ffmpeg.isLoaded()) {
            status.innerText = "⏳ 正在初始化转码引擎...";
            await ffmpeg.load();
        }

        // 2. 清理之前的残余文件，释放内存
        try {
            ffmpeg.FS('unlink', 'input.mts');
            ffmpeg.FS('unlink', 'output.mp4');
        } catch (e) {}

        // 3. 读取文件到内存
        status.innerText = "📂 正在读取 DV 原始文件...";
        const data = await file.arrayBuffer();
        ffmpeg.FS('writeFile', 'input.mts', new Uint8Array(data));

        // 4. 开始转码
        progBox.style.display = 'block';
        status.innerText = "⚙️ 正在进行兼容性转码 (请保持屏幕常亮)...";

        ffmpeg.setProgress(({ ratio }) => {
            progressBar.style.width = `${Math.floor(ratio * 100)}%`;
        });

        /**
         * 修复“无法打开”的核心参数解析：
         * -vf "yadif,format=yuv420p": yadif 去除 DV 横纹；format=yuv420p 强制使用 iOS 兼容的色彩空间
         * -c:v libx264: 使用标准的 H.264 编码
         * -profile:v main -level 4.0: 限制编码等级，确保旧款 iPhone 也能硬件解码
         * -c:a aac -b:a 128k: 将 DV 的 AC3/PCM 音频转为标准的 AAC
         * -movflags faststart: 将元数据置于文件头，确保视频能被 iOS 快速识别和播放
         */
        await ffmpeg.run(
            '-i', 'input.mts',
            '-vf', 'yadif,format=yuv420p',
            '-c:v', 'libx264',
            '-profile:v', 'main',
            '-level', '4.0',
            '-preset', 'ultrafast', // 使用最快预设，减少浏览器假死几率
            '-crf', '26',           // 质量系数，26 在手机端画质很好且体积较小
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', 'faststart',
            'output.mp4'
        );

        // 5. 生成结果
        status.innerText = "🎉 转码成功！正在生成预览...";
        const outputData = ffmpeg.FS('readFile', 'output.mp4');
        
        // 检查文件是否生成成功
        if (outputData.length < 1000) throw new Error("转码输出异常，文件过小");

        const url = URL.createObjectURL(new Blob([outputData.buffer], { type: 'video/mp4' }));
        
        player.src = url;
        player.style.display = 'block';
        
        status.innerHTML = `✅ 转换完成！<br>请<strong>长按下方视频</strong>选择“保存到照片”`;

        // 6. 内存清理
        ffmpeg.FS('unlink', 'input.mts');

    } catch (err) {
        console.error(err);
        status.innerHTML = `❌ 出错了: ${err.message}<br>提示：如果文件超过 500MB，建议裁剪后再转。`;
    }
}

// 监听上传事件
uploader.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        transcode(e.target.files[0]);
    }
});
