const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({
    log: true,
    // 建议使用更稳定的 core 链接
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

const uploader = document.getElementById('uploader');
const status = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const progBox = document.getElementById('prog-box');
const player = document.getElementById('player');

// 辅助函数：将 File 对象转换为 Uint8Array，避免 fetchFile 的某些兼容问题
const readFile = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
};

uploader.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. 初步检查：如果文件大于 1.5GB，在 iPhone 浏览器上极度危险
    if (file.size > 1.5 * 1024 * 1024 * 1024) {
        alert("文件过大（超过 1.5GB），iPhone 浏览器可能会强制刷新网页。建议分段拍摄或使用 a-Shell 工具。");
    }

    try {
        status.innerText = "⏳ 正在唤醒转码引擎...";
        if (!ffmpeg.isLoaded()) await ffmpeg.load();

        // 2. 清理旧数据，释放内存
        try {
            ffmpeg.FS('unlink', 'input.mts');
            ffmpeg.FS('unlink', 'output.mp4');
        } catch (e) {}

        status.innerText = "📂 正在读取文件到内存 (请稍候)...";
        progBox.style.display = 'block';
        progressBar.style.width = '5%'; // 给人一种正在动的感觉

        // 3. 使用更稳健的方式读取文件
        const fileData = await readFile(file);
        ffmpeg.FS('writeFile', 'input.mts', fileData);
        
        status.innerText = "⚙️ 正在转码 (此过程最耗时)...";
        
        ffmpeg.setProgress(({ ratio }) => {
            // 进度条从 10% 开始，避免刚开始显示 0%
            const p = Math.floor(ratio * 90) + 10;
            progressBar.style.width = `${p}%`;
        });

        // 4. 优化转码指令：增加 -movflags faststart 方便网页流式播放
        await ffmpeg.run(
            '-i', 'input.mts',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '28', // 稍微增加压缩率，减少内存压力
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-movflags', 'faststart',
            'output.mp4'
        );

        status.innerText = "🎉 处理完成！正在打包视频...";
        
        const data = ffmpeg.FS('readFile', 'output.mp4');
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        
        player.src = url;
        player.style.display = 'block';
        status.innerHTML = `✅ 转码成功！<br>长按上方视频选择“保存到照片”`;

        // 5. 立即释放巨大的 Uint8Array 内存
        ffmpeg.FS('unlink', 'input.mts');

    } catch (err) {
        console.error(err);
        status.innerText = "❌ 内存溢出或出错，请刷新页面重试。";
    }
});
