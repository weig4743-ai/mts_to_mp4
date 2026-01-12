/**
 * 针对 DV/MTS 优化的 iPhone 专用转码逻辑
 * 修改点：移除视频播放器，改为直接触发文件下载
 */

const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

const uploader = document.getElementById('uploader');
const status = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const progBox = document.getElementById('prog-box');

// 核心转换函数
async function transcode(file) {
    try {
        // 1. 加载引擎
        if (!ffmpeg.isLoaded()) {
            status.innerText = "⏳ 正在初始化转码引擎...";
            await ffmpeg.load();
        }

        // 2. 清理残余文件
        try {
            ffmpeg.FS('unlink', 'input.mts');
            ffmpeg.FS('unlink', 'output.mp4');
        } catch (e) {}

        // 3. 读取文件
        status.innerText = "📂 正在读取原始文件...";
        const data = await file.arrayBuffer();
        ffmpeg.FS('writeFile', 'input.mts', new Uint8Array(data));

        // 4. 开始转码
        progBox.style.display = 'block';
        status.innerText = "⚙️ 正在进行兼容性转码 (请保持屏幕常亮)...";

        ffmpeg.setProgress(({ ratio }) => {
            progressBar.style.width = `${Math.floor(ratio * 100)}%`;
        });

        await ffmpeg.run(
            '-i', 'input.mts',
            '-vf', 'yadif,format=yuv420p',
            '-c:v', 'libx264',
            '-profile:v', 'main',
            '-level', '4.0',
            '-preset', 'ultrafast',
            '-crf', '26',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', 'faststart',
            'output.mp4'
        );

        // 5. 生成并自动下载
        status.innerText = "🎉 转码成功！正在发起下载...";
        const outputData = ffmpeg.FS('readFile', 'output.mp4');
        
        if (outputData.length < 1000) throw new Error("转码输出异常，文件过小");

        const blob = new Blob([outputData.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        // --- 核心修改：模拟点击下载 ---
        const a = document.createElement('a');
        a.href = url;
        // 自动设置下载文件名（原文件名去掉后缀 + .mp4）
        const downloadName = file.name.split('.').slice(0, -1).join('.') + '.mp4';
        a.download = downloadName;
        document.body.appendChild(a);
        a.click(); // 触发下载弹窗
        
        // 延迟清理，防止下载链接过快失效
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 1000);

        status.innerHTML = `✅ 转换完成！<br>视频已自动开始下载。请检查 <strong>Safari 下载列表</strong> 或 <strong>文件 App</strong>。`;

        // 6. 内存清理
        ffmpeg.FS('unlink', 'input.mts');

    } catch (err) {
        console.error(err);
        status.innerHTML = `❌ 出错了: ${err.message}`;
    }
}

uploader.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        transcode(e.target.files[0]);
    }
});
