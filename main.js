<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DV/MTS 极速转码下载器</title>
    <script src="https://unpkg.com/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.js"></script>
    <style>
        :root { --primary-color: #007aff; }
        body { font-family: sans-serif; padding: 20px; }
        #prog-box { width: 100%; background: #eee; border-radius: 4px; height: 20px; margin-top: 10px; display: none; }
        #progress-bar { height: 100%; width: 0; background: var(--primary-color); border-radius: 4px; transition: width 0.1s; }
        #status { margin-top: 10px; }
    </style>
</head>
<body>
    <h2>DV/MTS 极速转码下载器 (iPhone 兼容)</h2>
    <input type="file" id="uploader" accept=".mts,.mp4,.mov"><br>
    <div id="prog-box"><div id="progress-bar"></div></div>
    <div id="status"></div>

    <script>
        const { createFFmpeg, fetchFile } = FFmpeg;

        // 初始化 FFmpeg 实例
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

                await ffmpeg.run(
                    '-i', 'input.mts',
                    '-vf', 'yadif,format=yuv420p',
                    '-c:v', 'libx264',
                    '-profile:v', 'main',
                    '-level', '4.0',
                    '-preset', 'ultrafast', // 使用最快预设，减少浏览器假死几率
                    '-crf', '26',           // 质量系数
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-movflags', 'faststart',
                    'output.mp4'
                );

                // 5. 生成下载文件
                status.innerText = "🎉 转码成功！正在生成下载文件...";
                const outputData = ffmpeg.FS('readFile', 'output.mp4');

                if (outputData.length < 1000) throw new Error("转码输出异常，文件过小");

                const blob = new Blob([outputData.buffer], { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'converted.mp4'; // 可根据需要改文件名
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                status.innerHTML = `✅ 转换完成！视频已自动下载到您的设备。`;

                // 6. 内存清理
                ffmpeg.FS('unlink', 'input.mts');
                ffmpeg.FS('unlink', 'output.mp4');

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
    </script>
</body>
</html>
